import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateListingReportDto } from './dto/create-listing-report.dto';
import { ModerateListingDto } from './dto/moderate-listing.dto';
import { QueryModerationQueueDto } from './dto/query-moderation-queue.dto';
import { ModerationService } from './moderation.service';

@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('listings/:listingId/reports')
  @UseGuards(JwtAuthGuard)
  createReport(
    @CurrentUser() user: { id: string },
    @Param('listingId') listingId: string,
    @Body() createListingReportDto: CreateListingReportDto,
  ) {
    return this.moderationService.createListingReport(
      user.id,
      listingId,
      createListingReportDto,
    );
  }

  @Get('queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  findQueue(@Query() query: QueryModerationQueueDto) {
    return this.moderationService.findModerationQueue(query);
  }

  @Get('reports/:reportId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  findReport(@Param('reportId') reportId: string) {
    return this.moderationService.findReport(reportId);
  }

  @Get('listings/:listingId/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  findListingHistory(@Param('listingId') listingId: string) {
    return this.moderationService.findListingHistory(listingId);
  }

  @Post('listings/:listingId/actions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  moderateListing(
    @CurrentUser() user: { id: string },
    @Param('listingId') listingId: string,
    @Body() moderateListingDto: ModerateListingDto,
  ) {
    return this.moderationService.moderateListing(
      user.id,
      listingId,
      moderateListingDto,
    );
  }
}
