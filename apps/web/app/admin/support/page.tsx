'use client';

import * as React from 'react';
import { LoadingState } from '@/components/states/loading-state';
import { SupportInbox, type SupportConversationSummary } from '@/components/admin/support-inbox';

/**
 * WhatsApp Support Inbox — where the owner "manages the number" for
 * escalated conversations, since the dedicated business-API number can't
 * run on a phone's regular WhatsApp app.
 */
export default function SupportInboxPage() {
  const [conversations, setConversations] = React.useState<SupportConversationSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const response = await fetch('/api/v1/admin/support');
    const result = await response.json();
    if (response.ok && result.success) setConversations(result.data);
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
        <h1 className="text-h2 text-foreground font-bold">Support Inbox</h1>
        <p className="text-body text-muted-foreground">
          The bot handles order questions on its own for up to two replies. Anything it can&apos;t
          resolve — or a customer asking for a human directly — lands here for you.
        </p>
      </div>

      {isLoading ? (
        <LoadingState variant="list" count={3} />
      ) : (
        <SupportInbox conversations={conversations} onChanged={load} />
      )}
    </div>
  );
}
