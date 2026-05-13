import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

type ApiOverview = {
  name: string;
  status: string;
  database: {
    connected: boolean;
    userCount: number;
    categoryCount: number;
    listingCount: number;
  };
  modules: string[];
};

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<ApiOverview> {
    const [userCount, categoryCount, listingCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.category.count(),
      this.prisma.listing.count(),
    ]);

    return {
      name: 'Classified Marketplace API',
      status: 'ok',
      database: {
        connected: true,
        userCount,
        categoryCount,
        listingCount,
      },
      modules: [
        'auth',
        'users',
        'categories',
        'listings',
        'chat',
        'moderation',
      ],
    };
  }
}
