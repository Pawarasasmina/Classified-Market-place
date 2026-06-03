import { HttpException, HttpStatus } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditLogsInterceptor } from './audit-logs.interceptor';
import { AuditLogsService } from './audit-logs.service';

function createContext({
  body = {},
  method = 'PATCH',
  originalUrl = '/users/admin/target-user-id?token=secret',
  params = { id: 'target-user-id' },
  query = { token: 'secret', page: '1' },
  statusCode = 200,
  user = { id: 'actor-user-id', role: 'ADMIN' },
} = {}) {
  const request = {
    body,
    get: jest.fn((header: string) =>
      header.toLowerCase() === 'user-agent' ? 'Jest agent' : undefined,
    ),
    ip: '127.0.0.1',
    method,
    originalUrl,
    params,
    query,
    url: originalUrl,
    user,
  };
  const response = { statusCode };

  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    },
    request,
  };
}

describe('AuditLogsInterceptor', () => {
  let auditLogsService: Pick<AuditLogsService, 'record'>;
  let interceptor: AuditLogsInterceptor;

  beforeEach(() => {
    auditLogsService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    interceptor = new AuditLogsInterceptor(auditLogsService as AuditLogsService);
  });

  it('records successful mutating requests with redacted sensitive fields', async () => {
    const { context } = createContext({
      body: {
        password: 'secret',
        body: 'private message',
        status: 'ACTIVE',
      },
    });

    await lastValueFrom(
      interceptor.intercept(context as never, {
        handle: () =>
          of({
            id: 'target-user-id',
            status: 'ACTIVE',
            accessToken: 'do-not-store',
          }),
      }),
    );

    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_USER',
        actorId: 'actor-user-id',
        entityId: 'target-user-id',
        entityType: 'user',
        method: 'PATCH',
        path: '/users/admin/target-user-id',
        requestBody: {
          body: '[REDACTED_CONTENT 15 chars]',
          password: '[REDACTED]',
          status: 'ACTIVE',
        },
        requestQuery: {
          page: '1',
          token: '[REDACTED]',
        },
        responseSummary: expect.objectContaining({
          id: 'target-user-id',
          status: 'ACTIVE',
        }),
        success: true,
      }),
    );
    expect(
      (auditLogsService.record as jest.Mock).mock.calls[0][0].responseSummary
        .keys,
    ).not.toContain('accessToken');
  });

  it('records failed mutating requests and rethrows the original error', async () => {
    const { context } = createContext({ statusCode: 403 });
    const error = new HttpException('Nope', HttpStatus.FORBIDDEN);

    await expect(
      lastValueFrom(
        interceptor.intercept(context as never, {
          handle: () => throwError(() => error),
        }),
      ),
    ).rejects.toBe(error);

    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: 'Nope',
        statusCode: 403,
        success: false,
      }),
    );
  });

  it('skips non-mutating requests', async () => {
    const { context } = createContext({ method: 'GET' });

    await lastValueFrom(
      interceptor.intercept(context as never, {
        handle: () => of({ ok: true }),
      }),
    );

    expect(auditLogsService.record).not.toHaveBeenCalled();
  });
});
