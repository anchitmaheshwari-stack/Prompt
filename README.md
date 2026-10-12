This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Video tracker (`/videos`)

Tracks AI-generated YouTube videos embedded on skydo.com blogs: YouTube views and audience,
plays on the blog (Mixpanel) and the blog's Google Search performance, week on week or month on month.

- **Data store:** the Google Sheet "Youtube Datasheet" (`lib/sheetdb.mjs`). Tabs: `videos` (edit by hand:
  one row per video), `daily` (one row per date × video), `breakdowns`, `status`.
- **Refresh:** `lib/videoSnapshot.mjs`, run daily by Vercel Cron (`/api/cron/videos-snapshot`, see
  `vercel.json`) or locally with `npm run videos:snapshot`. `npm run videos:setup` creates the tabs once.
- **Settings:** see the header of `lib/videoSnapshot.mjs`. Hosted values are Vercel env vars; locally they
  come from `.env.local` and the OAuth token files made by `../yt-dashboard/auth.mjs`.
- **Add a video:** add a row to the `videos` tab (video_id, title, blog_url, blog_published,
  video_published, added_on as YYYY-MM-DD); it appears after the next refresh.
