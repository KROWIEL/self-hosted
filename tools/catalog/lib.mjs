import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from './yaml.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(here, '../..');
export const APPS_DIR = join(REPO_ROOT, 'catalog/apps');
export const ICONS_FILE = join(
  REPO_ROOT,
  'apps/web/src/components/catalog-icons.tsx',
);
export const I18N_DIR = join(REPO_ROOT, 'apps/web/src/i18n');
export const CACHE_DIR = join(here, '.cache');

export const UPSTREAM_REPO =
  'https://github.com/awesome-selfhosted/awesome-selfhosted-data.git';

export const DEPLOY_KINDS = ['image', 'compose', 'git'];

/** Months of upstream commit history that still counts as "maintained". */
export const ACTIVITY_WINDOW_MONTHS = 6;

// ---------------------------------------------------------------- manifests

export function loadManifests() {
  return readdirSync(APPS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      const path = join(APPS_DIR, file);
      const text = readFileSync(path, 'utf8');
      try {
        return { file, path, text, data: JSON.parse(text) };
      } catch (e) {
        throw new Error(`${file}: invalid JSON — ${e.message}`);
      }
    });
}

/**
 * Icon tokens the web UI can actually draw. Read straight out of the component
 * so a manifest can never reference a glyph that renders as the fallback box.
 */
export function knownIcons() {
  const src = readFileSync(ICONS_FILE, 'utf8');
  const block = /const GLYPHS: Record<string, ReactNode> = \{([\s\S]*?)\n\};/.exec(
    src,
  );
  if (!block) {
    throw new Error(`Could not find the GLYPHS map in ${ICONS_FILE}`);
  }
  return new Set([...block[1].matchAll(/^ {2}([\w-]+):/gm)].map((m) => m[1]));
}

/** Category keys present in a translation file, e.g. `catalog.category.Media`. */
export function translatedCategories(lang) {
  const src = readFileSync(join(I18N_DIR, `${lang}.ts`), 'utf8');
  return new Set(
    [...src.matchAll(/'catalog\.category\.([^']+)':/g)].map((m) => m[1]),
  );
}

/** Every `image:` reference in a compose document, in file order. */
/**
 * Resolve a reference the way Compose would before the pull: `${TAG:-v2}` is
 * really `v2`. A variable with no default stays as-is, which leaves the ref
 * visibly unresolved rather than silently wrong.
 */
export function expandComposeVars(ref) {
  return ref.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*):?-([^}]*)\}/g, (_m, _key, fallback) => fallback);
}

