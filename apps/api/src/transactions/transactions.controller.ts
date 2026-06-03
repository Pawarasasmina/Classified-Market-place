import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { rolesForPermission } from '../common/admin-permissions';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { TransactionsService } from './transactions.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('transactions/me')
  listMine(
    @CurrentUser() user: { id: string },
    @Query() query: QueryTransactionsDto,
  ) {
    return this.transactionsService.listMine(user.id, query);
  }

  @Get('transactions/:id')
  findOne(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') id: string,
  ) {
    return this.transactionsService.findOne(user, id);
  }

  @Get('admin/transactions')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('TRANSACTIONS_READ'))
  listForAdmin(@Query() query: QueryTransactionsDto) {
    return this.transactionsService.listForAdmin(query);
  }
}
