import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { isPrismaConnectionError } from '../../prisma/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret'),
    });
  }

  private async findUserById(userId: string) {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
      });
    } catch (error) {
      if (!isPrismaConnectionError(error)) {
        throw error;
      }

      this.logger.warn(
        `Retrying JWT validation lookup after a database connection error for user ${userId}.`,
      );

      try {
        await this.prisma.$connect();
        return await this.prisma.user.findUnique({
          where: { id: userId },
        });
      } catch (retryError) {
        if (isPrismaConnectionError(retryError)) {
          throw new ServiceUnavailableException(
            'Database is temporarily unavailable. Please try again shortly.',
          );
        }

        throw retryError;
      }
    }
  }

  async validate(payload: JwtPayload) {
    const user = await this.findUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.deactivatedAt) {
      throw new UnauthorizedException('User account is deactivated');
    }

    if (!user.emailVerified && user.role.toUpperCase() !== 'ADMIN') {
      throw new UnauthorizedException('Verify your email before continuing');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
    };
  }
}
