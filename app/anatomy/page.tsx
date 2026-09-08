import Link from 'next/link';
import { listAnatomies } from '@/lib/anatomy';

export const dynamic = 'force-dynamic';

function rate(p: { retrievals: number; citations: number }) {
  return p.retrievals ? (p.citations / p.retrievals).toFixed(2) + ' per fetch' : '–';
}

export default function AnatomyIndex() {
  const items = listAnatomies();
  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="mb-6 text-sm">
        <Link href="/prompts" className="text-gray-500 hover:text-gray-900">← All prompts</Link>
      </div>
      <h1 className="text-2xl font-semibold mb-1">Page anatomy</h1>
      <p className="text-sm text-gray-600 mb-3">
        Side-by-side teardowns of a competitor page that ChatGPT cites and the Skydo page that competes for the same query.
        Numbers come from Peec (ChatGPT only) and from the pages as crawled. One teardown per content bucket; each ends in a blueprint.
      </p>
      <p className="mb-6">
        <Link href="/anatomy/playbook" className="inline-block rounded-md bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700">
          Open the playbook: all bucket blueprints on one page →
        </Link>
      </p>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.slug} className="border border-gray-200 rounded-lg p-4">
            {a.bucket && <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{a.bucket}</div>}
            <Link href={`/anatomy/${a.slug}`} className="font-medium hover:underline">{a.title}</Link>
            <div className="text-xs text-gray-500 mt-1">
              {a.pages.a.label}: {a.pages.a.citations} citations / {a.pages.a.retrievals} fetches ({rate(a.pages.a)}) ·{' '}
              {a.pages.b.label}: {a.pages.b.citations} / {a.pages.b.retrievals} ({rate(a.pages.b)})
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
