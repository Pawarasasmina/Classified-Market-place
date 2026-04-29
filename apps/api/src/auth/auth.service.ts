import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RequestPhoneOtpDto } from './dto/request-phone-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';

function sanitizeUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return user;
}

type BcryptModule = {
  hash(data: string, saltOrRounds: string | number): Promise<string>;
  compare(data: string, encrypted: string): Promise<boolean>;
};

const bcryptLib = bcrypt as BcryptModule;

@Injectable()
export class AuthService {
  private readonly otpExpiryMinutes = 10;
  private readonly maxOtpAttempts = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async signToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
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
      const twilioFromPhone = fromPhone as string;

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
            From: twilioFromPhone,
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

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    const passwordHash = await bcryptLib.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        displayName: registerDto.displayName,
        phone: registerDto.phone,
        passwordHash,
        role: 'USER',
      },
    });

    const accessToken = await this.signToken(user);

    return {
      accessToken,
      user: sanitizeUser(user),
    };
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

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
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

    const accessToken = await this.signToken(user);

    return {
      accessToken,
      user: sanitizeUser(user),
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
