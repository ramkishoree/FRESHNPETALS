import Link from 'next/link';
import { AuthForm } from '@/components/storefront/auth-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { safeNextPath } from '@/lib/safe-next-path';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; reason?: string }>;
}) {
  // Set by /auth/callback when an OAuth or email-link round trip comes
  // back refused — otherwise the failure is invisible and the user just
  // lands back on a blank sign-in form.
  const { error, next, reason } = await searchParams;
  const nextPath = safeNextPath(next);
  // `proxy.ts` sends admins here with reason=session_expired once their
  // session passes the 12h admin limit. Without this the redirect looked
  // like sign-in had simply failed for no reason.
  const notice =
    error ?? (reason === 'session_expired' ? 'Your admin session expired. Sign in again.' : null);

  return (
    <div className="container-brand flex justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-h2 text-foreground font-bold">Sign in</h1>
          <p className="text-body text-muted-foreground">Welcome back to Fresh N Petals.</p>
        </div>
        {notice ? (
          <Alert variant="destructive">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}
        <AuthForm mode="login" />
        <p className="text-body text-muted-foreground text-center">
          New here?{' '}
          <Link
            href={`/signup?next=${encodeURIComponent(nextPath)}`}
            className="text-primary underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
