import { CircleCheck, WarningOutlined, RocketLaunch } from '@capra/icons';
import type { GroupState } from '../model';

export function driftStatus(g: GroupState): { cls: string; label: string; Icon: typeof CircleCheck } {
  if (g.lag < 0) return { cls: 'st-neutral', label: 'Never deployed', Icon: RocketLaunch };
  if (g.lag === 0) return { cls: 'st-success', label: 'In sync', Icon: CircleCheck };
  if (g.lag <= 3) return { cls: 'st-warning', label: `${g.lag} behind`, Icon: WarningOutlined };
  return { cls: 'st-danger', label: `${g.lag} behind`, Icon: WarningOutlined };
}

