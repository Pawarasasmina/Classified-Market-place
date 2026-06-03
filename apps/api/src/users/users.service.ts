import { Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus, SellerPriorityTier } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

function sanitizeUser(user: {
  id: string;
  email: string;
  displayName: string;
  passwordHash?: string | null;
  googleId?: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  role: string;
  sellerPriorityTier: SellerPriorityTier;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { passwordHash: _passwordHash, ...safeUser } = user;

  return safeUser;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications?: NotificationsService,
  ) {}

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return sanitizeUser(user);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        listings: {
          where: {
            status: ListingStatus.ACTIVE,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            images: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            },
            category: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...sanitizeUser(user),
      listings: user.listings,
    };
  }

  async findChatUsers(currentUserId: string, roles?: string[]) {
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          not: currentUserId,
        },
        ...(roles?.length ? { role: { in: roles } } : {}),
      },
      orderBy: {
        displayName: 'asc',
      },
      take: 100,
    });

    return users.map((user) => sanitizeUser(user));
  }

  async listForAdmin() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
      take: 200,
    });

    return users.map((user) => sanitizeUser(user));
  }

  async adminUpdateUser(
    userId: string,
    dto: AdminUpdateUserDto,
    actorId?: string | null,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.name,
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
        role: dto.role?.toUpperCase(),
        emailVerified: dto.isEmailVerified,
        phoneVerified: dto.isPhoneVerified,
        sellerPriorityTier: dto.sellerPriorityTier,
      },
    });

    if (
      dto.sellerPriorityTier !== undefined &&
      existingUser.sellerPriorityTier !== user.sellerPriorityTier
    ) {
      await this.notifications?.notifySellerAccountDecision({
        userId,
        actorId,
        previousTier: existingUser.sellerPriorityTier,
        nextTier: user.sellerPriorityTier,
      });
    }

    return sanitizeUser(user);
  }

  async updateCurrentUser(userId: string, updateUserDto: UpdateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const phoneChanged =
      typeof updateUserDto.phone === 'string' &&
      updateUserDto.phone !== existingUser.phone;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: updateUserDto.displayName,
        phone: updateUserDto.phone,
        avatarUrl: updateUserDto.avatarUrl,
        bio: updateUserDto.bio,
        location: updateUserDto.location,
        ...(phoneChanged ? { phoneVerified: false } : {}),
      },
    });

    return sanitizeUser(user);
  }
}
