'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getChartColor } from '@/lib/chart-colors';
import { ChartTooltip } from './chart-tooltip';

export interface ChartSeries {
  key: string;
  label: string;
}

export interface LineChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
}

/**
 * Ch.12 §86 (Recharts). dataviz skill: thin (2px) lines, recessive
 * grid/axes, legend only when there's more than one series (a single
 * series is already named by the chart's own title/context), hover
 * tooltip always. One axis — never a second Y scale on the same chart.
 */
export function LineChart({ data, xKey, series, height = 320 }: LineChartProps) {
  const showLegend = series.length > 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
        {series.map((s, index) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={getChartColor(index)}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
