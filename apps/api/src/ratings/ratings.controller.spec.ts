import { RatingsController } from './ratings.controller';

describe('RatingsController', () => {
  let service: {
    getMyListingRating: jest.Mock;
    deleteReview: jest.Mock;
    getSellerSummary: jest.Mock;
    listAdminReviews: jest.Mock;
    listSellerReviews: jest.Mock;
    listAdminSummaries: jest.Mock;
    listReceived: jest.Mock;
    moderateReview: jest.Mock;
    removeListingRating: jest.Mock;
    upsertListingRating: jest.Mock;
  };
  let controller: RatingsController;

  beforeEach(() => {
    service = {
      getMyListingRating: jest.fn(),
      deleteReview: jest.fn(),
      getSellerSummary: jest.fn(),
      listAdminReviews: jest.fn(),
      listSellerReviews: jest.fn(),
      listAdminSummaries: jest.fn(),
      listReceived: jest.fn(),
      moderateReview: jest.fn(),
      removeListingRating: jest.fn(),
      upsertListingRating: jest.fn(),
    };
    controller = new RatingsController(service as never);
  });

  it('submits a listing seller rating as the current customer', () => {
    const user = { id: 'buyer-1', role: 'USER' };
    const dto = { stars: 5 };

    controller.upsertListingRating(user, 'listing-1', dto);

    expect(service.upsertListingRating).toHaveBeenCalledWith(
      user,
      'listing-1',
      dto,
    );
  });

  it('lists public written seller reviews', () => {
    controller.listSellerReviews('seller-1');

    expect(service.listSellerReviews).toHaveBeenCalledWith('seller-1');
  });

  it('lists admin seller review moderation queue', () => {
    controller.listAdminReviews('PENDING');

    expect(service.listAdminReviews).toHaveBeenCalledWith('PENDING');
  });

  it('moderates a written seller review as admin', () => {
    const user = { id: 'admin-1' };
    const dto = { status: 'APPROVED' } as never;

    controller.moderateReview(user, 'rating-1', dto);

    expect(service.moderateReview).toHaveBeenCalledWith(user, 'rating-1', dto);
  });

  it('deletes a written seller review as admin', () => {
    const user = { id: 'admin-1' };

    controller.deleteReview(user, 'rating-1');

    expect(service.deleteReview).toHaveBeenCalledWith(user, 'rating-1');
  });

  it('removes only the current customers listing rating', () => {
    controller.removeListingRating({ id: 'buyer-1' }, 'listing-1');

    expect(service.removeListingRating).toHaveBeenCalledWith(
      'buyer-1',
      'listing-1',
    );
  });
});
