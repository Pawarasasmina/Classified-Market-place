import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { rolesForPermission } from '../common/admin-permissions';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CompleteWalletTopUpDto } from './dto/complete-wallet-top-up.dto';
import { CreateWalletTopUpDto } from './dto/create-wallet-top-up.dto';
import { CreditWalletDto } from './dto/credit-wallet.dto';
import { DebitWalletDto } from './dto/debit-wallet.dto';
import { WalletsService } from './wallets.service';

@Controller()
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('wallet/me')
  @UseGuards(JwtAuthGuard)
  getMine(@CurrentUser() user: { id: string }) {
    return this.walletsService.getOrCreateWallet(user.id);
  }

  @Post('wallet/top-ups')
  @UseGuards(JwtAuthGuard)
  createTopUp(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateWalletTopUpDto,
  ) {
    return this.walletsService.createTopUp(user.id, dto);
  }

  @Post('wallet/top-ups/:transactionId/payment/succeed')
  @UseGuards(JwtAuthGuard)
  completeTopUp(
    @CurrentUser() user: { id: string; role: string },
    @Param('transactionId') transactionId: string,
    @Body() dto: CompleteWalletTopUpDto,
  ) {
    return this.walletsService.completeTopUpPayment(user, transactionId, dto);
  }

  @Post('admin/wallets/:userId/credit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('WALLETS_WRITE'))
  creditWallet(
    @CurrentUser() admin: { id: string },
    @Param('userId') userId: string,
    @Body() dto: CreditWalletDto,
  ) {
    return this.walletsService.creditWallet(userId, dto, admin.id);
  }

  @Get('admin/wallets/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('WALLETS_WRITE'))
  getWalletForAdmin(@Param('userId') userId: string) {
    return this.walletsService.getWalletForAdmin(userId);
  }

  @Post('admin/wallets/:userId/debit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...rolesForPermission('WALLETS_WRITE'))
  debitWallet(
    @CurrentUser() admin: { id: string },
    @Param('userId') userId: string,
    @Body() dto: DebitWalletDto,
  ) {
    return this.walletsService.debitWallet(userId, dto, admin.id);
  }
}
