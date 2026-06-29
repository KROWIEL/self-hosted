import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE, Database } from '../../db/database.module';
import { templates } from '../../db/schema';

@Injectable()
export class TemplatesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  list() {
    return this.db.select().from(templates).orderBy(asc(templates.name));
  }

  async get(id: string) {
    const rows = await this.db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Template not found');
    return rows[0];
  }
}
