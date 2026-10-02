import test from 'node:test';
import assert from 'node:assert/strict';
import { pickBucket, bucketCounts, tickPlan, gapLabel, touchCounts, versionRungs, mergeCommits, groupStates, dailySeries, authorCounts, footprint, areaOf, initials, parseGitDate } from './model.ts';

const e = (hash: string, date: string, author = 'Ada Lovelace') => ({ hash, date, message: `m-${hash}`, author_name: author, author_email: `${author}@x`.toLowerCase() });
const logs = {
  default: [e('bbb2222', '2026-09-30 10:00:00 +0000'), e('aaa1111', '2026-09-29 10:00:00 +0000')],
  edge01: [e('bbb2222', '2026-09-30 10:00:00 +0000'), e('ccc3333', '2026-09-28 10:00:00 +0000', 'Grace Hopper')],
};
const groups = [
  { id: 'default', configVersion: 'aaa1111', git: { localChanges: 2 } },
  { id: 'edge01', isFleet: true, configVersion: 'bbb2222' },
];

test('mergeCommits dedupes by hash and tags every group', () => {
  const cs = mergeCommits(logs, groups);
  assert.deepEqual(cs.map((c) => c.hash), ['bbb2222', 'aaa1111', 'ccc3333']);
  assert.deepEqual(cs[0].groups, ['default', 'edge01']);
  assert.deepEqual(cs[0].deployedTo, ['edge01']);
  assert.deepEqual(cs[1].deployedTo, ['default']);
});

test('groupStates computes lag and local changes', () => {
  const gs = groupStates(groups, logs);
  assert.equal(gs[0].lag, 1);
  assert.equal(gs[0].localChanges, 2);
  assert.equal(gs[1].lag, 0);
  assert.equal(gs[1].type, 'edge');
});

test('dailySeries zero-fills and counts', () => {
  const cs = mergeCommits(logs, groups);
  const s = dailySeries(cs, 3, parseGitDate('2026-09-30 12:00:00 +0000'));
  assert.deepEqual(s.map((d) => d.count), [1, 1, 1]);
});

test('authorCounts folds the tail into Other', () => {
  const cs = mergeCommits(logs, groups);
  const a = authorCounts(cs, 1);
  assert.equal(a[0].name, 'Ada Lovelace');
  assert.equal(a[0].count, 2);
  assert.equal(a[1].other, true);
  assert.equal(a[1].count, 1);
});

test('authorCounts keys by raw author_name, not the display text, so selection matches commit filtering', () => {
  const clientLogs = { default: [e('ccc0000', '2026-09-30 10:00:00 +0000', 'abc1234567890@clients')] };
  const a = authorCounts(mergeCommits(clientLogs, []));
  assert.equal(a[0].key, 'abc1234567890@clients');
  assert.equal(a[0].name, 'API client · abc1234…');
});

test('footprint buckets config areas', () => {
  const f = footprint([
    'groups/default/local/cribl/pipelines/syslog/conf.yml',
    'groups/default/local/cribl/routes.yml',
    'groups/default/local/cribl/inputs.yml',
    'groups/default/local/cribl/outputs.yml',
    'groups/default/default/packs/x/route.yml',
    'groups/default/data/lookups/a.csv',
    'groups/default/local/cribl/cribl.yml',
  ]);
  assert.deepEqual(f, { pipelines: 1, routes: 1, sources: 1, destinations: 1, packs: 1, lookups: 1, other: 1 });
  assert.equal(areaOf('X/PIPELINES/y'), 'pipelines');
});

test('sameHash handles fleet bundle suffixes', async () => {
  const { sameHash } = await import('./model.ts');
  assert.equal(sameHash('9754e5f3f7aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '9754e5f-45062c643e42da5bcab5a54eb97c19f7a0aa88f6'), true);
  assert.equal(sameHash('9754e5f3f7aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0d58cbe-45062c64'), false);
});

test('initials', () => {
  assert.equal(initials('Ada Lovelace'), 'AL');
  assert.equal(initials('admin'), 'AD');
  assert.equal(initials('jacob.evans'), 'JE');
});

test('versionStates compares running nodes to the leader', async () => {
  const { versionStates, compareVersions, isVersionChange } = await import('./model.ts');
  const vs = versionStates(
    [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    [
      { group: 'a', info: { cribl: { version: '4.20.1' } } },
      { group: 'b', info: { cribl: { version: '4.19.2' } } },
      { group: 'b', info: { cribl: { version: '4.20.1' } } },
      { group: 'c', disconnected: true, info: { cribl: { version: '4.1.0' } } },
    ],
    '4.20.1',
  );
  assert.equal(vs.a.status, 'match');
  assert.equal(vs.b.status, 'mixed');
  assert.equal(vs.c.status, 'unknown');
  assert.equal(compareVersions('4.20.1', '4.9.9'), 1);
  assert.equal(isVersionChange({ message: 'Upgrade to 4.20.1' }), true);
  assert.equal(isVersionChange({ message: 'Parsing for AWS events' }), false);
});

test('areaOf handles group-prefixed and pack paths', () => {
  assert.equal(areaOf('groups/default/local/cribl/pipelines/http/conf.yml'), 'pipelines');
  assert.equal(areaOf('groups/default/local/cribl/routes.yml'), 'routes');
  assert.equal(areaOf('groups/default/default/MyPack/local/cribl/pipelines/x/conf.yml'), 'pipelines');
  assert.equal(areaOf('groups/default/default/MyPack/README.md'), 'packs');
  assert.equal(areaOf('groups/default/local/cribl/breakers.yml'), 'other');
});

test('touchCounts attributes group-prefixed paths and sends shared files to the leader row', () => {
  const commits = [{ hash: 'a', groups: ['g1', 'g2'] }, { hash: 'b', groups: ['g2'] }] as never;
  const files = { a: ['groups/g1/local/cribl/pipelines/p/conf.yml', 'local/cribl/routes.yml'], b: ['groups/g2/local/cribl/inputs.yml'] };
  const c = touchCounts(commits, files);
  assert.equal(c.g1.pipelines, 1); assert.equal(c.__leader__.routes, 1); assert.equal(c.g2.sources, 1); assert.equal(c.g1.routes, 0);
});

test('versionRungs sorts distinct versions oldest first', () => {
  const v = { a: { running: [{ version: '4.19.3', count: 2 }], incompatible: 0, status: 'behind' }, b: { running: [], target: '4.18.2', incompatible: 0, status: 'unknown' } } as never;
  assert.deepEqual(versionRungs(v, '4.20.1-590ec085'), ['4.18.2', '4.19.3', '4.20.1-590ec085']);
});

test('time scale helpers', () => {
  assert.equal(pickBucket(60 * 60_000), 60_000);
  assert.equal(pickBucket(365 * 86_400_000), 7 * 86_400_000);
  const b = bucketCounts([{ time: 1_000 }, { time: 61_000 }, { time: 200_000 }], 0, 180_000, 60_000);
  assert.deepEqual(b.map((x) => x.count), [1, 1, 0]);
  assert.equal(tickPlan(0, 3_600_000).step, 15 * 60_000);
  assert.equal(gapLabel(2 * 3_600_000 + 14 * 60_000), '2h 14m');
  assert.equal(gapLabel(9 * 86_400_000), '9d');
});
