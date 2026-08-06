import { Suspense } from 'react';
import { ConfirmedNotice } from '@/components/storefront/confirmed-notice';

/**
 * Shown in whichever tab opened the email link, once the session is
 * already established by /auth/confirm. Its whole job is to say "you're
 * in" and get out of the way.
 */
export default function AuthConfirmedPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmedNotice />
    </Suspense>
  );
}
