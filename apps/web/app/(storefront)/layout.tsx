import { SiteFooter } from '@/components/storefront/site-footer';
import { SiteHeader } from '@/components/storefront/site-header';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .limit(8);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader categories={categories ?? []} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
