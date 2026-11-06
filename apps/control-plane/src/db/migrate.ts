import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

loadEnv({ path: '../../.env' });
loadEnv();

/**
 * Applies pending SQL migrations from `drizzle/` without drizzle-kit, so a
 * production image can upgrade its database on start. Uses the same journal
 * table as `drizzle-kit migrate`, so either can be used on the same database.
 */
async function main() {
  const url =
    process.env.DATABASE_URL ??
    'postgresql://selfhosted:selfhosted@localhost:5432/selfhosted';
  const client = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: resolve(__dirname, '../../drizzle'),
    });
    console.log('Database migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
