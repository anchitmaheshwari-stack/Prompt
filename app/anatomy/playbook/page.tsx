import Link from 'next/link';
import { listAnatomies } from '@/lib/anatomy';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Content playbook · Page anatomy' };

function rate(p: { retrievals: number; citations: number }) {
  return p.retrievals ? (p.citations / p.retrievals).toFixed(2) : '–';
}

export default function PlaybookPage() {
  const everything = listAnatomies();
  const all = everything.filter((a) => a.playbook);
  const items = all.filter((a) => !a.branded_only);
  const branded = all.filter((a) => a.branded_only);
  const siblings = (bucket?: string) => everything.filter((x) => x.bucket === bucket && !x.playbook);
  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="mb-6 text-sm flex gap-4">
        <Link href="/anatomy" className="text-gray-500 hover:text-gray-900">← Page anatomy</Link>
        <Link href="/prompts" className="text-gray-500 hover:text-gray-900">All prompts</Link>
      </div>
      <h1 className="text-2xl font-semibold mb-1">Content playbook</h1>
      <p className="text-sm text-gray-600 mb-2">
        One blueprint per content bucket, derived from the page ChatGPT cites most in that bucket and the Skydo page that competes with it.
        ChatGPT only, unbranded prompts only (the 105 prompts Peec tags non-branded), 2026-06-06 to 2026-09-04. Each bucket links to its full side-by-side teardown.
      </p>
      <p className="text-sm text-gray-600 mb-8">
        The rule underneath every bucket: ChatGPT answers each query in a fixed shape, and it cites the page whose blocks already match that shape.
        Write the page as the answer, block for block, with a heading per block, a number or date in every block, and the brand named once.
      </p>

      <nav className="mb-8 border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Buckets</div>
        <ol className="list-decimal pl-5 text-sm space-y-1">
          {items.map((a) => (
            <li key={a.slug}>
              <a href={`#${a.slug}`} className="hover:underline">{a.playbook!.bucket}</a>
              <span className="text-gray-500">
                {' '}· {a.pages.a.label} {rate(a.pages.a)} vs {a.pages.b.label} {rate(a.pages.b)} citations per fetch
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-10">
        {items.map((a, i) => {
          const pb = a.playbook!;
          return (
            <section key={a.slug} id={a.slug} className="border border-gray-200 rounded-lg p-6 bg-white scroll-mt-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bucket {i + 1}</div>
              <h2 className="text-xl font-semibold mt-1">{pb.bucket}</h2>
              <p className="text-sm text-gray-700 mt-2">
                <span className="font-semibold">Use when: </span>
                {pb.use_when}
              </p>
              <div className="grid md:grid-cols-2 gap-3 mt-4 text-xs">
                {[a.pages.a, a.pages.b].map((p) => (
                  <div key={p.label} className="border border-gray-100 rounded-md p-3 bg-gray-50">
                    <div className="font-semibold text-gray-700">{p.label}</div>
                    <a href={p.url} target="_blank" rel="noreferrer" className="block break-all text-gray-600 hover:underline">{p.url}</a>
                    <div className="mt-1 text-gray-600">
                      {p.citations} citations / {p.retrievals} fetches · <span className="font-semibold">{rate(p)} per fetch</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid md:grid-cols-[3fr_2fr] gap-6 mt-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Blueprint, top to bottom</div>
                  <ol className="list-decimal pl-5 space-y-2 text-sm">
                    {pb.blueprint.map((d, j) => (
                      <li key={j}>{d}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Evidence</div>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                    {pb.evidence.map((d, j) => (
                      <li key={j}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-5 text-sm space-y-1">
                <p>
                  <Link href={`/anatomy/${a.slug}`} className="font-medium hover:underline">
                    Full teardown: {a.title} →
                  </Link>
                </p>
                {siblings(a.bucket).map((s) => (
                  <p key={s.slug}>
                    <Link href={`/anatomy/${s.slug}`} className="hover:underline text-gray-700">
                      Also in this bucket: {s.title} →
                    </Link>
                  </p>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {branded.length > 0 && (
        <section className="mt-10 border border-dashed border-gray-300 rounded-lg p-5 text-sm text-gray-600">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Not in the unbranded playbook</div>
          {branded.map((a) => (
            <p key={a.slug} className="mb-1">
              <Link href={`/anatomy/${a.slug}`} className="font-medium text-gray-800 hover:underline">{a.playbook!.bucket}</Link>
              {' '}· reached only through branded queries; the teardown is kept for reference.
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
