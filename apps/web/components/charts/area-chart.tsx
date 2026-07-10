'use client';

import {
  Area,
  AreaChart as RechartsAreaChart,
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

export interface AreaChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
}

/** Ch.12 §86. Same conventions as LineChart (dataviz skill). */
export function AreaChart({ data, xKey, series, height = 320 }: AreaChartProps) {
  const showLegend = series.length > 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
        <Tooltip content={ChartTooltip} />
        {showLegend && (
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-muted-foreground)' }} />
        )}
        {series.map((s, index) => {
          const color = getChartColor(index);
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              strokeWidth={2}
              fill={color}
              fillOpacity={0.15}
            />
          );
        })}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
