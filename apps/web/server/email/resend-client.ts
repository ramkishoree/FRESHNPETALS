import 'server-only';
import { Resend } from 'resend';
import { getServerEnv } from '@/config/env';

/** The only file allowed to import the Resend SDK — same one-adapter-per-provider discipline as razorpay-adapter.ts/meta-client.ts. */
export function isEmailConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error('Email is not configured (RESEND_API_KEY/RESEND_FROM_EMAIL missing).');
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) throw new Error(error.message);
}
