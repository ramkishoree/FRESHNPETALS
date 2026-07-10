'use client';

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getChartColor } from '@/lib/chart-colors';
import { ChartTooltip } from './chart-tooltip';
import type { ChartSeries } from './line-chart';

export interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
}

/** Ch.12 §86. 2px surface gap between adjacent bars is Recharts'
 * `barCategoryGap`; rounded data-ends (dataviz skill) via `radius`. */
export function BarChart({ data, xKey, series, height = 320 }: BarChartProps) {
  const showLegend = series.length > 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        barCategoryGap={2}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={ChartTooltip} cursor={{ fill: 'var(--color-muted)' }} />
        {showLegend && (
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-muted-foreground)' }} />
        )}
        {series.map((s, index) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={getChartColor(index)}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
