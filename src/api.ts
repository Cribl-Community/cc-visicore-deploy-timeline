// Read-only access to Cribl config-version history through the App framework's
// authenticated fetch proxy. Every path here must be granted in config/policies.yml.

declare global {
  interface Window {
    CRIBL_API_URL: string;
    CRIBL_BASE_PATH: string;
    getCriblUser(): Promise<CriblUser>;
  }
}

export type CriblUser = {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  initials?: string;
};

export type GroupType = 'stream' | 'edge' | 'search' | 'local_search' | 'lake_access' | 'outpost';

export type ConfigGroup = {
  id: string;
  name?: string;
  description?: string;
  type?: GroupType;
  isFleet?: boolean;
  isSearch?: boolean;
  workerCount?: number;
  /** Commit hash currently deployed to the group's workers. */
  configVersion?: string;
  git?: {
    commit?: string;
    localChanges?: number;
    log?: { hash: string; short: string; message: string; date: string; author_name?: string }[];
  };
};

export type GitLogEntry = {
  hash: string;
  date: string;
  message: string;
  body?: string;
  author_name?: string;
  author_email?: string;
  refs?: string;
};

export type DiffLine = {
  type: 'insert' | 'delete' | 'context';
  content: string;
  oldNumber?: number;
  newNumber?: number;
};

export type DiffBlock = { header: string; lines: DiffLine[] };

export type DiffFile = {
  oldName: string;
  newName: string;
  addedLines: number;
  deletedLines: number;
  language?: string;
  isNew?: boolean;
  isDeleted?: boolean;
  blocks: DiffBlock[];
};

export type GitShow = { commitMessage: string; diffJson: DiffFile[]; isTooBig?: boolean };

export type GitFile = { name: string; state?: 'M' | 'A' | 'D'; children?: GitFile[] };

/** The files endpoint may answer with a directory tree; flatten it to full leaf paths. */
export function flattenFiles(files: GitFile[], prefix = ''): GitFile[] {
  return files.flatMap((f) => {
    const name = f.name.startsWith(prefix) ? f.name : `${prefix}${f.name}`;
    return f.children?.length ? flattenFiles(f.children, `${name}/`) : [{ ...f, name }];
  });
}

type Counted<T> = { items: T[]; count: number; totalCount?: number };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${window.CRIBL_API_URL}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return (await res.json()) as T;
}

export const listGroups = () =>
  get<Counted<ConfigGroup>>('/master/groups').then((r) => r.items ?? []);

/** Deployed commit hash for a group; the list endpoint does not always populate configVersion. */
export const groupConfigVersion = (gid: string) =>
  get<Counted<string>>(`/master/groups/${encodeURIComponent(gid)}/configVersion`).then((r) => r.items?.[0]);

export const listCommits = (gid: string, limit = 200, offset = 0) =>
  get<Counted<GitLogEntry>>(
    `/m/${encodeURIComponent(gid)}/version?offset=${offset}&limit=${limit}`,
  ).then((r) => r.items ?? []);

/** Pages through a group's full commit history; `listCommits` alone silently truncates at its limit. */
export async function listAllCommits(gid: string, pageSize = 200): Promise<GitLogEntry[]> {
  const out: GitLogEntry[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await listCommits(gid, pageSize, offset);
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}

export const showCommit = (gid: string, hash: string, diffLineLimit = 4000) =>
  get<Counted<GitShow>>(
    `/m/${encodeURIComponent(gid)}/version/show?commit=${hash}&diffLineLimit=${diffLineLimit}`,
  ).then((r) => r.items?.[0]);

export const changedFiles = (gid: string, hash: string) =>
  get<Counted<{ items: GitFile[]; count: number }>>(
    `/m/${encodeURIComponent(gid)}/version/files?commit=${hash}`,
  ).then((r) => flattenFiles(r.items?.[0]?.items ?? []));

/** App-scoped KV store; the proxy rewrites this to /a/{appId}/kvstore/... */
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const res = await fetch(`${window.CRIBL_API_URL}/kvstore/${key}`);
  if (!res.ok) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await fetch(`${window.CRIBL_API_URL}/kvstore/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(value),
  });
}

export type WorkerEntry = { id: string; group?: string; disconnected?: boolean; info?: { cribl?: { version?: string }; hostname?: string } };

export const systemInfo = () =>
  get<Counted<{ BUILD?: Record<string, unknown> }>>('/system/info').then((r) => r.items?.[0]);

export const listWorkers = () =>
  get<Counted<WorkerEntry>>('/master/workers?limit=1000').then((r) => r.items ?? []);

// ---- Actions (each caller shows a confirmation naming the exact target first) ----

async function send<T>(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  const res = await fetch(`${window.CRIBL_API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text.slice(0, 300)}` : ''}`);
  }
  return (await res.json()) as T;
}

/** Deploy a committed version to a group (same as Deploy on Cribl's commit list). */
export const deployVersion = (gid: string, hash: string) =>
  send<unknown>(`/master/groups/${encodeURIComponent(gid)}/deploy`, 'PATCH', { version: hash });

/** Revert a commit by creating a new inverse commit (same as Revert on Cribl's commit list). */
export const revertCommit = (gid: string, hash: string, message?: string) =>
  send<unknown>(`/m/${encodeURIComponent(gid)}/version/revert`, 'POST', { commit: hash, ...(message ? { message } : {}) });

/** Commit all pending changes in a group. */
export const commitPending = (gid: string, message: string) =>
  send<Counted<{ commit: string }>>(`/m/${encodeURIComponent(gid)}/version/commit`, 'POST', { message });

/** Small concurrency gate so lazy per-commit fetches never flood the proxy. */
export function pLimit(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => { active--; queue.shift()?.(); };
  return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    const run = () => { active++; fn().then(resolve, reject).finally(next); };
    if (active < max) run(); else queue.push(run);
  });
}

/** Tries each group in turn; a commit may not resolve in the first group's repo view. */
export async function firstGroup<T>(gids: string[], fn: (gid: string) => Promise<T>): Promise<T> {
  let err: unknown;
  for (const gid of gids.slice(0, 2)) {
    try { return await fn(gid); } catch (e) { err = e; }
  }
  throw err ?? new Error('no group');
}
