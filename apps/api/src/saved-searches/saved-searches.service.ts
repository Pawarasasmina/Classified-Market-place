import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';
import { UpdateSavedSearchDto } from './dto/update-saved-search.dto';

const allowedSortValues = ['newest', 'price_asc', 'price_desc'] as const;

type NormalizedSavedSearchInput = {
  label?: string;
  query: string;
  categorySlug: string;
  sort: 'newest' | 'price_asc' | 'price_desc';
  alertsEnabled: boolean;
};

type SavedSearchRecord = {
  id: string;
  label: string;
  query: string;
  categorySlug: string;
  sort: 'newest' | 'price_asc' | 'price_desc';
  alertsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
};

function normalizeTextValue(value: string | undefined) {
  return value?.trim() ?? '';
}

function formatSortLabel(sort: 'newest' | 'price_asc' | 'price_desc') {
  switch (sort) {
    case 'price_asc':
      return 'Price low to high';
    case 'price_desc':
      return 'Price high to low';
    default:
      return 'Newest';
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : '';
}

function isSavedSearchStorageMissing(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes('SavedSearch') &&
    (message.includes('does not exist') ||
      message.includes('relation') ||
      message.includes('column') ||
      message.includes('table'))
  );
}

@Injectable()
export class SavedSearchesService {
  constructor(private readonly prisma: PrismaService) {}

  private handleStorageError(error: unknown): never {
    if (isSavedSearchStorageMissing(error)) {
      throw new ServiceUnavailableException(
        'Saved searches are not ready yet. Apply the latest database schema and try again.',
      );
    }

    throw error;
  }

  private normalizeSort(value: string | undefined) {
    if (
      value &&
      allowedSortValues.includes(value as (typeof allowedSortValues)[number])
    ) {
      return value as 'newest' | 'price_asc' | 'price_desc';
    }

    return 'newest' as const;
  }

