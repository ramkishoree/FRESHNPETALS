import { BlogEditor } from '@/components/admin/blog-editor';

export default function NewBlogPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-h2 text-foreground font-bold">New post</h1>
      <BlogEditor />
    </div>
  );
}
