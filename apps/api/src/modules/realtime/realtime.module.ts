import { Module } from "@nestjs/common";

import { LogsModule } from "../logs/logs.module";
import { NodesModule } from "../nodes/nodes.module";
import { AgentControlGateway } from "./agent-control.gateway";
import { RealtimeService } from "./realtime.service";
import { UiRealtimeGateway } from "./ui-realtime.gateway";

@Module({
  imports: [NodesModule, LogsModule],
  providers: [RealtimeService, AgentControlGateway, UiRealtimeGateway],
  exports: [RealtimeService]
})
export class RealtimeModule {}
