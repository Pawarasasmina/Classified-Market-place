const {
  PrismaClient,
  ConversationParticipantRole,
  ListingReportReason,
  ListingReportStatus,
  ModerationActionType,
} = require('@prisma/client');

const prisma = new PrismaClient();

const demoUsers = [
  {
    email: 'qa.buyer@classified.local',
    displayName: 'Aisha Rahman',
    phone: '+971504444444',
    phoneVerified: true,
    emailVerified: true,
    role: 'USER',
  },
  {
    email: 'corporate.hr@classified.local',
    displayName: 'Omar Hiring Team',
    phone: '+971505555555',
    phoneVerified: true,
    emailVerified: true,
    role: 'USER',
  },
];

const listingTitles = {
  camry: '2022 Toyota Camry SE',
  apartment: '2BR Marina apartment with balcony',
  iphone: 'iPhone 15 Pro Max 256GB',
  acService: 'Same-day AC repair and cleaning',
  marketing: 'Marketing Manager for local commerce brand',
  reactRole: 'Senior React Developer',
};

function makeDaysAgo(days, hour = 10, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function ensureUser(user) {
  return prisma.user.upsert({
    where: { email: user.email },
    update: {
      displayName: user.displayName,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      role: user.role,
    },
    create: {
      ...user,
      passwordHash: null,
    },
  });
}

async function ensureSavedListing(userId, listingId, createdAt) {
  const existing = await prisma.savedListing.findFirst({
    where: { userId, listingId },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.savedListing.create({
    data: {
      userId,
      listingId,
      createdAt,
    },
  });
}

async function ensureConversation({ listingId, buyerId, sellerId }) {
  const existing = await prisma.conversation.findUnique({
    where: {
      listingId_buyerId_sellerId: {
        listingId,
        buyerId,
        sellerId,
      },
    },
    include: {
      participants: true,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.conversation.create({
    data: {
      listingId,
      buyerId,
      sellerId,
      participants: {
        create: [
          {
            userId: buyerId,
            role: ConversationParticipantRole.BUYER,
            lastReadAt: new Date(),
          },
          {
            userId: sellerId,
            role: ConversationParticipantRole.SELLER,
          },
        ],
      },
    },
    include: {
      participants: true,
    },
  });
}

async function ensureMessages(conversationId, messages) {
  for (const message of messages) {
    const existing = await prisma.message.findFirst({
      where: {
        conversationId,
        senderId: message.senderId,
        body: message.body,
      },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    await prisma.message.create({
      data: {
        conversationId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
        updatedAt: message.createdAt,
        readAt: message.readAt ?? null,
      },
    });
  }
}

async function syncConversationState(conversationId, buyerId, sellerId) {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      senderId: true,
      createdAt: true,
      readAt: true,
    },
  });

  const lastMessageAt =
    messages.length > 0 ? messages[messages.length - 1].createdAt : null;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt,
    },
  });

  const buyerUnread = messages.filter(
    (message) => message.senderId === sellerId && message.readAt === null,
  ).length;
  const sellerUnread = messages.filter(
    (message) => message.senderId === buyerId && message.readAt === null,
  ).length;

  const lastReadByUser = (userId) => {
    const readMessages = messages.filter(
      (message) => message.senderId !== userId && message.readAt !== null,
    );
    return readMessages.length > 0
      ? readMessages[readMessages.length - 1].readAt
      : null;
  };

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: buyerId,
      },
    },
    data: {
      unreadCount: buyerUnread,
      lastReadAt: lastReadByUser(buyerId),
    },
  });

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: sellerId,
      },
    },
    data: {
      unreadCount: sellerUnread,
      lastReadAt: lastReadByUser(sellerId),
    },
  });
}

