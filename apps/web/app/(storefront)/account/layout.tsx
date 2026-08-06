import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';

/**
 * `proxy.ts` already gates `/account/**` to authenticated sessions
 * (Phase 4); this is the same defense-in-depth re-check used by
 * `app/admin/layout.tsx`.
 *
 * It redirects rather than calling `requireUser()`, which throws. On an
 * API route a thrown AuthError becomes a clean 401, but on a *page* it
 * escapes to the nearest error boundary — and a customer arriving here
 * with a lapsed session is not looking at an error, they are looking at
 * a sign-in prompt. The visible symptom was ugly: a COD order completed,
 * the processing page forwarded to the new order, and a session that had
 * gone stale in the meantime turned the confirmation into a dead
 * "couldn't load" page for an order that had genuinely been placed.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account/orders');
  return <div className="container-brand py-10">{children}</div>;
}
