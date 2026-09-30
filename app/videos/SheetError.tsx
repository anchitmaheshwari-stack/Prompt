import Link from 'next/link';
import { SHEET_ID } from '@/lib/sheetdb.mjs';

/** Shown when the tracker Sheet can't be read (missing token, no access, Sheets API off). */
export default function SheetError({ error }: { error: unknown }) {
  return (
    <main className="max-w-3xl mx-auto p-8">
      <div className="mb-6 text-sm">
        <Link href="/prompts" className="text-gray-500 hover:text-gray-900">← All prompts</Link>
      </div>
      <h1 className="text-2xl font-semibold mb-2">Video tracker</h1>
      <p className="text-sm text-gray-700 mb-2">Couldn&apos;t read the tracker Sheet:</p>
      <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 whitespace-pre-wrap mb-4">{String((error as Error)?.message ?? error)}</pre>
      <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
        <li>The Google Sheets API is enabled in the Cloud project that owns the OAuth client.</li>
        <li>The login was redone after adding the Sheets scope: <code>node yt-dashboard/auth.mjs</code>.</li>
        <li>
          The channel&apos;s Google account can edit the{' '}
          <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`} target="_blank" rel="noreferrer" className="underline">Sheet</a>.
        </li>
      </ul>
    </main>
  );
}
