'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** 3画面のナビゲーション — 企画書「画面は3つ：スキャナー／マイストック／今日のルーティン」 */
export function BottomNav({ scanHref = '/scan' }: { scanHref?: string }) {
  const path = usePathname();
  const on = (p: string) => path === p;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pb-safe pt-2">
        <Link
          href="/"
          className={`flex flex-1 flex-col items-center gap-1 py-1.5 ${
            on('/') ? 'text-zinc-900' : 'text-zinc-400'
          }`}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="4" width="18" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.9" />
            <rect x="3" y="13" width="18" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.9" />
          </svg>
          <span className="text-[11px] font-medium">ストック</span>
        </Link>

        <Link
          href={scanHref}
          aria-label="スキャン"
          className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg shadow-zinc-900/25 active:bg-zinc-700"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 9V6a3 3 0 013-3h3M21 9V6a3 3 0 00-3-3h-3M3 15v3a3 3 0 003 3h3M21 15v3a3 3 0 01-3 3h-3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Link>

        <Link
          href="/routine"
          className={`flex flex-1 flex-col items-center gap-1 py-1.5 ${
            on('/routine') ? 'text-zinc-900' : 'text-zinc-400'
          }`}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.9" />
            <path d="M12 7.4V12l3 2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          <span className="text-[11px] font-medium">ルーティン</span>
        </Link>
      </div>
    </nav>
  );
}
