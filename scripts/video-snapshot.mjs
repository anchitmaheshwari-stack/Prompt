// Local runner for the video tracker snapshot (the same code Vercel Cron runs daily).
// Run: npm run videos:snapshot    (npm run videos:setup creates the Sheet's tabs and headers once)
// Settings come from .env.local; see lib/videoSnapshot.mjs for the list.
import { ensureTabs } from '../lib/sheetdb.mjs';
import { runSnapshot } from '../lib/videoSnapshot.mjs';

if (process.argv.includes('--setup')) {
  await ensureTabs();
  console.log('Tabs and headers are in place.');
} else {
  await runSnapshot(console.log);
}
