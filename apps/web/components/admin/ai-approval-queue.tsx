'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/states/empty-state';
import { Textarea } from '@/components/ui/textarea';

export interface AiApprovalTask {
  id: string;
  title: string;
  agentName: string | null;
  metadata: {
    summary?: string;
    confidence?: number;
    reasoning?: string;
    draft?: unknown;
  };
  createdAt: string;
}

function confidenceLabel(confidence: number | undefined): string {
  if (confidence === undefined) return 'unknown';
  return `${Math.round(confidence * 100)}%`;
}

/** Ch.9 §11/§49 Approval Queue — Task/Agent/Summary/Confidence/Preview/Reason, Approve/Reject/Edit/Regenerate. */
export function AiApprovalQueue({
  tasks,
  onChanged,
}: {
  tasks: AiApprovalTask[];
  onChanged: () => void;
}) {
  const [editingTask, setEditingTask] = React.useState<AiApprovalTask | null>(null);
  const [editedJson, setEditedJson] = React.useState('');
  const [busyTaskId, setBusyTaskId] = React.useState<string | null>(null);

  async function decide(
    taskId: string,
    action: 'approve' | 'reject' | 'regenerate',
    body?: unknown,
  ) {
    setBusyTaskId(taskId);
    try {
      const response = await fetch(`/api/v1/admin/ai/approvals/${taskId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error?.message ?? `Failed to ${action}.`);
      const detail = result.data?.detail as string | undefined;
      toast.success(detail ?? `Task ${action}d.`);
      onChanged();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : `Failed to ${action}.`);
    } finally {
      setBusyTaskId(null);
    }
  }

  async function submitEdit() {
    if (!editingTask) return;
    let editedOutput: unknown;
    try {
      editedOutput = JSON.parse(editedJson);
    } catch {
      toast.error('Edited output must be valid JSON.');
      return;
    }
    setBusyTaskId(editingTask.id);
    try {
      const response = await fetch(`/api/v1/admin/ai/approvals/${editingTask.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedOutput }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error?.message ?? 'Failed to save edit.');
      toast.success('Task edited and completed.');
      setEditingTask(null);
      onChanged();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save edit.');
    } finally {
      setBusyTaskId(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="Approval Queue is empty"
        description="Run a task from an AI Employee above — its draft output will land here for review."
      />
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Card key={task.id} className="rounded-card">
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-body text-foreground font-medium">{task.title}</p>
                <p className="text-caption text-muted-foreground">
                  {task.agentName ?? 'Unknown agent'}
                </p>
              </div>
              <Badge variant="secondary">
                Confidence {confidenceLabel(task.metadata.confidence)}
              </Badge>
            </div>

            {task.metadata.summary && (
              <p className="text-body text-foreground">{task.metadata.summary}</p>
            )}

            {task.metadata.draft != null && (
              <pre className="bg-muted text-caption max-h-40 overflow-auto rounded-md p-3">
                {JSON.stringify(task.metadata.draft, null, 2)}
              </pre>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busyTaskId === task.id}
                onClick={() => decide(task.id, 'approve')}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyTaskId === task.id}
                onClick={() => decide(task.id, 'reject')}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyTaskId === task.id}
                onClick={() => {
                  setEditingTask(task);
                  setEditedJson(JSON.stringify(task.metadata.draft ?? {}, null, 2));
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyTaskId === task.id}
                onClick={() => decide(task.id, 'regenerate')}
              >
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={editingTask !== null} onOpenChange={(next) => !next && setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit draft</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editedJson}
            onChange={(e) => setEditedJson(e.target.value)}
            rows={12}
            className="text-caption font-mono"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={busyTaskId === editingTask?.id}>
              Save & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
