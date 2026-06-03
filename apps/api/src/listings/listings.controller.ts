import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { rolesForPermission } from '../common/admin-permissions';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UploadListingImageDto } from '../media/dto/upload-listing-image.dto';
import { MAX_LISTING_IMAGE_BYTES } from '../media/media.constants';
import { MediaService } from '../media/media.service';
import type { UploadedImageFile } from '../media/media.service';
import { CompleteListingPaymentDto } from './dto/complete-listing-payment.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { CreatePriorityRuleDto } from './dto/create-priority-rule.dto';
import { ModerateListingDto } from './dto/moderate-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { RecordListingViewDto } from './dto/record-listing-view.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateListingPriorityOverrideDto } from './dto/update-listing-priority-override.dto';
import { UpdatePriorityRuleDto } from './dto/update-priority-rule.dto';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly mediaService: MediaService,
  ) {}

  @Get()
  findAll(@Query() query: QueryListingsDto) {
    return this.listingsService.findAll(query);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('LISTINGS_READ'))
  findAllForAdmin(@Query() query: QueryListingsDto) {
    return this.listingsService.findAll(query, true);
  }

  @Get('admin/priority-rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('LISTINGS_PRIORITY'))
  listPriorityRules() {
    return this.listingsService.listPriorityRules();
  }

  @Post('admin/priority-rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('LISTINGS_PRIORITY'))
  createPriorityRule(@Body() dto: CreatePriorityRuleDto) {
    return this.listingsService.createPriorityRule(dto);
  }

  @Patch('admin/priority-rules/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('LISTINGS_PRIORITY'))
  updatePriorityRule(
    @Param('id') id: string,
    @Body() dto: UpdatePriorityRuleDto,
  ) {
    return this.listingsService.updatePriorityRule(id, dto);
  }

  @Delete('admin/priority-rules/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('LISTINGS_PRIORITY'))
  deletePriorityRule(@Param('id') id: string) {
    return this.listingsService.deletePriorityRule(id);
  }

  @Patch('admin/:id/priority-override')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('LISTINGS_PRIORITY'))
  updatePriorityOverride(
    @Param('id') id: string,
    @Body() dto: UpdateListingPriorityOverrideDto,
  ) {
    return this.listingsService.updatePriorityOverride(id, dto);
  }

  @Get('me/items')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: { id: string }) {
    return this.listingsService.findMine(user.id);
  }

  @Get('me/quota')
  @UseGuards(JwtAuthGuard)
  getMyListingQuota(@CurrentUser() user: { id: string }) {
    return this.listingsService.getMyListingQuota(user.id);
  }

  @Get('me/saved')
  @UseGuards(JwtAuthGuard)
  findMySavedListings(@CurrentUser() user: { id: string }) {
    return this.listingsService.findSaved(user.id);
  }

  @Get('me/items/:id')
  @UseGuards(JwtAuthGuard)
  findMineOne(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') id: string,
  ) {
    return this.listingsService.findOneForUser(user, id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @Post(':id/views')
  recordView(@Param('id') id: string, @Body() dto: RecordListingViewDto) {
    return this.listingsService.recordView(id, dto);
  }

  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  saveListing(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.listingsService.saveListing(user.id, id);
  }

  @Delete(':id/save')
  @UseGuards(JwtAuthGuard)
  unsaveListing(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.listingsService.unsaveListing(user.id, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: { id: string; role: string },
    @Body() createListingDto: CreateListingDto,
  ) {
    return this.listingsService.create(user, createListingDto);
  }

  @Post(':id/payment/succeed')
  @UseGuards(JwtAuthGuard)
  markListingPaymentSucceeded(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') id: string,
    @Body() dto: CompleteListingPaymentDto,
  ) {
    return this.listingsService.markListingPaymentSucceeded(user, id, dto);
  }

  @Post('images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LISTING_IMAGE_BYTES, files: 1 },
    }),
  )
  uploadImage(
    @CurrentUser() user: { id: string; role?: string },
    @Body() dto: UploadListingImageDto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.mediaService.uploadListingImage(user, file, dto.listingId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
  ) {
    return this.listingsService.update(user, id, updateListingDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') id: string,
  ) {
    return this.listingsService.remove(user, id);
  }

  @Patch('admin/:id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('LISTINGS_MODERATE'))
  moderate(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ModerateListingDto,
  ) {
    return this.listingsService.moderate(user, id, dto);
  }
}
