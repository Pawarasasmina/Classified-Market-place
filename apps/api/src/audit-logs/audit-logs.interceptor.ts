import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { catchError, tap, throwError } from 'rxjs';
import { AuditLogsService } from './audit-logs.service';

type AuditRequest = Request & {
  user?: {
    id?: string;
    role?: string;
  };
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
};

const auditedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const sensitiveKeyPatterns = [
  /password/i,
  /token/i,
  /secret/i,
  /^authorization$/i,
  /otp/i,
  /code/i,
  /encrypted/i,
  /authTag/i,
  /^iv$/i,
];
const contentKeys = new Set([
  'adminNotes',
  'attributes',
  'bio',
  'body',
  'description',
  'details',
  'message',
  'payload',
  'review',
]);

@Injectable()
export class AuditLogsInterceptor implements NestInterceptor {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const request = http.getRequest<AuditRequest>();
    const response = http.getResponse<Response>();

    if (!this.shouldAudit(request)) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap((responseBody) => {
        void this.record(request, {
          durationMs: Date.now() - startedAt,
          responseBody,
          statusCode: response.statusCode,
          success: true,
        });
      }),
      catchError((error: unknown) => {
        void this.record(request, {
          durationMs: Date.now() - startedAt,
          errorMessage: this.getErrorMessage(error),
          statusCode: this.getErrorStatus(error),
          success: false,
        });

        return throwError(() => error);
      }),
    );
  }

  private shouldAudit(request: AuditRequest) {
    if (!auditedMethods.has(request.method)) {
      return false;
    }

    const path = this.getPath(request);

    if (path.startsWith('/admin/audit-logs')) {
      return false;
    }

    return Boolean(request.user?.id) || path.startsWith('/auth/');
  }

  private record(
    request: AuditRequest,
    result: {
      durationMs: number;
      responseBody?: unknown;
      statusCode?: number;
      success: boolean;
      errorMessage?: string | null;
    },
  ) {
    const path = this.getPath(request);
    const responseSummary =
      result.responseBody === undefined
        ? undefined
        : summarizeResponse(result.responseBody);

    return this.auditLogsService.record({
      actorId: this.getActorId(request, result.responseBody),
      action: deriveAction(request.method, path),
      entityType: deriveEntityType(path),
      entityId: deriveEntityId(request, result.responseBody),
      method: request.method,
      path,
      statusCode: result.statusCode,
      success: result.success,
      ipAddress: getClientIp(request),
      userAgent: request.get('user-agent') ?? null,
      requestBody: sanitizeForAudit(request.body),
      requestParams: sanitizeForAudit(request.params),
      requestQuery: sanitizeForAudit(request.query),
      responseSummary,
      errorMessage: result.errorMessage,
      durationMs: result.durationMs,
    });
  }

  private getPath(request: AuditRequest) {
    return (request.originalUrl ?? request.url ?? '').split('?')[0] || '/';
  }

  private getActorId(request: AuditRequest, responseBody?: unknown) {
    if (request.user?.id) {
      return request.user.id;
    }

    if (isRecord(responseBody)) {
      const user = responseBody.user;
      if (isRecord(user) && typeof user.id === 'string') {
        return user.id;
      }
    }

    return null;
  }

  private getErrorStatus(error: unknown) {
    if (error instanceof HttpException) {
      return error.getStatus();
    }

    return 500;
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}

