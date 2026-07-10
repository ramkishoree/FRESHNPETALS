'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/states/empty-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime } from '@/lib/format-date';

interface AuditEvent {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  actor_id: string | null;
  severity: 'info' | 'warning' | 'critical';
  service: string | null;
  created_at: string;
}

const SEVERITY_CLASS: Record<string, string> = {
  info: 'text-muted-foreground',
  warning: 'text-warning-text',
  critical: 'text-destructive',
};

/** Ch.16 §111 Audit Log API — read-only, filterable, immutable (see migration 0023). */
export default function AuditLogPage() {
  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [severity, setSeverity] = React.useState<string>('all');

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (severity !== 'all') params.set('severity', severity);
        const response = await fetch(`/api/v1/admin/audit?${params}`);
        const body = await response.json();
        if (!response.ok || !body.success)
          throw new Error(body.error?.message ?? 'Failed to load.');
        setEvents(body.data.items as AuditEvent[]);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : 'Failed to load.');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [severity]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 text-foreground font-bold">Audit log</h1>
          <p className="text-body text-muted-foreground">
            Immutable record of every administrative action.
          </p>
        </div>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState variant="list" count={8} />
      ) : events.length === 0 ? (
        <EmptyState title="No audit events" description="Nothing matches this filter yet." />
      ) : (
        <div className="rounded-card border-border overflow-hidden border">
          <table className="text-body w-full">
            <thead className="bg-muted text-caption text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Event</th>
                <th className="px-4 py-2 text-left">Entity</th>
                <th className="px-4 py-2 text-left">Service</th>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">When</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-border border-t">
                  <td className="text-foreground px-4 py-2">{event.event_type}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {event.aggregate_type}/{event.aggregate_id.slice(0, 8)}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">{event.service ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={SEVERITY_CLASS[event.severity]}>
                      {event.severity}
                    </Badge>
                  </td>
                  <td className="text-caption text-muted-foreground px-4 py-2">
                    {formatDateTime(event.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
