import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingEncryptionService } from '../messaging/messaging-encryption.service';
import { MessagingService } from '../messaging/messaging.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { QueryConversationsDto } from './dto/query-conversations.dto';
import { SendMessageDto } from './dto/send-message.dto';

const conversationSummaryInclude = {
  listing: {
    include: {
      category: true,
      seller: true,
    },
  },
  participants: {
    include: {
      user: true,
    },
    orderBy: {
      joinedAt: 'asc' as const,
    },
  },
  messages: {
    include: {
      sender: true,
      readReceipts: true,
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
    take: 1,
  },
} satisfies Prisma.ConversationInclude;

function buildConversationDetailInclude(messageTake: number) {
  return {
    listing: {
      include: {
        category: true,
        seller: true,
      },
    },
    participants: {
      include: {
        user: true,
      },
      orderBy: {
        joinedAt: 'asc' as const,
      },
    },
    messages: {
      include: {
        sender: true,
        readReceipts: true,
      },
      orderBy: {
        createdAt: 'desc' as const,
      },
      take: messageTake,
    },
  } satisfies Prisma.ConversationInclude;
}

type ConversationSummaryRecord = Prisma.ConversationGetPayload<{
  include: typeof conversationSummaryInclude;
}>;

type ConversationDetailRecord = Prisma.ConversationGetPayload<{
  include: ReturnType<typeof buildConversationDetailInclude>;
}>;

type ConversationRecord = ConversationSummaryRecord | ConversationDetailRecord;

function sanitizeUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return user;
}

type ConversationListing = NonNullable<ConversationRecord['listing']>;

function serializeListing(listing: ConversationListing) {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: Number(listing.price),
    currency: listing.currency,
    location: listing.location,
    status: listing.status,
    categoryId: listing.categoryId,
    sellerId: listing.sellerId,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    category: listing.category
      ? {
          id: listing.category.id,
          name: listing.category.name,
          slug: listing.category.slug,
        }
      : null,
    seller: sanitizeUser(listing.seller),
  };
}

function getParticipantRole(listing: ConversationListing, userId: string) {
  return userId === listing.sellerId ? 'SELLER' : 'BUYER';
}

