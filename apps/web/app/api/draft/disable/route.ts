import { draftMode } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

function safeInternalPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

/** GET /api/draft/disable — the "Exit preview" link shown by the draft-mode banner. */
export async function GET(request: NextRequest) {
  (await draftMode()).disable();
  const path = safeInternalPath(request.nextUrl.searchParams.get('path'));
  return NextResponse.redirect(new URL(path, request.url));
}
