import { notFound } from 'next/navigation';
import { BlogEditor } from '@/components/admin/blog-editor';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPage({ params }: PageProps) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: blog } = await admin
    .from('blogs')
    .select('id, title, slug, excerpt, featured_image, status')
    .eq('id', id)
    .maybeSingle();
  if (!blog) notFound();

  const { data: blocks } = await admin
    .from('blog_blocks')
    .select('block_type, content')
    .eq('blog_id', id)
    .order('position', { ascending: true });

  const initialBlocks = (blocks ?? []).map((row) => {
    const content = row.content as { text?: string; level?: number; url?: string; alt?: string };
    return {
      blockType: row.block_type as 'heading' | 'paragraph' | 'image',
      ...content,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-h2 text-foreground font-bold">Edit post</h1>
      <BlogEditor
        blog={{
          id: blog.id,
          title: blog.title,
          slug: blog.slug,
          excerpt: blog.excerpt ?? '',
          featured_image: blog.featured_image ?? '',
          status: blog.status,
        }}
        initialBlocks={initialBlocks}
      />
    </div>
  );
}
