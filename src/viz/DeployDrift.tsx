import { Text, Pill } from '@capra/core';
import type { GroupState, VersionState } from '../model';
import { driftStatus, versionStatus } from './driftStatus';
import { CommitPendingButton } from '../actions';
import { ChartTooltip } from './ChartTooltip';
import { useTip } from './useTip';
import { SectionLabel } from './SectionLabel';
import { GroupRow } from './GroupRow';
import { byKind } from '../model';

type Props = {
  groups: GroupState[];
  versions?: Record<string, VersionState>;
  leaderVersion?: string;
  onChanged: () => void;
  selectedGroup?: string;
  onSelectGroup: (gid: string | undefined) => void;
};

/** One row per group: a bar for commits ahead of the deployed version, status label, pills, and the commit action. */
export function DeployDrift({ groups, versions = {}, onChanged, selectedGroup, onSelectGroup }: Props) {
  const { tip, show, hide } = useTip();
  const max = Math.max(1, ...groups.map((g) => Math.max(0, g.lag)));
  const sorted = [...groups].sort((a, b) => b.lag - a.lag || a.name.localeCompare(b.name));

  if (groups.length === 0) return <Text variant="body-sm-normal" color="tertiary">Every group is in sync with its deployed version.</Text>;

  return (
    <div className="drift">
      {byKind(sorted).map(({ isFleet, items }) => (
        <div key={String(isFleet)} className="group-section">
          <SectionLabel isFleet={isFleet} count={items.length} />
          {items.map((g) => {
            const st = driftStatus(g);
            const vs = versionStatus(versions[g.id]);
            const sel = selectedGroup === g.id;
            const w = g.lag > 0 ? Math.max(4, (g.lag / max) * 100) : 0;
            return (
              <GroupRow key={g.id} group={g} selected={sel} dim={!!selectedGroup && !sel}
                onClick={() => onSelectGroup(sel ? undefined : g.id)}
                onMouseMove={(e) => show(e, <><b>{g.name}</b> · {st.label}{g.localChanges ? ` · ${g.localChanges} uncommitted` : ''}<br />{g.workerCount} node{g.workerCount === 1 ? '' : 's'} · {vs.label}</>)}
                onMouseLeave={hide}
                trailing={<>
                  {g.localChanges > 0 && <Pill appearance="info" variant="muted" inline>{`${g.localChanges} uncommitted`}</Pill>}
                  {versions[g.id] && vs.cls !== 'st-success' && <Pill appearance={vs.pill} variant="muted" inline>{vs.label}</Pill>}
                  <CommitPendingButton group={g} onDone={onChanged} />
                </>}>
                <div className={`drift-bar ${st.cls}`} title="Filter the timeline to this group">
                  <span className="drift-fill" style={{ width: `${w}%` }} />
                  <span className="drift-value"><st.Icon size="xs" /><Text variant="body-xs-semibold">{st.label}</Text></span>
                </div>
              </GroupRow>
            );
          })}
        </div>
      ))}
      <ChartTooltip tip={tip} />
    </div>
  );
}
