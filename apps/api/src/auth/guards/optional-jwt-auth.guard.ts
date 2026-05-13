import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ headers?: { authorization?: string } }>();
    const authorization = request.headers?.authorization;

    if (!authorization) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser) {
    if (err) {
      throw err instanceof Error ? err : new Error('Authentication failed');
    }

    return user;
  }
}
