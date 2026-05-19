import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListingStatus } from '@prisma/client';
import { ListingsService } from './listings.service';

describe('ListingsService normal-user posting', () => {
  let service: ListingsService;
  let prisma: {
    category: {
      findUnique: jest.Mock;
    };
    listing: {
      count: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  const category = {
    id: 'category-1',
    slug: 'electronics',
    name: 'Electronics',
  };

  const listing = {
    id: 'listing-1',
    sellerId: 'user-1',
    categoryId: 'category-1',
    status: ListingStatus.PENDING,
    attributes: null,
  };

  beforeEach(() => {
    prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue(category),
      },
      listing: {
        count: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'listing-1',
          ...data,
        })),
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(listing),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...listing,
          ...data,
        })),
      },
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    service = new ListingsService(prisma as never);
  });

  it('lets regular users create listings without a seller role and forces moderation', async () => {
    await service.create(
      { id: 'user-1', role: 'USER' },
      {
        categorySlug: 'electronics',
        title: 'Clean phone',
        description: 'Barely used phone with box',
        price: 350,
        location: 'Dubai Marina',
        status: ListingStatus.ACTIVE,
      },
    );

    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: 'user-1',
          status: ListingStatus.PENDING,
        }),
      }),
    );
  });

  it('allows admins to create immediately active listings when needed', async () => {
    await service.create(
      { id: 'admin-1', role: 'ADMIN' },
      {
        categorySlug: 'electronics',
        title: 'Admin seeded item',
        description: 'Approved inventory listing',
        price: 100,
        location: 'Dubai',
      },
    );

    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: 'admin-1',
          status: ListingStatus.ACTIVE,
        }),
      }),
    );
  });

  it('includes child categories when searching by a parent category', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await service.findAll({ categorySlug: 'motors' });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: {
            OR: [{ slug: 'motors' }, { parent: { slug: 'motors' } }],
          },
          status: ListingStatus.ACTIVE,
        }),
      }),
    );
  });

  it('does not expose pending listings through public lookup', async () => {
    await expect(service.findOne('listing-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets the owner retrieve their pending listing for editing', async () => {
    await expect(
      service.findOneForUser({ id: 'user-1', role: 'USER' }, 'listing-1'),
    ).resolves.toMatchObject({
      id: 'listing-1',
      status: ListingStatus.PENDING,
    });
  });

  it('blocks other regular users from viewing a private listing edit record', async () => {
    await expect(
      service.findOneForUser({ id: 'user-2', role: 'USER' }, 'listing-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns regular-user edits to moderation and ignores submitted status', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...listing,
      status: ListingStatus.ACTIVE,
    });

    await service.update({ id: 'user-1', role: 'USER' }, 'listing-1', {
      title: 'Updated title',
      status: ListingStatus.ACTIVE,
    });

    expect(prisma.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Updated title',
          status: ListingStatus.PENDING,
        }),
      }),
    );
  });
});
