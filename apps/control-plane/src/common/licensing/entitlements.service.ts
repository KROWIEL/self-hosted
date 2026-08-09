import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  TIER_LIMITS,
  type ActivationStatus,
  type Entitlements,
  type LicenseModule,
} from '@selfhosted/shared';
import { DRIZZLE, Database } from '../../db/database.module';
import { installation, licenses } from '../../db/schema';
import { LicenseErrors } from '../errors/app-errors';
import { hardwareIsVisible, hardwareMarks, type HardwareMark } from './hardware';
import {
  entitlementsFromKey,
  isLicenseUsable,
  isUsingDevLicenseKey,
  verifyLicenseKey,
} from './license';

/** Heartbeat outcomes that mean "definitely not licensed" (lock immediately). */
const DEFINITIVE_DENY = new Set([
  'revoked',
  'rejected',
  'expired',
  'seat_limit',
  // The key is being used on a machine it is not licensed for, or a fleet key
  // arrived without the secret its owner deploys beside it.
  'hardware_mismatch',
  'hardware_required',
  'fleet_secret',
  'http_401',
  'http_403',
]);

/**
 * Resolves the installation's effective entitlements from the active license
 * key, and — when an activation server is configured — enforces online
 * activation: paid modules stay unlocked only while a recent heartbeat has
 * succeeded. With no `LICENSE_ACTIVATION_URL` the instance runs offline /
 * key-only (signature + expiry are still verified locally).
 */
