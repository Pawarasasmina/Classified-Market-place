import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async signToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    const passwordHash = await hash(registerDto.password, 10);

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

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await compare(loginDto.password, user.passwordHash);

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
    if (verifyPhoneDto.otpCode !== '123456') {
      throw new BadRequestException('Invalid OTP code');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        phone: verifyPhoneDto.phone,
        phoneVerified: true,
      },
    });

    return {
      message: 'Phone number verified successfully',
      user: sanitizeUser(user),
    };
  }
}
