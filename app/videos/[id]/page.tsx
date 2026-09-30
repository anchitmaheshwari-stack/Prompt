import { notFound } from 'next/navigation';
import { SHEET_ID } from '@/lib/sheetdb.mjs';
import { dateRange, getVideo, timeAgo, todayIST } from '@/lib/videos';
import SheetError from '../SheetError';
import Dashboard from './Dashboard';
import type { Dashboard as Data, Day } from '../types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getVideo(id).catch(() => null);
  return { title: `${data?.video.title ?? id} · Video tracker` };
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let loaded;
  try {
    loaded = await getVideo(id);
  } catch (e) {
    return <SheetError error={e} />;
  }
  if (!loaded) return notFound();
  const { video, store } = loaded;

  const days: Day[] = dateRange(video.blogPublished, todayIST()).map((date) => {
    const r = store.daily[date] ?? {};
    const c = store.counters[date];
    return {
      date,
      ytTotal: c?.views ?? null,
      ytLikes: c?.likes ?? null,
      ytViews: r.yt?.views ?? null,
      ytEmbedded: r.yt?.locations?.EMBEDDED ?? null,
      ytAvgSec: r.yt?.avgSec ?? null,
      ytAvgPct: r.yt?.avgPct ?? null,
      pageViews: r.mp?.pageViews ?? null,
      visitors: r.mp?.pageUsers ?? null,
      plays: r.mp?.plays ?? null,
      completions: r.mp?.completions ?? null,
      impressions: r.gsc?.impressions ?? null,
      clicks: r.gsc?.clicks ?? null,
      ctr: r.gsc?.ctr ?? null,
      position: r.gsc?.position ?? null,
    };
  });

  const names: Record<string, string> = { youtube: 'YouTube', gsc: 'Search Console', mixpanel: 'Mixpanel', page: 'Page check' };
  const data: Data = {
    video,
    days,
    updatedLabel: timeAgo(store.updatedAt),
    sources: Object.entries(names).map(([key, name]) => ({
      name,
      ok: !!store.status[key]?.ok,
      detail: store.status[key]?.error ?? 'not run yet',
    })),
    health: store.health ? { embedFound: store.health.embedFound, videoObjectSchema: store.health.videoObjectSchema } : null,
    breakdowns: {
      trafficSources: (store.sources ?? []).map((s) => ({ label: s.source, value: s.views })),
      locations: (store.locations ?? []).map((l) => ({ label: l.location, value: l.views })),
      embeds: (store.embeds ?? []).map((e) => ({ label: e.site, value: e.views })),
      retention: store.retention ?? [],
      queries: store.queries ?? [],
    },
    sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
  };

  return <Dashboard data={data} />;
}
