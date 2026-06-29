import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE, Database } from '../../db/database.module';
import { users } from '../../db/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByEmail(email: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(email: string, password: string, role: 'ADMIN' | 'USER' = 'USER') {
    const hash = await bcrypt.hash(password, 12);
    const rows = await this.db
      .insert(users)
      .values({ email, password: hash, role })
      .returning();
    return rows[0];
  }

  verifyPassword(plain: string, hash: string) {
    return bcrypt.compare(plain, hash);
  }
}
