import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BoostStatus,
  ListingPaymentMode,
  ListingStatus,
  Prisma,
  ReportStatus,
  SellerPriorityTier,
  SellerReviewStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import PDFDocument from 'pdfkit';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryActiveListingsReportDto } from './dto/query-active-listings-report.dto';
import { QueryAdminMonitoringDto } from './dto/query-admin-monitoring.dto';
import { QueryAdminSellerReportDto } from './dto/query-admin-seller-report.dto';
import { QueryBoostRevenueReportDto } from './dto/query-boost-revenue-report.dto';
import { QueryCategoryIncomeReportDto } from './dto/query-category-income-report.dto';
import { CreateListingReportDto } from './dto/create-listing-report.dto';
import { QueryPaidListingsReportDto } from './dto/query-paid-listings-report.dto';
import { QueryPendingSellerApprovalsDto } from './dto/query-pending-seller-approvals.dto';
import { QueryListingReportsDto } from './dto/query-listing-reports.dto';
import { QueryTopSellersReportDto } from './dto/query-top-sellers-report.dto';
import { QueryWalletPaymentsReportDto } from './dto/query-wallet-payments-report.dto';
import {
  AdminReportEmailFiltersDto,
  AdminReportEmailType,
  SendAdminReportEmailDto,
} from './dto/send-admin-report-email.dto';
import { UpdateListingReportDto } from './dto/update-listing-report.dto';

