import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { defaultCategories } from './categories.seed';
import {
  BulkCategoryImportRowDto,
  BulkUpsertCategoriesDto,
} from './dto/bulk-upsert-categories.dto';
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

function cloneSchemaDefinition(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function hasSchemaFields(value: Record<string, unknown> | undefined) {
  const fields = value?.fields;
  return Array.isArray(fields) && fields.length > 0;
}

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  async seedDefaults() {
    for (const category of defaultCategories.filter(
      (item) => !item.parentSlug,
    )) {
      await this.prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          // Preserve admin-managed schema definitions once a category exists.
          schemaDefinition: undefined,
          listingExpiryDays: category.listingExpiryDays ?? 30,
          sortOrder: category.sortOrder ?? 0,
          isActive: true,
        },
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          schemaDefinition: toJsonValue(category.schemaDefinition),
          listingExpiryDays: category.listingExpiryDays ?? 30,
          sortOrder: category.sortOrder ?? 0,
          isActive: true,
        },
      });
    }

    for (const category of defaultCategories.filter(
      (item) => item.parentSlug,
    )) {
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
          // Preserve admin-managed schema definitions once a category exists.
          schemaDefinition: undefined,
          parentId: parent.id,
          listingExpiryDays: category.listingExpiryDays ?? 30,
          sortOrder: category.sortOrder ?? 0,
          isActive: true,
        },
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          schemaDefinition: toJsonValue(category.schemaDefinition),
          parentId: parent.id,
          listingExpiryDays: category.listingExpiryDays ?? 30,
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
    const inheritedSchemaDefinition =
      parentId && !dto.schemaDefinition
        ? await this.getInheritedSchemaDefinition(parentId)
        : undefined;

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description,
        schemaDefinition: toJsonValue(
          dto.schemaDefinition ?? inheritedSchemaDefinition,
        ),
        parentId,
        listingExpiryDays: dto.listingExpiryDays ?? 30,
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

    const inheritedSchemaDefinition =
      parentId && dto.schemaDefinition === undefined
        ? await this.getInheritedSchemaDefinition(parentId)
        : undefined;

    return this.prisma.category.update({
      where: { id: category.id },
      data: {
        name: dto.name?.trim(),
        slug: nextSlug,
        description: dto.description,
        schemaDefinition: toJsonValue(
          dto.schemaDefinition ?? inheritedSchemaDefinition,
        ),
        parentId,
        listingExpiryDays: dto.listingExpiryDays,
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

  async bulkUpsert(dto: BulkUpsertCategoriesDto) {
    const normalizedRows = dto.rows
      .map((row, index) => this.normalizeBulkRow(row, index))
      .filter(
        (
          row,
        ): row is ReturnType<CategoriesService['normalizeBulkRow']> &
          NonNullable<unknown> => row !== null,
      );

    if (!normalizedRows.length) {
      throw new BadRequestException('At least one category row is required');
    }

    const existingCategories = await this.prisma.category.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        parentId: true,
        schemaDefinition: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const categoriesBySlug = new Map(
      existingCategories.map((category) => [category.slug, category]),
    );
    const categoriesByName = new Map(
      existingCategories.map((category) => [
        category.name.trim().toLowerCase(),
        category,
      ]),
    );
    const importedNameToSlug = new Map<string, string>();

    for (const row of normalizedRows) {
      importedNameToSlug.set(row.name.trim().toLowerCase(), row.slug);
    }

    const pendingRows = normalizedRows.map((row) => ({ ...row }));
    const errors: string[] = [];
    const summary = {
      created: 0,
      updated: 0,
      skipped: 0,
      processed: normalizedRows.length,
    };

    while (pendingRows.length) {
      let progressed = false;

      for (let index = 0; index < pendingRows.length; ) {
        const row = pendingRows[index];
        const parentResolution = this.resolveBulkParentSlug({
          categoriesByName,
          categoriesBySlug,
          importedNameToSlug,
          row,
        });

        if (parentResolution.waitingForParent) {
          index += 1;
          continue;
        }

        if (parentResolution.error) {
          errors.push(`Row ${row.rowNumber}: ${parentResolution.error}`);
          pendingRows.splice(index, 1);
          progressed = true;
          continue;
        }

        const parentId = parentResolution.parentSlug
          ? (categoriesBySlug.get(parentResolution.parentSlug)?.id ?? null)
          : null;
        const existing = categoriesBySlug.get(row.slug);

        if (existing) {
          const schemaUpdate = await this.resolveBulkSchemaDefinition({
            parentId,
            row,
            mode: 'update',
          });
          if (!dto.updateExisting) {
            summary.skipped += 1;
            pendingRows.splice(index, 1);
            progressed = true;
            continue;
          }

          if (parentId && parentId === existing.id) {
            errors.push(
              `Row ${row.rowNumber}: "${row.name}" cannot be its own parent.`,
            );
            pendingRows.splice(index, 1);
            progressed = true;
            continue;
          }

          const updated = await this.prisma.category.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              description: row.description,
              parentId,
              listingExpiryDays: row.listingExpiryDays,
              sortOrder: row.sortOrder,
              isActive: row.isActive,
              ...(schemaUpdate.shouldWrite
                ? {
                    schemaDefinition:
                      toJsonValue(schemaUpdate.value) ?? Prisma.JsonNull,
                  }
                : {}),
            },
            select: {
              id: true,
              slug: true,
              name: true,
              parentId: true,
              schemaDefinition: true,
            },
          });

          categoriesBySlug.set(updated.slug, updated);
          categoriesByName.set(updated.name.trim().toLowerCase(), updated);
          summary.updated += 1;
          pendingRows.splice(index, 1);
          progressed = true;
          continue;
        }

        const schemaUpdate = await this.resolveBulkSchemaDefinition({
          parentId,
          row,
          mode: 'create',
        });
        const created = await this.prisma.category.create({
          data: {
            name: row.name,
            slug: row.slug,
            description: row.description,
            parentId,
            listingExpiryDays: row.listingExpiryDays ?? 30,
            sortOrder: row.sortOrder ?? 0,
            isActive: row.isActive ?? true,
            schemaDefinition: toJsonValue(schemaUpdate.value),
          },
          select: {
            id: true,
            slug: true,
            name: true,
            parentId: true,
            schemaDefinition: true,
          },
        });

        categoriesBySlug.set(created.slug, created);
        categoriesByName.set(created.name.trim().toLowerCase(), created);
        importedNameToSlug.set(created.name.trim().toLowerCase(), created.slug);
        summary.created += 1;
        pendingRows.splice(index, 1);
        progressed = true;
      }

      if (!progressed) {
        for (const row of pendingRows) {
          errors.push(
            `Row ${row.rowNumber}: parent category "${row.parentSlug ?? row.parentName ?? 'unknown'}" could not be resolved.`,
          );
        }
        break;
      }
    }

    return {
      ...summary,
      failed: errors.length,
      errors,
    };
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

  private async getInheritedSchemaDefinition(parentId: string) {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { schemaDefinition: true },
    });

    return cloneSchemaDefinition(
      (parent?.schemaDefinition as
        | Record<string, unknown>
        | null
        | undefined) ?? undefined,
    );
  }

  private normalizeBulkRow(row: BulkCategoryImportRowDto, index: number) {
    const name = row.name?.trim();
    const slug = slugify(row.slug ?? row.name);

    if (!name || !slug) {
      return null;
    }

    return {
      rowNumber: index + 2,
      name,
      slug,
      description: normalizeOptionalText(row.description) ?? null,
      isActive: row.isActive,
      listingExpiryDays: row.listingExpiryDays,
      parentName: normalizeOptionalText(row.parentName),
      parentSlug: normalizeOptionalText(row.parentSlug)
        ? slugify(row.parentSlug as string)
        : undefined,
      schemaDefinition: hasSchemaFields(row.schemaDefinition)
        ? cloneSchemaDefinition(row.schemaDefinition)
        : undefined,
      sortOrder: row.sortOrder,
      useParentQuestions: row.useParentQuestions === true,
    };
  }

  private async resolveBulkSchemaDefinition({
    mode,
    parentId,
    row,
  }: {
    mode: 'create' | 'update';
    parentId: string | null;
    row: {
      rowNumber: number;
      name: string;
      slug: string;
      description: string | null;
      parentName?: string;
      parentSlug?: string;
      listingExpiryDays?: number;
      isActive?: boolean;
      sortOrder?: number;
      schemaDefinition?: Record<string, unknown>;
      useParentQuestions?: boolean;
    };
  }) {
    if (row.schemaDefinition) {
      return {
        shouldWrite: true,
        value: cloneSchemaDefinition(row.schemaDefinition),
      };
    }

    if (row.useParentQuestions && parentId) {
      return {
        shouldWrite: true,
        value: await this.getInheritedSchemaDefinition(parentId),
      };
    }

    if (!parentId && row.useParentQuestions) {
      return {
        shouldWrite: false,
        value: undefined,
      };
    }

    if (mode === 'create' && parentId && !row.schemaDefinition) {
      return {
        shouldWrite: true,
        value: await this.getInheritedSchemaDefinition(parentId),
      };
    }

    return {
      shouldWrite: false,
      value: undefined,
    };
  }

  private resolveBulkParentSlug({
    categoriesByName,
    categoriesBySlug,
    importedNameToSlug,
    row,
  }: {
    categoriesByName: Map<
      string,
      {
        id: string;
        slug: string;
        name: string;
        parentId: string | null;
        schemaDefinition: Prisma.JsonValue | null;
      }
    >;
    categoriesBySlug: Map<
      string,
      {
        id: string;
        slug: string;
        name: string;
        parentId: string | null;
        schemaDefinition: Prisma.JsonValue | null;
      }
    >;
    importedNameToSlug: Map<string, string>;
    row: {
      rowNumber: number;
      name: string;
      slug: string;
      description: string | null;
      parentName?: string;
      parentSlug?: string;
      listingExpiryDays?: number;
      isActive?: boolean;
      sortOrder?: number;
      schemaDefinition?: Record<string, unknown>;
      useParentQuestions?: boolean;
    };
  }) {
    if (!row.parentSlug && !row.parentName) {
      return { parentSlug: undefined, waitingForParent: false };
    }

    const directParentSlug = row.parentSlug
      ? slugify(row.parentSlug)
      : undefined;

    if (directParentSlug) {
      if (directParentSlug === row.slug) {
        return {
          error: 'A category cannot be its own parent.',
          waitingForParent: false,
        };
      }

      if (categoriesBySlug.has(directParentSlug)) {
        return { parentSlug: directParentSlug, waitingForParent: false };
      }

      return { parentSlug: directParentSlug, waitingForParent: true };
    }

    const normalizedParentName = row.parentName?.trim().toLowerCase();

    if (!normalizedParentName) {
      return { parentSlug: undefined, waitingForParent: false };
    }

    const importedParentSlug = importedNameToSlug.get(normalizedParentName);

    if (importedParentSlug) {
      if (importedParentSlug === row.slug) {
        return {
          error: 'A category cannot be its own parent.',
          waitingForParent: false,
        };
      }

      if (categoriesBySlug.has(importedParentSlug)) {
        return { parentSlug: importedParentSlug, waitingForParent: false };
      }

      return { parentSlug: importedParentSlug, waitingForParent: true };
    }

    const existingParent = categoriesByName.get(normalizedParentName);

    if (existingParent) {
      if (existingParent.slug === row.slug) {
        return {
          error: 'A category cannot be its own parent.',
          waitingForParent: false,
        };
      }

      return { parentSlug: existingParent.slug, waitingForParent: false };
    }

    return {
      error: `Parent category "${row.parentName}" was not found.`,
      waitingForParent: false,
    };
  }
}
