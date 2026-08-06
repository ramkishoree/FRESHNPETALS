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
  sendEmailCode,
  signInWithPassword,
  verifyEmailCode,
  signUpWithPassword,
} from '@/server/auth/actions';

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Owner's explicit call: skip signup friction. Email + a 6-digit code is
 * the default for both logging in and creating an account — Supabase's
 * OTP flow auto-creates the user on first use, so there's no separate
 * "sign up" step to sit through. Google is one tap. Password stays
 * available behind "Use a password instead" for anyone who set one up
 * before this change, or just prefers it.
 *
 * This was a magic link until it kept failing in production: the link
 * opens in whatever browser the mail app prefers, which is not the one
 * holding the PKCE verifier, so valid links were reported as expired.
 * A code is typed back into the tab that asked for it, so there is no
 * second browser, nothing for a mail scanner to consume by pre-opening,
 * and no tab left waiting on an event it cannot observe.
 */
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [usePassword, setUsePassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [codeSent, setCodeSent] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [resendIn, setResendIn] = React.useState(0);
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = React.useState(false);

  const nextPath = safeNextPath(searchParams.get('next'));

  // Resend cooldown — stops someone hammering the button and tripping
  // Supabase's own send limits, which would lock them out of the code
  // they are waiting for.
  React.useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function sendCode(): Promise<boolean> {
    const result = await sendEmailCode({ email, ...(fullName ? { fullName } : {}) });
    if (!result.success) {
      toast.error(result.error ?? 'Could not send the code.');
      return false;
    }
    setResendIn(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  async function handleRequestCode(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (await sendCode()) setCodeSent(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    setIsSubmitting(true);
    try {
      if (await sendCode()) toast.success('New code sent.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await verifyEmailCode({ email, token: code });
      if (!result.success) {
        toast.error(result.error ?? 'That code did not work.');
        setCode('');
        return;
      }
      toast.success('Signed in.');
      router.push(nextPath);
      router.refresh();
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
        setAwaitingEmailConfirm(true);
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

  if (awaitingEmailConfirm) {
    return (
      <div className="space-y-2">
        <p className="text-body text-foreground">
          Check <strong>{email}</strong> to confirm your account, then sign in.
        </p>
        <p className="text-caption text-muted-foreground">
          Signing up with a password still needs one confirmation email. Everything after that is
          just email and password.
        </p>
      </div>
    );
  }

  if (codeSent) {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-4">
        <div className="space-y-1">
          <p className="text-body text-foreground">
            We sent a 6-digit code to <strong>{email}</strong>.
          </p>
          <p className="text-caption text-muted-foreground">
            Enter it below to finish {mode === 'signup' ? 'creating your account' : 'signing in'}.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            // `one-time-code` is what lets iOS and Chrome offer the code
            // straight from the notification, which is most of why typing
            // one beats opening a link on a phone.
            autoComplete="one-time-code"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            placeholder="000000"
            className="text-center text-lg tracking-[0.4em]"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting || code.length !== 6}>
          {isSubmitting ? 'Verifying...' : 'Verify and continue'}
        </Button>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => void resendCode()}
            disabled={resendIn > 0 || isSubmitting}
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </Button>
          <button
            type="button"
            className="text-caption text-muted-foreground underline underline-offset-2"
            onClick={() => {
              setCodeSent(false);
              setCode('');
            }}
          >
            Use a different email
          </button>
        </div>
      </form>
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

      <form onSubmit={usePassword ? handlePasswordSubmit : handleRequestCode} className="space-y-4">
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
