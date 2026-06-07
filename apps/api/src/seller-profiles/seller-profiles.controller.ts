import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { rolesForPermission } from '../common/admin-permissions';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  AssignSellerBadgeDto,
  CreateSellerDocumentRequestDto,
  QuerySellerProfilesDto,
  RequestVerifiedSellerDto,
  ReviewSellerDocumentDto,
  ReviewSellerProfileDto,
  ReviewVerifiedSellerDto,
  SellerDocumentSubmissionDto,
  SubmitSellerProfileDto,
  UpdateSellerFormDefinitionDto,
  UpdateSellerProfileDto,
  UpsertSellerBadgeTypeDto,
  UpsertSellerPrivilegeQuotaDto,
  UpsertSellerPrivilegeTierDto,
} from './dto/seller-profiles.dto';
import { SellerProfilesService } from './seller-profiles.service';

@Controller('seller-profiles')
export class SellerProfilesController {
  constructor(private readonly sellerProfilesService: SellerProfilesService) {}

  @Get('form')
  getSellerFormDefinition() {
    return this.sellerProfilesService.getSellerFormDefinition();
  }

  @Get('public/:userId')
  getPublicSellerProfile(@Param('userId') userId: string) {
    return this.sellerProfilesService.getPublicSellerProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMySellerProfile(@CurrentUser() user: { id: string }) {
    return this.sellerProfilesService.getMySellerProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/switch')
  switchToSeller(@CurrentUser() user: { id: string; role: string }) {
    return this.sellerProfilesService.switchToSeller(user.id, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMySellerProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateSellerProfileDto,
  ) {
    return this.sellerProfilesService.updateMySellerProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/submit')
  submitMySellerProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitSellerProfileDto,
  ) {
    return this.sellerProfilesService.submitMySellerProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/documents')
  submitSellerDocument(
    @CurrentUser() user: { id: string },
    @Body() dto: SellerDocumentSubmissionDto,
  ) {
    return this.sellerProfilesService.submitSellerDocument(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/verified/request')
  requestVerifiedSeller(
    @CurrentUser() user: { id: string },
    @Body() dto: RequestVerifiedSellerDto,
  ) {
    return this.sellerProfilesService.requestVerifiedSeller(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_READ'))
  @Get('admin/overview')
  getAdminSellerOverview() {
    return this.sellerProfilesService.getAdminSellerOverview();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_READ'))
  @Get('admin/all')
  listSellerProfiles(@Query() query: QuerySellerProfilesDto) {
    return this.sellerProfilesService.listSellerProfiles(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_READ'))
  @Get('admin/:id')
  getSellerProfileForAdmin(@Param('id') id: string) {
    return this.sellerProfilesService.getSellerProfileForAdmin(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Patch('admin/:id/review')
  reviewSellerProfile(
    @CurrentUser() actor: { id: string },
    @Param('id') id: string,
    @Body() dto: ReviewSellerProfileDto,
  ) {
    return this.sellerProfilesService.reviewSellerProfile(id, actor.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Post('admin/:id/document-requests')
  createSellerDocumentRequest(
    @Param('id') id: string,
    @Body() dto: CreateSellerDocumentRequestDto,
  ) {
    return this.sellerProfilesService.createSellerDocumentRequest(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Patch('admin/documents/:id/review')
  reviewSellerDocument(
    @CurrentUser() actor: { id: string },
    @Param('id') id: string,
    @Body() dto: ReviewSellerDocumentDto,
  ) {
    return this.sellerProfilesService.reviewSellerDocument(id, actor.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Patch('admin/:id/verified')
  reviewVerifiedSeller(
    @CurrentUser() actor: { id: string },
    @Param('id') id: string,
    @Body() dto: ReviewVerifiedSellerDto,
  ) {
    return this.sellerProfilesService.reviewVerifiedSeller(id, actor.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_READ'))
  @Get('admin/form')
  getAdminSellerFormDefinition() {
    return this.sellerProfilesService.getSellerFormDefinition();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Put('admin/form')
  updateAdminSellerFormDefinition(
    @Body() dto: UpdateSellerFormDefinitionDto,
  ) {
    return this.sellerProfilesService.updateSellerFormDefinition(
      dto.schemaDefinition,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_READ'))
  @Get('admin/privileges')
  listSellerPrivilegeTiers() {
    return this.sellerProfilesService.listSellerPrivilegeTiers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Post('admin/privileges')
  upsertSellerPrivilegeTier(@Body() dto: UpsertSellerPrivilegeTierDto) {
    return this.sellerProfilesService.upsertSellerPrivilegeTier(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Patch('admin/privileges/:id')
  updateSellerPrivilegeTier(
    @Param('id') id: string,
    @Body() dto: UpsertSellerPrivilegeTierDto,
  ) {
    return this.sellerProfilesService.upsertSellerPrivilegeTier({
      ...dto,
      id,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Post('admin/privileges/:id/quotas')
  upsertSellerPrivilegeQuota(
    @Param('id') id: string,
    @Body() dto: UpsertSellerPrivilegeQuotaDto,
  ) {
    return this.sellerProfilesService.upsertSellerPrivilegeQuota(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Post('admin/privileges/:id/quotas/apply-default')
  applyDefaultQuotaToAllCategories(@Param('id') id: string) {
    return this.sellerProfilesService.applyDefaultQuotaToAllCategories(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Post('admin/privileges/:id/quotas/zero-all')
  setAllCategoryQuotasToZero(@Param('id') id: string) {
    return this.sellerProfilesService.setAllCategoryQuotasToZero(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_READ'))
  @Get('admin/badges')
  listSellerBadges() {
    return this.sellerProfilesService.listSellerBadges();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Post('admin/badges')
  upsertSellerBadgeType(@Body() dto: UpsertSellerBadgeTypeDto) {
    return this.sellerProfilesService.upsertSellerBadgeType(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Patch('admin/badges/:id')
  updateSellerBadgeType(
    @Param('id') id: string,
    @Body() dto: UpsertSellerBadgeTypeDto,
  ) {
    return this.sellerProfilesService.upsertSellerBadgeType({
      ...dto,
      id,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Post('admin/:id/badges')
  assignSellerBadge(
    @CurrentUser() actor: { id: string },
    @Param('id') id: string,
    @Body() dto: AssignSellerBadgeDto,
  ) {
    return this.sellerProfilesService.assignSellerBadge(id, actor.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Delete('admin/:id/badges/:assignmentId')
  removeSellerBadge(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.sellerProfilesService.removeSellerBadge(id, assignmentId);
  }
}
