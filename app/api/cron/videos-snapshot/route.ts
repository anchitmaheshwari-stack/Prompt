import { runSnapshot } from '@/lib/videoSnapshot.mjs';

// Daily video tracker refresh, triggered by Vercel Cron (see vercel.json). Vercel sends
// "Authorization: Bearer $CRON_SECRET"; anything else is rejected.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const lines = await runSnapshot();
    return Response.json({ ok: !lines.some((l) => l.includes('✗')), lines });
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
