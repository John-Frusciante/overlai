'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Layers, ScanLine } from 'lucide-react';

/** 3画面のナビゲーション — 企画書「画面は3つ：スキャナー／マイストック／今日のルーティン」 */
export function BottomNav({ scanHref = '/scan' }: { scanHref?: string }) {
  const path = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pb-safe pt-2">
        <NavItem href="/" label="ストック" icon={Layers} active={path === '/'} />

        <Link
          href={scanHref}
          aria-label="スキャン"
          className="-mt-7 flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-e3 ring-4 ring-canvas transition-transform active:scale-95 active:bg-brand-soft"
        >
          <ScanLine size={23} strokeWidth={2.1} />
        </Link>

        <NavItem href="/routine" label="ルーティン" icon={Clock} active={path === '/routine'} />
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Layers;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex flex-1 flex-col items-center gap-1 py-1.5 transition-colors ${
        active ? 'text-ink' : 'text-faint'
      }`}
    >
      {/* アクティブを色だけでなくインジケーターでも示す */}
      <span
        className={`absolute -top-[9px] h-[3px] w-7 rounded-full bg-brand transition-opacity duration-200 ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
      <span className="text-[10.5px] font-semibold">{label}</span>
    </Link>
  );
}
