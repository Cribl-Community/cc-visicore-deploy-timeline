import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer, Switch, Text, TextField, SelectField, ToggleButtonGroup, Skeleton, EmptyState, Alert, Card, Table, defineColumns, Button } from '@capra/core';
import { SearchOutlined, ReloadOutlined } from '@capra/icons';
import { listGroups, listCommits, changedFiles, firstGroup, pLimit, groupConfigVersion, systemInfo, listWorkers, type WorkerEntry, kvGet, kvSet, type ConfigGroup, type GitLogEntry, type CriblUser } from './api';
import { displayAuthor, mergeCommits, groupStates, dailySeries, commitsPerDay, authorCounts, footprint, dayKey, versionStates, areaOf, type Commit, type Area } from './model';
import { StatTiles } from './viz/StatTiles';
import { kindLabel } from './model';
import { groupsListUrl } from './links';
import { CommitGraph } from './viz/CommitGraph';
import { ActivityCalendar } from './viz/ActivityCalendar';
import { DeployDrift } from './viz/DeployDrift';
import { ChangeFootprint } from './viz/ChangeFootprint';
import { Authors } from './viz/Authors';
import { CommitDrawer } from './CommitDrawer';
import { TouchMap } from './viz/TouchMap';
import { VersionLadder } from './viz/VersionLadder';
import { TimeScale } from './viz/TimeScale';
import './viz/viz.css';

type Filters = { group?: string; author?: string; day?: string; area?: Area; range: string; text: string; view: 'graph' | 'table'; showAll?: boolean; showAllVersions?: boolean; showAllTouch?: boolean; ladderKind?: 'all' | 'wg' | 'fleet' };
const DEFAULT_FILTERS: Filters = { range: '90', text: '', view: 'graph' };
const RANGES = [
  { id: '1', label: '24h', long: 'Last 24 hours' }, { id: '7', label: '7d', long: 'Last 7 days' }, { id: '30', label: '30d', long: 'Last 30 days' },
  { id: '90', label: '90d', long: 'Last 90 days' }, { id: '365', label: '1y', long: 'Last year' }, { id: 'all', label: 'All', long: 'All time' },
];

type Loaded = { groups: ConfigGroup[]; logs: Record<string, GitLogEntry[]>; order: string[]; leaderVersion?: string; workers: WorkerEntry[] };

