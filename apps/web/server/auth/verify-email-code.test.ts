// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  verifyOtpMock,
  checkLockoutMock,
  recordLoginAttemptMock,
  recordSessionMock,
  ensureCustomerProfileMock,
} = vi.hoisted(() => ({
  verifyOtpMock: vi.fn(),
  checkLockoutMock: vi.fn(),
  recordLoginAttemptMock: vi.fn(),
  recordSessionMock: vi.fn(),
  ensureCustomerProfileMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { verifyOtp: verifyOtpMock } }),
}));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock('./lockout', () => ({
  checkLockout: checkLockoutMock,
  recordLoginAttempt: recordLoginAttemptMock,
}));
vi.mock('./record-session', () => ({ recordSession: recordSessionMock }));
vi.mock('@/server/customer/ensure-customer-profile', () => ({
  ensureCustomerProfile: ensureCustomerProfileMock,
}));
vi.mock('@/config/env', () => ({
  getPublicEnv: () => ({ NEXT_PUBLIC_APP_URL: 'https://freshnpetals.in' }),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const SESSION = { user: { id: 'user-1', email: 'a@example.com' }, refresh_token: 'r' };

async function load() {
  return import('./actions');
}

describe('verifyEmailCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkLockoutMock.mockResolvedValue({ locked: false });
    verifyOtpMock.mockResolvedValue({
      data: { user: SESSION.user, session: SESSION },
      error: null,
    });
  });

  it('signs in and leaves a session row behind', async () => {
    const { verifyEmailCode } = await load();
    const result = await verifyEmailCode({ email: 'a@example.com', token: '123456' });

    expect(result.success).toBe(true);
    expect(verifyOtpMock).toHaveBeenCalledWith({
      email: 'a@example.com',
      token: '123456',
      type: 'email',
    });
    // The session row is what gates /admin — a sign-in that skips it
    // locks the owner out, which is exactly what happened with OAuth.
    expect(recordSessionMock).toHaveBeenCalledWith(SESSION);
    expect(ensureCustomerProfileMock).toHaveBeenCalled();
  });

  it('rejects a wrong code without leaking whether the account exists', async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'x' },
    });
    const { verifyEmailCode } = await load();

    const result = await verifyEmailCode({ email: 'a@example.com', token: '000000' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('That code is wrong or has expired. Request a new one.');
    expect(recordSessionMock).not.toHaveBeenCalled();
  });

  it('records a failed attempt so code guessing counts toward lockout', async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'x' },
    });
    const { verifyEmailCode } = await load();

    await verifyEmailCode({ email: 'a@example.com', token: '000000' });

    expect(recordLoginAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'a@example.com', success: false }),
    );
  });

  it('refuses once locked out, without spending a verification attempt', async () => {
    checkLockoutMock.mockResolvedValue({ locked: true });
    const { verifyEmailCode } = await load();

    const result = await verifyEmailCode({ email: 'a@example.com', token: '123456' });

    expect(result.success).toBe(false);
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it('rejects anything that is not six digits before calling Supabase', async () => {
    const { verifyEmailCode } = await load();

    for (const token of ['12345', '1234567', 'abcdef', '']) {
      const result = await verifyEmailCode({ email: 'a@example.com', token });
      expect(result.success).toBe(false);
    }
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });
});
