import { supabase, Blog } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const { data: blogs, error } = await supabase
    .from('blogs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Error loading blogs</h1>
        <pre className="text-red-600">{error.message}</pre>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Fact-Check Inbox</h1>
        <Link href="/prompts" className="text-sm text-gray-600 hover:text-gray-900 underline">
          Prompt RCA →
        </Link>
      </div>
      <div className="space-y-3">
        {blogs?.map((blog: Blog) => (
          <Link
            key={blog.id}
            href={`/blog/${blog.id}`}
            className="block p-4 border rounded-lg hover:bg-gray-50 transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{blog.title || blog.doc_id}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {blog.freelancer} · {new Date(blog.created_at).toLocaleDateString()}
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                blog.status === 'approved'
                  ? 'bg-green-100 text-green-800'
                  : blog.status === 'ready_for_review'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {blog.status}
              </span>
            </div>
          </Link>
        ))}
        {blogs?.length === 0 && (
          <p className="text-gray-500">No blogs yet. Run the n8n pipeline to add some.</p>
        )}
      </div>
    </main>
  );
}