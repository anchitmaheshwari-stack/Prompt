import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAnatomy, type AnatomyPage, type Lifted } from '@/lib/anatomy';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${slug.replace(/-/g, ' ')} · Page anatomy` };
}

function rate(p: AnatomyPage) {
  return p.retrievals ? (p.citations / p.retrievals).toFixed(2) : '–';
}

export default async function AnatomyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getAnatomy(slug);
  if (!a) return notFound();
  const { a: A, b: B } = a.pages;

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6 text-sm flex gap-4">
        <Link href="/anatomy" className="text-gray-500 hover:text-gray-900">← Page anatomy</Link>
        <Link href="/prompts" className="text-gray-500 hover:text-gray-900">All prompts</Link>
      </div>
      <h1 className="text-2xl font-semibold mb-1">{a.title}</h1>
      <p className="text-xs text-gray-500 mb-6">{a.window}</p>

      {/* Header cards */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {[A, B].map((p) => (
          <div key={p.label} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{p.label}</div>
            <a href={p.url} target="_blank" rel="noreferrer" className="block font-medium hover:underline break-words mt-1">
              {p.title}
            </a>
            <div className="text-xs text-gray-500 break-all">{p.url}</div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Stat label="Retrievals" value={String(p.retrievals)} />
              <Stat label="Citations" value={String(p.citations)} />
              <Stat label="Citations / fetch" value={rate(p)} />
            </div>
            <dl className="text-xs text-gray-600 mt-3 space-y-0.5">
              <Row k="Type" v={p.type} />
              <Row k="Author" v={p.author} />
              <Row k="Published / updated" v={`${p.published} / ${p.modified}`} />
              <Row k="Schema" v={p.schema} />
            </dl>
          </div>
        ))}
      </div>
      <p className="border-l-4 border-l-amber-400 bg-amber-50 rounded-r-lg p-4 text-sm mb-8">{a.verdict}</p>

      <Section title="Structure by the numbers">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3 w-44">Metric</th>
                <th className="py-2 pr-3">{A.label}</th>
                <th className="py-2 pr-3">{B.label}</th>
                <th className="py-2">What it means</th>
              </tr>
            </thead>
            <tbody>
              {a.metrics.map((m) => (
                <tr key={m.metric} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-3 font-medium">{m.metric}</td>
                  <td className="py-2 pr-3">{m.a}</td>
                  <td className="py-2 pr-3">{m.b}</td>
                  <td className="py-2 text-gray-600">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Skeleton, top to bottom, as ChatGPT reads it">
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton label={A.label} items={a.skeleton.a} tone="sky" />
          <Skeleton label={B.label} items={a.skeleton.b} tone="rose" />
        </div>
      </Section>

      <Section title="What ChatGPT actually lifted (answer sentence → where it sits on the page)">
        <div className="grid md:grid-cols-2 gap-4">
          <LiftedList label={A.label} items={a.lifted.a} />
          <LiftedList label={B.label} items={a.lifted.b} />
        </div>
      </Section>

      <Section title="Why the gap">
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          {a.diagnosis.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ol>
      </Section>

      <Section title={`Rewrite spec for the ${B.label} page`}>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          {a.spec.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ol>
      </Section>

      {a.playbook && (
        <Section title={`Playbook: ${a.playbook.bucket}`}>
          <p className="text-sm text-gray-700 mb-3">
            <span className="font-semibold">Use when: </span>
            {a.playbook.use_when}
          </p>
          <div className="grid md:grid-cols-[2fr_1fr] gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Blueprint, top to bottom</div>
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                {a.playbook.blueprint.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ol>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Evidence</div>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                {a.playbook.evidence.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded p-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-gray-400">{k}</dt>
      <dd className="break-words">{v}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group border border-gray-200 rounded-lg mb-4 bg-white">
      <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-base font-semibold text-gray-900">{title}</span>
        <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="px-4 pb-5 pt-1 border-t border-gray-100">{children}</div>
    </details>
  );
}

function Skeleton({ label, items, tone }: { label: string; items: string[]; tone: 'sky' | 'rose' }) {
  const bar = tone === 'sky' ? 'border-l-sky-400' : 'border-l-rose-400';
  return (
    <div className={`border border-gray-200 border-l-4 ${bar} rounded-lg p-4`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{label}</div>
      <ol className="list-decimal pl-5 space-y-1 text-sm">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

function LiftedList({ label, items }: { label: string; items: Lifted[] }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{label}</div>
      <ul className="space-y-3 text-sm">
        {items.map((l, i) => (
          <li key={i}>
            <div className="text-xs text-gray-500">{l.chat}</div>
            <blockquote className="border-l-2 border-gray-300 pl-3 my-1 italic">{l.answer}</blockquote>
            <div className="text-xs text-gray-600">↳ {l.page}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
