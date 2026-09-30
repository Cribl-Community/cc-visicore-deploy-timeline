import type { ReactNode } from 'react';
import { Text } from '@capra/core';
import type { GroupState } from '../model';
import { GroupKindIcon } from './GroupKind';
import { groupUrl, LEADER_TARGET } from '../links';

type Props = {
  group: GroupState;
  children: ReactNode; // the chart mark
  trailing?: ReactNode; // pills / buttons
  selected?: boolean;
  dim?: boolean;
  className?: string;
  onClick?: () => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
};

/** One fixed-height row: kind icon · name (link to Cribl) · mark · trailing. Text never scales. */
export function GroupRow({ group, children, trailing, selected, dim, className, onClick, onMouseMove, onMouseLeave }: Props) {
  return (
    <div className={`group-row${selected ? ' is-selected' : ''}${dim ? ' is-dim' : ''}${className ? ` ${className}` : ''}`} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <span className="group-row-name">
        <GroupKindIcon isFleet={group.isFleet} />
        <a className="linkish" href={groupUrl(group.id, group.isFleet)} target={LEADER_TARGET} rel="noreferrer" title={`Open ${group.name} in Cribl`}>
          <Text variant="body-sm-semibold">{group.name}</Text>
        </a>
      </span>
      <div className="group-row-mark" role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
        onClick={onClick} onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}>{children}</div>
      {trailing && <span className="group-row-trailing">{trailing}</span>}
    </div>
  );
}

