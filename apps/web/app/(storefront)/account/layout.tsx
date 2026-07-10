import { requireUser } from '@/server/auth/session';

/** `proxy.ts` already gates `/account/**` to authenticated sessions (Phase 4); `requireUser()` here is the same defense-in-depth re-check used by `app/admin/layout.tsx`. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="container-brand py-10">{children}</div>;
}
