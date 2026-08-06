'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeNextPath } from '@/lib/safe-next-path';
import {
  getGoogleSignInUrl,
  sendMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from '@/server/auth/actions';

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Owner's explicit call: skip signup friction. Email + a magic link is
 * the default for both logging in and creating an account — Supabase's
 * OTP flow auto-creates the user on first use, so there's no separate
 * "sign up" step to sit through. Google is one tap. Password stays
 * available behind "Use a password instead" for anyone who set one up
 * before this change, or just prefers it — nothing already built is
 * removed, it's just no longer the first thing a new visitor has to do.
 */
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [usePassword, setUsePassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [linkSent, setLinkSent] = React.useState(false);
  const [timedOut, setTimedOut] = React.useState(false);
  const [isCheckingNow, setIsCheckingNow] = React.useState(false);

  const nextPath = safeNextPath(searchParams.get('next'));

  const attemptSignIn = React.useCallback(async () => {
    if (!password) return false;
    const result = await signInWithPassword({ email, password });
    if (result.success) {
      toast.success('Signed in.');
      router.push(nextPath);
      router.refresh();
      return true;
    }
    return false;
  }, [email, password, router, nextPath]);

  /**
   * The magic-link path used to sit on "check your email" forever. The
   * old assumption was that the link resolves in this same tab, so
   * nothing here needed to watch for it — but the link opens wherever
   * the mail app decides, usually a new tab. This tab shares the
   * browser's cookies with that one, so once the link is used the
   * session is right here; it just has to notice.
   */
  React.useEffect(() => {
    if (!linkSent || password) return;
    const startedAt = Date.now();
    const interval = window.setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        window.clearInterval(interval);
        setTimedOut(true);
        return;
      }
      try {
        const response = await fetch('/api/v1/auth/session-check', { cache: 'no-store' });
        const body = await response.json();
        if (body?.signedIn) {
          window.clearInterval(interval);
          toast.success('Signed in.');
          router.push(nextPath);
          router.refresh();
        }
      } catch {
        // Offline or a blip — keep waiting, the timeout still bounds it.
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [linkSent, password, router, nextPath]);

  // The password-signup path confirms by retrying the credentials.
  React.useEffect(() => {
    if (!linkSent || !password) return;
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
  }, [linkSent, password, attemptSignIn]);

  async function handleMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await sendMagicLink({ email, ...(fullName ? { fullName } : {}) });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to send link.');
        return;
      }
      setLinkSent(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const result = await signUpWithPassword({
          email,
          password,
          ...(fullName ? { fullName } : {}),
        });
        if (!result.success) {
          toast.error(result.error ?? 'Sign up failed.');
          return;
        }
        setLinkSent(true);
        return;
      }
      const result = await signInWithPassword({ email, password });
      if (!result.success) {
        toast.error(result.error ?? 'Sign in failed.');
        return;
      }
      router.push(nextPath);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogle() {
    // Carry the pending destination through the OAuth round trip, or a
    // customer who signs in from checkout comes back to /account with
    // their checkout gone.
    const url = await getGoogleSignInUrl(nextPath);
    if (!url) {
      toast.error('Google sign-in is not available right now.');
      return;
    }
    window.location.href = url;
  }

  async function checkNow() {
    setIsCheckingNow(true);
    try {
      // Password path re-tries the credentials; the magic-link path has
      // none to retry, so it asks the server whether this browser's
      // cookies now carry a session.
      if (password) {
        const confirmed = await attemptSignIn();
        if (!confirmed) toast.error('Not confirmed yet — check your inbox and spam folder.');
        return;
      }

      const response = await fetch('/api/v1/auth/session-check', { cache: 'no-store' });
      const body = await response.json();
      if (body?.signedIn) {
        toast.success('Signed in.');
        router.push(nextPath);
        router.refresh();
        return;
      }
      toast.error('Not confirmed yet — check your inbox and spam folder.');
    } finally {
      setIsCheckingNow(false);
    }
  }

  if (linkSent) {
    return (
      <div className="space-y-3">
        <p className="text-body text-foreground">
          Check <strong>{email}</strong> for a link to finish{' '}
          {mode === 'signup' ? 'creating your account' : 'signing in'}.
        </p>
        {!timedOut ? (
          <p className="text-caption text-muted-foreground">
            Keep this tab open — it signs you in on its own once you&apos;ve opened the link.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-caption text-muted-foreground">
              Still waiting. If you opened the link on another device, sign in there — or confirm it
              here and then:
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
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => void handleGoogle()}
      >
        Continue with Google
      </Button>

      <div className="text-caption text-muted-foreground flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>

      <form onSubmit={usePassword ? handlePasswordSubmit : handleMagicLink} className="space-y-4">
        {mode === 'signup' && (
          <div className="grid gap-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        )}
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
        {usePassword && (
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting
            ? 'Please wait...'
            : usePassword
              ? mode === 'signup'
                ? 'Create account'
                : 'Sign in'
              : 'Continue with email'}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setUsePassword((prev) => !prev)}
        className="text-caption text-muted-foreground hover:text-foreground w-full text-center underline underline-offset-2"
      >
        {usePassword ? 'Use email link instead' : 'Use a password instead'}
      </button>
    </div>
  );
}
