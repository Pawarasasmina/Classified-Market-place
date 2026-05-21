import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingStatus,
  MessageType,
  NotificationType,
  OfferStatus,
} from '@prisma/client';
import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  function createService() {
    const prisma = {
      conversationParticipant: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      conversation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      listing: {
        findUnique: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      messageReadReceipt: {
        upsert: jest.fn(),
      },
      messageHidden: {
        upsert: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      userBlock: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      conversationReport: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      messageReport: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (operations: unknown[]) => operations),
    };
    const encryption = {
      encrypt: jest.fn(() => ({
        encryptedBody: 'encrypted',
        encryptedPayload: null,
        encryptionIv: 'iv',
        encryptionAuthTag: 'tag',
      })),
      decrypt: jest.fn(() => ({
        body: 'Decrypted body',
        payload: null,
      })),
    };
    const presence = {
      isOnline: jest.fn(() => false),
    };
    const pushNotifications = {
      notifyInactiveRecipient: jest.fn(),
    };
    const notifications = {
      notifyMessage: jest.fn(),
    };

    const service = new MessagingService(
      prisma as never,
      encryption as never,
      presence as never,
      pushNotifications as never,
      notifications as never,
    );

    return {
      service,
      prisma,
      encryption,
      presence,
      pushNotifications,
      notifications,
    };
  }

  function buildConversation(overrides: Record<string, unknown> = {}) {
    return {
      id: 'conversation-1',
      listingId: 'listing-1',
      listing: {
        id: 'listing-1',
        sellerId: 'seller-1',
        title: 'Toyota Camry',
        price: { toString: () => '1000' },
        currency: 'AED',
        location: 'Dubai',
        status: ListingStatus.ACTIVE,
        category: { name: 'Cars' },
        images: [],
      },
      participants: [
        {
          userId: 'buyer-1',
          unreadCount: 0,
          archivedAt: null,
          mutedAt: null,
          user: {
            id: 'buyer-1',
            displayName: 'Buyer',
            role: 'USER',
            avatarUrl: null,
          },
        },
        {
          userId: 'seller-1',
          unreadCount: 0,
          archivedAt: null,
          mutedAt: null,
          user: {
            id: 'seller-1',
            displayName: 'Seller',
            role: 'USER',
            avatarUrl: null,
          },
        },
      ],
      messages: [],
      updatedAt: new Date('2026-05-15T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('reuses an existing listing conversation for the same buyer and seller', async () => {
    const { service, prisma } = createService();
    const existingConversation = buildConversation();

    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      title: 'Toyota Camry',
      price: { toString: () => '1000' },
      currency: 'AED',
      location: 'Dubai',
      status: ListingStatus.ACTIVE,
      category: { name: 'Cars' },
      images: [],
    });
    prisma.conversation.findMany.mockResolvedValue([existingConversation]);
    prisma.conversationParticipant.update.mockResolvedValue({});
    prisma.userBlock.findMany.mockResolvedValue([]);
    prisma.conversation.findUnique.mockResolvedValue(existingConversation);

    const result = await service.createConversation('buyer-1', {
      listingId: 'listing-1',
    });

    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(result.id).toBe('conversation-1');
  });

  it('blocks creating a new listing conversation for a sold listing', async () => {
    const { service, prisma } = createService();

    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      title: 'Toyota Camry',
      price: { toString: () => '1000' },
      currency: 'AED',
      location: 'Dubai',
      status: ListingStatus.SOLD,
      category: { name: 'Cars' },
      images: [],
    });
    prisma.conversation.findMany.mockResolvedValue([]);
    prisma.userBlock.findMany.mockResolvedValue([]);

    await expect(
      service.createConversation('buyer-1', { listingId: 'listing-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('prevents non-participants from reading conversation messages', async () => {
    const { service, prisma } = createService();

    prisma.conversationParticipant.findUnique.mockResolvedValue(null);

    await expect(
      service.findMessages('buyer-1', 'conversation-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('marks a conversation as read and clears unread count', async () => {
    const { service, prisma } = createService();

    prisma.conversationParticipant.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'buyer-1',
    });
    prisma.message.findMany.mockResolvedValue([{ id: 'message-1' }]);
    prisma.conversationParticipant.update.mockResolvedValue({});
    prisma.messageReadReceipt.upsert.mockResolvedValue({});

    const result = await service.markRead('buyer-1', 'conversation-1');

    expect(prisma.conversationParticipant.update).toHaveBeenCalledWith({
      where: {
        conversationId_userId: {
          conversationId: 'conversation-1',
          userId: 'buyer-1',
        },
      },
      data: {
        unreadCount: 0,
        lastReadAt: expect.any(Date),
        archivedAt: null,
      },
    });
    expect(result).toEqual({
      conversationId: 'conversation-1',
      userId: 'buyer-1',
      readAt: expect.any(Date),
    });
  });

  it('blocks sending a message when the linked listing is removed', async () => {
    const { service, prisma } = createService();

    prisma.conversationParticipant.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'buyer-1',
    });
    prisma.conversation.findUnique.mockResolvedValue(
      buildConversation({
        listing: {
          id: 'listing-1',
          sellerId: 'seller-1',
          title: 'Toyota Camry',
          price: { toString: () => '1000' },
          currency: 'AED',
          location: 'Dubai',
          status: ListingStatus.REMOVED,
          category: { name: 'Cars' },
          images: [],
        },
      }),
    );
    prisma.userBlock.findMany.mockResolvedValue([]);

    await expect(
      service.sendMessage('buyer-1', 'conversation-1', {
        type: MessageType.TEXT,
        body: 'Still available?',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('blocks sending a message when the counterpart has blocked the sender', async () => {
    const { service, prisma } = createService();

    prisma.conversationParticipant.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'buyer-1',
    });
    prisma.conversation.findUnique.mockResolvedValue(buildConversation());
    prisma.userBlock.findMany.mockResolvedValue([
      {
        blockerId: 'seller-1',
        blockedUserId: 'buyer-1',
      },
    ]);

    await expect(
      service.sendMessage('buyer-1', 'conversation-1', {
        type: MessageType.TEXT,
        body: 'Still available?',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('persists a notification for message recipients when sending a message', async () => {
    const { service, prisma, notifications } = createService();
    const conversation = buildConversation();
    const message = {
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'buyer-1',
      sender: {
        id: 'buyer-1',
        displayName: 'Buyer',
        role: 'USER',
        avatarUrl: null,
      },
      type: MessageType.TEXT,
      offerAmount: null,
      offerCurrency: null,
      offerStatus: null,
      encryptedBody: 'encrypted',
      encryptedPayload: null,
      encryptionIv: 'iv',
      encryptionAuthTag: 'tag',
      legacyBody: null,
      listingId: 'listing-1',
      listing: conversation.listing,
      readReceipts: [],
      createdAt: new Date('2026-05-15T00:00:00.000Z'),
      updatedAt: new Date('2026-05-15T00:00:00.000Z'),
    };

    prisma.conversationParticipant.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'buyer-1',
    });
    prisma.conversation.findUnique.mockResolvedValue(conversation);
    prisma.userBlock.findMany.mockResolvedValue([]);
    prisma.message.create.mockResolvedValue(message);
    prisma.conversation.update.mockResolvedValue({});
    prisma.conversationParticipant.updateMany.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({
      id: 'buyer-1',
      displayName: 'Buyer',
    });
    prisma.conversationParticipant.findMany.mockResolvedValue([
      {
        conversationId: 'conversation-1',
        userId: 'seller-1',
        mutedAt: null,
      },
    ]);

    await service.sendMessage('buyer-1', 'conversation-1', {
      type: MessageType.TEXT,
      body: 'Still available?',
    });

    expect(notifications.notifyMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: ['seller-1'],
        actorId: 'buyer-1',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        listingId: 'listing-1',
        messageType: MessageType.TEXT,
        notificationType: NotificationType.MESSAGE,
        senderName: 'Buyer',
        preview: 'Decrypted body',
        metadata: {
          listingTitle: 'Toyota Camry',
        },
      }),
    );
  });

  it('allows only the seller to accept a pending offer and emits a system update', async () => {
    const { service, prisma, encryption, pushNotifications, notifications } =
      createService();
    const conversation = buildConversation();
    const offerMessage = {
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'buyer-1',
      sender: {
        id: 'buyer-1',
        displayName: 'Buyer',
        role: 'USER',
        avatarUrl: null,
      },
      type: MessageType.OFFER,
      offerAmount: { toString: () => '850' },
      offerCurrency: 'AED',
      offerStatus: OfferStatus.PENDING,
      encryptedBody: 'encrypted',
      encryptedPayload: null,
      encryptionIv: 'iv',
      encryptionAuthTag: 'tag',
      legacyBody: null,
      listingId: 'listing-1',
      listing: conversation.listing,
      readReceipts: [],
      createdAt: new Date('2026-05-15T00:00:00.000Z'),
      updatedAt: new Date('2026-05-15T00:00:00.000Z'),
      conversation,
    };
    const updatedOffer = {
      ...offerMessage,
      offerStatus: OfferStatus.ACCEPTED,
    };
    const systemMessage = {
      id: 'message-2',
      conversationId: 'conversation-1',
      senderId: 'seller-1',
      sender: {
        id: 'seller-1',
        displayName: 'Seller',
        role: 'USER',
        avatarUrl: null,
      },
      type: MessageType.SYSTEM,
      offerAmount: null,
      offerCurrency: null,
      offerStatus: null,
      encryptedBody: 'encrypted',
      encryptedPayload: JSON.stringify({
        kind: 'offer_status',
        offerMessageId: 'message-1',
        status: OfferStatus.ACCEPTED,
      }),
      encryptionIv: 'iv',
      encryptionAuthTag: 'tag',
      legacyBody: null,
      listingId: null,
      listing: null,
      readReceipts: [],
      createdAt: new Date('2026-05-15T00:01:00.000Z'),
      updatedAt: new Date('2026-05-15T00:01:00.000Z'),
    };

    prisma.message.findUnique.mockResolvedValue(offerMessage);
    encryption.decrypt.mockImplementation(({ encryptedPayload }) => ({
      body: 'Decrypted body',
      payload:
        typeof encryptedPayload === 'string' && encryptedPayload
          ? JSON.parse(encryptedPayload)
          : null,
    }));
    prisma.conversationParticipant.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'seller-1',
    });
    prisma.userBlock.findMany.mockResolvedValue([]);
    prisma.message.update.mockResolvedValue(updatedOffer);
    prisma.message.create.mockResolvedValue(systemMessage);
    prisma.conversation.update.mockResolvedValue({});
    prisma.conversationParticipant.updateMany.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({
      id: 'seller-1',
      displayName: 'Seller',
    });
    prisma.conversationParticipant.findMany.mockResolvedValue([
      {
        conversationId: 'conversation-1',
        userId: 'buyer-1',
        mutedAt: null,
      },
    ]);

    const result = await service.updateOffer('seller-1', 'message-1', {
      status: 'ACCEPTED',
    });

    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: 'message-1' },
      data: { offerStatus: 'ACCEPTED' },
      include: expect.any(Object),
    });
    expect(result.offerMessage.offerStatus).toBe('ACCEPTED');
    expect(result.systemMessage.type).toBe('SYSTEM');
    expect(pushNotifications.notifyInactiveRecipient).toHaveBeenCalled();
    expect(notifications.notifyMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: ['buyer-1'],
        actorId: 'seller-1',
        conversationId: 'conversation-1',
        messageId: 'message-2',
        notificationType: NotificationType.OFFER,
        senderName: 'Seller',
      }),
    );
  });

  it('updates archive and mute preferences for a participant', async () => {
    const { service, prisma } = createService();
    const archivedConversation = buildConversation({
      participants: [
        {
          userId: 'buyer-1',
          unreadCount: 0,
          archivedAt: new Date('2026-05-15T01:00:00.000Z'),
          mutedAt: new Date('2026-05-15T01:00:00.000Z'),
          user: {
            id: 'buyer-1',
            displayName: 'Buyer',
            role: 'USER',
            avatarUrl: null,
          },
        },
        {
          userId: 'seller-1',
          unreadCount: 0,
          archivedAt: null,
          mutedAt: null,
          user: {
            id: 'seller-1',
            displayName: 'Seller',
            role: 'USER',
            avatarUrl: null,
          },
        },
      ],
    });

    prisma.conversationParticipant.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'buyer-1',
    });
    prisma.conversationParticipant.update.mockResolvedValue({});
    prisma.conversation.findUnique.mockResolvedValue(archivedConversation);
    prisma.userBlock.findMany.mockResolvedValue([]);

    const result = await service.updateConversationPreferences(
      'buyer-1',
      'conversation-1',
      {
        archived: true,
        muted: true,
      },
    );

    expect(prisma.conversationParticipant.update).toHaveBeenCalledWith({
      where: {
        conversationId_userId: {
          conversationId: 'conversation-1',
          userId: 'buyer-1',
        },
      },
      data: {
        archivedAt: expect.any(Date),
        mutedAt: expect.any(Date),
      },
    });
    expect(result.archivedAt).toEqual(expect.any(Date));
    expect(result.mutedAt).toEqual(expect.any(Date));
  });

  it('reports a message only for conversation participants', async () => {
    const { service, prisma } = createService();

    prisma.message.findUnique.mockResolvedValue({
      id: 'message-1',
      conversationId: 'conversation-1',
    });
    prisma.conversationParticipant.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'buyer-1',
    });
    prisma.messageReport.create.mockResolvedValue({
      id: 'report-1',
      status: 'OPEN',
      createdAt: new Date('2026-05-15T00:00:00.000Z'),
    });

    const result = await service.reportMessage('buyer-1', 'message-1', {
      reason: 'Spam',
    });

    expect(result.id).toBe('report-1');
  });

  it('rejects reporting a message that does not exist', async () => {
    const { service, prisma } = createService();

    prisma.message.findUnique.mockResolvedValue(null);

    await expect(
      service.reportMessage('buyer-1', 'missing-message', {
        reason: 'Spam',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows a sender to delete their own message for everyone within the delete window', async () => {
    const { service, prisma } = createService();
    const conversation = buildConversation();
    const message = {
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'buyer-1',
      sender: {
        id: 'buyer-1',
        displayName: 'Buyer',
        role: 'USER',
        avatarUrl: null,
      },
      type: MessageType.TEXT,
      encryptedBody: 'encrypted',
      encryptedPayload: null,
      encryptionIv: 'iv',
      encryptionAuthTag: 'tag',
      legacyBody: 'Hello',
      listingId: 'listing-1',
      listing: conversation.listing,
      offerAmount: null,
      offerCurrency: null,
      offerStatus: null,
      deletedAt: null,
      readReceipts: [],
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      conversation,
    };
    const deletedMessage = {
      ...message,
      legacyBody: null,
      encryptedBody: null,
      encryptionIv: '',
      encryptionAuthTag: '',
      deletedAt: new Date('2026-05-15T00:05:00.000Z'),
      updatedAt: new Date('2026-05-15T00:05:00.000Z'),
    };

    prisma.message.findUnique.mockResolvedValue(message);
    prisma.conversationParticipant.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'buyer-1',
    });
    prisma.message.update.mockResolvedValue(deletedMessage);
    prisma.conversation.update.mockResolvedValue({});
    prisma.conversationParticipant.updateMany.mockResolvedValue({});

    const result = await service.deleteMessage(
      'buyer-1',
      'message-1',
      'everyone',
    );

    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: 'message-1' },
      data: {
        deletedAt: expect.any(Date),
        encryptedBody: null,
        encryptedPayload: null,
        encryptionIv: '',
        encryptionAuthTag: '',
        legacyBody: null,
      },
      include: expect.any(Object),
    });
    expect(result.scope).toBe('everyone');
    expect(result.message.deletedAt).toEqual(expect.any(Date));
    expect(result.message.body).toBe('This message was deleted');
  });

  it('does not allow deleting a message for everyone after the time window expires', async () => {
    const { service, prisma } = createService();
    const conversation = buildConversation();

    prisma.message.findUnique.mockResolvedValue({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'buyer-1',
      sender: {
        id: 'buyer-1',
        displayName: 'Buyer',
        role: 'USER',
        avatarUrl: null,
      },
      type: MessageType.TEXT,
      encryptedBody: 'encrypted',
      encryptedPayload: null,
      encryptionIv: 'iv',
      encryptionAuthTag: 'tag',
      legacyBody: 'Hello',
      listingId: 'listing-1',
      listing: conversation.listing,
      offerAmount: null,
      offerCurrency: null,
      offerStatus: null,
      deletedAt: null,
      readReceipts: [],
      createdAt: new Date(Date.now() - 16 * 60 * 1000),
      updatedAt: new Date('2026-05-15T00:00:00.000Z'),
      conversation,
    });
    prisma.conversationParticipant.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'buyer-1',
    });

    await expect(
      service.deleteMessage('buyer-1', 'message-1', 'everyone'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('lets a participant delete a message only for themselves', async () => {
    const { service, prisma } = createService();
    const conversation = buildConversation();
    const visibleLastMessage = {
      id: 'message-2',
      conversationId: 'conversation-1',
      senderId: 'seller-1',
      sender: {
        id: 'seller-1',
        displayName: 'Seller',
        role: 'USER',
        avatarUrl: null,
      },
      type: MessageType.TEXT,
      encryptedBody: 'encrypted',
      encryptedPayload: null,
      encryptionIv: 'iv',
      encryptionAuthTag: 'tag',
      legacyBody: 'Visible',
      listingId: 'listing-1',
      listing: conversation.listing,
      offerAmount: null,
      offerCurrency: null,
      offerStatus: null,
      deletedAt: null,
      readReceipts: [],
      createdAt: new Date('2026-05-15T00:03:00.000Z'),
      updatedAt: new Date('2026-05-15T00:03:00.000Z'),
    };

    prisma.message.findUnique.mockResolvedValue({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'seller-1',
      sender: {
        id: 'seller-1',
        displayName: 'Seller',
        role: 'USER',
        avatarUrl: null,
      },
      type: MessageType.TEXT,
      encryptedBody: 'encrypted',
      encryptedPayload: null,
      encryptionIv: 'iv',
      encryptionAuthTag: 'tag',
      legacyBody: 'Hide me',
      listingId: 'listing-1',
      listing: conversation.listing,
      offerAmount: null,
      offerCurrency: null,
      offerStatus: null,
      deletedAt: null,
      readReceipts: [],
      createdAt: new Date('2026-05-15T00:00:00.000Z'),
      updatedAt: new Date('2026-05-15T00:00:00.000Z'),
      conversation,
    });
    prisma.conversationParticipant.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'buyer-1',
    });
    prisma.messageHidden.upsert.mockResolvedValue({});
    prisma.message.findFirst = jest.fn().mockResolvedValue(visibleLastMessage);

    const result = await service.deleteMessage('buyer-1', 'message-1', 'me');

    expect(prisma.messageHidden.upsert).toHaveBeenCalledWith({
      where: {
        messageId_userId: {
          messageId: 'message-1',
          userId: 'buyer-1',
        },
      },
      create: {
        messageId: 'message-1',
        userId: 'buyer-1',
      },
      update: {},
    });
    expect(result.scope).toBe('me');
    expect(result.lastMessage?.id).toBe('message-2');
  });
});
