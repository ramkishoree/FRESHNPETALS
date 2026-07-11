import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getPublicEnv } from '@/config/env';
import { JsonLd } from '@/components/seo/json-ld';
import { formatDate } from '@/lib/format-date';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('blogs')
    .select('title, excerpt')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return { title: 'Article not found | Fresh & Petals' };
  return { title: `${data.title} | Fresh & Petals`, description: data.excerpt ?? undefined };
}

interface BlogBlock {
  block_type: string;
  content: { text?: string; level?: number; url?: string; alt?: string };
}

/** Ch.6 Blog Information Architecture — block-based content (migration 0009's blog_blocks), same editor-upgrades-never-need-a-schema-change rationale as the CMS pages table. Initial block set: paragraph/heading/image. */
function BlockRenderer({ block, index }: { block: BlogBlock; index: number }) {
  switch (block.block_type) {
    case 'heading': {
      const level = block.content.level ?? 2;
      const className =
        level === 2 ? 'text-h2 font-bold text-foreground' : 'text-h3 font-semibold text-foreground';
      return <p className={className}>{block.content.text}</p>;
    }
    case 'image':
      return block.content.url ? (
        <div key={index} className="rounded-image bg-muted relative aspect-video overflow-hidden">
          <Image
            src={block.content.url}
            alt={block.content.alt ?? ''}
            fill
            className="object-cover"
          />
        </div>
      ) : null;
    case 'paragraph':
    default:
      return <p className="text-body text-foreground whitespace-pre-line">{block.content.text}</p>;
  }
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: blog } = await supabase
    .from('blogs')
    .select('id, title, excerpt, featured_image, published_at, reading_time_minutes')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!blog) notFound();

  const { data: blocks } = await supabase
    .from('blog_blocks')
    .select('block_type, content')
    .eq('blog_id', blog.id)
    .order('position', { ascending: true });

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const blogUrl = `${appUrl}/blog/${slug}`;

  return (
    <article className="container-brand max-w-3xl space-y-6 py-10">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: blog.title,
          ...(blog.excerpt ? { description: blog.excerpt } : {}),
          ...(blog.featured_image ? { image: [blog.featured_image] } : {}),
          ...(blog.published_at ? { datePublished: blog.published_at } : {}),
          author: { '@type': 'Organization', name: 'Fresh & Petals' },
          publisher: {
            '@type': 'Organization',
            name: 'Fresh & Petals',
            logo: { '@type': 'ImageObject', url: `${appUrl}/icon.svg` },
          },
          mainEntityOfPage: blogUrl,
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: appUrl },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${appUrl}/blog` },
            { '@type': 'ListItem', position: 3, name: blog.title, item: blogUrl },
          ],
        }}
      />
      <header className="space-y-2">
        <h1 className="text-hero text-foreground font-bold">{blog.title}</h1>
        <p className="text-caption text-muted-foreground">
          {blog.published_at && formatDate(blog.published_at)}
          {blog.reading_time_minutes ? ` · ${blog.reading_time_minutes} min read` : ''}
        </p>
      </header>

      {blog.featured_image && (
        <div className="rounded-image bg-muted relative aspect-video overflow-hidden">
          <Image src={blog.featured_image} alt="" fill className="object-cover" />
        </div>
      )}

      <div className="space-y-4">
        {(blocks ?? []).map((block, index) => (
          <BlockRenderer key={index} block={block as BlogBlock} index={index} />
        ))}
      </div>
    </article>
  );
}
