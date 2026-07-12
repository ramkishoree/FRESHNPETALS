import Link from 'next/link';
import { AuthForm } from '@/components/storefront/auth-form';

export default function SignupPage() {
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
          <Link href="/login" className="text-primary underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
