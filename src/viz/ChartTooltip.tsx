import type { ReactNode } from 'react';

export type TipState = { x: number; y: number; body: ReactNode } | null;

/** Fixed-position hover tooltip for SVG marks. Position is the pointer; offset keeps it clear of the cursor. */
export function ChartTooltip({ tip }: { tip: TipState }) {
  if (!tip) return null;
  const left = Math.min(tip.x + 14, window.innerWidth - 240);
  const top = tip.y + 14;
  return (
    <div className="viz-tip" style={{ left, top }} role="status">
      {tip.body}
    </div>
  );
}

