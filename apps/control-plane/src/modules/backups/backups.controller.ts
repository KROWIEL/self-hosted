import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupsService } from './backups.service';
import { BackupScheduler } from './backup.scheduler';

type BackupKind = 'VOLUME' | 'DATABASE';

@UseGuards(JwtAuthGuard)
@Controller()
export class BackupsController {
  constructor(
    private readonly backups: BackupsService,
    private readonly scheduler: BackupScheduler,
  ) {}

  @Get('backups')
  list(@Query('kind') kind: BackupKind, @Query('refId') refId: string) {
    return this.backups.list(kind, refId);
  }

  @Post('backups')
  create(@Body() body: { kind: BackupKind; refId: string }) {
    return this.backups.create(body.kind, body.refId);
  }

  @Post('backups/:id/restore')
  restore(@Param('id') id: string) {
    return this.backups.restore(id);
  }

  @Delete('backups/:id')
  remove(@Param('id') id: string) {
    return this.backups.remove(id);
  }

  @Get('backups/:id/download')
  async download(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const abort = new AbortController();
    req.on('close', () => abort.abort());

    let stream: Awaited<ReturnType<BackupsService['openDownload']>>;
    try {
      stream = await this.backups.openDownload(id, abort.signal);
    } catch (e) {
      res.status(502).send(e instanceof Error ? e.message : 'agent unreachable');
      return;
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${stream.fileName}"`,
    );
    const node = Readable.fromWeb(stream.res.body as never);
    node.on('error', () => res.end());
    node.pipe(res);
  }

  @Get('backup-schedules')
  listSchedules(
    @Query('kind') kind: BackupKind,
    @Query('refId') refId: string,
  ) {
    return this.scheduler.listSchedules(kind, refId);
  }

  @Post('backup-schedules')
  createSchedule(
    @Body()
    body: { kind: BackupKind; refId: string; cron: string; keepLast?: number },
  ) {
    return this.scheduler.createSchedule(body);
  }

  @Delete('backup-schedules/:id')
  removeSchedule(@Param('id') id: string) {
    return this.scheduler.removeSchedule(id);
  }
}