export default function App() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<CriblUser | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [open, setOpen] = useState<Commit | null>(null);
  const [ladderOpen, setLadderOpen] = useState(false);
  const [fileCache, setFileCache] = useState<Record<string, string[]>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const driftRef = useRef<HTMLDivElement>(null);
  const authorsRef = useRef<HTMLDivElement>(null);
  const jump = (r: React.RefObject<HTMLDivElement | null>) => r.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    window.getCriblUser?.().then(setMe).catch(() => undefined);
    kvGet<Partial<Filters>>('ui/filters').then((f) => f && setFilters((cur) => ({ ...cur, ...f, day: undefined }))).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [info, workers] = await Promise.all([systemInfo().catch(() => undefined), listWorkers().catch(() => [] as WorkerEntry[])]);
        const leaderVersion = typeof info?.BUILD?.VERSION === 'string' ? (info.BUILD.VERSION as string) : undefined;
        const groups = (await listGroups()).filter((g) => !g.isSearch && g.type !== 'search' && g.type !== 'local_search' && g.type !== 'lake_access');
        const entries = await Promise.all(groups.map(async (g) => {
          const [log, cv] = await Promise.all([
            listCommits(g.id).catch(() => []),
            g.configVersion ? Promise.resolve(g.configVersion) : groupConfigVersion(g.id).catch(() => undefined),
          ]);
          if (cv) g.configVersion = cv;
          return [g.id, log] as const;
        }));
        if (!alive) return;
        // Color slots go to the most active groups; the rest share the neutral slot.
        const logs = Object.fromEntries(entries);
        const order = [...groups].sort((a, b) => (logs[b.id]?.length ?? 0) - (logs[a.id]?.length ?? 0)).map((g) => g.id);
        setData({ groups, logs, order, leaderVersion, workers });
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const reload = () => { setError(null); setNow(Date.now()); setReloadKey((k) => k + 1); };

  const update = (patch: Partial<Filters>) => {
    setFilters((cur) => {
      const next = { ...cur, ...patch };
      const { day: _d, ...persist } = next;
      void _d;
      kvSet('ui/filters', persist).catch(() => undefined);
      return next;
    });
  };

  const all = useMemo(() => (data ? mergeCommits(data.logs, data.groups) : []), [data]);
  const states = useMemo(() => (data ? groupStates(data.groups, data.logs) : []), [data]);
  const versions = useMemo(() => (data ? versionStates(data.groups, data.workers, data.leaderVersion) : {}), [data]);
  const versionIssues = Object.values(versions).filter((v) => v.status === 'behind' || v.status === 'mixed' || v.status === 'ahead' || v.incompatible > 0).length;

  const since = useMemo(() => (filters.range === 'all' ? (all.length ? Math.min(...all.map((c) => c.time)) : now - 30 * 86_400_000) : now - Number(filters.range) * 86_400_000), [filters.range, all, now]);
  const visible = useMemo(() => {
    const q = filters.text.trim().toLowerCase();
    return all.filter((c) =>
      c.time >= since &&
      (!filters.group || c.groups.includes(filters.group)) &&
      (!filters.author || c.author_name === filters.author) &&
      (!filters.day || dayKey(c.time) === filters.day) &&
      (!filters.area || (fileCache[c.hash] ?? []).some((p) => areaOf(p) === filters.area)) &&
      (!q || c.message.toLowerCase().includes(q) || (c.body ?? '').toLowerCase().includes(q) || c.hash.startsWith(q) || (c.author_name ?? '').toLowerCase().includes(q)),
    );
  }, [all, filters, fileCache, since]);

  // Footprint needs changed-file lists; fetch lazily for the visible commits (bounded).
  useEffect(() => {
    const todo = visible.filter((c) => !fileCache[c.hash]).slice(0, 60);
    if (todo.length === 0) return;
    let alive = true;
    const limit = pLimit(4);
    Promise.all(todo.map((c) => limit(() => firstGroup(c.groups, (g) => changedFiles(g, c.hash))).then((fs) => [c.hash, fs.map((f) => f.name)] as const).catch(() => [c.hash, []] as const)))
      .then((pairs) => alive && setFileCache((cur) => ({ ...cur, ...Object.fromEntries(pairs) })));
    return () => { alive = false; };
  }, [visible, fileCache]);

  const foot = useMemo(() => {
    const paths = visible.flatMap((c) => fileCache[c.hash] ?? []);
    return footprint(paths);
  }, [visible, fileCache]);
  const footLoading = visible.some((c) => !fileCache[c.hash]);

  const authors = useMemo(() => authorCounts(visible), [visible]);
  const perDay = useMemo(() => commitsPerDay(all.filter((c) => (!filters.group || c.groups.includes(filters.group)) && (!filters.author || c.author_name === filters.author))), [all, filters.group, filters.author]);
  const spark = useMemo(() => dailySeries(all, 30, now).map((d) => d.count), [all, now]);
  const last7 = useMemo(() => all.filter((c) => c.time >= now - 7 * 86_400_000).length, [all, now]);
  const lagging = states.filter((g) => g.lag !== 0).length;
  const uncommitted = states.reduce((n, g) => n + g.localChanges, 0);
  const authorNames = useMemo(() => [...new Map(all.filter((c) => c.author_name).map((c) => [c.author_name as string, displayAuthor(c.author_name)])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [all]);

  const columns = useMemo(() => defineColumns<{ id: string; when: string; message: string; author: string; groups: string; deployed: string }>([
    { id: 'when', label: 'When', allowsSorting: true },
    { id: 'message', label: 'Message' },
    { id: 'author', label: 'Author', allowsSorting: true },
    { id: 'groups', label: 'Groups' },
    { id: 'deployed', label: 'Deployed to' },
  ]), []);
  const byId = new Map(states.map((g) => [g.id, g]));
  const rows = visible.map((c) => ({
    id: c.hash, when: new Date(c.time).toLocaleString(), message: c.message, author: displayAuthor(c.author_name),
    groups: c.groups.map((g) => byId.get(g)?.name ?? g).join(', '), deployed: c.deployedTo.map((g) => byId.get(g)?.name ?? g).join(', '),
  }));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Cribl · VisiCore</span>
          <Text as="h1" variant="heading-lg">Deployment Timeline</Text>
          <Text as="p" variant="body-sm-normal" color="secondary">Every config commit across your Worker Groups and Fleets, and what is deployed where.</Text>
        </div>
        <Button variant="secondary" leadingIcon={ReloadOutlined} onClick={reload}>Refresh</Button>
      </header>

      {error && <Alert appearance="danger" title="Could not load history">{error}</Alert>}

      <div className="toolbar">
        <TextField aria-label="Search commits" placeholder="Search message, hash, author" leadingSlot={<SearchOutlined size="sm" />} value={filters.text} onChange={(v) => update({ text: v })} />
        <SelectField aria-label="Group" placeholder="All groups" value={filters.group ?? null} onChange={(k) => update({ group: (k as string) || undefined })}>
          <SelectField.Item id="">All groups</SelectField.Item>
          {[false, true].map((fleet) => states.some((g) => g.isFleet === fleet) && (
            <SelectField.Section key={String(fleet)} aria-label={kindLabel(fleet)}>
              <SelectField.Header>{kindLabel(fleet)}</SelectField.Header>
              {states.filter((g) => g.isFleet === fleet).map((g) => <SelectField.Item key={g.id} id={g.id}>{g.name}</SelectField.Item>)}
            </SelectField.Section>
          ))}
        </SelectField>
        <SelectField aria-label="Author" placeholder="All authors" value={filters.author ?? null} onChange={(k) => update({ author: (k as string) || undefined })}
          items={[{ id: '', label: 'All authors' }, ...authorNames.map(([id, label]) => ({ id, label }))]} />
        <span className="toolbar-toggles">
          <ToggleButtonGroup aria-label="Time range" selectedKeys={[filters.range]} disallowEmptySelection
            onSelectionChange={(keys) => update({ range: ([...keys][0] as string) ?? '90', day: undefined })}
            items={RANGES.map((r) => ({ key: r.id, text: r.label }))} />
          <ToggleButtonGroup aria-label="View" selectedKeys={[filters.view]} disallowEmptySelection
            onSelectionChange={(keys) => update({ view: ([...keys][0] as Filters['view']) ?? 'graph' })}
            items={[{ key: 'graph', text: 'Graph' }, { key: 'table', text: 'Table' }]} />
        </span>
        {(filters.day || filters.group || filters.author || filters.area || filters.text) && (
          <Button variant="tertiary" onClick={() => update({ day: undefined, group: undefined, author: undefined, area: undefined, text: '' })}>Clear filters</Button>
        )}
      </div>

      {!data && !error && <Skeleton active paragraph={{ rows: 8 }} />}

      {data && (
        <>
          <TimeScale commits={all} from={since} to={now} rangeLabel={RANGES.find((r) => r.id === filters.range)?.long ?? ''} />
          <StatTiles stats={[
            { label: 'Commits, last 7 days', value: last7, hint: `${all.length} total`, spark, action: 'Show last 7 days', onClick: () => update({ range: '7', day: undefined }) },
            { label: 'Active authors', value: authorNames.length, action: 'See who', onClick: () => jump(authorsRef) },
            { label: 'Groups behind deploy', value: lagging, hint: `${states.length} groups & fleets`, action: lagging ? 'Focus first lagging group' : 'See drift', onClick: () => { const g = states.find((s) => s.lag !== 0); if (g) update({ group: g.id }); jump(driftRef); } },
            { label: 'Uncommitted changes', value: uncommitted, action: 'Open Worker Groups in Cribl', href: groupsListUrl() },
            { label: 'Leader version', value: data.leaderVersion ?? '—', hint: versionIssues ? `${versionIssues} group${versionIssues === 1 ? '' : 's'} not on leader version` : 'All nodes match the leader', action: 'Show version ladder', onClick: () => setLadderOpen(true) },
          ]} />

          <div className="grid">
            <Card className="col-8">
              <Card.Header><Card.Title>Commit graph</Card.Title><Card.Description>{`${visible.length} commit${visible.length === 1 ? '' : 's'}${filters.day ? ` on ${filters.day}` : ''}${filters.area ? ` touching ${filters.area}` : ''}`}</Card.Description></Card.Header>
              <Card.Content>
                {visible.length === 0
                  ? <EmptyState illustration="EmptyFolder" title="No commits match" description="Widen the time range or clear a filter." size="md" />
                  : filters.view === 'graph'
                    ? <CommitGraph commits={visible} groups={states} order={data.order} onOpen={setOpen} now={now} onFilter={(f) => update(f)} />
                    : <div className="table-wrap"><Table items={rows} columns={columns} visibleColumns={['when', 'message', 'author', 'groups', 'deployed']} density="compact" appearance="zebra" /></div>}
              </Card.Content>
            </Card>
            <div className="col-4 stack">
              <Card>
                <Card.Header><Card.Title>Change footprint</Card.Title><Card.Description>Files changed by config area</Card.Description></Card.Header>
                <Card.Content><ChangeFootprint counts={foot as Record<Area, number>} loading={footLoading} selectedArea={filters.area} onSelectArea={(a) => update({ area: a })} /></Card.Content>
              </Card>
              <Card>
                <Card.Header>
                  <Card.Title>Versions</Card.Title>
                  <Card.Description>{`${versionIssues ? `${versionIssues} group${versionIssues === 1 ? '' : 's'} off the leader version` : 'Every node on the leader version'} · ${states.filter((g) => !(versions[g.id]?.running.length)).length} with no nodes`}</Card.Description>
                  <Card.Action><Button size="sm" appearance="neutral" variant="secondary" onClick={() => setLadderOpen(true)}>Expand</Button></Card.Action>
                </Card.Header>
                <Card.Content>
                  <button type="button" className="ladder-mini" aria-label="Open the version ladder" onClick={() => setLadderOpen(true)}>
                    <VersionLadder compact groups={states.filter((g) => (versions[g.id]?.running.length ?? 0) > 0)} versions={versions} leaderVersion={data.leaderVersion} />
                  </button>
                </Card.Content>
              </Card>
              <Card>
                <Card.Header><Card.Title>Activity</Card.Title><Card.Description>Commits per day, last 20 weeks</Card.Description></Card.Header>
                <Card.Content><ActivityCalendar perDay={perDay} selectedDay={filters.day} onSelectDay={(d) => update({ day: d })} now={now} weeks={20} /></Card.Content>
              </Card>
              <Card ref={driftRef}>
                <Card.Header>
                  <Card.Title>Deploy drift</Card.Title>
                  <Card.Description>{filters.showAll ? 'All groups' : `${states.filter((g) => g.lag === 0 && g.localChanges === 0).length} in-sync hidden`}</Card.Description>
                  <Card.Action><Switch size="sm" aria-label="Show in-sync groups" checked={!!filters.showAll} onChange={(e) => update({ showAll: e.target.checked })} /></Card.Action>
                </Card.Header>
                <Card.Content><DeployDrift groups={filters.showAll ? states : states.filter((g) => g.lag !== 0 || g.localChanges > 0)} versions={versions} leaderVersion={data.leaderVersion} selectedGroup={filters.group} onSelectGroup={(g) => update({ group: g })} onChanged={reload} /></Card.Content>
              </Card>
              <Card>
                <Card.Header>
                  <Card.Title>Who touches what</Card.Title>
                  <Card.Description>Files changed per group and config area in range</Card.Description>
                  <Card.Action><Switch size="sm" aria-label="Show quiet groups" checked={!!filters.showAllTouch} onChange={(e) => update({ showAllTouch: e.target.checked })} /></Card.Action>
                </Card.Header>
                <Card.Content><TouchMap groups={states} commits={visible} files={fileCache} selectedGroup={filters.group} selectedArea={filters.area} showAll={filters.showAllTouch} onSelect={(f) => update(f)} /></Card.Content>
              </Card>
              <Card ref={authorsRef}>
                <Card.Header><Card.Title>Authors</Card.Title><Card.Description>Commits per author in range</Card.Description></Card.Header>
                <Card.Content><Authors authors={authors} me={me ? { email: me.email, name: [me.firstName, me.lastName].filter(Boolean).join(' ') || me.username } : undefined} selectedAuthor={filters.author} onSelectAuthor={(a) => update({ author: a })} /></Card.Content>
              </Card>
            </div>
          </div>
        </>
      )}

      <div className="footer-note">
        <img className="brand-mark" src={`${window.CRIBL_BASE_PATH ?? ''}/vizzy.png`} alt="" />
        <Text variant="body-xs-normal" color="tertiary">Built by VisiCore on the Cribl App framework</Text>
      </div>
      <Drawer isOpen={ladderOpen} onClose={() => setLadderOpen(false)} width={760} modal={false}
        title={<><Drawer.Heading>Version ladder</Drawer.Heading><Drawer.Description>{`Leader ${data?.leaderVersion ?? 'unknown'} is the blue line. Nodes are grouped by the version they run.`}</Drawer.Description></>}>
        <div className="drawer-body">
          <div className="drawer-actions drawer-filters">
            <ToggleButtonGroup aria-label="Kind" size="sm" selectedKeys={[filters.ladderKind ?? 'all']} disallowEmptySelection
              onSelectionChange={(keys) => update({ ladderKind: ([...keys][0] as Filters['ladderKind']) ?? 'all' })}
              items={[{ key: 'all', text: 'All' }, { key: 'wg', text: 'Worker Groups' }, { key: 'fleet', text: 'Edge Fleets' }]} />
            <label className="switch-label"><Switch size="sm" aria-label="Show groups with no nodes" checked={!!filters.showAllVersions} onChange={(e) => update({ showAllVersions: e.target.checked })} /><Text variant="body-xs-normal" color="secondary">Show groups with no nodes</Text></label>
          </div>
          {data && <VersionLadder selectedGroup={filters.group} leaderVersion={data.leaderVersion} versions={versions}
            groups={states.filter((g) => (filters.ladderKind === 'wg' ? !g.isFleet : filters.ladderKind === 'fleet' ? g.isFleet : true) && (filters.showAllVersions || (versions[g.id]?.running.length ?? 0) > 0))} />}
        </div>
      </Drawer>
      <CommitDrawer key={open?.hash ?? 'none'} commit={open} groups={states} onClose={() => setOpen(null)} onChanged={reload} />
    </div>
  );
}
