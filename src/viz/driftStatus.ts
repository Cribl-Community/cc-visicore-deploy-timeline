import { CircleCheck, WarningOutlined, RocketLaunch, QuestionCircleOutlined } from '@capra/icons';
import type { GroupState, VersionState } from '../model';

type Pill = 'success' | 'warning' | 'danger' | 'default';
export type Status = { cls: string; label: string; Icon: typeof CircleCheck; pill: Pill };

/** Single status vocabulary: success = in sync / on leader, warning = behind or mixed, danger = ahead or incompatible, neutral = unknown. */
export function driftStatus(g: GroupState): Status {
  if (g.lag < 0) return { cls: 'st-neutral', label: 'Never deployed', Icon: RocketLaunch, pill: 'default' };
  if (g.lag === 0) return { cls: 'st-success', label: 'In sync', Icon: CircleCheck, pill: 'success' };
  if (g.lag <= 3) return { cls: 'st-warning', label: `${g.lag} behind`, Icon: WarningOutlined, pill: 'warning' };
  return { cls: 'st-danger', label: `${g.lag} behind`, Icon: WarningOutlined, pill: 'danger' };
}

export function versionStatus(v: VersionState | undefined): Status {
  if (!v || v.running.length === 0) return { cls: 'st-neutral', label: 'No nodes', Icon: QuestionCircleOutlined, pill: 'default' };
  const ver = v.running[0].version.split('-')[0];
  if (v.incompatible > 0) return { cls: 'st-danger', label: `${v.incompatible} incompatible`, Icon: WarningOutlined, pill: 'danger' };
  switch (v.status) {
    case 'match': return { cls: 'st-success', label: `On leader ${ver}`, Icon: CircleCheck, pill: 'success' };
    case 'mixed': return { cls: 'st-warning', label: `Mixed: ${v.running.map((r) => `${r.count}×${r.version.split('-')[0]}`).join(', ')}`, Icon: WarningOutlined, pill: 'warning' };
    case 'behind': return { cls: 'st-warning', label: `Behind · ${ver}`, Icon: WarningOutlined, pill: 'warning' };
    case 'ahead': return { cls: 'st-danger', label: `Ahead · ${ver}`, Icon: WarningOutlined, pill: 'danger' };
    default: return { cls: 'st-neutral', label: ver, Icon: QuestionCircleOutlined, pill: 'default' };
  }
}
