import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPhoneOtpDto } from './dto/request-phone-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';

type BcryptModule = {
  hash(data: string, saltOrRounds: string | number): Promise<string>;
  compare(data: string, encrypted: string): Promise<boolean>;
};

type TokenContext = {
  userAgent?: string;
  ipAddress?: string;
};

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

type GoogleProfile = {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  emailVerified: boolean;
};

const bcryptLib = bcrypt as BcryptModule;

function sanitizeUser<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  private readonly otpExpiryMinutes = 10;
  private readonly maxOtpAttempts = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async signAccessToken(user: AuthUser) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m') as never,
      },
    );
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private createRefreshTokenValue() {
    return randomBytes(64).toString('base64url');
  }

  private refreshTokenExpiresAt() {
    const days = Number(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN_DAYS', '7'),
    );
    return new Date(Date.now() + (Number.isFinite(days) ? days : 7) * 86400000);
  }

  private async issueTokens(user: AuthUser, context: TokenContext = {}) {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = this.createRefreshTokenValue();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: this.refreshTokenExpiresAt(),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashOtpCode(phone: string, otpCode: string) {
    const secret = this.configService.get<string>(
      'OTP_HASH_SECRET',
      'dev-otp-secret',
    );

    return createHash('sha256')
      .update(`${phone}:${otpCode}:${secret}`)
      .digest('hex');
  }

  private generateOtpCode() {
    return randomInt(100000, 1000000).toString();
  }

  private isConfiguredTwilioValue(value: string | undefined) {
    if (!value) {
      return false;
    }

    return !value.includes('xxxxxxxx') && !value.includes('your_');
  }

  private async deliverOtpCode(phone: string, otpCode: string) {
    const otpDeliveryMode = this.configService.get<string>(
      'OTP_DELIVERY_MODE',
      'dev',
    );
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromPhone = this.configService.get<string>('TWILIO_FROM_PHONE');

    const shouldUseTwilio =
      otpDeliveryMode === 'twilio' &&
      this.isConfiguredTwilioValue(accountSid) &&
      this.isConfiguredTwilioValue(authToken) &&
      this.isConfiguredTwilioValue(fromPhone);

    if (shouldUseTwilio) {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phone,
            From: fromPhone as string,
            Body: `Your Classified Marketplace verification code is ${otpCode}. It expires in ${this.otpExpiryMinutes} minutes.`,
          }),
        },
      );

      if (!response.ok) {
        const details = await response.text();
        throw new InternalServerErrorException(
          `Failed to send OTP via Twilio: ${details || response.statusText}`,
        );
      }

      return {
        channel: 'sms' as const,
        previewCode: null,
      };
    }

    console.info(
      `[OTP PHASE1 DEV MODE] Verification code ${otpCode} for ${phone}`,
    );

    return {
      channel: 'dev' as const,
      previewCode: otpCode,
    };
  }

  private async getGoogleProfile(dto: GoogleLoginDto): Promise<GoogleProfile> {
    if (dto.idToken) {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.idToken)}`,
      );

      if (!response.ok) {
        throw new UnauthorizedException('Invalid Google token');
      }

      const payload = (await response.json()) as {
        sub?: string;
        email?: string;
        name?: string;
        picture?: string;
        aud?: string;
        email_verified?: string | boolean;
      };
      const configuredClientId =
        this.configService.get<string>('GOOGLE_CLIENT_ID');

      if (
        configuredClientId &&
        payload.aud &&
        payload.aud !== configuredClientId
      ) {
        throw new UnauthorizedException('Google token audience is not allowed');
      }

      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException('Google token is missing profile data');
      }

      const emailVerified =
        payload.email_verified === true || payload.email_verified === 'true';

      if (!emailVerified) {
        throw new BadRequestException('Google email is not verified');
      }

      return {
        googleId: payload.sub,
        email: normalizeEmail(payload.email),
        displayName: payload.name ?? payload.email.split('@')[0],
        avatarUrl: payload.picture,
        emailVerified,
      };
    }

    const devMode =
      this.configService.get<string>('GOOGLE_AUTH_DEV_MODE', 'false') ===
      'true';

    if (devMode && dto.email) {
      return {
        googleId: dto.googleId ?? `dev-google:${normalizeEmail(dto.email)}`,
        email: normalizeEmail(dto.email),
        displayName: dto.displayName ?? dto.email.split('@')[0],
        avatarUrl: dto.avatarUrl,
        emailVerified: true,
      };
    }

    throw new BadRequestException('Google ID token is required');
  }

  async register(registerDto: RegisterDto, context: TokenContext = {}) {
    const email = normalizeEmail(registerDto.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    const passwordHash = await bcryptLib.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: registerDto.displayName.trim(),
        phone: registerDto.phone,
        passwordHash,
        role: 'USER',
      },
    });
    const tokens = await this.issueTokens(user, context);

    return {
      ...tokens,
      user: sanitizeUser(user),
    };
  }

  async login(loginDto: LoginDto, context: TokenContext = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(loginDto.email) },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcryptLib.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user, context);

    return {
      ...tokens,
      user: sanitizeUser(user),
    };
  }

  async googleLogin(dto: GoogleLoginDto, context: TokenContext = {}) {
    const profile = await this.getGoogleProfile(dto);
    const existingByGoogleId = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    const existingByEmail = existingByGoogleId
      ? null
      : await this.prisma.user.findUnique({
          where: { email: profile.email },
        });

    const user = existingByGoogleId
      ? await this.prisma.user.update({
          where: { id: existingByGoogleId.id },
          data: {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            emailVerified: profile.emailVerified,
          },
        })
      : existingByEmail
        ? await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              googleId: profile.googleId,
              displayName: existingByEmail.displayName || profile.displayName,
              avatarUrl: existingByEmail.avatarUrl ?? profile.avatarUrl,
              emailVerified: profile.emailVerified,
            },
          })
        : await this.prisma.user.create({
            data: {
              googleId: profile.googleId,
              email: profile.email,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              emailVerified: profile.emailVerified,
              role: 'USER',
            },
          });
    const tokens = await this.issueTokens(user, context);

    return {
      ...tokens,
      user: sanitizeUser(user),
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto, context: TokenContext = {}) {
    const tokenHash = this.hashToken(refreshTokenDto.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.issueTokens(storedToken.user, context);

    return {
      ...tokens,
      user: sanitizeUser(storedToken.user),
    };
  }

  async logout(refreshTokenDto: RefreshTokenDto) {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(refreshTokenDto.refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { message: 'Logged out successfully' };
  }

  async requestPhoneOtp(
    userId: string,
    requestPhoneOtpDto: RequestPhoneOtpDto,
  ) {
    const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);
    const otpCode = this.generateOtpCode();

    await this.prisma.phoneOtpChallenge.updateMany({
      where: {
        userId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    await this.prisma.phoneOtpChallenge.create({
      data: {
        userId,
        phone: requestPhoneOtpDto.phone,
        codeHash: this.hashOtpCode(requestPhoneOtpDto.phone, otpCode),
        expiresAt,
      },
    });

    const delivery = await this.deliverOtpCode(
      requestPhoneOtpDto.phone,
      otpCode,
    );

    return {
      message:
        delivery.channel === 'sms'
          ? `OTP sent to ${requestPhoneOtpDto.phone}`
          : `Phase 1 dev mode: OTP for ${requestPhoneOtpDto.phone} is ${delivery.previewCode}`,
      channel: delivery.channel,
      expiresAt,
    };
  }

  async verifyPhone(userId: string, verifyPhoneDto: VerifyPhoneDto) {
    const challenge = await this.prisma.phoneOtpChallenge.findFirst({
      where: {
        userId,
        phone: verifyPhoneDto.phone,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!challenge) {
      throw new BadRequestException('Request an OTP code first');
    }

    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP code has expired. Request a new one');
    }

    if (challenge.attempts >= this.maxOtpAttempts) {
      throw new BadRequestException(
        'Too many incorrect OTP attempts. Request a new code',
      );
    }

    const otpMatches =
      challenge.codeHash ===
      this.hashOtpCode(verifyPhoneDto.phone, verifyPhoneDto.otpCode);

    if (!otpMatches) {
      await this.prisma.phoneOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      throw new BadRequestException('Invalid OTP code');
    }

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          phone: verifyPhoneDto.phone,
          phoneVerified: true,
        },
      }),
      this.prisma.phoneOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          consumedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Phone number verified successfully',
      user: sanitizeUser(user),
    };
  }
}
