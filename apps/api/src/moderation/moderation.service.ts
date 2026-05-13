import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingReportStatus,
  ListingStatus,
  ModerationActionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingReportDto } from './dto/create-listing-report.dto';
import { ModerateListingDto } from './dto/moderate-listing.dto';
import { QueryModerationQueueDto } from './dto/query-moderation-queue.dto';

const moderationQueueInclude = {
  category: true,
  seller: true,
  reports: {
    include: {
      reporter: true,
      resolvedBy: true,
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
    take: 5,
  },
  moderationEvents: {
    include: {
      actor: true,
      report: true,
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
    take: 10,
  },
  _count: {
    select: {
      reports: true,
    },
  },
} satisfies Prisma.ListingInclude;

const reportInclude = {
  listing: {
    include: {
      category: true,
      seller: true,
    },
  },
  reporter: true,
  resolvedBy: true,
  moderationEvents: {
    include: {
      actor: true,
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
} satisfies Prisma.ListingReportInclude;

type ModerationQueueListing = Prisma.ListingGetPayload<{
  include: typeof moderationQueueInclude;
}>;

type ListingReportRecord = Prisma.ListingReportGetPayload<{
  include: typeof reportInclude;
}>;

function sanitizeUser(
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    phone: string | null;
    phoneVerified: boolean;
    emailVerified: boolean;
    reputationScore: number;
    createdAt: Date;
    updatedAt: Date;
  } | null,
) {
  return user;
}

function serializeReport(
  report: ModerationQueueListing['reports'][number] | ListingReportRecord,
) {
  return {
    id: report.id,
    reason: report.reason,
    details: report.details,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    resolvedAt: report.resolvedAt,
    resolutionAction: report.resolutionAction,
    resolutionNote: report.resolutionNote,
    reporter: sanitizeUser(report.reporter),
    resolvedBy: sanitizeUser(report.resolvedBy),
  };
}

function serializeModerationEvent(
  event:
    | ModerationQueueListing['moderationEvents'][number]
    | ListingReportRecord['moderationEvents'][number],
) {
  return {
    id: event.id,
    action: event.action,
    notes: event.notes,
    previousListingStatus: event.previousListingStatus,
    nextListingStatus: event.nextListingStatus,
    resultingReportStatus: event.resultingReportStatus,
    createdAt: event.createdAt,
    actor: sanitizeUser(event.actor),
    reportId: event.reportId,
  };
}

function serializeListing(listing: ModerationQueueListing) {
  const openReports = listing.reports.filter(
    (report) =>
      report.status === ListingReportStatus.OPEN ||
      report.status === ListingReportStatus.UNDER_REVIEW,
  );

  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: Number(listing.price),
    currency: listing.currency,
    location: listing.location,
    status: listing.status,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    sellerId: listing.sellerId,
    categoryId: listing.categoryId,
    category: listing.category
      ? {
          id: listing.category.id,
          name: listing.category.name,
          slug: listing.category.slug,
        }
      : null,
    seller: sanitizeUser(listing.seller),
    reportCount: listing._count.reports,
    openReportCount: openReports.length,
    latestReport: listing.reports[0]
      ? serializeReport(listing.reports[0])
      : null,
    reports: listing.reports.map(serializeReport),
    latestModerationEvent: listing.moderationEvents[0]
      ? serializeModerationEvent(listing.moderationEvents[0])
      : null,
    moderationEvents: listing.moderationEvents.map(serializeModerationEvent),
  };
}

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async createListingReport(
    reporterId: string,
    listingId: string,
    dto: CreateListingReportDto,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        seller: true,
        category: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId === reporterId) {
      throw new BadRequestException('You cannot report your own listing');
    }

    const existingOpenReport = await this.prisma.listingReport.findFirst({
      where: {
        listingId,
        reporterId,
        status: {
          in: [ListingReportStatus.OPEN, ListingReportStatus.UNDER_REVIEW],
        },
      },
    });

    if (existingOpenReport) {
      throw new BadRequestException(
        'You already have an open report for this listing',
      );
    }

    const report = await this.prisma.$transaction(async (tx) => {
      const createdReport = await tx.listingReport.create({
        data: {
          listingId,
          reporterId,
          reason: dto.reason,
          details: dto.details?.trim() || undefined,
        },
      });

      await tx.listingModerationEvent.create({
        data: {
          listingId,
          reportId: createdReport.id,
          actorId: reporterId,
          action: ModerationActionType.REPORT_CREATED,
          notes: dto.details?.trim() || undefined,
          previousListingStatus: listing.status,
          nextListingStatus: listing.status,
          resultingReportStatus: ListingReportStatus.OPEN,
        },
      });

      return tx.listingReport.findUniqueOrThrow({
        where: { id: createdReport.id },
        include: reportInclude,
      });
    });

    return {
      ...serializeReport(report),
      listing: {
        id: report.listing.id,
        title: report.listing.title,
        status: report.listing.status,
        category: report.listing.category
          ? {
              id: report.listing.category.id,
              name: report.listing.category.name,
              slug: report.listing.category.slug,
            }
          : null,
        seller: sanitizeUser(report.listing.seller),
      },
      moderationEvents: report.moderationEvents.map(serializeModerationEvent),
    };
  }

  async findModerationQueue(query: QueryModerationQueueDto) {
    const activeReportStatuses = query.includeResolved
      ? undefined
      : [ListingReportStatus.OPEN, ListingReportStatus.UNDER_REVIEW];

    const listings = await this.prisma.listing.findMany({
      where: {
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                {
                  description: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                { location: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.listingStatus ? { status: query.listingStatus } : {}),
        ...(!query.listingStatus &&
        !query.reportStatus &&
        !query.includeResolved
          ? {
              OR: [
                { status: ListingStatus.DRAFT },
                {
                  reports: {
                    some: {
                      status: {
                        in: [
                          ListingReportStatus.OPEN,
                          ListingReportStatus.UNDER_REVIEW,
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {}),
        ...(query.reportStatus
          ? {
              reports: {
                some: {
                  status: query.reportStatus,
                },
              },
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.take ?? 25,
      include: {
        ...moderationQueueInclude,
        reports: {
          ...moderationQueueInclude.reports,
          ...(activeReportStatuses
            ? {
                where: {
                  status: {
                    in: activeReportStatuses,
                  },
                },
              }
            : {}),
        },
      },
    });

    return listings.map(serializeListing);
  }

  async findReport(reportId: string) {
    const report = await this.prisma.listingReport.findUnique({
      where: { id: reportId },
      include: reportInclude,
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return {
      ...serializeReport(report),
      listing: {
        id: report.listing.id,
        title: report.listing.title,
        status: report.listing.status,
        price: Number(report.listing.price),
        currency: report.listing.currency,
        location: report.listing.location,
        category: report.listing.category
          ? {
              id: report.listing.category.id,
              name: report.listing.category.name,
              slug: report.listing.category.slug,
            }
          : null,
        seller: sanitizeUser(report.listing.seller),
      },
      moderationEvents: report.moderationEvents.map(serializeModerationEvent),
    };
  }

  async findListingHistory(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: moderationQueueInclude,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return serializeListing(listing);
  }

  async moderateListing(
    actorId: string,
    listingId: string,
    dto: ModerateListingDto,
  ) {
    const allowedActions = new Set<ModerationActionType>([
      ModerationActionType.LISTING_APPROVED,
      ModerationActionType.LISTING_REJECTED,
      ModerationActionType.LISTING_REMOVED,
      ModerationActionType.REPORT_DISMISSED,
      ModerationActionType.REPORT_UNDER_REVIEW,
    ]);

    if (!allowedActions.has(dto.action)) {
      throw new BadRequestException('Unsupported moderation action');
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const report = dto.reportId
      ? await this.prisma.listingReport.findUnique({
          where: { id: dto.reportId },
        })
      : null;

    if (dto.reportId && !report) {
      throw new NotFoundException('Report not found');
    }

    if (report && report.listingId !== listingId) {
      throw new BadRequestException(
        'The selected report does not belong to this listing',
      );
    }

    const nextListingStatus = this.resolveNextListingStatus(
      dto.action,
      listing.status,
    );
    const resultingReportStatus = this.resolveResultingReportStatus(dto.action);
    const resolvedAt =
      resultingReportStatus &&
      resultingReportStatus !== ListingReportStatus.UNDER_REVIEW
        ? new Date()
        : null;

    await this.prisma.$transaction(async (tx) => {
      if (nextListingStatus !== listing.status) {
        await tx.listing.update({
          where: { id: listingId },
          data: {
            status: nextListingStatus,
          },
        });
      }

      if (report && resultingReportStatus) {
        await tx.listingReport.update({
          where: { id: report.id },
          data: {
            status: resultingReportStatus,
            resolvedById:
              resultingReportStatus === ListingReportStatus.UNDER_REVIEW
                ? null
                : actorId,
            resolvedAt:
              resultingReportStatus === ListingReportStatus.UNDER_REVIEW
                ? null
                : resolvedAt,
            resolutionAction:
              resultingReportStatus === ListingReportStatus.UNDER_REVIEW
                ? null
                : dto.action,
            resolutionNote: dto.notes?.trim() || undefined,
          },
        });
      }

      await tx.listingModerationEvent.create({
        data: {
          listingId,
          reportId: report?.id,
          actorId,
          action: dto.action,
          notes: dto.notes?.trim() || undefined,
          previousListingStatus: listing.status,
          nextListingStatus,
          resultingReportStatus: resultingReportStatus ?? undefined,
        },
      });
    });

    return this.findListingHistory(listingId);
  }

  private resolveNextListingStatus(
    action: ModerationActionType,
    currentStatus: ListingStatus,
  ) {
    switch (action) {
      case ModerationActionType.LISTING_APPROVED:
        return ListingStatus.ACTIVE;
      case ModerationActionType.LISTING_REJECTED:
        return ListingStatus.DRAFT;
      case ModerationActionType.LISTING_REMOVED:
        return ListingStatus.REMOVED;
      default:
        return currentStatus;
    }
  }

  private resolveResultingReportStatus(action: ModerationActionType) {
    switch (action) {
      case ModerationActionType.REPORT_UNDER_REVIEW:
        return ListingReportStatus.UNDER_REVIEW;
      case ModerationActionType.REPORT_DISMISSED:
      case ModerationActionType.LISTING_APPROVED:
        return ListingReportStatus.DISMISSED;
      case ModerationActionType.LISTING_REJECTED:
      case ModerationActionType.LISTING_REMOVED:
        return ListingReportStatus.RESOLVED;
      default:
        return null;
    }
  }
}
