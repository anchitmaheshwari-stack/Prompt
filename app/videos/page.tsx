import Link from 'next/link';
import { SHEET_ID } from '@/lib/sheetdb.mjs';
import { dateRange, getVideo, latestCounter, listVideos, sum, timeAgo, todayIST } from '@/lib/videos';
import SheetError from './SheetError';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Video tracker' };

const int = (v: number) => Math.round(v).toLocaleString('en-IN');

/** Tiny page-views trend for a card; the full chart lives on the video page. */
function Sparkline({ values, marker }: { values: (number | null)[]; marker: number }) {
  const W = 220;
  const H = 44;
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const x = (i: number) => (values.length > 1 ? (i * W) / (values.length - 1) : W / 2);
  const y = (v: number) => 4 + (1 - v / max) * (H - 8);
  const d = values
    .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean)
    .map((p, i) => `${i ? 'L' : 'M'}${p}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-11" aria-hidden preserveAspectRatio="none">
      {marker >= 0 && <rect x={x(marker)} y={0} width={W - x(marker)} height={H} fill="var(--series-1-wash)" />}
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default async function VideosIndex() {
  let entries;
  try {
    const videos = await listVideos();
    entries = await Promise.all(videos.map(async (v) => ({ v, store: (await getVideo(v.videoId))!.store })));
  } catch (e) {
    return <SheetError error={e} />;
  }
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm mb-5" style={{ color: 'var(--ink-3)' }}>
        <Link href="/prompts" className="hover:underline">← All prompts</Link>
      </nav>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Video tracker</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-2)' }}>
            How each AI-generated YouTube video performs, and whether it lifts the blog it sits on.
          </p>
        </div>
        <a href={sheetUrl} target="_blank" rel="noreferrer" className="rounded-full px-4 py-2 text-sm hover:underline" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          Open data sheet ↗
        </a>
      </header>

      {entries.length === 0 ? (
        <div className="viz-card p-8 text-center">
          <p className="font-medium">No videos yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-2)' }}>Add a row to the <code>videos</code> tab of the data sheet, then run <code>npm run videos:snapshot</code>.</p>
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-4">
          {entries.map(({ v, store }) => {
            const c = latestCounter(store);
            const plays = sum(store, v.addedOn, (d) => d.mp?.plays);
            const views = sum(store, v.addedOn, (d) => d.mp?.pageViews);
            const dates = dateRange(v.blogPublished, todayIST());
            // Only the data sources count here; page checks (schema etc.) are shown on the video page.
            const allOk = ['youtube', 'gsc', 'mixpanel'].every((k) => store.status[k]?.ok);
            return (
              <li key={v.videoId}>
                <Link href={`/videos/${v.videoId}`} className="viz-card block p-4 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--series-1)]">
                  <div className="flex gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`} alt="" className="w-32 aspect-video rounded-md object-cover shrink-0" />
                    <div className="min-w-0">
                      <h2 className="font-semibold leading-snug line-clamp-2">{v.title}</h2>
                      <p className="text-xs mt-1 truncate" style={{ color: 'var(--ink-3)' }}>{v.blogUrl.replace('https://www.skydo.com', '')}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      ['YouTube views', c ? int(c.views) : '–'],
                      ['Plays on blog', int(plays)],
                      ['Play rate', views ? `${Math.round((plays / views) * 100)}%` : '–'],
                    ].map(([k, val]) => (
                      <div key={k}>
                        <dt className="text-xs" style={{ color: 'var(--ink-2)' }}>{k}</dt>
                        <dd className="text-xl font-semibold">{val}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3">
                    <div className="text-[11px] mb-0.5" style={{ color: 'var(--ink-3)' }}>Blog page views · shaded since the video went in</div>
                    <Sparkline values={dates.map((d) => store.daily[d]?.mp?.pageViews ?? null)} marker={dates.indexOf(v.addedOn)} />
                  </div>
                  <div className="flex justify-between text-xs mt-3" style={{ color: 'var(--ink-3)' }}>
                    <span>Added to blog {new Date(v.addedOn + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <span>
                      <span aria-hidden style={{ color: allOk ? 'var(--good)' : 'var(--critical)' }}>{allOk ? '●' : '▲'}</span>{' '}
                      {allOk ? 'All sources OK' : 'A source failed'} · updated {timeAgo(store.updatedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <details className="mt-8 text-sm" style={{ color: 'var(--ink-2)' }}>
        <summary className="cursor-pointer" style={{ color: 'var(--ink-3)' }}>How to track another video</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>Open the <a href={sheetUrl} target="_blank" rel="noreferrer" className="underline">data sheet</a> and add a row to the <code>videos</code> tab.</li>
          <li>Fill <code>video_id</code> (the part after <code>v=</code> in the YouTube link), <code>title</code>, <code>blog_url</code>, and the three dates as YYYY-MM-DD.</li>
          <li>Run <code>npm run videos:snapshot</code> and reload this page.</li>
        </ol>
      </details>
    </main>
  );
}
