import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { ListingStatus, ReportStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { rolesForPermission } from '../common/admin-permissions';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminReportEmailType } from './dto/send-admin-report-email.dto';
import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  let service: {
    createListingReport: jest.Mock;
    getActiveListingsReport: jest.Mock;
    getAdminMonitoring: jest.Mock;
    getAdminSellerReport: jest.Mock;
    getBoostRevenueReport: jest.Mock;
    getCategoryIncomeReport: jest.Mock;
    getPaidListingsReport: jest.Mock;
    getPendingSellerApprovals: jest.Mock;
    getTopSellersReport: jest.Mock;
    getWalletPaymentsReport: jest.Mock;
    listForAdmin: jest.Mock;
    listMine: jest.Mock;
    sendAdminReportEmail: jest.Mock;
    updateListingReport: jest.Mock;
  };
  let controller: ReportsController;

  beforeEach(() => {
    service = {
      createListingReport: jest.fn(),
      getActiveListingsReport: jest.fn(),
      getAdminMonitoring: jest.fn(),
      getAdminSellerReport: jest.fn(),
      getBoostRevenueReport: jest.fn(),
      getCategoryIncomeReport: jest.fn(),
      getPaidListingsReport: jest.fn(),
      getPendingSellerApprovals: jest.fn(),
      getTopSellersReport: jest.fn(),
      getWalletPaymentsReport: jest.fn(),
      listForAdmin: jest.fn(),
      listMine: jest.fn(),
      sendAdminReportEmail: jest.fn(),
      updateListingReport: jest.fn(),
    };
    controller = new ReportsController(service as never);
  });

  it('creates a listing report for the current user', () => {
    const dto = {
      reason: 'Scam listing',
      details: 'The seller asks off-site.',
    };

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

  it('passes admin monitoring filters to the service', () => {
    const query = {
      days: 14,
      topTake: 3,
    };

    controller.getAdminMonitoring(query);

    expect(service.getAdminMonitoring).toHaveBeenCalledWith(query);
  });

  it('passes active listings report filters to the service', () => {
    const query = {
      days: 30,
      take: 100,
    };

    controller.getActiveListingsReport(query);

    expect(service.getActiveListingsReport).toHaveBeenCalledWith(query);
  });

  it('passes paid listings report filters to the service', () => {
    const query = {
      days: 30,
      take: 100,
    };

    controller.getPaidListingsReport(query);

    expect(service.getPaidListingsReport).toHaveBeenCalledWith(query);
  });

  it('passes wallet payments report filters to the service', () => {
    const query = {
      days: 30,
      take: 100,
    };

    controller.getWalletPaymentsReport(query);

    expect(service.getWalletPaymentsReport).toHaveBeenCalledWith(query);
  });

  it('passes boost revenue report filters to the service', () => {
    const query = {
      days: 30,
      take: 100,
    };

    controller.getBoostRevenueReport(query);

    expect(service.getBoostRevenueReport).toHaveBeenCalledWith(query);
  });

  it('passes category income report filters to the service', () => {
    const query = {
      days: 30,
      take: 100,
    };

    controller.getCategoryIncomeReport(query);

    expect(service.getCategoryIncomeReport).toHaveBeenCalledWith(query);
  });

  it('passes admin seller report filters to the service', () => {
    const query = {
      days: 30,
      take: 100,
    };

    controller.getAdminSellerReport(query);

    expect(service.getAdminSellerReport).toHaveBeenCalledWith(query);
  });

  it('passes top sellers report filters to the service', () => {
    const query = {
      days: 30,
      take: 100,
    };

    controller.getTopSellersReport(query);

    expect(service.getTopSellersReport).toHaveBeenCalledWith(query);
  });

  it('passes pending seller approval filters to the service', () => {
    const query = {
      days: 7,
      take: 50,
    };

    controller.getPendingSellerApprovals(query);

    expect(service.getPendingSellerApprovals).toHaveBeenCalledWith(query);
  });

  it('passes admin report email requests to the service', () => {
    const dto = {
      recipients: ['admin@example.com'],
      subject: 'Active listings report',
      message: 'Please review.',
      filters: {
        days: 30,
        take: 100,
      },
    };

    controller.sendAdminReportEmail(
      { id: 'admin-1' },
      { reportType: AdminReportEmailType.ACTIVE_LISTINGS },
      dto,
    );

    expect(service.sendAdminReportEmail).toHaveBeenCalledWith(
      'admin-1',
      AdminReportEmailType.ACTIVE_LISTINGS,
      dto,
    );
  });

  it('exposes the report email route as a permission-gated POST endpoint', () => {
    const handler = ReportsController.prototype.sendAdminReportEmail;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'admin/reports/:reportType/email',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, ReportsController)).toEqual([
      JwtAuthGuard,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(
      rolesForPermission('REPORTS_EMAIL'),
    );
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
