import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

const auditLogInclude = {
  actor: {
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.AuditLogInclude;

export type AuditLogRecordInput = {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  method: string;
  path: string;
  statusCode?: number | null;
  success: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestBody?: unknown;
  requestParams?: unknown;
  requestQuery?: unknown;
  responseSummary?: unknown;
  errorMessage?: string | null;
  durationMs?: number | null;
};

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  listForAdmin(query: QueryAuditLogsDto) {
    return this.prisma.auditLog.findMany({
      where: this.buildWhere(query),
      orderBy: { createdAt: 'desc' },
      take: query.take ?? 100,
      include: auditLogInclude,
    });
  }

  async record(input: AuditLogRecordInput) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? undefined,
          action: input.action,
          entityType: input.entityType ?? undefined,
          entityId: input.entityId ?? undefined,
          method: input.method,
          path: input.path,
          statusCode: input.statusCode ?? undefined,
          success: input.success,
          ipAddress: input.ipAddress ?? undefined,
          userAgent: input.userAgent ?? undefined,
          requestBody: this.asJson(input.requestBody),
          requestParams: this.asJson(input.requestParams),
          requestQuery: this.asJson(input.requestQuery),
          responseSummary: this.asJson(input.responseSummary),
          errorMessage: input.errorMessage ?? undefined,
          durationMs: input.durationMs ?? undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to write audit log: ${message}`);
    }
  }

  private buildWhere(query: QueryAuditLogsDto): Prisma.AuditLogWhereInput {
    return {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.success !== undefined ? { success: query.success } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
  }

  private asJson(value: unknown) {
    if (value === undefined || value === null) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
  }
}
