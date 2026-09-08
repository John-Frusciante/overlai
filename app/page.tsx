'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BottomNav } from '@/components/BottomNav';
import { StockList } from '@/components/StockList';
import { collectAlerts, lowStock } from '@/lib/expiry';
import { loadStock, removeStock, resetStock } from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import type { StockItem } from '@/lib/types';

export default function MyStockPage() {
  const [stock, setStock] = useState<StockItem[]>(SEED_STOCK);
  const [editing, setEditing] = useState(false);
  // 撮影の流れを止めないよう、?demo= はスキャン画面へ引き継ぐ
  const [scanHref, setScanHref] = useState('/scan');

  useEffect(() => {
    setStock(loadStock());
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (demo) setScanHref(`/scan?demo=${encodeURIComponent(demo)}`);
  }, []);

  const onRemove = useCallback((id: string) => setStock(removeStock(id)), []);

  const alerts = collectAlerts(stock);
  const low = lowStock(stock);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-14">
      <header className="flex items-start justify-between px-1">
        <div>
          <p className="text-[13px] font-medium tracking-wide text-zinc-400">Overlai</p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight text-zinc-900">マイストック</h1>
          <p className="mt-1.5 text-[13.5px] text-zinc-500">
            家にある{stock.length}件を基準に判定します
          </p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="mt-1 text-[14px] font-medium text-zinc-500 active:text-zinc-900"
        >
          {editing ? '完了' : '編集'}
        </button>
      </header>

      {/* 期限・残量のアラート */}
      {(alerts.length > 0 || low.length > 0) && (
        <section className="mt-6 space-y-2">
          {alerts.slice(0, 3).map((a) => (
            <div
              key={a.itemId}
              className={`rounded-xl p-3.5 ${
                a.level === 'expired' ? 'bg-red-50' : 'bg-amber-50'
              }`}
            >
              <p
                className={`text-[13px] font-semibold ${
                  a.level === 'expired' ? 'text-red-700' : 'text-amber-900'
                }`}
              >
                {a.kind}：{a.itemName}
              </p>
              <p
                className={`mt-0.5 text-[12.5px] leading-relaxed ${
                  a.level === 'expired' ? 'text-red-600' : 'text-amber-800'
                }`}
              >
                {a.message}
              </p>
            </div>
          ))}
          {low.map((i) => (
            <div key={i.id} className="rounded-xl bg-amber-50 p-3.5">
              <p className="text-[13px] font-semibold text-amber-900">残りわずか：{i.name}</p>
              <p className="mt-0.5 text-[12.5px] text-amber-800">
                残{i.remaining!.count}
                {i.remaining!.unit}です
              </p>
            </div>
          ))}
        </section>
      )}

      <div className="mt-6 flex gap-2">
        <Link
          href="/stock/new"
          className="flex-1 rounded-xl border border-zinc-200 bg-white py-3 text-center text-[14px] font-semibold text-zinc-800 active:bg-zinc-50"
        >
          ＋ ストックを追加
        </Link>
        {editing && (
          <button
            onClick={() => setStock(resetStock())}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] font-medium text-zinc-500 active:bg-zinc-50"
          >
            初期化
          </button>
        )}
      </div>

      <div className="mt-7">
        <StockList items={stock} alerts={alerts} editing={editing} onRemove={onRemove} />
      </div>

      <BottomNav scanHref={scanHref} />
    </main>
  );
}
