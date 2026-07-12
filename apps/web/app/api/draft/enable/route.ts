import { draftMode } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/session';

/**
 * Safe-redirect guard: `path` must be an internal, single-leading-slash
 * path (no `//host`, no `\\host`, no `http(s)://` scheme) — otherwise an
 * admin clicking a crafted "Preview" link could be bounced off-site.
 */
function safeInternalPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

/**
 * GET /api/draft/enable — Ch.12 §56 admin Preview button. Draft/unpublished
 * content (a static page or product still in `draft`/`pending_review`, not
 * `published`) is otherwise invisible on the storefront by design (every
 * public query filters on status). This flips on Next's Draft Mode, which
 * the same storefront pages check to temporarily lift that filter for the
 * one browser tab that has the draft cookie — so an admin can see exactly
 * how the real page will render before making it public, without a
 * separate preview environment or a live-as-you-type editor.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: 'Administrator sign-in required to preview draft content.' },
      { status: 403 },
    );
  }

  const path = safeInternalPath(request.nextUrl.searchParams.get('path'));
  if (!path) {
    return NextResponse.json({ error: 'Invalid or missing preview path.' }, { status: 400 });
  }

  (await draftMode()).enable();
  return NextResponse.redirect(new URL(path, request.url));
}
