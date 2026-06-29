import { Module } from '@nestjs/common';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { AgentClient } from './agent.client';
import { AgentRunnerService } from './agent-runner.service';

@Module({
  controllers: [NodesController],
  providers: [NodesService, AgentClient, AgentRunnerService],
  exports: [NodesService, AgentClient],
})
export class NodesModule {}