async function ensureReport({
  listingId,
  reporterId,
  reason,
  details,
  status = ListingReportStatus.OPEN,
  createdAt,
  resolutionAction = null,
  resolvedById = null,
  resolvedAt = null,
  resolutionNote = null,
}) {
  const existing = await prisma.listingReport.findFirst({
    where: {
      listingId,
      reporterId,
      reason,
      details,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existing) {
    if (existing.status !== status) {
      await prisma.listingReport.update({
        where: { id: existing.id },
        data: {
          status,
          resolutionAction,
          resolvedById,
          resolvedAt,
          resolutionNote,
        },
      });
    }

    return existing;
  }

  return prisma.listingReport.create({
    data: {
      listingId,
      reporterId,
      reason,
      details,
      status,
      createdAt,
      updatedAt: createdAt,
      resolutionAction,
      resolvedById,
      resolvedAt,
      resolutionNote,
    },
  });
}

async function ensureModerationEvent({
  listingId,
  reportId,
  actorId,
  action,
  notes,
  previousListingStatus,
  nextListingStatus,
  resultingReportStatus,
  createdAt,
}) {
  const existing = await prisma.listingModerationEvent.findFirst({
    where: {
      listingId,
      reportId: reportId || null,
      action,
      createdAt,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.listingModerationEvent.create({
    data: {
      listingId,
      reportId: reportId || undefined,
      actorId: actorId || undefined,
      action,
      notes,
      previousListingStatus,
      nextListingStatus,
      resultingReportStatus,
      createdAt,
    },
  });
}

async function main() {
  const createdUsers = await Promise.all(demoUsers.map(ensureUser));
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          'nethmikp@gmail.com',
          'sample@gmail.com',
          ...demoUsers.map((user) => user.email),
        ],
      },
    },
  });

  const usersByEmail = new Map(users.map((user) => [user.email, user]));
  const listings = await prisma.listing.findMany({
    where: {
      title: {
        in: Object.values(listingTitles),
      },
    },
    include: {
      seller: true,
    },
  });
  const listingsByTitle = new Map(listings.map((listing) => [listing.title, listing]));

  const nethmi = usersByEmail.get('nethmikp@gmail.com');
  const sample = usersByEmail.get('sample@gmail.com');
  const qaBuyer = createdUsers.find((user) => user.email === 'qa.buyer@classified.local');

  if (!nethmi) {
    throw new Error('Expected user nethmikp@gmail.com to exist before seeding demo data.');
  }

  const savedTargets = [
    listingsByTitle.get(listingTitles.apartment),
    listingsByTitle.get(listingTitles.iphone),
    listingsByTitle.get(listingTitles.camry),
  ].filter(Boolean);

  for (const [index, listing] of savedTargets.entries()) {
    await ensureSavedListing(nethmi.id, listing.id, makeDaysAgo(index + 1, 9 + index, 15));
  }

  if (sample) {
    const sampleSavedTargets = [
      listingsByTitle.get(listingTitles.marketing),
      listingsByTitle.get(listingTitles.acService),
    ].filter(Boolean);

    for (const [index, listing] of sampleSavedTargets.entries()) {
      await ensureSavedListing(sample.id, listing.id, makeDaysAgo(index + 2, 11 + index, 30));
    }
  }

  const camryListing = listingsByTitle.get(listingTitles.camry);
  if (camryListing) {
    const conversation = await ensureConversation({
      listingId: camryListing.id,
      buyerId: nethmi.id,
      sellerId: camryListing.sellerId,
    });

    await ensureMessages(conversation.id, [
      {
        senderId: nethmi.id,
        body: 'Hi Samira, is the Camry still available this week?',
        createdAt: makeDaysAgo(2, 9, 10),
        readAt: makeDaysAgo(2, 9, 16),
      },
      {
        senderId: camryListing.sellerId,
        body: 'Yes, it is still available and ready for viewing after 6 PM.',
        createdAt: makeDaysAgo(2, 9, 15),
        readAt: makeDaysAgo(2, 9, 20),
      },
      {
        senderId: nethmi.id,
        body: 'Great. Can you share if the service history is complete?',
        createdAt: makeDaysAgo(2, 9, 22),
        readAt: makeDaysAgo(2, 9, 30),
      },
      {
        senderId: camryListing.sellerId,
        body: 'Yes, full Toyota service history is available. I can bring the records to the meetup.',
        createdAt: makeDaysAgo(2, 9, 28),
        readAt: null,
      },
    ]);

    await syncConversationState(
      conversation.id,
      nethmi.id,
      camryListing.sellerId,
    );
  }

  const apartmentListing = listingsByTitle.get(listingTitles.apartment);
  if (apartmentListing) {
    const conversation = await ensureConversation({
      listingId: apartmentListing.id,
      buyerId: nethmi.id,
      sellerId: apartmentListing.sellerId,
    });

    await ensureMessages(conversation.id, [
      {
        senderId: nethmi.id,
        body: 'Hello, is the 2BR apartment available for move-in from next month?',
        createdAt: makeDaysAgo(4, 18, 5),
        readAt: makeDaysAgo(4, 18, 45),
      },
      {
        senderId: apartmentListing.sellerId,
        body: 'Yes, next month works. The current tenant checks out on the 28th.',
        createdAt: makeDaysAgo(4, 18, 40),
        readAt: makeDaysAgo(4, 18, 55),
      },
      {
        senderId: nethmi.id,
        body: 'Perfect, I would like to schedule a viewing on Saturday morning.',
        createdAt: makeDaysAgo(4, 18, 58),
        readAt: makeDaysAgo(4, 19, 10),
      },
    ]);

    await syncConversationState(
      conversation.id,
      nethmi.id,
      apartmentListing.sellerId,
    );
  }

  const reactRoleListing = listingsByTitle.get(listingTitles.reactRole);
  if (reactRoleListing && sample) {
    const conversation = await ensureConversation({
      listingId: reactRoleListing.id,
      buyerId: sample.id,
      sellerId: reactRoleListing.sellerId,
    });

    await ensureMessages(conversation.id, [
      {
        senderId: sample.id,
        body: 'Hi, is this React role open to remote candidates within the UAE?',
        createdAt: makeDaysAgo(1, 14, 5),
        readAt: null,
      },
      {
        senderId: reactRoleListing.sellerId,
        body: 'Yes, hybrid is preferred, but we can consider remote for the right candidate.',
        createdAt: makeDaysAgo(1, 14, 12),
        readAt: makeDaysAgo(1, 14, 25),
      },
      {
        senderId: sample.id,
        body: 'Nice. I have 5 years with React and Next.js. Can I send my portfolio here first?',
        createdAt: makeDaysAgo(1, 14, 28),
        readAt: null,
      },
    ]);

    await syncConversationState(
      conversation.id,
      sample.id,
      reactRoleListing.sellerId,
    );
  }

  if (reactRoleListing && qaBuyer) {
    const conversation = await ensureConversation({
      listingId: reactRoleListing.id,
      buyerId: qaBuyer.id,
      sellerId: reactRoleListing.sellerId,
    });

    await ensureMessages(conversation.id, [
      {
        senderId: qaBuyer.id,
        body: 'Hello, does this opening include frontend architecture responsibilities?',
        createdAt: makeDaysAgo(3, 11, 0),
        readAt: makeDaysAgo(3, 11, 20),
      },
      {
        senderId: reactRoleListing.sellerId,
        body: 'Yes, the role includes ownership of component architecture and performance reviews.',
        createdAt: makeDaysAgo(3, 11, 18),
        readAt: makeDaysAgo(3, 11, 40),
      },
    ]);

    await syncConversationState(
      conversation.id,
      qaBuyer.id,
      reactRoleListing.sellerId,
    );
  }

  if (camryListing && sample) {
    const reportCreatedAt = makeDaysAgo(1, 16, 5);
    const report = await ensureReport({
      listingId: camryListing.id,
      reporterId: sample.id,
      reason: ListingReportReason.MISLEADING,
      details: 'Mileage details feel incomplete and the post does not mention accident history.',
      status: ListingReportStatus.OPEN,
      createdAt: reportCreatedAt,
    });

    await ensureModerationEvent({
      listingId: camryListing.id,
      reportId: report.id,
      actorId: sample.id,
      action: ModerationActionType.REPORT_CREATED,
      notes: 'Mileage details feel incomplete and the post does not mention accident history.',
      previousListingStatus: camryListing.status,
      nextListingStatus: camryListing.status,
      resultingReportStatus: ListingReportStatus.OPEN,
      createdAt: reportCreatedAt,
    });
  }

  const iphoneListing = listingsByTitle.get(listingTitles.iphone);
  if (iphoneListing && qaBuyer) {
    const reportCreatedAt = makeDaysAgo(2, 12, 10);
    const reviewAt = makeDaysAgo(2, 12, 40);
    const report = await ensureReport({
      listingId: iphoneListing.id,
      reporterId: qaBuyer.id,
      reason: ListingReportReason.PROHIBITED_ITEM,
      details: 'Please verify whether the device has valid proof of ownership before keeping it live.',
      status: ListingReportStatus.UNDER_REVIEW,
      createdAt: reportCreatedAt,
    });

    await ensureModerationEvent({
      listingId: iphoneListing.id,
      reportId: report.id,
      actorId: qaBuyer.id,
      action: ModerationActionType.REPORT_CREATED,
      notes: 'Please verify whether the device has valid proof of ownership before keeping it live.',
      previousListingStatus: iphoneListing.status,
      nextListingStatus: iphoneListing.status,
      resultingReportStatus: ListingReportStatus.OPEN,
      createdAt: reportCreatedAt,
    });

    await ensureModerationEvent({
      listingId: iphoneListing.id,
      reportId: report.id,
      actorId: null,
      action: ModerationActionType.REPORT_UNDER_REVIEW,
      notes: 'Flagged for manual moderation review.',
      previousListingStatus: iphoneListing.status,
      nextListingStatus: iphoneListing.status,
      resultingReportStatus: ListingReportStatus.UNDER_REVIEW,
      createdAt: reviewAt,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        seededFor: nethmi.displayName,
        savedListingsAdded: savedTargets.length,
        conversationsEnsured: 4,
        moderationReportsEnsured: 2,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
