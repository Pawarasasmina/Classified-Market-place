import { SellerPriorityTier } from '@prisma/client';
import { UsersService } from './users.service';

const baseUser = {
  id: 'seller-1',
  email: 'seller@example.com',
  displayName: 'Seller One',
  passwordHash: 'secret',
  googleId: null,
  avatarUrl: null,
  bio: null,
  location: null,
  role: 'USER',
  sellerPriorityTier: SellerPriorityTier.NONE,
  phone: null,
  phoneVerified: false,
  emailVerified: false,
  reputationScore: 0,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
};

describe('UsersService', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let notifications: {
    notifySellerAccountDecision: jest.Mock;
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(baseUser),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...baseUser,
          ...data,
        })),
      },
    };
    notifications = {
      notifySellerAccountDecision: jest.fn().mockResolvedValue({
        id: 'notification-1',
      }),
    };
    service = new UsersService(prisma as never, notifications as never);
  });

  it('notifies a seller when an admin approves their account tier', async () => {
    await service.adminUpdateUser(
      'seller-1',
      { sellerPriorityTier: SellerPriorityTier.AUTHORIZED },
      'admin-1',
    );

    expect(notifications.notifySellerAccountDecision).toHaveBeenCalledWith({
      userId: 'seller-1',
      actorId: 'admin-1',
      previousTier: SellerPriorityTier.NONE,
      nextTier: SellerPriorityTier.AUTHORIZED,
    });
  });

  it('does not notify when an admin saves unrelated user fields', async () => {
    await service.adminUpdateUser('seller-1', { name: 'Seller Renamed' });

    expect(notifications.notifySellerAccountDecision).not.toHaveBeenCalled();
  });
});
