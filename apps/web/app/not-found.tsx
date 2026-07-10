import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Ch.12 §37 Error States — "friendly error messages... suggest alternatives." */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-hero text-foreground font-bold">404</p>
      <h1 className="text-h2 text-foreground font-bold">Page not found</h1>
      <p className="text-body text-muted-foreground max-w-md">
        The page you&apos;re looking for doesn&apos;t exist. It may have been moved or the link may
        be incorrect.
      </p>
      <Button asChild>
        <Link href="/">Back to homepage</Link>
      </Button>
    </div>
  );
}
