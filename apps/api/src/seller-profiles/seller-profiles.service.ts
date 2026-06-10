import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  ListingPaymentMode,
  ListingStatus,
  NotificationType,
  Prisma,
  SellerDocumentSubmissionStatus,
  SellerPriorityTier,
  SellerPrivilegeTierCode,
  SellerProfileStatus,
  TransactionStatus,
  TransactionType,
  VerifiedSellerStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignSellerBadgeDto,
  CreateSellerDocumentRequestDto,
  QuerySellerProfilesDto,
  RequestVerifiedSellerDto,
  ReviewSellerDocumentDto,
  ReviewSellerProfileDto,
  ReviewVerifiedSellerDto,
  SellerDocumentSubmissionDto,
  SubmitSellerProfileDto,
  UpdateSellerProfileDto,
  UpsertSellerBadgeTypeDto,
  UpsertSellerPrivilegeQuotaDto,
  UpsertSellerPrivilegeTierDto,
} from './dto/seller-profiles.dto';

const sellerFormSettingKey = 'seller_profile_form_definition';

const defaultSellerFormDefinition = {
  fields: [
    {
      key: 'business_name',
      label: 'Business name',
      type: 'text',
      required: true,
      placeholder: 'Example Traders LLC',
      helpText: 'Use the name buyers should see on your listings.',
      sortOrder: 10,
    },
    {
      key: 'seller_type',
      label: 'Seller type',
      type: 'select',
      required: true,
      options: ['Individual', 'Dealer', 'Agency', 'Store'],
      sortOrder: 20,
    },
    {
      key: 'about_business',
      label: 'About your business',
      type: 'textarea',
      required: true,
      placeholder: 'Tell buyers what you sell and why they should trust you.',
      sortOrder: 30,
    },
    {
      key: 'years_active',
      label: 'Years active',
      type: 'text',
      placeholder: '5 years',
      sortOrder: 40,
    },
    {
      key: 'trade_license',
      label: 'Trade license or registration copy',
      type: 'file',
      required: false,
      helpText: 'Upload a document or proof URL if available.',
      sortOrder: 50,
    },
  ],
};

const defaultPrivilegeTiers = [
  {
    code: SellerPrivilegeTierCode.FREE,
    name: 'Free',
    slug: 'free',
    description: 'Starter seller access with a small monthly free quota.',
    monthlyFreeListingLimit: 3,
    activeListingLimit: 10,
    pendingListingLimit: 5,
    paidListingFee: 25,
    sellerLevelUpgradeFee: 0,
    currency: 'AED',
    sortOrder: 10,
  },
  {
    code: SellerPrivilegeTierCode.PREMIUM,
    name: 'Premium',
    slug: 'premium',
    description: 'Higher listing limits for active sellers.',
    monthlyFreeListingLimit: 10,
    activeListingLimit: 50,
    pendingListingLimit: 15,
    paidListingFee: 10,
    sellerLevelUpgradeFee: 99,
    currency: 'AED',
    sortOrder: 20,
  },
  {
    code: SellerPrivilegeTierCode.VERIFIED,
    name: 'Verified',
    slug: 'verified',
    description: 'Approved and verified seller experience.',
    monthlyFreeListingLimit: 15,
    activeListingLimit: 75,
    pendingListingLimit: 20,
    paidListingFee: 0,
    sellerLevelUpgradeFee: 149,
    currency: 'AED',
    sortOrder: 30,
  },
  {
    code: SellerPrivilegeTierCode.VIP,
    name: 'VIP',
    slug: 'vip',
    description: 'Top-tier seller visibility and flexible quotas.',
    monthlyFreeListingLimit: 30,
    activeListingLimit: 150,
    pendingListingLimit: 30,
    paidListingFee: 0,
    sellerLevelUpgradeFee: 299,
    currency: 'AED',
    sortOrder: 40,
  },
];

const defaultBadges = [
  {
    label: 'Verified Seller',
    slug: 'verified-seller',
    description: 'Granted after admin verification.',
    icon: 'check-badge',
    backgroundColor: '#dcfce7',
    textColor: '#166534',
    style: { preset: 'success' },
    sortOrder: 10,
  },
  {
    label: 'Most Popular Seller',
    slug: 'most-popular-seller',
    description: 'Highlights strong customer engagement.',
    icon: 'flame',
    backgroundColor: '#fff7ed',
    textColor: '#c2410c',
    style: { preset: 'accent' },
    sortOrder: 20,
  },
  {
    label: 'Honored Seller',
    slug: 'honored-seller',
    description: 'Awarded by admins for reliability and trust.',
    icon: 'star',
    backgroundColor: '#eff6ff',
    textColor: '#1d4ed8',
    style: { preset: 'brand' },
    sortOrder: 30,
  },
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function normalizeSellerFormDefinition(input: unknown) {
  const rawFields =
    input &&
    typeof input === 'object' &&
    'fields' in input &&
    Array.isArray((input as { fields?: unknown[] }).fields)
      ? (input as { fields: Array<Record<string, unknown>> }).fields
      : [];

  const fields = rawFields
    .map((field, index) => {
      const label = String(field.label ?? '').trim();
      const rawKey = String(field.key ?? label).trim();
      const key = slugify(rawKey).replace(/-/g, '_');
      const rawType = String(field.type ?? 'text').trim().toLowerCase();
      const type = ['text', 'textarea', 'select', 'toggle', 'file'].includes(
        rawType,
      )
        ? rawType
        : 'text';
      const options = Array.isArray(field.options)
        ? field.options
            .map((option) => String(option ?? '').trim())
            .filter(Boolean)
        : undefined;

      if (!label || !key) {
        return null;
      }

      return {
        label,
        key,
        type,
        required: field.required === true,
        placeholder: String(field.placeholder ?? '').trim() || undefined,
        helpText: String(field.helpText ?? '').trim() || undefined,
        options: type === 'select' ? options ?? [] : undefined,
        sortOrder:
          typeof field.sortOrder === 'number' && Number.isFinite(field.sortOrder)
            ? field.sortOrder
            : (index + 1) * 10,
      };
    })
    .filter((field): field is NonNullable<typeof field> => Boolean(field))
    .sort((first, second) => first.sortOrder - second.sortOrder);

  return { fields };
}

function getRequiredFieldKeys(definition: { fields?: Array<Record<string, unknown>> }) {
  return (definition.fields ?? [])
    .filter((field) => field.required === true && typeof field.key === 'string')
    .map((field) => String(field.key));
}

function hasAnswerValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return false;
}

