// Daily snapshot for every video in the Sheet's `videos` tab. Writes the `daily`, `breakdowns`
// and `status` tabs (see lib/sheetdb.mjs). One row per (date, video) in `daily`; reruns update it.
// A source that is not configured or fails writes nothing, so its old cells stay.
// Called by scripts/video-snapshot.mjs (local) and app/api/cron/videos-snapshot (Vercel Cron).
//
// Env:
//   GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_SHEETS_REFRESH_TOKEN, GOOGLE_YOUTUBE_REFRESH_TOKEN
//                        (or, locally, the token files from yt-dashboard/auth.mjs; see lib/sheetdb.mjs)
//   VIDEO_SHEET_ID       tracker Sheet (default set in lib/sheetdb.mjs)
//   GSC_KEY_JSON         service-account JSON for Search Console (or GSC_KEY_FILE, a path to it)
//   GSC_SITE             Search Console property (default sc-domain:skydo.com)
//   MIXPANEL_PROJECT_ID  default 2999819
//   MIXPANEL_API_SECRET  Mixpanel project API secret (or MIXPANEL_SA_USER / MIXPANEL_SA_SECRET for a service account)
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { google, readTab, upsert } from './sheetdb.mjs';

const env = process.env;
const now = () => new Date().toISOString();

async function getJson(url, init) {
  const r = await fetch(url, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${body.error?.message || body.error || JSON.stringify(body).slice(0, 200)}`);
  return body;
}

// Collects this run's writes; each source adds fields to (date, video) rows.
function collector(videoId, today) {
  const daily = new Map();
  const breakdowns = [];
  return {
    day(date, fields) {
      daily.set(date, { ...(daily.get(date) ?? { date, video_id: videoId }), ...fields, updated_at: now() });
    },
    breakdown(type, label, value, extra = {}) {
      breakdowns.push({ date: today, video_id: videoId, type, label, value, ...extra });
    },
    daily: () => [...daily.values()],
    breakdowns: () => breakdowns,
  };
}

// ---------- YouTube ----------
async function youtube(v, out, today) {
  const vid = await google(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${v.video_id}`, {}, 'youtube');
  const s = vid.items?.[0]?.statistics;
  if (!s) throw new Error('video not found on the channel');
  out.day(today, { yt_total_views: +s.viewCount, yt_likes: +s.likeCount || 0, yt_comments: +s.commentCount || 0 });

  const report = (params) =>
    google('https://youtubeanalytics.googleapis.com/v2/reports?' + new URLSearchParams({
      ids: 'channel==MINE', startDate: v.video_published, endDate: today, filters: `video==${v.video_id}`, ...params,
    }), {}, 'youtube');

  const daily = await report({ dimensions: 'day', metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage' });
  for (const [day, views, minutes, avgSec, avgPct] of daily.rows || []) {
    out.day(day, { yt_views: views, yt_minutes: minutes, yt_avg_view_sec: avgSec, yt_avg_view_pct: avgPct });
  }
  const loc = await report({ dimensions: 'day,insightPlaybackLocationType', metrics: 'views' });
  const byDay = {};
  for (const [day, type, views] of loc.rows || []) (byDay[day] ??= {})[type] = views;
  for (const [day, t] of Object.entries(byDay)) {
    out.day(day, { yt_embedded_views: t.EMBEDDED ?? 0, yt_watch_page_views: t.WATCH ?? 0, yt_shorts_views: t.SHORTS ?? 0 });
  }

  const totals = await report({ dimensions: 'insightPlaybackLocationType', metrics: 'views', sort: '-views' });
  for (const [label, views] of totals.rows || []) out.breakdown('playback_location', label, views);
  const sources = await report({ dimensions: 'insightTrafficSourceType', metrics: 'views', sort: '-views' });
  for (const [label, views] of sources.rows || []) out.breakdown('traffic_source', label, views);
  const embeds = await report({
    dimensions: 'insightPlaybackLocationDetail', metrics: 'views', sort: '-views', maxResults: '25',
    filters: `video==${v.video_id};insightPlaybackLocationType==EMBEDDED`,
  });
  for (const [label, views] of embeds.rows || []) out.breakdown('embed_site', label, views);
  const ret = await report({ dimensions: 'elapsedVideoTimeRatio', metrics: 'audienceWatchRatio' });
  for (const [ratio, watch] of ret.rows || []) out.breakdown('retention', String(ratio), watch);
}

// ---------- Search Console ----------
// The key comes from GSC_KEY_JSON (hosted) or the file at GSC_KEY_FILE (local).
function gscKey() {
  if (env.GSC_KEY_JSON) return JSON.parse(env.GSC_KEY_JSON);
  if (env.GSC_KEY_FILE) return JSON.parse(readFileSync(env.GSC_KEY_FILE, 'utf8'));
  throw new Error('GSC_KEY_JSON / GSC_KEY_FILE not set');
}

async function gscToken() {
  const key = gscKey();
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const t = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600,
  })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const r = await getJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  return r.access_token;
}

