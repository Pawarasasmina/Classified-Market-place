import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, SellerReviewStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { hasAnyAdminPermission } from '../common/admin-permissions';
import { PrismaService } from '../prisma/prisma.service';
import { ModerateSellerReviewDto } from './dto/moderate-seller-review.dto';
import { UpsertSellerRatingDto } from './dto/upsert-seller-rating.dto';

type ActingUser = {
  id: string;
  role: string;
};

const rateableStatuses: ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.SOLD,
];

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications?: NotificationsService,
  ) {}

  async getSellerSummary(sellerId: string) {
    const seller = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { id: true },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return this.buildSellerSummary(sellerId);
  }

  async listAdminSummaries() {
    const [summaries, reviewCounts] = await Promise.all([
      this.prisma.sellerRating.groupBy({
        by: ['sellerId'],
        _avg: { stars: true },
        _count: { _all: true },
      }),
      this.prisma.sellerRating.groupBy({
        by: ['sellerId'],
        where: {
          review: { not: null },
          reviewStatus: SellerReviewStatus.APPROVED,
        },
        _count: { _all: true },
      }),
    ]);
    const approvedReviewCounts = new Map(
      reviewCounts.map((summary) => [summary.sellerId, summary._count._all]),
    );

    return summaries.map((summary) => ({
      sellerId: summary.sellerId,
      averageRating: this.roundRating(summary._avg.stars),
      ratingCount: summary._count._all,
      reviewCount: approvedReviewCounts.get(summary.sellerId) ?? 0,
      reputationScore: this.toReputationScore(summary._avg.stars),
    }));
  }

  listAdminReviews(status?: SellerReviewStatus) {
    return this.prisma.sellerRating.findMany({
      where: {
        review: { not: null },
        ...(status ? { reviewStatus: status } : {}),
      },
      orderBy: [{ reviewStatus: 'asc' }, { updatedAt: 'desc' }],
      take: 100,
      include: {
        listing: {
          select: { id: true, title: true },
        },
        seller: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        rater: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
  }

  listSellerReviews(sellerId: string) {
    return this.prisma.sellerRating.findMany({
      where: {
        sellerId,
        review: { not: null },
        reviewStatus: SellerReviewStatus.APPROVED,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        listing: {
          select: { id: true, title: true },
        },
        rater: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
  }

  getMyListingRating(raterId: string, listingId: string) {
    return this.prisma.sellerRating.findUnique({
      where: {
        raterId_listingId: {
          raterId,
          listingId,
        },
      },
    });
  }

  async listReceived(sellerId: string) {
    return this.prisma.sellerRating.findMany({
      where: {
        sellerId,
        OR: [{ review: null }, { reviewStatus: SellerReviewStatus.APPROVED }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        listing: {
          select: { id: true, title: true },
        },
        rater: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
  }

  async upsertListingRating(
    actor: ActingUser,
    listingId: string,
    dto: UpsertSellerRatingDto,
  ) {
    if (hasAnyAdminPermission(actor.role)) {
      throw new ForbiddenException('Administrators cannot rate sellers');
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        sellerId: true,
        status: true,
      },
    });

    if (!listing || !rateableStatuses.includes(listing.status)) {
      throw new NotFoundException('Rateable listing not found');
    }

    if (listing.sellerId === actor.id) {
      throw new ForbiddenException('You cannot rate your own seller profile');
    }

    const existing = await this.prisma.sellerRating.findUnique({
      where: {
        raterId_listingId: {
          raterId: actor.id,
          listingId,
        },
      },
    });
    const review = dto.review?.trim() || null;
    const reviewChanged = existing?.review !== review;
    const reviewStatus = review
      ? reviewChanged
        ? SellerReviewStatus.PENDING
        : (existing?.reviewStatus ?? SellerReviewStatus.PENDING)
      : SellerReviewStatus.APPROVED;
    const reviewModerationFields = reviewChanged
      ? {
          reviewModerationNote: null,
          reviewModeratedAt: null,
          reviewModeratedById: null,
        }
      : {};

    const rating = await this.prisma.sellerRating.upsert({
      where: {
        raterId_listingId: {
          raterId: actor.id,
          listingId,
        },
      },
      update: {
        stars: dto.stars,
        review,
        reviewStatus,
        ...reviewModerationFields,
      },
      create: {
        listingId,
        sellerId: listing.sellerId,
        raterId: actor.id,
        stars: dto.stars,
        review,
        reviewStatus,
      },
    });
    const summary = await this.syncSellerSummary(listing.sellerId);

    if (!existing || existing.stars !== dto.stars || reviewChanged) {
      try {
        await this.notifications?.notifySellerRated({
          userId: listing.sellerId,
          actorId: actor.id,
          ratingId: rating.id,
          listingId,
          listingTitle: listing.title,
          stars: dto.stars,
          review,
          reviewStatus,
          updated: Boolean(existing),
          averageRating: summary.averageRating,
          ratingCount: summary.ratingCount,
        });
      } catch (error) {
        this.logger.warn(
          `Could not persist seller review notification for ${rating.id}`,
        );
      }
    }

    return { rating, summary };
  }

  async removeListingRating(raterId: string, listingId: string) {
    const rating = await this.prisma.sellerRating.findUnique({
      where: {
        raterId_listingId: {
          raterId,
          listingId,
        },
      },
    });

    if (!rating) {
      throw new NotFoundException('Rating not found');
    }

    await this.prisma.sellerRating.delete({ where: { id: rating.id } });

    return {
      deleted: true,
      summary: await this.syncSellerSummary(rating.sellerId),
    };
  }

  async moderateReview(
    actor: { id: string },
    ratingId: string,
    dto: ModerateSellerReviewDto,
  ) {
    const rating = await this.prisma.sellerRating.findUnique({
      where: { id: ratingId },
      select: { id: true, review: true },
    });

    if (!rating?.review) {
      throw new NotFoundException('Written seller review not found');
    }

    return this.prisma.sellerRating.update({
      where: { id: ratingId },
      data: {
        reviewStatus: dto.status,
        reviewModerationNote: dto.note?.trim() || null,
        reviewModeratedAt: new Date(),
        reviewModeratedById: actor.id,
      },
      include: {
        listing: {
          select: { id: true, title: true },
        },
        seller: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        rater: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
  }

  async deleteReview(actor: { id: string }, ratingId: string) {
    const rating = await this.prisma.sellerRating.findUnique({
      where: { id: ratingId },
      select: { id: true, review: true },
    });

    if (!rating?.review) {
      throw new NotFoundException('Written seller review not found');
    }

    return this.prisma.sellerRating.update({
      where: { id: ratingId },
      data: {
        review: null,
        reviewStatus: SellerReviewStatus.APPROVED,
        reviewModerationNote: null,
        reviewModeratedAt: new Date(),
        reviewModeratedById: actor.id,
      },
      include: {
        listing: {
          select: { id: true, title: true },
        },
        seller: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        rater: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
  }

  private async buildSellerSummary(sellerId: string) {
    const [aggregate, reviewCount] = await Promise.all([
      this.prisma.sellerRating.aggregate({
        where: { sellerId },
        _avg: { stars: true },
        _count: { _all: true },
      }),
      this.prisma.sellerRating.count({
        where: {
          sellerId,
          review: { not: null },
          reviewStatus: SellerReviewStatus.APPROVED,
        },
      }),
    ]);

    return {
      sellerId,
      averageRating: this.roundRating(aggregate._avg.stars),
      ratingCount: aggregate._count._all,
      reviewCount,
      reputationScore: this.toReputationScore(aggregate._avg.stars),
    };
  }

  private async syncSellerSummary(sellerId: string) {
    const summary = await this.buildSellerSummary(sellerId);

    await this.prisma.user.update({
      where: { id: sellerId },
      data: { reputationScore: summary.reputationScore },
    });

    return summary;
  }

  private roundRating(average: number | null) {
    return average == null ? null : Number(average.toFixed(1));
  }

  private toReputationScore(average: number | null) {
    return average == null ? 0 : Math.round(average * 20);
  }
}
