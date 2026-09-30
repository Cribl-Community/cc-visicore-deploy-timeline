import { useState, type ReactNode } from 'react';
import type { TipState } from './ChartTooltip';

export function useTip() {
  const [tip, setTip] = useState<TipState>(null);
  const show = (e: { clientX: number; clientY: number }, body: ReactNode) =>
    setTip({ x: e.clientX, y: e.clientY, body });
  const hide = () => setTip(null);
  return { tip, show, hide };
}
