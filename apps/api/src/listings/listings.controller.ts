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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query() query: QueryListingsDto,
    @CurrentUser()
    user?: {
      id: string;
      role?: string;
    },
  ) {
    return this.listingsService.findAll(query, user);
  }

  @Get('me/items')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: { id: string }) {
    return this.listingsService.findMine(user.id);
  }

  @Get('saved/items')
  @UseGuards(JwtAuthGuard)
  findSaved(@CurrentUser() user: { id: string }) {
    return this.listingsService.findSaved(user.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @CurrentUser()
    user?: {
      id: string;
      role?: string;
    },
  ) {
    return this.listingsService.findOne(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: { id: string },
    @Body() createListingDto: CreateListingDto,
  ) {
    return this.listingsService.create(user.id, createListingDto);
  }

  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  save(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.listingsService.save(user.id, id);
  }

  @Delete(':id/save')
  @UseGuards(JwtAuthGuard)
  unsave(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.listingsService.unsave(user.id, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
  ) {
    return this.listingsService.update(user.id, id, updateListingDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  transitionStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateListingStatusDto: UpdateListingStatusDto,
  ) {
    return this.listingsService.transitionStatus(
      user.id,
      id,
      updateListingStatusDto,
    );
  }
}
