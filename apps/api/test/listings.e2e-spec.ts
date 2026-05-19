import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ListingStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { ListingsController } from '../src/listings/listings.controller';
import { ListingsService } from '../src/listings/listings.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Listings normal-user posting (e2e)', () => {
  let app: INestApplication<App>;
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
  };

  const regularUser = {
    id: 'user-1',
    email: 'poster@example.com',
    displayName: 'Normal Poster',
    role: 'USER',
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'category-1',
          slug: 'electronics',
          name: 'Electronics',
        }),
      },
      listing: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'listing-1',
          ...data,
          category: { id: data.categoryId, slug: 'electronics' },
          seller: regularUser,
          images: [],
          attributes: data.attributes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [
        ListingsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const requestContext = context.switchToHttp().getRequest();
          requestContext.user = regularUser;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a normal logged-in user listing and keeps it pending for moderation', async () => {
    const response = await request(app.getHttpServer())
      .post('/listings')
      .send({
        categorySlug: 'electronics',
        title: 'Clean iPhone 14',
        description: 'Barely used phone with original box and cable.',
        price: 1800,
        currency: 'AED',
        location: 'Dubai Marina',
        status: ListingStatus.ACTIVE,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: 'listing-1',
      sellerId: regularUser.id,
      status: ListingStatus.PENDING,
    });
    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: regularUser.id,
          status: ListingStatus.PENDING,
        }),
      }),
    );
  });

  it('returns validation errors before posting incomplete normal-user listings', async () => {
    const response = await request(app.getHttpServer())
      .post('/listings')
      .send({
        categorySlug: 'electronics',
        title: '',
        description: 'too short',
        price: -1,
        location: '',
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'title should not be empty',
        'price must not be less than 0',
        'location should not be empty',
      ]),
    );
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });
});
