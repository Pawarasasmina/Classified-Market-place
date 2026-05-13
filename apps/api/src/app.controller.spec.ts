import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const overview = {
    name: 'Classified Marketplace API',
    status: 'ok',
    database: {
      connected: true,
      userCount: 0,
      categoryCount: 0,
      listingCount: 0,
    },
    modules: ['auth', 'users', 'categories', 'listings', 'chat', 'moderation'],
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getOverview: jest.fn().mockResolvedValue(overview),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API overview', async () => {
      await expect(appController.getOverview()).resolves.toEqual(overview);
    });
  });
});
