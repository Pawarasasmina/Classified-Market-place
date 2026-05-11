import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageType, OfferStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { MessagingEncryptionService } from './messaging-encryption.service';
import { MessagingPresenceService } from './messaging-presence.service';
import { PushNotificationsService } from './push-notifications.service';

const conversationInclude = {
  listing: {
    include: {
      category: true,
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
    include: {
      sender: true,
      listing: {
        include: {
          category: true,
        },
      },
      readReceipts: true,
    },
  },
};

const messageInclude = {
  sender: true,
  listing: {
    include: {
      category: true,
    },
  },
  readReceipts: true,
};

function isAdminRole(role: string) {
  return role.toUpperCase() === 'ADMIN';
}

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: MessagingEncryptionService,
    private readonly presence: MessagingPresenceService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

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

  private serializeMessage(message: Prisma.MessageGetPayload<{ include: typeof messageInclude }>) {
    const decrypted = this.encryption.decrypt({
      encryptedBody: message.encryptedBody,
      encryptedPayload: message.encryptedPayload,
      encryptionIv: message.encryptionIv,
      encryptionAuthTag: message.encryptionAuthTag,
    });

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      type: message.type,
      body: decrypted.body,
      payload: decrypted.payload,
      listingId: message.listingId,
      listing: message.listing
        ? {
            id: message.listing.id,
            title: message.listing.title,
            price: Number(message.listing.price),
            currency: message.listing.currency,
            categoryName: message.listing.category.name,
          }
        : null,
      offerAmount: message.offerAmount ? Number(message.offerAmount) : null,
      offerCurrency: message.offerCurrency,
      offerStatus: message.offerStatus,
      readBy: message.readReceipts.map((receipt) => ({
        userId: receipt.userId,
        readAt: receipt.readAt,
      })),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private serializeConversation(
    conversation: Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>,
    currentUserId: string,
  ) {
    const currentParticipant = conversation.participants.find(
      (participant) => participant.userId === currentUserId,
    );
    const otherParticipants = conversation.participants.filter(
      (participant) => participant.userId !== currentUserId,
    );
    const lastMessage = conversation.messages[0]
      ? this.serializeMessage(conversation.messages[0])
      : null;

    return {
      id: conversation.id,
      listingId: conversation.listingId,
      listing: conversation.listing
        ? {
            id: conversation.listing.id,
            title: conversation.listing.title,
            price: Number(conversation.listing.price),
            currency: conversation.listing.currency,
            categoryName: conversation.listing.category.name,
          }
        : null,
      unreadCount: currentParticipant?.unreadCount ?? 0,
      participants: conversation.participants.map((participant) => ({
        userId: participant.userId,
        displayName: participant.user.displayName,
        online: this.presence.isOnline(participant.userId),
      })),
      title:
        conversation.listing?.title ??
        otherParticipants.map((participant) => participant.user.displayName).join(', ') ??
        'Conversation',
      lastMessage,
      updatedAt: conversation.updatedAt,
    };
  }

  async findConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: conversationInclude,
    });

    return conversations.map((conversation) =>
      this.serializeConversation(conversation, userId),
    );
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    const participantIds = new Set([userId]);
    let directParticipantRole: string | null = null;

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

      directParticipantRole = participant.role;
      participantIds.add(dto.participantId);
    }

    if (dto.listingId) {
      const listing = await this.prisma.listing.findUnique({
        where: { id: dto.listingId },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      participantIds.add(listing.sellerId);

      const existing = await this.prisma.conversation.findFirst({
        where: {
          listingId: dto.listingId,
          participants: {
            every: {
              userId: {
                in: [...participantIds],
              },
            },
          },
        },
        include: conversationInclude,
      });

      if (existing) {
        return this.serializeConversation(existing, userId);
      }
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
        directParticipantRole &&
        !isAdminRole(currentUser.role) &&
        !isAdminRole(directParticipantRole)
      ) {
        throw new ForbiddenException('Direct conversations must include an admin');
      }

      const directParticipantIds = [...participantIds];
      const existing = await this.prisma.conversation.findFirst({
        where: {
          listingId: null,
          participants: {
            every: {
              userId: {
                in: directParticipantIds,
              },
            },
          },
          AND: directParticipantIds.map((participantId) => ({
            participants: {
              some: {
                userId: participantId,
              },
            },
          })),
        },
        include: conversationInclude,
      });

      if (existing && existing.participants.length === directParticipantIds.length) {
        return this.serializeConversation(existing, userId);
      }
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        listingId: dto.listingId,
        participants: {
          create: [...participantIds].map((participantId) => ({
            userId: participantId,
          })),
        },
      },
      include: conversationInclude,
    });

    return this.serializeConversation(conversation, userId);
  }

  async findMessages(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: messageInclude,
    });

    return messages.map((message) => this.serializeMessage(message));
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    await this.assertParticipant(conversationId, userId);

    const body = dto.body?.trim() || null;
    const payload = dto.payload ?? null;
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
        listingId: dto.listingId,
        offerAmount:
          typeof dto.offerAmount === 'number'
            ? new Prisma.Decimal(dto.offerAmount)
            : undefined,
        offerCurrency: dto.offerCurrency,
        offerStatus: dto.type === MessageType.OFFER ? OfferStatus.PENDING : undefined,
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
        },
      }),
    ]);

    await this.queuePushFallbacks(conversationId, userId, body ?? dto.type);

    return this.serializeMessage(message);
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);

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
          lastReadAt: new Date(),
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
          },
          update: {
            readAt: new Date(),
          },
        }),
      ),
    ]);

    return { message: 'Conversation marked as read' };
  }

  async updateOffer(userId: string, messageId: string, dto: UpdateOfferDto) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.type !== MessageType.OFFER) {
      throw new NotFoundException('Offer message not found');
    }

    await this.assertParticipant(message.conversationId, userId);

    if (message.senderId === userId) {
      throw new ForbiddenException('Offer senders cannot accept or decline their own offer');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        offerStatus: dto.status,
      },
      include: messageInclude,
    });

    return this.serializeMessage(updated);
  }

  private async queuePushFallbacks(
    conversationId: string,
    senderId: string,
    preview: string,
  ) {
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
    });
    const recipients = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        userId: {
          not: senderId,
        },
      },
    });

    await Promise.all(
      recipients
        .filter((recipient) => !this.presence.isOnline(recipient.userId))
        .map((recipient) =>
          this.pushNotifications.notifyInactiveRecipient({
            recipientId: recipient.userId,
            conversationId,
            senderName: sender?.displayName ?? 'Marketplace user',
            preview,
          }),
        ),
    );
  }
}
