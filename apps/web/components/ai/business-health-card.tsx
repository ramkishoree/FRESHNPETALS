import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface BusinessHealthFactor {
  label: string;
  score: number;
  weightPct: number;
}

export interface BusinessHealthCardProps {
  overallScore: number;
  factors: BusinessHealthFactor[];
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-success-text';
  if (score >= 50) return 'text-warning-text';
  return 'text-destructive';
}

/**
 * Ch.12 §83. Weighted composite (Revenue 20%, Conversion 15%, Inventory
 * 15%, SEO 10%, Perf 10%, CSAT 10%, Automation 10%, Security 5%, Reviews
 * 5%, Growth 10% — Ch.9 chunk); this component only displays whatever
 * weights/scores the backend computed, it doesn't compute the composite.
 */
export function BusinessHealthCard({ overallScore, factors }: BusinessHealthCardProps) {
  return (
    <Card className="rounded-card">
      <CardHeader>
        <p className="text-caption text-muted-foreground">Business health</p>
        <p className={cn('text-hero font-bold', scoreColor(overallScore))}>
          {Math.round(overallScore)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {factors.map((factor) => (
          <div key={factor.label} className="space-y-1">
            <div className="text-caption text-muted-foreground flex justify-between">
              <span>
                {factor.label} <span className="text-small">({factor.weightPct}%)</span>
              </span>
              <span className={scoreColor(factor.score)}>{Math.round(factor.score)}</span>
            </div>
            <Progress value={factor.score} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
