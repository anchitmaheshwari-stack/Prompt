import Link from 'next/link';
import { SECTIONS } from '@/lib/sections';

export default function Home() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 w-full">
      <h1 className="text-2xl font-semibold">Skydo analysis</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-8">AI visibility, content teardowns and video performance in one place.</p>
      <ul className="grid sm:grid-cols-2 gap-4">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group block h-full rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-white/10 dark:bg-[#1a1a19]"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">{s.label}</h2>
                <span aria-hidden className="text-gray-400 transition-transform group-hover:translate-x-0.5">→</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5">{s.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
