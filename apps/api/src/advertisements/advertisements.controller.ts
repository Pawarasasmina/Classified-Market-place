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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { rolesForPermission } from '../common/admin-permissions';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdvertisementsService } from './advertisements.service';
import { CreateAdvertisementBannerDto } from './dto/create-advertisement-banner.dto';
import { UpdateAdvertisementBannerDto } from './dto/update-advertisement-banner.dto';

@Controller('advertisements')
export class AdvertisementsController {
  constructor(private readonly advertisementsService: AdvertisementsService) {}

  @Get('home')
  findActiveHomeBanners() {
    return this.advertisementsService.findActiveHomeBanners();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('BOOSTS_READ'))
  @Get('admin/all')
  findAllForAdmin() {
    return this.advertisementsService.findAllForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('BOOSTS_WRITE'))
  @Post('admin')
  create(@Body() dto: CreateAdvertisementBannerDto) {
    return this.advertisementsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('BOOSTS_WRITE'))
  @Patch('admin/:id')
  update(@Param('id') id: string, @Body() dto: UpdateAdvertisementBannerDto) {
    return this.advertisementsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('BOOSTS_WRITE'))
  @Delete('admin/:id')
  remove(@Param('id') id: string) {
    return this.advertisementsService.remove(id);
  }
}
