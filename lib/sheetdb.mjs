// Google Sheet as the video tracker's database. Shared by scripts/video-snapshot.mjs and lib/videos.ts.
// Auth: two OAuth logins made with yt-dashboard/auth.mjs (the Sheet editor and the YouTube channel).
// Hosted (Vercel): GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_SHEETS_REFRESH_TOKEN,
// GOOGLE_YOUTUBE_REFRESH_TOKEN. Local fallback: the token files
//   sheets  → yt-dashboard/token-sheets.json  (GOOGLE_TOKEN_FILE)
//   youtube → yt-dashboard/token-youtube.json (YT_TOKEN_FILE)
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const SHEET_ID = process.env.VIDEO_SHEET_ID || '1B2v3OdbLwc7NY5eiQe4LM4vwdysGjt8Vs0apz3Ca0Gg';

/** Tab name → column headers. Key columns identify a row; a write updates that row in place. */
export const TABS = {
  videos: {
    key: ['video_id'],
    columns: ['video_id', 'title', 'blog_url', 'blog_published', 'video_published', 'added_on'],
    dateColumns: ['blog_published', 'video_published', 'added_on'],
  },
  daily: {
    key: ['date', 'video_id'],
    columns: [
      'date', 'video_id',
      'yt_total_views', 'yt_likes', 'yt_comments',
      'yt_views', 'yt_minutes', 'yt_avg_view_sec', 'yt_avg_view_pct',
      'yt_embedded_views', 'yt_watch_page_views', 'yt_shorts_views',
      'mp_page_views', 'mp_visitors', 'mp_plays', 'mp_play_users', 'mp_completions',
      'gsc_impressions', 'gsc_clicks', 'gsc_ctr', 'gsc_position',
      'updated_at',
    ],
    dateColumns: ['date'],
  },
  breakdowns: {
    key: ['date', 'video_id', 'type', 'label'],
    // type: traffic_source | playback_location | embed_site | retention | query
    // value = views (clicks for query, watch ratio for retention)
    columns: ['date', 'video_id', 'type', 'label', 'value', 'impressions', 'position'],
    dateColumns: ['date'],
  },
  status: {
    key: ['video_id', 'source'],
    columns: ['video_id', 'source', 'ok', 'detail', 'checked_at'],
    dateColumns: [],
  },
};

const cached = {};

/** Client id/secret + refresh token for a login, from env vars if set, else the local token file. */
function loginFor(kind) {
  const e = process.env;
  const refresh = kind === 'youtube' ? e.GOOGLE_YOUTUBE_REFRESH_TOKEN : e.GOOGLE_SHEETS_REFRESH_TOKEN;
  if (refresh && e.GOOGLE_OAUTH_CLIENT_ID && e.GOOGLE_OAUTH_CLIENT_SECRET) {
    return { client_id: e.GOOGLE_OAUTH_CLIENT_ID, client_secret: e.GOOGLE_OAUTH_CLIENT_SECRET, refresh_token: refresh };
  }
  const file =
    (kind === 'youtube' ? e.YT_TOKEN_FILE : e.GOOGLE_TOKEN_FILE) ||
    path.join(process.cwd(), '..', 'yt-dashboard', `token-${kind}.json`);
  if (!existsSync(file)) throw new Error(`no Google login for ${kind}: set the GOOGLE_* env vars or run node yt-dashboard/auth.mjs ${kind}`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

async function accessToken(kind) {
  const hit = cached[kind];
  if (hit && hit.expires > Date.now() + 60_000) return hit.token;
  const t = loginFor(kind);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }),
  });
  const body = await r.json();
  if (!body.access_token) throw new Error(`Google token refresh failed: ${body.error_description || body.error}`);
  cached[kind] = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

/** Authenticated Google API call; `kind` picks the login ('sheets' or 'youtube'). */
export async function google(url, init = {}, kind = 'sheets') {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(kind)}`, 'Content-Type': 'application/json', ...init.headers },
    cache: 'no-store',
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${body.error?.message || JSON.stringify(body).slice(0, 200)}`);
  return body;
}

const api = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

// Sheets stores typed-in dates as serial numbers counted from 1899-12-30.
const serialToIso = (n) => new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10);

/** Creates missing tabs, adds missing header columns. Keeps any extra columns someone added by hand. */
export async function ensureTabs() {
  const meta = await google(`${api}?fields=sheets.properties`);
  const existing = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const missing = Object.keys(TABS).filter((t) => !existing.has(t));
  if (missing.length) {
    const res = await google(`${api}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) }),
    });
    res.replies.forEach((rep, i) => existing.set(missing[i], rep.addSheet.properties.sheetId));
  }
  for (const [tab, spec] of Object.entries(TABS)) {
    const got = await google(`${api}/values/${tab}!1:1`);
    const header = got.values?.[0] ?? [];
    const next = [...header, ...spec.columns.filter((c) => !header.includes(c))];
    if (next.length !== header.length) {
      await google(`${api}/values/${tab}!A1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [next] }) });
    }
  }
  // Date columns in the hand-edited videos tab are plain text, so "2026-09-29" stays as typed.
  const vid = existing.get('videos');
  const header = (await google(`${api}/values/videos!1:1`)).values[0];
  await google(`${api}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: TABS.videos.dateColumns.map((c) => {
        const col = header.indexOf(c);
        return {
          repeatCell: {
            range: { sheetId: vid, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 },
            cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
            fields: 'userEnteredFormat.numberFormat',
          },
        };
      }),
    }),
  });
}

/** All rows of a tab as objects keyed by header. */
export async function readTab(tab) {
  const got = await google(
    `${api}/values/${tab}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
  );
  const [header = [], ...rows] = got.values ?? [];
  const dates = TABS[tab]?.dateColumns ?? [];
  return {
    header,
    rows: rows
      .filter((r) => r.some((c) => c !== ''))
      .map((r) =>
        Object.fromEntries(
          header.map((h, i) => {
            const v = r[i] ?? '';
            return [h, dates.includes(h) && typeof v === 'number' ? serialToIso(v) : v];
          }),
        ),
      ),
  };
}

/**
 * Updates rows matching the tab's key columns, appends the rest, and sorts data tabs by key
 * (the hand-edited videos tab keeps its order). Only the fields present in each
 * object are written, so a source that failed this run leaves its old cells untouched.
 */
export async function upsert(tab, objects) {
  if (!objects.length) return;
  const { key } = TABS[tab];
  const { header, rows } = await readTab(tab);
  const id = (o) => key.map((k) => String(o[k])).join('|');
  const index = new Map(rows.map((r, i) => [id(r), i]));
  for (const o of objects) {
    const i = index.get(id(o));
    if (i === undefined) {
      index.set(id(o), rows.length);
      rows.push({ ...o });
    } else {
      Object.assign(rows[i], o);
    }
  }
  if (tab !== 'videos') rows.sort((a, b) => id(a).localeCompare(id(b)));
  const values = rows.map((r) => header.map((h) => r[h] ?? ''));
  await google(`${api}/values/${tab}!A2?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values }) });
}
