import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { rolesForPermission } from '../common/admin-permissions';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateListingReportDto } from './dto/create-listing-report.dto';
import { QueryActiveListingsReportDto } from './dto/query-active-listings-report.dto';
import { QueryAdminMonitoringDto } from './dto/query-admin-monitoring.dto';
import { QueryAdminSellerReportDto } from './dto/query-admin-seller-report.dto';
import { QueryBoostRevenueReportDto } from './dto/query-boost-revenue-report.dto';
import { QueryCategoryIncomeReportDto } from './dto/query-category-income-report.dto';
import { QueryListingReportsDto } from './dto/query-listing-reports.dto';
import { QueryPaidListingsReportDto } from './dto/query-paid-listings-report.dto';
import { QueryPendingSellerApprovalsDto } from './dto/query-pending-seller-approvals.dto';
import { QueryTopSellersReportDto } from './dto/query-top-sellers-report.dto';
import { QueryWalletPaymentsReportDto } from './dto/query-wallet-payments-report.dto';
import {
  AdminReportEmailParamsDto,
  SendAdminReportEmailDto,
} from './dto/send-admin-report-email.dto';
import { UpdateListingReportDto } from './dto/update-listing-report.dto';
import { ReportsService } from './reports.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('listings/:id/reports')
  createListingReport(
    @CurrentUser() user: { id: string },
    @Param('id') listingId: string,
    @Body() dto: CreateListingReportDto,
  ) {
    return this.reportsService.createListingReport(user.id, listingId, dto);
  }

  @Get('reports/me')
  listMine(
    @CurrentUser() user: { id: string },
    @Query() query: QueryListingReportsDto,
  ) {
    return this.reportsService.listMine(user.id, query);
  }

  @Get('admin/listing-reports')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_READ'))
  listForAdmin(@Query() query: QueryListingReportsDto) {
    return this.reportsService.listForAdmin(query);
  }

  @Get('admin/reports/monitoring')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_READ'))
  getAdminMonitoring(@Query() query: QueryAdminMonitoringDto) {
    return this.reportsService.getAdminMonitoring(query);
  }

  @Get('admin/reports/sellers')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_READ'))
  getAdminSellerReport(@Query() query: QueryAdminSellerReportDto) {
    return this.reportsService.getAdminSellerReport(query);
  }

  @Get('admin/reports/top-sellers')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_READ'))
  getTopSellersReport(@Query() query: QueryTopSellersReportDto) {
    return this.reportsService.getTopSellersReport(query);
  }

  @Get('admin/reports/seller-approvals')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_READ'))
  getPendingSellerApprovals(@Query() query: QueryPendingSellerApprovalsDto) {
    return this.reportsService.getPendingSellerApprovals(query);
  }

  @Get('admin/reports/active-listings')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_READ'))
  getActiveListingsReport(@Query() query: QueryActiveListingsReportDto) {
    return this.reportsService.getActiveListingsReport(query);
  }

  @Get('admin/reports/paid-listings')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_READ'))
  getPaidListingsReport(@Query() query: QueryPaidListingsReportDto) {
    return this.reportsService.getPaidListingsReport(query);
  }

  @Get('admin/reports/wallet-payments')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_READ'))
  getWalletPaymentsReport(@Query() query: QueryWalletPaymentsReportDto) {
    return this.reportsService.getWalletPaymentsReport(query);
  }

  @Get('admin/reports/category-income')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_READ'))
  getCategoryIncomeReport(@Query() query: QueryCategoryIncomeReportDto) {
    return this.reportsService.getCategoryIncomeReport(query);
  }

  @Get('admin/reports/boost-revenue')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_READ'))
  getBoostRevenueReport(@Query() query: QueryBoostRevenueReportDto) {
    return this.reportsService.getBoostRevenueReport(query);
  }

  @Post('admin/reports/:reportType/email')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_EMAIL'))
  sendAdminReportEmail(
    @CurrentUser() user: { id: string },
    @Param() params: AdminReportEmailParamsDto,
    @Body() dto: SendAdminReportEmailDto,
  ) {
    return this.reportsService.sendAdminReportEmail(
      user.id,
      params.reportType,
      dto,
    );
  }

  @Patch('admin/listing-reports/:id')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('REPORTS_WRITE'))
  updateListingReport(
    @Param('id') id: string,
    @Body() dto: UpdateListingReportDto,
  ) {
    return this.reportsService.updateListingReport(id, dto);
  }
}
