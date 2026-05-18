import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class VerifiedPhoneGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      user?: { phoneVerified?: boolean };
    }>();

    if (request.user?.phoneVerified) {
      return true;
    }

    throw new ForbiddenException('Verify your phone number to continue');
  }
}
