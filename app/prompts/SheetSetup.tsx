import { SHEET_URL } from '@/lib/sheet';

export default function SheetSetup({ status }: { status: number }) {
  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Sheet is not readable yet</h1>
      <p className="text-sm text-gray-600 mb-6">
        The app reads the Google Sheet directly (HTTP {status}). It needs the sheet
        to be readable by link. Nothing is stored anywhere else.
      </p>
      <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-800">
        <li>
          Open the{' '}
          <a href={SHEET_URL} target="_blank" rel="noreferrer" className="underline">
            Prompt Analysis sheet
          </a>
          .
        </li>
        <li>
          Click <span className="font-medium">Share</span>, then under General access pick{' '}
          <span className="font-medium">Anyone with the link</span> with role{' '}
          <span className="font-medium">Viewer</span>.
        </li>
        <li>Reload this page.</li>
      </ol>
      <p className="text-xs text-gray-500 mt-6">
        Alternative: File → Share → Publish to web (entire document, CSV) also works
        and keeps the normal share settings unchanged.
      </p>
    </main>
  );
}
