'use client';

import * as React from 'react';
import { AiApprovalQueue, type AiApprovalTask } from '@/components/admin/ai-approval-queue';
import { AiEmployeeCard, type AiEmployeeCardData } from '@/components/admin/ai-employee-card';
import { LoadingState } from '@/components/states/loading-state';

/**
 * Ch.12 §52 AI Workspace + Ch.9 Part 2 (11 v1 AI Employees) + Ch.9 §11/§49
 * Approval Queue. Every employee card's "Run Task" queues a draft; nothing
 * here ever applies a change automatically — that always ends with a
 * human clicking Approve (or Edit, then Approve) below.
 */
export default function AiWorkspacePage() {
  const [employees, setEmployees] = React.useState<AiEmployeeCardData[]>([]);
  const [tasks, setTasks] = React.useState<AiApprovalTask[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const [agentsRes, approvalsRes] = await Promise.all([
      fetch('/api/v1/admin/ai/agents'),
      fetch('/api/v1/admin/ai/approvals'),
    ]);
    const agentsBody = await agentsRes.json();
    const approvalsBody = await approvalsRes.json();
    if (agentsRes.ok && agentsBody.success) setEmployees(agentsBody.data);
    if (approvalsRes.ok && approvalsBody.success) setTasks(approvalsBody.data);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    // Standard fetch-on-mount idiom (React docs "Fetching data" pattern);
    // `load`'s own deps gate re-runs, so this doesn't cascade — the
    // compiler's static check can't see that through the async indirection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h2 text-foreground font-bold">AI Workspace</h1>
        <p className="text-body text-muted-foreground">
          Every AI employee only ever produces a draft. Nothing publishes, deletes, changes a price,
          or modifies inventory without your approval below.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-h4 text-foreground font-semibold">AI Employees</h2>
        {isLoading ? (
          <LoadingState variant="cards" count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((employee) => (
              <AiEmployeeCard key={employee.slug} employee={employee} onTaskQueued={load} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-h4 text-foreground font-semibold">Approval Queue</h2>
        {isLoading ? (
          <LoadingState variant="list" count={3} />
        ) : (
          <AiApprovalQueue tasks={tasks} onChanged={load} />
        )}
      </section>
    </div>
  );
}
