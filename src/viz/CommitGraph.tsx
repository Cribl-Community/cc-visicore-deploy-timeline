import { Fragment } from 'react';
import { Text, Tag, Pill } from '@capra/core';
import { RocketLaunch } from '@capra/icons';
import type { Commit, GroupState } from '../model';
import { relativeTime, initials, isVersionChange } from '../model';
import { slotFor } from './palette';
import { ChartTooltip } from './ChartTooltip';
import { useTip } from './useTip';

type Props = {
  commits: Commit[];
  groups: GroupState[];
  order: string[];
  onOpen: (c: Commit) => void;
  now: number;
};

const ROW = 68;
const DAY_GAP = 40;
const SPINE_X = 22;
const RAIL_W = 48;

/**
 * Single-spine timeline: one vertical line, newest at the top. Each commit is a card whose
 * colored edge and chip name the group; commits that are currently deployed get a larger
 * rocket node on the spine. Readable without knowing git.
 */
export function CommitGraph({ commits, groups, order, onOpen, now }: Props) {
  const { tip, show, hide } = useTip();
  const byId = new Map(groups.map((g) => [g.id, g]));
  const rows: { c: Commit; y: number; dayLabel?: string }[] = [];
  let y = 8;
  let lastDay = '';
  for (const c of commits) {
    const day = new Date(c.time).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    const dayLabel = day !== lastDay ? day : undefined;
    if (dayLabel) y += DAY_GAP;
    rows.push({ c, y: y + ROW / 2, dayLabel });
    lastDay = day;
    y += ROW;
  }
  const height = y + 8;
  const lanes = order.filter((gid) => byId.has(gid));

  return (
    <div className="graph">
      <div className="graph-legend">
        {lanes.map((gid) => {
          const g = byId.get(gid)!;
          return (
            <span key={gid} className={`legend-item s${slotFor(gid, order)}`}>
              <span className="swatch" />
              <Text variant="body-xs-semibold" color="secondary">{g.name}</Text>
              {g.localChanges > 0 && <Pill appearance="info" variant="muted" inline>{`${g.localChanges} uncommitted`}</Pill>}
            </span>
          );
        })}
      </div>
      <div className="graph-body" style={{ height }}>
        <svg className="graph-rails" width={RAIL_W} height={height} aria-hidden="true">
          {rows.length > 0 && <line className="spine" x1={SPINE_X} x2={SPINE_X} y1={rows[0].y} y2={rows[rows.length - 1].y} />}
          {rows.map(({ c, y }) => {
            const gid = c.groups[0];
            const deployed = c.deployedTo.length > 0;
            return (
              <g key={c.hash} className={`s${slotFor(gid, order)}`}>
                {deployed
                  ? <circle className="surface-ring fill node-deployed" cx={SPINE_X} cy={y} r={9} />
                  : <circle className="surface-ring fill" cx={SPINE_X} cy={y} r={5} />}
                {deployed && <circle cx={SPINE_X} cy={y} r={3} className="node-core" />}
              </g>
            );
          })}
        </svg>
        <ol className="graph-rows" style={{ marginLeft: RAIL_W }}>
          {rows.map(({ c, y, dayLabel }) => {
            const gid = c.groups[0];
            const deployed = c.deployedTo.length > 0;
            return (
              <Fragment key={c.hash}>
                {dayLabel && (
                  <li className="graph-day" style={{ top: y - ROW / 2 - DAY_GAP + 10 }}>
                    <Text variant="body-xs-semibold" color="tertiary">{dayLabel.toUpperCase()}</Text>
                  </li>
                )}
                <li className="graph-row" style={{ top: y - ROW / 2 + 6 }}>
                  <button
                    type="button"
                    className={`graph-card s${slotFor(gid, order)}${deployed ? ' graph-card-deployed' : ''}`}
                    onClick={() => onOpen(c)}
                    onMouseMove={(e) => show(e, <>{c.hash.slice(0, 12)} · {new Date(c.time).toLocaleString()} · click for diff</>)}
                    onMouseLeave={hide}
                  >
                    <span className="avatar" aria-hidden="true">{initials(c.author_name || '?')}</span>
                    <span className="graph-main">
                      <Text as="span" variant="body-md-semibold">{c.message || '(no message)'}</Text>
                      <span className="graph-meta">
                        <Text variant="body-xs-normal" color="secondary">{c.author_name || 'unknown'}</Text>
                        <Text variant="body-xs-normal" color="tertiary">· {relativeTime(c.time, now)}</Text>
                        <Text variant="code" color="tertiary">{c.short}</Text>
                      </span>
                    </span>
                    <span className="graph-tags">
                      {deployed && (
                        <span className="deployed-pill">
                          <RocketLaunch size="sm" />
                          <Text variant="body-xs-semibold" color="success">Live on {c.deployedTo.map((g) => byId.get(g)?.name ?? g).join(', ')}</Text>
                        </span>
                      )}
                      {isVersionChange(c) && <Tag size="sm" color="highlight">Version change</Tag>}
                      {c.groups.map((g) => (
                        <span key={g} className={`group-chip s${slotFor(g, order)}`}><span className="swatch" />{byId.get(g)?.name ?? g}</span>
                      ))}
                    </span>
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>
      <ChartTooltip tip={tip} />
    </div>
  );
}
