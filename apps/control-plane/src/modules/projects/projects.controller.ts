import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';

class CreateProjectDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cpuLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(16)
  memLimit?: number;
}

class UpdateProjectLimitsDto {
  @IsInt()
  @Min(1)
  cpuLimit: number;

  @IsInt()
  @Min(16)
  memLimit: number;
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
    return this.projects.create(req.user.id, dto.name, {
      cpuLimit: dto.cpuLimit,
      memLimit: dto.memLimit,
    });
  }

  @Get('resource-summary/platform')
  platformResourceSummary(@Request() req: { user: { id: string } }) {
    return this.projects.platformResourceSummary(req.user.id);
  }

  @Get(':id')
  get(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.projects.get(id, req.user.id);
  }

  @Patch(':id/limits')
  updateLimits(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateProjectLimitsDto,
  ) {
    return this.projects.updateLimits(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.projects.remove(id, req.user.id);
  }
}
