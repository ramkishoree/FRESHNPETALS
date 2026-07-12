import Link from 'next/link';
import { AuthForm } from '@/components/storefront/auth-form';

export default function LoginPage() {
  return (
    <div className="container-brand flex justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-h2 text-foreground font-bold">Sign in</h1>
          <p className="text-body text-muted-foreground">Welcome back to Fresh &amp; Petals.</p>
        </div>
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
