import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ListingStatus, MessageType, SellerPriorityTier } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type BcryptModule = {
  hash(data: string, saltOrRounds: string | number): Promise<string>;
  compare(data: string, encrypted: string): Promise<boolean>;
};

const bcryptLib = bcrypt as BcryptModule;

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

const safeUserSelect = {
  id: true,
  email: true,
  googleId: true,
  phone: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  location: true,
  emailVerified: true,
  phoneVerified: true,
  role: true,
  sellerPriorityTier: true,
  reputationScore: true,
  createdAt: true,
  updatedAt: true,
};

const listingInclude = {
  category: true,
  seller: {
    select: safeUserSelect,
  },
  images: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
  },
};

function normalizeAdminRole(role: string | undefined) {
  if (!role) {
    return undefined;
  }

  return role.toUpperCase();
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications?: NotificationsService,
  ) {}

  private async getAdminUserStats(userId: string) {
    const [
      totalListings,
      activeListings,
      pendingListings,
      pausedListings,
      rejectedListings,
      deletedListings,
      bookingCount,
      offerCount,
    ] = await Promise.all([
      this.prisma.listing.count({ where: { sellerId: userId } }),
      this.prisma.listing.count({
        where: { sellerId: userId, status: ListingStatus.ACTIVE },
      }),
      this.prisma.listing.count({
        where: { sellerId: userId, status: ListingStatus.PENDING },
      }),
      this.prisma.listing.count({
        where: { sellerId: userId, status: ListingStatus.PAUSED },
      }),
      this.prisma.listing.count({
        where: { sellerId: userId, status: ListingStatus.REJECTED },
      }),
      this.prisma.listing.count({
        where: { sellerId: userId, status: ListingStatus.DELETED },
      }),
      this.prisma.conversationParticipant.count({ where: { userId } }),
      this.prisma.message.count({
        where: {
          OR: [
            { senderId: userId, type: MessageType.OFFER },
            { senderId: userId, offerAmount: { not: null } },
            {
              conversation: {
                participants: {
                  some: { userId },
                },
              },
              type: MessageType.OFFER,
            },
            {
              conversation: {
                participants: {
                  some: { userId },
                },
              },
              offerAmount: { not: null },
            },
          ],
        },
      }),
    ]);

    return {
      totalListings,
      activeListings,
      pendingListings,
      pausedListings,
      rejectedListings,
      deletedListings,
      bookingCount,
      offerCount,
    };
  }

  private async attachAdminUserStats<T extends { id: string }>(user: T) {
    return {
      ...user,
      adminStats: await this.getAdminUserStats(user.id),
    };
  }

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

  async findAllForAdmin() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return Promise.all(
      users.map((user) => this.attachAdminUserStats(sanitizeUser(user))),
    );
  }

  async listForAdmin() {
    return this.findAllForAdmin();
  }

  async findOneForAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.attachAdminUserStats(sanitizeUser(user));
  }

  async updateForAdmin(userId: string, updateUserDto: AdminUpdateUserDto) {
    return this.adminUpdateUser(userId, updateUserDto);
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
        displayName: dto.displayName ?? dto.name,
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
        bio: dto.bio,
        location: dto.location,
        role: normalizeAdminRole(dto.role),
        emailVerified: dto.emailVerified ?? dto.isEmailVerified,
        phoneVerified: dto.phoneVerified ?? dto.isPhoneVerified,
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

    return this.attachAdminUserStats(sanitizeUser(user));
  }

  async findListingsForAdmin(userId: string) {
    await this.findOneForAdmin(userId);

    return this.prisma.listing.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      include: listingInclude,
    });
  }

  async findBookingsForAdmin(userId: string) {
    await this.findOneForAdmin(userId);

    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        listing: {
          include: listingInclude,
        },
        participants: {
          include: {
            user: {
              select: safeUserSelect,
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        messages: {
          where: {
            OR: [{ type: MessageType.OFFER }, { offerAmount: { not: null } }],
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            sender: {
              select: safeUserSelect,
            },
          },
        },
      },
    });
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

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (existingUser.passwordHash) {
      if (!changePasswordDto.currentPassword) {
        throw new BadRequestException('Current password is required');
      }

      const currentPasswordMatches = await bcryptLib.compare(
        changePasswordDto.currentPassword,
        existingUser.passwordHash,
      );

      if (!currentPasswordMatches) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      const isSamePassword = await bcryptLib.compare(
        changePasswordDto.newPassword,
        existingUser.passwordHash,
      );

      if (isSamePassword) {
        throw new BadRequestException(
          'New password must be different from your current password',
        );
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcryptLib.hash(changePasswordDto.newPassword, 10),
      },
    });

    return { message: 'Password updated successfully' };
  }

  async deactivateCurrentUser(userId: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deactivatedAt: new Date(),
          email: `deactivated:${userId}:${existingUser.email}`,
          googleId: existingUser.googleId
            ? `deactivated:${userId}:${existingUser.googleId}`
            : null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.authAuditLog.create({
        data: {
          userId,
          email: existingUser.email,
          event: 'account_deactivated',
        },
      }),
    ]);

    return { message: 'Account deactivated successfully' };
  }
}
