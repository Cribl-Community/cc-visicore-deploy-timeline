import { Stream, Edge } from '@capra/icons';

/** Small visual distinction between Worker Groups and Edge Fleets, used wherever a group is named. */
export function GroupKindIcon({ isFleet }: { isFleet: boolean }) {
  const Icon = isFleet ? Edge : Stream;
  return <Icon size="xs" aria-label={isFleet ? 'Edge Fleet' : 'Worker Group'} />;
}