export function composeImages(yaml) {
  return [...yaml.matchAll(/^\s*image:\s*(\S+)\s*$/gm)].map((m) =>
    expandComposeVars(m[1].replace(/^['"]|['"]$/g, '')),
  );
}

/** All image references a manifest pulls, across deploy kinds. */
export function manifestImages(app) {
  if (app.deployKind === 'image') return app.image ? [app.image] : [];
  if (app.deployKind === 'compose' && app.composeYaml) {
    return composeImages(app.composeYaml);
  }
  return [];
}

// --------------------------------------------------------------- validation

// Docker passes these through verbatim, so the only real rule is the shell's.
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function validateManifest({ file, data }, ctx) {
  const errors = [];
  const bad = (msg) => errors.push(msg);

  const expectedSlug = file.replace(/\.json$/, '');
  if (data.slug !== expectedSlug) {
    bad(`slug "${data.slug}" does not match the file name "${expectedSlug}"`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(data.slug ?? '')) {
    bad(`slug must be lowercase kebab-case, got "${data.slug}"`);
  }
  if (!data.name?.trim()) bad('name is required');
  if (!data.description?.trim()) bad('description is required');
  if (!data.category?.trim()) bad('category is required');
  else if (!ctx.categories.en.has(data.category)) {
    bad(`category "${data.category}" has no catalog.category key in en.ts`);
  } else if (!ctx.categories.ru.has(data.category)) {
    bad(`category "${data.category}" has no catalog.category key in ru.ts`);
  }

  if (!data.icon) bad('icon is required');
  else if (!ctx.icons.has(data.icon)) {
    bad(`icon "${data.icon}" is not defined in catalog-icons.tsx`);
  }

  // Russian is optional: the UI falls back to the English text, and demanding a
  // translation for every machine-imported app would block the import outright.
  const ru = data.translations?.ru;
  if (ru && !ru.description?.trim() && !ru.name?.trim()) {
    bad('translations.ru is present but empty — drop it or fill it in');
  }

  if (data.source !== undefined && data.source !== 'coolify') {
    bad(`unknown source "${data.source}"`);
  }

  if (!DEPLOY_KINDS.includes(data.deployKind)) {
    bad(`deployKind must be one of ${DEPLOY_KINDS.join(' | ')}`);
  }
  if (data.deployKind === 'image' && !data.image) {
    bad('image manifests need an "image"');
  }
  if (data.deployKind === 'image' && !/:/.test(data.image ?? ':')) {
    bad(`image "${data.image}" must pin an explicit tag`);
  }
  if (data.deployKind === 'compose') {
    if (!data.composeYaml && !data.composeGitUrl) {
      bad('compose manifests need "composeYaml" or "composeGitUrl"');
    }
    if (data.composeYaml && !data.composeYaml.includes('services:')) {
      bad('composeYaml has no "services:" block');
    }
  }

  if (data.defaultPort !== undefined && data.defaultPort !== null) {
    if (!Number.isInteger(data.defaultPort) || data.defaultPort < 1 || data.defaultPort > 65535) {
      bad(`defaultPort ${data.defaultPort} is out of range`);
    }
  }

  for (const vol of data.recommendedVolumes ?? []) {
    if (!vol.mountPath?.startsWith('/')) {
      bad(`recommendedVolumes mountPath must be absolute, got "${vol.mountPath}"`);
    }
  }

  const seen = new Set();
  for (const env of data.envDefaults ?? []) {
    if (!ENV_KEY.test(env.key ?? '')) bad(`envDefaults key "${env.key}" is not a valid variable name`);
    if (seen.has(env.key)) bad(`envDefaults key "${env.key}" is duplicated`);
    seen.add(env.key);
    if (env.secret && env.value) {
      bad(`envDefaults key "${env.key}" is a secret but ships a default value`);
    }
    // An entry with no default, no secret flag and no explicit required flag
    // renders as an unlabelled empty box the user cannot reason about.
    if (env.value === undefined && !env.secret && env.required === undefined) {
      bad(`envDefaults key "${env.key}" needs a value, or a secret/required flag`);
    }
  }

  if (!data.upstream) {
    bad('upstream is required (awesome-selfhosted id, or "none" if unlisted)');
  }

  return errors;
}

export function validationContext() {
  return {
    icons: knownIcons(),
    categories: { en: translatedCategories('en'), ru: translatedCategories('ru') },
  };
}

// ----------------------------------------------------------------- upstream

/**
 * Shallow-clone (or refresh) awesome-selfhosted-data into a local cache and
 * return the checkout path. `offline` reuses whatever is already cached.
 */
export function ensureUpstream({ offline = false } = {}) {
  const dir = join(CACHE_DIR, 'awesome-selfhosted-data');
  if (existsSync(join(dir, 'software'))) {
    if (!offline) {
      execFileSync('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', 'HEAD'], {
        stdio: 'inherit',
      });
      execFileSync('git', ['-C', dir, 'reset', '--hard', 'FETCH_HEAD'], {
        stdio: 'inherit',
      });
    }
    return dir;
  }
  if (offline) {
    throw new Error(`No cached upstream data at ${dir}; run without --offline first`);
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  execFileSync('git', ['clone', '--depth', '1', UPSTREAM_REPO, dir], {
    stdio: 'inherit',
  });
  return dir;
}

/** Parsed `software/*.yml` entries, keyed by upstream id (the file stem). */
export function loadUpstream(dir) {
  const softwareDir = join(dir, 'software');
  const entries = new Map();
  for (const file of readdirSync(softwareDir)) {
    if (!file.endsWith('.yml')) continue;
    const id = file.replace(/\.yml$/, '');
    try {
      entries.set(id, { id, ...parseYaml(readFileSync(join(softwareDir, file), 'utf8')) });
    } catch (e) {
      throw new Error(`${file}: ${e.message}`);
    }
  }
  return entries;
}

/** Commits pushed upstream within the activity window. */
export function recentCommits(entry, months = ACTIVITY_WINDOW_MONTHS) {
  const history = entry.commit_history ?? {};
  return Object.keys(history)
    .sort()
    .slice(-months)
    .reduce((sum, key) => sum + (Number(history[key]) || 0), 0);
}

const FLOATING_TAGS = new Set([
  'latest',
  'stable',
  'main',
  'master',
  'release',
  'edge',
  'dev',
  'nightly',
  'rolling',
]);

/**
 * Numeric components of a version-like tag, or null for anything that floats.
 * `ghost:5-alpine` → [5]; `meilisearch:v1.13` → [1, 13]; `:latest` → null.
 */
export function versionParts(tag) {
  if (!tag) return null;
  const base = String(tag).split('-')[0].replace(/^v/, '');
  if (FLOATING_TAGS.has(String(tag)) || FLOATING_TAGS.has(base)) return null;
  if (!/^\d+(\.\d+)*$/.test(base)) return null;
  return base.split('.').map(Number);
}

export function pinnedVersion(imageRef) {
  if (!imageRef) return null;
  const tag = imageRef.split(':').slice(1).join(':');
  return versionParts(tag || 'latest');
}

/** True when upstream has moved past every component we actually pin. */
export function isBehind(pinned, latest) {
  if (!pinned || !latest) return false;
  for (let i = 0; i < pinned.length; i++) {
    const ours = pinned[i];
    const theirs = latest[i] ?? 0;
    if (theirs > ours) return true;
    if (theirs < ours) return false;
  }
  return false;
}