@Injectable()
export class EntitlementsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EntitlementsService.name);

  private cache: Entitlements | null = null;
  private cachedAt = 0;
  private readonly ttlMs = 15_000;

  // Online-activation state.
  private readonly activationUrl = process.env.LICENSE_ACTIVATION_URL?.trim() || '';
  // A key is licensed to one machine, so removing it here has to hand the place
  // back — otherwise the next machine is refused until something times out.
  private readonly releaseUrl = releaseUrlFor(this.activationUrl);
  private readonly intervalMs = numFromEnv('LICENSE_HEARTBEAT_INTERVAL_MS', 6 * 60 * 60 * 1000);
  private readonly maxAgeMs = numFromEnv('LICENSE_ACTIVATION_MAX_AGE_MS', 72 * 60 * 60 * 1000);
  // A company licence covers a whole fleet, so it is not tied to any one
  // machine; what proves the machine belongs to the company is this secret,
  // deployed beside the key. Personal licences have none and do not need one.
  private readonly fleetSecret = process.env.LICENSE_FLEET_SECRET?.trim() || '';
  private warnedAboutHiddenHost = false;
  private lastOkAt = 0;
  private lastAttempt: { ok: boolean; at: number; reason?: string } | null = null;
  private timer: NodeJS.Timeout | null = null;
  // Start of the current grace window (service start or last key change). Used so
  // a freshly-activated license isn't locked out before its first heartbeat lands.
  private activationBaselineAt = Date.now();

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async onModuleInit(): Promise<void> {
    if (isUsingDevLicenseKey()) {
      this.logger.warn(
        'Licensing is using the throwaway DEV public key — the matching private ' +
          'key is public, so anyone could mint valid license keys. Rotate to your ' +
          'production keypair (or set LICENSE_PUBLIC_KEY) before selling licenses ' +
          '(see docs/LICENSING.md).',
      );
    }
    if (!this.activationUrl) {
      this.logger.log('License activation: offline / key-only mode (no LICENSE_ACTIVATION_URL).');
      return;
    }
    // Restore the persisted grace-window baseline and last-success timestamp so
    // a restart doesn't reset the offline grace window (Info finding).
    await this.loadActivationState();
    this.logger.log(
      `License activation: online mode via ${this.activationUrl} (grace ${Math.round(this.maxAgeMs / 3_600_000)}h).`,
    );
    if (!this.releaseUrl) {
      this.logger.warn(
        'No release endpoint could be derived from LICENSE_ACTIVATION_URL. Removing ' +
          'the key here will not free the licence — set LICENSE_RELEASE_URL, or ' +
          'unbind this machine from the licence portal when moving the key.',
      );
    }
    void this.heartbeat();
    this.timer = setInterval(() => void this.heartbeat(), this.intervalMs);
    // Don't keep the event loop alive just for the heartbeat.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async currentKey(): Promise<string | null> {
    const rows = await this.db
      .select()
      .from(licenses)
      .orderBy(desc(licenses.createdAt))
      .limit(1);
    if (rows[0]?.key) return rows[0].key;
    const env = process.env.LICENSE_KEY?.trim();
    return env ? env : null;
  }

  /** The singleton installation row, created on first access. */
  private async installationRow(): Promise<typeof installation.$inferSelect> {
    const existing = await this.db
      .select()
      .from(installation)
      .where(eq(installation.id, 'default'))
      .limit(1);
    if (existing[0]) return existing[0];
    const inserted = await this.db
      .insert(installation)
      .values({ id: 'default' })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) return inserted[0];
    const again = await this.db
      .select()
      .from(installation)
      .where(eq(installation.id, 'default'))
      .limit(1);
    return again[0];
  }

  /** Stable per-installation id used as the activation "seat" identifier. */
  private async instanceId(): Promise<string> {
    return (await this.installationRow())?.instanceId ?? 'unknown';
  }

  /** Restore persisted activation timestamps into memory (online mode only). */
  private async loadActivationState(): Promise<void> {
    try {
      const row = await this.installationRow();
      if (row?.activationBaselineAt) {
        this.activationBaselineAt = row.activationBaselineAt.getTime();
      } else {
        // First run after this feature landed: anchor now and persist it.
        this.activationBaselineAt = Date.now();
        await this.db
          .update(installation)
          .set({ activationBaselineAt: new Date(this.activationBaselineAt) })
          .where(eq(installation.id, 'default'));
      }
      if (row?.lastActivationOkAt) {
        this.lastOkAt = row.lastActivationOkAt.getTime();
      }
    } catch (e) {
      this.logger.warn(
        `Could not load persisted activation state: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  /** Persist the last successful heartbeat timestamp. Best-effort. */
  private async persistLastOk(ts: number): Promise<void> {
    try {
      await this.db
        .update(installation)
        .set({ lastActivationOkAt: new Date(ts) })
        .where(eq(installation.id, 'default'));
    } catch (e) {
      this.logger.warn(
        `Could not persist activation success: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  /** Persist a fresh grace-window baseline and clear the last-success mark. */
  private async persistActivationReset(baseline: number): Promise<void> {
    try {
      await this.db
        .update(installation)
        .set({
          activationBaselineAt: new Date(baseline),
          lastActivationOkAt: null,
        })
        .where(eq(installation.id, 'default'));
    } catch (e) {
      this.logger.warn(
        `Could not persist activation reset: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  /** One activation heartbeat against the license server. Never throws. */
  private async heartbeat(): Promise<void> {
    if (!this.activationUrl) return;
    try {
      const key = await this.currentKey();
      if (!key) {
        // Free instance: nothing to activate.
        this.lastAttempt = { ok: true, at: Date.now() };
        this.cache = null;
        return;
      }
      const instanceId = await this.instanceId();
      const machine = hardwareMarks(key);
      this.warnOnceIfHostIsHidden(machine);
      const res = await fetch(this.activationUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key,
          instanceId,
          product: 'self-hosted',
          version: process.env.APP_VERSION ?? '0',
          machine,
          // Only a company licence has one; personal keys send nothing.
          ...(this.fleetSecret ? { fleet: this.fleetSecret } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.lastAttempt = { ok: false, at: Date.now(), reason: `http_${res.status}` };
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; reason?: string }
        | null;
      if (data?.ok) {
        this.lastOkAt = Date.now();
        this.lastAttempt = { ok: true, at: this.lastOkAt };
        // Persist so the grace window anchors to this success across restarts.
        await this.persistLastOk(this.lastOkAt);
      } else {
        this.lastAttempt = { ok: false, at: Date.now(), reason: data?.reason ?? 'rejected' };
        this.logger.warn(`License activation rejected: ${this.lastAttempt.reason}`);
      }
    } catch {
      // Transient (network/timeout): keep the last successful timestamp so the
      // grace window is measured from the last success, not from this failure.
      this.lastAttempt = { ok: false, at: Date.now(), reason: 'unreachable' };
    } finally {
      this.cache = null;
    }
  }

  /**
   * A container cannot see the host it runs on unless the host's identifiers
   * are mounted in. Without them the licence has nothing to hold on to but the
   * instance id, and the operator should hear about it once.
   */
  private warnOnceIfHostIsHidden(machine: HardwareMark[]): void {
    if (this.warnedAboutHiddenHost || hardwareIsVisible(machine) || this.fleetSecret) return;
    this.warnedAboutHiddenHost = true;
    this.logger.warn(
      'This installation cannot see the machine it runs on, so its licence is ' +
        'bound to nothing but its own instance id. If the control plane runs in ' +
        'a container, mount the host identifiers read-only: /etc/machine-id at ' +
        '/host/etc/machine-id and /sys/class/dmi/id at /host/sys/class/dmi/id. ' +
        'A licence server may refuse activation without them (see docs/LICENSING.md).',
    );
  }

  /**
   * Tell the licence server this installation is done with a key. Best effort:
   * the customer is allowed to unbind from their account page too, so a failure
   * here costs them a click, not the transfer.
   */
  private async release(key: string): Promise<void> {
    if (!this.releaseUrl || !key) return;
    try {
      const instanceId = await this.instanceId();
      const res = await fetch(this.releaseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, instanceId }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
      if (!res.ok || !data?.ok) {
        this.logger.warn(
          `Could not release this machine from the licence (${data?.reason ?? `http_${res.status}`}). ` +
            'Unbind it from the licence portal before activating the key elsewhere.',
        );
      }
    } catch {
      this.logger.warn(
        'Could not reach the licence server to release this machine. Unbind it ' +
          'from the licence portal before activating the key elsewhere.',
      );
    }
  }

  private activationOk(): boolean {
    const reason = this.lastAttempt?.reason;
    // Hard denials (revoked / rejected / expired / seat limit / auth) lock
    // immediately, regardless of any grace window.
    if (this.lastAttempt && !this.lastAttempt.ok && reason && DEFINITIVE_DENY.has(reason)) {
      return false;
    }
    const now = Date.now();
    // Normal case: a recent successful heartbeat keeps modules unlocked.
    if (this.lastOkAt > 0) return now - this.lastOkAt < this.maxAgeMs;
    // Never succeeded yet (fresh key / first contact / server briefly down):
    // stay unlocked during the initial grace window measured from the baseline,
    // so a just-activated license isn't blocked before its first heartbeat lands.
    return now - this.activationBaselineAt < this.maxAgeMs;
  }

  private activationStatus(ok: boolean): ActivationStatus {
    return {
      required: !!this.activationUrl,
      ok,
      lastCheckAt: this.lastOkAt ? Math.floor(this.lastOkAt / 1000) : null,
      reason: ok ? undefined : this.lastAttempt?.reason ?? 'pending',
    };
  }

  /** Effective entitlements (cached for a short TTL). */
  async get(force = false): Promise<Entitlements> {
    const now = Date.now();
    if (!force && this.cache && now - this.cachedAt < this.ttlMs) {
      return this.cache;
    }
    const key = await this.currentKey();
    const base = entitlementsFromKey(key);

    let ent: Entitlements;
    if (!this.activationUrl) {
      // Offline / key-only mode: no online enforcement.
      ent = { ...base, activation: { required: false, ok: true, lastCheckAt: null } };
    } else {
      const ok = this.activationOk();
      const status = this.activationStatus(ok);
      if (base.tier === 'free' || !base.licensed || ok) {
        ent = { ...base, activation: status };
      } else {
        // Licensed but not currently activated → lock paid modules and drop
        // quantitative caps back to the Free tier.
        ent = {
          tier: base.tier,
          modules: [],
          limits: TIER_LIMITS.free,
          expiresAt: base.expiresAt,
          licensed: false,
          subject: base.subject,
          name: base.name,
          activation: status,
        };
      }
    }

    this.cache = ent;
    this.cachedAt = now;
    return ent;
  }

  async hasModule(module: LicenseModule): Promise<boolean> {
    const ent = await this.get();
    return ent.modules.includes(module);
  }

  /** Current tier's quantitative caps (nodes, tunnels, …). */
  async limits(): Promise<Entitlements['limits']> {
    const ent = await this.get();
    return ent.limits;
  }

  /** Validate and persist a new license key, replacing any existing one. */
  async setKey(key: string): Promise<Entitlements> {
    const trimmed = (key ?? '').trim();
    if (!verifyLicenseKey(trimmed)) throw LicenseErrors.invalidKey();
    if (!isLicenseUsable(trimmed)) throw LicenseErrors.expiredKey();

    // Swapping in a different licence frees the old one; a renewed key for the
    // same licence keeps its place, or the machine would give up the seat it is
    // about to ask for again.
    const previous = await this.currentKey();
    if (previous && previous !== trimmed) {
      const before = entitlementsFromKey(previous).subject;
      const after = entitlementsFromKey(trimmed).subject;
      if (before && before !== after) await this.release(previous);
    }

    await this.db.delete(licenses);
    await this.db.insert(licenses).values({ key: trimmed });
    this.cache = null;
    this.lastOkAt = 0;
    this.lastAttempt = null;
    // New key → fresh grace window so activation can't lock a just-entered key.
    this.activationBaselineAt = Date.now();
    await this.persistActivationReset(this.activationBaselineAt);
    // Re-activate immediately so the UI reflects the new key without waiting.
    if (this.activationUrl) await this.heartbeat();
    return this.get(true);
  }

  /** Remove any stored license key (env fallback, if set, still applies). */
  async clear(): Promise<Entitlements> {
    const previous = await this.currentKey();
    if (previous) await this.release(previous);
    await this.db.delete(licenses);
    this.cache = null;
    this.lastOkAt = 0;
    this.lastAttempt = null;
    this.activationBaselineAt = Date.now();
    await this.persistActivationReset(this.activationBaselineAt);
    return this.get(true);
  }
}

/**
 * Where to hand a machine's place back. Explicit `LICENSE_RELEASE_URL` wins;
 * otherwise it sits next to activation, so an existing deployment needs no new
 * configuration.
 */
function releaseUrlFor(activationUrl: string): string {
  const explicit = process.env.LICENSE_RELEASE_URL?.trim();
  if (explicit) return explicit;
  if (!activationUrl) return '';
  const derived = activationUrl.replace(/\/activate\/?$/, '/release');
  // A URL that is not the standard endpoint tells us nothing about where the
  // release lives, and guessing would post a release to the activation route —
  // which reads as a heartbeat and takes the seat rather than freeing it.
  return derived === activationUrl ? '' : derived;
}

function numFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
