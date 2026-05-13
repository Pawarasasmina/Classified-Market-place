import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPhoneOtpDto } from './dto/request-phone-otp.dto';
import { RegisterDto } from './dto/register.dto';
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
  logout(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.logout(refreshTokenDto);
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
