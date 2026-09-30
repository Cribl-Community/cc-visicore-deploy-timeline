import { Text } from '@capra/core';

/** Five-step sequential ramp legend shared by the calendar and the heatmap. */
export function HeatLegend({ max, unit }: { max: number; unit: string }) {
  return (
    <div className="legend-row">
      <Text variant="body-xs-normal" color="tertiary">0</Text>
      <svg width={5 * 14} height={10} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} className={`h${i}`} x={i * 14} y={0} width={12} height={10} rx={2} />)}
      </svg>
      <Text variant="body-xs-normal" color="tertiary">{`${max} ${unit}`}</Text>
    </div>
  );
}
