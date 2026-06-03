import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { rolesForPermission } from '../common/admin-permissions';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@CurrentUser() user: { id: string }) {
    return this.usersService.getCurrentUser(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateCurrentUser(
    @CurrentUser() user: { id: string },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateCurrentUser(user.id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_READ'))
  @Get('admin/all')
  listForAdmin() {
    return this.usersService.listForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('USERS_WRITE'))
  @Patch('admin/:id')
  adminUpdateUser(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateUserDto: AdminUpdateUserDto,
  ) {
    return this.usersService.adminUpdateUser(id, updateUserDto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('SUPPORT_READ'))
  @Get('admin/chat-users')
  findAdminChatUsers(@CurrentUser() user: { id: string }) {
    return this.usersService.findChatUsers(user.id, ['USER', 'user']);
  }

  @UseGuards(JwtAuthGuard)
  @Get('support/admins')
  findSupportAdmins(@CurrentUser() user: { id: string }) {
    return this.usersService.findChatUsers(user.id, ['ADMIN', 'admin']);
  }

  @Get(':id')
  getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }
}
