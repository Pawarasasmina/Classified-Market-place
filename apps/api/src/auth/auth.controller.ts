import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestPhoneOtpDto } from './dto/request-phone-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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
}
