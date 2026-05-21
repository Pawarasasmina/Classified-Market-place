import { ListingStatus, ReportStatus } from '@prisma/client';
import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  let service: {
    createListingReport: jest.Mock;
    listForAdmin: jest.Mock;
    listMine: jest.Mock;
    updateListingReport: jest.Mock;
  };
  let controller: ReportsController;

  beforeEach(() => {
    service = {
      createListingReport: jest.fn(),
      listForAdmin: jest.fn(),
      listMine: jest.fn(),
      updateListingReport: jest.fn(),
    };
    controller = new ReportsController(service as never);
  });

  it('creates a listing report for the current user', () => {
    const dto = { reason: 'Scam listing', details: 'The seller asks off-site.' };

    controller.createListingReport({ id: 'user-1' }, 'listing-1', dto);

    expect(service.createListingReport).toHaveBeenCalledWith(
      'user-1',
      'listing-1',
      dto,
    );
  });

  it('lists the current user listing reports', () => {
    const query = { status: ReportStatus.OPEN };

    controller.listMine({ id: 'user-1' }, query);

    expect(service.listMine).toHaveBeenCalledWith('user-1', query);
  });

  it('passes admin listing report filters to the service', () => {
    const query = {
      status: ReportStatus.REVIEWED,
      listingId: 'listing-1',
      reporterId: 'user-1',
    };

    controller.listForAdmin(query);

    expect(service.listForAdmin).toHaveBeenCalledWith(query);
  });

  it('passes admin listing report updates to the service', () => {
    const dto = {
      status: ReportStatus.ACTIONED,
      details: 'Resolved.',
      adminNotes: 'Listing removed.',
      listingStatus: ListingStatus.REMOVED,
    };

    controller.updateListingReport('report-1', dto);

    expect(service.updateListingReport).toHaveBeenCalledWith('report-1', dto);
  });
});
