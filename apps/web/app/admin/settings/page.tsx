'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/states/empty-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Setting {
  id: string;
  key: string;
  category: string;
  value: unknown;
  description: string | null;
  requires_owner: boolean;
}

const CATEGORY_LABEL: Record<string, string> = {
  business: 'Business',
  payment: 'Payment',
  delivery: 'Delivery',
  tax: 'Tax',
  seo: 'SEO defaults',
  email: 'Email',
  ai: 'AI',
  feature_flags: 'Feature flags',
};

/** Ch.16 §112 System Configuration API. "Critical settings require Owner role" — enforced server-side; a non-owner's save attempt on one surfaces the 403 as a toast. */
export default function SettingsPage() {
  const [settings, setSettings] = React.useState<Setting[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/admin/settings');
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Failed to load.');
      setSettings(body.data as Setting[]);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to load.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Standard fetch-on-mount idiom (React docs "Fetching data" pattern);
    // `load`'s own deps gate re-runs, so this doesn't cascade — the
    // compiler's static check can't see that through the async indirection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(setting: Setting) {
    setSavingKey(setting.key);
    try {
      const raw = drafts[setting.key] ?? JSON.stringify(setting.value);
      const value = JSON.parse(raw);
      const response = await fetch(`/api/v1/admin/settings/${setting.key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to save setting.');
      toast.success('Setting saved.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save setting.');
    } finally {
      setSavingKey(null);
    }
  }

  const grouped = settings.reduce<Record<string, Setting[]>>((acc, setting) => {
    (acc[setting.category] ??= []).push(setting);
    return acc;
  }, {});

  if (isLoading) return <LoadingState variant="cards" count={4} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 text-foreground font-bold">Settings</h1>
        <p className="text-body text-muted-foreground">
          Business, payment, delivery, tax, SEO, email, AI, and feature-flag configuration.
        </p>
      </div>

      {settings.length === 0 ? (
        <EmptyState title="No settings configured yet" />
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Card key={category} className="rounded-card">
            <CardHeader>
              <h2 className="text-h4 text-foreground font-semibold">
                {CATEGORY_LABEL[category] ?? category}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((setting) => (
                <div key={setting.id} className="flex items-center gap-3">
                  <div className="min-w-48">
                    <p className="text-body text-foreground font-medium">{setting.key}</p>
                    {setting.description && (
                      <p className="text-caption text-muted-foreground">{setting.description}</p>
                    )}
                  </div>
                  <Input
                    defaultValue={JSON.stringify(setting.value)}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [setting.key]: e.target.value }))
                    }
                    className="flex-1"
                  />
                  {setting.requires_owner && (
                    <Badge variant="outline" className="text-warning-text">
                      Owner only
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    disabled={savingKey === setting.key}
                    onClick={() => save(setting)}
                  >
                    Save
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
