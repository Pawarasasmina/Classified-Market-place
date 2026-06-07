import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: {
            user: { count: jest.fn().mockResolvedValue(0) },
            category: { count: jest.fn().mockResolvedValue(0) },
            listing: { count: jest.fn().mockResolvedValue(0) },
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          name: 'Classified Marketplace API',
          status: 'ok',
          database: {
            connected: true,
            userCount: 0,
            categoryCount: 0,
            listingCount: 0,
          },
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
