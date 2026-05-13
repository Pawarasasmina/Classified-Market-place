import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';
import { UpdateSavedSearchDto } from './dto/update-saved-search.dto';
import { SavedSearchesService } from './saved-searches.service';

@Controller('saved-searches')
@UseGuards(JwtAuthGuard)
export class SavedSearchesController {
  constructor(private readonly savedSearchesService: SavedSearchesService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.savedSearchesService.findAll(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() createSavedSearchDto: CreateSavedSearchDto,
  ) {
    return this.savedSearchesService.create(user.id, createSavedSearchDto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateSavedSearchDto: UpdateSavedSearchDto,
  ) {
    return this.savedSearchesService.update(user.id, id, updateSavedSearchDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.savedSearchesService.remove(user.id, id);
  }
}
