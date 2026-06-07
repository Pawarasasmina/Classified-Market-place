import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { normalizeRole } from '../admin-permissions';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const normalizedRole = normalizeRole(user?.role);
    const normalizedRequiredRoles = requiredRoles.map(normalizeRole);

    if (!user || !normalizedRequiredRoles.includes(normalizedRole)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
