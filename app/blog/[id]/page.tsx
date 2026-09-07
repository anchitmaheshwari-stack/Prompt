import { supabase, Section, Issue } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import SectionCard from './SectionCard';

export const dynamic = 'force-dynamic';

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: blog } = await supabase
    .from('blogs')
    .select('*')
    .eq('id', id)
    .single();

  if (!blog) return notFound();

  const { data: sections } = await supabase
    .from('sections')
    .select('*')
    .eq('blog_id', id)
    .order('position', { ascending: true });

  const sectionIds = (sections || []).map((s: Section) => s.id);

  const { data: issues } = await supabase
    .from('issues')
    .select('*')
    .in('section_id', sectionIds);

  const issuesBySection: Record<string, Issue[]> = {};
  for (const issue of issues || []) {
    if (!issuesBySection[issue.section_id]) {
      issuesBySection[issue.section_id] = [];
    }
    issuesBySection[issue.section_id].push(issue);
  }

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← Back to inbox
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">{blog.title || blog.doc_id}</h1>
      <p className="text-sm text-gray-500 mb-8">
        {blog.freelancer} · {new Date(blog.created_at).toLocaleString()} ·{' '}
        <a
          href={blog.doc_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Original Doc
        </a>
      </p>

      <div className="mb-8 flex justify-end">
        <Link
          href={`/blog/${id}/export`}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-800"
        >
          Export final article →
        </Link>
      </div>

      <div className="space-y-6">
        {(sections || []).map((section: Section, index: number) => (
          <SectionCard
            key={section.id}
            section={section}
            issues={issuesBySection[section.id] || []}
            index={index}
          />
        ))}
      </div>
    </main>
  );
}