const listingReportInclude = {
  listing: {
    select: {
      id: true,
      title: true,
      status: true,
      sellerId: true,
    },
  },
  reporter: {
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.ListingReportInclude;

const oneDayMs = 24 * 60 * 60 * 1000;
const defaultMonitoringDays = 30;
const reportEmailPreviewRowLimit = 10;
const reportEmailPreviewColumnLimit = 6;

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusCounts<T extends string>(
  statuses: T[],
  rows: Array<{ status: T; _count: { _all: number } }>,
) {
  const counts = Object.fromEntries(
    statuses.map((status) => [status, 0]),
  ) as Record<T, number>;

  for (const row of rows) {
    counts[row.status] = row._count._all;
  }

  return counts as Record<T, number>;
}

function typeSums<T extends string>(
  types: T[],
  rows: Array<{ type: T; _sum: { amount: Prisma.Decimal | null } }>,
) {
  const sums = Object.fromEntries(types.map((type) => [type, 0])) as Record<
    T,
    number
  >;

  for (const row of rows) {
    sums[row.type] = toNumber(row._sum.amount);
  }

  return sums as Record<T, number>;
}

function createListingStatusCounts() {
  return Object.fromEntries(
    Object.values(ListingStatus).map((status) => [status, 0]),
  ) as Record<ListingStatus, number>;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async createListingReport(
    reporterId: string,
    listingId: string,
    dto: CreateListingReportDto,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        status: true,
        sellerId: true,
      },
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId === reporterId) {
      throw new ForbiddenException('You cannot report your own listing');
    }

    const existingOpenReport = await this.prisma.listingReport.findFirst({
      where: {
        listingId,
        reporterId,
        status: ReportStatus.OPEN,
      },
      select: { id: true },
    });

    if (existingOpenReport) {
      throw new ConflictException(
        'You already have an open report for this listing',
      );
    }

    return this.prisma.listingReport.create({
      data: {
        listingId,
        reporterId,
        reason: dto.reason.trim(),
        details: normalizeOptionalText(dto.details),
      },
      include: listingReportInclude,
    });
  }

  listMine(reporterId: string, query: QueryListingReportsDto) {
    return this.prisma.listingReport.findMany({
      where: this.buildListingReportWhere({
        ...query,
        reporterId,
      }),
      orderBy: { createdAt: 'desc' },
      take: query.take ?? 50,
      include: listingReportInclude,
    });
  }

  listForAdmin(query: QueryListingReportsDto) {
    return this.prisma.listingReport.findMany({
      where: this.buildListingReportWhere(query),
      orderBy: { createdAt: 'desc' },
      take: query.take ?? 100,
      include: listingReportInclude,
    });
  }

  async getAdminMonitoring(query: QueryAdminMonitoringDto) {
    const { from, to, previousFrom } = this.resolveMonitoringRange(query);
    const topTake = query.topTake ?? 5;
    const now = new Date();
    const expiringSoon = new Date(now.getTime() + oneDayMs);
    const rangeWhere = { gte: from, lte: to };
    const previousRangeWhere = { gte: previousFrom, lt: from };

    const [
      totalUsers,
      newUsers,
      previousNewUsers,
      totalListings,
      newListings,
      previousNewListings,
      listingStatusRows,
      transactionStatusRows,
      transactionTypeRevenueRows,
      revenueAggregate,
      previousRevenueAggregate,
      openListingReports,
      openConversationReports,
      openMessageReports,
      listingReportStatusRows,
      conversationReportStatusRows,
      messageReportStatusRows,
      sellerReviewStatusRows,
      boostStatusRows,
      activeBoosts,
      expiringBoosts,
      listingViews,
      previousListingViews,
      savedListings,
      conversations,
      messages,
      recentListingReports,
      recentConversationReports,
      recentMessageReports,
      topViewedListings,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: rangeWhere } }),
      this.prisma.user.count({ where: { createdAt: previousRangeWhere } }),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { createdAt: rangeWhere } }),
      this.prisma.listing.count({
        where: { createdAt: previousRangeWhere },
      }),
      this.prisma.listing.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        where: { createdAt: rangeWhere },
        _count: { _all: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          status: TransactionStatus.SUCCEEDED,
          createdAt: rangeWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.SUCCEEDED,
          createdAt: rangeWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.SUCCEEDED,
          createdAt: previousRangeWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.listingReport.count({
        where: { status: ReportStatus.OPEN },
      }),
      this.prisma.conversationReport.count({
        where: { status: ReportStatus.OPEN },
      }),
      this.prisma.messageReport.count({
        where: { status: ReportStatus.OPEN },
      }),
      this.prisma.listingReport.groupBy({
        by: ['status'],
        where: { createdAt: rangeWhere },
        _count: { _all: true },
      }),
      this.prisma.conversationReport.groupBy({
        by: ['status'],
        where: { createdAt: rangeWhere },
        _count: { _all: true },
      }),
      this.prisma.messageReport.groupBy({
        by: ['status'],
        where: { createdAt: rangeWhere },
        _count: { _all: true },
      }),
      this.prisma.sellerRating.groupBy({
        by: ['reviewStatus'],
        where: { createdAt: rangeWhere },
        _count: { _all: true },
      }),
      this.prisma.boost.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.boost.count({
        where: {
          status: BoostStatus.ACTIVE,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
      }),
      this.prisma.boost.count({
        where: {
          status: BoostStatus.ACTIVE,
          endsAt: { gt: now, lte: expiringSoon },
        },
      }),
      this.prisma.listingView.count({ where: { viewedAt: rangeWhere } }),
      this.prisma.listingView.count({
        where: { viewedAt: previousRangeWhere },
      }),
      this.prisma.savedListing.count({ where: { createdAt: rangeWhere } }),
      this.prisma.conversation.count({ where: { createdAt: rangeWhere } }),
      this.prisma.message.count({ where: { createdAt: rangeWhere } }),
      this.prisma.listingReport.findMany({
        orderBy: { createdAt: 'desc' },
        take: topTake,
        include: listingReportInclude,
      }),
      this.prisma.conversationReport.findMany({
        orderBy: { createdAt: 'desc' },
        take: topTake,
        include: {
          conversation: {
            select: {
              id: true,
              listingId: true,
              listing: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                },
              },
            },
          },
          reporter: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.messageReport.findMany({
        orderBy: { createdAt: 'desc' },
        take: topTake,
        include: {
          message: {
            select: {
              id: true,
              conversationId: true,
              listingId: true,
              listing: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                },
              },
            },
          },
          reporter: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.getTopViewedListings(rangeWhere, topTake),
    ]);

    const listingReportCounts = statusCounts(
      Object.values(ReportStatus),
      listingReportStatusRows,
    );
    const conversationReportCounts = statusCounts(
      Object.values(ReportStatus),
      conversationReportStatusRows,
    );
    const messageReportCounts = statusCounts(
      Object.values(ReportStatus),
      messageReportStatusRows,
    );
    const totalOpenReports =
      openListingReports + openConversationReports + openMessageReports;
    const revenue = toNumber(revenueAggregate._sum.amount);
    const previousRevenue = toNumber(previousRevenueAggregate._sum.amount);

    return {
      generatedAt: now,
      range: {
        from,
        to,
        days: Math.max(
          1,
          Math.ceil((to.getTime() - from.getTime()) / oneDayMs),
        ),
      },
      overview: {
        totalUsers,
        newUsers,
        newUsersDelta: newUsers - previousNewUsers,
        totalListings,
        newListings,
        newListingsDelta: newListings - previousNewListings,
        activeListings:
          statusCounts(Object.values(ListingStatus), listingStatusRows)
            .ACTIVE ?? 0,
        totalRevenue: revenue,
        totalRevenueDelta: revenue - previousRevenue,
        openReports: totalOpenReports,
        activeBoosts,
      },
      moderation: {
        listingStatuses: statusCounts(
          Object.values(ListingStatus),
          listingStatusRows,
        ),
        listingReports: listingReportCounts,
        conversationReports: conversationReportCounts,
        messageReports: messageReportCounts,
        totalReports: Object.fromEntries(
          Object.values(ReportStatus).map((status) => [
            status,
            (listingReportCounts[status] ?? 0) +
              (conversationReportCounts[status] ?? 0) +
              (messageReportCounts[status] ?? 0),
          ]),
        ) as Record<ReportStatus, number>,
        sellerReviews: statusCounts(
          Object.values(SellerReviewStatus),
          sellerReviewStatusRows.map((row) => ({
            status: row.reviewStatus,
            _count: row._count,
          })),
        ),
      },
      commerce: {
        revenue,
        revenueDelta: revenue - previousRevenue,
        transactionStatuses: statusCounts(
          Object.values(TransactionStatus),
          transactionStatusRows,
        ),
        revenueByType: typeSums(
          Object.values(TransactionType),
          transactionTypeRevenueRows,
        ),
      },
      engagement: {
        listingViews,
        listingViewsDelta: listingViews - previousListingViews,
        savedListings,
        conversations,
        messages,
        inquiryConversionRate: this.toPercent(conversations, listingViews),
      },
      boosts: {
        statuses: statusCounts(Object.values(BoostStatus), boostStatusRows),
        active: activeBoosts,
        expiringWithin24Hours: expiringBoosts,
      },
      alerts: this.buildMonitoringAlerts({
        openReports: totalOpenReports,
        pendingListings:
          statusCounts(Object.values(ListingStatus), listingStatusRows)
            .PENDING ?? 0,
        pendingReviews:
          statusCounts(
            Object.values(SellerReviewStatus),
            sellerReviewStatusRows.map((row) => ({
              status: row.reviewStatus,
              _count: row._count,
            })),
          ).PENDING ?? 0,
        failedTransactions:
          statusCounts(Object.values(TransactionStatus), transactionStatusRows)
            .FAILED ?? 0,
        expiringBoosts,
      }),
      recentReports: [
        ...recentListingReports.map((report) => ({
          id: report.id,
          type: 'LISTING' as const,
          targetId: report.listingId,
          targetTitle: report.listing?.title ?? null,
          status: report.status,
          reason: report.reason,
          details: report.details,
          reporter: report.reporter,
          createdAt: report.createdAt,
        })),
        ...recentConversationReports.map((report) => ({
          id: report.id,
          type: 'CONVERSATION' as const,
          targetId: report.conversationId,
          targetTitle: report.conversation.listing?.title ?? null,
          status: report.status,
          reason: report.reason,
          details: report.details,
          reporter: report.reporter,
          createdAt: report.createdAt,
        })),
        ...recentMessageReports.map((report) => ({
          id: report.id,
          type: 'MESSAGE' as const,
          targetId: report.messageId,
          targetTitle: report.message.listing?.title ?? null,
          status: report.status,
          reason: report.reason,
          details: report.details,
          reporter: report.reporter,
          createdAt: report.createdAt,
        })),
      ]
        .sort(
          (first, second) =>
            second.createdAt.getTime() - first.createdAt.getTime(),
        )
        .slice(0, topTake),
      topListings: topViewedListings,
    };
  }

  async getAdminSellerReport(query: QueryAdminSellerReportDto) {
    const { from, to, previousFrom } = this.resolveMonitoringRange(query);
    const take = query.take ?? 50;
    const rangeWhere = { gte: from, lte: to };
    const previousRangeWhere = { gte: previousFrom, lt: from };

    const [
      totalSellers,
      activeSellers,
      newSellers,
      previousNewSellers,
      verifiedSellers,
      tierRows,
      sellers,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { listings: { some: {} } },
      }),
      this.prisma.user.count({
        where: { listings: { some: { status: ListingStatus.ACTIVE } } },
      }),
      this.prisma.user.count({
        where: {
          listings: {
            some: { createdAt: rangeWhere },
            none: { createdAt: { lt: from } },
          },
        },
      }),
      this.prisma.user.count({
        where: {
          listings: {
            some: { createdAt: previousRangeWhere },
            none: { createdAt: { lt: previousFrom } },
          },
        },
      }),
      this.prisma.user.count({
        where: {
          listings: { some: {} },
          OR: [{ emailVerified: true }, { phoneVerified: true }],
        },
      }),
      this.prisma.user.groupBy({
        by: ['sellerPriorityTier'],
        where: { listings: { some: {} } },
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        where: { listings: { some: {} } },
        select: {
          id: true,
          email: true,
          displayName: true,
          phone: true,
          emailVerified: true,
          phoneVerified: true,
          sellerPriorityTier: true,
          reputationScore: true,
          createdAt: true,
        },
        orderBy: [{ displayName: 'asc' }],
      }),
    ]);
    const sellerIds = sellers.map((seller) => seller.id);
    const sellerMetrics = new Map(
      sellers.map((seller) => [
        seller.id,
        {
          listingStatuses: createListingStatusCounts(),
          totalListings: 0,
          activeListings: 0,
          newListings: 0,
          paidListings: 0,
          views: 0,
          saves: 0,
          inquiries: 0,
          reports: 0,
          boosts: 0,
          revenue: 0,
          averageRating: null as number | null,
          ratingCount: 0,
          reviewCount: 0,
        },
      ]),
    );

    if (sellerIds.length) {
      const listings = await this.prisma.listing.findMany({
        where: { sellerId: { in: sellerIds } },
        select: {
          id: true,
          sellerId: true,
          status: true,
          listingPaymentMode: true,
          paidPriorityEnabled: true,
          createdAt: true,
        },
      });
      const listingIds = listings.map((listing) => listing.id);
      const listingToSeller = new Map(
        listings.map((listing) => [listing.id, listing.sellerId]),
      );
      const [
        viewRows,
        saveRows,
        conversations,
        reportRows,
        boostRows,
        revenueRows,
        ratingRows,
        reviewRows,
      ] = await Promise.all([
        listingIds.length
          ? this.prisma.listingView.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, viewedAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.savedListing.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.conversation.findMany({
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              select: { listingId: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.listingReport.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.boost.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        this.prisma.transaction.groupBy({
          by: ['userId'],
          where: {
            userId: { in: sellerIds },
            status: TransactionStatus.SUCCEEDED,
            createdAt: rangeWhere,
          },
          _sum: { amount: true },
        }),
        this.prisma.sellerRating.groupBy({
          by: ['sellerId'],
          where: { sellerId: { in: sellerIds } },
          _avg: { stars: true },
          _count: { _all: true },
        }),
        this.prisma.sellerRating.groupBy({
          by: ['sellerId'],
          where: {
            sellerId: { in: sellerIds },
            review: { not: null },
            reviewStatus: SellerReviewStatus.APPROVED,
          },
          _count: { _all: true },
        }),
      ]);

      for (const listing of listings) {
        const metrics = sellerMetrics.get(listing.sellerId);

        if (!metrics) {
          continue;
        }

        metrics.totalListings += 1;
        metrics.listingStatuses[listing.status] += 1;

        if (listing.status === ListingStatus.ACTIVE) {
          metrics.activeListings += 1;
        }

        if (listing.createdAt >= from && listing.createdAt <= to) {
          metrics.newListings += 1;
        }

        if (
          listing.listingPaymentMode === 'PAID' ||
          listing.paidPriorityEnabled
        ) {
          metrics.paidListings += 1;
        }
      }

      for (const row of viewRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? sellerMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.views += row._count._all;
        }
      }

      for (const row of saveRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? sellerMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.saves += row._count._all;
        }
      }

      for (const conversation of conversations) {
        if (!conversation.listingId) {
          continue;
        }

        const sellerId = listingToSeller.get(conversation.listingId);
        const metrics = sellerId ? sellerMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.inquiries += 1;
        }
      }

      for (const row of reportRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? sellerMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.reports += row._count._all;
        }
      }

      for (const row of boostRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? sellerMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.boosts += row._count._all;
        }
      }

      for (const row of revenueRows) {
        const metrics = sellerMetrics.get(row.userId);

        if (metrics) {
          metrics.revenue = toNumber(row._sum.amount);
        }
      }

      for (const row of ratingRows) {
        const metrics = sellerMetrics.get(row.sellerId);

        if (metrics) {
          metrics.averageRating =
            row._avg.stars == null ? null : Number(row._avg.stars.toFixed(1));
          metrics.ratingCount = row._count._all;
        }
      }

      for (const row of reviewRows) {
        const metrics = sellerMetrics.get(row.sellerId);

        if (metrics) {
          metrics.reviewCount = row._count._all;
        }
      }
    }

    const tierCounts = Object.fromEntries(
      Object.values(SellerPriorityTier).map((tier) => [tier, 0]),
    ) as Record<SellerPriorityTier, number>;

    for (const row of tierRows) {
      tierCounts[row.sellerPriorityTier] = row._count._all;
    }

    const sellerRows = sellers
      .map((seller) => {
        const metrics = sellerMetrics.get(seller.id);
        const views = metrics?.views ?? 0;
        const inquiries = metrics?.inquiries ?? 0;

        return {
          id: seller.id,
          displayName: seller.displayName,
          email: seller.email,
          phone: seller.phone,
          emailVerified: seller.emailVerified,
          phoneVerified: seller.phoneVerified,
          sellerPriorityTier: seller.sellerPriorityTier,
          reputationScore: seller.reputationScore,
          createdAt: seller.createdAt,
          totalListings: metrics?.totalListings ?? 0,
          activeListings: metrics?.activeListings ?? 0,
          newListings: metrics?.newListings ?? 0,
          paidListings: metrics?.paidListings ?? 0,
          listingStatuses:
            metrics?.listingStatuses ?? createListingStatusCounts(),
          viewCount: views,
          saveCount: metrics?.saves ?? 0,
          inquiryCount: inquiries,
          reportCount: metrics?.reports ?? 0,
          boostCount: metrics?.boosts ?? 0,
          revenue: metrics?.revenue ?? 0,
          averageRating: metrics?.averageRating ?? null,
          ratingCount: metrics?.ratingCount ?? 0,
          reviewCount: metrics?.reviewCount ?? 0,
          inquiryConversionRate: this.toPercent(inquiries, views),
        };
      })
      .sort(
        (first, second) =>
          second.activeListings - first.activeListings ||
          second.viewCount - first.viewCount ||
          second.revenue - first.revenue ||
          first.displayName.localeCompare(second.displayName),
      );

    return {
      generatedAt: new Date(),
      range: {
        from,
        to,
        days: Math.max(
          1,
          Math.ceil((to.getTime() - from.getTime()) / oneDayMs),
        ),
      },
      overview: {
        totalSellers,
        activeSellers,
        inactiveSellers: Math.max(totalSellers - activeSellers, 0),
        newSellers,
        newSellersDelta: newSellers - previousNewSellers,
        verifiedSellers,
        unverifiedSellers: Math.max(totalSellers - verifiedSellers, 0),
        tieredSellers:
          totalSellers - (tierCounts[SellerPriorityTier.NONE] ?? 0),
      },
      tiers: tierCounts,
      sellers: sellerRows.slice(0, take),
    };
  }

  async getTopSellersReport(query: QueryTopSellersReportDto) {
    const { from, to } = this.resolveMonitoringRange(query);
    const take = query.take ?? 100;
    const rangeWhere = { gte: from, lte: to };
    const sellers = await this.prisma.user.findMany({
      where: { listings: { some: {} } },
      select: {
        id: true,
        email: true,
        displayName: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        sellerPriorityTier: true,
        reputationScore: true,
        createdAt: true,
      },
      orderBy: [{ displayName: 'asc' }],
    });
    const sellerIds = sellers.map((seller) => seller.id);
    const sellerMetrics = new Map(
      sellers.map((seller) => [
        seller.id,
        {
          listingStatuses: createListingStatusCounts(),
          totalListings: 0,
          activeListings: 0,
          newListings: 0,
          paidListings: 0,
          soldListings: 0,
          views: 0,
          saves: 0,
          inquiries: 0,
          reports: 0,
          boosts: 0,
          revenue: 0,
          boostRevenue: 0,
          listingFeeRevenue: 0,
          averageRating: null as number | null,
          ratingCount: 0,
          reviewCount: 0,
        },
      ]),
    );

    if (sellerIds.length) {
      const listings = await this.prisma.listing.findMany({
        where: { sellerId: { in: sellerIds } },
        select: {
          id: true,
          sellerId: true,
          status: true,
          listingPaymentMode: true,
          paidPriorityEnabled: true,
          createdAt: true,
        },
      });
      const listingIds = listings.map((listing) => listing.id);
      const listingToSeller = new Map(
        listings.map((listing) => [listing.id, listing.sellerId]),
      );
      const [
        viewRows,
        saveRows,
        conversations,
        reportRows,
        boostRows,
        revenueRows,
        revenueTypeRows,
        ratingRows,
        reviewRows,
      ] = await Promise.all([
        listingIds.length
          ? this.prisma.listingView.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, viewedAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.savedListing.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.conversation.findMany({
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              select: { listingId: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.listingReport.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.boost.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        this.prisma.transaction.groupBy({
          by: ['userId'],
          where: {
            userId: { in: sellerIds },
            status: TransactionStatus.SUCCEEDED,
            createdAt: rangeWhere,
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.groupBy({
          by: ['userId', 'type'],
          where: {
            userId: { in: sellerIds },
            status: TransactionStatus.SUCCEEDED,
            type: {
              in: [TransactionType.BOOST_PURCHASE, TransactionType.LISTING_FEE],
            },
            createdAt: rangeWhere,
          },
          _sum: { amount: true },
        }),
        this.prisma.sellerRating.groupBy({
          by: ['sellerId'],
          where: { sellerId: { in: sellerIds } },
          _avg: { stars: true },
          _count: { _all: true },
        }),
        this.prisma.sellerRating.groupBy({
          by: ['sellerId'],
          where: {
            sellerId: { in: sellerIds },
            review: { not: null },
            reviewStatus: SellerReviewStatus.APPROVED,
          },
          _count: { _all: true },
        }),
      ]);

      for (const listing of listings) {
        const metrics = sellerMetrics.get(listing.sellerId);

        if (!metrics) {
          continue;
        }

        metrics.totalListings += 1;
        metrics.listingStatuses[listing.status] += 1;

        if (listing.status === ListingStatus.ACTIVE) {
          metrics.activeListings += 1;
        }

        if (listing.status === ListingStatus.SOLD) {
          metrics.soldListings += 1;
        }

        if (listing.createdAt >= from && listing.createdAt <= to) {
          metrics.newListings += 1;
        }

        if (
          listing.listingPaymentMode === 'PAID' ||
          listing.paidPriorityEnabled
        ) {
          metrics.paidListings += 1;
        }
      }

      for (const row of viewRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? sellerMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.views += row._count._all;
        }
      }

      for (const row of saveRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? sellerMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.saves += row._count._all;
        }
      }

      for (const conversation of conversations) {
        if (!conversation.listingId) {
          continue;
        }

        const sellerId = listingToSeller.get(conversation.listingId);
        const metrics = sellerId ? sellerMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.inquiries += 1;
        }
      }

      for (const row of reportRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? sellerMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.reports += row._count._all;
        }
      }

      for (const row of boostRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? sellerMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.boosts += row._count._all;
        }
      }

      for (const row of revenueRows) {
        const metrics = sellerMetrics.get(row.userId);

        if (metrics) {
          metrics.revenue = toNumber(row._sum.amount);
        }
      }

      for (const row of revenueTypeRows) {
        const metrics = sellerMetrics.get(row.userId);

        if (!metrics) {
          continue;
        }

        if (row.type === TransactionType.BOOST_PURCHASE) {
          metrics.boostRevenue = toNumber(row._sum.amount);
        }

        if (row.type === TransactionType.LISTING_FEE) {
          metrics.listingFeeRevenue = toNumber(row._sum.amount);
        }
      }

      for (const row of ratingRows) {
        const metrics = sellerMetrics.get(row.sellerId);

        if (metrics) {
          metrics.averageRating =
            row._avg.stars == null ? null : Number(row._avg.stars.toFixed(1));
          metrics.ratingCount = row._count._all;
        }
      }

      for (const row of reviewRows) {
        const metrics = sellerMetrics.get(row.sellerId);

        if (metrics) {
          metrics.reviewCount = row._count._all;
        }
      }
    }

    const rows = sellers
      .map((seller) => {
        const metrics = sellerMetrics.get(seller.id);
        const views = metrics?.views ?? 0;
        const inquiries = metrics?.inquiries ?? 0;
        const revenue = metrics?.revenue ?? 0;
        const averageRating = metrics?.averageRating ?? null;
        const ratingScore = averageRating
          ? averageRating * (metrics?.ratingCount ?? 0)
          : 0;
        const performanceScore = Number(
          (
            revenue * 2 +
            views * 0.5 +
            inquiries * 25 +
            (metrics?.saves ?? 0) * 5 +
            (metrics?.activeListings ?? 0) * 30 +
            (metrics?.soldListings ?? 0) * 20 +
            (metrics?.boosts ?? 0) * 10 +
            ratingScore * 5 -
            (metrics?.reports ?? 0) * 25 +
            seller.reputationScore * 0.5
          ).toFixed(1),
        );

        return {
          id: seller.id,
          displayName: seller.displayName,
          email: seller.email,
          phone: seller.phone,
          emailVerified: seller.emailVerified,
          phoneVerified: seller.phoneVerified,
          sellerPriorityTier: seller.sellerPriorityTier,
          reputationScore: seller.reputationScore,
          createdAt: seller.createdAt,
          totalListings: metrics?.totalListings ?? 0,
          activeListings: metrics?.activeListings ?? 0,
          newListings: metrics?.newListings ?? 0,
          paidListings: metrics?.paidListings ?? 0,
          soldListings: metrics?.soldListings ?? 0,
          listingStatuses:
            metrics?.listingStatuses ?? createListingStatusCounts(),
          viewCount: views,
          saveCount: metrics?.saves ?? 0,
          inquiryCount: inquiries,
          reportCount: metrics?.reports ?? 0,
          boostCount: metrics?.boosts ?? 0,
          revenue,
          boostRevenue: metrics?.boostRevenue ?? 0,
          listingFeeRevenue: metrics?.listingFeeRevenue ?? 0,
          averageRating,
          ratingCount: metrics?.ratingCount ?? 0,
          reviewCount: metrics?.reviewCount ?? 0,
          inquiryConversionRate: this.toPercent(inquiries, views),
          performanceScore,
        };
      })
      .sort(
        (first, second) =>
          second.performanceScore - first.performanceScore ||
          second.revenue - first.revenue ||
          second.inquiryCount - first.inquiryCount ||
          second.viewCount - first.viewCount ||
          first.displayName.localeCompare(second.displayName),
      )
      .map((seller, index) => ({
        ...seller,
        rank: index + 1,
      }));
    const topRows = rows.slice(0, take);
    const totalRevenue = rows.reduce((sum, seller) => sum + seller.revenue, 0);
    const totalViews = rows.reduce((sum, seller) => sum + seller.viewCount, 0);
    const totalInquiries = rows.reduce(
      (sum, seller) => sum + seller.inquiryCount,
      0,
    );
    const activeTopSellers = rows.filter(
      (seller) => seller.activeListings > 0,
    ).length;
    const scoredSellers = rows.filter((seller) => seller.performanceScore > 0);

    return {
      generatedAt: new Date(),
      range: {
        from,
        to,
        days: Math.max(
          1,
          Math.ceil((to.getTime() - from.getTime()) / oneDayMs),
        ),
      },
      overview: {
        rankedSellers: rows.length,
        activeTopSellers,
        totalRevenue,
        totalViews,
        totalInquiries,
        averagePerformanceScore: scoredSellers.length
          ? Number(
              (
                scoredSellers.reduce(
                  (sum, seller) => sum + seller.performanceScore,
                  0,
                ) / scoredSellers.length
              ).toFixed(1),
            )
          : 0,
        topSeller: topRows[0] ?? null,
      },
      leaders: {
        revenue:
          [...rows].sort(
            (first, second) =>
              second.revenue - first.revenue ||
              first.displayName.localeCompare(second.displayName),
          )[0] ?? null,
        engagement:
          [...rows].sort(
            (first, second) =>
              second.viewCount +
                second.inquiryCount * 10 -
                (first.viewCount + first.inquiryCount * 10) ||
              first.displayName.localeCompare(second.displayName),
          )[0] ?? null,
        conversion:
          [...rows]
            .filter((seller) => seller.viewCount > 0)
            .sort(
              (first, second) =>
                second.inquiryConversionRate - first.inquiryConversionRate ||
                first.displayName.localeCompare(second.displayName),
            )[0] ?? null,
        rating:
          [...rows]
            .filter((seller) => seller.ratingCount > 0)
            .sort(
              (first, second) =>
                (second.averageRating ?? 0) - (first.averageRating ?? 0) ||
                second.ratingCount - first.ratingCount ||
                first.displayName.localeCompare(second.displayName),
            )[0] ?? null,
      },
      sellers: topRows,
    };
  }

  async getPendingSellerApprovals(query: QueryPendingSellerApprovalsDto) {
    const { from, to } = this.resolveMonitoringRange(query);
    const take = query.take ?? 100;
    const rangeWhere = { gte: from, lte: to };
    const pendingSellerWhere = {
      sellerPriorityTier: SellerPriorityTier.NONE,
      listings: { some: {} },
    } satisfies Prisma.UserWhereInput;
    const [pendingApprovalCount, verifiedPendingCount, candidates] =
      await Promise.all([
        this.prisma.user.count({ where: pendingSellerWhere }),
        this.prisma.user.count({
          where: {
            ...pendingSellerWhere,
            OR: [{ emailVerified: true }, { phoneVerified: true }],
          },
        }),
        this.prisma.user.findMany({
          where: pendingSellerWhere,
          select: {
            id: true,
            email: true,
            displayName: true,
            phone: true,
            emailVerified: true,
            phoneVerified: true,
            reputationScore: true,
            createdAt: true,
            listings: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        }),
      ]);
    const sellerIds = candidates.map((seller) => seller.id);
    const candidateMetrics = new Map(
      candidates.map((seller) => [
        seller.id,
        {
          listingStatuses: createListingStatusCounts(),
          totalListings: 0,
          activeListings: 0,
          pendingListings: 0,
          newListings: 0,
          views: 0,
          saves: 0,
          inquiries: 0,
          reports: 0,
          boosts: 0,
          revenue: 0,
          averageRating: null as number | null,
          ratingCount: 0,
          reviewCount: 0,
          firstListingAt: null as Date | null,
          latestListingAt: null as Date | null,
        },
      ]),
    );

    if (sellerIds.length) {
      const listings = await this.prisma.listing.findMany({
        where: { sellerId: { in: sellerIds } },
        select: {
          id: true,
          sellerId: true,
          status: true,
          createdAt: true,
        },
      });
      const listingIds = listings.map((listing) => listing.id);
      const listingToSeller = new Map(
        listings.map((listing) => [listing.id, listing.sellerId]),
      );
      const [
        viewRows,
        saveRows,
        conversations,
        reportRows,
        boostRows,
        revenueRows,
        ratingRows,
        reviewRows,
      ] = await Promise.all([
        listingIds.length
          ? this.prisma.listingView.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, viewedAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.savedListing.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.conversation.findMany({
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              select: { listingId: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.listingReport.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.boost.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds }, createdAt: rangeWhere },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        this.prisma.transaction.groupBy({
          by: ['userId'],
          where: {
            userId: { in: sellerIds },
            status: TransactionStatus.SUCCEEDED,
            createdAt: rangeWhere,
          },
          _sum: { amount: true },
        }),
        this.prisma.sellerRating.groupBy({
          by: ['sellerId'],
          where: { sellerId: { in: sellerIds } },
          _avg: { stars: true },
          _count: { _all: true },
        }),
        this.prisma.sellerRating.groupBy({
          by: ['sellerId'],
          where: {
            sellerId: { in: sellerIds },
            review: { not: null },
            reviewStatus: SellerReviewStatus.APPROVED,
          },
          _count: { _all: true },
        }),
      ]);

      for (const listing of listings) {
        const metrics = candidateMetrics.get(listing.sellerId);

        if (!metrics) {
          continue;
        }

        metrics.totalListings += 1;
        metrics.listingStatuses[listing.status] += 1;
        metrics.firstListingAt =
          !metrics.firstListingAt || listing.createdAt < metrics.firstListingAt
            ? listing.createdAt
            : metrics.firstListingAt;
        metrics.latestListingAt =
          !metrics.latestListingAt ||
          listing.createdAt > metrics.latestListingAt
            ? listing.createdAt
            : metrics.latestListingAt;

        if (listing.status === ListingStatus.ACTIVE) {
          metrics.activeListings += 1;
        }

        if (listing.status === ListingStatus.PENDING) {
          metrics.pendingListings += 1;
        }

        if (listing.createdAt >= from && listing.createdAt <= to) {
          metrics.newListings += 1;
        }
      }

      for (const row of viewRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? candidateMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.views += row._count._all;
        }
      }

      for (const row of saveRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? candidateMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.saves += row._count._all;
        }
      }

      for (const conversation of conversations) {
        if (!conversation.listingId) {
          continue;
        }

        const sellerId = listingToSeller.get(conversation.listingId);
        const metrics = sellerId ? candidateMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.inquiries += 1;
        }
      }

      for (const row of reportRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? candidateMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.reports += row._count._all;
        }
      }

      for (const row of boostRows) {
        const sellerId = listingToSeller.get(row.listingId);
        const metrics = sellerId ? candidateMetrics.get(sellerId) : undefined;

        if (metrics) {
          metrics.boosts += row._count._all;
        }
      }

      for (const row of revenueRows) {
        const metrics = candidateMetrics.get(row.userId);

        if (metrics) {
          metrics.revenue = toNumber(row._sum.amount);
        }
      }

      for (const row of ratingRows) {
        const metrics = candidateMetrics.get(row.sellerId);

        if (metrics) {
          metrics.averageRating =
            row._avg.stars == null ? null : Number(row._avg.stars.toFixed(1));
          metrics.ratingCount = row._count._all;
        }
      }

      for (const row of reviewRows) {
        const metrics = candidateMetrics.get(row.sellerId);

        if (metrics) {
          metrics.reviewCount = row._count._all;
        }
      }
    }

    const approvalRows = candidates
      .map((seller) => {
        const metrics = candidateMetrics.get(seller.id);
        const views = metrics?.views ?? 0;
        const inquiries = metrics?.inquiries ?? 0;
        const verifiedContact = seller.emailVerified || seller.phoneVerified;

        return {
          id: seller.id,
          displayName: seller.displayName,
          email: seller.email,
          phone: seller.phone,
          emailVerified: seller.emailVerified,
          phoneVerified: seller.phoneVerified,
          verifiedContact,
          reputationScore: seller.reputationScore,
          createdAt: seller.createdAt,
          firstListingAt: metrics?.firstListingAt,
          latestListingAt: metrics?.latestListingAt,
          totalListings: metrics?.totalListings ?? 0,
          activeListings: metrics?.activeListings ?? 0,
          pendingListings: metrics?.pendingListings ?? 0,
          newListings: metrics?.newListings ?? 0,
          listingStatuses:
            metrics?.listingStatuses ?? createListingStatusCounts(),
          viewCount: views,
          saveCount: metrics?.saves ?? 0,
          inquiryCount: inquiries,
          reportCount: metrics?.reports ?? 0,
          boostCount: metrics?.boosts ?? 0,
          revenue: metrics?.revenue ?? 0,
          averageRating: metrics?.averageRating ?? null,
          ratingCount: metrics?.ratingCount ?? 0,
          reviewCount: metrics?.reviewCount ?? 0,
          inquiryConversionRate: this.toPercent(inquiries, views),
          latestListing: seller.listings[0]
            ? {
                id: seller.listings[0].id,
                title: seller.listings[0].title,
                status: seller.listings[0].status,
                createdAt: seller.listings[0].createdAt,
                categoryName: seller.listings[0].category?.name ?? null,
              }
            : null,
        };
      })
      .sort(
        (first, second) =>
          Number(second.verifiedContact) - Number(first.verifiedContact) ||
          second.activeListings - first.activeListings ||
          second.viewCount - first.viewCount ||
          first.createdAt.getTime() - second.createdAt.getTime(),
      );
    const highSignalApprovals = approvalRows.filter(
      (seller) =>
        seller.verifiedContact &&
        (seller.activeListings > 0 ||
          seller.ratingCount > 0 ||
          seller.viewCount > 0 ||
          seller.revenue > 0),
    ).length;

    return {
      generatedAt: new Date(),
      range: {
        from,
        to,
        days: Math.max(
          1,
          Math.ceil((to.getTime() - from.getTime()) / oneDayMs),
        ),
      },
      overview: {
        pendingApprovals: pendingApprovalCount,
        verifiedPending: verifiedPendingCount,
        needsContactVerification: Math.max(
          pendingApprovalCount - verifiedPendingCount,
          0,
        ),
        activePending: approvalRows.filter(
          (seller) => seller.activeListings > 0,
        ).length,
        highSignalApprovals,
      },
      approvals: approvalRows.slice(0, take),
    };
  }

  async getActiveListingsReport(query: QueryActiveListingsReportDto) {
    const { from, to } = this.resolveMonitoringRange(query);
    const take = query.take ?? 100;
    const now = new Date();
    const rangeWhere = { gte: from, lte: to };
    const activeListingWhere = { status: ListingStatus.ACTIVE };
    const [
      activeListings,
      boostedListings,
      paidListings,
      manuallyPromotedListings,
      pinnedListings,
      listings,
    ] = await Promise.all([
      this.prisma.listing.count({ where: activeListingWhere }),
      this.prisma.listing.count({
        where: {
          ...activeListingWhere,
          boosts: {
            some: {
              status: BoostStatus.ACTIVE,
              startsAt: { lte: now },
              endsAt: { gt: now },
            },
          },
        },
      }),
      this.prisma.listing.count({
        where: {
          ...activeListingWhere,
          OR: [{ listingPaymentMode: 'PAID' }, { paidPriorityEnabled: true }],
        },
      }),
      this.prisma.listing.count({
        where: {
          ...activeListingWhere,
          adminPriorityPromoted: true,
        },
      }),
      this.prisma.listing.count({
        where: {
          ...activeListingWhere,
          adminPriorityPinned: true,
        },
      }),
      this.prisma.listing.findMany({
        where: activeListingWhere,
        select: {
          id: true,
          title: true,
          price: true,
          currency: true,
          location: true,
          createdAt: true,
          updatedAt: true,
          listingPaymentMode: true,
          paidPriorityEnabled: true,
          adminPriorityPromoted: true,
          adminPriorityPinned: true,
          adminPriorityScore: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          sellerId: true,
          seller: {
            select: {
              id: true,
              displayName: true,
              email: true,
              phoneVerified: true,
              emailVerified: true,
              sellerPriorityTier: true,
              reputationScore: true,
            },
          },
          boosts: {
            where: {
              status: BoostStatus.ACTIVE,
              startsAt: { lte: now },
              endsAt: { gt: now },
            },
            select: {
              id: true,
              placement: true,
              startsAt: true,
              endsAt: true,
            },
          },
          _count: {
            select: {
              views: true,
              savedBy: true,
              conversations: true,
              reports: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);
    const listingIds = listings.map((listing) => listing.id);
    const listingMetrics = new Map(
      listings.map((listing) => [
        listing.id,
        {
          views: 0,
          saves: 0,
          inquiries: 0,
          reports: 0,
          boosts: 0,
        },
      ]),
    );

    if (listingIds.length) {
      const [viewRows, saveRows, conversations, reportRows, boostRows] =
        await Promise.all([
          this.prisma.listingView.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, viewedAt: rangeWhere },
            _count: { _all: true },
          }),
          this.prisma.savedListing.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            _count: { _all: true },
          }),
          this.prisma.conversation.findMany({
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            select: { listingId: true },
          }),
          this.prisma.listingReport.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            _count: { _all: true },
          }),
          this.prisma.boost.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            _count: { _all: true },
          }),
        ]);

      for (const row of viewRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.views = row._count._all;
        }
      }

      for (const row of saveRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.saves = row._count._all;
        }
      }

      for (const conversation of conversations) {
        if (!conversation.listingId) {
          continue;
        }

        const metrics = listingMetrics.get(conversation.listingId);

        if (metrics) {
          metrics.inquiries += 1;
        }
      }

      for (const row of reportRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.reports = row._count._all;
        }
      }

      for (const row of boostRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.boosts = row._count._all;
        }
      }
    }

    const categoryCounts = new Map<
      string,
      { id: string; name: string; slug: string; activeListings: number }
    >();
    const sellerIds = new Set<string>();
    let totalViews = 0;
    let totalSaves = 0;
    let totalInquiries = 0;
    let totalReports = 0;
    let totalBoosts = 0;
    let noRecentViews = 0;

    const rows = listings
      .map((listing) => {
        const metrics = listingMetrics.get(listing.id) ?? {
          views: 0,
          saves: 0,
          inquiries: 0,
          reports: 0,
          boosts: 0,
        };
        const category = categoryCounts.get(listing.category.id) ?? {
          id: listing.category.id,
          name: listing.category.name,
          slug: listing.category.slug,
          activeListings: 0,
        };

        category.activeListings += 1;
        categoryCounts.set(category.id, category);
        sellerIds.add(listing.sellerId);
        totalViews += metrics.views;
        totalSaves += metrics.saves;
        totalInquiries += metrics.inquiries;
        totalReports += metrics.reports;
        totalBoosts += metrics.boosts;

        if (metrics.views === 0) {
          noRecentViews += 1;
        }

        return {
          id: listing.id,
          title: listing.title,
          price: Number(listing.price),
          currency: listing.currency,
          location: listing.location,
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
          category: listing.category,
          seller: listing.seller,
          sellerId: listing.sellerId,
          listingPaymentMode: listing.listingPaymentMode,
          paidPriorityEnabled: listing.paidPriorityEnabled,
          adminPriorityPromoted: listing.adminPriorityPromoted,
          adminPriorityPinned: listing.adminPriorityPinned,
          adminPriorityScore: listing.adminPriorityScore,
          activeBoostCount: listing.boosts.length,
          activeBoostPlacements: listing.boosts.map((boost) => boost.placement),
          nextBoostEndsAt:
            listing.boosts
              .map((boost) => boost.endsAt)
              .sort((first, second) => first.getTime() - second.getTime())[0] ??
            null,
          viewCount: metrics.views,
          saveCount: metrics.saves,
          inquiryCount: metrics.inquiries,
          reportCount: metrics.reports,
          boostCount: metrics.boosts,
          lifetimeViewCount: listing._count.views,
          lifetimeSaveCount: listing._count.savedBy,
          lifetimeInquiryCount: listing._count.conversations,
          lifetimeReportCount: listing._count.reports,
          inquiryConversionRate: this.toPercent(
            metrics.inquiries,
            metrics.views,
          ),
        };
      })
      .sort(
        (first, second) =>
          second.viewCount - first.viewCount ||
          second.inquiryCount - first.inquiryCount ||
          second.activeBoostCount - first.activeBoostCount ||
          first.title.localeCompare(second.title),
      );

    return {
      generatedAt: new Date(),
      range: {
        from,
        to,
        days: Math.max(
          1,
          Math.ceil((to.getTime() - from.getTime()) / oneDayMs),
        ),
      },
      overview: {
        activeListings,
        boostedListings,
        paidListings,
        manuallyPromotedListings,
        pinnedListings,
        categoriesRepresented: categoryCounts.size,
        sellersRepresented: sellerIds.size,
        noRecentViews,
        reportedListings: rows.filter((listing) => listing.reportCount > 0)
          .length,
      },
      engagement: {
        views: totalViews,
        saves: totalSaves,
        inquiries: totalInquiries,
        reports: totalReports,
        boosts: totalBoosts,
        inquiryConversionRate: this.toPercent(totalInquiries, totalViews),
        averageViewsPerListing: activeListings
          ? Number((totalViews / activeListings).toFixed(1))
          : 0,
      },
      categories: [...categoryCounts.values()].sort(
        (first, second) =>
          second.activeListings - first.activeListings ||
          first.name.localeCompare(second.name),
      ),
      listings: rows.slice(0, take),
    };
  }

  async getPaidListingsReport(query: QueryPaidListingsReportDto) {
    const { from, to } = this.resolveMonitoringRange(query);
    const take = query.take ?? 100;
    const now = new Date();
    const rangeWhere = { gte: from, lte: to };
    const paidListingWhere = {
      OR: [
        { listingPaymentMode: ListingPaymentMode.PAID },
        { paidPriorityEnabled: true },
        {
          transactions: {
            some: {
              type: TransactionType.LISTING_FEE,
              status: TransactionStatus.SUCCEEDED,
            },
          },
        },
      ],
    } satisfies Prisma.ListingWhereInput;
    const activeBoostFilter = {
      status: BoostStatus.ACTIVE,
      startsAt: { lte: now },
      endsAt: { gt: now },
    } satisfies Prisma.BoostWhereInput;
    const [
      paidListings,
      activePaidListings,
      pendingPaidListings,
      paidPriorityListings,
      paidFeeListings,
      boostedPaidListings,
      reportedPaidListings,
      paymentStatusRows,
      listings,
    ] = await Promise.all([
      this.prisma.listing.count({ where: paidListingWhere }),
      this.prisma.listing.count({
        where: {
          ...paidListingWhere,
          status: ListingStatus.ACTIVE,
        },
      }),
      this.prisma.listing.count({
        where: {
          ...paidListingWhere,
          status: ListingStatus.PENDING,
        },
      }),
      this.prisma.listing.count({
        where: {
          ...paidListingWhere,
          paidPriorityEnabled: true,
        },
      }),
      this.prisma.listing.count({
        where: {
          OR: [
            { listingPaymentMode: ListingPaymentMode.PAID },
            {
              transactions: {
                some: {
                  type: TransactionType.LISTING_FEE,
                  status: TransactionStatus.SUCCEEDED,
                },
              },
            },
          ],
        },
      }),
      this.prisma.listing.count({
        where: {
          ...paidListingWhere,
          boosts: {
            some: activeBoostFilter,
          },
        },
      }),
      this.prisma.listing.count({
        where: {
          ...paidListingWhere,
          reports: {
            some: {
              createdAt: rangeWhere,
            },
          },
        },
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        where: {
          type: TransactionType.LISTING_FEE,
          createdAt: rangeWhere,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.listing.findMany({
        where: paidListingWhere,
        select: {
          id: true,
          title: true,
          status: true,
          price: true,
          currency: true,
          location: true,
          createdAt: true,
          updatedAt: true,
          listingPaymentMode: true,
          paidPriorityEnabled: true,
          adminPriorityPromoted: true,
          adminPriorityPinned: true,
          adminPriorityScore: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          sellerId: true,
          seller: {
            select: {
              id: true,
              displayName: true,
              email: true,
              phoneVerified: true,
              emailVerified: true,
              sellerPriorityTier: true,
              reputationScore: true,
            },
          },
          transactions: {
            where: {
              type: TransactionType.LISTING_FEE,
            },
            select: {
              id: true,
              status: true,
              amount: true,
              currency: true,
              provider: true,
              providerRef: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          boosts: {
            where: activeBoostFilter,
            select: {
              id: true,
              placement: true,
              startsAt: true,
              endsAt: true,
            },
          },
          _count: {
            select: {
              views: true,
              savedBy: true,
              conversations: true,
              reports: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);
    const paymentCounts = statusCounts(
      Object.values(TransactionStatus),
      paymentStatusRows,
    );
    const paymentSums = Object.fromEntries(
      Object.values(TransactionStatus).map((status) => [status, 0]),
    ) as Record<TransactionStatus, number>;

    for (const row of paymentStatusRows) {
      paymentSums[row.status] = toNumber(row._sum?.amount);
    }

    const listingIds = listings.map((listing) => listing.id);
    const listingMetrics = new Map(
      listings.map((listing) => [
        listing.id,
        {
          views: 0,
          saves: 0,
          inquiries: 0,
          reports: 0,
          boosts: 0,
        },
      ]),
    );

    if (listingIds.length) {
      const [viewRows, saveRows, conversations, reportRows, boostRows] =
        await Promise.all([
          this.prisma.listingView.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, viewedAt: rangeWhere },
            _count: { _all: true },
          }),
          this.prisma.savedListing.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            _count: { _all: true },
          }),
          this.prisma.conversation.findMany({
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            select: { listingId: true },
          }),
          this.prisma.listingReport.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            _count: { _all: true },
          }),
          this.prisma.boost.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            _count: { _all: true },
          }),
        ]);

      for (const row of viewRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.views = row._count._all;
        }
      }

      for (const row of saveRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.saves = row._count._all;
        }
      }

      for (const conversation of conversations) {
        if (!conversation.listingId) {
          continue;
        }

        const metrics = listingMetrics.get(conversation.listingId);

        if (metrics) {
          metrics.inquiries += 1;
        }
      }

      for (const row of reportRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.reports = row._count._all;
        }
      }

      for (const row of boostRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.boosts = row._count._all;
        }
      }
    }

    const categoryCounts = new Map<
      string,
      { id: string; name: string; slug: string; paidListings: number }
    >();
    const sellerIds = new Set<string>();
    let totalViews = 0;
    let totalSaves = 0;
    let totalInquiries = 0;
    let totalReports = 0;
    let totalBoosts = 0;

    const rows = listings
      .map((listing) => {
        const metrics = listingMetrics.get(listing.id) ?? {
          views: 0,
          saves: 0,
          inquiries: 0,
          reports: 0,
          boosts: 0,
        };
        const category = categoryCounts.get(listing.category.id) ?? {
          id: listing.category.id,
          name: listing.category.name,
          slug: listing.category.slug,
          paidListings: 0,
        };
        const paymentRevenue = listing.transactions
          .filter(
            (transaction) => transaction.status === TransactionStatus.SUCCEEDED,
          )
          .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
        const pendingAmount = listing.transactions
          .filter(
            (transaction) => transaction.status === TransactionStatus.PENDING,
          )
          .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
        const refundedAmount = listing.transactions
          .filter(
            (transaction) => transaction.status === TransactionStatus.REFUNDED,
          )
          .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
        const latestPayment = listing.transactions[0] ?? null;

        category.paidListings += 1;
        categoryCounts.set(category.id, category);
        sellerIds.add(listing.sellerId);
        totalViews += metrics.views;
        totalSaves += metrics.saves;
        totalInquiries += metrics.inquiries;
        totalReports += metrics.reports;
        totalBoosts += metrics.boosts;

        return {
          id: listing.id,
          title: listing.title,
          status: listing.status,
          price: Number(listing.price),
          currency: listing.currency,
          location: listing.location,
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
          category: listing.category,
          seller: listing.seller,
          sellerId: listing.sellerId,
          listingPaymentMode: listing.listingPaymentMode,
          paidPriorityEnabled: listing.paidPriorityEnabled,
          adminPriorityPromoted: listing.adminPriorityPromoted,
          adminPriorityPinned: listing.adminPriorityPinned,
          adminPriorityScore: listing.adminPriorityScore,
          paymentStatus: latestPayment?.status ?? null,
          paymentRevenue,
          pendingAmount,
          refundedAmount,
          latestPaymentAt: latestPayment?.createdAt ?? null,
          paymentTransactionCount: listing.transactions.length,
          transactions: listing.transactions.map((transaction) => ({
            id: transaction.id,
            status: transaction.status,
            amount: toNumber(transaction.amount),
            currency: transaction.currency,
            provider: transaction.provider,
            providerRef: transaction.providerRef,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt,
          })),
          activeBoostCount: listing.boosts.length,
          activeBoostPlacements: listing.boosts.map((boost) => boost.placement),
          nextBoostEndsAt:
            listing.boosts
              .map((boost) => boost.endsAt)
              .sort((first, second) => first.getTime() - second.getTime())[0] ??
            null,
          viewCount: metrics.views,
          saveCount: metrics.saves,
          inquiryCount: metrics.inquiries,
          reportCount: metrics.reports,
          boostCount: metrics.boosts,
          lifetimeViewCount: listing._count.views,
          lifetimeSaveCount: listing._count.savedBy,
          lifetimeInquiryCount: listing._count.conversations,
          lifetimeReportCount: listing._count.reports,
          inquiryConversionRate: this.toPercent(
            metrics.inquiries,
            metrics.views,
          ),
        };
      })
      .sort(
        (first, second) =>
          second.paymentRevenue - first.paymentRevenue ||
          second.viewCount - first.viewCount ||
          second.inquiryCount - first.inquiryCount ||
          first.title.localeCompare(second.title),
      );

    const totalPayments = Object.values(paymentCounts).reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      generatedAt: new Date(),
      range: {
        from,
        to,
        days: Math.max(
          1,
          Math.ceil((to.getTime() - from.getTime()) / oneDayMs),
        ),
      },
      overview: {
        paidListings,
        activePaidListings,
        pendingPaidListings,
        paidPriorityListings,
        paidFeeListings,
        boostedPaidListings,
        reportedPaidListings,
        categoriesRepresented: categoryCounts.size,
        sellersRepresented: sellerIds.size,
      },
      commerce: {
        revenue: paymentSums.SUCCEEDED,
        pendingRevenue: paymentSums.PENDING,
        refundedRevenue: paymentSums.REFUNDED,
        successfulPayments: paymentCounts.SUCCEEDED,
        pendingPayments: paymentCounts.PENDING,
        failedPayments: paymentCounts.FAILED,
        refundedPayments: paymentCounts.REFUNDED,
        cancelledPayments: paymentCounts.CANCELLED,
        paymentConversionRate: this.toPercent(
          paymentCounts.SUCCEEDED,
          totalPayments,
        ),
      },
      engagement: {
        views: totalViews,
        saves: totalSaves,
        inquiries: totalInquiries,
        reports: totalReports,
        boosts: totalBoosts,
        inquiryConversionRate: this.toPercent(totalInquiries, totalViews),
        averageViewsPerListing: paidListings
          ? Number((totalViews / paidListings).toFixed(1))
          : 0,
      },
      paymentStatuses: paymentCounts,
      categories: [...categoryCounts.values()].sort(
        (first, second) =>
          second.paidListings - first.paidListings ||
          first.name.localeCompare(second.name),
      ),
      listings: rows.slice(0, take),
    };
  }

  async getWalletPaymentsReport(query: QueryWalletPaymentsReportDto) {
    const { from, to } = this.resolveMonitoringRange(query);
    const take = query.take ?? 100;
    const rangeWhere = { gte: from, lte: to };
    const [
      totalWallets,
      fundedWallets,
      emptyWallets,
      balanceAggregate,
      creditAggregate,
      debitAggregate,
      ledgerTypeRows,
      topUpStatusRows,
      walletPaymentStatusRows,
      wallets,
    ] = await Promise.all([
      this.prisma.walletAccount.count(),
      this.prisma.walletAccount.count({
        where: {
          balance: { gt: 0 },
        },
      }),
      this.prisma.walletAccount.count({
        where: {
          balance: 0,
        },
      }),
      this.prisma.walletAccount.aggregate({
        _sum: { balance: true },
        _avg: { balance: true },
      }),
      this.prisma.walletLedger.aggregate({
        where: {
          createdAt: rangeWhere,
          amount: { gt: 0 },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.walletLedger.aggregate({
        where: {
          createdAt: rangeWhere,
          amount: { lt: 0 },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.walletLedger.groupBy({
        by: ['type'],
        where: {
          createdAt: rangeWhere,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        where: {
          type: TransactionType.WALLET_TOP_UP,
          createdAt: rangeWhere,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        where: {
          provider: 'wallet',
          createdAt: rangeWhere,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.walletAccount.findMany({
        select: {
          id: true,
          userId: true,
          balance: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              phoneVerified: true,
              emailVerified: true,
              sellerPriorityTier: true,
              reputationScore: true,
            },
          },
          ledger: {
            where: {
              createdAt: rangeWhere,
            },
            select: {
              id: true,
              type: true,
              amount: true,
              currency: true,
              balanceAfter: true,
              createdAt: true,
              transaction: {
                select: {
                  id: true,
                  type: true,
                  status: true,
                  provider: true,
                  providerRef: true,
                  listing: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
        orderBy: [{ balance: 'desc' }, { updatedAt: 'desc' }],
        take,
      }),
    ]);
    const topUpCounts = statusCounts(
      Object.values(TransactionStatus),
      topUpStatusRows,
    );
    const walletPaymentCounts = statusCounts(
      Object.values(TransactionStatus),
      walletPaymentStatusRows,
    );
    const topUpSums = Object.fromEntries(
      Object.values(TransactionStatus).map((status) => [status, 0]),
    ) as Record<TransactionStatus, number>;
    const walletPaymentSums = Object.fromEntries(
      Object.values(TransactionStatus).map((status) => [status, 0]),
    ) as Record<TransactionStatus, number>;

    for (const row of topUpStatusRows) {
      topUpSums[row.status] = toNumber(row._sum?.amount);
    }

    for (const row of walletPaymentStatusRows) {
      walletPaymentSums[row.status] = toNumber(row._sum?.amount);
    }

    const movementByType = ledgerTypeRows
      .map((row) => ({
        type: row.type,
        count: row._count._all,
        amount: toNumber(row._sum.amount),
      }))
      .sort(
        (first, second) =>
          Math.abs(second.amount) - Math.abs(first.amount) ||
          first.type.localeCompare(second.type),
      );
    const creditAmount = toNumber(creditAggregate._sum.amount);
    const debitAmount = Math.abs(toNumber(debitAggregate._sum.amount));
    const totalTopUpPayments = Object.values(topUpCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const totalWalletPayments = Object.values(walletPaymentCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const walletRows = wallets.map((wallet) => {
      let creditTotal = 0;
      let debitTotal = 0;
      let netMovement = 0;

      for (const entry of wallet.ledger) {
        const amount = toNumber(entry.amount);
        netMovement += amount;

        if (amount > 0) {
          creditTotal += amount;
        } else {
          debitTotal += Math.abs(amount);
        }
      }

      const latestLedger = wallet.ledger[0] ?? null;

      return {
        id: wallet.id,
        userId: wallet.userId,
        user: wallet.user,
        balance: toNumber(wallet.balance),
        currency: wallet.currency,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
        creditTotal,
        debitTotal,
        netMovement,
        ledgerEntryCount: wallet.ledger.length,
        latestLedgerAt: latestLedger?.createdAt ?? null,
        latestLedgerType: latestLedger?.type ?? null,
        ledger: wallet.ledger.map((entry) => ({
          id: entry.id,
          type: entry.type,
          amount: toNumber(entry.amount),
          currency: entry.currency,
          balanceAfter: toNumber(entry.balanceAfter),
          createdAt: entry.createdAt,
          transaction: entry.transaction,
        })),
      };
    });

    return {
      generatedAt: new Date(),
      range: {
        from,
        to,
        days: Math.max(
          1,
          Math.ceil((to.getTime() - from.getTime()) / oneDayMs),
        ),
      },
      overview: {
        totalWallets,
        fundedWallets,
        emptyWallets,
        totalBalance: toNumber(balanceAggregate._sum.balance),
        averageBalance: Number(
          toNumber(balanceAggregate._avg.balance).toFixed(2),
        ),
        activeWallets: walletRows.filter(
          (wallet) => wallet.ledgerEntryCount > 0,
        ).length,
      },
      movement: {
        credits: creditAggregate._count._all,
        debits: debitAggregate._count._all,
        creditAmount,
        debitAmount,
        netMovement: creditAmount - debitAmount,
        byType: movementByType,
      },
      topUps: {
        requested: totalTopUpPayments,
        succeeded: topUpCounts.SUCCEEDED,
        pending: topUpCounts.PENDING,
        failed: topUpCounts.FAILED,
        cancelled: topUpCounts.CANCELLED,
        refunded: topUpCounts.REFUNDED,
        revenue: topUpSums.SUCCEEDED,
        pendingAmount: topUpSums.PENDING,
        conversionRate: this.toPercent(
          topUpCounts.SUCCEEDED,
          totalTopUpPayments,
        ),
        statuses: topUpCounts,
      },
      walletPayments: {
        total: totalWalletPayments,
        succeeded: walletPaymentCounts.SUCCEEDED,
        pending: walletPaymentCounts.PENDING,
        failed: walletPaymentCounts.FAILED,
        cancelled: walletPaymentCounts.CANCELLED,
        refunded: walletPaymentCounts.REFUNDED,
        spend: walletPaymentSums.SUCCEEDED,
        conversionRate: this.toPercent(
          walletPaymentCounts.SUCCEEDED,
          totalWalletPayments,
        ),
        statuses: walletPaymentCounts,
      },
      wallets: walletRows,
    };
  }

  async getCategoryIncomeReport(query: QueryCategoryIncomeReportDto) {
    const { from, to } = this.resolveMonitoringRange(query);
    const take = query.take ?? 100;
    const rangeWhere = { gte: from, lte: to };
    const incomeTypes = [
      TransactionType.LISTING_FEE,
      TransactionType.BOOST_PURCHASE,
    ];
    const incomeTransactionWhere = {
      type: { in: incomeTypes },
      listingId: { not: null },
      createdAt: rangeWhere,
    } satisfies Prisma.TransactionWhereInput;
    const [
      transactionStatusRows,
      transactionTypeRows,
      providerRevenueRows,
      listings,
    ] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['status'],
        where: incomeTransactionWhere,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          ...incomeTransactionWhere,
          status: TransactionStatus.SUCCEEDED,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['provider'],
        where: {
          ...incomeTransactionWhere,
          status: TransactionStatus.SUCCEEDED,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.listing.findMany({
        where: {
          transactions: {
            some: incomeTransactionWhere,
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          sellerId: true,
          listingPaymentMode: true,
          paidPriorityEnabled: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          seller: {
            select: {
              id: true,
              displayName: true,
              email: true,
              sellerPriorityTier: true,
              reputationScore: true,
            },
          },
          transactions: {
            where: incomeTransactionWhere,
            select: {
              id: true,
              type: true,
              status: true,
              amount: true,
              currency: true,
              provider: true,
              providerRef: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              views: true,
              savedBy: true,
              conversations: true,
              reports: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);
    const listingIds = listings.map((listing) => listing.id);
    const listingMetrics = new Map(
      listings.map((listing) => [
        listing.id,
        {
          views: 0,
          saves: 0,
          inquiries: 0,
          reports: 0,
        },
      ]),
    );

    if (listingIds.length) {
      const [viewRows, saveRows, conversations, reportRows] = await Promise.all(
        [
          this.prisma.listingView.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, viewedAt: rangeWhere },
            _count: { _all: true },
          }),
          this.prisma.savedListing.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            _count: { _all: true },
          }),
          this.prisma.conversation.findMany({
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            select: { listingId: true },
          }),
          this.prisma.listingReport.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds }, createdAt: rangeWhere },
            _count: { _all: true },
          }),
        ],
      );

      for (const row of viewRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.views = row._count._all;
        }
      }

      for (const row of saveRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.saves = row._count._all;
        }
      }

      for (const conversation of conversations) {
        if (!conversation.listingId) {
          continue;
        }

        const metrics = listingMetrics.get(conversation.listingId);

        if (metrics) {
          metrics.inquiries += 1;
        }
      }

      for (const row of reportRows) {
        const metrics = listingMetrics.get(row.listingId);

        if (metrics) {
          metrics.reports = row._count._all;
        }
      }
    }

    const transactionCounts = statusCounts(
      Object.values(TransactionStatus),
      transactionStatusRows,
    );
    const transactionSums = Object.fromEntries(
      Object.values(TransactionStatus).map((status) => [status, 0]),
    ) as Record<TransactionStatus, number>;

    for (const row of transactionStatusRows) {
      transactionSums[row.status] = toNumber(row._sum?.amount);
    }

    const revenueByType = Object.fromEntries(
      incomeTypes.map((type) => [
        type,
        {
          count: 0,
          revenue: 0,
        },
      ]),
    ) as Record<TransactionType, { count: number; revenue: number }>;

    for (const row of transactionTypeRows) {
      revenueByType[row.type] = {
        count: row._count._all,
        revenue: toNumber(row._sum.amount),
      };
    }

    const revenueByProvider = providerRevenueRows
      .map((row) => ({
        provider: row.provider ?? 'unknown',
        count: row._count._all,
        revenue: toNumber(row._sum.amount),
      }))
      .sort(
        (first, second) =>
          second.revenue - first.revenue ||
          first.provider.localeCompare(second.provider),
      );
    const categoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        listingCount: number;
        paidListings: number;
        boostedListings: number;
        activeListings: number;
        soldListings: number;
        sellerIds: Set<string>;
        transactionCount: number;
        successfulPayments: number;
        pendingPayments: number;
        failedPayments: number;
        refundedPayments: number;
        cancelledPayments: number;
        revenue: number;
        listingFeeRevenue: number;
        boostRevenue: number;
        walletRevenue: number;
        gatewayRevenue: number;
        pendingRevenue: number;
        refundedRevenue: number;
        viewCount: number;
        saveCount: number;
        inquiryCount: number;
        reportCount: number;
      }
    >();
    const topListings = listings.map((listing) => {
      const metrics = listingMetrics.get(listing.id) ?? {
        views: 0,
        saves: 0,
        inquiries: 0,
        reports: 0,
      };
      const category = categoryMap.get(listing.category.id) ?? {
        id: listing.category.id,
        name: listing.category.name,
        slug: listing.category.slug,
        listingCount: 0,
        paidListings: 0,
        boostedListings: 0,
        activeListings: 0,
        soldListings: 0,
        sellerIds: new Set<string>(),
        transactionCount: 0,
        successfulPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
        refundedPayments: 0,
        cancelledPayments: 0,
        revenue: 0,
        listingFeeRevenue: 0,
        boostRevenue: 0,
        walletRevenue: 0,
        gatewayRevenue: 0,
        pendingRevenue: 0,
        refundedRevenue: 0,
        viewCount: 0,
        saveCount: 0,
        inquiryCount: 0,
        reportCount: 0,
      };
      let listingRevenue = 0;
      let listingFeeRevenue = 0;
      let boostRevenue = 0;
      let pendingAmount = 0;
      let refundedAmount = 0;
      let hasListingFeeRevenue = false;
      let hasBoostRevenue = false;
      let countedPaidListing = false;

      category.listingCount += 1;
      category.sellerIds.add(listing.sellerId);
      category.viewCount += metrics.views;
      category.saveCount += metrics.saves;
      category.inquiryCount += metrics.inquiries;
      category.reportCount += metrics.reports;

      if (listing.status === ListingStatus.ACTIVE) {
        category.activeListings += 1;
      }

      if (listing.status === ListingStatus.SOLD) {
        category.soldListings += 1;
      }

      if (
        listing.listingPaymentMode === ListingPaymentMode.PAID ||
        listing.paidPriorityEnabled
      ) {
        category.paidListings += 1;
        countedPaidListing = true;
      }

      for (const transaction of listing.transactions) {
        const amount = toNumber(transaction.amount);

        category.transactionCount += 1;

        if (transaction.status === TransactionStatus.SUCCEEDED) {
          listingRevenue += amount;
          category.revenue += amount;
          category.successfulPayments += 1;

          if (transaction.provider === 'wallet') {
            category.walletRevenue += amount;
          } else {
            category.gatewayRevenue += amount;
          }

          if (transaction.type === TransactionType.LISTING_FEE) {
            listingFeeRevenue += amount;
            category.listingFeeRevenue += amount;
            hasListingFeeRevenue = true;
          }

          if (transaction.type === TransactionType.BOOST_PURCHASE) {
            boostRevenue += amount;
            category.boostRevenue += amount;
            hasBoostRevenue = true;
          }
        }

        if (transaction.status === TransactionStatus.PENDING) {
          pendingAmount += amount;
          category.pendingRevenue += amount;
          category.pendingPayments += 1;
        }

        if (transaction.status === TransactionStatus.FAILED) {
          category.failedPayments += 1;
        }

        if (transaction.status === TransactionStatus.REFUNDED) {
          refundedAmount += amount;
          category.refundedRevenue += amount;
          category.refundedPayments += 1;
        }

        if (transaction.status === TransactionStatus.CANCELLED) {
          category.cancelledPayments += 1;
        }
      }

      if (hasListingFeeRevenue && !countedPaidListing) {
        category.paidListings += 1;
      }

      if (hasBoostRevenue) {
        category.boostedListings += 1;
      }

      categoryMap.set(category.id, category);

      return {
        id: listing.id,
        title: listing.title,
        status: listing.status,
        sellerId: listing.sellerId,
        seller: listing.seller,
        category: listing.category,
        listingPaymentMode: listing.listingPaymentMode,
        paidPriorityEnabled: listing.paidPriorityEnabled,
        revenue: listingRevenue,
        listingFeeRevenue,
        boostRevenue,
        pendingRevenue: pendingAmount,
        refundedRevenue: refundedAmount,
        transactionCount: listing.transactions.length,
        viewCount: metrics.views,
        saveCount: metrics.saves,
        inquiryCount: metrics.inquiries,
        reportCount: metrics.reports,
        lifetimeViewCount: listing._count.views,
        lifetimeSaveCount: listing._count.savedBy,
        lifetimeInquiryCount: listing._count.conversations,
        lifetimeReportCount: listing._count.reports,
        inquiryConversionRate: this.toPercent(metrics.inquiries, metrics.views),
      };
    });
    const totalRevenue = transactionSums.SUCCEEDED;
    const categoryRows = [...categoryMap.values()]
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        listingCount: category.listingCount,
        paidListings: category.paidListings,
        boostedListings: category.boostedListings,
        activeListings: category.activeListings,
        soldListings: category.soldListings,
        sellersRepresented: category.sellerIds.size,
        transactionCount: category.transactionCount,
        successfulPayments: category.successfulPayments,
        pendingPayments: category.pendingPayments,
        failedPayments: category.failedPayments,
        refundedPayments: category.refundedPayments,
        cancelledPayments: category.cancelledPayments,
        revenue: category.revenue,
        listingFeeRevenue: category.listingFeeRevenue,
        boostRevenue: category.boostRevenue,
        walletRevenue: category.walletRevenue,
        gatewayRevenue: category.gatewayRevenue,
        pendingRevenue: category.pendingRevenue,
        refundedRevenue: category.refundedRevenue,
        revenueShare: this.toPercent(category.revenue, totalRevenue),
        viewCount: category.viewCount,
        saveCount: category.saveCount,
        inquiryCount: category.inquiryCount,
        reportCount: category.reportCount,
        inquiryConversionRate: this.toPercent(
          category.inquiryCount,
          category.viewCount,
        ),
        averageRevenuePerListing: category.listingCount
          ? Number((category.revenue / category.listingCount).toFixed(2))
          : 0,
      }))
      .sort(
        (first, second) =>
          second.revenue - first.revenue ||
          second.transactionCount - first.transactionCount ||
          first.name.localeCompare(second.name),
      );
    const sellersRepresented = new Set(
      listings.map((listing) => listing.sellerId),
    ).size;
    const totalViews = categoryRows.reduce(
      (sum, category) => sum + category.viewCount,
      0,
    );
    const totalSaves = categoryRows.reduce(
      (sum, category) => sum + category.saveCount,
      0,
    );
    const totalInquiries = categoryRows.reduce(
      (sum, category) => sum + category.inquiryCount,
      0,
    );
    const totalReports = categoryRows.reduce(
      (sum, category) => sum + category.reportCount,
      0,
    );

    return {
      generatedAt: new Date(),
      range: {
        from,
        to,
        days: Math.max(
          1,
          Math.ceil((to.getTime() - from.getTime()) / oneDayMs),
        ),
      },
      overview: {
        categoriesRepresented: categoryRows.length,
        incomeListings: listings.length,
        sellersRepresented,
        paidListings: categoryRows.reduce(
          (sum, category) => sum + category.paidListings,
          0,
        ),
        boostedListings: categoryRows.reduce(
          (sum, category) => sum + category.boostedListings,
          0,
        ),
        totalRevenue,
        listingFeeRevenue: revenueByType[TransactionType.LISTING_FEE].revenue,
        boostRevenue: revenueByType[TransactionType.BOOST_PURCHASE].revenue,
        pendingRevenue: transactionSums.PENDING,
        refundedRevenue: transactionSums.REFUNDED,
        successfulPayments: transactionCounts.SUCCEEDED,
        topCategory: categoryRows[0] ?? null,
      },
      commerce: {
        transactionStatuses: transactionCounts,
        revenueByType,
        revenueByProvider,
        averageRevenuePerCategory: categoryRows.length
          ? Number((totalRevenue / categoryRows.length).toFixed(2))
          : 0,
        averageOrderValue: transactionCounts.SUCCEEDED
          ? Number((totalRevenue / transactionCounts.SUCCEEDED).toFixed(2))
          : 0,
        paymentConversionRate: this.toPercent(
          transactionCounts.SUCCEEDED,
          Object.values(transactionCounts).reduce(
            (sum, count) => sum + count,
            0,
          ),
        ),
      },
      engagement: {
        views: totalViews,
        saves: totalSaves,
        inquiries: totalInquiries,
        reports: totalReports,
        inquiryConversionRate: this.toPercent(totalInquiries, totalViews),
        averageRevenuePerInquiry: totalInquiries
          ? Number((totalRevenue / totalInquiries).toFixed(2))
          : 0,
      },
      categories: categoryRows.slice(0, take),
      topListings: topListings
        .sort(
          (first, second) =>
            second.revenue - first.revenue ||
            second.viewCount - first.viewCount ||
            first.title.localeCompare(second.title),
        )
        .slice(0, take),
    };
  }

  async getBoostRevenueReport(query: QueryBoostRevenueReportDto) {
    const { from, to } = this.resolveMonitoringRange(query);
    const take = query.take ?? 100;
    const now = new Date();
    const expiringSoon = new Date(now.getTime() + oneDayMs);
    const rangeWhere = { gte: from, lte: to };
    const [
      transactionStatusRows,
      providerRevenueRows,
      boostStatusRows,
      placementRows,
      activeBoosts,
      expiringBoosts,
      boosts,
    ] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['status'],
        where: {
          type: TransactionType.BOOST_PURCHASE,
          createdAt: rangeWhere,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['provider'],
        where: {
          type: TransactionType.BOOST_PURCHASE,
          status: TransactionStatus.SUCCEEDED,
          createdAt: rangeWhere,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.boost.groupBy({
        by: ['status'],
        where: {
          createdAt: rangeWhere,
        },
        _count: { _all: true },
      }),
      this.prisma.boost.groupBy({
        by: ['placement'],
        where: {
          createdAt: rangeWhere,
        },
        _count: { _all: true },
      }),
      this.prisma.boost.count({
        where: {
          status: BoostStatus.ACTIVE,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
      }),
      this.prisma.boost.count({
        where: {
          status: BoostStatus.ACTIVE,
          endsAt: { gt: now, lte: expiringSoon },
        },
      }),
      this.prisma.boost.findMany({
        where: {
          createdAt: rangeWhere,
        },
        select: {
          id: true,
          placement: true,
          status: true,
          startsAt: true,
          endsAt: true,
          createdAt: true,
          package: {
            select: {
              id: true,
              slug: true,
              name: true,
              placement: true,
              price: true,
              currency: true,
              durationDays: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              status: true,
              sellerId: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          purchaser: {
            select: {
              id: true,
              displayName: true,
              email: true,
              sellerPriorityTier: true,
              reputationScore: true,
            },
          },
          transaction: {
            select: {
              id: true,
              status: true,
              amount: true,
              currency: true,
              provider: true,
              providerRef: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          _count: {
            select: {
              views: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take,
      }),
    ]);
    const transactionCounts = statusCounts(
      Object.values(TransactionStatus),
      transactionStatusRows,
    );
    const boostStatusCounts = statusCounts(
      Object.values(BoostStatus),
      boostStatusRows,
    );
    const transactionSums = Object.fromEntries(
      Object.values(TransactionStatus).map((status) => [status, 0]),
    ) as Record<TransactionStatus, number>;

    for (const row of transactionStatusRows) {
      transactionSums[row.status] = toNumber(row._sum?.amount);
    }

    const revenueByProvider = providerRevenueRows
      .map((row) => ({
        provider: row.provider ?? 'unknown',
        count: row._count._all,
        revenue: toNumber(row._sum.amount),
      }))
      .sort(
        (first, second) =>
          second.revenue - first.revenue ||
          first.provider.localeCompare(second.provider),
      );
    const packageMap = new Map<
      string,
      {
        id: string | null;
        slug: string | null;
        name: string;
        placement: string | null;
        durationDays: number | null;
        purchases: number;
        revenue: number;
        activeBoosts: number;
        viewCount: number;
      }
    >();
    const placementMap = new Map<
      string,
      { placement: string; boosts: number; revenue: number; viewCount: number }
    >(
      placementRows.map((row) => [
        row.placement,
        {
          placement: row.placement,
          boosts: row._count._all,
          revenue: 0,
          viewCount: 0,
        },
      ]),
    );
    const listingMap = new Map<
      string,
      {
        id: string;
        title: string;
        status: ListingStatus;
        sellerId: string;
        categoryName: string | null;
        boosts: number;
        revenue: number;
        viewCount: number;
      }
    >();

    for (const boost of boosts) {
      const revenue =
        boost.transaction?.status === TransactionStatus.SUCCEEDED
          ? toNumber(boost.transaction.amount)
          : 0;
      const packageKey = boost.package?.id ?? 'unpackaged';
      const packageStats = packageMap.get(packageKey) ?? {
        id: boost.package?.id ?? null,
        slug: boost.package?.slug ?? null,
        name: boost.package?.name ?? 'Unpackaged boost',
        placement: boost.package?.placement ?? boost.placement,
        durationDays: boost.package?.durationDays ?? null,
        purchases: 0,
        revenue: 0,
        activeBoosts: 0,
        viewCount: 0,
      };
      const placementStats = placementMap.get(boost.placement) ?? {
        placement: boost.placement,
        boosts: 0,
        revenue: 0,
        viewCount: 0,
      };
      const listingStats = listingMap.get(boost.listing.id) ?? {
        id: boost.listing.id,
        title: boost.listing.title,
        status: boost.listing.status,
        sellerId: boost.listing.sellerId,
        categoryName: boost.listing.category?.name ?? null,
        boosts: 0,
        revenue: 0,
        viewCount: 0,
      };

      packageStats.purchases += 1;
      packageStats.revenue += revenue;
      packageStats.viewCount += boost._count.views;
      placementStats.revenue += revenue;
      placementStats.viewCount += boost._count.views;
      listingStats.boosts += 1;
      listingStats.revenue += revenue;
      listingStats.viewCount += boost._count.views;

      if (boost.status === BoostStatus.ACTIVE) {
        packageStats.activeBoosts += 1;
      }

      packageMap.set(packageKey, packageStats);
      placementMap.set(boost.placement, placementStats);
      listingMap.set(boost.listing.id, listingStats);
    }

    const totalTransactions = Object.values(transactionCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const revenue = transactionSums.SUCCEEDED;
    const walletRevenue =
      revenueByProvider.find((row) => row.provider === 'wallet')?.revenue ?? 0;

    return {
      generatedAt: new Date(),
      range: {
        from,
        to,
        days: Math.max(
          1,
          Math.ceil((to.getTime() - from.getTime()) / oneDayMs),
        ),
      },
      overview: {
        boostPurchases: totalTransactions,
        successfulPurchases: transactionCounts.SUCCEEDED,
        pendingPurchases: transactionCounts.PENDING,
        failedPurchases: transactionCounts.FAILED,
        activeBoosts,
        expiringBoosts,
        packagesRepresented: packageMap.size,
        placementsRepresented: placementMap.size,
      },
      commerce: {
        revenue,
        pendingRevenue: transactionSums.PENDING,
        refundedRevenue: transactionSums.REFUNDED,
        walletRevenue,
        gatewayRevenue: Math.max(revenue - walletRevenue, 0),
        averageOrderValue: transactionCounts.SUCCEEDED
          ? Number((revenue / transactionCounts.SUCCEEDED).toFixed(2))
          : 0,
        paymentConversionRate: this.toPercent(
          transactionCounts.SUCCEEDED,
          totalTransactions,
        ),
        transactionStatuses: transactionCounts,
        revenueByProvider,
      },
      boosts: {
        statuses: boostStatusCounts,
        placements: [...placementMap.values()].sort(
          (first, second) =>
            second.revenue - first.revenue ||
            second.boosts - first.boosts ||
            first.placement.localeCompare(second.placement),
        ),
      },
      packages: [...packageMap.values()].sort(
        (first, second) =>
          second.revenue - first.revenue ||
          second.purchases - first.purchases ||
          first.name.localeCompare(second.name),
      ),
      topListings: [...listingMap.values()]
        .sort(
          (first, second) =>
            second.revenue - first.revenue ||
            second.viewCount - first.viewCount ||
            first.title.localeCompare(second.title),
        )
        .slice(0, take),
      rows: boosts.map((boost) => ({
        id: boost.id,
        placement: boost.placement,
        status: boost.status,
        startsAt: boost.startsAt,
        endsAt: boost.endsAt,
        createdAt: boost.createdAt,
        viewCount: boost._count.views,
        package: boost.package
          ? {
              id: boost.package.id,
              slug: boost.package.slug,
              name: boost.package.name,
              placement: boost.package.placement,
              price: toNumber(boost.package.price),
              currency: boost.package.currency,
              durationDays: boost.package.durationDays,
            }
          : null,
        listing: boost.listing,
        purchaser: boost.purchaser,
        transaction: boost.transaction
          ? {
              id: boost.transaction.id,
              status: boost.transaction.status,
              amount: toNumber(boost.transaction.amount),
              currency: boost.transaction.currency,
              provider: boost.transaction.provider,
              providerRef: boost.transaction.providerRef,
              createdAt: boost.transaction.createdAt,
              updatedAt: boost.transaction.updatedAt,
            }
          : null,
      })),
    };
  }

  async sendAdminReportEmail(
    adminId: string,
    reportType: AdminReportEmailType,
    dto: SendAdminReportEmailDto,
  ) {
    const normalizedReportType = this.normalizeAdminReportEmailType(reportType);
    const filters = dto.filters ?? {};
    const generatedAt = new Date().toISOString();

    try {
      const report = await this.getAdminReportEmailPayload(
        normalizedReportType,
        filters,
      );
      const label = this.formatAdminReportEmailType(normalizedReportType);
      const subject = normalizeOptionalText(dto.subject) ?? `${label} report`;
      const message = normalizeOptionalText(dto.message);
      const attachmentPayload = {
        reportType: normalizedReportType,
        generatedAt,
        generatedBy: adminId,
        filters,
        report,
      };
      const content = this.buildAdminReportEmailContent({
        adminId,
        filters,
        generatedAt,
        label,
        message,
        report,
      });
      const attachments = await this.buildAdminReportEmailAttachments(
        normalizedReportType,
        attachmentPayload,
        report,
        {
          adminId,
          filters,
          generatedAt,
          label,
          message,
        },
      );

      const delivery = await this.mailService.sendMail({
        to: dto.recipients,
        subject,
        text: content.text,
        html: content.html,
        attachments,
      });

      this.logAdminReportEmailAudit(
        delivery.enabled
          ? 'admin_report_email_sent'
          : 'admin_report_email_skipped',
        {
          adminId,
          attachmentCount: attachments.length,
          delivery,
          filters,
          recipients: dto.recipients,
          reportType: normalizedReportType,
          subject,
          timestamp: generatedAt,
        },
      );

      return {
        reportType: normalizedReportType,
        recipients: dto.recipients,
        subject,
        filters,
        delivery,
      };
    } catch (error) {
      this.logAdminReportEmailFailure({
        adminId,
        error,
        filters,
        recipients: dto.recipients,
        reportType: normalizedReportType,
        timestamp: generatedAt,
      });

      throw error;
    }
  }

  private logAdminReportEmailAudit(
    event: 'admin_report_email_sent' | 'admin_report_email_skipped',
    payload: Record<string, unknown>,
  ) {
    const message = JSON.stringify({
      event,
      ...payload,
    });

    if (event === 'admin_report_email_skipped') {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
  }

  private logAdminReportEmailFailure(input: {
    adminId: string;
    error: unknown;
    filters: AdminReportEmailFiltersDto;
    recipients: string[];
    reportType: AdminReportEmailType;
    timestamp: string;
  }) {
    const error =
      input.error instanceof Error
        ? {
            name: input.error.name,
            message: input.error.message,
          }
        : {
            name: 'Error',
            message: String(input.error),
          };

    this.logger.error(
      JSON.stringify({
        event: 'admin_report_email_failed',
        adminId: input.adminId,
        error,
        filters: input.filters,
        recipients: input.recipients,
        reportType: input.reportType,
        timestamp: input.timestamp,
      }),
      input.error instanceof Error ? input.error.stack : undefined,
    );
  }

  async updateListingReport(id: string, dto: UpdateListingReportDto) {
    if (
      dto.status === undefined &&
      dto.details === undefined &&
      dto.adminNotes === undefined &&
      dto.listingStatus === undefined
    ) {
      throw new BadRequestException('Choose a report field to update');
    }

    const report = await this.prisma.listingReport.findUnique({
      where: { id },
      select: {
        id: true,
        listingId: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Listing report not found');
    }

    const updateReport = this.prisma.listingReport.update({
      where: { id },
      data: {
        status: dto.status,
        details:
          dto.details === undefined
            ? undefined
            : normalizeOptionalText(dto.details),
        adminNotes:
          dto.adminNotes === undefined
            ? undefined
            : normalizeOptionalText(dto.adminNotes),
      },
      include: listingReportInclude,
    });

    if (dto.listingStatus === undefined) {
      return updateReport;
    }

    const [updatedReport] = await this.prisma.$transaction([
      updateReport,
      this.prisma.listing.update({
        where: { id: report.listingId },
        data: { status: dto.listingStatus },
        select: { id: true },
      }),
    ]);

    return updatedReport;
  }

  private normalizeAdminReportEmailType(reportType: AdminReportEmailType) {
    return reportType === AdminReportEmailType.APPROVALS
      ? AdminReportEmailType.SELLER_APPROVALS
      : reportType;
  }

  private getAdminReportEmailPayload(
    reportType: AdminReportEmailType,
    filters: AdminReportEmailFiltersDto,
  ) {
    switch (reportType) {
      case AdminReportEmailType.MONITORING:
        return this.getAdminMonitoring(this.buildMonitoringEmailQuery(filters));
      case AdminReportEmailType.ACTIVE_LISTINGS:
        return this.getActiveListingsReport(this.buildTableEmailQuery(filters));
      case AdminReportEmailType.PAID_LISTINGS:
        return this.getPaidListingsReport(this.buildTableEmailQuery(filters));
      case AdminReportEmailType.CATEGORY_INCOME:
        return this.getCategoryIncomeReport(this.buildTableEmailQuery(filters));
      case AdminReportEmailType.BOOST_REVENUE:
        return this.getBoostRevenueReport(this.buildTableEmailQuery(filters));
      case AdminReportEmailType.WALLET_PAYMENTS:
        return this.getWalletPaymentsReport(this.buildTableEmailQuery(filters));
      case AdminReportEmailType.SELLERS:
        return this.getAdminSellerReport(this.buildTableEmailQuery(filters));
      case AdminReportEmailType.TOP_SELLERS:
        return this.getTopSellersReport(this.buildTableEmailQuery(filters));
      case AdminReportEmailType.SELLER_APPROVALS:
        return this.getPendingSellerApprovals(
          this.buildTableEmailQuery(filters),
        );
      case AdminReportEmailType.APPROVALS:
        return this.getPendingSellerApprovals(
          this.buildTableEmailQuery(filters),
        );
      default:
        throw new BadRequestException('Unsupported report email type');
    }
  }

  private buildAdminReportEmailContent(input: {
    adminId: string;
    filters: AdminReportEmailFiltersDto;
    generatedAt: string;
    label: string;
    message: string | null;
    report: unknown;
  }) {
    const filterText = this.describeAdminReportEmailFilters(input.filters);
    const rangeText = this.describeReportRange(input.report);
    const summarySections = this.getReportSummarySections(input.report);
    const tableSections = this.getReportTableSections(input.report);
    const policyText = `This email includes summary data and up to ${reportEmailPreviewRowLimit} rows from each table section. The full report data is attached as JSON, and table sections are attached as CSV files when available.`;
    const textSections = [
      input.message,
      `${input.label} report`,
      `Generated at: ${input.generatedAt}`,
      `Generated by admin: ${input.adminId}`,
      rangeText ? `Range: ${rangeText}` : null,
      `Filters: ${filterText}`,
      policyText,
      ...summarySections.map((section) =>
        [
          this.formatReportLabel(section.title),
          ...section.entries.map(
            (entry) =>
              `${this.formatReportLabel(entry.label)}: ${this.formatReportValue(
                entry.value,
              )}`,
          ),
        ].join('\n'),
      ),
      ...tableSections.map((section) =>
        [
          `${this.formatReportLabel(section.title)} preview (${Math.min(
            section.rows.length,
            reportEmailPreviewRowLimit,
          )}/${section.rows.length})`,
          ...section.rows
            .slice(0, reportEmailPreviewRowLimit)
            .map((row, index) => {
              const columns = this.getReportTableColumns(row);

              return `${index + 1}. ${columns
                .map(
                  (column) =>
                    `${this.formatReportLabel(
                      column,
                    )}: ${this.formatReportValue((row as Record<string, unknown>)[column])}`,
                )
                .join(' | ')}`;
            }),
        ].join('\n'),
      ),
    ].filter(Boolean);
    const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;color:#172033;font-family:Arial,sans-serif;">
    <div style="max-width:760px;margin:0 auto;padding:28px 18px;">
      <div style="background:#0f172a;color:#ffffff;border-radius:12px;padding:24px;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;">Admin report</p>
        <h1 style="margin:0;font-size:26px;line-height:1.25;">${this.escapeHtml(
          input.label,
        )}</h1>
        <p style="margin:12px 0 0;color:#cbd5e1;">${this.escapeHtml(
          policyText,
        )}</p>
      </div>
      ${
        input.message
          ? `<div style="background:#ffffff;border:1px solid #dce4f2;border-radius:12px;padding:18px;margin-top:16px;">
              <p style="margin:0;white-space:pre-wrap;">${this.escapeHtml(
                input.message,
              )}</p>
            </div>`
          : ''
      }
      <div style="background:#ffffff;border:1px solid #dce4f2;border-radius:12px;padding:18px;margin-top:16px;">
        <h2 style="margin:0 0 12px;font-size:18px;">Report details</h2>
        ${this.renderReportEmailMetadata([
          ['Generated at', input.generatedAt],
          ['Generated by admin', input.adminId],
          ['Range', rangeText ?? 'Not specified'],
          ['Filters', filterText],
        ])}
      </div>
      ${summarySections.map((section) => this.renderReportEmailSummarySection(section)).join('')}
      ${tableSections.map((section) => this.renderReportEmailTableSection(section)).join('')}
    </div>
  </body>
</html>`;

    return {
      text: textSections.join('\n\n'),
      html,
    };
  }

  private async buildAdminReportEmailAttachments(
    reportType: AdminReportEmailType,
    attachmentPayload: Record<string, unknown>,
    report: unknown,
    pdfInput: {
      adminId: string;
      filters: AdminReportEmailFiltersDto;
      generatedAt: string;
      label: string;
      message: string | null;
    },
  ) {
    const tableSections = this.getReportTableSections(
      report,
      Number.POSITIVE_INFINITY,
    );
    const csvAttachments = tableSections.map((section) => ({
      filename: `${reportType}-${this.slugifyReportFilename(section.title)}.csv`,
      content: this.buildReportCsv(section.rows),
      contentType: 'text/csv; charset=utf-8',
    }));
    const pdf = await this.buildAdminReportPdf({
      ...pdfInput,
      report,
    });

    return [
      {
        filename: `${reportType}-report.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      },
      {
        filename: `${reportType}-report.json`,
        content: JSON.stringify(attachmentPayload, null, 2),
        contentType: 'application/json',
      },
      ...csvAttachments,
    ];
  }

  private buildAdminReportPdf(input: {
    adminId: string;
    filters: AdminReportEmailFiltersDto;
    generatedAt: string;
    label: string;
    message: string | null;
    report: unknown;
  }) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 46,
        right: 42,
        bottom: 46,
        left: 42,
      },
    });
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderAdminReportPdf(doc, input);
      doc.end();
    });
  }

  private renderAdminReportPdf(
    doc: PDFKit.PDFDocument,
    input: {
      adminId: string;
      filters: AdminReportEmailFiltersDto;
      generatedAt: string;
      label: string;
      message: string | null;
      report: unknown;
    },
  ) {
    const filterText = this.describeAdminReportEmailFilters(input.filters);
    const rangeText = this.describeReportRange(input.report) ?? 'Not specified';
    const summarySections = this.getReportSummarySections(input.report);
    const tableSections = this.getReportTableSections(input.report);
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc
      .roundedRect(doc.page.margins.left, doc.y, contentWidth, 104, 10)
      .fill('#0f172a');
    doc
      .fillColor('#93c5fd')
      .font('Helvetica')
      .fontSize(10)
      .text('ADMIN REPORT', doc.page.margins.left + 18, doc.y + 20, {
        characterSpacing: 1.3,
      });
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(24)
      .text(input.label, doc.page.margins.left + 18, doc.y + 8, {
        width: contentWidth - 36,
      });
    doc
      .fillColor('#dbeafe')
      .font('Helvetica')
      .fontSize(10)
      .text(
        'Summary data, report details, and table previews. Full data is also attached as JSON/CSV.',
        doc.page.margins.left + 18,
        doc.y + 10,
        { width: contentWidth - 36 },
      );
    doc.y = doc.page.margins.top + 124;

    if (input.message) {
      this.renderPdfBox(doc, 'Admin note', input.message);
    }

    this.renderPdfMetadata(doc, [
      ['Generated at', input.generatedAt],
      ['Generated by admin', input.adminId],
      ['Range', rangeText],
      ['Filters', filterText],
    ]);

    for (const section of summarySections) {
      this.renderPdfSummarySection(doc, section);
    }

    for (const section of tableSections) {
      this.renderPdfTableSection(doc, section);
    }
  }

  private renderPdfBox(doc: PDFKit.PDFDocument, title: string, body: string) {
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bodyHeight = doc.heightOfString(body, {
      width: contentWidth - 28,
    });
    const height = Math.max(74, bodyHeight + 48);

    this.ensurePdfSpace(doc, height + 16);
    doc
      .roundedRect(doc.page.margins.left, doc.y, contentWidth, height, 8)
      .fillAndStroke('#ffffff', '#dce4f2');
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(title, doc.page.margins.left + 14, doc.y + 14);
    doc
      .fillColor('#172033')
      .font('Helvetica')
      .fontSize(10)
      .text(body, doc.page.margins.left + 14, doc.y + 8, {
        width: contentWidth - 28,
      });
    doc.y += 20;
  }

  private renderPdfMetadata(
    doc: PDFKit.PDFDocument,
    rows: Array<[string, string]>,
  ) {
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startY = doc.y;
    const rowHeight = 24;
    const height = 42 + rows.length * rowHeight;

    this.ensurePdfSpace(doc, height + 18);
    doc
      .roundedRect(doc.page.margins.left, doc.y, contentWidth, height, 8)
      .fillAndStroke('#ffffff', '#dce4f2');
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text('Report details', doc.page.margins.left + 14, doc.y + 14);

    let rowY = startY + 38;

    for (const [label, value] of rows) {
      doc
        .moveTo(doc.page.margins.left + 14, rowY)
        .lineTo(doc.page.margins.left + contentWidth - 14, rowY)
        .strokeColor('#edf2f7')
        .stroke();
      doc
        .fillColor('#64748b')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(label, doc.page.margins.left + 14, rowY + 7, {
          width: 136,
        });
      doc
        .fillColor('#172033')
        .font('Helvetica')
        .fontSize(9)
        .text(
          this.truncatePdfText(value, 120),
          doc.page.margins.left + 158,
          rowY + 7,
          {
            width: contentWidth - 174,
          },
        );
      rowY += rowHeight;
    }

    doc.y = startY + height + 18;
  }

  private renderPdfSummarySection(
    doc: PDFKit.PDFDocument,
    section: {
      title: string;
      entries: Array<{ label: string; value: unknown }>;
    },
  ) {
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const entries = section.entries.slice(0, 12);
    const cardGap = 10;
    const cardWidth = (contentWidth - cardGap) / 2;
    const cardHeight = 50;
    const rows = Math.ceil(entries.length / 2);
    const height = 50 + rows * cardHeight + Math.max(rows - 1, 0) * cardGap;

    this.ensurePdfSpace(doc, height + 18);
    const startY = doc.y;

    doc
      .roundedRect(doc.page.margins.left, startY, contentWidth, height, 8)
      .fillAndStroke('#ffffff', '#dce4f2');
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(
        this.formatReportLabel(section.title),
        doc.page.margins.left + 14,
        startY + 14,
      );

    entries.forEach((entry, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = doc.page.margins.left + 14 + column * (cardWidth + cardGap);
      const y = startY + 42 + row * (cardHeight + cardGap);

      doc.roundedRect(x, y, cardWidth - 14, cardHeight, 6).fill('#f8fafc');
      doc
        .fillColor('#64748b')
        .font('Helvetica')
        .fontSize(8)
        .text(this.formatReportLabel(entry.label), x + 9, y + 9, {
          width: cardWidth - 34,
          height: 12,
          ellipsis: true,
        });
      doc
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(this.formatReportValue(entry.value), x + 9, y + 24, {
          width: cardWidth - 34,
          height: 18,
          ellipsis: true,
        });
    });

    doc.y = startY + height + 18;
  }

  private renderPdfTableSection(
    doc: PDFKit.PDFDocument,
    section: {
      title: string;
      rows: unknown[];
    },
  ) {
    const previewRows = section.rows.slice(0, reportEmailPreviewRowLimit);
    const columns = this.getReportTableColumns(previewRows[0]);

    if (!columns.length) {
      return;
    }

    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowHeight = 28;
    const headerHeight = 26;
    const headingHeight = 46;
    const tableHeight =
      headingHeight + headerHeight + previewRows.length * rowHeight;
    const columnWidth = contentWidth / columns.length;
    const fontSize = columns.length > 4 ? 7 : 8;

    this.ensurePdfSpace(doc, tableHeight + 18);
    const startY = doc.y;

    doc
      .roundedRect(doc.page.margins.left, startY, contentWidth, tableHeight, 8)
      .fillAndStroke('#ffffff', '#dce4f2');
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(
        this.formatReportLabel(section.title),
        doc.page.margins.left + 14,
        startY + 14,
      );
    doc
      .fillColor('#64748b')
      .font('Helvetica')
      .fontSize(9)
      .text(
        `Showing ${previewRows.length} of ${section.rows.length} rows.`,
        doc.page.margins.left + 14,
        startY + 32,
      );

    const tableX = doc.page.margins.left;
    let rowY = startY + headingHeight;

    doc.rect(tableX, rowY, contentWidth, headerHeight).fill('#f1f5f9');
    columns.forEach((column, index) => {
      doc
        .fillColor('#475569')
        .font('Helvetica-Bold')
        .fontSize(fontSize)
        .text(
          this.formatReportLabel(column),
          tableX + index * columnWidth + 8,
          rowY + 8,
          {
            width: columnWidth - 12,
            height: 12,
            ellipsis: true,
          },
        );
    });
    rowY += headerHeight;

    previewRows.forEach((row) => {
      const record = row as Record<string, unknown>;

      doc
        .moveTo(tableX, rowY)
        .lineTo(tableX + contentWidth, rowY)
        .strokeColor('#edf2f7')
        .stroke();
      columns.forEach((column, index) => {
        doc
          .fillColor('#172033')
          .font('Helvetica')
          .fontSize(fontSize)
          .text(
            this.truncatePdfText(this.formatReportValue(record[column]), 80),
            tableX + index * columnWidth + 8,
            rowY + 8,
            {
              width: columnWidth - 12,
              height: 14,
              ellipsis: true,
            },
          );
      });
      rowY += rowHeight;
    });

    doc.y = startY + tableHeight + 18;
  }

  private ensurePdfSpace(doc: PDFKit.PDFDocument, requiredHeight: number) {
    if (doc.y + requiredHeight <= doc.page.height - doc.page.margins.bottom) {
      return;
    }

    doc.addPage();
  }

  private truncatePdfText(value: string, maxLength: number) {
    return value.length > maxLength
      ? `${value.slice(0, maxLength - 1)}...`
      : value;
  }

  private getReportSummarySections(report: unknown) {
    if (!this.isRecord(report)) {
      return [];
    }

    return Object.entries(report)
      .filter(([key, value]) => {
        if (key === 'range' || key === 'rows') {
          return false;
        }

        return this.isRecord(value);
      })
      .map(([title, value]) => ({
        title,
        entries: this.getReportSummaryEntries(value as Record<string, unknown>),
      }))
      .filter((section) => section.entries.length > 0)
      .slice(0, 8);
  }

  private getReportSummaryEntries(
    value: Record<string, unknown>,
    prefix?: string,
  ): Array<{ label: string; value: unknown }> {
    return Object.entries(value).flatMap(([key, entry]) => {
      const label = prefix ? `${prefix} ${key}` : key;

      if (this.isReportPrimitive(entry)) {
        return [{ label, value: entry }];
      }

      if (this.isRecord(entry)) {
        return this.getReportSummaryEntries(entry, label).slice(0, 8);
      }

      return [];
    });
  }

  private getReportTableSections(report: unknown, limit = 6) {
    if (!this.isRecord(report)) {
      return [];
    }

    return Object.entries(report)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([title, value]) => ({
        title,
        rows: (value as unknown[]).filter((row) => this.isRecord(row)),
      }))
      .filter((section) => section.rows.length > 0)
      .slice(0, limit);
  }

  private buildReportCsv(rows: unknown[]) {
    const columns = this.getReportCsvColumns(rows);
    const csvRows = [
      columns.map((column) =>
        this.escapeCsvValue(this.formatReportLabel(column)),
      ),
      ...rows.map((row) => {
        const record = row as Record<string, unknown>;

        return columns.map((column) =>
          this.escapeCsvValue(this.formatReportValue(record[column])),
        );
      }),
    ];

    return csvRows.map((row) => row.join(',')).join('\n');
  }

  private getReportCsvColumns(rows: unknown[]) {
    const keys = new Set<string>();

    for (const row of rows) {
      if (!this.isRecord(row)) {
        continue;
      }

      for (const [key, value] of Object.entries(row)) {
        if (this.isReportTableValue(value)) {
          keys.add(key);
        }
      }
    }

    const preferredColumns = [
      'id',
      'title',
      'displayName',
      'name',
      'status',
      'revenue',
      'amount',
      'currency',
      'viewCount',
      'saveCount',
      'inquiryCount',
      'activeListings',
      'reportCount',
      'createdAt',
      'updatedAt',
    ];

    return [
      ...preferredColumns.filter((column) => keys.has(column)),
      ...[...keys].filter((column) => !preferredColumns.includes(column)),
    ];
  }

  private renderReportEmailMetadata(rows: Array<[string, string]>) {
    return `<table style="width:100%;border-collapse:collapse;">${rows
      .map(
        ([label, value]) => `<tr>
          <th style="width:190px;text-align:left;vertical-align:top;padding:8px;border-top:1px solid #edf2f7;color:#64748b;font-size:13px;">${this.escapeHtml(
            label,
          )}</th>
          <td style="padding:8px;border-top:1px solid #edf2f7;font-size:13px;">${this.escapeHtml(
            value,
          )}</td>
        </tr>`,
      )
      .join('')}</table>`;
  }

  private renderReportEmailSummarySection(section: {
    title: string;
    entries: Array<{ label: string; value: unknown }>;
  }) {
    return `<div style="background:#ffffff;border:1px solid #dce4f2;border-radius:12px;padding:18px;margin-top:16px;">
      <h2 style="margin:0 0 12px;font-size:18px;">${this.escapeHtml(
        this.formatReportLabel(section.title),
      )}</h2>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
        ${section.entries
          .slice(0, 12)
          .map(
            (
              entry,
            ) => `<div style="border:1px solid #edf2f7;border-radius:8px;padding:10px;background:#f8fafc;">
              <div style="font-size:12px;color:#64748b;">${this.escapeHtml(
                this.formatReportLabel(entry.label),
              )}</div>
              <div style="font-size:18px;font-weight:700;margin-top:4px;">${this.escapeHtml(
                this.formatReportValue(entry.value),
              )}</div>
            </div>`,
          )
          .join('')}
      </div>
    </div>`;
  }

  private renderReportEmailTableSection(section: {
    title: string;
    rows: unknown[];
  }) {
    const previewRows = section.rows.slice(0, reportEmailPreviewRowLimit);
    const columns = this.getReportTableColumns(previewRows[0]);

    return `<div style="background:#ffffff;border:1px solid #dce4f2;border-radius:12px;padding:18px;margin-top:16px;">
      <h2 style="margin:0 0 4px;font-size:18px;">${this.escapeHtml(
        this.formatReportLabel(section.title),
      )}</h2>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px;">Showing ${
        previewRows.length
      } of ${section.rows.length} rows.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr>${columns
            .map(
              (column) =>
                `<th style="text-align:left;padding:8px;border-bottom:1px solid #dce4f2;color:#475569;">${this.escapeHtml(
                  this.formatReportLabel(column),
                )}</th>`,
            )
            .join('')}</tr>
        </thead>
        <tbody>
          ${previewRows
            .map((row) => {
              const record = row as Record<string, unknown>;

              return `<tr>${columns
                .map(
                  (column) =>
                    `<td style="padding:8px;border-bottom:1px solid #edf2f7;vertical-align:top;">${this.escapeHtml(
                      this.formatReportValue(record[column]),
                    )}</td>`,
                )
                .join('')}</tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;
  }

  private getReportTableColumns(row: unknown) {
    if (!this.isRecord(row)) {
      return [];
    }

    const preferredColumns = [
      'title',
      'displayName',
      'name',
      'status',
      'revenue',
      'amount',
      'viewCount',
      'activeListings',
      'reportCount',
      'createdAt',
    ];
    const keys = Object.keys(row).filter((key) =>
      this.isReportTableValue(row[key]),
    );
    const ordered = [
      ...preferredColumns.filter((column) => keys.includes(column)),
      ...keys.filter((column) => !preferredColumns.includes(column)),
    ];

    return ordered.slice(0, reportEmailPreviewColumnLimit);
  }

  private describeReportRange(report: unknown) {
    if (!this.isRecord(report) || !this.isRecord(report.range)) {
      return null;
    }

    const from = this.formatReportValue(report.range.from);
    const to = this.formatReportValue(report.range.to);
    const days = this.formatReportValue(report.range.days);

    return `${from} to ${to}${days ? ` (${days} days)` : ''}`;
  }

  private buildMonitoringEmailQuery(
    filters: AdminReportEmailFiltersDto,
  ): QueryAdminMonitoringDto {
    return {
      days: filters.days,
      from: filters.from,
      to: filters.to,
      topTake: filters.topTake,
    };
  }

  private buildTableEmailQuery(
    filters: AdminReportEmailFiltersDto,
  ): QueryActiveListingsReportDto {
    return {
      days: filters.days,
      from: filters.from,
      to: filters.to,
      take: filters.take,
    };
  }

  private formatAdminReportEmailType(reportType: AdminReportEmailType) {
    return reportType
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private describeAdminReportEmailFilters(filters: AdminReportEmailFiltersDto) {
    const descriptions = [
      filters.days ? `days=${filters.days}` : null,
      filters.from ? `from=${filters.from}` : null,
      filters.to ? `to=${filters.to}` : null,
      filters.take ? `take=${filters.take}` : null,
      filters.topTake ? `topTake=${filters.topTake}` : null,
    ].filter(Boolean);

    return descriptions.length ? descriptions.join(', ') : 'default';
  }

  private formatReportLabel(value: string) {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private formatReportValue(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? value.toLocaleString('en')
        : value.toLocaleString('en', { maximumFractionDigits: 2 });
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'string') {
      const maybeDate = new Date(value);

      if (
        /^\d{4}-\d{2}-\d{2}/.test(value) &&
        !Number.isNaN(maybeDate.getTime())
      ) {
        return maybeDate.toISOString();
      }

      return value;
    }

    if (this.isRecord(value)) {
      const displayValue =
        value.title ??
        value.displayName ??
        value.name ??
        value.email ??
        value.id ??
        null;

      return displayValue == null
        ? '[object]'
        : this.formatReportValue(displayValue);
    }

    return String(value);
  }

  private escapeCsvValue(value: unknown) {
    const text = this.formatReportValue(value);

    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  }

  private slugifyReportFilename(value: string) {
    const slug = value
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || 'rows';
  }

  private isReportPrimitive(value: unknown) {
    return (
      value === null ||
      value instanceof Date ||
      ['string', 'number', 'boolean'].includes(typeof value)
    );
  }

  private isReportTableValue(value: unknown) {
    return this.isReportPrimitive(value) || this.isRecord(value);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private escapeHtml(value: unknown) {
    return this.formatReportValue(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private buildListingReportWhere(
    query: QueryListingReportsDto,
  ): Prisma.ListingReportWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.listingId ? { listingId: query.listingId } : {}),
      ...(query.reporterId ? { reporterId: query.reporterId } : {}),
    };
  }

  private resolveMonitoringRange(query: QueryAdminMonitoringDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(
          to.getTime() - (query.days ?? defaultMonitoringDays) * oneDayMs,
        );

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Monitoring dates must be valid');
    }

    if (from >= to) {
      throw new BadRequestException(
        'Monitoring start date must be before end date',
      );
    }

    const windowMs = to.getTime() - from.getTime();

    return {
      from,
      to,
      previousFrom: new Date(from.getTime() - windowMs),
    };
  }

  private async getTopViewedListings(
    viewedAt: { gte: Date; lte: Date },
    take: number,
  ) {
    const viewRows = await this.prisma.listingView.groupBy({
      by: ['listingId'],
      where: { viewedAt },
      _count: { _all: true },
      orderBy: { _count: { listingId: 'desc' } },
      take,
    });
    const listingIds = viewRows.map((row) => row.listingId);

    if (!listingIds.length) {
      return [];
    }

    const listings = await this.prisma.listing.findMany({
      where: { id: { in: listingIds } },
      select: {
        id: true,
        title: true,
        status: true,
        sellerId: true,
        price: true,
        currency: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        seller: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        _count: {
          select: {
            savedBy: true,
            conversations: true,
            reports: true,
            views: true,
          },
        },
      },
    });
    const listingById = new Map(
      listings.map((listing) => [listing.id, listing]),
    );

    return viewRows.flatMap((row) => {
      const listing = listingById.get(row.listingId);

      if (!listing) {
        return [];
      }

      return [
        {
          id: listing.id,
          title: listing.title,
          status: listing.status,
          sellerId: listing.sellerId,
          sellerName: listing.seller?.displayName ?? null,
          categoryName: listing.category?.name ?? null,
          price: Number(listing.price),
          currency: listing.currency,
          viewCount: row._count._all,
          saveCount: listing._count.savedBy,
          inquiryCount: listing._count.conversations,
          reportCount: listing._count.reports,
          lifetimeViewCount: listing._count.views,
        },
      ];
    });
  }

  private buildMonitoringAlerts(input: {
    openReports: number;
    pendingListings: number;
    pendingReviews: number;
    failedTransactions: number;
    expiringBoosts: number;
  }) {
    return [
      {
        key: 'open_reports',
        severity: input.openReports > 20 ? 'high' : 'medium',
        label: 'Open reports',
        value: input.openReports,
        message:
          input.openReports > 0
            ? 'Trust and safety reports need review.'
            : 'No open reports are waiting.',
      },
      {
        key: 'pending_listings',
        severity: input.pendingListings > 25 ? 'high' : 'medium',
        label: 'Pending listings',
        value: input.pendingListings,
        message:
          input.pendingListings > 0
            ? 'Listings are waiting for moderation.'
            : 'No listings are waiting for moderation.',
      },
      {
        key: 'pending_reviews',
        severity: input.pendingReviews > 10 ? 'medium' : 'low',
        label: 'Pending reviews',
        value: input.pendingReviews,
        message:
          input.pendingReviews > 0
            ? 'Seller reviews are waiting for approval.'
            : 'No seller reviews are waiting.',
      },
      {
        key: 'failed_transactions',
        severity: input.failedTransactions > 5 ? 'high' : 'medium',
        label: 'Failed payments',
        value: input.failedTransactions,
        message:
          input.failedTransactions > 0
            ? 'Recent payment failures should be checked.'
            : 'No payment failures in the selected window.',
      },
      {
        key: 'boost_expiry',
        severity: input.expiringBoosts > 0 ? 'low' : 'none',
        label: 'Boosts expiring soon',
        value: input.expiringBoosts,
        message:
          input.expiringBoosts > 0
            ? 'Boost placements expire within 24 hours.'
            : 'No boosts expire in the next 24 hours.',
      },
    ];
  }

  private toPercent(numerator: number, denominator: number) {
    if (!denominator) {
      return 0;
    }

    return Number(((numerator / denominator) * 100).toFixed(1));
  }
}
