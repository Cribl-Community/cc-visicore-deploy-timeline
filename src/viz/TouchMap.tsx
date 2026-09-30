import { Text } from '@capra/core';
import { AREAS, touchCounts, LEADER_ROW, type Area, type Commit, type GroupState } from '../model';
import { heatStep } from './palette';
import { ChartTooltip } from './ChartTooltip';
import { useTip } from './useTip';
import { SectionLabel } from './SectionLabel';
import { GroupRow } from './GroupRow';
import { byKind } from '../model';
import { HeatLegend } from './HeatLegend';

const AREA_LABEL: Record<Area, string> = {
  pipelines: 'Pipelines', routes: 'Routes', sources: 'Sources', destinations: 'Destinations',
  packs: 'Packs', lookups: 'Lookups', other: 'Other',
};

type Props = {
  groups: GroupState[];
  commits: Commit[];
  files: Record<string, string[]>;
  selectedGroup?: string;
  selectedArea?: Area;
  showAll?: boolean;
  onSelect: (f: { group?: string; area?: Area }) => void;
};

/** Heatmap: groups (Worker Groups, Edge Fleets, then a Leader row for shared files) × config area. */
export function TouchMap({ groups, commits, files, selectedGroup, selectedArea, showAll, onSelect }: Props) {
  const { tip, show, hide } = useTip();
  const counts = touchCounts(commits, files);
  const active = groups.filter((g) => showAll || counts[g.id]);
  const leader = counts[LEADER_ROW];
  const all = [...active.flatMap((g) => AREAS.map((a) => counts[g.id]?.[a] ?? 0)), ...(leader ? AREAS.map((a) => leader[a]) : [])];
  const max = Math.max(1, ...all);
  const hidden = groups.length - active.length;

  if (active.length === 0 && !leader) return <Text variant="body-sm-normal" color="tertiary">No changed files in range.</Text>;

  const cells = (rowId: string, name: string, row: Record<Area, number> | undefined) => (
    <div className="heat-cells">
      {AREAS.map((a) => {
        const n = row?.[a] ?? 0;
        const sel = selectedGroup === rowId && selectedArea === a;
        return (
          <button key={a} type="button" className={`heat-cell h${heatStep(n, max)}${sel ? ' is-selected' : ''}`} aria-label={`${name}, ${AREA_LABEL[a]}: ${n} files`}
            onClick={() => onSelect(sel ? { group: undefined, area: undefined } : { group: rowId === LEADER_ROW ? undefined : rowId, area: a })}
            onMouseMove={(e) => show(e, <><b>{name}</b> · {AREA_LABEL[a]}<br />{n} file{n === 1 ? '' : 's'} changed</>)} onMouseLeave={hide} />
        );
      })}
    </div>
  );

  return (
    <div className="touchmap">
      <div className="heat-grid">
        <div className="heat-header">
          <span />
          {AREAS.map((a) => <Text key={a} variant="body-xs-semibold" color="tertiary" FORCE__className={`heat-col${selectedArea === a ? ' is-selected' : ''}`}>{AREA_LABEL[a]}</Text>)}
        </div>
        {byKind(active).map(({ isFleet, items }) => (
          <div key={String(isFleet)} className="group-section">
            <SectionLabel isFleet={isFleet} count={items.length} />
            {items.map((g) => (
              <GroupRow key={g.id} group={g} selected={selectedGroup === g.id} dim={!!selectedGroup && selectedGroup !== g.id}>
                {cells(g.id, g.name, counts[g.id])}
              </GroupRow>
            ))}
          </div>
        ))}
        {leader && (
          <div className="group-section">
            <div className="section-row"><Text variant="body-xs-semibold" color="tertiary" FORCE__className="section-text">LEADER · SHARED FILES</Text></div>
            <div className="group-row">
              <span className="group-row-name"><Text variant="body-sm-semibold">Leader</Text></span>
              <div className="group-row-mark">{cells(LEADER_ROW, 'Leader (shared)', leader)}</div>
            </div>
          </div>
        )}
      </div>
      <div className="viz-foot">
        <HeatLegend max={max} unit="files" />
        {hidden > 0 && !showAll && <Text variant="body-xs-normal" color="tertiary">{`${hidden} quiet group${hidden === 1 ? '' : 's'} hidden`}</Text>}
      </div>
      <ChartTooltip tip={tip} />
    </div>
  );
}
