import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OffsiteService } from './offsite.service';
import { SetOffsiteConfigDto } from './dto/offsite.dto';

/**
 * Offsite backup destination management. Platform-level,
 * so admin-only; the whole controller is gated behind the module.
 */
@UseGuards(JwtAuthGuard)
@Controller('offsite')
export class OffsiteController {
  constructor(private readonly offsite: OffsiteService) {}

  private assertAdmin(req: { user?: { role?: string } }) {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
  }

  @Get('config')
  getConfig(@Request() req: { user?: { role?: string } }) {
    this.assertAdmin(req);
    return this.offsite.getConfig();
  }

  @Put('config')
  setConfig(
    @Request() req: { user?: { role?: string } },
    @Body() dto: SetOffsiteConfigDto,
  ) {
    this.assertAdmin(req);
    return this.offsite.setConfig(dto);
  }

  @Post('test')
  test(@Request() req: { user?: { role?: string } }) {
    this.assertAdmin(req);
    return this.offsite.testConfig();
  }

  @Get('uploads')
  listUploads(@Request() req: { user?: { role?: string } }) {
    this.assertAdmin(req);
    return this.offsite.listUploads();
  }

  @Post('sync')
  sync(@Request() req: { user?: { role?: string } }) {
    this.assertAdmin(req);
    return this.offsite.uploadPending();
  }

  @Post('backups/:id')
  uploadOne(
    @Request() req: { user?: { role?: string } },
    @Param('id') id: string,
  ) {
    this.assertAdmin(req);
    return this.offsite.uploadBackup(id);
  }
}
