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
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MAX_LISTING_IMAGE_BYTES } from '../media/media.constants';
import { MediaService } from '../media/media.service';
import type { UploadedImageFile } from '../media/media.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ModerateListingDto } from './dto/moderate-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
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
  @Roles('ADMIN', 'admin')
  findAllForAdmin(@Query() query: QueryListingsDto) {
    return this.listingsService.findAll(query, true);
  }

  @Get('me/items')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: { id: string }) {
    return this.listingsService.findMine(user.id);
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

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: { id: string; role: string },
    @Body() createListingDto: CreateListingDto,
  ) {
    return this.listingsService.create(user, createListingDto);
  }

  @Post('images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LISTING_IMAGE_BYTES, files: 1 },
    }),
  )
  uploadImage(
    @CurrentUser() user: { id: string },
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.mediaService.uploadListingImage(user.id, file);
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
  @Roles('ADMIN', 'admin')
  moderate(@Param('id') id: string, @Body() dto: ModerateListingDto) {
    return this.listingsService.moderate(id, dto);
  }
}
