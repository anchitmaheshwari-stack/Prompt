/** Plain, serialisable shapes handed from the server pages to the client components. */

export type Day = {
  date: string;
  ytTotal: number | null;
  ytLikes: number | null;
  ytViews: number | null;
  ytEmbedded: number | null;
  ytAvgSec: number | null;
  ytAvgPct: number | null;
  pageViews: number | null;
  visitors: number | null;
  plays: number | null;
  completions: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  position: number | null;
};

export type Bar = { label: string; value: number };

export type Dashboard = {
  video: {
    videoId: string;
    title: string;
    blogUrl: string;
    blogPublished: string;
    videoPublished: string;
    addedOn: string;
  };
  days: Day[];
  updatedLabel: string;
  sources: { name: string; ok: boolean; detail: string }[];
  health: { embedFound: boolean; videoObjectSchema: boolean } | null;
  breakdowns: {
    trafficSources: Bar[];
    locations: Bar[];
    embeds: Bar[];
    retention: { ratio: number; watch: number }[];
    queries: { query: string; clicks: number; impressions: number; position: number }[];
  };
  sheetUrl: string;
};
