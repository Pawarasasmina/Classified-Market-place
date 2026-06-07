import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListingStatus, SellerReviewStatus } from '@prisma/client';
import { RatingsService } from './ratings.service';

describe('RatingsService', () => {
  let prisma: {
    listing: { findUnique: jest.Mock };
    sellerRating: {
      aggregate: jest.Mock;
      count: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      groupBy: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let notifications: { notifySellerRated: jest.Mock };
  let service: RatingsService;

  beforeEach(() => {
    prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'listing-1',
          title: 'Clean phone',
          sellerId: 'seller-1',
          status: ListingStatus.ACTIVE,
        }),
      },
      sellerRating: {
        aggregate: jest.fn().mockResolvedValue({
          _avg: { stars: 4.5 },
          _count: { _all: 2 },
        }),
        count: jest.fn().mockResolvedValue(1),
        delete: jest.fn().mockResolvedValue({ id: 'rating-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        groupBy: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'rating-1' }),
        upsert: jest.fn().mockResolvedValue({
          id: 'rating-1',
          sellerId: 'seller-1',
          raterId: 'buyer-1',
          listingId: 'listing-1',
          stars: 5,
          review: null,
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'seller-1' }),
        update: jest.fn().mockResolvedValue({ id: 'seller-1' }),
      },
    };
    notifications = {
      notifySellerRated: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    };
    service = new RatingsService(prisma as never, notifications as never);
  });

  it('creates a customer rating, updates reputation, and notifies the seller', async () => {
    await expect(
      service.upsertListingRating(
        { id: 'buyer-1', role: 'USER' },
        'listing-1',
        { stars: 5 },
      ),
    ).resolves.toMatchObject({
      rating: { stars: 5 },
      summary: {
        averageRating: 4.5,
        ratingCount: 2,
        reviewCount: 1,
        reputationScore: 90,
      },
    });

    expect(prisma.sellerRating.upsert).toHaveBeenCalledWith({
      where: {
        raterId_listingId: {
          raterId: 'buyer-1',
          listingId: 'listing-1',
        },
      },
      update: {
        stars: 5,
        review: null,
        reviewStatus: SellerReviewStatus.APPROVED,
        reviewModerationNote: null,
        reviewModeratedAt: null,
        reviewModeratedById: null,
      },
      create: {
        listingId: 'listing-1',
        sellerId: 'seller-1',
        raterId: 'buyer-1',
        stars: 5,
        review: null,
        reviewStatus: SellerReviewStatus.APPROVED,
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      data: { reputationScore: 90 },
    });
    expect(notifications.notifySellerRated).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        actorId: 'buyer-1',
        ratingId: 'rating-1',
        listingId: 'listing-1',
        stars: 5,
        review: null,
        reviewStatus: SellerReviewStatus.APPROVED,
        updated: false,
      }),
    );
  });

  it('does not notify again when a customer resubmits the same stars', async () => {
    prisma.sellerRating.findUnique.mockResolvedValue({
      id: 'rating-1',
      sellerId: 'seller-1',
      raterId: 'buyer-1',
      listingId: 'listing-1',
      stars: 5,
      review: null,
    });

    await service.upsertListingRating(
      { id: 'buyer-1', role: 'USER' },
      'listing-1',
      { stars: 5 },
    );

    expect(notifications.notifySellerRated).not.toHaveBeenCalled();
  });

  it('saves and notifies when a customer writes or edits a review', async () => {
    prisma.sellerRating.findUnique.mockResolvedValue({
      id: 'rating-1',
      sellerId: 'seller-1',
      raterId: 'buyer-1',
      listingId: 'listing-1',
      stars: 5,
      review: null,
    });

    await service.upsertListingRating(
      { id: 'buyer-1', role: 'USER' },
      'listing-1',
      { stars: 5, review: '  Smooth transaction and helpful seller.  ' },
    );

    expect(prisma.sellerRating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          stars: 5,
          review: 'Smooth transaction and helpful seller.',
          reviewStatus: SellerReviewStatus.PENDING,
          reviewModerationNote: null,
          reviewModeratedAt: null,
          reviewModeratedById: null,
        },
      }),
    );
    expect(notifications.notifySellerRated).toHaveBeenCalledWith(
      expect.objectContaining({
        ratingId: 'rating-1',
        review: 'Smooth transaction and helpful seller.',
        reviewStatus: SellerReviewStatus.PENDING,
        updated: true,
      }),
    );
  });

  it('does not fail review submission when seller notification persistence fails', async () => {
    notifications.notifySellerRated.mockRejectedValueOnce(
      new Error('notification write failed'),
    );

    await expect(
      service.upsertListingRating(
        { id: 'buyer-1', role: 'USER' },
        'listing-1',
        { stars: 5, review: 'Great seller.' },
      ),
    ).resolves.toMatchObject({
      rating: { id: 'rating-1' },
      summary: {
        averageRating: 4.5,
      },
    });
  });

  it('rejects self ratings and administrator ratings', async () => {
    await expect(
      service.upsertListingRating(
        { id: 'seller-1', role: 'USER' },
        'listing-1',
        { stars: 5 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.upsertListingRating(
        { id: 'admin-1', role: 'ADMIN' },
        'listing-1',
        { stars: 5 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.sellerRating.upsert).not.toHaveBeenCalled();
  });

  it('rejects ratings for listings that are not customer-visible', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      title: 'Pending phone',
      sellerId: 'seller-1',
      status: ListingStatus.PENDING,
    });

    await expect(
      service.upsertListingRating(
        { id: 'buyer-1', role: 'USER' },
        'listing-1',
        { stars: 4 },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an owned rating and recalculates seller reputation', async () => {
    prisma.sellerRating.findUnique.mockResolvedValue({
      id: 'rating-1',
      sellerId: 'seller-1',
      raterId: 'buyer-1',
      listingId: 'listing-1',
      stars: 3,
      review: 'Good seller.',
    });
    prisma.sellerRating.aggregate.mockResolvedValue({
      _avg: { stars: null },
      _count: { _all: 0 },
    });
    prisma.sellerRating.count.mockResolvedValue(0);

    await expect(
      service.removeListingRating('buyer-1', 'listing-1'),
    ).resolves.toEqual({
      deleted: true,
      summary: {
        sellerId: 'seller-1',
        averageRating: null,
        ratingCount: 0,
        reviewCount: 0,
        reputationScore: 0,
      },
    });

    expect(prisma.sellerRating.delete).toHaveBeenCalledWith({
      where: { id: 'rating-1' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      data: { reputationScore: 0 },
    });
  });

  it('lists only approved public seller reviews', async () => {
    await service.listSellerReviews('seller-1');

    expect(prisma.sellerRating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sellerId: 'seller-1',
          review: { not: null },
          reviewStatus: SellerReviewStatus.APPROVED,
        },
      }),
    );
  });

  it('lets admins moderate written seller reviews', async () => {
    prisma.sellerRating.findUnique.mockResolvedValue({
      id: 'rating-1',
      review: 'Helpful seller.',
    });

    await service.moderateReview({ id: 'admin-1' }, 'rating-1', {
      status: SellerReviewStatus.APPROVED,
      note: 'Looks good.',
    });

    expect(prisma.sellerRating.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rating-1' },
        data: expect.objectContaining({
          reviewStatus: SellerReviewStatus.APPROVED,
          reviewModerationNote: 'Looks good.',
          reviewModeratedById: 'admin-1',
        }),
      }),
    );
  });

  it('lets admins delete only the written review while keeping the rating', async () => {
    prisma.sellerRating.findUnique.mockResolvedValue({
      id: 'rating-1',
      review: 'Helpful seller.',
    });

    await service.deleteReview({ id: 'admin-1' }, 'rating-1');

    expect(prisma.sellerRating.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rating-1' },
        data: expect.objectContaining({
          review: null,
          reviewStatus: SellerReviewStatus.APPROVED,
          reviewModerationNote: null,
          reviewModeratedById: 'admin-1',
        }),
      }),
    );
  });
});
