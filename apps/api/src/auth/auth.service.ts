import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import type { Prisma } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SellerProfilesService } from '../seller-profiles/seller-profiles.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPhoneOtpDto } from './dto/request-phone-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RevokeSessionDto } from './dto/revoke-session.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';

type BcryptModule = {
  hash(data: string, saltOrRounds: string | number): Promise<string>;
  compare(data: string, encrypted: string): Promise<boolean>;
};

type TokenContext = {
  userAgent?: string;
  ipAddress?: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type IssueTokenOptions = {
  rememberMe?: boolean;
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
  phone?: string;
  emailVerified: boolean;
};

type GooglePeopleResponse = {
  phoneNumbers?: Array<{
    value?: string;
    canonicalForm?: string;
    type?: string;
    metadata?: {
      primary?: boolean;
    };
  }>;
};

type GoogleTokenInfoResponse = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  aud?: string;
  azp?: string;
  iss?: string;
  exp?: string;
  email_verified?: string | boolean;
};

const bcryptLib = bcrypt as BcryptModule;
const authRateLimits = new Map<string, RateLimitEntry>();
const loginFailureLimit = 5;
const loginLockMinutes = 15;
const passwordResetExpiryMinutes = 30;
const emailVerificationExpiryHours = 24;

function sanitizeUser<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function cleanGooglePhone(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function deriveDeviceName(userAgent: string | undefined) {
  const trimmed = userAgent?.trim();
  return trimmed ? trimmed.slice(0, 120) : undefined;
}

@Injectable()
export class AuthService {
  private readonly otpExpiryMinutes = 10;
  private readonly maxOtpAttempts = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly sellerProfilesService: SellerProfilesService,
  ) {}

  private async signAccessToken(user: AuthUser) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        expiresIn: this.configService.get<string>(
          'JWT_EXPIRES_IN',
          '15m',
        ) as never,
      },
    );
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private createRefreshTokenValue() {
    return randomBytes(64).toString('base64url');
  }

  private createPublicTokenValue() {
    return randomBytes(32).toString('base64url');
  }

  private refreshTokenExpiresAt(options: IssueTokenOptions = {}) {
    const defaultDays = options.rememberMe ? '30' : '7';
    const configKey = options.rememberMe
      ? 'REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN_DAYS'
      : 'REFRESH_TOKEN_EXPIRES_IN_DAYS';
    const days = Number(this.configService.get<string>(configKey, defaultDays));
    return new Date(
      Date.now() +
        (Number.isFinite(days) ? days : Number(defaultDays)) * 86400000,
    );
  }

  private async issueTokens(
    user: AuthUser,
    context: TokenContext = {},
    options: IssueTokenOptions = {},
  ) {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = this.createRefreshTokenValue();
    const expiresAt = this.refreshTokenExpiresAt(options);
    const existingSessionCount = await this.prisma.refreshToken.count({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    });

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        rememberMe: options.rememberMe ?? false,
        expiresAt,
        deviceName: deriveDeviceName(context.userAgent),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        lastUsedAt: new Date(),
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      newDevice: existingSessionCount === 0,
    };
  }

  private rateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const current = authRateLimits.get(key);

    if (!current || current.resetAt < now) {
      authRateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    current.count += 1;

    if (current.count > limit) {
      throw new HttpException(
        'Too many attempts. Please wait a few minutes and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private rateLimitAuthAction(
    action: string,
    email: string | undefined,
    context: TokenContext,
    limit = 10,
  ) {
    const normalizedEmail = email ? normalizeEmail(email) : 'unknown';
    const ip = context.ipAddress ?? 'unknown-ip';
    this.rateLimit(`${action}:ip:${ip}`, limit, 15 * 60 * 1000);
    this.rateLimit(`${action}:email:${normalizedEmail}`, limit, 15 * 60 * 1000);
  }

  private async auditAuthEvent(
    event: string,
    context: TokenContext,
    details: {
      userId?: string;
      email?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ) {
    await this.prisma.authAuditLog.create({
      data: {
        event,
        userId: details.userId,
        email: details.email ? normalizeEmail(details.email) : undefined,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: details.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private getPublicWebUrl(path: string) {
    const baseUrl = this.configService.get<string>(
      'WEB_APP_URL',
      'http://localhost:3000',
    );

    return new URL(path, baseUrl).toString();
  }

  private shouldReturnDevAuthLinks() {
    return (
      this.configService.get<string>('AUTH_LINK_DEV_MODE', 'true') === 'true' &&
      process.env.NODE_ENV !== 'production'
    );
  }

  private async createPasswordResetLink(userId: string) {
    const token = this.createPublicTokenValue();
    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt: new Date(
          Date.now() + passwordResetExpiryMinutes * 60 * 1000,
        ),
      },
    });

    return this.getPublicWebUrl(
      `/reset-password?token=${encodeURIComponent(token)}`,
    );
  }

  private async createEmailVerificationLink(userId: string) {
    const token = this.createPublicTokenValue();
    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt: new Date(
          Date.now() + emailVerificationExpiryHours * 60 * 60 * 1000,
        ),
      },
    });

    return this.getPublicWebUrl(
      `/verify-email?token=${encodeURIComponent(token)}`,
    );
  }

  private async sendEmailVerificationEmail(email: string, actionUrl: string) {
    return this.mailService.sendAuthEmail({
      to: email,
      subject: 'Verify your Classified Marketplace email',
      heading: 'Verify your email address',
      body: `Confirm this email address within ${emailVerificationExpiryHours} hours so your account is ready for marketplace notifications and recovery.`,
      actionLabel: 'Verify email',
      actionUrl,
      fallbackText:
        'If the button does not work, copy and paste this verification link into your browser.',
    });
  }

  private async sendPasswordResetEmail(email: string, actionUrl: string) {
    return this.mailService.sendAuthEmail({
      to: email,
      subject: 'Reset your Classified Marketplace password',
      heading: 'Reset your password',
      body: `Use this secure link to choose a new password. It expires in ${passwordResetExpiryMinutes} minutes.`,
      actionLabel: 'Reset password',
      actionUrl,
      fallbackText:
        'If you did not request a password reset, you can ignore this email.',
    });
  }

  private logAuthLinkPreview(
    label: string,
    email: string,
    url: string,
    emailSent: boolean,
  ) {
    if (this.shouldReturnDevAuthLinks() || !emailSent) {
      console.info(`[AUTH LINK PREVIEW] ${label} link for ${email}: ${url}`);
    }
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

  private pickGooglePhoneNumber(
    phoneNumbers: GooglePeopleResponse['phoneNumbers'],
  ) {
    if (!phoneNumbers?.length) {
      return undefined;
    }

    const phoneNumber =
      phoneNumbers.find((phone) => phone.metadata?.primary) ??
      phoneNumbers.find((phone) => phone.type?.toLowerCase() === 'mobile') ??
      phoneNumbers[0];

    return cleanGooglePhone(phoneNumber.canonicalForm ?? phoneNumber.value);
  }

  private async getGooglePhoneNumber(accessToken: string | undefined) {
    if (!accessToken) {
      return undefined;
    }

    try {
      const response = await fetch(
        'https://people.googleapis.com/v1/people/me?personFields=phoneNumbers',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        return undefined;
      }

      const payload = (await response.json()) as GooglePeopleResponse;
      return this.pickGooglePhoneNumber(payload.phoneNumbers);
    } catch {
      return undefined;
    }
  }

  private async getGoogleProfile(dto: GoogleLoginDto): Promise<GoogleProfile> {
    if (dto.idToken) {
      this.rateLimit('google-token', 15, 15 * 60 * 1000);
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.idToken)}`,
      );

      if (!response.ok) {
        throw new UnauthorizedException('Invalid Google token');
      }

      const payload = (await response.json()) as GoogleTokenInfoResponse;
      const configuredClientId =
        this.configService.get<string>('GOOGLE_CLIENT_ID');

      if (
        configuredClientId &&
        ((payload.aud && payload.aud !== configuredClientId) ||
          (payload.azp && payload.azp !== configuredClientId))
      ) {
        throw new UnauthorizedException('Google token audience is not allowed');
      }

      if (
        payload.iss &&
        payload.iss !== 'https://accounts.google.com' &&
        payload.iss !== 'accounts.google.com'
      ) {
        throw new UnauthorizedException('Google token issuer is not allowed');
      }

      if (payload.exp && Number(payload.exp) * 1000 <= Date.now()) {
        throw new UnauthorizedException('Google token has expired');
      }

      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException('Google token is missing profile data');
      }

      const emailVerified =
        payload.email_verified === true || payload.email_verified === 'true';

      if (!emailVerified) {
        throw new BadRequestException('Google email is not verified');
      }

      const phone = await this.getGooglePhoneNumber(dto.accessToken);

      return {
        googleId: payload.sub,
        email: normalizeEmail(payload.email),
        displayName: payload.name ?? payload.email.split('@')[0],
        avatarUrl: payload.picture,
        phone,
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
    this.rateLimitAuthAction('register', registerDto.email, context, 6);

    if (!registerDto.termsAccepted) {
      throw new BadRequestException('Accept the Terms and Privacy Policy');
    }

    if (
      registerDto.confirmPassword &&
      registerDto.confirmPassword !== registerDto.password
    ) {
      throw new BadRequestException('Passwords do not match');
    }

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
        termsAcceptedAt: new Date(),
        role: 'USER',
      },
    });

    if (registerDto.accountType === 'SELLER') {
      await this.sellerProfilesService.registerSellerProfile(user.id, user.role, {
        formAnswers: registerDto.sellerFormAnswers,
        requestMetadata: registerDto.sellerRequestMetadata,
      });
    }

    const emailVerificationPreviewUrl = await this.createEmailVerificationLink(
      user.id,
    );
    const emailSent = await this.sendEmailVerificationEmail(
      email,
      emailVerificationPreviewUrl,
    );
    this.logAuthLinkPreview(
      'Email verification',
      email,
      emailVerificationPreviewUrl,
      emailSent,
    );
    await this.auditAuthEvent('register_success', context, {
      userId: user.id,
      email,
      metadata: {
        emailSent,
        accountType: registerDto.accountType ?? 'CUSTOMER',
      },
    });

    return {
      message: emailSent
        ? 'Account created. Check your email to verify your account.'
        : 'Account created. Use the dev verification link to verify your account.',
      email,
      user: sanitizeUser(user),
      emailVerificationPreviewUrl: this.shouldReturnDevAuthLinks()
        ? emailVerificationPreviewUrl
        : null,
    };
  }

  async login(loginDto: LoginDto, context: TokenContext = {}) {
    this.rateLimitAuthAction('login', loginDto.email, context);

    const invalidCredentials = 'Invalid email or password';
    const email = normalizeEmail(loginDto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user?.passwordHash || user.deactivatedAt) {
      await this.auditAuthEvent('login_failed', context, {
        email,
        metadata: { reason: user?.deactivatedAt ? 'deactivated' : 'invalid' },
      });
      throw new UnauthorizedException(invalidCredentials);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.auditAuthEvent('login_locked', context, {
        userId: user.id,
        email,
      });
      throw new HttpException(
        'Too many failed attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordMatches = await bcryptLib.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const lockedUntil =
        failedLoginAttempts >= loginFailureLimit
          ? new Date(Date.now() + loginLockMinutes * 60 * 1000)
          : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts,
          lastFailedLoginAt: new Date(),
          lockedUntil,
        },
      });
      await this.auditAuthEvent('login_failed', context, {
        userId: user.id,
        email,
        metadata: {
          failedLoginAttempts,
          lockedUntil,
        },
      });

      throw new UnauthorizedException(invalidCredentials);
    }

    if (!user.emailVerified && user.role.toUpperCase() !== 'ADMIN') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await this.auditAuthEvent('login_blocked_unverified_email', context, {
        userId: user.id,
        email,
      });
      throw new UnauthorizedException(
        'Verify your email before signing in. Check your inbox for the verification link.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        lockedUntil: null,
      },
    });
    const tokens = await this.issueTokens(user, context, {
      rememberMe: loginDto.rememberMe,
    });
    await this.auditAuthEvent('login_success', context, {
      userId: user.id,
      email,
      metadata: {
        newDevice: tokens.newDevice,
        rememberMe: !!loginDto.rememberMe,
      },
    });

    return {
      ...tokens,
      user: sanitizeUser(user),
    };
  }

  async googleLogin(dto: GoogleLoginDto, context: TokenContext = {}) {
    const profile = await this.getGoogleProfile(dto);
    this.rateLimitAuthAction('google', profile.email, context);
    const existingByGoogleId = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    const existingByEmail = existingByGoogleId
      ? null
      : await this.prisma.user.findUnique({
          where: { email: profile.email },
        });

    const existingUser = existingByGoogleId ?? existingByEmail;

    if (existingUser?.deactivatedAt) {
      await this.auditAuthEvent('google_login_blocked', context, {
        userId: existingUser.id,
        email: profile.email,
        metadata: { reason: 'deactivated' },
      });
      throw new UnauthorizedException('This account is no longer active');
    }

    if (existingUser?.role.toUpperCase() === 'ADMIN') {
      await this.auditAuthEvent('google_login_blocked', context, {
        userId: existingUser.id,
        email: profile.email,
        metadata: { reason: 'admin_account' },
      });
      throw new UnauthorizedException('Use the admin password login');
    }

    const user = existingByGoogleId
      ? await this.prisma.user.update({
          where: { id: existingByGoogleId.id },
          data: {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            phone: existingByGoogleId.phone ?? profile.phone,
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
              phone: existingByEmail.phone ?? profile.phone,
              emailVerified: profile.emailVerified,
            },
          })
        : await this.prisma.user.create({
            data: {
              googleId: profile.googleId,
              email: profile.email,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              phone: profile.phone,
              emailVerified: profile.emailVerified,
              termsAcceptedAt: new Date(),
              role: 'USER',
            },
          });
    const tokens = await this.issueTokens(user, context);
    await this.auditAuthEvent(
      existingByGoogleId || existingByEmail
        ? 'google_login_success'
        : 'google_register_success',
      context,
      {
        userId: user.id,
        email: profile.email,
        metadata: {
          linkedExistingEmail: !!existingByEmail,
          newDevice: tokens.newDevice,
        },
      },
    );

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
      storedToken.expiresAt.getTime() < Date.now() ||
      storedToken.user.deactivatedAt
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    if (
      !storedToken.user.emailVerified &&
      storedToken.user.role.toUpperCase() !== 'ADMIN'
    ) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          revokedAt: new Date(),
          revokedReason: 'email_verification_required',
        },
      });
      throw new UnauthorizedException('Verify your email before signing in');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date(), revokedReason: 'rotated' },
    });
    const tokens = await this.issueTokens(storedToken.user, context, {
      rememberMe: storedToken.rememberMe,
    });

    await this.prisma.user.update({
      where: { id: storedToken.userId },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        lockedUntil: null,
      },
    });

    return {
      ...tokens,
      user: sanitizeUser(storedToken.user),
    };
  }

  async logout(refreshTokenDto: RefreshTokenDto, context: TokenContext = {}) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshTokenDto.refreshToken) },
    });

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(refreshTokenDto.refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'logout',
      },
    });

    if (storedToken) {
      await this.auditAuthEvent('logout', context, {
        userId: storedToken.userId,
      });
    }

    return { message: 'Logged out successfully' };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
    context: TokenContext = {},
  ) {
    this.rateLimitAuthAction(
      'forgot-password',
      forgotPasswordDto.email,
      context,
      5,
    );
    const email = normalizeEmail(forgotPasswordDto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    let resetPreviewUrl: string | null = null;

    if (user?.passwordHash && !user.deactivatedAt) {
      resetPreviewUrl = await this.createPasswordResetLink(user.id);
      const emailSent = await this.sendPasswordResetEmail(
        email,
        resetPreviewUrl,
      );
      this.logAuthLinkPreview(
        'Password reset',
        email,
        resetPreviewUrl,
        emailSent,
      );
      await this.auditAuthEvent('password_reset_requested', context, {
        userId: user.id,
        email,
        metadata: { emailSent },
      });
    } else {
      await this.auditAuthEvent('password_reset_requested_unknown', context, {
        email,
      });
    }

    return {
      message:
        'If an account exists for that email, password reset instructions are available.',
      resetPreviewUrl: this.shouldReturnDevAuthLinks() ? resetPreviewUrl : null,
    };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
    context: TokenContext = {},
  ) {
    this.rateLimit(
      `reset-password:ip:${context.ipAddress ?? 'unknown-ip'}`,
      10,
      15 * 60 * 1000,
    );
    const tokenHash = this.hashToken(resetPasswordDto.token);
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !token ||
      token.consumedAt ||
      token.expiresAt.getTime() < Date.now() ||
      token.user.deactivatedAt
    ) {
      throw new BadRequestException(
        'Password reset link is invalid or expired',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: {
          passwordHash: await bcryptLib.hash(resetPasswordDto.password, 10),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'password_reset' },
      }),
    ]);
    await this.auditAuthEvent('password_reset_completed', context, {
      userId: token.userId,
      email: token.user.email,
    });

    return { message: 'Password reset successfully. Sign in again.' };
  }

  async resendEmailVerification(userId: string, context: TokenContext = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.deactivatedAt) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.emailVerified) {
      return {
        message: 'Email is already verified.',
        emailVerificationPreviewUrl: null,
      };
    }

    this.rateLimitAuthAction('resend-email-verification', user.email, context, 5);

    return this.sendVerificationForUser(user.id, user.email, context, 'email_verification_resent');
  }

  async resendEmailVerificationForEmail(
    resendEmailVerificationDto: ResendEmailVerificationDto,
    context: TokenContext = {},
  ) {
    const email = normalizeEmail(resendEmailVerificationDto.email);
    this.rateLimitAuthAction(
      'resend-email-verification-public',
      email,
      context,
      5,
    );
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && !user.deactivatedAt && !user.emailVerified) {
      return this.sendVerificationForUser(
        user.id,
        user.email,
        context,
        'email_verification_resent_public',
      );
    }

    await this.auditAuthEvent(
      'email_verification_resent_public_unknown',
      context,
      {
        email,
      },
    );

    return {
      message:
        'If an account exists for that email and still needs verification, a new verification link is available.',
      emailVerificationPreviewUrl: null,
    };
  }

  private async sendVerificationForUser(
    userId: string,
    email: string,
    context: TokenContext,
    auditEvent: string,
  ) {
    const emailVerificationPreviewUrl = await this.createEmailVerificationLink(
      userId,
    );
    const emailSent = await this.sendEmailVerificationEmail(
      email,
      emailVerificationPreviewUrl,
    );
    this.logAuthLinkPreview(
      'Email verification',
      email,
      emailVerificationPreviewUrl,
      emailSent,
    );
    await this.auditAuthEvent(auditEvent, context, {
      userId,
      email,
      metadata: { emailSent },
    });

    return {
      message: emailSent
        ? 'Verification email sent.'
        : 'Verification link is ready. Configure SMTP keys to send it by email.',
      emailVerificationPreviewUrl: this.shouldReturnDevAuthLinks()
        ? emailVerificationPreviewUrl
        : null,
    };
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
    context: TokenContext = {},
  ) {
    const tokenHash = this.hashToken(verifyEmailDto.token);
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !token ||
      token.consumedAt ||
      token.expiresAt.getTime() < Date.now() ||
      token.user.deactivatedAt
    ) {
      throw new BadRequestException(
        'Email verification link is invalid or expired',
      );
    }

    const [verifiedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { emailVerified: true, lastLoginAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    const tokens = await this.issueTokens(verifiedUser, context);
    await this.auditAuthEvent('email_verified', context, {
      userId: token.userId,
      email: token.user.email,
      metadata: { newDevice: tokens.newDevice },
    });

    return {
      ...tokens,
      user: sanitizeUser(verifiedUser),
      message: 'Email verified successfully.',
    };
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
    }));
  }

  async revokeSession(
    userId: string,
    revokeSessionDto: RevokeSessionDto,
    context: TokenContext = {},
  ) {
    await this.prisma.refreshToken.updateMany({
      where: {
        id: revokeSessionDto.sessionId,
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date(), revokedReason: 'manual_revoke' },
    });
    await this.auditAuthEvent('session_revoked', context, {
      userId,
      metadata: { sessionId: revokeSessionDto.sessionId },
    });

    return { message: 'Session revoked successfully.' };
  }

  async logoutAll(userId: string, context: TokenContext = {}) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date(), revokedReason: 'logout_all' },
    });
    await this.auditAuthEvent('logout_all', context, { userId });

    return { message: 'Logged out from all devices.' };
  }

  async requestPhoneOtp(
    userId: string,
    requestPhoneOtpDto: RequestPhoneOtpDto,
  ) {
    this.rateLimit(
      `request-phone-otp:user:${userId}`,
      5,
      15 * 60 * 1000,
    );
    this.rateLimit(
      `request-phone-otp:phone:${requestPhoneOtpDto.phone}`,
      5,
      15 * 60 * 1000,
    );
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

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phone: requestPhoneOtpDto.phone,
        phoneVerified: false,
        phoneVerificationStatus: 'PENDING',
        phoneVerificationRequestedAt: new Date(),
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
    this.rateLimit(
      `verify-phone:user:${userId}`,
      10,
      15 * 60 * 1000,
    );
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

    const now = new Date();

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          phone: verifyPhoneDto.phone,
          phoneVerified: true,
          phoneVerificationStatus: 'VERIFIED',
          phoneVerifiedAt: now,
        },
      }),
      this.prisma.phoneOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          consumedAt: now,
        },
      }),
    ]);

    return {
      message: 'Phone number verified successfully',
      user: sanitizeUser(user),
    };
  }
}
