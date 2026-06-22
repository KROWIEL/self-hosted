import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import axios from "axios";
import { randomUUID } from "node:crypto";

import { AuthenticatedRequest } from "../../common/request-user";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { RbacService } from "../rbac/rbac.service";

interface GithubProfile {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService
  ) {}

  startGithubAuth(request: AuthenticatedRequest): string {
    const state = randomUUID();
    request.session.oauthState = state;

    const callback = process.env.GITHUB_CALLBACK_URL ?? "http://localhost:4000/auth/github/callback";
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      throw new UnauthorizedException("GITHUB_CLIENT_ID is not configured");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callback,
      scope: "read:user user:email",
      state
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleGithubCallback(request: AuthenticatedRequest, code: string, state: string) {
    const expectedState = request.session.oauthState;
    if (!expectedState || expectedState !== state) {
      throw new UnauthorizedException("Invalid OAuth state");
    }

    const accessToken = await this.exchangeCodeForAccessToken(code);
    const profile = await this.fetchGithubProfile(accessToken);
    const email = await this.fetchPrimaryEmail(accessToken);

    const allowed = await this.rbacService.isUserAllowedForLogin(profile.login, email);
    if (!allowed) {
      throw new ForbiddenException("User is not in allowlist");
    }

    const user = await this.prisma.user.upsert({
      where: {
        githubId: String(profile.id)
      },
      update: {
        githubLogin: profile.login,
        email: email ?? undefined,
        displayName: profile.name ?? profile.login,
        avatarUrl: profile.avatar_url,
        isActive: true
      },
      create: {
        githubId: String(profile.id),
        githubLogin: profile.login,
        email: email ?? undefined,
        displayName: profile.name ?? profile.login,
        avatarUrl: profile.avatar_url,
        isActive: true
      }
    });

    const invitedRole = await this.rbacService.getInvitedRole(profile.login, email);
    if (invitedRole) {
      await this.rbacService.assignRoles(user.id, [invitedRole]);
    } else {
      await this.rbacService.ensureUserHasDefaultRole(user.id);
    }
    const roleNames = await this.rbacService.getUserRoleNames(user.id);

    request.session.userId = user.id;
    request.session.roles = roleNames;
    request.session.oauthState = undefined;

    await this.auditService.log({
      actorUserId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      metaJson: {
        githubLogin: user.githubLogin,
        email: user.email
      }
    });

    return {
      user,
      roles: roleNames
    };
  }

  async getCurrentUser(request: AuthenticatedRequest) {
    const userId = request.session.userId;
    if (!userId) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true }
        }
      }
    });

    if (!user || !user.isActive) {
      request.session.userId = undefined;
      request.session.roles = [];
      return null;
    }

    const permissions = Array.from(await this.rbacService.getUserPermissionKeys(user.id));
    return {
      ...user,
      permissionKeys: permissions,
      roleNames: user.roles.map((entry) => entry.role.name)
    };
  }

  async logout(request: AuthenticatedRequest) {
    const userId = request.session.userId;
    await new Promise<void>((resolve, reject) => {
      request.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    if (userId) {
      await this.auditService.log({
        actorUserId: userId,
        action: "auth.logout",
        entityType: "user",
        entityId: userId
      });
    }

    return { success: true };
  }

  private async exchangeCodeForAccessToken(code: string) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const callback = process.env.GITHUB_CALLBACK_URL ?? "http://localhost:4000/auth/github/callback";

    if (!clientId || !clientSecret) {
      throw new UnauthorizedException("GitHub OAuth env vars are missing");
    }

    const response = await axios.post<{ access_token: string }>(
      "https://github.com/login/oauth/access_token",
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callback
      },
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.data.access_token) {
      throw new UnauthorizedException("Failed to exchange GitHub code");
    }

    return response.data.access_token;
  }

  private async fetchGithubProfile(accessToken: string) {
    const response = await axios.get<GithubProfile>("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json"
      }
    });
    return response.data;
  }

  private async fetchPrimaryEmail(accessToken: string): Promise<string | null> {
    const response = await axios.get<Array<{ email: string; primary: boolean; verified: boolean }>>(
      "https://api.github.com/user/emails",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json"
        }
      }
    );

    const primaryVerified = response.data.find((entry) => entry.primary && entry.verified);
    return primaryVerified?.email ?? response.data[0]?.email ?? null;
  }
}
