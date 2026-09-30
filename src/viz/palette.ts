// Fixed categorical slots for groups. The order was chosen by running the dataviz
// palette validator on Capra `visualization.consistent.*` tokens: every adjacent
// pair clears the CVD and normal-vision floors on both the light and dark surfaces.
// Colors are applied via CSS classes in viz.css (token() only), never as raw hex.
export const SLOT_COUNT = 6;

/** Stable slot per group id (insertion order of the first listing, never re-assigned on filter). */
export function slotFor(gid: string, order: string[]): number {
  const i = order.indexOf(gid);
  return i < 0 || i >= SLOT_COUNT ? 0 : i + 1; // 0 = "other" (neutral)
}

/** Heat step 0..4 for a count against the max; 0 = empty cell (surface). */
export function heatStep(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((count / max) * 4));
}
