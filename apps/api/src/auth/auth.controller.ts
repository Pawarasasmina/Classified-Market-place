import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPhoneOtpDto } from './dto/request-phone-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RevokeSessionDto } from './dto/revoke-session.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto, @Req() request: Request) {
    return this.authService.register(registerDto, this.getTokenContext(request));
  }

  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login(loginDto, this.getTokenContext(request));
  }

  @Post('google')
  googleLogin(@Body() googleLoginDto: GoogleLoginDto, @Req() request: Request) {
    return this.authService.googleLogin(
      googleLoginDto,
      this.getTokenContext(request),
    );
  }

  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(
      refreshTokenDto,
      this.getTokenContext(request),
    );
  }

  @Post('logout')
  logout(@Body() refreshTokenDto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.logout(
      refreshTokenDto,
      this.getTokenContext(request),
    );
  }

  @Post('forgot-password')
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.forgotPassword(
      forgotPasswordDto,
      this.getTokenContext(request),
    );
  }

  @Post('reset-password')
  resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.resetPassword(
      resetPasswordDto,
      this.getTokenContext(request),
    );
  }

  @Post('verify-email')
  verifyEmail(@Body() verifyEmailDto: VerifyEmailDto, @Req() request: Request) {
    return this.authService.verifyEmail(
      verifyEmailDto,
      this.getTokenContext(request),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('resend-email-verification')
  resendEmailVerification(
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    return this.authService.resendEmailVerification(
      user.id,
      this.getTokenContext(request),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  listSessions(@CurrentUser() user: { id: string }) {
    return this.authService.listSessions(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  revokeSession(
    @CurrentUser() user: { id: string },
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
  ) {
    return this.authService.revokeSession(
      user.id,
      { sessionId } satisfies RevokeSessionDto,
      this.getTokenContext(request),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: { id: string }, @Req() request: Request) {
    return this.authService.logoutAll(user.id, this.getTokenContext(request));
  }

  @UseGuards(JwtAuthGuard)
  @Post('request-phone-otp')
  requestPhoneOtp(
    @CurrentUser() user: { id: string },
    @Body() requestPhoneOtpDto: RequestPhoneOtpDto,
  ) {
    return this.authService.requestPhoneOtp(user.id, requestPhoneOtpDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-phone')
  verifyPhone(
    @CurrentUser() user: { id: string },
    @Body() verifyPhoneDto: VerifyPhoneDto,
  ) {
    return this.authService.verifyPhone(user.id, verifyPhoneDto);
  }

  private getTokenContext(request: Request) {
    return {
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
    };
  }
}
