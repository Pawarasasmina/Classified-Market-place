import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  findAll(@Query() query: QueryListingsDto) {
    return this.listingsService.findAll(query);
  }

  @Get('me/items')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: { id: string }) {
    return this.listingsService.findMine(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: { id: string },
    @Body() createListingDto: CreateListingDto,
  ) {
    return this.listingsService.create(user.id, createListingDto);
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
}
