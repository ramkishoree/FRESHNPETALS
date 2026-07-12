/**
 * Shown only when Next Draft Mode is on (i.e. only to an admin who
 * followed a "Preview" link) — makes it unmistakable this isn't what a
 * real visitor sees, and shows the exact status the draft is currently
 * in.
 */
export function DraftModeBanner({ status }: { status?: string }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <span>
        <strong className="font-semibold">Draft preview</strong>
        {status && status !== 'published' ? ` — status: ${status}` : ' — showing current draft'}.
        Not visible to customers.
      </span>
      <a href="/api/draft/disable" className="font-medium underline underline-offset-2">
        Exit preview
      </a>
    </div>
  );
}
