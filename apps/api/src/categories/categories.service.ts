import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { defaultCategories } from './categories.seed';

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  async seedDefaults() {
    const categoryCount = await this.prisma.category.count();

    if (categoryCount > 0) {
      return;
    }

    await this.prisma.$transaction(
      defaultCategories.map((category) =>
        this.prisma.category.create({
          data: category,
        }),
      ),
    );
  }

  async findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOneBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            listings: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }
}
