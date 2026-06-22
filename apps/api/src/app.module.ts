import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { AppsModule } from "./modules/apps/apps.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DatabaseModule } from "./modules/database/database.module";
import { DeployModule } from "./modules/deploy/deploy.module";
import { HealthModule } from "./modules/health/health.module";
import { LogsModule } from "./modules/logs/logs.module";
import { NodesModule } from "./modules/nodes/nodes.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { RoutesModule } from "./modules/routes/routes.module";
import { SecurityModule } from "./modules/security/security.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"]
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    SecurityModule,
    HealthModule,
    RbacModule,
    AuthModule,
    NodesModule,
    AppsModule,
    DeployModule,
    RoutesModule,
    LogsModule,
    AuditModule,
    RealtimeModule
  ]
})
export class AppModule {}
