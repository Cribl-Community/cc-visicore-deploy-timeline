import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Text } from '@capra/core';
import type { Commit } from '../model';
import { bucketCounts, isVersionChange, pickBucket, tickPlan, fmtDateTime } from '../model';
import { ChartTooltip } from './ChartTooltip';
import { useTip } from './useTip';

type Props = {
  commits: Commit[]; // every commit; the global range decides what is in view
  from: number; // global time-range start (toolbar selector)
  to: number;
  rangeLabel: string;
};

const PLOT_H = 64;
const LANE_H = 14; // commit ticks + deploy markers
const AXIS_H = 22;
const H = PLOT_H + LANE_H + AXIS_H;
const MIN_TICK_PX = 84;

/**
 * Real time axis for the commits in the global range. Drag on the plot to zoom this view down
 * to the minute; double-click or Reset to return to the global range. Zooming here changes
 * nothing else on the page; the toolbar time range is the only global time filter.
 */
export function TimeScale({ commits, from, to, rangeLabel }: Props) {
  const { tip, show, hide } = useTip();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [zoomState, setZoomState] = useState<{ base: string; from: number; to: number } | null>(null);
  const base = `${from}:${to}`;
  const zoom = zoomState && zoomState.base === base ? zoomState : null;
  const setZoom = (z: { from: number; to: number } | null) => setZoomState(z && { ...z, base });
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver((es) => setWidth(Math.max(320, Math.floor(es[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const f = zoom?.from ?? from;
  const t = zoom?.to ?? to;
  const span = Math.max(60_000, t - f);
  const bucket = pickBucket(span);
  const bins = useMemo(() => bucketCounts(commits, f, t, bucket), [commits, f, t, bucket]);
  const max = Math.max(1, ...bins.map((b) => b.count));
  const x = (time: number) => ((time - f) / span) * width;
  const timeAt = (px: number) => f + (px / width) * span;
  const plan = tickPlan(f, t);
  const step = plan.step * Math.max(1, Math.ceil(MIN_TICK_PX / ((plan.step / span) * width)));
  const ticks: number[] = [];
  for (let tt = Math.ceil(f / step) * step; tt <= t; tt += step) ticks.push(tt);
  const inRange = commits.filter((c) => c.time >= f && c.time <= t);
  const deployed = inRange.filter((c) => c.deployedTo.length > 0);
  const versionChanges = inRange.filter((c) => isVersionChange(c));
  const bucketLabel = bucket >= 7 * 86_400_000 ? '1-week' : bucket >= 86_400_000 ? '1-day' : bucket >= 3_600_000 ? `${bucket / 3_600_000}-hour` : `${bucket / 60_000}-minute`;

  const px = (e: React.MouseEvent | MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(width, Math.max(0, e.clientX - r.left));
  };
  const onDown = (e: React.MouseEvent) => { if (e.button !== 0) return; const p = px(e); setDrag({ x0: p, x1: p }); };
  useEffect(() => {
    if (!drag) return;
    const move = (e: MouseEvent) => setDrag((d) => d && { ...d, x1: px(e) });
    const up = (e: MouseEvent) => {
      const d = drag; setDrag(null);
      if (!d) return;
      const a = Math.min(d.x0, px(e)), b = Math.max(d.x0, px(e));
      if (b - a < 4) return;
      setZoom({ from: Math.round(timeAt(a)), to: Math.round(timeAt(b)) });
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  });

  const baseline = PLOT_H;
  const barW = Math.max(2, (bucket / span) * width - 1);

  return (
    <div className="timescale">
      <div className="timescale-head">
        <div className="timescale-title">
          <Text variant="body-sm-semibold">{zoom ? `${fmtDateTime(f)} → ${fmtDateTime(t)}` : rangeLabel}</Text>
          <Text variant="body-xs-normal" color="tertiary">{`${inRange.length} commit${inRange.length === 1 ? '' : 's'} · ${bucketLabel} buckets · drag to zoom this view`}</Text>
        </div>
        <div className="timescale-controls">
          <span className="ts-legend"><span className="ts-legend-deploy" /><Text variant="body-xs-normal" color="tertiary">live commit</Text></span>
          <span className="ts-legend"><span className="ts-legend-version" /><Text variant="body-xs-normal" color="tertiary">version change</Text></span>
          {zoom && <Button variant="tertiary" size="sm" onClick={() => setZoom(null)}>Reset zoom</Button>}
        </div>
      </div>
      <div ref={ref} className={`timescale-plot${drag ? ' is-dragging' : ''}`} onMouseDown={onDown} onDoubleClick={() => setZoom(null)}
        role="img" aria-label={`Commits from ${fmtDateTime(f)} to ${fmtDateTime(t)}`}>
        <svg width={width} height={H} aria-hidden="true">
          <line className="ts-baseline" x1={0} x2={width} y1={baseline + 0.5} y2={baseline + 0.5} />
          {ticks.map((tt) => (
            <g key={tt}>
              <line className="ts-grid" x1={x(tt)} x2={x(tt)} y1={0} y2={baseline} />
              <line className="ts-baseline" x1={x(tt)} x2={x(tt)} y1={baseline} y2={baseline + LANE_H} />
              <text className="axis-text" x={x(tt) + 4} y={H - 6}>{plan.fmt(tt)}</text>
            </g>
          ))}
          {bins.map((b) => {
            if (!b.count) return null;
            const bh = Math.max(3, (b.count / max) * (PLOT_H - 10));
            return (
              <rect key={b.t} className="ts-bar" x={x(b.t) + 0.5} y={baseline - bh} width={barW} height={bh} rx={1.5}
                onMouseMove={(e) => show(e, <><b>{b.count}</b> commit{b.count === 1 ? '' : 's'}<br />{fmtDateTime(b.t)} → {fmtDateTime(b.t + bucket)}</>)} onMouseLeave={hide} />
            );
          })}
          {inRange.map((c) => <line key={c.hash} className="ts-tick" x1={x(c.time)} x2={x(c.time)} y1={baseline + 3} y2={baseline + 8} />)}
          {deployed.map((c) => <circle key={`d${c.hash}`} className="ts-deploy" cx={x(c.time)} cy={baseline + 9} r={3}><title>{`Live · ${fmtDateTime(c.time)}`}</title></circle>)}
          {versionChanges.map((c) => <circle key={`v${c.hash}`} className="ts-version" cx={x(c.time)} cy={baseline + 9} r={3}><title>{`Version change · ${fmtDateTime(c.time)}`}</title></circle>)}
          {drag && <rect className="ts-brush" x={Math.min(drag.x0, drag.x1)} y={0} width={Math.abs(drag.x1 - drag.x0)} height={baseline + LANE_H} />}
        </svg>
      </div>
      <ChartTooltip tip={tip} />
    </div>
  );
}
