import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export interface WeeklyBriefMetric {
  label: string;
  value: string;
}

export interface WeeklyBriefProps {
  weekOf: string;
  metrics: WeeklyBriefMetric[];
  highlights: string[];
  estimatedAdminMinutes: number;
}

/**
 * Ch.12 §83. The Monday auto-generated operating brief (Ch.9 chunk):
 * revenue/orders/conversion/low-stock/SEO tasks/blogs ready/campaign
 * suggestions, targeting under 30 minutes of admin time per week.
 */
export function WeeklyBrief({
  weekOf,
  metrics,
  highlights,
  estimatedAdminMinutes,
}: WeeklyBriefProps) {
  return (
    <Card className="rounded-card">
      <CardHeader>
        <p className="text-h4 tracking-heading text-foreground font-bold">Weekly brief</p>
        <p className="text-caption text-muted-foreground">Week of {weekOf}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt className="text-caption text-muted-foreground">{metric.label}</dt>
              <dd className="text-h4 text-foreground font-semibold">{metric.value}</dd>
            </div>
          ))}
        </dl>

        <Separator />

        <ul className="text-body text-foreground list-inside list-disc space-y-1">
          {highlights.map((highlight, index) => (
            <li key={index}>{highlight}</li>
          ))}
        </ul>

        <p className="text-caption text-muted-foreground">
          Estimated review time: {estimatedAdminMinutes} min
        </p>
      </CardContent>
    </Card>
  );
}
