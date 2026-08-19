import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/server/email/resend-client';

/**
 * Mints a sign-in code and emails it ourselves, instead of asking
 * Supabase to mail it.
 *
 * `signInWithOtp` only sends a code if the project's Magic Link template
 * has been edited to render `{{ .Token }}`; left at its default it keeps
 * sending `{{ .ConfirmationURL }}`, so customers got a link when the UI
 * was asking them for a code — a dashboard setting silently deciding
 * whether the product works. `generateLink` returns the same one-time
 * code as data (`email_otp`), so the delivery is ours: our domain, our
 * wording, our Resend deliverability, and nothing to configure.
 *
 * `type: 'magiclink'` also provisions the user on first use, which is
 * what keeps sign-in and sign-up a single step. The code it returns
 * verifies with `verifyOtp({ type: 'email' })` — confirmed against the
 * live project, along with its length, which is 8 and not the 6 the
 * first version of this assumed.
 */
export async function sendSignInCode(email: string, fullName?: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    ...(fullName ? { options: { data: { full_name: fullName } } } : {}),
  });

  const code = (data?.properties as { email_otp?: string } | undefined)?.email_otp;
  if (error || !code) {
    throw new Error(error?.message ?? 'Supabase returned no sign-in code.');
  }

  await sendEmail({
    to: email,
    subject: `${code} is your Fresh N Petals sign-in code`,
    html: `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1c1917">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#78716c">Fresh N Petals</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Your sign-in code</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6">Enter this code in the tab you started signing in from.</p>
        <p style="margin:0 0 24px;font-size:34px;font-weight:700;letter-spacing:.28em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${code}</p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#57534e">It expires in about an hour and can only be used once.</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#57534e">If you didn't ask to sign in, you can ignore this email — nobody can get in without the code.</p>
      </div>
    `,
  });
}
