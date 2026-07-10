import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ConfidenceBadge } from './confidence-badge';

export type AiRiskLevel = 'informational' | 'advisory' | 'operational' | 'financial' | 'critical';

const RISK_LABEL: Record<AiRiskLevel, string> = {
  informational: 'Informational',
  advisory: 'Advisory',
  operational: 'Operational',
  financial: 'Financial',
  critical: 'Critical',
};

export interface ApprovalCardProps {
  taskTitle: string;
  taskType: string;
  riskLevel: AiRiskLevel;
  confidence: number;
  preview: ReactNode;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
}

/**
 * Ch.12 §83. Ch.14 §50 Approval Engine: approve/reject/edit/regenerate are
 * the supported decisions. Ch.14 §77: L5-critical tools are never executed
 * by AI at all — a `critical` risk badge here is a strong visual signal,
 * not a gate the UI itself enforces (the database/tool layer already does).
 */
export function ApprovalCard({
  taskTitle,
  taskType,
  riskLevel,
  confidence,
  preview,
  onApprove,
  onReject,
  onEdit,
  onRegenerate,
}: ApprovalCardProps) {
  return (
    <Card className="rounded-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <p className="text-foreground font-medium">{taskTitle}</p>
          <p className="text-caption text-muted-foreground">{taskType}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(riskLevel === 'critical' && 'border-destructive text-destructive')}
          >
            {RISK_LABEL[riskLevel]}
          </Badge>
          <ConfidenceBadge score={confidence} />
        </div>
      </CardHeader>

      <CardContent>{preview}</CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onApprove}>
          Approve
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onRegenerate}>
          Regenerate
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onReject}>
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}
