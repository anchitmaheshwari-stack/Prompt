'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SECTIONS } from '@/lib/sections';

/** Top bar on every page. The most specific matching section is highlighted (Playbook over Page anatomy). */
export default function SiteNav() {
  const path = usePathname();
  const active = [...SECTIONS]
    .filter((s) => path === s.href || path.startsWith(s.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#0d0d0d]/90">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-1 overflow-x-auto" aria-label="Sections">
        <Link href="/" className="font-semibold text-sm mr-4 shrink-0 text-gray-900 dark:text-white" aria-current={path === '/' ? 'page' : undefined}>
          Skydo · Analysis
        </Link>
        {SECTIONS.map((s) => {
          const on = s.href === active;
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={on ? 'page' : undefined}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                on
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
