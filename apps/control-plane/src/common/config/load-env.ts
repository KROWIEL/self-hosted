import { config as loadEnv } from 'dotenv';

// Side-effect import. `ConfigModule` only populates the environment once Nest
// instantiates the module graph, which is too late for anything read at import
// time (module metadata, `@Throttle` decorators). Importing this file first
// makes those values configurable. dotenv never overwrites variables that are
// already set, so importing it more than once is harmless.
loadEnv({ path: '../../.env' });
loadEnv({ path: '.env' });
