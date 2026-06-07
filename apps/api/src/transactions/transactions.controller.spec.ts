import { TransactionStatus, TransactionType } from '@prisma/client';
import { TransactionsController } from './transactions.controller';

describe('TransactionsController', () => {
  let service: {
    findOne: jest.Mock;
    listForAdmin: jest.Mock;
    listMine: jest.Mock;
  };
  let controller: TransactionsController;

  beforeEach(() => {
    service = {
      findOne: jest.fn(),
      listForAdmin: jest.fn(),
      listMine: jest.fn(),
    };
    controller = new TransactionsController(service as never);
  });

  it('lists payment history for the current user', () => {
    const query = { status: TransactionStatus.SUCCEEDED };

    controller.listMine({ id: 'user-1' }, query);

    expect(service.listMine).toHaveBeenCalledWith('user-1', query);
  });

  it('passes current actor to transaction detail lookup', () => {
    const user = { id: 'user-1', role: 'USER' };

    controller.findOne(user, 'transaction-1');

    expect(service.findOne).toHaveBeenCalledWith(user, 'transaction-1');
  });

  it('passes admin transaction filters to the service', () => {
    const query = {
      status: TransactionStatus.PENDING,
      type: TransactionType.BOOST_PURCHASE,
      userId: 'user-1',
      listingId: 'listing-1',
    };

    controller.listForAdmin(query);

    expect(service.listForAdmin).toHaveBeenCalledWith(query);
  });
});
