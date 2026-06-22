import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import { AuthenticatedRequest } from "../../common/request-user";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.session?.userId) {
      throw new UnauthorizedException("Authentication required");
    }

    return true;
  }
}
