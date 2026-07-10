'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export interface AiEmployeeCardData {
  slug: string;
  name: string;
  purpose: string;
  category: string;
  capabilities: string[];
  kpis: { label: string; target: string }[];
  status: string;
  waitingApprovalCount: number;
  completedCount: number;
  failedCount: number;
}

/** Ch.9 Part 2 (§17-30) AI Employee card — "Run Task" opens the queue, never applies anything itself. */
export function AiEmployeeCard({
  employee,
  onTaskQueued,
}: {
  employee: AiEmployeeCardData;
  onTaskQueued: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [instructions, setInstructions] = React.useState('');
  const [isRunning, setIsRunning] = React.useState(false);

  async function runTask() {
    setIsRunning(true);
    try {
      const response = await fetch(`/api/v1/admin/ai/agents/${employee.slug}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskInstructions: instructions }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to run task.');

      toast.success(`${employee.name} queued a task for approval.`);
      setOpen(false);
      setInstructions('');
      onTaskQueued();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to run task.');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Card className="rounded-card flex flex-col">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-h4 text-foreground font-semibold">{employee.name}</h3>
          <Badge variant="secondary">{employee.category}</Badge>
        </div>
        <p className="text-caption text-muted-foreground">{employee.purpose}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {employee.capabilities.slice(0, 3).map((capability) => (
              <Badge key={capability} variant="outline">
                {capability}
              </Badge>
            ))}
          </div>
          <div className="text-caption text-muted-foreground flex gap-3">
            <span>{employee.waitingApprovalCount} awaiting approval</span>
            <span>{employee.completedCount} completed</span>
            {employee.failedCount > 0 && (
              <span className="text-destructive">{employee.failedCount} failed</span>
            )}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">Run Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Run {employee.name}</DialogTitle>
              <DialogDescription>
                Describe the task. The draft output enters the Approval Queue — nothing is applied
                automatically.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Draft a listing for a dozen red roses in a glass vase."
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={runTask} disabled={isRunning || instructions.trim().length < 3}>
                {isRunning ? 'Running...' : 'Run'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
