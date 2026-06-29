import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NodesService } from './nodes.service';
import { AgentRunnerService } from './agent-runner.service';

class CreateNodeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  fqdn: string;

  @IsOptional()
  @IsInt()
  agentPort?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('nodes')
export class NodesController {
  constructor(
    private readonly nodes: NodesService,
    private readonly runner: AgentRunnerService,
  ) {}

  @Get()
  list() {
    return this.nodes.list();
  }

  @Post()
  create(@Body() dto: CreateNodeDto) {
    return this.nodes.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.nodes.get(id);
  }

  /** Configuration the agent fetches on boot. */
  @Get(':id/configuration')
  configuration(@Param('id') id: string) {
    return this.nodes.configuration(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.runner.stop(id);
    return this.nodes.remove(id);
  }

  /** Dev: launch the local Go agent for this node (LOCAL_AGENT_ENABLED=1). */
  @Post(':id/agent/start')
  async startAgent(@Param('id') id: string) {
    const node = await this.nodes.get(id);
    return this.runner.start(node);
  }

  @Post(':id/agent/stop')
  stopAgent(@Param('id') id: string) {
    return this.runner.stop(id);
  }

  @Get(':id/agent/status')
  agentStatus(@Param('id') id: string) {
    return this.runner.status(id);
  }

  /** Live Docker-level metrics from the node's agent. */
  @Get(':id/system')
  system(@Param('id') id: string) {
    return this.nodes.systemInfo(id);
  }
}
