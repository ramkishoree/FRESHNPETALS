'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signOut } from '@/server/auth/actions';

export function AccountSignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
