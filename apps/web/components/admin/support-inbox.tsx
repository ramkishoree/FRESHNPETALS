'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/states/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export interface SupportConversationSummary {
  id: string;
  whatsapp_wa_id: string;
  status: 'bot_active' | 'resolved' | 'escalated' | 'closed';
  ai_attempt_count: number;
  escalated_at: string | null;
  updated_at: string;
  orders: { order_number: string } | null;
}

interface SupportMessage {
  id: string;
  sender: 'customer' | 'bot' | 'owner';
  body: string;
  created_at: string;
}

const STATUS_LABEL: Record<SupportConversationSummary['status'], string> = {
  bot_active: 'Bot handling',
  resolved: 'Resolved',
  escalated: 'Needs you',
  closed: 'Closed',
};

const STATUS_VARIANT: Record<
  SupportConversationSummary['status'],
  'default' | 'secondary' | 'destructive'
> = {
  bot_active: 'secondary',
  resolved: 'secondary',
  escalated: 'destructive',
  closed: 'secondary',
};

/** Ch.16-style Support Inbox — the owner's "manage the number" interface, since the dedicated WhatsApp number has no phone-app UI once it's API-connected. */
export function SupportInbox({
  conversations,
  onChanged,
}: {
  conversations: SupportConversationSummary[];
  onChanged: () => void;
}) {
  const [statusFilter, setStatusFilter] = React.useState<string>('escalated');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = React.useState('');
  const [isBusy, setIsBusy] = React.useState(false);

  const filtered =
    statusFilter === 'all' ? conversations : conversations.filter((c) => c.status === statusFilter);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const loadThread = React.useCallback(async (id: string) => {
    const response = await fetch(`/api/v1/admin/support/${id}`);
    const result = await response.json();
    if (response.ok && result.success) setMessages(result.data.messages);
  }, []);

  function openConversation(id: string) {
    setSelectedId(id);
    setReplyText('');
    void loadThread(id);
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    setIsBusy(true);
    try {
      const response = await fetch(`/api/v1/admin/support/${selected.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error?.message ?? 'Failed to send reply.');
      toast.success('Reply sent.');
      setReplyText('');
      void loadThread(selected.id);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to send reply.');
    } finally {
      setIsBusy(false);
    }
  }

  async function closeConversation() {
    if (!selected) return;
    setIsBusy(true);
    try {
      const response = await fetch(`/api/v1/admin/support/${selected.id}/close`, {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error?.message ?? 'Failed to close.');
      toast.success('Conversation closed.');
      setSelectedId(null);
      onChanged();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to close.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full" aria-label="Filter conversations by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="escalated">Needs you</SelectItem>
            <SelectItem value="bot_active">Bot handling</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        {filtered.length === 0 ? (
          <EmptyState title="No conversations" description="Nothing in this filter right now." />
        ) : (
          <div className="space-y-2">
            {filtered.map((conversation) => (
              <Card
                key={conversation.id}
                className={`rounded-card cursor-pointer ${selectedId === conversation.id ? 'border-primary' : ''}`}
                onClick={() => openConversation(conversation.id)}
              >
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-body text-foreground font-medium">
                      {conversation.orders?.order_number ?? conversation.whatsapp_wa_id}
                    </p>
                    <Badge variant={STATUS_VARIANT[conversation.status]}>
                      {STATUS_LABEL[conversation.status]}
                    </Badge>
                  </div>
                  <p className="text-caption text-muted-foreground">
                    {conversation.whatsapp_wa_id}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        {!selected ? (
          <EmptyState
            title="Select a conversation"
            description="Pick one from the list to view the thread."
          />
        ) : (
          <Card className="rounded-card">
            <CardContent className="space-y-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-body text-foreground font-medium">
                    {selected.orders?.order_number ?? selected.whatsapp_wa_id}
                  </p>
                  <p className="text-caption text-muted-foreground">{selected.whatsapp_wa_id}</p>
                </div>
                {selected.status !== 'closed' && (
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={closeConversation}>
                    Close conversation
                  </Button>
                )}
              </div>

              <div className="bg-muted max-h-96 space-y-2 overflow-y-auto rounded-md p-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`text-body rounded-md p-2 ${
                      message.sender === 'customer'
                        ? 'bg-background'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    <p className="text-caption text-muted-foreground font-medium">
                      {message.sender}
                    </p>
                    <p>{message.body}</p>
                  </div>
                ))}
              </div>

              {selected.status === 'escalated' ? (
                <div className="space-y-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply as Fresh & Petals..."
                    rows={3}
                  />
                  <Button onClick={sendReply} disabled={isBusy || !replyText.trim()}>
                    Send
                  </Button>
                </div>
              ) : (
                <p className="text-caption text-muted-foreground">
                  Only conversations that need you (escalated) can be replied to here.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
