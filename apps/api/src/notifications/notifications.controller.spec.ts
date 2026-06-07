import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  let service: {
    findMine: jest.Mock;
    getUnreadCount: jest.Mock;
    markAllRead: jest.Mock;
    markRead: jest.Mock;
    remove: jest.Mock;
  };
  let controller: NotificationsController;

  beforeEach(() => {
    service = {
      findMine: jest.fn(),
      getUnreadCount: jest.fn(),
      markAllRead: jest.fn(),
      markRead: jest.fn(),
      remove: jest.fn(),
    };
    controller = new NotificationsController(service as never);
  });

  it('lists notifications for the current user only', () => {
    const query = { unread: true };

    controller.findMine({ id: 'user-1' }, query);

    expect(service.findMine).toHaveBeenCalledWith('user-1', query);
  });

  it('reads unread count for the current user only', () => {
    controller.getUnreadCount({ id: 'user-1' });

    expect(service.getUnreadCount).toHaveBeenCalledWith('user-1');
  });

  it('marks a current user notification as read', () => {
    controller.markRead({ id: 'user-1' }, 'notification-1', { read: true });

    expect(service.markRead).toHaveBeenCalledWith('user-1', 'notification-1', {
      read: true,
    });
  });

  it('marks all current user notifications as read', () => {
    controller.markAllRead({ id: 'user-1' });

    expect(service.markAllRead).toHaveBeenCalledWith('user-1');
  });

  it('deletes a current user notification', () => {
    controller.remove({ id: 'user-1' }, 'notification-1');

    expect(service.remove).toHaveBeenCalledWith('user-1', 'notification-1');
  });
});
