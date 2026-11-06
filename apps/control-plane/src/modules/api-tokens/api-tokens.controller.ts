import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTokenService } from './api-token.service';
import { CreateApiTokenDto } from './dto/api-tokens.dto';

/**
 * Personal API tokens. Each user manages their own tokens; the
 * whole controller is gated behind the module.
 */
@UseGuards(JwtAuthGuard)
@Controller('api-tokens')
export class ApiTokensController {
  constructor(private readonly tokens: ApiTokenService) {}

  @Get()
  list(@Request() req: { user: { id: string } }) {
    return this.tokens.list(req.user.id);
  }

  @Post()
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateApiTokenDto,
  ) {
    return this.tokens.create(
      req.user.id,
      dto.name,
      dto.expiresInDays,
      dto.scopes,
    );
  }

  @Delete(':id')
  revoke(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.tokens.revoke(req.user.id, id);
  }
}
