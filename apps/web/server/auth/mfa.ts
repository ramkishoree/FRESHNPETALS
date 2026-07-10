'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Ch.15 §17: MFA is administrator-only in v1 (TOTP). Thin wrappers around
 * Supabase Auth's MFA API — enrollment/verification UI is a Phase 8 (Admin
 * Dashboard → Settings → Security) concern; this is the logic it will call.
 */

export async function enrollTotpFactor() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) return { success: false as const, error: error.message };
  return {
    success: true as const,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyTotpEnrollment(input: { factorId: string; code: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: input.factorId,
  });
  if (challengeError) return { success: false as const, error: challengeError.message };

  const { error } = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId: challenge.id,
    code: input.code,
  });
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

export async function unenrollTotpFactor(factorId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

export async function listMfaFactors() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { success: false as const, error: error.message, factors: [] };
  return { success: true as const, factors: data.totp };
}
