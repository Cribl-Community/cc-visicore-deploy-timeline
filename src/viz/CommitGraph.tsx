import { Fragment } from 'react';
import { Text, Tag, Pill } from '@capra/core';
import { RocketLaunch } from '@capra/icons';
import type { Commit, GroupState } from '../model';
import { relativeTime, initials, isVersionChange, displayAuthor, kindLabel, gapLabel, fmtDateTime } from '../model';
import { slotFor } from './palette';
import { GroupKindIcon } from './GroupKind';

type Props = {
  commits: Commit[];
  groups: GroupState[];
  order: string[];
  onOpen: (c: Commit) => void;
  onFilter: (f: { group?: string; author?: string }) => void;
  now: number;
};

const MAX_CHIPS = 3;

/**
 * Single-spine timeline, newest first. Each commit is a content-sized card beside a vertical rail;
 * deployed commits get a larger rocket node. The gap to the previous (older) commit is printed on
 * the rail so the distance between changes is readable without a chart.
 */
export function CommitGraph({ commits, groups, order, onOpen, onFilter, now }: Props) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const byId = new Map(groups.map((g) => [g.id, g]));
  const lanes = order.filter((gid) => byId.has(gid));
  const dayOf = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="graph">
      <div className="graph-legend">
        {[false, true].map((fleet) => {
          const ids = lanes.filter((gid) => byId.get(gid)!.isFleet === fleet);
          if (ids.length === 0) return null;
          return (
            <div key={String(fleet)} className="legend-group">
              <span className="legend-kind"><GroupKindIcon isFleet={fleet} /><Text variant="body-xs-semibold" color="tertiary">{kindLabel(fleet).toUpperCase()}</Text></span>
              {ids.map((gid) => {
                const g = byId.get(gid)!;
                return (
                  <button key={gid} type="button" className={`legend-item linkish s${slotFor(gid, order)}`} onClick={() => onFilter({ group: gid })} title="Filter to this group">
                    <span className="swatch" />
                    <Text variant="body-xs-semibold" color="secondary">{g.name}</Text>
                    {g.localChanges > 0 && <Pill appearance="info" variant="muted" inline>{`${g.localChanges} uncommitted`}</Pill>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <ol className="spine-list">
        {commits.map((c, i) => {
          const day = dayOf(c.time);
          const dayLabel = i === 0 || day !== dayOf(commits[i - 1].time) ? day : undefined;
          const gid = c.groups[0];
          const deployed = c.deployedTo.length > 0;
          const older = commits[i + 1];
          return (
            <Fragment key={c.hash}>
              {dayLabel && <li className="spine-day"><Text variant="body-xs-semibold" color="tertiary">{dayLabel.toUpperCase()}</Text></li>}
              <li className={`spine-item s${slotFor(gid, order)}${deployed ? ' is-deployed' : ''}`}>
                <span className="spine-node" aria-hidden="true">{deployed && <RocketLaunch size="xs" />}</span>
                <div role="button" tabIndex={0} className={`graph-card${deployed ? ' graph-card-deployed' : ''}`}
                  onClick={() => onOpen(c)} onKeyDown={(e) => e.key === 'Enter' && onOpen(c)} title="Open diff and actions">
                  <span className="avatar" aria-hidden="true">{initials(c.author_name || '?')}</span>
                  <span className="graph-main">
                    <Text as="span" variant="body-md-semibold" FORCE__className="graph-msg">{c.message || '(no message)'}</Text>
                    <span className="graph-meta">
                      <button type="button" className="linkish" onClick={(e) => { stop(e); onFilter({ author: c.author_name }); }} title="Filter by this author"><Text variant="body-xs-normal" color="secondary">{displayAuthor(c.author_name)}</Text></button>
                      <Text variant="body-xs-normal" color="tertiary">· {fmtDateTime(c.time)} · {relativeTime(c.time, now)}</Text>
                      <Text variant="code" color="tertiary">{c.short}</Text>
                    </span>
                  </span>
                  <span className="graph-tags">
                    {deployed && (
                      <span className="deployed-pill" role="button" tabIndex={0} title="Filter to this group" onClick={(e) => { stop(e); onFilter({ group: c.deployedTo[0] }); }} onKeyDown={(e) => { if (e.key === 'Enter') { stop(e); onFilter({ group: c.deployedTo[0] }); } }}>
                        <RocketLaunch size="sm" />
                        <Text variant="body-xs-semibold" color="success">Live on {c.deployedTo.map((g) => byId.get(g)?.name ?? g).join(', ')}</Text>
                      </span>
                    )}
                    {isVersionChange(c) && <Tag size="sm" color="highlight">Version change</Tag>}
                    {c.groups.slice(0, MAX_CHIPS).map((g) => (
                      <button key={g} type="button" className={`group-chip s${slotFor(g, order)}`} title="Filter to this group" onClick={(e) => { stop(e); onFilter({ group: g }); }}><span className="swatch" /><GroupKindIcon isFleet={!!byId.get(g)?.isFleet} />{byId.get(g)?.name ?? g}</button>
                    ))}
                    {c.groups.length > MAX_CHIPS && (
                      <span className="group-chip" title={c.groups.slice(MAX_CHIPS).map((g) => byId.get(g)?.name ?? g).join(', ')}>{`+${c.groups.length - MAX_CHIPS} more`}</span>
                    )}
                  </span>
                </div>
                {older && <span className="spine-gap"><Text variant="body-xs-normal" color="tertiary">{`+${gapLabel(c.time - older.time)}`}</Text></span>}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
