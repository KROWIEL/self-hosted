import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  type CatalogApp,
  type CatalogEnvDefault,
  type CatalogTranslation,
  type CatalogVolumeHint,
} from '@selfhosted/shared';
import { DRIZZLE, Database } from '../../db/database.module';
import { catalogApps } from '../../db/schema';
import { ServicesService } from '../services/services.service';
import { InstallCatalogAppDto } from './dto/install-catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly services: ServicesService,
  ) {}

  async list(): Promise<CatalogApp[]> {
    const rows = await this.db.select().from(catalogApps).orderBy(catalogApps.name);
    return rows.map((row) => this.toApp(row));
  }

  async get(slug: string): Promise<CatalogApp> {
    return this.toApp(await this.bySlug(slug));
  }

  async install(slug: string, dto: InstallCatalogAppDto) {
    const row = await this.bySlug(slug);
    const app = this.toApp(row);

    const env: Record<string, string> = { ...(dto.env ?? {}) };
    for (const def of app.envDefaults) {
      if (env[def.key] === undefined && def.value !== undefined) {
        env[def.key] = def.value;
      }
      if (def.required && !env[def.key]) {
        throw new BadRequestException(
          `Environment variable ${def.key} is required for ${app.name}`,
        );
      }
    }

    const service = await this.services.create(dto.projectId, {
      name: dto.name?.trim() || app.name,
      type: 'BACKEND',
      nodeId: dto.nodeId,
      deployKind: app.deployKind,
      repoUrl: app.composeGitUrl ?? undefined,
      image: app.image ?? undefined,
      composeFile: app.composeFile ?? 'docker-compose.yml',
      composeYaml: app.composeYaml ?? undefined,
      port: app.defaultPort ?? undefined,
      env,
    });

    for (const vol of app.recommendedVolumes) {
      if (vol.mountPath) {
        await this.services.addVolume(service.id, vol.mountPath);
      }
    }

    let deployment = null;
    if (dto.deploy !== false) {
      deployment = await this.services.deploy(service.id);
    }

    return { service, deployment };
  }

  private async bySlug(slug: string) {
    const [row] = await this.db
      .select()
      .from(catalogApps)
      .where(eq(catalogApps.slug, slug))
      .limit(1);
    if (!row) throw new NotFoundException(`Catalog app "${slug}" not found`);
    return row;
  }

  private toApp(row: typeof catalogApps.$inferSelect): CatalogApp {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      category: row.category,
      icon: row.icon,
      translations: (row.translations ?? {}) as Record<string, CatalogTranslation>,
      deployKind: row.deployKind,
      image: row.image,
      composeYaml: row.composeYaml,
      composeGitUrl: row.composeGitUrl,
      composeFile: row.composeFile,
      defaultPort: row.defaultPort,
      recommendedVolumes: (row.recommendedVolumes ?? []) as CatalogVolumeHint[],
      envDefaults: (row.envDefaults ?? []) as CatalogEnvDefault[],
    };
  }
}
