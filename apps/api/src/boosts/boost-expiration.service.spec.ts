import { BoostStatus } from '@prisma/client';
import { BoostExpirationService } from './boost-expiration.service';

describe('BoostExpirationService', () => {
  let prisma: {
    boost: {
      updateMany: jest.Mock;
    };
  };
  let service: BoostExpirationService;

  beforeEach(() => {
    prisma = {
      boost: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    service = new BoostExpirationService(prisma as never);
  });

  it('marks ended scheduled and active boosts as expired', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');

    await expect(service.expireEndedBoosts(now)).resolves.toEqual({ count: 2 });

    expect(prisma.boost.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: [BoostStatus.SCHEDULED, BoostStatus.ACTIVE] },
        endsAt: { lte: now },
      },
      data: {
        status: BoostStatus.EXPIRED,
      },
    });
  });
});