function getClientIp(request: Request) {
  const forwardedFor = request.get('x-forwarded-for');

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

function deriveAction(method: string, path: string) {
  const normalizedPath = path.toLowerCase();

  if (normalizedPath === '/auth/login') return 'AUTH_LOGIN';
  if (normalizedPath === '/auth/register') return 'AUTH_REGISTER';
  if (normalizedPath === '/auth/google') return 'AUTH_GOOGLE_LOGIN';
  if (normalizedPath === '/auth/refresh') return 'AUTH_REFRESH';
  if (normalizedPath === '/auth/logout') return 'AUTH_LOGOUT';
  if (normalizedPath === '/auth/request-phone-otp') return 'PHONE_OTP_REQUEST';
  if (normalizedPath === '/auth/verify-phone') return 'PHONE_VERIFY';

  const verb =
    method === 'POST'
      ? 'CREATE'
      : method === 'DELETE'
        ? 'DELETE'
        : method === 'PUT'
          ? 'REPLACE'
          : 'UPDATE';
  const entity = deriveEntityType(path)?.toUpperCase() ?? 'RESOURCE';
  const suffixes = path
    .split('/')
    .filter(Boolean)
    .filter((segment) =>
      ['moderate', 'priority-override', 'payment', 'succeed', 'read'].includes(
        segment,
      ),
    )
    .map((segment) => segment.replace(/-/g, '_').toUpperCase());

  return [verb, entity, ...suffixes].join('_');
}

function deriveEntityType(path: string) {
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const entitySegment =
    segments[0] === 'admin'
      ? segments[1]
      : segments[1] === 'admin'
        ? segments[0]
        : segments[0];

  if (!entitySegment) {
    return null;
  }

  return singularize(entitySegment.replace(/-/g, '_'));
}

function deriveEntityId(request: AuditRequest, responseBody?: unknown) {
  const params = request.params ?? {};
  const idFromParams =
    params.id ??
    params.userId ??
    params.listingId ??
    params.reportId ??
    params.ratingId ??
    params.transactionId;

  if (idFromParams) {
    return idFromParams;
  }

  const pathId = request.originalUrl
    ?.split('?')[0]
    ?.split('/')
    .find((segment) => isIdentifierLike(segment));

  if (pathId) {
    return pathId;
  }

  if (isRecord(responseBody) && typeof responseBody.id === 'string') {
    return responseBody.id;
  }

  return null;
}

function singularize(value: string) {
  if (value.endsWith('ies')) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith('s')) {
    return value.slice(0, -1);
  }

  return value;
}

function isIdentifierLike(value: string | undefined) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value) || value.length >= 20;
}

function sanitizeForAudit(value: unknown, key?: string, depth = 0): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (key && sensitiveKeyPatterns.some((pattern) => pattern.test(key))) {
    return '[REDACTED]';
  }

  if (key && contentKeys.has(key)) {
    return summarizeContent(value);
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 256 ? `[String ${value.length} chars]` : value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= 6) {
    return '[Max depth reached]';
  }

  if (Array.isArray(value)) {
    return {
      count: value.length,
      items: value
        .slice(0, 20)
        .map((item) => sanitizeForAudit(item, undefined, depth + 1)),
    };
  }

  if (!isRecord(value)) {
    return String(value);
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeForAudit(entryValue, entryKey, depth + 1),
    ]),
  );
}

function summarizeContent(value: unknown) {
  if (typeof value === 'string') {
    return `[REDACTED_CONTENT ${value.length} chars]`;
  }

  if (Array.isArray(value)) {
    return `[REDACTED_CONTENT array:${value.length}]`;
  }

  if (isRecord(value)) {
    return `[REDACTED_CONTENT keys:${Object.keys(value).length}]`;
  }

  return '[REDACTED_CONTENT]';
}

function summarizeResponse(value: unknown) {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      count: value.length,
      ids: value
        .slice(0, 10)
        .flatMap((item) => (isRecord(item) && typeof item.id === 'string' ? [item.id] : [])),
    };
  }

  if (!isRecord(value)) {
    return { type: typeof value };
  }

  const summaryKeys = [
    'id',
    'status',
    'type',
    'title',
    'name',
    'slug',
    'userId',
    'listingId',
    'transactionId',
    'reportId',
  ];
  const summary = Object.fromEntries(
    summaryKeys
      .filter((key) => key in value)
      .map((key) => [key, sanitizeForAudit(value[key], key)]),
  );

  if (isRecord(value.user) && typeof value.user.id === 'string') {
    summary.userId = value.user.id;
  }

  return {
    ...summary,
    keys: Object.keys(value).filter(
      (key) => !sensitiveKeyPatterns.some((pattern) => pattern.test(key)),
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
