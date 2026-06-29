import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, Database } from '../../db/database.module';
import { projects, services } from '../../db/schema';

@Injectable()
export class ProjectsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(ownerId: string) {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, ownerId))
      .orderBy(desc(projects.createdAt));
    return this.attachServices(rows);
  }

  create(ownerId: string, name: string) {
    return this.db
      .insert(projects)
      .values({ name, ownerId })
      .returning()
      .then((r) => r[0]);
  }

  async get(id: string, ownerId: string) {
    const rows = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Project not found');
    const [withServices] = await this.attachServices(rows);
    return withServices;
  }

  async remove(id: string, ownerId: string) {
    await this.get(id, ownerId);
    await this.db.delete(projects).where(eq(projects.id, id));
    return { ok: true };
  }

  private async attachServices(
    rows: (typeof projects.$inferSelect)[],
  ) {
    if (rows.length === 0) return [];
    const ids = rows.map((p) => p.id);
    const svc = await this.db
      .select()
      .from(services)
      .where(inArray(services.projectId, ids));
    return rows.map((p) => ({
      ...p,
      services: svc.filter((s) => s.projectId === p.id),
    }));
  }
}
