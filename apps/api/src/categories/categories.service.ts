import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { defaultCategories } from './categories.seed';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const categoryInclude = {
  parent: true,
  children: {
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
  },
  _count: {
    select: {
      listings: true,
    },
  },
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toJsonValue(value: Record<string, unknown> | undefined) {
  return value as Prisma.InputJsonValue | undefined;
}

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  async seedDefaults() {
    for (const category of defaultCategories.filter((item) => !item.parentSlug)) {
      await this.prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          schemaDefinition: toJsonValue(category.schemaDefinition),
          sortOrder: category.sortOrder ?? 0,
          isActive: true,
        },
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          schemaDefinition: toJsonValue(category.schemaDefinition),
          sortOrder: category.sortOrder ?? 0,
          isActive: true,
        },
      });
    }

    for (const category of defaultCategories.filter((item) => item.parentSlug)) {
      const parent = await this.prisma.category.findUnique({
        where: { slug: category.parentSlug },
      });

      if (!parent) {
        continue;
      }

      await this.prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          schemaDefinition: toJsonValue(category.schemaDefinition),
          parentId: parent.id,
          sortOrder: category.sortOrder ?? 0,
          isActive: true,
        },
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          schemaDefinition: toJsonValue(category.schemaDefinition),
          parentId: parent.id,
          sortOrder: category.sortOrder ?? 0,
          isActive: true,
        },
      });
    }
  }

  async findAll(includeInactive = false) {
    return this.prisma.category.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: categoryInclude,
    });
  }

  async findOneBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: categoryInclude,
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    const slug = slugify(dto.slug ?? dto.name);

    if (!slug) {
      throw new BadRequestException('Category slug is required');
    }

    const parentId = await this.resolveParentId(dto.parentSlug);

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description,
        schemaDefinition: toJsonValue(dto.schemaDefinition),
        parentId,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: categoryInclude,
    });
  }

  async update(slug: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { slug } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const nextSlug = dto.slug ? slugify(dto.slug) : undefined;
    const parentId =
      dto.parentSlug === undefined
        ? undefined
        : await this.resolveParentId(dto.parentSlug);

    if (parentId === category.id) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    return this.prisma.category.update({
      where: { id: category.id },
      data: {
        name: dto.name?.trim(),
        slug: nextSlug,
        description: dto.description,
        schemaDefinition: toJsonValue(dto.schemaDefinition),
        parentId,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
      include: categoryInclude,
    });
  }

  async remove(slug: string) {
    const category = await this.prisma.category.findUnique({ where: { slug } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.category.update({
      where: { id: category.id },
      data: { isActive: false },
      include: categoryInclude,
    });
  }

  private async resolveParentId(parentSlug?: string) {
    if (!parentSlug) {
      return null;
    }

    const parent = await this.prisma.category.findUnique({
      where: { slug: parentSlug },
    });

    if (!parent) {
      throw new NotFoundException('Parent category not found');
    }

    return parent.id;
  }
}
