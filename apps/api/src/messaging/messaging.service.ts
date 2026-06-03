import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MessageType,
  NotificationType,
  OfferStatus,
  Prisma,
  ReportStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { hasAdminPermission } from '../common/admin-permissions';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { MessagingEncryptionService } from './messaging-encryption.service';
import { MessagingPresenceService } from './messaging-presence.service';
import { PushNotificationsService } from './push-notifications.service';

const messageInclude = {
  sender: true,
  listing: {
    include: {
      category: true,
      images: {
        orderBy: {
          sortOrder: 'asc' as const,
        },
        take: 1,
      },
    },
  },
  readReceipts: true,
} as const;

const conversationInclude = {
  listing: {
    include: {
      category: true,
      images: {
        orderBy: {
          sortOrder: 'asc' as const,
        },
        take: 1,
      },
    },
  },
  participants: {
    include: {
      user: true,
    },
  },
  messages: {
    orderBy: {
      createdAt: 'desc' as const,
    },
    take: 1,
    include: messageInclude,
  },
} as const;

const conversationDetailInclude = {
  listing: {
    include: {
      category: true,
      images: {
        orderBy: {
          sortOrder: 'asc' as const,
        },
        take: 1,
      },
    },
  },
  participants: {
    include: {
      user: true,
    },
  },
} as const;

const blockedListingStatuses = new Set([
  'DELETED',
  'REMOVED',
  'REJECTED',
  'SOLD',
]);
const deleteForEveryoneWindowMs = 15 * 60 * 1000;

type ConversationWithSummary = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;
type ConversationWithDetails = Prisma.ConversationGetPayload<{
  include: typeof conversationDetailInclude;
}>;
type MessageWithDetails = Prisma.MessageGetPayload<{
  include: typeof messageInclude;
}>;

