import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailService } from './email.service';
import { SendMessageDto, SendTestDto, SetEmailConfigDto } from './dto/email.dto';

/**
 * Outbound email management. Platform-level, so admin-only; the
 * whole controller is gated behind the module.
 */
@UseGuards(JwtAuthGuard)
@Controller('email')
export class EmailController {
  constructor(private readonly email: EmailService) {}

  private assertAdmin(req: { user?: { role?: string } }) {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
  }

  @Get('config')
  getConfig(@Request() req: { user?: { role?: string } }) {
    this.assertAdmin(req);
    return this.email.getConfig();
  }

  @Put('config')
  setConfig(
    @Request() req: { user?: { role?: string } },
    @Body() dto: SetEmailConfigDto,
  ) {
    this.assertAdmin(req);
    return this.email.setConfig(dto);
  }

  @Post('test')
  test(
    @Request() req: { user?: { role?: string } },
    @Body() dto: SendTestDto,
  ) {
    this.assertAdmin(req);
    return this.email.sendTest(dto.to);
  }

  @Post('send')
  send(
    @Request() req: { user?: { role?: string } },
    @Body() dto: SendMessageDto,
  ) {
    this.assertAdmin(req);
    return this.email.sendMessage(dto);
  }

  @Get('messages')
  listMessages(@Request() req: { user?: { role?: string } }) {
    this.assertAdmin(req);
    return this.email.listMessages();
  }
}
