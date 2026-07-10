import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/states/empty-state';
import { ConfidenceBadge } from './confidence-badge';

export interface Recommendation {
  id: string;
  title: string;
  impact?: string;
  confidence: number;
}

export interface RecommendationPanelProps {
  recommendations: Recommendation[];
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

/** Ch.12 §83. Ch.14 §84: expected business impact is shown alongside each
 * recommendation, not just the suggestion itself. */
export function RecommendationPanel({
  recommendations,
  onAccept,
  onDismiss,
}: RecommendationPanelProps) {
  if (recommendations.length === 0) {
    return (
      <EmptyState
        title="No recommendations right now"
        description="Check back after the next AI run."
      />
    );
  }

  return (
    <Card className="rounded-card">
      <CardHeader className="flex flex-row items-center gap-2">
        <Lightbulb className="text-accent size-4" aria-hidden="true" />
        <p className="text-foreground font-medium">Recommendations</p>
      </CardHeader>
      <CardContent className="divide-border divide-y">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div>
              <p className="text-body text-foreground">{rec.title}</p>
              {rec.impact && <p className="text-caption text-muted-foreground">{rec.impact}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ConfidenceBadge score={rec.confidence} />
              {onAccept && (
                <Button type="button" size="sm" onClick={() => onAccept(rec.id)}>
                  Accept
                </Button>
              )}
              {onDismiss && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onDismiss(rec.id)}>
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
