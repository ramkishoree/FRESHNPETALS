'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithPassword, signUpWithPassword } from '@/server/auth/actions';

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Confirming the signup email on a different device (e.g. phone) than the
 * one that submitted the form (e.g. laptop) doesn't hand this tab a
 * session automatically — Supabase's confirmation link only establishes a
 * session on whichever device opens it. So this tab polls by repeatedly
 * attempting the real sign-in with the credentials already in memory:
 * `signInWithPassword` fails with `pending: true` (not a lockout-counted
 * failure — see actions.ts) until the email is confirmed, then succeeds
 * and this device gets its own session too.
 */
export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [timedOut, setTimedOut] = React.useState(false);
  const [isCheckingNow, setIsCheckingNow] = React.useState(false);

  const attemptSignIn = React.useCallback(async () => {
    const result = await signInWithPassword({ email, password });
    if (result.success) {
      toast.success('Email confirmed! Signing you in...');
      router.push(searchParams.get('next') ?? '/account');
      router.refresh();
      return true;
    }
    return false;
  }, [email, password, router, searchParams]);

  React.useEffect(() => {
    if (!submitted) return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        window.clearInterval(interval);
        setTimedOut(true);
        return;
      }
      void attemptSignIn();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [submitted, attemptSignIn]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await signUpWithPassword({
        email,
        password,
        ...(fullName ? { fullName } : {}),
      });
      if (!result.success) {
        toast.error(result.error ?? 'Sign up failed.');
        return;
      }
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function checkNow() {
    setIsCheckingNow(true);
    try {
      const confirmed = await attemptSignIn();
      if (!confirmed) toast.error('Not confirmed yet — check your inbox and spam folder.');
    } finally {
      setIsCheckingNow(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-3">
        <p className="text-body text-foreground">
          Check <strong>{email}</strong> for a confirmation link to finish creating your account.
        </p>
        {!timedOut ? (
          <p className="text-caption text-muted-foreground">
            Confirm on any device — this page signs you in automatically once it&apos;s done.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-caption text-muted-foreground">
              Still waiting? Confirm the email, then:
            </p>
            <Button type="button" variant="outline" onClick={checkNow} disabled={isCheckingNow}>
              {isCheckingNow ? 'Checking...' : "I've confirmed, sign me in"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  );
}
