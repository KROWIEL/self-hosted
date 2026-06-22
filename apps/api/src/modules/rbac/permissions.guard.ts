import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AuthenticatedRequest } from "../../common/request-user";
import { PERMISSIONS_KEY } from "./permissions.decorator";
import { RbacService } from "./rbac.service";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly rbacService: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (permissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.session?.userId;

    if (!userId) {
      throw new UnauthorizedException("Authentication required");
    }

    const userPermissions = await this.rbacService.getUserPermissionKeys(userId);
    const missingPermissions = permissions.filter((permission) => !userPermissions.has(permission));
    if (missingPermissions.length > 0) {
      throw new ForbiddenException(`Missing permissions: ${missingPermissions.join(", ")}`);
    }

    return true;
  }
}