function isStaffRole(role: string) {
  return hasAdminPermission(role, 'SUPPORT_READ');
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: MessagingEncryptionService,
    private readonly presence: MessagingPresenceService,
    private readonly pushNotifications: PushNotificationsService,
    private readonly notifications?: NotificationsService,
  ) {}

  private isBlockedListingStatus(status: string) {
    return blockedListingStatuses.has(status);
  }

  private formatMoney(amount: number | Prisma.Decimal, currency: string) {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }

  private getListingSummary(
    listing:
      | (Prisma.ListingGetPayload<{
          include: {
            category: true;
            images: {
              orderBy: {
                sortOrder: 'asc';
              };
              take: 1;
            };
          };
        }> &
          Record<string, unknown>)
      | null,
  ) {
    if (!listing) {
      return null;
    }

    return {
      id: listing.id,
      title: listing.title,
      price: Number(listing.price),
      currency: listing.currency,
      categoryName: listing.category.name,
      status: listing.status,
      location: listing.location,
      sellerId: listing.sellerId,
      primaryImageUrl: this.getCompactImageUrl(listing.images[0]?.url),
    };
  }

  private getCompactImageUrl(url: string | null | undefined) {
    if (!url) {
      return null;
    }

    if (url.startsWith('data:') && url.length > 2048) {
      return null;
    }

    return url;
  }

  private decryptMessage(message: MessageWithDetails) {
    if (message.deletedAt) {
      return {
        body: 'This message was deleted',
        payload: null,
      };
    }

    if (!message.encryptedBody && message.legacyBody) {
      return {
        body: message.legacyBody,
        payload: null,
      };
    }

    try {
      return this.encryption.decrypt({
        encryptedBody: message.encryptedBody,
        encryptedPayload: message.encryptedPayload,
        encryptionIv: message.encryptionIv,
        encryptionAuthTag: message.encryptionAuthTag,
      });
    } catch (error) {
      this.logger.warn(`Could not decrypt message ${message.id}`);

      return {
        body:
          message.legacyBody ??
          (message.type === MessageType.TEXT
            ? 'Message could not be decrypted.'
            : null),
        payload: null,
      };
    }
  }

  private getCompactMessagePayload(type: MessageType, payload: unknown) {
    if (!payload) {
      return null;
    }

    if (type === MessageType.LISTING_CARD) {
      return null;
    }

    const record = asRecord(payload);

    if (
      record &&
      (type === MessageType.IMAGE || type === MessageType.FILE) &&
      typeof record.url === 'string'
    ) {
      return {
        ...record,
        url: this.getCompactImageUrl(record.url),
      };
    }

    try {
      return JSON.stringify(payload).length > 4096 ? null : payload;
    } catch {
      return null;
    }
  }

  private serializeMessage(
    message: MessageWithDetails,
    options: { compactPayload?: boolean } = {},
  ) {
    const decrypted = this.decryptMessage(message);
    const payload = options.compactPayload
      ? this.getCompactMessagePayload(message.type, decrypted.payload)
      : decrypted.payload;

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      senderRole: message.sender.role,
      senderAvatarUrl: message.sender.avatarUrl,
      type: message.type,
      body: decrypted.body,
      payload,
      listingId: message.listingId,
      listing: this.getListingSummary(message.listing),
      offerAmount: message.offerAmount ? Number(message.offerAmount) : null,
      offerCurrency: message.offerCurrency,
      offerStatus: message.offerStatus,
      deletedAt: message.deletedAt,
      readBy: message.readReceipts.map((receipt) => ({
        userId: receipt.userId,
        readAt: receipt.readAt,
      })),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private async findVisibleLatestMessage(
    conversationId: string,
    userId: string,
  ) {
    return this.prisma.message.findFirst({
      where: {
        conversationId,
        hiddenFor: {
          none: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: messageInclude,
    });
  }

  private async findExactConversation(
    participantIds: string[],
    listingId?: string | null,
  ) {
    if (participantIds.length < 2) {
      return null;
    }

    const conversations = await this.prisma.conversation.findMany({
      where: {
        listingId: listingId ?? null,
        AND: participantIds.map((participantId) => ({
          participants: {
            some: {
              userId: participantId,
            },
          },
        })),
      },
      include: conversationInclude,
    });

    return (
      conversations.find(
        (conversation) =>
          conversation.participants.length === participantIds.length,
      ) ?? null
    );
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    return participant;
  }

  private assertListingAllowsMessaging(
    listing: { status: string; title: string } | null,
    action: 'create' | 'send' | 'offer',
  ) {
    if (!listing || !this.isBlockedListingStatus(listing.status)) {
      return;
    }

    const actionLabel =
      action === 'create'
        ? 'A new conversation cannot be started for this listing'
        : action === 'offer'
          ? 'Offer updates are disabled for this listing'
          : 'New messages are disabled for this listing';

    throw new BadRequestException(
      `${actionLabel} because "${listing.title}" is ${listing.status.toLowerCase()}.`,
    );
  }

  private async getConversationDetails(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationDetailInclude,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  private async getBlockMap(currentUserId: string, otherUserIds: string[]) {
    if (!otherUserIds.length) {
      return {
        blockedByMe: new Set<string>(),
        blockedByOther: new Set<string>(),
      };
    }

    const blocks = await this.prisma.userBlock.findMany({
      where: {
        OR: [
          {
            blockerId: currentUserId,
            blockedUserId: {
              in: otherUserIds,
            },
          },
          {
            blockedUserId: currentUserId,
            blockerId: {
              in: otherUserIds,
            },
          },
        ],
      },
    });

    return {
      blockedByMe: new Set(
        blocks
          .filter((block) => block.blockerId === currentUserId)
          .map((block) => block.blockedUserId),
      ),
      blockedByOther: new Set(
        blocks
          .filter((block) => block.blockedUserId === currentUserId)
          .map((block) => block.blockerId),
      ),
    };
  }

  private async assertUsersCanInteract(
    currentUserId: string,
    participants: { id: string; role: string }[],
  ) {
    const otherParticipants = participants.filter(
      (participant) => participant.id !== currentUserId,
    );

    if (
      !otherParticipants.length ||
      otherParticipants.some((participant) => isStaffRole(participant.role))
    ) {
      return;
    }

    const blockMap = await this.getBlockMap(
      currentUserId,
      otherParticipants.map((participant) => participant.id),
    );

    if (blockMap.blockedByMe.size || blockMap.blockedByOther.size) {
      throw new ForbiddenException(
        'This conversation is unavailable because one participant has blocked the other.',
      );
    }
  }

  private async getInteractionState(
    currentUserId: string,
    conversation: ConversationWithSummary | ConversationWithDetails,
  ) {
    const otherParticipants = conversation.participants.filter(
      (participant) => participant.userId !== currentUserId,
    );
    const blockMap = await this.getBlockMap(
      currentUserId,
      otherParticipants.map((participant) => participant.userId),
    );
    const protectedByStaff = otherParticipants.some((participant) =>
      isStaffRole(participant.user.role),
    );
    const blockedByMe = otherParticipants.some((participant) =>
      blockMap.blockedByMe.has(participant.userId),
    );
    const blockedByOther = otherParticipants.some((participant) =>
      blockMap.blockedByOther.has(participant.userId),
    );

    if (!protectedByStaff && blockedByMe) {
      return {
        blockedByMe,
        blockedByOther,
        canSend: false,
        sendDisabledReason:
          'You blocked this user. Unblock them to send new messages.',
      };
    }

    if (!protectedByStaff && blockedByOther) {
      return {
        blockedByMe,
        blockedByOther,
        canSend: false,
        sendDisabledReason:
          'This conversation is read-only because the other user blocked you.',
      };
    }

    if (
      conversation.listing &&
      this.isBlockedListingStatus(conversation.listing.status)
    ) {
      return {
        blockedByMe,
        blockedByOther,
        canSend: false,
        sendDisabledReason: `This listing is ${conversation.listing.status.toLowerCase()}, so new messages are disabled.`,
      };
    }

    return {
      blockedByMe,
      blockedByOther,
      canSend: true,
      sendDisabledReason: null,
    };
  }

  private async serializeConversation(
    conversation: ConversationWithSummary,
    currentUserId: string,
  ) {
    const currentParticipant = conversation.participants.find(
      (participant) => participant.userId === currentUserId,
    );
    const otherParticipants = conversation.participants.filter(
      (participant) => participant.userId !== currentUserId,
    );
    const counterpart = otherParticipants[0] ?? null;
    const interactionState = await this.getInteractionState(
      currentUserId,
      conversation,
    );
    const visibleLastMessage = await this.findVisibleLatestMessage(
      conversation.id,
      currentUserId,
    );
    const title =
      conversation.listing?.title ||
      otherParticipants
        .map((participant) => participant.user.displayName)
        .join(', ') ||
      'Conversation';

    return {
      id: conversation.id,
      listingId: conversation.listingId,
      listing: this.getListingSummary(conversation.listing),
      unreadCount: currentParticipant?.unreadCount ?? 0,
      archivedAt: currentParticipant?.archivedAt ?? null,
      mutedAt: currentParticipant?.mutedAt ?? null,
      canSend: interactionState.canSend,
      sendDisabledReason: interactionState.sendDisabledReason,
      blockedByMe: interactionState.blockedByMe,
      blockedByOther: interactionState.blockedByOther,
      participants: conversation.participants.map((participant) => ({
        userId: participant.userId,
        displayName: participant.user.displayName,
        role: participant.user.role,
        avatarUrl: participant.user.avatarUrl,
        online: this.presence.isOnline(participant.userId),
      })),
      counterpart: counterpart
        ? {
            userId: counterpart.userId,
            displayName: counterpart.user.displayName,
            role: counterpart.user.role,
            avatarUrl: counterpart.user.avatarUrl,
            online: this.presence.isOnline(counterpart.userId),
          }
        : null,
      title,
      lastMessage: visibleLastMessage
        ? this.serializeMessage(visibleLastMessage, { compactPayload: true })
        : null,
      updatedAt: conversation.updatedAt,
    };
  }

  private canDeleteForEveryone(
    message: {
      senderId: string;
      createdAt: Date;
      deletedAt: Date | null;
      type: MessageType;
      offerStatus: OfferStatus | null;
    },
    userId: string,
  ) {
    if (message.senderId !== userId || message.deletedAt) {
      return false;
    }

    if (message.type === MessageType.SYSTEM) {
      return false;
    }

    if (message.offerStatus && message.offerStatus !== OfferStatus.PENDING) {
      return false;
    }

    return (
      Date.now() - message.createdAt.getTime() <= deleteForEveryoneWindowMs
    );
  }

  private async unarchiveConversationForUser(
    conversationId: string,
    userId: string,
  ) {
    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        archivedAt: null,
      },
    });
  }

  private async createListingCardMessage(
    conversationId: string,
    senderId: string,
    listing: NonNullable<ConversationWithDetails['listing']>,
    participantIds: string[],
  ) {
    const payload = {
      kind: 'listing_card',
      listing: this.getListingSummary(listing),
    };
    const encrypted = this.encryption.encrypt(null, payload);

    await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: MessageType.LISTING_CARD,
        encryptedBody: encrypted.encryptedBody,
        encryptedPayload: encrypted.encryptedPayload,
        encryptionIv: encrypted.encryptionIv,
        encryptionAuthTag: encrypted.encryptionAuthTag,
        listingId: listing.id,
        readReceipts: {
          create: participantIds.map((participantId) => ({
            userId: participantId,
          })),
        },
      },
    });
  }

  private async createSystemMessage(
    conversationId: string,
    senderId: string,
    body: string,
    payload?: Record<string, unknown> | null,
  ) {
    const encrypted = this.encryption.encrypt(body, payload ?? null);
    const systemMessage = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: MessageType.SYSTEM,
        encryptedBody: encrypted.encryptedBody,
        encryptedPayload: encrypted.encryptedPayload,
        encryptionIv: encrypted.encryptionIv,
        encryptionAuthTag: encrypted.encryptionAuthTag,
        readReceipts: {
          create: {
            userId: senderId,
          },
        },
      },
      include: messageInclude,
    });

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
        },
      }),
      this.prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId: {
            not: senderId,
          },
        },
        data: {
          unreadCount: {
            increment: 1,
          },
          archivedAt: null,
        },
      }),
      this.prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId: senderId,
        },
        data: {
          archivedAt: null,
        },
      }),
    ]);

    return systemMessage;
  }

  private validateMessageInput(
    dto: SendMessageDto,
    conversation: ConversationWithDetails,
    userId: string,
  ) {
    if (dto.type === MessageType.SYSTEM) {
      throw new ForbiddenException('System messages cannot be sent manually');
    }

    if (dto.type === MessageType.TEXT && !normalizeOptionalText(dto.body)) {
      throw new BadRequestException('Message body cannot be empty');
    }

    if (dto.type === MessageType.OFFER) {
      if (!conversation.listing) {
        throw new BadRequestException(
          'Offers can only be sent in listing conversations',
        );
      }

      if (conversation.listing.sellerId === userId) {
        throw new ForbiddenException('Only buyers can send offers');
      }

      if (!dto.offerAmount || dto.offerAmount <= 0) {
        throw new BadRequestException('Offer amount must be greater than zero');
      }
    }

    if (dto.type === MessageType.IMAGE || dto.type === MessageType.FILE) {
      const payload = asRecord(dto.payload);
      const url = typeof payload?.url === 'string' ? payload.url.trim() : '';

      if (!url) {
        throw new BadRequestException(
          `${dto.type === MessageType.IMAGE ? 'Image' : 'File'} messages require a URL in the payload.`,
        );
      }
    }
  }

  private async hydrateListingForMessage(
    conversation: ConversationWithDetails,
    dto: SendMessageDto,
    userId: string,
  ) {
    if (dto.type === MessageType.LISTING_CARD) {
      const listingId = dto.listingId ?? conversation.listingId;

      if (!listingId) {
        throw new BadRequestException(
          'Listing card messages require a listing id',
        );
      }

      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          category: true,
          images: {
            orderBy: {
              sortOrder: 'asc',
            },
            take: 1,
          },
        },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      if (
        listing.id !== conversation.listingId &&
        listing.sellerId !== userId
      ) {
        throw new ForbiddenException(
          'Only the listing owner can share a different listing here.',
        );
      }

      return listing;
    }

    return conversation.listing;
  }

  async findConversations(userId: string, archived = false) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
            archivedAt: archived ? { not: null } : null,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: conversationInclude,
    });

    return Promise.all(
      conversations.map((conversation) =>
        this.serializeConversation(conversation, userId),
      ),
    );
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    const participantIds = new Set([userId]);
    let directParticipant: {
      id: string;
      role: string;
    } | null = null;

    if (dto.participantId) {
      if (dto.participantId === userId) {
        throw new BadRequestException('Choose another participant');
      }

      const participant = await this.prisma.user.findUnique({
        where: { id: dto.participantId },
      });

      if (!participant) {
        throw new NotFoundException('Participant not found');
      }

      directParticipant = {
        id: participant.id,
        role: participant.role,
      };
      participantIds.add(dto.participantId);
    }

    let listing:
      | (Prisma.ListingGetPayload<{
          include: {
            category: true;
            images: {
              orderBy: {
                sortOrder: 'asc';
              };
              take: 1;
            };
          };
        }> &
          Record<string, unknown>)
      | null = null;

    if (dto.listingId) {
      listing = await this.prisma.listing.findUnique({
        where: { id: dto.listingId },
        include: {
          category: true,
          images: {
            orderBy: {
              sortOrder: 'asc',
            },
            take: 1,
          },
        },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      participantIds.add(listing.sellerId);

      const exactParticipantIds = [...participantIds];
      const existing = await this.findExactConversation(
        exactParticipantIds,
        dto.listingId,
      );

      if (existing) {
        await this.unarchiveConversationForUser(existing.id, userId);
        const refreshed = await this.prisma.conversation.findUnique({
          where: { id: existing.id },
          include: conversationInclude,
        });

        if (!refreshed) {
          throw new NotFoundException('Conversation not found');
        }

        return this.serializeConversation(refreshed, userId);
      }

      this.assertListingAllowsMessaging(listing, 'create');
      await this.assertUsersCanInteract(userId, [
        { id: userId, role: 'USER' },
        { id: listing.sellerId, role: 'USER' },
      ]);
    }

    if (participantIds.size < 2) {
      throw new NotFoundException('Choose another participant or listing');
    }

    if (!dto.listingId) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        throw new NotFoundException('User not found');
      }

      if (
        directParticipant &&
        !isStaffRole(currentUser.role) &&
        !isStaffRole(directParticipant.role)
      ) {
        throw new ForbiddenException(
          'Direct conversations must include an admin or support user.',
        );
      }

      if (directParticipant) {
        await this.assertUsersCanInteract(userId, [
          { id: userId, role: currentUser.role },
          directParticipant,
        ]);
      }

      const directParticipantIds = [...participantIds];
      const existing = await this.findExactConversation(
        directParticipantIds,
        null,
      );

      if (existing) {
        await this.unarchiveConversationForUser(existing.id, userId);
        const refreshed = await this.prisma.conversation.findUnique({
          where: { id: existing.id },
          include: conversationInclude,
        });

        if (!refreshed) {
          throw new NotFoundException('Conversation not found');
        }

        return this.serializeConversation(refreshed, userId);
      }
    }

    const created = await this.prisma.conversation.create({
      data: {
        listingId: dto.listingId,
        participants: {
          create: [...participantIds].map((participantId) => ({
            userId: participantId,
          })),
        },
      },
      include: conversationDetailInclude,
    });

    if (created.listing) {
      await this.createListingCardMessage(
        created.id,
        userId,
        created.listing,
        created.participants.map((participant) => participant.userId),
      );
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: created.id },
      include: conversationInclude,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.serializeConversation(conversation, userId);
  }

  async findMessages(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        hiddenFor: {
          none: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: messageInclude,
    });

    return messages.map((message) => this.serializeMessage(message));
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    await this.assertParticipant(conversationId, userId);
    const conversation = await this.getConversationDetails(conversationId);
    const interactionState = await this.getInteractionState(
      userId,
      conversation,
    );

    if (!interactionState.canSend) {
      throw new ForbiddenException(
        interactionState.sendDisabledReason ??
          'This conversation is read-only.',
      );
    }

    if (conversation.listing) {
      this.assertListingAllowsMessaging(conversation.listing, 'send');
    }

    this.validateMessageInput(dto, conversation, userId);

    const linkedListing = await this.hydrateListingForMessage(
      conversation,
      dto,
      userId,
    );
    const body = normalizeOptionalText(dto.body);
    let payload = dto.payload ?? null;
    let listingId = dto.listingId ?? conversation.listingId ?? undefined;

    if (dto.type === MessageType.OFFER) {
      payload = {
        kind: 'offer',
        note: body,
      };
      listingId = conversation.listingId ?? undefined;
    }

    if (dto.type === MessageType.LISTING_CARD && linkedListing) {
      payload = {
        kind: 'listing_card',
        listing: this.getListingSummary(linkedListing),
      };
      listingId = linkedListing.id;
    }

    const encrypted = this.encryption.encrypt(body, payload);
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        type: dto.type,
        encryptedBody: encrypted.encryptedBody,
        encryptedPayload: encrypted.encryptedPayload,
        encryptionIv: encrypted.encryptionIv,
        encryptionAuthTag: encrypted.encryptionAuthTag,
        listingId,
        offerAmount:
          typeof dto.offerAmount === 'number'
            ? new Prisma.Decimal(dto.offerAmount)
            : undefined,
        offerCurrency:
          dto.type === MessageType.OFFER
            ? (dto.offerCurrency?.trim().toUpperCase() ??
              conversation.listing?.currency ??
              null)
            : null,
        offerStatus:
          dto.type === MessageType.OFFER ? OfferStatus.PENDING : undefined,
        readReceipts: {
          create: {
            userId,
          },
        },
      },
      include: messageInclude,
    });

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      this.prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId: {
            not: userId,
          },
        },
        data: {
          unreadCount: {
            increment: 1,
          },
          archivedAt: null,
        },
      }),
      this.prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId,
        },
        data: {
          archivedAt: null,
        },
      }),
    ]);

    await this.queuePushFallbacks(conversation, userId, message);

    return this.serializeMessage(message);
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);

    const readAt = new Date();
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: {
          not: userId,
        },
      },
      select: {
        id: true,
      },
    });

    await this.prisma.$transaction([
      this.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: {
          unreadCount: 0,
          lastReadAt: readAt,
          archivedAt: null,
        },
      }),
      ...messages.map((message) =>
        this.prisma.messageReadReceipt.upsert({
          where: {
            messageId_userId: {
              messageId: message.id,
              userId,
            },
          },
          create: {
            messageId: message.id,
            userId,
            readAt,
          },
          update: {
            readAt,
          },
        }),
      ),
    ]);

    return { conversationId, userId, readAt };
  }

  async updateOffer(userId: string, messageId: string, dto: UpdateOfferDto) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        ...messageInclude,
        conversation: {
          include: conversationDetailInclude,
        },
      },
    });

    if (!message || message.type !== MessageType.OFFER || message.deletedAt) {
      throw new NotFoundException('Offer message not found');
    }

    const conversation = message.conversation;
    await this.assertParticipant(conversation.id, userId);

    const interactionState = await this.getInteractionState(
      userId,
      conversation,
    );

    if (!interactionState.canSend) {
      throw new ForbiddenException(
        interactionState.sendDisabledReason ?? 'This offer cannot be updated.',
      );
    }

    if (message.senderId === userId) {
      throw new ForbiddenException(
        'Offer senders cannot accept or decline their own offer',
      );
    }

    if (!conversation.listing) {
      throw new BadRequestException(
        'Only listing conversations can contain offer negotiations.',
      );
    }

    this.assertListingAllowsMessaging(conversation.listing, 'offer');

    if (conversation.listing.sellerId !== userId) {
      throw new ForbiddenException(
        'Only the listing seller can update an offer',
      );
    }

    if (message.offerStatus && message.offerStatus !== OfferStatus.PENDING) {
      throw new BadRequestException('This offer has already been resolved');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        offerStatus: dto.status,
      },
      include: messageInclude,
    });
    const systemBody =
      dto.status === OfferStatus.ACCEPTED
        ? `${message.sender.displayName}'s offer of ${this.formatMoney(
            message.offerAmount ?? 0,
            message.offerCurrency ?? conversation.listing.currency,
          )} was accepted.`
        : `${message.sender.displayName}'s offer of ${this.formatMoney(
            message.offerAmount ?? 0,
            message.offerCurrency ?? conversation.listing.currency,
          )} was declined.`;
    const systemMessage = await this.createSystemMessage(
      conversation.id,
      userId,
      systemBody,
      {
        kind: 'offer_status',
        offerMessageId: updated.id,
        status: dto.status,
      },
    );

    await this.queuePushFallbacks(
      conversation,
      userId,
      this.serializeMessage(systemMessage),
    );

    return {
      offerMessage: this.serializeMessage(updated),
      systemMessage: this.serializeMessage(systemMessage),
    };
  }

  async deleteMessage(
    userId: string,
    messageId: string,
    scope: 'me' | 'everyone' = 'everyone',
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        ...messageInclude,
        conversation: {
          include: conversationDetailInclude,
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.assertParticipant(message.conversationId, userId);

    if (scope === 'me') {
      await this.prisma.messageHidden.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
        create: {
          messageId,
          userId,
        },
        update: {},
      });

      const lastVisibleMessage = await this.findVisibleLatestMessage(
        message.conversationId,
        userId,
      );

      return {
        scope: 'me' as const,
        conversationId: message.conversationId,
        messageId,
        lastMessage: lastVisibleMessage
          ? this.serializeMessage(lastVisibleMessage)
          : null,
        updatedAt:
          lastVisibleMessage?.updatedAt ?? message.conversation.updatedAt,
      };
    }

    if (message.type === MessageType.SYSTEM) {
      throw new BadRequestException(
        'System messages cannot be deleted for everyone.',
      );
    }

    if (!this.canDeleteForEveryone(message, userId)) {
      throw new ForbiddenException(
        'Delete for everyone is only available on your own recent messages.',
      );
    }

    const deletedAt = new Date();
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt,
        encryptedBody: null,
        encryptedPayload: null,
        encryptionIv: '',
        encryptionAuthTag: '',
        legacyBody: null,
      },
      include: messageInclude,
    });

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: message.conversationId },
        data: {
          updatedAt: deletedAt,
        },
      }),
      this.prisma.conversationParticipant.updateMany({
        where: {
          conversationId: message.conversationId,
          userId: {
            not: userId,
          },
        },
        data: {
          archivedAt: null,
        },
      }),
    ]);

    return {
      scope: 'everyone' as const,
      conversationId: message.conversationId,
      message: this.serializeMessage(updated),
      updatedAt: updated.updatedAt,
    };
  }

  async updateConversationPreferences(
    userId: string,
    conversationId: string,
    dto: {
      archived?: boolean;
      muted?: boolean;
    },
  ) {
    await this.assertParticipant(conversationId, userId);

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        archivedAt:
          dto.archived === undefined
            ? undefined
            : dto.archived
              ? new Date()
              : null,
        mutedAt:
          dto.muted === undefined ? undefined : dto.muted ? new Date() : null,
      },
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.serializeConversation(conversation, userId);
  }

  async blockConversationCounterpart(
    userId: string,
    conversationId: string,
    reason?: string,
  ) {
    await this.assertParticipant(conversationId, userId);
    const conversation = await this.getConversationDetails(conversationId);
    const counterpart = conversation.participants.find(
      (participant) => participant.userId !== userId,
    );

    if (!counterpart) {
      throw new BadRequestException('A counterpart could not be found');
    }

    if (isStaffRole(counterpart.user.role)) {
      throw new BadRequestException(
        'Admin and support accounts cannot be blocked from this thread.',
      );
    }

    await this.prisma.userBlock.upsert({
      where: {
        blockerId_blockedUserId: {
          blockerId: userId,
          blockedUserId: counterpart.userId,
        },
      },
      create: {
        blockerId: userId,
        blockedUserId: counterpart.userId,
        reason: normalizeOptionalText(reason),
      },
      update: {
        reason: normalizeOptionalText(reason),
      },
    });

    return this.updateConversationPreferences(userId, conversationId, {});
  }

  async reportConversation(
    userId: string,
    conversationId: string,
    dto: {
      reason: string;
      details?: string;
    },
  ) {
    await this.assertParticipant(conversationId, userId);

    return this.prisma.conversationReport.create({
      data: {
        conversationId,
        reporterId: userId,
        reason: dto.reason.trim(),
        details: normalizeOptionalText(dto.details),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async reportMessage(
    userId: string,
    messageId: string,
    dto: {
      reason: string;
      details?: string;
    },
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        conversationId: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.assertParticipant(message.conversationId, userId);

    return this.prisma.messageReport.create({
      data: {
        messageId,
        reporterId: userId,
        reason: dto.reason.trim(),
        details: normalizeOptionalText(dto.details),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async listOpenReports(user: { id: string; role: string }) {
    if (!isStaffRole(user.role)) {
      throw new ForbiddenException('Only staff can review chat reports');
    }

    const [conversationReports, messageReports] = await Promise.all([
      this.prisma.conversationReport.findMany({
        where: {
          status: ReportStatus.OPEN,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          conversation: {
            include: {
              listing: true,
            },
          },
          reporter: true,
        },
      }),
      this.prisma.messageReport.findMany({
        where: {
          status: ReportStatus.OPEN,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          message: true,
          reporter: true,
        },
      }),
    ]);

    return {
      conversationReports: conversationReports.map((report) => ({
        id: report.id,
        conversationId: report.conversationId,
        listingId: report.conversation.listingId,
        listingTitle: report.conversation.listing?.title ?? null,
        reporter: {
          id: report.reporter.id,
          displayName: report.reporter.displayName,
          role: report.reporter.role,
        },
        reason: report.reason,
        details: report.details,
        status: report.status,
        createdAt: report.createdAt,
      })),
      messageReports: messageReports.map((report) => ({
        id: report.id,
        messageId: report.messageId,
        conversationId: report.message.conversationId,
        reporter: {
          id: report.reporter.id,
          displayName: report.reporter.displayName,
          role: report.reporter.role,
        },
        reason: report.reason,
        details: report.details,
        status: report.status,
        createdAt: report.createdAt,
      })),
    };
  }

  private async queuePushFallbacks(
    conversation: ConversationWithDetails,
    senderId: string,
    message:
      | MessageWithDetails
      | ReturnType<MessagingService['serializeMessage']>,
  ) {
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
    });
    const recipients = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId: conversation.id,
        userId: {
          not: senderId,
        },
      },
    });
    const serialized =
      'sender' in message ? this.serializeMessage(message) : message;
    const preview =
      serialized.body ??
      (serialized.type === MessageType.OFFER
        ? `Offer sent: ${this.formatMoney(
            serialized.offerAmount ?? 0,
            serialized.offerCurrency ?? conversation.listing?.currency ?? 'AED',
          )}`
        : serialized.type === MessageType.IMAGE
          ? 'Image shared'
          : serialized.type === MessageType.FILE
            ? 'File shared'
            : serialized.type === MessageType.LISTING_CARD
              ? 'Listing details shared'
              : 'New message');
    const recipientsToNotify = recipients.filter(
      (recipient) => !recipient.mutedAt,
    );

    try {
      await this.notifications?.notifyMessage({
        recipientIds: recipientsToNotify.map((recipient) => recipient.userId),
        actorId: senderId,
        conversationId: conversation.id,
        messageId: serialized.id,
        listingId: serialized.listingId ?? conversation.listingId,
        messageType: serialized.type,
        notificationType: this.getNotificationTypeForMessage(serialized),
        senderName: sender?.displayName ?? 'Marketplace user',
        preview,
        metadata: {
          ...(conversation.listing?.title
            ? { listingTitle: conversation.listing.title }
            : {}),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not persist notifications for conversation ${conversation.id}`,
      );
    }

    await Promise.all(
      recipients
        .filter(
          (recipient) =>
            !recipient.mutedAt && !this.presence.isOnline(recipient.userId),
        )
        .map((recipient) =>
          this.pushNotifications.notifyInactiveRecipient({
            recipientId: recipient.userId,
            conversationId: conversation.id,
            senderName: sender?.displayName ?? 'Marketplace user',
            preview,
            deepLink: `/messages?conversation=${conversation.id}`,
            listingTitle: conversation.listing?.title ?? null,
            messageType: serialized.type,
          }),
        ),
    );
  }

  private getNotificationTypeForMessage(
    message: ReturnType<MessagingService['serializeMessage']>,
  ) {
    const payload = asRecord(message.payload);

    if (
      message.type === MessageType.OFFER ||
      payload?.kind === 'offer_status'
    ) {
      return NotificationType.OFFER;
    }

    return NotificationType.MESSAGE;
  }
}
