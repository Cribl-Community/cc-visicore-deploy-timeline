type Props = { values: number[]; width?: number; height?: number };

/** 2px accent line with a 10% area wash and an end marker. Single series, so no legend. */
export function Sparkline({ values, width = 120, height = 32 }: Props) {
  const max = Math.max(1, ...values);
  const n = values.length;
  const pts = values.map((v, i) => [
    n === 1 ? width : (i / (n - 1)) * (width - 6) + 3,
    height - 4 - (v / max) * (height - 8),
  ]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path className="sparkline-area" d={`${d} L${last[0]},${height} L${pts[0][0]},${height} Z`} />
      <path className="sparkline-line" d={d} />
      <circle className="surface-ring sparkline-dot" cx={last[0]} cy={last[1]} r={4} />
    </svg>
  );
}
