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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { BoostsService } from './boosts.service';
import { CompleteBoostPaymentDto } from './dto/complete-boost-payment.dto';
import { CreateBoostDto } from './dto/create-boost.dto';
import { QueryBoostsDto } from './dto/query-boosts.dto';

@Controller()
export class BoostsController {
  constructor(private readonly boostsService: BoostsService) {}

  @Post('listings/:id/boosts')
  @UseGuards(JwtAuthGuard)
  createForListing(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') listingId: string,
    @Body() createBoostDto: CreateBoostDto,
  ) {
    return this.boostsService.createForListing(user, listingId, createBoostDto);
  }

  @Get('listings/:id/boosts')
  listActiveForListing(@Param('id') listingId: string) {
    return this.boostsService.listActiveForListing(listingId);
  }

  @Get('boosts/me')
  @UseGuards(JwtAuthGuard)
  listMine(
    @CurrentUser() user: { id: string },
    @Query() query: QueryBoostsDto,
  ) {
    return this.boostsService.listMine(user.id, query);
  }

  @Post('boosts/:id/payment/succeed')
  @UseGuards(JwtAuthGuard)
  markPaymentSucceeded(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') boostId: string,
    @Body() completeBoostPaymentDto: CompleteBoostPaymentDto,
  ) {
    return this.boostsService.markPaymentSucceeded(
      user,
      boostId,
      completeBoostPaymentDto,
    );
  }

  @Get('admin/boosts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'admin')
  listForAdmin(@Query() query: QueryBoostsDto) {
    return this.boostsService.listForAdmin(query);
  }
}
