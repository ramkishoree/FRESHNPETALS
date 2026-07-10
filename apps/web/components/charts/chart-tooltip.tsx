import type { TooltipContentProps } from 'recharts';

/**
 * Shared hover tooltip for every chart wrapper (dataviz skill: "ship a
 * crosshair+tooltip on line/area, a per-mark tooltip on bar/dot/cell").
 * Text stays in text tokens, never the series color — the little swatch
 * next to the label is what carries color identity.
 */
export function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="border-border bg-popover text-caption text-popover-foreground rounded-md border px-3 py-2 shadow-md">
      {label != null && <p className="text-foreground mb-1 font-medium">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="text-foreground ml-auto font-medium">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
