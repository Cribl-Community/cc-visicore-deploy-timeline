import { Text } from '@capra/core';
import { dayKey } from '../model';
import { heatStep } from './palette';
import { ChartTooltip } from './ChartTooltip';
import { useTip } from './useTip';

type Props = {
  perDay: Map<string, number>;
  weeks?: number;
  selectedDay?: string;
  onSelectDay: (day: string | undefined) => void;
  now: number;
};

const CELL = 12;
const GAP = 3;
const DOW = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

/** Contribution-calendar grid. Sequential one-hue ramp; zero cells recede to the surface. */
export function ActivityCalendar({ perDay, weeks = 26, selectedDay, onSelectDay, now }: Props) {
  const { tip, show, hide } = useTip();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const endDow = today.getUTCDay();
  const start = new Date(today.getTime() - (weeks * 7 - 1 + endDow - 6) * 86_400_000);
  const days: { key: string; count: number; col: number; row: number; date: Date }[] = [];
  let max = 0;
  for (let i = 0; ; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    if (d > today) break;
    const key = dayKey(d.getTime());
    const count = perDay.get(key) ?? 0;
    max = Math.max(max, count);
    days.push({ key, count, col: Math.floor(i / 7), row: d.getUTCDay(), date: d });
  }
  const cols = days.length ? days[days.length - 1].col + 1 : weeks;
  const width = 32 + cols * (CELL + GAP);
  const height = 20 + 7 * (CELL + GAP);
  const months: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (const d of days) {
    const m = d.date.getUTCMonth();
    if (d.row === 0 && m !== lastMonth) {
      months.push({ col: d.col, label: d.date.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' }) });
      lastMonth = m;
    }
  }
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <div className="calendar">
      <svg width={width} height={height} role="img" aria-label="Commits per day">
        {months.map((m) => (
          <text key={m.col} className="axis-text" x={32 + m.col * (CELL + GAP)} y={10}>{m.label}</text>
        ))}
        {DOW.map((l, i) => l && (
          <text key={i} className="axis-text" x={0} y={20 + i * (CELL + GAP) + CELL - 2}>{l}</text>
        ))}
        {days.map((d) => {
          const x = 32 + d.col * (CELL + GAP);
          const y = 20 + d.row * (CELL + GAP);
          const sel = selectedDay === d.key;
          return (
            <rect
              key={d.key}
              className={`h${heatStep(d.count, max)} cal-cell${sel ? ' cal-sel' : ''}`}
              x={x} y={y} width={CELL} height={CELL} rx={2}
              tabIndex={0}
              onMouseMove={(e) => show(e, <><b>{d.count} commit{d.count === 1 ? '' : 's'}</b> · {fmt(d.date)}</>)}
              onMouseLeave={hide}
              onClick={() => onSelectDay(sel ? undefined : d.key)}
              onKeyDown={(e) => e.key === 'Enter' && onSelectDay(sel ? undefined : d.key)}
            />
          );
        })}
      </svg>
      <div className="legend-row">
        <Text variant="body-xs-normal" color="tertiary">Less</Text>
        <svg width={5 * (CELL + GAP)} height={CELL} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((s) => <rect key={s} className={`h${s}`} x={s * (CELL + GAP)} y={0} width={CELL} height={CELL} rx={2} />)}
        </svg>
        <Text variant="body-xs-normal" color="tertiary">More</Text>
      </div>
      <ChartTooltip tip={tip} />
    </div>
  );
}
