// Pure data shaping for the timeline. No I/O, no React, so `node --test` runs it directly.
import type { ConfigGroup, GitLogEntry } from './api.ts';

export type Commit = GitLogEntry & {
  short: string;
  time: number; // epoch ms
  groups: string[]; // ids of every group whose log contains this commit
  deployedTo: string[]; // ids of groups whose configVersion === hash
};

export type GroupState = {
  id: string;
  name: string;
  type: string;
  isFleet: boolean;
  workerCount: number;
  deployedHash?: string;
  /** Commits in this group's log newer than the deployed one (-1 = deployed hash not in log). */
  lag: number;
  localChanges: number;
  latestHash?: string;
};

export function parseGitDate(s: string): number {
  // Cribl returns "2024-01-15 10:30:00 +0000"; Date wants ISO.
  const iso = s.replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2');
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Date.parse(s) : t;
}

export function mergeCommits(
  logs: Record<string, GitLogEntry[]>,
  groups: ConfigGroup[],
): Commit[] {
  const byHash = new Map<string, Commit>();
  for (const [gid, entries] of Object.entries(logs)) {
    for (const e of entries) {
      let c = byHash.get(e.hash);
      if (!c) {
        c = { ...e, short: e.hash.slice(0, 7), time: parseGitDate(e.date), groups: [], deployedTo: [] };
        byHash.set(e.hash, c);
      }
      if (!c.groups.includes(gid)) c.groups.push(gid);
    }
  }
  for (const g of groups) {
    const c = g.configVersion && findByHash(byHash, g.configVersion);
    if (c && !c.deployedTo.includes(g.id)) c.deployedTo.push(g.id);
  }
  return [...byHash.values()].sort((a, b) => b.time - a.time);
}

/** Fleets report configVersion as `<short-hash>-<bundle-id>`; compare on the git hash part only. */
export function sameHash(a: string, b: string): boolean {
  const x = a.split('-')[0];
  const y = b.split('-')[0];
  return x === y || (y.length >= 7 && x.startsWith(y)) || (x.length >= 7 && y.startsWith(x));
}

function findByHash(m: Map<string, Commit>, h: string): Commit | undefined {
  const exact = m.get(h);
  if (exact) return exact;
  for (const [k, v] of m) if (sameHash(k, h)) return v;
  return undefined;
}

export function groupStates(groups: ConfigGroup[], logs: Record<string, GitLogEntry[]>): GroupState[] {
  return groups.map((g) => {
    const log = logs[g.id] ?? [];
    const idx = g.configVersion ? log.findIndex((e) => sameHash(e.hash, g.configVersion!)) : -1;
    return {
      id: g.id,
      name: g.name || g.id,
      type: g.type ?? (g.isFleet ? 'edge' : 'stream'),
      isFleet: !!g.isFleet,
      workerCount: g.workerCount ?? 0,
      deployedHash: g.configVersion,
      lag: idx,
      localChanges: g.git?.localChanges ?? 0,
      latestHash: log[0]?.hash,
    };
  });
}

export function dayKey(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function commitsPerDay(commits: Commit[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of commits) m.set(dayKey(c.time), (m.get(dayKey(c.time)) ?? 0) + 1);
  return m;
}

/** Last `days` days as [{key, count}], oldest first, zero-filled. */
export function dailySeries(commits: Commit[], days: number, now = Date.now()): { key: string; count: number }[] {
  const per = commitsPerDay(commits);
  const out: { key: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(now - i * 86_400_000);
    out.push({ key: k, count: per.get(k) ?? 0 });
  }
  return out;
}

export type AuthorCount = { name: string; email?: string; count: number; other?: boolean };

export function authorCounts(commits: Commit[], top = 8): AuthorCount[] {
  const m = new Map<string, AuthorCount>();
  for (const c of commits) {
    const key = c.author_name || c.author_email || 'unknown';
    const a = m.get(key) ?? { name: key, email: c.author_email, count: 0 };
    a.count++;
    m.set(key, a);
  }
  const all = [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  if (all.length <= top) return all;
  const rest = all.slice(top).reduce((n, a) => n + a.count, 0);
  return [...all.slice(0, top), { name: 'Other', count: rest, other: true }];
}

export const AREAS = ['pipelines', 'routes', 'sources', 'destinations', 'packs', 'lookups', 'other'] as const;
export type Area = (typeof AREAS)[number];

export function areaOf(path: string): Area {
  const p = path.toLowerCase();
  if (p.includes('/pipelines/')) return 'pipelines';
  if (/\/routes\.yml$/.test(p) || p.includes('/routes/')) return 'routes';
  if (/\/inputs\.yml$/.test(p) || p.includes('/inputs/')) return 'sources';
  if (/\/outputs\.yml$/.test(p) || p.includes('/outputs/')) return 'destinations';
  if (p.includes('/packs/')) return 'packs';
  if (p.includes('/lookups/')) return 'lookups';
  return 'other';
}

export function footprint(paths: string[]): Record<Area, number> {
  const out = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
  for (const p of paths) out[areaOf(p)]++;
  return out;
}

export function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function relativeTime(t: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

export function shortPath(p: string): string {
  // groups/<gid>/local/cribl/pipelines/x/conf.yml -> pipelines/x/conf.yml
  return p.replace(/^groups\/[^/]+\/(local|default)\/cribl\//, '').replace(/^groups\/[^/]+\//, '');
}

export type VersionState = {
  /** Distinct Cribl versions running in the group, most common first. */
  running: { version: string; count: number }[];
  /** Target version the Leader wants (Edge Fleets / Outposts expose upgradeVersion). */
  target?: string;
  incompatible: number;
  /** 'match' = every node on the leader version; 'behind' / 'ahead' relative to leader; 'mixed' = several versions. */
  status: 'match' | 'behind' | 'ahead' | 'mixed' | 'unknown';
};

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function versionStates(
  groups: ConfigGroup[],
  workers: { group?: string; disconnected?: boolean; info?: { cribl?: { version?: string } } }[],
  leaderVersion?: string,
): Record<string, VersionState> {
  const out: Record<string, VersionState> = {};
  for (const g of groups) {
    const counts = new Map<string, number>();
    for (const w of workers) {
      if (w.group !== g.id || w.disconnected) continue;
      const v = w.info?.cribl?.version;
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const running = [...counts.entries()].map(([version, count]) => ({ version, count })).sort((a, b) => b.count - a.count);
    const gx = g as ConfigGroup & { upgradeVersion?: string; incompatibleWorkerCount?: number };
    let status: VersionState['status'] = 'unknown';
    if (running.length > 1) status = 'mixed';
    else if (running.length === 1 && leaderVersion) {
      const c = compareVersions(running[0].version, leaderVersion);
      status = c === 0 ? 'match' : c < 0 ? 'behind' : 'ahead';
    }
    out[g.id] = { running, target: gx.upgradeVersion, incompatible: gx.incompatibleWorkerCount ?? 0, status };
  }
  return out;
}

const VERSION_RE = /\bupgrad|\bv?\d+\.\d+\.\d+(-[0-9a-f]+)?\b|migrat/i;

/** Heuristic: commit looks like a Cribl version change (upgrade auto-commits, migrations). */
export function isVersionChange(c: { message: string; body?: string }): boolean {
  return VERSION_RE.test(c.message) || VERSION_RE.test(c.body ?? '');
}
