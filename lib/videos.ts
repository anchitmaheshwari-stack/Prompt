import { readTab } from '@/lib/sheetdb.mjs';

export type TrackedVideo = {
  videoId: string;
  title: string;
  blogUrl: string;
  blogPublished: string;
  videoPublished: string;
  /** Day the video was embedded on the blog; the before/after split. */
  addedOn: string;
};

export type DayRow = {
  yt?: {
    views?: number;
    minutes?: number;
    avgSec?: number;
    avgPct?: number;
    /** Views by playback location for the day: EMBEDDED, WATCH, SHORTS. */
    locations?: Record<string, number>;
  };
  gsc?: { clicks: number; impressions: number; ctr: number; position: number };
  mp?: { pageViews: number; pageUsers: number; plays: number; playUsers: number; completions: number };
};

export type SourceStatus = { ok: boolean; at: string; error?: string };

export type VideoStore = {
  videoId: string;
  updatedAt?: string;
  /** Lifetime counters from the YouTube Data API, one per day (last run of the day wins). */
  counters: Record<string, { views: number; likes: number; comments: number; at: string }>;
  daily: Record<string, DayRow>;
  sources?: { source: string; views: number }[];
  locations?: { location: string; views: number }[];
  embeds?: { site: string; views: number }[];
  retention?: { ratio: number; watch: number }[];
  queries?: { query: string; clicks: number; impressions: number; position: number }[];
  health?: { embedFound: boolean; videoObjectSchema: boolean; dateModified: string | null; checkedAt: string };
  status: Record<string, SourceStatus>;
};

type Row = Record<string, string | number | boolean>;

const num = (v: Row[string] | undefined) => (v === '' || v === undefined ? undefined : Number(v));
const str = (v: Row[string] | undefined) => (v === undefined ? '' : String(v));

function toVideo(r: Row): TrackedVideo {
  return {
    videoId: str(r.video_id),
    title: str(r.title),
    blogUrl: str(r.blog_url),
    blogPublished: str(r.blog_published),
    videoPublished: str(r.video_published),
    addedOn: str(r.added_on),
  };
}

export async function listVideos(): Promise<TrackedVideo[]> {
  const { rows } = await readTab('videos');
  return (rows as Row[]).map(toVideo).filter((v) => v.videoId);
}

export async function getVideo(id: string): Promise<{ video: TrackedVideo; store: VideoStore } | null> {
  const [videos, daily, breakdowns, status] = await Promise.all([
    readTab('videos'), readTab('daily'), readTab('breakdowns'), readTab('status'),
  ]);
  const vrow = (videos.rows as Row[]).find((r) => str(r.video_id) === id);
  if (!vrow) return null;

  const store: VideoStore = { videoId: id, counters: {}, daily: {}, status: {} };

  for (const r of (daily.rows as Row[]).filter((r) => str(r.video_id) === id)) {
    const date = str(r.date);
    const row: DayRow = {};
    if (num(r.yt_total_views) !== undefined) {
      store.counters[date] = { views: num(r.yt_total_views)!, likes: num(r.yt_likes) ?? 0, comments: num(r.yt_comments) ?? 0, at: str(r.updated_at) };
    }
    if (num(r.yt_views) !== undefined || num(r.yt_embedded_views) !== undefined) {
      row.yt = {
        views: num(r.yt_views),
        minutes: num(r.yt_minutes),
        avgSec: num(r.yt_avg_view_sec),
        avgPct: num(r.yt_avg_view_pct),
        locations: { EMBEDDED: num(r.yt_embedded_views) ?? 0, WATCH: num(r.yt_watch_page_views) ?? 0, SHORTS: num(r.yt_shorts_views) ?? 0 },
      };
    }
    if (num(r.gsc_impressions) !== undefined) {
      row.gsc = { impressions: num(r.gsc_impressions)!, clicks: num(r.gsc_clicks) ?? 0, ctr: num(r.gsc_ctr) ?? 0, position: num(r.gsc_position) ?? 0 };
    }
    if (num(r.mp_page_views) !== undefined) {
      row.mp = {
        pageViews: num(r.mp_page_views)!, pageUsers: num(r.mp_visitors) ?? 0, plays: num(r.mp_plays) ?? 0,
        playUsers: num(r.mp_play_users) ?? 0, completions: num(r.mp_completions) ?? 0,
      };
    }
    store.daily[date] = row;
  }

  // Breakdowns: the most recent snapshot of each type.
  const mine = (breakdowns.rows as Row[]).filter((r) => str(r.video_id) === id);
  const latest = (type: string) => {
    const rows = mine.filter((r) => r.type === type);
    const last = rows.map((r) => str(r.date)).sort().at(-1);
    return rows.filter((r) => str(r.date) === last).sort((a, b) => (num(b.value) ?? 0) - (num(a.value) ?? 0));
  };
  store.sources = latest('traffic_source').map((r) => ({ source: str(r.label), views: num(r.value) ?? 0 }));
  store.locations = latest('playback_location').map((r) => ({ location: str(r.label), views: num(r.value) ?? 0 }));
  store.embeds = latest('embed_site').map((r) => ({ site: str(r.label), views: num(r.value) ?? 0 }));
  store.retention = latest('retention')
    .map((r) => ({ ratio: Number(r.label), watch: num(r.value) ?? 0 }))
    .sort((a, b) => a.ratio - b.ratio);
  store.queries = latest('query').map((r) => ({
    query: str(r.label), clicks: num(r.value) ?? 0, impressions: num(r.impressions) ?? 0, position: num(r.position) ?? 0,
  }));

  const st = (status.rows as Row[]).filter((r) => str(r.video_id) === id);
  for (const r of st) {
    const ok = r.ok === true || r.ok === 'TRUE';
    store.status[str(r.source)] = { ok, at: str(r.checked_at), error: ok ? undefined : str(r.detail) };
  }
  const embed = st.find((r) => r.source === 'check:embed');
  const schema = st.find((r) => r.source === 'check:video_object_schema');
  if (embed && schema) {
    store.health = {
      embedFound: embed.ok === true || embed.ok === 'TRUE',
      videoObjectSchema: schema.ok === true || schema.ok === 'TRUE',
      dateModified: str(embed.detail).replace('page last modified ', '') || null,
      checkedAt: str(embed.checked_at),
    };
    store.status.page = { ok: true, at: str(embed.checked_at) };
  }
  store.updatedAt = st.map((r) => str(r.checked_at)).sort().at(-1);

  return { video: toVideo(vrow), store };
}

/** Every date from start to end inclusive, as YYYY-MM-DD. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Latest lifetime counter, plus the change since the previous day's snapshot. */
export function latestCounter(store: VideoStore) {
  const days = Object.keys(store.counters).sort();
  const last = days.at(-1);
  if (!last) return null;
  const prev = days.at(-2);
  const cur = store.counters[last];
  return {
    day: last,
    ...cur,
    viewsDelta: prev ? cur.views - store.counters[prev].views : null,
    likesDelta: prev ? cur.likes - store.counters[prev].likes : null,
  };
}

export function sum(store: VideoStore, from: string, pick: (d: DayRow) => number | undefined) {
  return Object.entries(store.daily)
    .filter(([d]) => d >= from)
    .reduce((s, [, row]) => s + (pick(row) ?? 0), 0);
}

/** "12 min ago" style label for the last refresh. */
export function timeAgo(iso?: string) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} days ago`;
}
