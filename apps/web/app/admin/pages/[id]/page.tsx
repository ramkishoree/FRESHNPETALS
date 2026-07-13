import { notFound } from 'next/navigation';
import { StaticPageEditor } from '@/components/admin/static-page-editor';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStaticPage({ params }: PageProps) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: page } = await admin
    .from('static_pages')
    .select('id, title, slug, status, content')
    .eq('id', id)
    .maybeSingle();
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-h2 text-foreground font-bold">Edit page</h1>
      <StaticPageEditor page={page} />
    </div>
  );
}
