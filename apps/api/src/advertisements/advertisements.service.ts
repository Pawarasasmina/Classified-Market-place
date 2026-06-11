import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdvertisementBannerDto } from './dto/create-advertisement-banner.dto';
import { UpdateAdvertisementBannerDto } from './dto/update-advertisement-banner.dto';

type BannerDelegate = {
  findMany: (
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown>[]>;
  findUnique: (
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

function cleanText(value: string | null | undefined) {
  if (value === null) {
    return null;
  }

  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanNullableText(value: string | null | undefined) {
  if (value === null) {
    return null;
  }

  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseDate(value: string | null | undefined) {
  if (value === null) {
    return null;
  }

  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid banner schedule date');
  }

  return date;
}

function normalizePlacement(value: string | undefined) {
  return value?.trim().toUpperCase() || 'HOME';
}

function normalizeLayout(value: string | undefined) {
  const normalized = value?.trim().toUpperCase();

  return normalized === 'FEATURE' || normalized === 'HALF'
    ? normalized
    : 'WIDE';
}

@Injectable()
export class AdvertisementsService {
  constructor(private readonly prisma: PrismaService) {}

  private get banners(): BannerDelegate {
    return (
      this.prisma as PrismaService & { advertisementBanner: BannerDelegate }
    ).advertisementBanner;
  }

  async findActiveHomeBanners() {
    const now = new Date();

    return this.banners.findMany({
      where: {
        placement: 'HOME',
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: 12,
    });
  }

  async findAllForAdmin() {
    return this.banners.findMany({
      orderBy: [
        { isActive: 'desc' },
        { placement: 'asc' },
        { sortOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  async create(dto: CreateAdvertisementBannerDto) {
    const data = this.buildCreateData(dto);

    return this.banners.create({ data });
  }

  async update(id: string, dto: UpdateAdvertisementBannerDto) {
    const existing = await this.banners.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Advertisement banner not found');
    }

    const data = this.buildUpdateData(dto);

    return this.banners.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const existing = await this.banners.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Advertisement banner not found');
    }

    return this.banners.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private buildCreateData(dto: CreateAdvertisementBannerDto) {
    const startsAt = parseDate(dto.startsAt);
    const endsAt = parseDate(dto.endsAt);

    this.assertSchedule(startsAt, endsAt);

    return {
      title: dto.title.trim(),
      subtitle: cleanText(dto.subtitle),
      kicker: cleanText(dto.kicker),
      body: cleanText(dto.body),
      imageUrl: dto.imageUrl.trim(),
      imageAlt: cleanText(dto.imageAlt),
      badgeLabel: cleanText(dto.badgeLabel),
      metricValue: cleanText(dto.metricValue),
      metricLabel: cleanText(dto.metricLabel),
      ctaLabel: cleanText(dto.ctaLabel),
      ctaHref: cleanText(dto.ctaHref),
      secondaryCtaLabel: cleanText(dto.secondaryCtaLabel),
      secondaryCtaHref: cleanText(dto.secondaryCtaHref),
      placement: normalizePlacement(dto.placement),
      layout: normalizeLayout(dto.layout),
      backgroundColor: cleanText(dto.backgroundColor),
      textColor: cleanText(dto.textColor),
      accentColor: cleanText(dto.accentColor),
      rotationSeconds: dto.rotationSeconds ?? 6,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      startsAt,
      endsAt,
    };
  }

  private buildUpdateData(dto: UpdateAdvertisementBannerDto) {
    const startsAt = parseDate(dto.startsAt);
    const endsAt = parseDate(dto.endsAt);

    this.assertSchedule(startsAt, endsAt);

    return {
      title: dto.title?.trim(),
      subtitle:
        dto.subtitle === undefined
          ? undefined
          : cleanNullableText(dto.subtitle),
      kicker:
        dto.kicker === undefined ? undefined : cleanNullableText(dto.kicker),
      body: dto.body === undefined ? undefined : cleanNullableText(dto.body),
      imageUrl: dto.imageUrl?.trim(),
      imageAlt:
        dto.imageAlt === undefined
          ? undefined
          : cleanNullableText(dto.imageAlt),
      badgeLabel:
        dto.badgeLabel === undefined
          ? undefined
          : cleanNullableText(dto.badgeLabel),
      metricValue:
        dto.metricValue === undefined
          ? undefined
          : cleanNullableText(dto.metricValue),
      metricLabel:
        dto.metricLabel === undefined
          ? undefined
          : cleanNullableText(dto.metricLabel),
      ctaLabel:
        dto.ctaLabel === undefined
          ? undefined
          : cleanNullableText(dto.ctaLabel),
      ctaHref:
        dto.ctaHref === undefined ? undefined : cleanNullableText(dto.ctaHref),
      secondaryCtaLabel:
        dto.secondaryCtaLabel === undefined
          ? undefined
          : cleanNullableText(dto.secondaryCtaLabel),
      secondaryCtaHref:
        dto.secondaryCtaHref === undefined
          ? undefined
          : cleanNullableText(dto.secondaryCtaHref),
      placement:
        dto.placement === undefined
          ? undefined
          : normalizePlacement(dto.placement),
      layout:
        dto.layout === undefined ? undefined : normalizeLayout(dto.layout),
      backgroundColor:
        dto.backgroundColor === undefined
          ? undefined
          : cleanNullableText(dto.backgroundColor),
      textColor:
        dto.textColor === undefined
          ? undefined
          : cleanNullableText(dto.textColor),
      accentColor:
        dto.accentColor === undefined
          ? undefined
          : cleanNullableText(dto.accentColor),
      rotationSeconds: dto.rotationSeconds,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      startsAt,
      endsAt,
    };
  }

  private assertSchedule(
    startsAt: Date | null | undefined,
    endsAt: Date | null | undefined,
  ) {
    if (startsAt && endsAt && startsAt > endsAt) {
      throw new BadRequestException(
        'Banner start time must be before end time',
      );
    }
  }
}