async function gsc(v, out, today) {
  const site = env.GSC_SITE || 'sc-domain:skydo.com';
  const h = { Authorization: `Bearer ${await gscToken()}`, 'Content-Type': 'application/json' };
  const q = (body) => getJson(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: 'POST', headers: h,
    body: JSON.stringify({
      startDate: v.blog_published, endDate: today, dataState: 'all',
      dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: v.blog_url }] }],
      ...body,
    }),
  });
  const daily = await q({ dimensions: ['date'], rowLimit: 500 });
  for (const r of daily.rows || []) {
    out.day(r.keys[0], { gsc_impressions: r.impressions, gsc_clicks: r.clicks, gsc_ctr: r.ctr, gsc_position: r.position });
  }
  const queries = await q({ dimensions: ['query'], rowLimit: 25 });
  for (const r of queries.rows || []) out.breakdown('query', r.keys[0], r.clicks, { impressions: r.impressions, position: r.position });
}

// ---------- Mixpanel ----------
async function mixpanel(v, out, today) {
  // Either the project's API secret (username only) or a service account.
  const login = env.MIXPANEL_API_SECRET
    ? `${env.MIXPANEL_API_SECRET}:`
    : env.MIXPANEL_SA_USER && env.MIXPANEL_SA_SECRET && `${env.MIXPANEL_SA_USER}:${env.MIXPANEL_SA_SECRET}`;
  if (!login) throw new Error('MIXPANEL_API_SECRET (or MIXPANEL_SA_USER / MIXPANEL_SA_SECRET) not set');
  const auth = 'Basic ' + Buffer.from(login).toString('base64');
  // Matching on host + path drops Google Translate proxies and staging.
  const match = v.blog_url.replace(/^https?:\/\//, '');
  const seg = async (event, type) => {
    const r = await getJson('https://mixpanel.com/api/query/segmentation?' + new URLSearchParams({
      project_id: env.MIXPANEL_PROJECT_ID || '2999819', event, type, unit: 'day',
      from_date: v.blog_published, to_date: today, where: `"${match}" in properties["$current_url"]`,
    }), { headers: { Authorization: auth } });
    return r.data?.values?.[event] || {};
  };
  const [views, viewUsers, plays, playUsers, completions] = await Promise.all([
    seg('view_blog_page', 'general'), seg('view_blog_page', 'unique'),
    seg('video_played', 'general'), seg('video_played', 'unique'), seg('video_completed', 'general'),
  ]);
  for (const day of Object.keys(views)) {
    out.day(day, {
      mp_page_views: views[day] || 0, mp_visitors: viewUsers[day] || 0,
      mp_plays: plays[day] || 0, mp_play_users: playUsers[day] || 0, mp_completions: completions[day] || 0,
    });
  }
}

// ---------- Live page check ----------
async function pageChecks(v) {
  const html = await fetch(v.blog_url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const modified = html.match(/"dateModified"\s*:\s*"([^"]+)"/)?.[1] ?? 'unknown';
  return [
    { source: 'check:embed', ok: html.includes(v.video_id), detail: `page last modified ${modified}` },
    { source: 'check:video_object_schema', ok: /"@type"\s*:\s*"VideoObject"/.test(html), detail: '' },
  ];
}

/**
 * Refreshes every video. Returns one line per video/source so callers can log or return it.
 * @param {(line: string) => void} [log]
 */
export async function runSnapshot(log = () => {}) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const lines = [];
  const say = (l) => { lines.push(l); log(l); };
  const { rows: videos } = await readTab('videos');
  if (!videos.length) say('No rows in the videos tab yet.');
  for (const v of videos) {
    say(`${v.video_id}  ${v.title}`);
    const out = collector(v.video_id, today);
    const status = [];
    for (const [source, fn] of Object.entries({ youtube, gsc, mixpanel })) {
      try {
        await fn(v, out, today);
        status.push({ video_id: v.video_id, source, ok: true, detail: '', checked_at: now() });
        say(`  ✓ ${source}`);
      } catch (e) {
        status.push({ video_id: v.video_id, source, ok: false, detail: String(e.message || e), checked_at: now() });
        say(`  ✗ ${source}: ${e.message || e}`);
      }
    }
    try {
      for (const c of await pageChecks(v)) status.push({ video_id: v.video_id, checked_at: now(), ...c });
      say('  ✓ page checks');
    } catch (e) {
      status.push({ video_id: v.video_id, source: 'page', ok: false, detail: String(e.message || e), checked_at: now() });
      say(`  ✗ page checks: ${e.message || e}`);
    }
    await upsert('daily', out.daily());
    await upsert('breakdowns', out.breakdowns());
    await upsert('status', status);
  }
  return lines;
}
