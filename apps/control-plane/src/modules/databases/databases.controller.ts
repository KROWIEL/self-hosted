import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DatabasesService } from './databases.service';
import { AgentEnvKey } from '../nodes/agent.client';
import { CreateDatabaseDto } from './dto/create-database.dto';

type Engine = 'POSTGRES' | 'MYSQL';

@UseGuards(JwtAuthGuard)
@Controller()
export class DatabasesController {
  constructor(private readonly databases: DatabasesService) {}

  @Post('projects/:projectId/databases')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateDatabaseDto,
  ) {
    return this.databases.create(projectId, dto);
  }

  @Get('projects/:projectId/databases')
  list(@Param('projectId') projectId: string) {
    return this.databases.listByProject(projectId);
  }

  @Get('services/:serviceId/inspect')
  inspect(@Param('serviceId') serviceId: string) {
    return this.databases.inspectService(serviceId);
  }

  @Post('services/:serviceId/setup')
  setup(
    @Param('serviceId') serviceId: string,
    @Body()
    body: {
      databases: { engine: Engine; schemas: string[] }[];
      envKeys: AgentEnvKey[];
    },
  ) {
    return this.databases.applySetup(serviceId, body);
  }

  @Get('databases/:id')
  get(@Param('id') id: string) {
    return this.databases.getView(id);
  }

  @Get('databases/:id/credentials')
  credentials(@Param('id') id: string) {
    return this.databases.credentials(id);
  }

  @Get('databases/:id/status')
  status(@Param('id') id: string) {
    return this.databases.status(id);
  }

  @Post('databases/:id/power')
  power(@Param('id') id: string, @Body() body: { action: string }) {
    return this.databases.power(id, body.action);
  }

  @Post('databases/:id/attach')
  attach(@Param('id') id: string, @Body() body: { serviceId: string }) {
    return this.databases.attach(id, body.serviceId);
  }

  @Delete('databases/:id')
  remove(@Param('id') id: string, @Query('keepVolume') keepVolume?: string) {
    return this.databases.remove(id, keepVolume === 'true' || keepVolume === '1');
  }
}
