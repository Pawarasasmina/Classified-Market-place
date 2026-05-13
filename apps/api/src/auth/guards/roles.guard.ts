import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role = request.user?.role;

    if (typeof role !== 'string') {
      throw new ForbiddenException('You do not have access to this resource');
    }

    const normalizedRole = role.trim().toLowerCase();
    const allowed = requiredRoles.some(
      (requiredRole) => normalizedRole === requiredRole.trim().toLowerCase(),
    );

    if (!allowed) {
      throw new ForbiddenException('You do not have access to this resource');
    }

    return true;
  }
}
