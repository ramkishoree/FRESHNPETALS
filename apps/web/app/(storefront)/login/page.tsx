import Link from 'next/link';
import { AuthForm } from '@/components/storefront/auth-form';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Set by /auth/callback when an OAuth or email-link round trip comes
  // back refused — otherwise the failure is invisible and the user just
  // lands back on a blank sign-in form.
  const { error } = await searchParams;

  return (
    <div className="container-brand flex justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-h2 text-foreground font-bold">Sign in</h1>
          <p className="text-body text-muted-foreground">Welcome back to Fresh &amp; Petals.</p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AuthForm mode="login" />
        <p className="text-body text-muted-foreground text-center">
          New here?{' '}
          <Link href="/signup" className="text-primary underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
