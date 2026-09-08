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

## Prompt RCA pages (`/prompts`)

Local-only analysis pages for the Peec AI prompt work. The Google Sheet
"Prompt Analysis" is the only data source; the app has no database.

- `/prompts` – the 23 focus prompts (Important Prompts tab) with visibility, position, Google rank and RCA status
- `/prompts/<slug>` – one prompt: Action, Root cause, Lever, Answers, Fanouts, with an "Edit in sheet" link to the row
- `/prompts/all` – every tracked prompt from the All Prompts tab

Data is read via the sheet's CSV export on every request, so edits in the sheet show on reload.
The sheet must be readable by link: Share → Anyone with the link → Viewer
(or File → Share → Publish to web). Until then the pages show a setup notice.

Env overrides (optional): `PROMPT_SHEET_ID`, `PROMPT_SHEET_GID`, `PROMPT_SHEET_ALL_GID`,
and `PROMPT_SHEET_CSV_BASE` to point at a local mock CSV server for testing.

### Funnel view

Each prompt page is a 7-stage funnel: prompt → fanout buckets → what ChatGPT answers per bucket
(with a screenshot) → what gets cited → was Skydo retrieved / cited / mentioned → which Skydo pages →
do we have a matching page. Stages 2–4 read the **Funnel** tab (one row per prompt × bucket:
prompt, bucket, share, queries, gpt_answer, screenshot, cited, skydo). Stages 5–7 read the
Retrieved?, Cited?, Mentioned?, Skydo pages and Matching page columns on Important Prompts.
List cells use ` | ` between items. Screenshots live in `public/screenshots/` and the sheet
holds the path, e.g. `/screenshots/uk-clients-1.jpg`. If the sheet cell is empty the page falls
back to `public/screenshots/<prompt-slug>-<n>.jpg` for the n-th bucket (all 23 prompts have
`-1` and `-2`). Capture them in a ChatGPT temporary chat set to Unpersonalized, otherwise memory
skews the answer.


### Page anatomy and playbook (`/anatomy`)

One side-by-side teardown per content bucket (how-to guide, alternatives listicle, Skydo-vs-X comparison,
persona guide, corridor guide, compliance reference, vendor product page). Each compares the page ChatGPT
cites most in that bucket with the Skydo page that competes for the same query: Peec retrievals/citations,
HTML structure metrics, skeleton, the sentences ChatGPT lifted, diagnosis, rewrite spec and a bucket blueprint.
Data lives in `data/anatomy/<slug>.json`; `/anatomy/playbook` shows all blueprints on one page.
Bucket order is `BUCKET_ORDER` in `lib/anatomy.ts`.
