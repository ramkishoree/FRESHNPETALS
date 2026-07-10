import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { ConfidenceBadge } from './confidence-badge';

export interface AiSuggestionCardProps {
  title: string;
  content: string;
  confidence: number;
  reasoning?: string;
  onAccept?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onReject?: () => void;
}

/**
 * Ch.12 §83 AI Component. Ch.14 §84 Explainability: reasoning is shown
 * alongside the suggestion, never hidden — an administrator should
 * understand why AI produced it, not just accept it on faith.
 */
export function AiSuggestionCard({
  title,
  content,
  confidence,
  reasoning,
  onAccept,
  onEdit,
  onRegenerate,
  onReject,
}: AiSuggestionCardProps) {
  return (
    <Card className="rounded-card border-accent/30">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="text-accent size-4" aria-hidden="true" />
          <p className="text-foreground font-medium">{title}</p>
        </div>
        <ConfidenceBadge score={confidence} />
      </CardHeader>

      <CardContent className="space-y-2">
        <p className="text-body text-foreground whitespace-pre-wrap">{content}</p>
        {reasoning && (
          <p className="text-caption text-muted-foreground">
            <span className="font-medium">Why: </span>
            {reasoning}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {onAccept && (
          <Button type="button" size="sm" onClick={onAccept}>
            Approve
          </Button>
        )}
        {onEdit && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )}
        {onRegenerate && (
          <Button type="button" variant="outline" size="sm" onClick={onRegenerate}>
            Regenerate
          </Button>
        )}
        {onReject && (
          <Button type="button" variant="ghost" size="sm" onClick={onReject}>
            Reject
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
