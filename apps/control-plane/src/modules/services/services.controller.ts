import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { PowerAction } from '@selfhosted/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ServicesService } from './services.service';
import { BuildLogService } from './build-log.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { SetDomainDto, SetEnvDto } from './dto/set-env.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly buildLog: BuildLogService,
  ) {}

  @Post('projects/:projectId/services')
  create(@Param('projectId') projectId: string, @Body() dto: CreateServiceDto) {
    return this.services.create(projectId, dto);
  }

  @Get('services/:id')
  get(@Param('id') id: string) {
    return this.services.get(id);
  }

  @Delete('services/:id')
  remove(@Param('id') id: string) {
    return this.services.remove(id);
  }

  @Get('services/:id/env')
  listEnv(@Param('id') id: string) {
    return this.services.listEnv(id);
  }

  @Put('services/:id/env')
  setEnv(@Param('id') id: string, @Body() dto: SetEnvDto) {
    return this.services.setEnv(id, dto);
  }

  @Put('services/:id/domain')
  setDomain(@Param('id') id: string, @Body() dto: SetDomainDto) {
    return this.services.setDomain(id, dto);
  }

  @Post('services/:id/deploy')
  deploy(@Param('id') id: string) {
    return this.services.deploy(id);
  }

  @Post('deployments/:id/rollback')
  rollback(@Param('id') id: string) {
    return this.services.rollback(id);
  }

  @Get('services/:id/webhook')
  webhook(@Param('id') id: string) {
    return this.services.getWebhook(id);
  }

  @Get('services/:id/deployments')
  deployments(@Param('id') id: string) {
    return this.services.listDeployments(id);
  }

  @Get('services/:id/stats')
  stats(@Param('id') id: string) {
    return this.services.stats(id);
  }

  /**
   * Live runtime log stream. Pipes the node agent's `docker logs -f` output to
   * the browser as chunked text. The browser reads it via fetch + ReadableStream.
   */
  @Get('services/:id/logs/stream')
  async logsStream(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const abort = new AbortController();
    req.on('close', () => abort.abort());

    let upstream: globalThis.Response;
    try {
      upstream = await this.services.openLogStream(id, abort.signal);
    } catch (e) {
      res.status(502).send(e instanceof Error ? e.message : 'agent unreachable');
      return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    const node = Readable.fromWeb(upstream.body as never);
    node.on('error', () => res.end());
    node.pipe(res);
  }

  /**
   * Live build-log stream for a deployment. Replays buffered output then streams
   * new chunks via Redis pub/sub. For finished deployments it returns the stored
   * build log immediately.
   */
  @Get('deployments/:id/logs/stream')
  async buildLogStream(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const dep = await this.services.getDeployment(id);
    if (!dep) {
      res.status(404).send('deployment not found');
      return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    const finished = dep.status === 'SUCCESS' || dep.status === 'FAILED';
    if (finished) {
      if (dep.errorMsg) res.write(`ERROR: ${dep.errorMsg}\n\n`);
      res.write(dep.buildLog ?? '');
      res.end();
      return;
    }

    const history = await this.buildLog.history(id);
    if (history) res.write(history);

    const cleanup = this.buildLog.subscribe(
      id,
      (chunk) => res.write(chunk),
      () => res.end(),
    );
    req.on('close', cleanup);
  }

  @Post('services/:id/start')
  start(@Param('id') id: string) {
    return this.services.power(id, PowerAction.START);
  }

  @Post('services/:id/stop')
  stop(@Param('id') id: string) {
    return this.services.power(id, PowerAction.STOP);
  }

  @Post('services/:id/restart')
  restart(@Param('id') id: string) {
    return this.services.power(id, PowerAction.RESTART);
  }
}
