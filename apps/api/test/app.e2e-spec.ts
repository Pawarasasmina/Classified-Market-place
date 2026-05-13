import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          name: string;
          status: string;
          database: {
            connected: boolean;
            userCount: unknown;
            categoryCount: unknown;
            listingCount: unknown;
          };
          modules: string[];
        };

        expect(body.name).toBe('Classified Marketplace API');
        expect(body.status).toBe('ok');
        expect(body.database.connected).toBe(true);
        expect(typeof body.database.userCount).toBe('number');
        expect(typeof body.database.categoryCount).toBe('number');
        expect(typeof body.database.listingCount).toBe('number');
        expect(body.modules).toEqual(
          expect.arrayContaining([
            'auth',
            'users',
            'categories',
            'listings',
            'chat',
            'moderation',
          ]),
        );
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
