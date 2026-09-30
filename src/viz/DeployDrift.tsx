import { Text, Pill } from '@capra/core';
import type { GroupState, VersionState } from '../model';
import { driftStatus } from './driftStatus';
import { CommitPendingButton } from '../actions';
import { ChartTooltip } from './ChartTooltip';
import { useTip } from './useTip';

type Props = {
  groups: GroupState[];
  versions?: Record<string, VersionState>;
  leaderVersion?: string;
  order: string[];
  onChanged: () => void;
  selectedGroup?: string;
  onSelectGroup: (gid: string | undefined) => void;
};

const BAR = 18;
const ROW = 40;
const LABEL_W = 150;

function versionPill(v: VersionState | undefined, leader?: string) {
  if (!v || v.running.length === 0) return v?.target ? <Pill appearance="default" variant="muted" inline>{`target ${v.target}`}</Pill> : null;
  const label = v.running.length > 1
    ? `mixed: ${v.running.map((r) => `${r.version}×${r.count}`).join(', ')}`
    : `v${v.running[0].version}${v.status === 'behind' ? ` (leader ${leader})` : ''}${v.target && v.target !== v.running[0].version ? ` → ${v.target}` : ''}`;
  const appearance = v.status === 'match' ? 'success' : v.status === 'mixed' || v.status === 'behind' ? 'warning' : v.status === 'ahead' ? 'highlight' : 'default';
  return <Pill appearance={appearance} variant="muted" inline>{label}</Pill>;
}

/** Horizontal bars: commits ahead of the deployed version per group. Status color + icon + label. */
export function DeployDrift({ groups, versions = {}, leaderVersion, order, onChanged, selectedGroup, onSelectGroup }: Props) {
  const { tip, show, hide } = useTip();
  const max = Math.max(1, ...groups.map((g) => Math.max(0, g.lag)));
  const width = 420;
  const plotW = width - LABEL_W - 60;
  const height = groups.length * ROW + 8;
  const sorted = [...groups].sort((a, b) => b.lag - a.lag || order.indexOf(a.id) - order.indexOf(b.id));
  return (
    <div className="drift">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Commits ahead of deployed version per group">
        {[0.5, 1].map((f) => (
          <line key={f} className="grid-line" x1={LABEL_W + f * plotW} x2={LABEL_W + f * plotW} y1={0} y2={height - 8} />
        ))}
        {sorted.map((g, i) => {
          const y = i * ROW + 4;
          const st = driftStatus(g);
          const w = g.lag > 0 ? Math.max(6, (g.lag / max) * plotW) : 0;
          const sel = selectedGroup === g.id;
          const title = `${g.name}`;
          return (
            <g key={g.id} className={`${st.cls}${selectedGroup && !sel ? ' deemph' : ''}`}>
              <text className="value-text-strong" x={0} y={y + BAR / 2 + 4}>{title.length > 20 ? title.slice(0, 19) + '…' : title}</text>
              <rect className="hit" x={LABEL_W - 4} y={y - 4} width={plotW + 60} height={ROW - 4} tabIndex={0}
                onClick={() => onSelectGroup(sel ? undefined : g.id)}
                onKeyDown={(e) => e.key === 'Enter' && onSelectGroup(sel ? undefined : g.id)}
                onMouseMove={(e) => show(e, <><b>{g.name}</b> · {st.label}{g.localChanges ? ` · ${g.localChanges} uncommitted` : ''}<br />{g.workerCount} worker{g.workerCount === 1 ? '' : 's'} · {g.isFleet ? 'Fleet' : 'Worker Group'}</>)}
                onMouseLeave={hide} />
              {w > 0
                ? <path className="fill" d={`M${LABEL_W},${y} h${w - 4} a4,4 0 0 1 4,4 v${BAR - 8} a4,4 0 0 1 -4,4 h${-(w - 4)} z`} />
                : <rect className="fill" x={LABEL_W} y={y + BAR / 2 - 1} width={4} height={2} />}
              <text className="value-text" x={LABEL_W + w + 8} y={y + BAR / 2 + 4}>{g.lag < 0 ? '—' : g.lag}</text>
            </g>
          );
        })}
      </svg>
      <ul className="drift-legend">
        {sorted.map((g) => {
          const st = driftStatus(g);
          return (
            <li key={g.id} className={st.cls}>
              <span className="swatch" />
              <st.Icon size="sm" />
              <Text variant="body-xs-normal" color="secondary">{g.name}: {st.label}</Text>
              {g.localChanges > 0 && <Pill appearance="info" variant="muted" inline>{`${g.localChanges} uncommitted`}</Pill>}
              {versionPill(versions[g.id], leaderVersion)}
              <CommitPendingButton group={g} onDone={onChanged} />
            </li>
          );
        })}
      </ul>
      <ChartTooltip tip={tip} />
    </div>
  );
}
