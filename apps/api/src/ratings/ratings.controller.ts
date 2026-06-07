import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SellerReviewStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { rolesForPermission } from '../common/admin-permissions';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ModerateSellerReviewDto } from './dto/moderate-seller-review.dto';
import { UpsertSellerRatingDto } from './dto/upsert-seller-rating.dto';
import { RatingsService } from './ratings.service';

@Controller('seller-ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('sellers/:sellerId/summary')
  getSellerSummary(@Param('sellerId') sellerId: string) {
    return this.ratingsService.getSellerSummary(sellerId);
  }

  @Get('sellers/:sellerId/reviews')
  listSellerReviews(@Param('sellerId') sellerId: string) {
    return this.ratingsService.listSellerReviews(sellerId);
  }

  @Get('admin/summaries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('REVIEWS_READ'))
  listAdminSummaries() {
    return this.ratingsService.listAdminSummaries();
  }

  @Get('admin/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('REVIEWS_READ'))
  listAdminReviews(@Query('status') status?: SellerReviewStatus) {
    return this.ratingsService.listAdminReviews(status);
  }

  @Patch('admin/reviews/:ratingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('REVIEWS_MODERATE'))
  moderateReview(
    @CurrentUser() user: { id: string },
    @Param('ratingId') ratingId: string,
    @Body() dto: ModerateSellerReviewDto,
  ) {
    return this.ratingsService.moderateReview(user, ratingId, dto);
  }

  @Delete('admin/reviews/:ratingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('REVIEWS_MODERATE'))
  deleteReview(
    @CurrentUser() user: { id: string },
    @Param('ratingId') ratingId: string,
  ) {
    return this.ratingsService.deleteReview(user, ratingId);
  }

  @Get('me/received')
  @UseGuards(JwtAuthGuard)
  listReceived(@CurrentUser() user: { id: string }) {
    return this.ratingsService.listReceived(user.id);
  }

  @Get('listings/:listingId/mine')
  @UseGuards(JwtAuthGuard)
  getMyListingRating(
    @CurrentUser() user: { id: string },
    @Param('listingId') listingId: string,
  ) {
    return this.ratingsService.getMyListingRating(user.id, listingId);
  }

  @Put('listings/:listingId')
  @UseGuards(JwtAuthGuard)
  upsertListingRating(
    @CurrentUser() user: { id: string; role: string },
    @Param('listingId') listingId: string,
    @Body() dto: UpsertSellerRatingDto,
  ) {
    return this.ratingsService.upsertListingRating(user, listingId, dto);
  }

  @Delete('listings/:listingId')
  @UseGuards(JwtAuthGuard)
  removeListingRating(
    @CurrentUser() user: { id: string },
    @Param('listingId') listingId: string,
  ) {
    return this.ratingsService.removeListingRating(user.id, listingId);
  }
}
