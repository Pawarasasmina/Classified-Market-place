import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, Prisma, ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingReportDto } from './dto/create-listing-report.dto';
import { QueryListingReportsDto } from './dto/query-listing-reports.dto';
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

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

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

  private buildListingReportWhere(
    query: QueryListingReportsDto,
  ): Prisma.ListingReportWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.listingId ? { listingId: query.listingId } : {}),
      ...(query.reporterId ? { reporterId: query.reporterId } : {}),
    };
  }
}