function serializeParticipant(
  participant: ConversationRecord['participants'][number],
  listing: ConversationListing,
) {
  return {
    id: participant.id,
    role: getParticipantRole(listing, participant.userId),
    unreadCount: participant.unreadCount,
    lastReadAt: participant.lastReadAt,
    createdAt: participant.joinedAt,
    updatedAt: participant.joinedAt,
    user: sanitizeUser(participant.user),
  };
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: MessagingEncryptionService,
    private readonly messagingService: MessagingService,
  ) {}

  getConversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  getUserRoom(userId: string) {
    return `user:${userId}`;
  }

  async findAllForUser(userId: string, query: QueryConversationsDto) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        listingId: query.listingId ?? { not: null },
        participants: {
          some: {
            userId,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.take ?? 25,
      include: conversationSummaryInclude,
    });

    return conversations
      .filter((conversation): conversation is ConversationSummaryRecord & { listing: ConversationListing } => Boolean(conversation.listing))
      .map((conversation) =>
        this.serializeConversationSummary(conversation, userId),
      );
  }

  async findOneForUser(
    userId: string,
    conversationId: string,
    messageTake = 50,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        listingId: {
          not: null,
        },
        participants: {
          some: {
            userId,
          },
        },
      },
      include: buildConversationDetailInclude(messageTake),
    });

    if (!conversation?.listing) {
      throw new NotFoundException('Conversation not found');
    }

    return this.serializeConversationDetail(
      conversation as ConversationDetailRecord & { listing: ConversationListing },
      userId,
    );
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: {
        id: true,
        sellerId: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId === userId) {
      throw new BadRequestException(
        'You cannot start a buyer conversation on your own listing',
      );
    }

    const conversation = await this.messagingService.createConversation(userId, {
      listingId: dto.listingId,
    });

    const initialMessage = dto.initialMessage?.trim();

    if (initialMessage) {
      await this.messagingService.sendMessage(userId, conversation.id, {
        type: MessageType.TEXT,
        body: initialMessage,
      });
    }

    return this.findOneForUser(userId, conversation.id);
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const body = dto.body.trim();

    if (!body) {
      throw new BadRequestException('Message body cannot be empty');
    }

    await this.messagingService.sendMessage(userId, conversationId, {
      type: MessageType.TEXT,
      body,
    });

    return this.findOneForUser(userId, conversationId);
  }

  async markConversationRead(userId: string, conversationId: string) {
    await this.messagingService.markRead(userId, conversationId);
    return this.findOneForUser(userId, conversationId);
  }

  async getConversationSnapshot(conversationId: string, messageTake = 50) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        listingId: {
          not: null,
        },
      },
      include: buildConversationDetailInclude(messageTake),
    });

    if (!conversation?.listing) {
      throw new NotFoundException('Conversation not found');
    }

    const participants = conversation.participants.map((participant) =>
      serializeParticipant(participant, conversation.listing!),
    );
    const sellerId = conversation.listing.sellerId;
    const buyerId =
      participants.find((participant) => participant.user.id !== sellerId)?.user.id ??
      sellerId;
    const latestMessage = conversation.messages[0]
      ? this.serializeMessage(conversation.messages[0])
      : null;

    return {
      id: conversation.id,
      listingId: conversation.listingId,
      buyerId,
      sellerId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: latestMessage?.createdAt ?? conversation.updatedAt,
      listing: serializeListing(conversation.listing),
      participants,
      latestMessage,
      messages: [...conversation.messages]
        .reverse()
        .map((message) => this.serializeMessage(message)),
    };
  }

  private serializeMessage(message: ConversationRecord['messages'][number]) {
    const decrypted = this.encryption.decrypt({
      encryptedBody: message.encryptedBody,
      encryptedPayload: message.encryptedPayload,
      encryptionIv: message.encryptionIv,
      encryptionAuthTag: message.encryptionAuthTag,
    });
    const readAt =
      message.readReceipts.find((receipt) => receipt.userId !== message.senderId)
        ?.readAt ?? null;

    return {
      id: message.id,
      body: decrypted.body ?? '',
      senderId: message.senderId,
      readAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: sanitizeUser(message.sender),
    };
  }

  private serializeConversationSummary(
    conversation: ConversationSummaryRecord & { listing: ConversationListing },
    viewerUserId: string,
  ) {
    const participants = conversation.participants.map((participant) =>
      serializeParticipant(participant, conversation.listing),
    );
    const viewerParticipant = participants.find(
      (participant) => participant.user.id === viewerUserId,
    );
    const counterpart = participants.find(
      (participant) => participant.user.id !== viewerUserId,
    );
    const latestMessage = conversation.messages[0]
      ? this.serializeMessage(conversation.messages[0])
      : null;
    const sellerId = conversation.listing.sellerId;
    const buyerId =
      participants.find((participant) => participant.user.id !== sellerId)?.user.id ??
      sellerId;

    if (!viewerParticipant) {
      throw new NotFoundException('Conversation participant not found');
    }

    return {
      id: conversation.id,
      listingId: conversation.listingId!,
      buyerId,
      sellerId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: latestMessage?.createdAt ?? conversation.updatedAt,
      listing: serializeListing(conversation.listing),
      viewerParticipant: {
        role: viewerParticipant.role,
        unreadCount: viewerParticipant.unreadCount,
        lastReadAt: viewerParticipant.lastReadAt,
      },
      counterpart: counterpart
        ? {
            ...counterpart.user,
            participantRole: counterpart.role,
          }
        : null,
      participants,
      latestMessage,
    };
  }

  private serializeConversationDetail(
    conversation: ConversationDetailRecord & { listing: ConversationListing },
    viewerUserId: string,
  ) {
    return {
      ...this.serializeConversationSummary(conversation, viewerUserId),
      messages: [...conversation.messages]
        .reverse()
        .map((message) => this.serializeMessage(message)),
    };
  }
}
