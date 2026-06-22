import { Injectable, OnModuleInit } from "@nestjs/common";
import { Prisma, RoleName } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  "users.read": "Read users and invitations",
  "users.invite": "Create allowlist invitations",
  "users.roles.write": "Assign user roles",
  "users.active.write": "Enable or disable users",
  "roles.read": "Read role and permission model",
  "nodes.read": "Read node status and details",
  "nodes.enroll": "Create node enrollment tokens",
  "apps.read": "Read applications",
  "apps.write": "Create and update applications",
  "apps.control": "Start stop restart applications",
  "apps.deploy": "Deploy and rollback applications",
  "routes.read": "Read domain routes",
  "routes.write": "Create update delete routes",
  "routes.sync": "Sync routes to Caddy and rathole",
  "logs.read": "Read live and historical logs",
  "audit.read": "Read audit events"
};

const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  [RoleName.admin]: Object.keys(PERMISSION_DESCRIPTIONS),
  [RoleName.operator]: [
    "users.read",
    "roles.read",
    "nodes.read",
    "nodes.enroll",
    "apps.read",
    "apps.write",
    "apps.control",
    "apps.deploy",
    "routes.read",
    "routes.write",
    "routes.sync",
    "logs.read",
    "audit.read"
  ],
  [RoleName.viewer]: ["users.read", "roles.read", "nodes.read", "apps.read", "routes.read", "logs.read", "audit.read"]
};

@Injectable()
export class RbacService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedPermissionsAndRoles();
  }

  async seedPermissionsAndRoles() {
    for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
      await this.prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description }
      });
    }

    for (const roleName of Object.values(RoleName)) {
      const role = await this.prisma.role.upsert({
        where: { name: roleName },
        update: {
          description: `${roleName} role`
        },
        create: {
          name: roleName,
          description: `${roleName} role`
        }
      });

      const permissions = ROLE_PERMISSIONS[roleName];
      const permissionRows = await this.prisma.permission.findMany({
        where: {
          key: { in: permissions }
        }
      });

      await this.prisma.rolePermission.deleteMany({
        where: { roleId: role.id }
      });

      await this.prisma.rolePermission.createMany({
        data: permissionRows.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id
        }))
      });
    }
  }

  async getUserPermissionKeys(userId: string): Promise<Set<string>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return new Set();
    }

    const keys = user.roles.flatMap((userRole) =>
      userRole.role.permissions.map((rolePermission) => rolePermission.permission.key)
    );

    return new Set(keys);
  }

  async getUserRoleNames(userId: string): Promise<RoleName[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });
    return userRoles.map((userRole) => userRole.role.name);
  }

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        roles: {
          include: { role: true }
        }
      }
    });
  }

  async inviteUser(input: { githubLogin?: string; email?: string; roleName: RoleName; createdById?: string }) {
    let uniqueWhere: Prisma.UserInviteWhereUniqueInput;
    if (input.githubLogin) {
      uniqueWhere = { githubLogin: input.githubLogin };
    } else if (input.email) {
      uniqueWhere = { email: input.email };
    } else {
      throw new Error("githubLogin or email is required");
    }

    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.userInvite.upsert({
        where: uniqueWhere,
        update: {
          roleName: input.roleName,
          isActive: true,
          createdById: input.createdById
        },
        create: {
          githubLogin: input.githubLogin,
          email: input.email,
          roleName: input.roleName,
          createdById: input.createdById
        }
      });

      if (input.email) {
        const existingUser = await tx.user.findUnique({ where: { email: input.email } });
        if (existingUser) {
          await this.replaceUserRoles(tx, existingUser.id, [input.roleName]);
        }
      }

      if (input.githubLogin) {
        const existingUser = await tx.user.findUnique({ where: { githubLogin: input.githubLogin } });
        if (existingUser) {
          await this.replaceUserRoles(tx, existingUser.id, [input.roleName]);
        }
      }

      return invite;
    });
  }

  async assignRoles(userId: string, roleNames: RoleName[]) {
    await this.prisma.$transaction(async (tx) => {
      await this.replaceUserRoles(tx, userId, roleNames);
    });

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true }
        }
      }
    });
  }

  async setUserActive(userId: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive }
    });
  }

  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true }
        }
      }
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { key: "asc" }
    });
  }

  async isUserAllowedForLogin(githubLogin?: string | null, email?: string | null): Promise<boolean> {
    const staticAllowlist = (process.env.GITHUB_ALLOWLIST ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    if (githubLogin && staticAllowlist.includes(githubLogin.toLowerCase())) {
      return true;
    }

    if (email && staticAllowlist.includes(email.toLowerCase())) {
      return true;
    }

    const invite = await this.prisma.userInvite.findFirst({
      where: {
        isActive: true,
        OR: [{ githubLogin: githubLogin ?? undefined }, { email: email ?? undefined }]
      }
    });

    return Boolean(invite);
  }

  async getInvitedRole(githubLogin?: string | null, email?: string | null): Promise<RoleName | null> {
    const invite = await this.prisma.userInvite.findFirst({
      where: {
        isActive: true,
        OR: [{ githubLogin: githubLogin ?? undefined }, { email: email ?? undefined }]
      }
    });
    return invite?.roleName ?? null;
  }

  async ensureUserHasDefaultRole(userId: string) {
    const roleCount = await this.prisma.userRole.count({ where: { userId } });
    if (roleCount > 0) {
      return;
    }

    const userCount = await this.prisma.user.count();
    const defaultRole = userCount <= 1 ? RoleName.admin : RoleName.viewer;
    await this.assignRoles(userId, [defaultRole]);
  }

  private async replaceUserRoles(tx: Prisma.TransactionClient, userId: string, roleNames: RoleName[]) {
    const roles = await tx.role.findMany({
      where: {
        name: { in: roleNames }
      }
    });

    await tx.userRole.deleteMany({ where: { userId } });
    if (roles.length === 0) {
      return;
    }

    await tx.userRole.createMany({
      data: roles.map((role) => ({
        userId,
        roleId: role.id
      }))
    });
  }
}
