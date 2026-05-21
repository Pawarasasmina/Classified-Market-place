import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, ReportStatus } from '@prisma/client';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let prisma: {
    $transaction: jest.Mock;
    listing: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    listingReport: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: ReportsService;

  const listingReport = {
    id: 'report-1',
    listingId: 'listing-1',
    reporterId: 'user-1',
    reason: 'Scam listing',
    details: 'The seller asks off-site.',
    adminNotes: null,
    status: ReportStatus.OPEN,
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn().mockImplementation((operations) =>
        Promise.all(
          operations.map((operation: unknown) => Promise.resolve(operation)),
        ),
      ),
      listing: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'listing-1',
          status: ListingStatus.ACTIVE,
          sellerId: 'seller-1',
        }),
        update: jest.fn().mockResolvedValue({ id: 'listing-1' }),
      },
      listingReport: {
        create: jest.fn().mockImplementation(({ data }) => ({
          ...listingReport,
          ...data,
        })),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([listingReport]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'report-1',
          listingId: 'listing-1',
        }),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...listingReport,
          ...data,
        })),
      },
    };
    service = new ReportsService(prisma as never);
  });

  it('allows a user to report an active listing', async () => {
    await expect(
      service.createListingReport('user-1', 'listing-1', {
        reason: ' Scam listing ',
        details: ' The seller asks off-site. ',
      }),
    ).resolves.toMatchObject({
      id: 'report-1',
      listingId: 'listing-1',
      reporterId: 'user-1',
      reason: 'Scam listing',
      details: 'The seller asks off-site.',
    });

    expect(prisma.listing.findUnique).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      select: {
        id: true,
        status: true,
        sellerId: true,
      },
    });
    expect(prisma.listingReport.findFirst).toHaveBeenCalledWith({
      where: {
        listingId: 'listing-1',
        reporterId: 'user-1',
        status: ReportStatus.OPEN,
      },
      select: { id: true },
    });
    expect(prisma.listingReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          listingId: 'listing-1',
          reporterId: 'user-1',
          reason: 'Scam listing',
          details: 'The seller asks off-site.',
        },
      }),
    );
  });

  it('rejects reports for missing listings', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    await expect(
      service.createListingReport('user-1', 'missing-listing', {
        reason: 'Scam listing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.listingReport.create).not.toHaveBeenCalled();
  });

  it('rejects reports for deleted listings', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.DELETED,
      sellerId: 'seller-1',
    });

    await expect(
      service.createListingReport('user-1', 'listing-1', {
        reason: 'Scam listing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.listingReport.findFirst).not.toHaveBeenCalled();
    expect(prisma.listingReport.create).not.toHaveBeenCalled();
  });

  it('rejects owner reports for their own listing', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      sellerId: 'user-1',
    });

    await expect(
      service.createListingReport('user-1', 'listing-1', {
        reason: 'Scam listing',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.listingReport.findFirst).not.toHaveBeenCalled();
    expect(prisma.listingReport.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate open reports from the same user for the same listing', async () => {
    prisma.listingReport.findFirst.mockResolvedValue({ id: 'report-open' });

    await expect(
      service.createListingReport('user-1', 'listing-1', {
        reason: 'Scam listing',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.listingReport.findFirst).toHaveBeenCalledWith({
      where: {
        listingId: 'listing-1',
        reporterId: 'user-1',
        status: ReportStatus.OPEN,
      },
      select: { id: true },
    });
    expect(prisma.listingReport.create).not.toHaveBeenCalled();
  });

  it('lists only the current user listing reports', async () => {
    await service.listMine('user-1', {
      status: ReportStatus.OPEN,
      take: 25,
    });

    expect(prisma.listingReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ReportStatus.OPEN,
          reporterId: 'user-1',
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    );
  });

  it('applies admin listing report filters', async () => {
    await service.listForAdmin({
      status: ReportStatus.REVIEWED,
      listingId: 'listing-1',
      reporterId: 'user-1',
    });

    expect(prisma.listingReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ReportStatus.REVIEWED,
          listingId: 'listing-1',
          reporterId: 'user-1',
        },
        take: 100,
      }),
    );
  });

  it('lets an admin review a report with status, details, and admin notes', async () => {
    await expect(
      service.updateListingReport('report-1', {
        status: ReportStatus.REVIEWED,
        details: ' Duplicate listing removed. ',
        adminNotes: ' First warning sent to seller. ',
      }),
    ).resolves.toMatchObject({
      id: 'report-1',
      status: ReportStatus.REVIEWED,
      details: 'Duplicate listing removed.',
      adminNotes: 'First warning sent to seller.',
    });

    expect(prisma.listingReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: {
          status: ReportStatus.REVIEWED,
          details: 'Duplicate listing removed.',
          adminNotes: 'First warning sent to seller.',
        },
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.listing.update).not.toHaveBeenCalled();
  });

  it('lets an admin action a report and moderate the listing', async () => {
    await expect(
      service.updateListingReport('report-1', {
        status: ReportStatus.ACTIONED,
        adminNotes: 'Listing removed after review.',
        listingStatus: ListingStatus.REMOVED,
      }),
    ).resolves.toMatchObject({
      id: 'report-1',
      status: ReportStatus.ACTIONED,
      adminNotes: 'Listing removed after review.',
    });

    expect(prisma.listingReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          status: ReportStatus.ACTIONED,
          adminNotes: 'Listing removed after review.',
        }),
      }),
    );
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: { status: ListingStatus.REMOVED },
      select: { id: true },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects empty listing report updates', async () => {
    await expect(
      service.updateListingReport('report-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.listingReport.update).not.toHaveBeenCalled();
  });

  it('returns not found for missing listing reports', async () => {
    prisma.listingReport.findUnique.mockResolvedValue(null);

    await expect(
      service.updateListingReport('missing-report', {
        status: ReportStatus.DISMISSED,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
