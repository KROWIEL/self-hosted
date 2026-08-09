import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';

/**
 * What this machine looks like to the licence server.
 *
 * A personal licence covers one machine. The instance id alone cannot say which
 * one: it lives in the panel's own database, so it travels with a copy of that
 * database and can be typed in twice. So the panel also reports marks of the
 * hardware it is running on, and the licence server treats those as the
 * machine's identity.
 *
 * Two things this deliberately does not do. It does not send anything
 * identifying in the clear: every mark is an HMAC keyed by the licence it
 * belongs to, so the server learns "the same machine as last time" and nothing
 * else, and the same host under two different licences looks like two
 * unrelated machines. And it does not pretend to be tamper-proof — this file is
 * open source. It closes the ordinary ways a key gets shared, not the ones that
 * involve rebuilding the panel.
 *
 * Inside a container none of these paths describe the host, so the compose file
 * mounts the host's own copies at `/host`. Without those mounts the panel
 * reports nothing and the licence falls back to the instance id.
 */

export type HardwareMark = { k: string; h: string };

/** Where each mark comes from, most host-specific first. */
const SOURCES: { kind: string; paths: string[] }[] = [
  {
    kind: 'machine-id',
    paths: ['/host/etc/machine-id', '/etc/machine-id', '/var/lib/dbus/machine-id'],
  },
  {
    kind: 'product-uuid',
    paths: ['/host/sys/class/dmi/id/product_uuid', '/sys/class/dmi/id/product_uuid'],
  },
  {
    kind: 'board-serial',
    paths: ['/host/sys/class/dmi/id/board_serial', '/sys/class/dmi/id/board_serial'],
  },
];

/** Values a distro or hypervisor hands out to everyone. Worse than nothing. */
const NOT_UNIQUE = new Set([
  '',
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'none',
  'notspecified',
  'not specified',
  'to be filled by o.e.m.',
  'default string',
  '0',
  '1',
]);

function firstReadable(paths: string[]): string | null {
  for (const path of paths) {
    try {
      const value = readFileSync(path, 'utf8').trim();
      if (value && !NOT_UNIQUE.has(value.toLowerCase())) return value;
    } catch {
      // Missing, or not ours to read. Try the next place.
    }
  }
  return null;
}

/**
 * A weak mark: the shape of the machine rather than its name. On its own it
 * identifies nothing — half a datacentre has the same processor — but it is
 * enough to help recognise a host that lost its stronger marks.
 */
function shape(): string | null {
  const core = cpus()[0];
  if (!core) return null;
  // Memory rounded to whole gigabytes, so a few reserved megabytes after a
  // kernel upgrade do not read as a different machine.
  const gigabytes = Math.round(totalmem() / 1024 ** 3);
  return `${core.model.trim()}|${cpus().length}|${gigabytes}`;
}

/**
 * Hash a mark so it means something only to the licence it was collected for.
 * Keying on the licence key means the server can compare a machine with itself
 * and with nothing else.
 */
function seal(licenseKey: string, kind: string, value: string): string {
  return createHmac('sha256', licenseKey).update(`${kind}:${value}`).digest('hex').slice(0, 32);
}

/** The marks to send with an activation. Empty when the host is not visible. */
export function hardwareMarks(licenseKey: string): HardwareMark[] {
  if (!licenseKey) return [];

  const found: HardwareMark[] = [];
  for (const source of SOURCES) {
    const value = firstReadable(source.paths);
    if (value) found.push({ k: source.kind, h: seal(licenseKey, source.kind, value) });
  }
  const profile = shape();
  if (profile) found.push({ k: 'profile', h: seal(licenseKey, 'profile', profile) });

  return found;
}

/**
 * Whether the machine is recognisable at all. The licence server weighs the
 * marks the same way: one strong one, or two weak ones.
 */
export function hardwareIsVisible(marks: HardwareMark[]): boolean {
  const weight = (kind: string) => (kind === 'machine-id' || kind === 'product-uuid' ? 2 : 1);
  return marks.reduce((total, mark) => total + weight(mark.k), 0) >= 2;
}
