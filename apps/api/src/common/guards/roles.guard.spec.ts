import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { rolesForPermission } from '../admin-permissions';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const createContext = (role?: string) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => ({
          user: role ? { role } : undefined,
        })),
      })),
    }) as unknown as ExecutionContext;

  it('allows requests when no roles are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext('USER'))).toBe(true);
  });

  it('allows admin users for admin-only routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN', 'admin']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext('ADMIN'))).toBe(true);
    expect(guard.canActivate(createContext('admin'))).toBe(true);
  });

  it('allows staff roles included by a permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(rolesForPermission('REPORTS_READ')),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext('MODERATOR'))).toBe(true);
    expect(guard.canActivate(createContext('support'))).toBe(true);
    expect(guard.canActivate(createContext('FINANCE_MANAGER'))).toBe(true);
  });

  it('rejects staff roles that do not have the required permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(rolesForPermission('WALLETS_WRITE')),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext('MODERATOR'))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects non-admin users for admin-only routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN', 'admin']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext('USER'))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects unauthenticated requests for admin-only routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN', 'admin']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });
});
