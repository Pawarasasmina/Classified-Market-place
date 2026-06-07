import {
  Body,
  Controller,
  Delete,
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
import { BoostsService } from './boosts.service';
import { CompleteBoostPaymentDto } from './dto/complete-boost-payment.dto';
import { CreateBoostPackageDto } from './dto/create-boost-package.dto';
import { CreateBoostDto } from './dto/create-boost.dto';
import { QueryBoostsDto } from './dto/query-boosts.dto';
import { UpdateBoostPackageDto } from './dto/update-boost-package.dto';

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

  @Get('boost-packages')
  listActivePackages() {
    return this.boostsService.listPackages();
  }

  @Get('listings/:id/boost-packages')
  listPackagesForListing(@Param('id') listingId: string) {
    return this.boostsService.listPackagesForListing(listingId);
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
  @Roles(...rolesForPermission('BOOSTS_READ'))
  listForAdmin(@Query() query: QueryBoostsDto) {
    return this.boostsService.listForAdmin(query);
  }

  @Get('admin/boosted-listings/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('BOOSTS_READ'))
  listActiveBoostedListings(@Query() query: QueryBoostsDto) {
    return this.boostsService.listActiveBoostedListings(query);
  }

  @Post('admin/boosts/expire-ended')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('BOOSTS_WRITE'))
  expireEndedBoosts() {
    return this.boostsService.expireEndedBoosts();
  }

  @Get('admin/boost-packages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('BOOSTS_READ'))
  listPackagesForAdmin() {
    return this.boostsService.listPackages(true);
  }

  @Post('admin/boost-packages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('BOOSTS_WRITE'))
  createPackage(@Body() dto: CreateBoostPackageDto) {
    return this.boostsService.createPackage(dto);
  }

  @Patch('admin/boost-packages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('BOOSTS_WRITE'))
  updatePackage(@Param('id') id: string, @Body() dto: UpdateBoostPackageDto) {
    return this.boostsService.updatePackage(id, dto);
  }

  @Delete('admin/boost-packages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('BOOSTS_WRITE'))
  removePackage(@Param('id') id: string) {
    return this.boostsService.removePackage(id);
  }
}
