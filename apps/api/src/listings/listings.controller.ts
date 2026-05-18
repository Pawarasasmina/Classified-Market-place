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
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { VerifiedPhoneGuard } from '../common/guards/verified-phone.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { ModerateListingDto } from './dto/moderate-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { SaveListingDraftDto } from './dto/save-listing-draft.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, VerifiedPhoneGuard)
  create(
    @CurrentUser() user: { id: string; role: string; phoneVerified: boolean },
    @Body() createListingDto: CreateListingDto,
  ) {
    return this.listingsService.create(user, createListingDto);
  }

  @Post('drafts')
  @UseGuards(JwtAuthGuard)
  saveDraft(
    @CurrentUser() user: { id: string; role: string },
    @Body() saveListingDraftDto: SaveListingDraftDto,
  ) {
    return this.listingsService.saveDraft(user, saveListingDraftDto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, VerifiedPhoneGuard)
  publishDraft(
    @CurrentUser() user: { id: string; role: string; phoneVerified: boolean },
    @Param('id') id: string,
    @Body() createListingDto: CreateListingDto,
  ) {
    return this.listingsService.publishDraft(user, id, createListingDto);
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