function isAdminRole(role: string) {
  return role.trim().toUpperCase() === 'ADMIN';
}

const sellerProfileInclude = {
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      displayName: true,
      avatarUrl: true,
      location: true,
      bio: true,
      role: true,
      sellerPriorityTier: true,
      emailVerified: true,
      phoneVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  },
  privilegeTier: true,
  documentRequests: {
    orderBy: [{ createdAt: 'desc' as const }],
  },
  documentSubmissions: {
    orderBy: [{ submittedAt: 'desc' as const }],
    include: {
      request: true,
      submittedBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  },
  badgeAssignments: {
    orderBy: [{ assignedAt: 'desc' as const }],
    include: {
      badgeType: true,
      assignedBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.SellerProfileInclude;

type SellerProfileWithRelations = Prisma.SellerProfileGetPayload<{
  include: typeof sellerProfileInclude;
}>;

@Injectable()
export class SellerProfilesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  async getSellerFormDefinition() {
    await this.ensureDefaults();
    const setting = await this.prisma.marketplaceSetting.findUnique({
      where: { key: sellerFormSettingKey },
    });

    return normalizeSellerFormDefinition(setting?.value ?? defaultSellerFormDefinition);
  }

  async updateSellerFormDefinition(schemaDefinition: Record<string, unknown>) {
    const normalized = normalizeSellerFormDefinition(schemaDefinition);
    await this.prisma.marketplaceSetting.upsert({
      where: { key: sellerFormSettingKey },
      update: { value: normalized },
      create: { key: sellerFormSettingKey, value: normalized },
    });

    return normalized;
  }

  async registerSellerProfile(userId: string, role: string, input?: UpdateSellerProfileDto) {
    return this.ensureSellerProfile(userId, role, input);
  }

  async getMySellerProfile(userId: string) {
    await this.ensureDefaults();
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: sellerProfileInclude,
    });
    const formDefinition = await this.getSellerFormDefinition();

    if (!profile) {
      return {
        sellerProfile: null,
        formDefinition,
      };
    }

    return {
      sellerProfile: await this.mapSellerProfile(profile),
      formDefinition,
    };
  }

  async getPublicSellerProfile(userId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: sellerProfileInclude,
    });
    const user = profile?.user ??
      (await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          phone: true,
          displayName: true,
          avatarUrl: true,
          location: true,
          bio: true,
          role: true,
          sellerPriorityTier: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }));

    if (!user) {
      throw new NotFoundException('Seller not found');
    }

    const stats = await this.getSellerActivityStats(userId);
    return {
      id: user.id,
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      joinedAt: user.createdAt,
      sellerPriorityTier: user.sellerPriorityTier,
      profileStatus: profile?.status ?? null,
      verifiedSellerStatus: profile?.verifiedSellerStatus ?? null,
      badges: (profile?.badgeAssignments ?? [])
        .filter((assignment) => assignment.badgeType.isActive && !assignment.badgeType.isHidden)
        .map((assignment) => this.mapBadgeAssignment(assignment)),
      stats,
      formAnswers: profile?.status === SellerProfileStatus.APPROVED ? profile.formAnswers : null,
      reviewNotes: profile?.status === SellerProfileStatus.APPROVED ? profile.reviewNotes : null,
    };
  }

  async switchToSeller(userId: string, role: string) {
    const profile = await this.ensureSellerProfile(userId, role);
    return this.mapSellerProfile(profile);
  }

  async updateMySellerProfile(userId: string, dto: UpdateSellerProfileDto) {
    const existing = await this.requireSellerProfileByUserId(userId);
    const formDefinition = await this.getSellerFormDefinition();
    const formAnswers = {
      ...this.asRecord(existing.formAnswers),
      ...this.asRecord(dto.formAnswers),
    };

    const profile = await this.prisma.sellerProfile.update({
      where: { id: existing.id },
      data: {
        formDefinition,
        formAnswers: toJsonValue(formAnswers),
        requestMetadata: dto.requestMetadata
          ? toJsonValue({
              ...this.asRecord(existing.requestMetadata),
              ...dto.requestMetadata,
            })
          : undefined,
        status:
          existing.status === SellerProfileStatus.REJECTED
            ? SellerProfileStatus.DRAFT
            : existing.status,
        rejectedAt:
          existing.status === SellerProfileStatus.REJECTED ? null : undefined,
        rejectionReason:
          existing.status === SellerProfileStatus.REJECTED ? null : undefined,
      },
      include: sellerProfileInclude,
    });

    return this.mapSellerProfile(profile);
  }

  async submitMySellerProfile(userId: string, dto: SubmitSellerProfileDto) {
    await this.updateMySellerProfile(userId, dto);
    const profile = await this.requireSellerProfileByUserId(userId);
    const formDefinition = await this.getSellerFormDefinition();
    const missingFields = this.getMissingRequiredFields(
      formDefinition,
      this.asRecord(profile.formAnswers),
    );

    if (missingFields.length) {
      throw new BadRequestException(
        `Complete all required seller fields before submitting: ${missingFields.join(', ')}`,
      );
    }

    const updated = await this.prisma.sellerProfile.update({
      where: { id: profile.id },
      data: {
        status: SellerProfileStatus.PENDING,
        requestedAt: profile.requestedAt ?? new Date(),
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedById: null,
        reviewNotes: null,
        rejectionReason: null,
        rejectedAt: null,
      },
      include: sellerProfileInclude,
    });

    return this.mapSellerProfile(updated);
  }

  async submitSellerDocument(userId: string, dto: SellerDocumentSubmissionDto) {
    const profile = await this.requireSellerProfileByUserId(userId);
    const request =
      dto.requestId
        ? await this.prisma.sellerDocumentRequest.findUnique({
            where: { id: dto.requestId },
          })
        : null;

    if (dto.requestId && (!request || request.sellerProfileId !== profile.id)) {
      throw new NotFoundException('Document request not found');
    }

    const submission = await this.prisma.sellerDocumentSubmission.create({
      data: {
        sellerProfileId: profile.id,
        requestId: dto.requestId,
        submittedById: userId,
        status: SellerDocumentSubmissionStatus.SUBMITTED,
        answers: toJsonValue(dto.answers ?? {}),
        files: toJsonValue(dto.files ?? []),
      },
      include: {
        request: true,
        submittedBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    return submission;
  }

  async requestVerifiedSeller(userId: string, dto: RequestVerifiedSellerDto) {
    const profile = await this.requireSellerProfileByUserId(userId);

    if (profile.status !== SellerProfileStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved sellers can request verified seller status',
      );
    }

    const updated = await this.prisma.sellerProfile.update({
      where: { id: profile.id },
      data: {
        verifiedSellerStatus: VerifiedSellerStatus.REQUESTED,
        requestMetadata: toJsonValue({
          ...this.asRecord(profile.requestMetadata),
          ...(dto.requestMetadata ?? {}),
          verifiedRequestedAt: new Date().toISOString(),
        }),
        reviewNotes: dto.reviewNotes ?? profile.reviewNotes ?? undefined,
      },
      include: sellerProfileInclude,
    });

    return this.mapSellerProfile(updated);
  }

  async getAdminSellerOverview() {
    await this.ensureDefaults();
    const [profiles, badgeTypes, formDefinition, tiers] = await Promise.all([
      this.prisma.sellerProfile.findMany({
        include: sellerProfileInclude,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.sellerBadgeType.findMany(),
      this.getSellerFormDefinition(),
      this.prisma.sellerPrivilegeTier.findMany({
        include: {
          categoryQuotas: true,
        },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const profileRows = await Promise.all(
      profiles.map((profile) => this.mapSellerProfile(profile)),
    );

    return {
      stats: {
        totalSellers: profileRows.length,
        pendingApprovals: profileRows.filter((item) => item.status === 'PENDING')
          .length,
        verifiedRequests: profileRows.filter(
          (item) => item.verifiedSellerStatus === 'REQUESTED',
        ).length,
        approvedSellers: profileRows.filter((item) => item.status === 'APPROVED')
          .length,
        suspendedSellers: profileRows.filter((item) => item.status === 'SUSPENDED')
          .length,
        badgeTypes: badgeTypes.length,
        activeBadgeTypes: badgeTypes.filter((badge) => badge.isActive).length,
        formFieldCount: formDefinition.fields.length,
        privilegeTiers: tiers.length,
        totalCategoryQuotas: tiers.reduce(
          (sum, tier) => sum + tier.categoryQuotas.length,
          0,
        ),
      },
      sellers: profileRows,
    };
  }

  async listSellerProfiles(query: QuerySellerProfilesDto) {
    const profiles = await this.prisma.sellerProfile.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.verifiedStatus
          ? { verifiedSellerStatus: query.verifiedStatus }
          : {}),
        ...(query.search
          ? {
              user: {
                OR: [
                  {
                    displayName: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    email: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            }
          : {}),
      },
      include: sellerProfileInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: query.take ?? 100,
    });

    return Promise.all(profiles.map((profile) => this.mapSellerProfile(profile)));
  }

  async getSellerProfileForAdmin(id: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { id },
      include: sellerProfileInclude,
    });

    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }

    return this.mapSellerProfile(profile);
  }

  async reviewSellerProfile(
    id: string,
    actorId: string,
    dto: ReviewSellerProfileDto,
  ) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { id },
      include: sellerProfileInclude,
    });

    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }

    if (dto.status === 'APPROVED') {
      const formDefinition = await this.getSellerFormDefinition();
      const missingFields = this.getMissingRequiredFields(
        formDefinition,
        this.asRecord(profile.formAnswers),
      );

      if (missingFields.length) {
        throw new BadRequestException(
          `Required seller fields are missing: ${missingFields.join(', ')}`,
        );
      }

      const unresolvedRequiredDocs = this.getUnresolvedRequiredDocumentLabels(profile);

      if (unresolvedRequiredDocs.length) {
        throw new BadRequestException(
          `Required documents are still pending: ${unresolvedRequiredDocs.join(', ')}`,
        );
      }
    }

    const nextTierId =
      dto.privilegeTierId ?? profile.privilegeTierId ?? (await this.getDefaultTierId());
    const updated = await this.prisma.sellerProfile.update({
      where: { id },
      data: {
        status: dto.status,
        privilegeTierId: nextTierId,
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewNotes: dto.reviewNotes ?? null,
        rejectionReason:
          dto.status === 'REJECTED' ? (dto.rejectionReason ?? null) : null,
        reviewMetadata: dto.reviewMetadata
          ? toJsonValue(dto.reviewMetadata)
          : undefined,
        approvedAt: dto.status === 'APPROVED' ? new Date() : null,
        rejectedAt: dto.status === 'REJECTED' ? new Date() : null,
      },
      include: sellerProfileInclude,
    });

    await this.syncLegacySellerPriorityTier(updated.userId);
    await this.notifications.notifySellerAccountDecision({
      userId: updated.userId,
      actorId,
      previousTier: updated.user.sellerPriorityTier,
      nextTier: await this.deriveLegacySellerPriorityTier(updated.userId),
      metadata: {
        sellerProfileStatus: dto.status,
        reviewNotes: dto.reviewNotes ?? null,
        rejectionReason: dto.rejectionReason ?? null,
      },
    });

    return this.mapSellerProfile(updated);
  }

  async createSellerDocumentRequest(
    sellerProfileId: string,
    dto: CreateSellerDocumentRequestDto,
  ) {
    await this.requireSellerProfileById(sellerProfileId);

    return this.prisma.sellerDocumentRequest.create({
      data: {
        sellerProfileId,
        label: dto.label.trim(),
        slug: slugify(dto.slug?.trim() || dto.label),
        description: dto.description,
        isRequired: dto.isRequired ?? true,
        formDefinition: toJsonValue(dto.formDefinition ?? {}),
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
    });
  }

  async reviewSellerDocument(
    documentSubmissionId: string,
    actorId: string,
    dto: ReviewSellerDocumentDto,
  ) {
    const submission = await this.prisma.sellerDocumentSubmission.findUnique({
      where: { id: documentSubmissionId },
      include: {
        request: true,
      },
    });

    if (!submission) {
      throw new NotFoundException('Seller document submission not found');
    }

    return this.prisma.sellerDocumentSubmission.update({
      where: { id: documentSubmissionId },
      data: {
        status: dto.status,
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewNotes: dto.reviewNotes ?? null,
        rejectionReason:
          dto.status === 'REJECTED' ? (dto.rejectionReason ?? null) : null,
        reviewMetadata: dto.reviewMetadata
          ? toJsonValue(dto.reviewMetadata)
          : undefined,
      },
      include: {
        request: true,
        reviewedBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });
  }

  async reviewVerifiedSeller(
    sellerProfileId: string,
    actorId: string,
    dto: ReviewVerifiedSellerDto,
  ) {
    const profile = await this.requireSellerProfileById(sellerProfileId);

    const updated = await this.prisma.sellerProfile.update({
      where: { id: sellerProfileId },
      data: {
        verifiedSellerStatus: dto.status,
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewNotes: dto.reviewNotes ?? profile.reviewNotes ?? null,
        reviewMetadata: dto.reviewMetadata
          ? toJsonValue(dto.reviewMetadata)
          : undefined,
      },
      include: sellerProfileInclude,
    });

    await this.syncLegacySellerPriorityTier(updated.userId);

    if (dto.status === 'VERIFIED') {
      const verifiedBadge = await this.prisma.sellerBadgeType.findUnique({
        where: { slug: 'verified-seller' },
      });

      if (verifiedBadge) {
        await this.prisma.sellerBadgeAssignment.upsert({
          where: {
            userId_badgeTypeId: {
              userId: updated.userId,
              badgeTypeId: verifiedBadge.id,
            },
          },
          update: {
            sellerProfileId: updated.id,
            assignedById: actorId,
            metadata: {
              source: 'verified-seller-review',
            },
          },
          create: {
            userId: updated.userId,
            sellerProfileId: updated.id,
            badgeTypeId: verifiedBadge.id,
            assignedById: actorId,
            metadata: {
              source: 'verified-seller-review',
            },
          },
        });
      }
    }

    await this.notifications.createNotification({
      userId: updated.userId,
      actorId,
      type: NotificationType.SYSTEM,
      title:
        dto.status === 'VERIFIED'
          ? 'Verified seller approved'
          : dto.status === 'REJECTED'
            ? 'Verified seller request rejected'
            : 'Verified seller status removed',
      body:
        dto.reviewNotes ??
        (dto.status === 'VERIFIED'
          ? 'Your seller account now shows the verified seller badge.'
          : 'Your verified seller status was updated by admin review.'),
      metadata: {
        deepLink: '/my-listings',
        verifiedSellerStatus: dto.status,
      },
    });

    return this.mapSellerProfile(updated);
  }

  async listSellerPrivilegeTiers() {
    await this.ensureDefaults();
    return this.prisma.sellerPrivilegeTier.findMany({
      include: {
        categoryQuotas: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                parentId: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upgradeMySellerPrivilege(userId: string, sellerPrivilegeTierId: string) {
    await this.ensureDefaults();
    const profile = await this.requireSellerProfileByUserId(userId);

    if (profile.status !== SellerProfileStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved sellers can upgrade seller privileges',
      );
    }

    const [targetTier, currentTier] = await Promise.all([
      this.prisma.sellerPrivilegeTier.findUnique({
        where: { id: sellerPrivilegeTierId },
      }),
      profile.privilegeTierId
        ? this.prisma.sellerPrivilegeTier.findUnique({
            where: { id: profile.privilegeTierId },
          })
        : this.prisma.sellerPrivilegeTier.findUnique({
            where: { code: SellerPrivilegeTierCode.FREE },
          }),
    ]);

    if (!targetTier || !targetTier.isActive) {
      throw new NotFoundException('Seller privilege tier not found');
    }

    if (!currentTier) {
      throw new BadRequestException('Current seller privilege tier is missing');
    }

    if (targetTier.id === currentTier.id) {
      throw new BadRequestException('You are already on this seller tier');
    }

    if (targetTier.sortOrder <= currentTier.sortOrder) {
      throw new BadRequestException(
        'Choose a higher seller privilege tier to upgrade',
      );
    }

    const upgradeFee = new Prisma.Decimal(targetTier.sellerLevelUpgradeFee);
    const upgradedProfile = await this.prisma.$transaction(async (tx) => {
      if (upgradeFee.gt(0)) {
        const wallet = await tx.walletAccount.upsert({
          where: { userId },
          update: {},
          create: {
            userId,
            currency: targetTier.currency,
          },
        });

        if (wallet.currency !== targetTier.currency) {
          throw new BadRequestException(
            'Wallet currency does not match the seller tier currency',
          );
        }

        if (new Prisma.Decimal(wallet.balance).lt(upgradeFee)) {
          throw new BadRequestException(
            'Insufficient wallet balance for the seller tier upgrade',
          );
        }

        const nextBalance = new Prisma.Decimal(wallet.balance).minus(upgradeFee);
        const paidAt = new Date();
        const transaction = await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.SELLER_LEVEL_UPGRADE,
            status: TransactionStatus.SUCCEEDED,
            amount: upgradeFee,
            currency: targetTier.currency,
            provider: 'wallet',
            providerRef: `wallet-upgrade:${userId}:${targetTier.id}:${paidAt.getTime()}`,
            metadata: {
              previousTierId: currentTier.id,
              previousTierCode: currentTier.code,
              nextTierId: targetTier.id,
              nextTierCode: targetTier.code,
              paidAt: paidAt.toISOString(),
              walletPaidAt: paidAt.toISOString(),
            },
          },
        });

        await tx.walletAccount.update({
          where: { id: wallet.id },
          data: {
            balance: nextBalance,
          },
        });

        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            transactionId: transaction.id,
            type: 'SELLER_LEVEL_UPGRADE',
            amount: upgradeFee.mul(-1),
            currency: targetTier.currency,
            balanceAfter: nextBalance,
            metadata: {
              previousTierId: currentTier.id,
              previousTierCode: currentTier.code,
              nextTierId: targetTier.id,
              nextTierCode: targetTier.code,
            },
          },
        });
      }

      return tx.sellerProfile.update({
        where: { id: profile.id },
        data: {
          privilegeTierId: targetTier.id,
          reviewMetadata: toJsonValue({
            ...this.asRecord(profile.reviewMetadata),
            upgradedAt: new Date().toISOString(),
            upgradedFromTierId: currentTier.id,
            upgradedToTierId: targetTier.id,
          }),
        },
        include: sellerProfileInclude,
      });
    });

    await this.syncLegacySellerPriorityTier(upgradedProfile.userId);

    try {
      await this.notifications.createNotification({
        userId: upgradedProfile.userId,
        actorId: upgradedProfile.userId,
        type: NotificationType.SYSTEM,
        title: 'Seller tier upgraded',
        body: `Your seller tier is now ${targetTier.name}.`,
        metadata: {
          deepLink: '/my-listings',
          sellerPrivilegeTierId: targetTier.id,
          sellerPrivilegeTierCode: targetTier.code,
        },
      });
    } catch {
      // Keep wallet and privilege updates successful even if notification storage fails.
    }

    return this.mapSellerProfile(upgradedProfile);
  }

  async upsertSellerPrivilegeTier(dto: UpsertSellerPrivilegeTierDto) {
    await this.ensureDefaults();
    const data = {
      code: dto.code,
      name: dto.name.trim(),
      slug: slugify(dto.slug?.trim() || dto.name),
      description: dto.description,
      monthlyFreeListingLimit: dto.monthlyFreeListingLimit ?? 0,
      activeListingLimit: dto.activeListingLimit ?? null,
      pendingListingLimit: dto.pendingListingLimit ?? null,
      paidListingFee: new Prisma.Decimal(dto.paidListingFee ?? 0),
      sellerLevelUpgradeFee: new Prisma.Decimal(dto.sellerLevelUpgradeFee ?? 0),
      currency: (dto.currency ?? 'AED').toUpperCase(),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    };

    return dto.id
      ? this.prisma.sellerPrivilegeTier.update({
          where: { id: dto.id },
          data,
        })
      : this.prisma.sellerPrivilegeTier.upsert({
          where: { code: dto.code },
          update: data,
          create: data,
        });
  }

  async upsertSellerPrivilegeQuota(
    sellerPrivilegeTierId: string,
    dto: UpsertSellerPrivilegeQuotaDto,
  ) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.sellerPrivilegeCategoryQuota.upsert({
      where: {
        sellerPrivilegeTierId_categoryId: {
          sellerPrivilegeTierId,
          categoryId: dto.categoryId,
        },
      },
      update: {
        monthlyFreeListingLimit: dto.monthlyFreeListingLimit ?? null,
        activeListingLimit: dto.activeListingLimit ?? null,
        pendingListingLimit: dto.pendingListingLimit ?? null,
        paidListingFee:
          dto.paidListingFee == null ? null : new Prisma.Decimal(dto.paidListingFee),
      },
      create: {
        sellerPrivilegeTierId,
        categoryId: dto.categoryId,
        monthlyFreeListingLimit: dto.monthlyFreeListingLimit ?? null,
        activeListingLimit: dto.activeListingLimit ?? null,
        pendingListingLimit: dto.pendingListingLimit ?? null,
        paidListingFee:
          dto.paidListingFee == null ? null : new Prisma.Decimal(dto.paidListingFee),
      },
      include: {
        category: true,
      },
    });
  }

  async applyDefaultQuotaToAllCategories(sellerPrivilegeTierId: string) {
    const tier = await this.prisma.sellerPrivilegeTier.findUnique({
      where: { id: sellerPrivilegeTierId },
    });

    if (!tier) {
      throw new NotFoundException('Seller privilege tier not found');
    }

    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    await this.prisma.$transaction(
      categories.map((category) =>
        this.prisma.sellerPrivilegeCategoryQuota.upsert({
          where: {
            sellerPrivilegeTierId_categoryId: {
              sellerPrivilegeTierId,
              categoryId: category.id,
            },
          },
          update: {
            monthlyFreeListingLimit: tier.monthlyFreeListingLimit,
            activeListingLimit: tier.activeListingLimit,
            pendingListingLimit: tier.pendingListingLimit,
            paidListingFee: tier.paidListingFee,
          },
          create: {
            sellerPrivilegeTierId,
            categoryId: category.id,
            monthlyFreeListingLimit: tier.monthlyFreeListingLimit,
            activeListingLimit: tier.activeListingLimit,
            pendingListingLimit: tier.pendingListingLimit,
            paidListingFee: tier.paidListingFee,
          },
        }),
      ),
    );

    return { updated: categories.length };
  }

  async setAllCategoryQuotasToZero(sellerPrivilegeTierId: string) {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    await this.prisma.$transaction(
      categories.map((category) =>
        this.prisma.sellerPrivilegeCategoryQuota.upsert({
          where: {
            sellerPrivilegeTierId_categoryId: {
              sellerPrivilegeTierId,
              categoryId: category.id,
            },
          },
          update: {
            monthlyFreeListingLimit: 0,
            activeListingLimit: 0,
            pendingListingLimit: 0,
            paidListingFee: new Prisma.Decimal(0),
          },
          create: {
            sellerPrivilegeTierId,
            categoryId: category.id,
            monthlyFreeListingLimit: 0,
            activeListingLimit: 0,
            pendingListingLimit: 0,
            paidListingFee: new Prisma.Decimal(0),
          },
        }),
      ),
    );

    return { updated: categories.length };
  }

  async listSellerBadges() {
    await this.ensureDefaults();
    return this.prisma.sellerBadgeType.findMany({
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
          orderBy: {
            assignedAt: 'desc',
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }],
    });
  }

  async upsertSellerBadgeType(dto: UpsertSellerBadgeTypeDto) {
    const data = {
      label: dto.label.trim(),
      slug: slugify(dto.slug?.trim() || dto.label),
      description: dto.description,
      icon: dto.icon,
      style: toJsonValue(dto.style ?? {}),
      backgroundColor: dto.backgroundColor,
      textColor: dto.textColor,
      isActive: dto.isActive ?? true,
      isHidden: dto.isHidden ?? false,
      sortOrder: dto.sortOrder ?? 0,
    };

    return dto.id
      ? this.prisma.sellerBadgeType.update({
          where: { id: dto.id },
          data,
        })
      : this.prisma.sellerBadgeType.upsert({
          where: { slug: data.slug },
          update: data,
          create: data,
        });
  }

  async assignSellerBadge(
    sellerProfileId: string,
    actorId: string,
    dto: AssignSellerBadgeDto,
  ) {
    const profile = await this.requireSellerProfileById(sellerProfileId);
    const badgeType = await this.prisma.sellerBadgeType.findUnique({
      where: { id: dto.badgeTypeId },
    });

    if (!badgeType) {
      throw new NotFoundException('Seller badge type not found');
    }

    return this.prisma.sellerBadgeAssignment.upsert({
      where: {
        userId_badgeTypeId: {
          userId: profile.userId,
          badgeTypeId: badgeType.id,
        },
      },
      update: {
        sellerProfileId,
        assignedById: actorId,
        metadata: toJsonValue(dto.metadata ?? {}),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      create: {
        userId: profile.userId,
        sellerProfileId,
        badgeTypeId: badgeType.id,
        assignedById: actorId,
        metadata: toJsonValue(dto.metadata ?? {}),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: {
        badgeType: true,
      },
    });
  }

  async removeSellerBadge(sellerProfileId: string, assignmentId: string) {
    const assignment = await this.prisma.sellerBadgeAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        sellerProfileId: true,
      },
    });

    if (!assignment || assignment.sellerProfileId !== sellerProfileId) {
      throw new NotFoundException('Seller badge assignment not found');
    }

    await this.prisma.sellerBadgeAssignment.delete({
      where: { id: assignmentId },
    });

    return { deleted: true };
  }

  async assertApprovedSeller(userId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!profile) {
      throw new ForbiddenException(
        'Switch to a seller account before creating listings',
      );
    }

    if (profile.status !== SellerProfileStatus.APPROVED) {
      throw new ForbiddenException(
        'Your seller profile must be approved before posting listings',
      );
    }

    return profile;
  }

  async getSellerListingPolicy(userId: string, categoryId?: string) {
    await this.ensureDefaults();
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: {
        privilegeTier: {
          include: {
            categoryQuotas: true,
          },
        },
      },
    });
    const fallbackTier =
      profile?.privilegeTier ??
      (await this.prisma.sellerPrivilegeTier.findUnique({
        where: { code: SellerPrivilegeTierCode.FREE },
        include: { categoryQuotas: true },
      }));

    if (!fallbackTier) {
      throw new BadRequestException('Seller privilege tiers are not configured');
    }

    const exactQuota = categoryId
      ? fallbackTier.categoryQuotas.find((quota) => quota.categoryId === categoryId)
      : undefined;
    let inheritedQuota = exactQuota;

    if (!inheritedQuota && categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
        select: { parentId: true },
      });

      if (category?.parentId) {
        inheritedQuota = fallbackTier.categoryQuotas.find(
          (quota) => quota.categoryId === category.parentId,
        );
      }
    }

    const appliedQuota = inheritedQuota ?? null;

    return {
      tierId: fallbackTier.id,
      tierCode: fallbackTier.code,
      tierName: fallbackTier.name,
      monthlyFreeListingLimit:
        appliedQuota?.monthlyFreeListingLimit ?? fallbackTier.monthlyFreeListingLimit,
      activeListingLimit:
        appliedQuota?.activeListingLimit ?? fallbackTier.activeListingLimit,
      pendingListingLimit:
        appliedQuota?.pendingListingLimit ?? fallbackTier.pendingListingLimit,
      paidListingFee:
        appliedQuota?.paidListingFee ?? fallbackTier.paidListingFee,
      currency: fallbackTier.currency,
    };
  }

  private async ensureDefaults() {
    await this.prisma.marketplaceSetting.upsert({
      where: { key: sellerFormSettingKey },
      update: {},
      create: {
        key: sellerFormSettingKey,
        value: defaultSellerFormDefinition,
      },
    });

    for (const tier of defaultPrivilegeTiers) {
      await this.prisma.sellerPrivilegeTier.upsert({
        where: { code: tier.code },
        update: {},
        create: {
          ...tier,
          paidListingFee: new Prisma.Decimal(tier.paidListingFee),
          sellerLevelUpgradeFee: new Prisma.Decimal(tier.sellerLevelUpgradeFee),
        },
      });
    }

    for (const badge of defaultBadges) {
      await this.prisma.sellerBadgeType.upsert({
        where: { slug: badge.slug },
        update: {},
        create: badge,
      });
    }
  }

  private async ensureSellerProfile(
    userId: string,
    role: string,
    input?: UpdateSellerProfileDto,
  ) {
    if (isAdminRole(role)) {
      throw new ForbiddenException('Admin accounts cannot create seller profiles');
    }

    const existing = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: sellerProfileInclude,
    });

    if (existing) {
      return existing;
    }

    const defaultTierId = await this.getDefaultTierId();
    const formDefinition = await this.getSellerFormDefinition();

    return this.prisma.sellerProfile.create({
      data: {
        userId,
        privilegeTierId: defaultTierId,
        formDefinition,
        formAnswers: toJsonValue(input?.formAnswers ?? {}),
        requestMetadata: toJsonValue(input?.requestMetadata ?? {}),
      },
      include: sellerProfileInclude,
    });
  }

  private async requireSellerProfileByUserId(userId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: sellerProfileInclude,
    });

    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }

    return profile;
  }

  private async requireSellerProfileById(id: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { id },
      include: sellerProfileInclude,
    });

    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }

    return profile;
  }

  private async getDefaultTierId() {
    const tier = await this.prisma.sellerPrivilegeTier.findUnique({
      where: { code: SellerPrivilegeTierCode.FREE },
      select: { id: true },
    });

    if (!tier) {
      throw new BadRequestException('Default seller privilege tier is missing');
    }

    return tier.id;
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private getMissingRequiredFields(
    formDefinition: { fields?: Array<Record<string, unknown>> },
    formAnswers: Record<string, unknown>,
  ) {
    const missingKeys = getRequiredFieldKeys(formDefinition).filter(
      (key) => !hasAnswerValue(formAnswers[key]),
    );

    const fieldMap = new Map(
      (formDefinition.fields ?? []).map((field) => [
        String(field.key ?? ''),
        String(field.label ?? field.key ?? ''),
      ]),
    );

    return missingKeys.map((key) => fieldMap.get(key) ?? key);
  }

  private getUnresolvedRequiredDocumentLabels(profile: SellerProfileWithRelations) {
    return profile.documentRequests
      .filter((request) => request.isRequired)
      .filter((request) => {
        const latestSubmission = profile.documentSubmissions.find(
          (submission) => submission.requestId === request.id,
        );

        return (
          !latestSubmission ||
          latestSubmission.status !== SellerDocumentSubmissionStatus.APPROVED
        );
      })
      .map((request) => request.label);
  }

  private async mapSellerProfile(profile: SellerProfileWithRelations) {
    const stats = await this.getSellerActivityStats(profile.userId);

    return {
      id: profile.id,
      userId: profile.userId,
      status: profile.status,
      verifiedSellerStatus: profile.verifiedSellerStatus,
      user: profile.user,
      privilegeTier: profile.privilegeTier,
      formDefinition: profile.formDefinition,
      formAnswers: profile.formAnswers,
      requestMetadata: profile.requestMetadata,
      reviewMetadata: profile.reviewMetadata,
      reviewNotes: profile.reviewNotes,
      requestedAt: profile.requestedAt,
      submittedAt: profile.submittedAt,
      approvedAt: profile.approvedAt,
      rejectedAt: profile.rejectedAt,
      reviewedAt: profile.reviewedAt,
      reviewedBy: profile.reviewedBy,
      rejectionReason: profile.rejectionReason,
      documentRequests: profile.documentRequests,
      documentSubmissions: profile.documentSubmissions,
      badges: profile.badgeAssignments.map((assignment) =>
        this.mapBadgeAssignment(assignment),
      ),
      stats,
      unresolvedRequiredDocuments: this.getUnresolvedRequiredDocumentLabels(profile),
      missingRequiredFields: this.getMissingRequiredFields(
        normalizeSellerFormDefinition(profile.formDefinition ?? defaultSellerFormDefinition),
        this.asRecord(profile.formAnswers),
      ),
    };
  }

  private mapBadgeAssignment(
    assignment: SellerProfileWithRelations['badgeAssignments'][number],
  ) {
    return {
      id: assignment.id,
      assignedAt: assignment.assignedAt,
      expiresAt: assignment.expiresAt,
      metadata: assignment.metadata,
      badgeType: assignment.badgeType,
      assignedBy: assignment.assignedBy,
    };
  }

  private async getSellerActivityStats(userId: string) {
    const [
      totalListings,
      activeListings,
      pendingListings,
      soldListings,
      conversationCount,
      offerCount,
    ] = await Promise.all([
      this.prisma.listing.count({ where: { sellerId: userId } }),
      this.prisma.listing.count({
        where: { sellerId: userId, status: ListingStatus.ACTIVE },
      }),
      this.prisma.listing.count({
        where: { sellerId: userId, status: ListingStatus.PENDING },
      }),
      this.prisma.listing.count({
        where: { sellerId: userId, status: ListingStatus.SOLD },
      }),
      this.prisma.conversation.count({
        where: { listing: { sellerId: userId } },
      }),
      this.prisma.message.count({
        where: {
          conversation: {
            listing: {
              sellerId: userId,
            },
          },
          offerAmount: { not: null },
        },
      }),
    ]);

    return {
      totalListings,
      activeListings,
      pendingListings,
      soldListings,
      conversations: conversationCount,
      offers: offerCount,
    };
  }

  private async deriveLegacySellerPriorityTier(userId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: {
        privilegeTier: true,
      },
    });

    if (!profile || profile.status !== SellerProfileStatus.APPROVED) {
      return SellerPriorityTier.NONE;
    }

    if (profile.verifiedSellerStatus === VerifiedSellerStatus.VERIFIED) {
      return profile.privilegeTier?.code === SellerPrivilegeTierCode.VIP
        ? SellerPriorityTier.VIP
        : SellerPriorityTier.VERIFIED;
    }

    if (profile.privilegeTier?.code === SellerPrivilegeTierCode.VIP) {
      return SellerPriorityTier.VIP;
    }

    return SellerPriorityTier.AUTHORIZED;
  }

  private async syncLegacySellerPriorityTier(userId: string) {
    const nextTier = await this.deriveLegacySellerPriorityTier(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        sellerPriorityTier: nextTier,
      },
    });
  }
}
