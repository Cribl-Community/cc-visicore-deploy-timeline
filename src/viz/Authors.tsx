import { Text } from '@capra/core';
import type { AuthorCount } from '../model';
import { initials } from '../model';
import { ChartTooltip } from './ChartTooltip';
import { useTip } from './useTip';

type Props = {
  authors: AuthorCount[];
  me?: { email?: string; name?: string };
  selectedAuthor?: string;
  onSelectAuthor: (name: string | undefined) => void;
};

const ROW = 30;
const BAR = 16;
const LABEL_W = 150;

/** Horizontal bars, emphasis form: the signed-in user in accent, everyone else de-emphasized. */
export function Authors({ authors, me, selectedAuthor, onSelectAuthor }: Props) {
  const { tip, show, hide } = useTip();
  const width = 420;
  const plotW = width - LABEL_W - 44;
  const max = Math.max(1, ...authors.map((a) => a.count));
  const height = authors.length * ROW + 4;
  const isMe = (a: AuthorCount) =>
    !!me && ((me.email && a.email && me.email.toLowerCase() === a.email.toLowerCase()) || (!!me.name && a.name === me.name));
  return (
    <div className="authors">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Commits per author">
        {authors.map((a, i) => {
          const y = i * ROW + 2;
          const w = Math.max(4, (a.count / max) * plotW);
          const sel = selectedAuthor === a.name;
          const cls = a.other ? 's0' : isMe(a) ? 'emph' : selectedAuthor && !sel ? 'deemph' : 's1';
          return (
            <g key={a.name} className={cls}>
              <foreignObject x={0} y={y - 2} width={22} height={22}>
                <span className="avatar avatar-sm">{a.other ? '…' : initials(a.name)}</span>
              </foreignObject>
              <text className="value-text-strong" x={28} y={y + BAR / 2 + 4}>{a.name.length > 16 ? a.name.slice(0, 15) + '…' : a.name}{isMe(a) ? ' (you)' : ''}</text>
              <rect className="hit" x={LABEL_W - 4} y={y - 4} width={plotW + 48} height={ROW - 2} tabIndex={0}
                onClick={() => !a.other && onSelectAuthor(sel ? undefined : a.name)}
                onKeyDown={(e) => e.key === 'Enter' && !a.other && onSelectAuthor(sel ? undefined : a.name)}
                onMouseMove={(e) => show(e, <><b>{a.name}</b> · {a.count} commit{a.count === 1 ? '' : 's'}</>)}
                onMouseLeave={hide} />
              <path className="fill" d={`M${LABEL_W},${y} h${w - 4} a4,4 0 0 1 4,4 v${BAR - 8} a4,4 0 0 1 -4,4 h${-(w - 4)} z`} />
              <text className="value-text" x={LABEL_W + w + 8} y={y + BAR / 2 + 4}>{a.count}</text>
            </g>
          );
        })}
      </svg>
      {authors.length === 0 && <Text variant="body-xs-normal" color="tertiary">No commits in range</Text>}
      <ChartTooltip tip={tip} />
    </div>
  );
}
