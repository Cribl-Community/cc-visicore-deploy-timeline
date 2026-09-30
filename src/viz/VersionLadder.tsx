import { Text, Pill } from '@capra/core';
import { versionRungs, type GroupState, type VersionState } from '../model';
import { versionStatus } from './driftStatus';
import { ChartTooltip } from './ChartTooltip';
import { useTip } from './useTip';
import { SectionLabel } from './SectionLabel';
import { GroupRow } from './GroupRow';
import { byKind } from '../model';

type Props = {
  groups: GroupState[];
  versions: Record<string, VersionState>;
  leaderVersion?: string;
  compact?: boolean;
  selectedGroup?: string;
};

const TRACK_H = 24;
const short = (v: string) => v.split('-')[0];

/**
 * Lollipop ladder: every group as a dot on an ordinal version scale, leader as the accent line.
 * Labels are HTML; only the track (line, dot, span, target arrow) is SVG, drawn at fixed pixel size.
 */
export function VersionLadder({ groups, versions, leaderVersion, compact, selectedGroup }: Props) {
  const { tip, show, hide } = useTip();
  const rungs = versionRungs(versions, leaderVersion);
  const pct = (v: string) => (rungs.length > 1 ? (rungs.indexOf(v) / (rungs.length - 1)) * 100 : 100);
  const leaderPct = leaderVersion ? pct(leaderVersion) : undefined;

  if (rungs.length === 0) return <Text variant="body-sm-normal" color="tertiary">No node versions reported yet.</Text>;

  const rungHeader = (
    <div className="ladder-rungs" aria-hidden="true">
      {rungs.map((r) => (
        <span key={r} className="ladder-rung" style={{ left: `${pct(r)}%` }}><Text variant="body-xs-semibold" color={r === leaderVersion ? 'accent' : 'tertiary'}>{short(r)}</Text></span>
      ))}
    </div>
  );

  if (compact) {
    const perRung = new Map<string, GroupState[]>();
    for (const g of groups) {
      const key = versions[g.id]?.running[0]?.version ?? '?';
      perRung.set(key, [...(perRung.get(key) ?? []), g]);
    }
    const rows = Math.max(1, ...[...perRung.values()].map((v) => v.length));
    const h = Math.min(56, 12 + rows * 9);
    return (
      <div className="ladder ladder-compact">
        <div className="ladder-track" style={{ height: h }}>
          {leaderPct !== undefined && <span className="ladder-leader" style={{ left: `${leaderPct}%` }} />}
          <span className="ladder-base" />
          {[...perRung.entries()].map(([r, gs]) => gs.map((g, i) => {
            const st = versionStatus(versions[g.id]);
            return <span key={g.id} className={`ladder-dot ${st.cls}`} style={{ left: r === '?' ? '2%' : `${pct(r)}%`, bottom: 6 + i * 9 }}
              onMouseMove={(e) => show(e, <><b>{g.name}</b> · {r === '?' ? 'no nodes reporting' : short(r)} · {st.label}</>)} onMouseLeave={hide} />;
          }))}
        </div>
        {rungHeader}
        <ChartTooltip tip={tip} />
      </div>
    );
  }

  const track = (g: GroupState) => {
    const v = versions[g.id];
    const st = versionStatus(v);
    const xs = (v?.running ?? []).map((r) => pct(r.version));
    const lo = xs.length ? Math.min(...xs) : 0;
    const hi = xs.length ? Math.max(...xs) : 0;
    return (
      <div className={`ladder-track ladder-track-row ${st.cls}`} style={{ height: TRACK_H }}
        onMouseMove={(e) => show(e, <><b>{g.name}</b> · {st.label}{v?.target ? ` · target ${short(v.target)}` : ''}<br />{g.workerCount} node{g.workerCount === 1 ? '' : 's'}</>)} onMouseLeave={hide}>
        {rungs.map((r) => <span key={r} className="ladder-grid" style={{ left: `${pct(r)}%` }} />)}
        {leaderPct !== undefined && <span className="ladder-leader" style={{ left: `${leaderPct}%` }} />}
        {xs.length > 0 && <span className="ladder-lead" style={{ width: `${hi}%` }} />}
        {xs.length > 1 && <span className="ladder-span" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />}
        {xs.length === 0
          ? <span className="ladder-dot ladder-dot-hollow" style={{ left: 0 }} />
          : xs.map((p, i) => <span key={i} className="ladder-dot" style={{ left: `${p}%` }} />)}
        {v?.target && v.running[0] && v.target !== v.running[0].version && <span className="ladder-target" style={{ left: `${pct(v.target)}%` }} title={`Upgrade target ${short(v.target)}`} />}
      </div>
    );
  };

  const trailing = (g: GroupState) => {
    const v = versions[g.id];
    const st = versionStatus(v);
    if (!v) return null;
    return (
      <>
        <Pill appearance={st.pill} variant="muted" inline>{st.label}</Pill>
        {v.incompatible > 0 && <Pill appearance="danger" variant="muted" inline>{`${v.incompatible} incompatible`}</Pill>}
      </>
    );
  };

  return (
    <div className="ladder">
      <div className="ladder-head"><span />{rungHeader}<span /></div>
      {byKind(groups).map(({ isFleet, items }) => (
        <div key={String(isFleet)} className="group-section">
          <SectionLabel isFleet={isFleet} count={items.length} />
          {items.map((g) => (
            <GroupRow key={g.id} group={g} selected={selectedGroup === g.id} dim={!!selectedGroup && selectedGroup !== g.id} trailing={trailing(g)}>
              {track(g)}
            </GroupRow>
          ))}
        </div>
      ))}
      <ChartTooltip tip={tip} />
    </div>
  );
}
