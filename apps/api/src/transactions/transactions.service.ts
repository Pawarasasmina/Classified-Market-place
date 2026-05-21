import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { PrismaService } from '../prisma/prisma.service';

type ActingUser = {
  id: string;
  role: string;
};

const transactionInclude = {
  user: {
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
    },
  },
  listing: {
    select: {
      id: true,
      title: true,
      status: true,
      sellerId: true,
    },
  },
  boosts: {
    select: {
      id: true,
      placement: true,
      status: true,
      startsAt: true,
      endsAt: true,
      listingId: true,
    },
  },
} satisfies Prisma.TransactionInclude;

function isAdminRole(role: string) {
  return role.toUpperCase() === 'ADMIN';
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string, query: QueryTransactionsDto) {
    return this.prisma.transaction.findMany({
      where: this.buildTransactionWhere({
        ...query,
        userId,
      }),
      orderBy: { createdAt: 'desc' },
      take: query.take ?? 50,
      include: transactionInclude,
    });
  }

  async findOne(user: ActingUser, id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: transactionInclude,
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (!isAdminRole(user.role) && transaction.userId !== user.id) {
      throw new ForbiddenException('You can only view your own transactions');
    }

    return transaction;
  }

  listForAdmin(query: QueryTransactionsDto) {
    return this.prisma.transaction.findMany({
      where: this.buildTransactionWhere(query),
      orderBy: { createdAt: 'desc' },
      take: query.take ?? 100,
      include: transactionInclude,
    });
  }

  private buildTransactionWhere(
    query: QueryTransactionsDto,
  ): Prisma.TransactionWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.listingId ? { listingId: query.listingId } : {}),
    };
  }
}
