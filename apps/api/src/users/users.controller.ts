import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

  @Get(':id')
  getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }
}
