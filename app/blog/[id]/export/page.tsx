import { getSupabase, Blog, Section } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ExportView from './ExportView';

export const dynamic = 'force-dynamic';

export default async function ExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: blog } = await getSupabase()
    .from('blogs')
    .select('*')
    .eq('id', id)
    .single();

  if (!blog) return notFound();

  const { data: sections } = await getSupabase()
    .from('sections')
    .select('*')
    .eq('blog_id', id)
    .order('position', { ascending: true });

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/blog/${id}`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Back to review
        </Link>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          Inbox →
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">Export</h1>
      <p className="text-sm text-gray-500 mb-8">
        {blog.title || blog.doc_id}
      </p>

      <ExportView blog={blog as Blog} sections={(sections || []) as Section[]} />
    </main>
  );
}