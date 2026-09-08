'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StockList } from '@/components/StockList';
import { loadStock } from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import type { StockItem } from '@/lib/types';

export default function MyStockPage() {
  const [stock, setStock] = useState<StockItem[]>(SEED_STOCK);
  // 撮影の流れを止めないよう、?demo= はスキャン画面へ引き継ぐ
  const [scanHref, setScanHref] = useState('/scan');

  useEffect(() => {
    setStock(loadStock());
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (demo) setScanHref(`/scan?demo=${encodeURIComponent(demo)}`);
  }, []);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-14">
      <header className="px-1">
        <p className="text-[13px] font-medium tracking-wide text-zinc-400">Overlai</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight text-zinc-900">マイストック</h1>
        <p className="mt-1.5 text-[13.5px] text-zinc-500">
          家にある{stock.length}件を基準に判定します
        </p>
      </header>

      <div className="mt-8">
        <StockList items={stock} />
      </div>

      {/* FAB — §9.2 */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-4 pb-8">
        <Link
          href={scanHref}
          className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 text-[15px] font-semibold text-white shadow-lg shadow-zinc-900/20 active:bg-zinc-700"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 9V6a3 3 0 013-3h3M21 9V6a3 3 0 00-3-3h-3M3 15v3a3 3 0 003 3h3M21 15v3a3 3 0 01-3 3h-3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
          </svg>
          スキャン
        </Link>
      </div>
    </main>
  );
}
