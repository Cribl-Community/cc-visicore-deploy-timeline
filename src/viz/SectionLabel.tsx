import { Text } from '@capra/core';
import { GroupKindIcon } from './GroupKind';
import { kindLabel } from '../model';

/** "WORKER GROUPS" / "EDGE FLEETS" divider used by every group list. */
export function SectionLabel({ isFleet, count }: { isFleet: boolean; count?: number }) {
  return (
    <div className="section-row">
      <GroupKindIcon isFleet={isFleet} />
      <Text variant="body-xs-semibold" color="tertiary" FORCE__className="section-text">{kindLabel(isFleet).toUpperCase()}</Text>
      {count !== undefined && <Text variant="body-xs-normal" color="tertiary">{count}</Text>}
    </div>
  );
}
