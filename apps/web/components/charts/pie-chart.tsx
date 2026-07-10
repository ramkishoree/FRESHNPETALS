'use client';

import {
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { getChartColor } from '@/lib/chart-colors';
import { ChartTooltip } from './chart-tooltip';

export interface PieChartDatum {
  name: string;
  value: number;
}

export interface PieChartProps {
  data: PieChartDatum[];
  /** Set >0 to render a donut instead of a full pie. */
  innerRadiusPct?: number;
  height?: number;
}

/** Ch.12 §86. Categorical hues assigned by fixed index (dataviz skill) —
 * a slice never repaints when other slices are filtered out. */
export function PieChart({ data, innerRadiusPct = 0, height = 320 }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Tooltip content={ChartTooltip} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-muted-foreground)' }} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={`${innerRadiusPct}%`}
          outerRadius="80%"
          paddingAngle={data.length > 1 ? 2 : 0}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={getChartColor(index)} />
          ))}
        </Pie>
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
