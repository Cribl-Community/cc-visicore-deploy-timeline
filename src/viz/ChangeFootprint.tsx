import { Text } from '@capra/core';
import { AREAS, type Area } from '../model';
import { ChartTooltip } from './ChartTooltip';
import { useTip } from './useTip';

const LABEL: Record<Area, string> = {
  pipelines: 'Pipelines', routes: 'Routes', sources: 'Sources', destinations: 'Destinations',
  packs: 'Packs', lookups: 'Lookups', other: 'Other',
};

/** Part-to-whole stacked bar of changed files by config area. Fixed slot order, 2px surface gaps. */
type Props = { counts: Record<Area, number>; loading?: boolean; selectedArea?: Area; onSelectArea: (a: Area | undefined) => void };

export function ChangeFootprint({ counts, loading, selectedArea, onSelectArea }: Props) {
  const { tip, show, hide } = useTip();
  const total = AREAS.reduce((n, a) => n + counts[a], 0);
  const width = 400;
  const H = 22;
  const segs = AREAS.reduce<{ a: Area; w: number; x: number; slot: number }[]>((acc, a, i) => {
    const w = total ? (counts[a] / total) * width : 0;
    const x = acc.length ? acc[acc.length - 1].x + acc[acc.length - 1].w : 0;
    if (w > 0) acc.push({ a, w, x, slot: i === AREAS.length - 1 ? 0 : i + 1 });
    return acc;
  }, []);
  const biggest = segs.reduce((m, s) => (s.w > (m?.w ?? 0) ? s : m), segs[0]);
  return (
    <div className="footprint">
      <svg width="100%" viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Changed files by config area">
        {segs.length === 0 && <rect className="h0" x={0} y={0} width={width} height={H} rx={4} />}
        {segs.map((s, i) => (
          <g key={s.a} className={`s${s.slot}`}>
            <rect className="fill" x={s.x + (i ? 1 : 0)} y={0} width={Math.max(0, s.w - (i ? 1 : 0) - (i < segs.length - 1 ? 1 : 0))} height={H} rx={i === 0 || i === segs.length - 1 ? 4 : 0} />
            <rect className="hit" x={s.x} y={0} width={s.w} height={H} tabIndex={0}
              onClick={() => onSelectArea(selectedArea === s.a ? undefined : s.a)}
              onKeyDown={(e) => e.key === 'Enter' && onSelectArea(selectedArea === s.a ? undefined : s.a)}
              onMouseMove={(e) => show(e, <><b>{LABEL[s.a]}</b> · {counts[s.a]} file{counts[s.a] === 1 ? '' : 's'} · {Math.round((counts[s.a] / total) * 100)}%</>)}
              onMouseLeave={hide} />
            {biggest === s && s.w > 60 && (
              <text className="value-text-onfill" x={s.x + 8} y={H / 2 + 4}>{LABEL[s.a]} {Math.round((counts[s.a] / total) * 100)}%</text>
            )}
          </g>
        ))}
      </svg>
      <ul className="legend-list">
        {AREAS.map((a, i) => counts[a] > 0 && (
          <li key={a} className={`s${i === AREAS.length - 1 ? 0 : i + 1}${selectedArea && selectedArea !== a ? ' deemph' : ''}`}>
            <button type="button" className="linkish" title="Filter commits touching this area" onClick={() => onSelectArea(selectedArea === a ? undefined : a)}><span className="swatch" /></button>
            <Text variant="body-xs-normal" color="secondary">{LABEL[a]}</Text>
            <Text variant="body-xs-semibold">{counts[a]}</Text>
          </li>
        ))}
        {total === 0 && <Text variant="body-xs-normal" color="tertiary">{loading ? 'Loading file lists…' : 'No file data in range'}</Text>}
      </ul>
      <ChartTooltip tip={tip} />
    </div>
  );
}
