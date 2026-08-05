import Link from 'next/link';
import { AuthForm } from '@/components/storefront/auth-form';
import { safeNextPath } from '@/lib/safe-next-path';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Carried across the login/signup switch: a customer sent here from
  // checkout who decides to register instead must still land back on
  // checkout, not on /account with their order abandoned.
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);

  return (
    <div className="container-brand flex justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-h2 text-foreground font-bold">Create an account</h1>
          <p className="text-body text-muted-foreground">Track orders, save addresses, and more.</p>
        </div>
        <AuthForm mode="signup" />
        <p className="text-body text-muted-foreground text-center">
          Already have an account?{' '}
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="text-primary underline underline-offset-2"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
