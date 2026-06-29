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
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';

class CreateProjectDto {
  @IsString()
  @MinLength(1)
  name: string;
}

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Request() req: { user: { id: string } }) {
    return this.projects.list(req.user.id);
  }

  @Post()
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(req.user.id, dto.name);
  }

  @Get(':id')
  get(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.projects.get(id, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.projects.remove(id, req.user.id);
  }
}
