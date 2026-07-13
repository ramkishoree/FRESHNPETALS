import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { EmptyState } from '@/components/states/empty-state';
import { Reveal } from '@/components/storefront/reveal';
import { formatDate } from '@/lib/format-date';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Blog | Fresh & Petals' };

/** Ch.6 Blog Information Architecture. */
export default async function BlogListPage() {
  const supabase = await createSupabaseServerClient();
  const { data: blogs } = await supabase
    .from('blogs')
    .select('id, slug, title, excerpt, featured_image, published_at')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(24);

  return (
    <div className="container-brand space-y-6 py-10">
      <h1 className="hero-in text-h2 text-foreground font-bold">Blog</h1>

      {(blogs ?? []).length === 0 ? (
        <EmptyState title="No articles yet" />
      ) : (
        <Reveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(blogs ?? []).map((blog) => (
            <Link key={blog.id} href={`/blog/${blog.slug}`} className="group space-y-2">
              <div className="rounded-image bg-muted relative aspect-4/3 overflow-hidden">
                {blog.featured_image && (
                  <Image
                    src={blog.featured_image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
              </div>
              <p className="text-body text-foreground font-semibold group-hover:underline">
                {blog.title}
              </p>
              {blog.excerpt && <p className="text-caption text-muted-foreground">{blog.excerpt}</p>}
              {blog.published_at && (
                <p className="text-caption text-muted-foreground">
                  {formatDate(blog.published_at)}
                </p>
              )}
            </Link>
          ))}
        </Reveal>
      )}
    </div>
  );
}
