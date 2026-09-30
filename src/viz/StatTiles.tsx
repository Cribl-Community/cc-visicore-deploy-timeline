import { Card, Text } from '@capra/core';
import { Sparkline } from './Sparkline';

export type Stat = { label: string; value: number | string; hint?: string; spark?: number[] };

export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="stat-row">
      {stats.map((s) => (
        <Card key={s.label} className="stat-card">
          <Card.Content>
            <div className="stat-body">
              <div>
                <Text as="div" variant="body-sm-normal" color="secondary">{s.label}</Text>
                <Text as="div" variant="metric-lg">{s.value}</Text>
                {s.hint && <Text as="div" variant="body-xs-normal" color="tertiary">{s.hint}</Text>}
              </div>
              {s.spark && <Sparkline values={s.spark} />}
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
