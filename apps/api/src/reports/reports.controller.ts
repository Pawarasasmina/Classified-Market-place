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
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateListingReportDto } from './dto/create-listing-report.dto';
import { QueryListingReportsDto } from './dto/query-listing-reports.dto';
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
  @Roles('ADMIN', 'admin')
  listForAdmin(@Query() query: QueryListingReportsDto) {
    return this.reportsService.listForAdmin(query);
  }

  @Patch('admin/listing-reports/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'admin')
  updateListingReport(
    @Param('id') id: string,
    @Body() dto: UpdateListingReportDto,
  ) {
    return this.reportsService.updateListingReport(id, dto);
  }
}
