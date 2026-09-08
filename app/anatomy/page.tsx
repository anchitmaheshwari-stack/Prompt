import Link from 'next/link';
import { listAnatomies } from '@/lib/anatomy';

export const dynamic = 'force-dynamic';

export default function AnatomyIndex() {
  const items = listAnatomies();
  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="mb-6 text-sm">
        <Link href="/prompts" className="text-gray-500 hover:text-gray-900">← All prompts</Link>
      </div>
      <h1 className="text-2xl font-semibold mb-1">Page anatomy</h1>
      <p className="text-sm text-gray-600 mb-6">
        Side-by-side teardowns of a competitor page that ChatGPT cites and the Skydo page that competes for the same query.
        Numbers come from Peec (ChatGPT only) and from the pages as crawled.
      </p>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.slug} className="border border-gray-200 rounded-lg p-4">
            <Link href={`/anatomy/${a.slug}`} className="font-medium hover:underline">{a.title}</Link>
            <div className="text-xs text-gray-500 mt-1">
              {a.pages.a.label}: {a.pages.a.retrievals} retrievals / {a.pages.a.citations} citations ·{' '}
              {a.pages.b.label}: {a.pages.b.retrievals} / {a.pages.b.citations}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
