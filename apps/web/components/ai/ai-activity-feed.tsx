import { Bot } from 'lucide-react';
import { EmptyState } from '@/components/states/empty-state';
import { formatDateTime } from '@/lib/format-date';

export interface AiActivityEntry {
  id: string;
  agentName: string;
  action: string;
  occurredAt: string;
}

export interface AiActivityFeedProps {
  entries: AiActivityEntry[];
}

/** Ch.12 §83. Ch.14 §83 Compliance Logging: every execution is recorded,
 * immutably — this renders that log, oldest action first is never
 * assumed; the caller controls ordering. */
export function AiActivityFeed({ entries }: AiActivityFeedProps) {
  if (entries.length === 0) {
    return <EmptyState title="No AI activity yet" />;
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <Bot className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-body text-foreground">
              <span className="font-medium">{entry.agentName}</span> {entry.action}
            </p>
            <time dateTime={entry.occurredAt} className="text-caption text-muted-foreground">
              {formatDateTime(entry.occurredAt)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