  private async ensureCategoryName(categorySlug: string) {
    if (!categorySlug) {
      return null;
    }

    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
      select: { slug: true, name: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private buildDefaultLabel(input: {
    query: string;
    categoryName: string | null;
    sort: 'newest' | 'price_asc' | 'price_desc';
  }) {
    const baseLabel = [input.query || null, input.categoryName || null]
      .filter((value): value is string => Boolean(value))
      .join(' in ');

    if (!baseLabel) {
      return input.sort === 'newest'
        ? 'Marketplace search'
        : `Marketplace search - ${formatSortLabel(input.sort)}`;
    }

    return input.sort === 'newest'
      ? baseLabel
      : `${baseLabel} - ${formatSortLabel(input.sort)}`;
  }

  private async normalizeInput(
    dto: CreateSavedSearchDto | UpdateSavedSearchDto,
    fallback: {
      query?: string;
      categorySlug?: string;
      sort?: 'newest' | 'price_asc' | 'price_desc';
      alertsEnabled?: boolean;
      label?: string;
    } = {},
  ): Promise<NormalizedSavedSearchInput> {
    const query = normalizeTextValue(dto.query ?? fallback.query);
    const categorySlug = normalizeTextValue(
      dto.categorySlug ?? fallback.categorySlug,
    );
    const sort = this.normalizeSort(dto.sort ?? fallback.sort);
    const alertsEnabled = dto.alertsEnabled ?? fallback.alertsEnabled ?? true;

    if (!query && !categorySlug && sort === 'newest') {
      throw new BadRequestException(
        'Add a keyword, category, or custom sort before saving this search.',
      );
    }

    const category = await this.ensureCategoryName(categorySlug);
    const label = normalizeTextValue(dto.label ?? fallback.label);

    return {
      query,
      categorySlug,
      sort,
      alertsEnabled,
      label:
        label ||
        this.buildDefaultLabel({
          query,
          categoryName: category?.name ?? null,
          sort,
        }),
    };
  }

  private async serializeSavedSearch<T extends { categorySlug: string }>(
    savedSearch: T,
  ) {
    const category = savedSearch.categorySlug
      ? await this.prisma.category.findUnique({
          where: { slug: savedSearch.categorySlug },
          select: { slug: true, name: true },
        })
      : null;

    return {
      ...savedSearch,
      category,
    };
  }

  private async findRecordById(userId: string, savedSearchId: string) {
    const records = await this.prisma.$queryRaw<SavedSearchRecord[]>`
      SELECT "id", "label", "query", "categorySlug", "sort", "alertsEnabled", "createdAt", "updatedAt", "userId"
      FROM "SavedSearch"
      WHERE "id" = ${savedSearchId} AND "userId" = ${userId}
      LIMIT 1
    `;

    return records[0] ?? null;
  }

  private async findRecordByUnique(
    userId: string,
    input: {
      query: string;
      categorySlug: string;
      sort: 'newest' | 'price_asc' | 'price_desc';
    },
  ) {
    const records = await this.prisma.$queryRaw<SavedSearchRecord[]>`
      SELECT "id", "label", "query", "categorySlug", "sort", "alertsEnabled", "createdAt", "updatedAt", "userId"
      FROM "SavedSearch"
      WHERE "userId" = ${userId}
        AND "query" = ${input.query}
        AND "categorySlug" = ${input.categorySlug}
        AND "sort" = ${input.sort}
      LIMIT 1
    `;

    return records[0] ?? null;
  }

  async findAll(userId: string) {
    let savedSearches: SavedSearchRecord[];

    try {
      savedSearches = await this.prisma.$queryRaw<SavedSearchRecord[]>`
        SELECT "id", "label", "query", "categorySlug", "sort", "alertsEnabled", "createdAt", "updatedAt", "userId"
        FROM "SavedSearch"
        WHERE "userId" = ${userId}
        ORDER BY "updatedAt" DESC, "createdAt" DESC
      `;
    } catch (error) {
      if (isSavedSearchStorageMissing(error)) {
        return [];
      }

      throw error;
    }

    const uniqueSlugs = [
      ...new Set(
        savedSearches.map((item) => item.categorySlug).filter(Boolean),
      ),
    ];
    const categories = uniqueSlugs.length
      ? await this.prisma.category.findMany({
          where: { slug: { in: uniqueSlugs } },
          select: { slug: true, name: true },
        })
      : [];
    const categoriesBySlug = new Map(
      categories.map((category) => [category.slug, category]),
    );

    return savedSearches.map((savedSearch) => ({
      ...savedSearch,
      category: savedSearch.categorySlug
        ? (categoriesBySlug.get(savedSearch.categorySlug) ?? null)
        : null,
    }));
  }

  async create(userId: string, dto: CreateSavedSearchDto) {
    const normalized = await this.normalizeInput(dto);
    let existing: SavedSearchRecord | null;
    let savedSearch: SavedSearchRecord;

    try {
      existing = await this.findRecordByUnique(userId, normalized);

      if (existing) {
        const updatedRecords = await this.prisma.$queryRaw<SavedSearchRecord[]>`
          UPDATE "SavedSearch"
          SET
            "alertsEnabled" = ${normalized.alertsEnabled},
            "label" = ${dto.label ? normalized.label : existing.label},
            "updatedAt" = NOW()
          WHERE "id" = ${existing.id}
          RETURNING "id", "label", "query", "categorySlug", "sort", "alertsEnabled", "createdAt", "updatedAt", "userId"
        `;

        savedSearch = updatedRecords[0]!;
      } else {
        const savedSearchId = randomUUID();
        const createdRecords = await this.prisma.$queryRaw<SavedSearchRecord[]>`
          INSERT INTO "SavedSearch" (
            "id",
            "label",
            "query",
            "categorySlug",
            "sort",
            "alertsEnabled",
            "createdAt",
            "updatedAt",
            "userId"
          )
          VALUES (
            ${savedSearchId},
            ${normalized.label},
            ${normalized.query},
            ${normalized.categorySlug},
            ${normalized.sort},
            ${normalized.alertsEnabled},
            NOW(),
            NOW(),
            ${userId}
          )
          RETURNING "id", "label", "query", "categorySlug", "sort", "alertsEnabled", "createdAt", "updatedAt", "userId"
        `;

        savedSearch = createdRecords[0]!;
      }
    } catch (error) {
      this.handleStorageError(error);
    }

    return {
      message: existing
        ? 'Saved search already existed. Alert settings were refreshed.'
        : 'Search saved successfully.',
      savedSearch: await this.serializeSavedSearch(savedSearch),
    };
  }

  async update(
    userId: string,
    savedSearchId: string,
    dto: UpdateSavedSearchDto,
  ) {
    let existing: SavedSearchRecord | null;

    try {
      existing = await this.findRecordById(userId, savedSearchId);
    } catch (error) {
      this.handleStorageError(error);
    }

    if (!existing) {
      throw new NotFoundException('Saved search not found');
    }

    const normalized = await this.normalizeInput(dto, existing);
    let duplicate: SavedSearchRecord | null;
    let savedSearch: SavedSearchRecord | undefined;

    try {
      duplicate = await this.findRecordByUnique(userId, normalized);

      if (duplicate && duplicate.id !== savedSearchId) {
        throw new BadRequestException('That saved search already exists.');
      }

      const updatedRecords = await this.prisma.$queryRaw<SavedSearchRecord[]>`
        UPDATE "SavedSearch"
        SET
          "label" = ${normalized.label},
          "query" = ${normalized.query},
          "categorySlug" = ${normalized.categorySlug},
          "sort" = ${normalized.sort},
          "alertsEnabled" = ${normalized.alertsEnabled},
          "updatedAt" = NOW()
        WHERE "id" = ${savedSearchId} AND "userId" = ${userId}
        RETURNING "id", "label", "query", "categorySlug", "sort", "alertsEnabled", "createdAt", "updatedAt", "userId"
      `;
      savedSearch = updatedRecords[0];
    } catch (error) {
      this.handleStorageError(error);
    }

    if (!savedSearch) {
      throw new NotFoundException('Saved search not found');
    }

    return {
      message: 'Saved search updated successfully.',
      savedSearch: await this.serializeSavedSearch(savedSearch),
    };
  }

  async remove(userId: string, savedSearchId: string) {
    let existing: SavedSearchRecord | null;

    try {
      existing = await this.findRecordById(userId, savedSearchId);
    } catch (error) {
      this.handleStorageError(error);
    }

    if (!existing) {
      throw new NotFoundException('Saved search not found');
    }

    try {
      await this.prisma.$executeRaw`
        DELETE FROM "SavedSearch"
        WHERE "id" = ${savedSearchId} AND "userId" = ${userId}
      `;
    } catch (error) {
      this.handleStorageError(error);
    }

    return {
      deleted: true,
      message: 'Saved search removed successfully.',
    };
  }
}
