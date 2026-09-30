import { LEADER_TARGET } from '../links';
import { Card, Text } from '@capra/core';
import { Sparkline } from './Sparkline';

export type Stat = { label: string; value: number | string; hint?: string; spark?: number[]; onClick?: () => void; href?: string; action?: string };

export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="stat-row">
      {stats.map((s) => {
        const body = (
          <div className="stat-body">
            <div>
              <Text as="div" variant="body-sm-normal" color="secondary">{s.label}</Text>
              <Text as="div" variant="metric-lg">{s.value}</Text>
              {s.hint && <Text as="div" variant="body-xs-normal" color="tertiary">{s.hint}</Text>}
              {s.action && <Text as="div" variant="body-xs-semibold" color="accent" FORCE__className="stat-action">{s.action} →</Text>}
            </div>
            {s.spark && <Sparkline values={s.spark} />}
          </div>
        );
        return (
          <Card key={s.label} className="stat-card">
            <Card.Content>
              {s.href
                ? <a className="stat-link" href={s.href} target={LEADER_TARGET} rel="noreferrer">{body}</a>
                : s.onClick
                  ? <button type="button" className="stat-link" onClick={s.onClick}>{body}</button>
                  : body}
            </Card.Content>
          </Card>
        );
      })}
    </div>
  );
}
