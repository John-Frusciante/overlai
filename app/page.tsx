'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, Plus, Settings } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { StockList } from '@/components/StockList';
import { ButtonLink } from '@/components/ui/Button';
import { collectAlerts, lowStock } from '@/lib/expiry';
import {
  loadCollapsed,
  loadCustomCategories,
  loadStock,
  removeStock,
  saveCollapsed,
} from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import { overlaySymbolPath } from '@/lib/ui';
import type { ExpiryAlert, StockItem } from '@/lib/types';

export default function MyStockPage() {
  const [stock, setStock] = useState<StockItem[]>(SEED_STOCK);
  // 撮影の流れを止めないよう、?demo= はスキャン画面へ引き継ぐ
  const [scanHref, setScanHref] = useState('/scan');
  /**
   * 期限アラートは現在時刻に依存する。SSRで計算するとクライアントとの差でハイドレーションが壊れるため、
   * マウント後にだけ求める。
   */
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [low, setLow] = useState<StockItem[]>([]);
  /** 閉じているカテゴリ。件数が増えても一覧をたどれるようにする */
  const [collapsed, setCollapsed] = useState<string[]>([]);
  /** ユーザーが追加したカテゴリ */
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const refresh = useCallback((items: StockItem[]) => {
    setStock(items);
    setAlerts(collectAlerts(items));
    setLow(lowStock(items));
  }, []);

  useEffect(() => {
    refresh(loadStock());
    setCollapsed(loadCollapsed());
    setCustomCategories(loadCustomCategories());
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (demo) setScanHref(`/scan?demo=${encodeURIComponent(demo)}`);
  }, [refresh]);

  const onRemove = useCallback((id: string) => refresh(removeStock(id)), [refresh]);

  const onToggleCategory = useCallback((category: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category];
      saveCollapsed(next);
      return next;
    });
  }, []);

  const symbol = overlaySymbolPath();

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-safe">
      <header className="flex items-start justify-between px-1">
        <div>
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 90 90" className="h-4 w-4" aria-hidden>
              <path d={symbol.a} fill="currentColor" fillOpacity="0.45" className="text-brand" />
              <path d={symbol.b} fill="currentColor" fillOpacity="0.45" className="text-brand" />
            </svg>
            <p className="text-[12.5px] font-semibold tracking-[0.12em] text-faint">OVERLAI</p>
          </div>
          <h1 className="mt-2 text-[29px] font-bold leading-tight tracking-tight text-ink">
            マイストック
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted">
            家にある<span className="font-semibold tabular-nums text-ink">{stock.length}</span>
            件を基準に判定します
          </p>
        </div>
        <Link
          href="/settings"
          className="mt-1.5 flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-muted shadow-e1 transition-transform active:scale-95"
        >
          <Settings size={14} strokeWidth={2.4} />
          設定
        </Link>
      </header>

      {/* 期限・残量のアラート */}
      {(alerts.length > 0 || low.length > 0) && (
        <section className="stagger mt-7 space-y-2">
          {alerts.slice(0, 3).map((a, i) => (
            <AlertRow key={a.itemId} alert={a} index={i} />
          ))}
          {low.map((item, i) => (
            <div
              key={item.id}
              style={{ '--i': alerts.length + i } as React.CSSProperties}
              className="flex gap-3 rounded-2xl bg-amber-50 p-4"
            >
              <Clock size={16} className="mt-0.5 shrink-0 text-amber-700" strokeWidth={2.2} />
              <div>
                <p className="text-[13px] font-semibold text-amber-900">残りわずか</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-800">
                  {item.name}が残
                  <span className="tabular-nums">{item.remaining!.count}</span>
                  {item.remaining!.unit}です
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="mt-7">
        <ButtonLink href="/stock/new" variant="secondary" className="py-3 text-[14px]">
          <Plus size={16} strokeWidth={2.4} />
          ストックを追加
        </ButtonLink>
      </div>

      <div className="mt-8">
        <StockList
          items={stock}
          alerts={alerts}
          customCategories={customCategories}
          collapsed={collapsed}
          onToggleCategory={onToggleCategory}
          onRemove={onRemove}
        />
      </div>

      <BottomNav scanHref={scanHref} />
    </main>
  );
}

/** 期限アラート。残り日数を30日の目盛りで視覚化する */
function AlertRow({ alert, index }: { alert: ExpiryAlert; index: number }) {
  const expired = alert.level === 'expired';
  const ratio = expired ? 0 : Math.max(0.04, Math.min(1, alert.daysLeft / 30));

  return (
    <div
      style={{ '--i': index } as React.CSSProperties}
      className={`rounded-2xl p-4 ${expired ? 'bg-red-50' : 'bg-amber-50'}`}
    >
      <div className="flex gap-3">
        <AlertTriangle
          size={16}
          strokeWidth={2.2}
          className={`mt-0.5 shrink-0 ${expired ? 'text-red-600' : 'text-amber-700'}`}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-[13px] font-semibold ${expired ? 'text-red-700' : 'text-amber-900'}`}
          >
            {alert.kind}
          </p>
          <p
            className={`mt-0.5 text-[12.5px] leading-relaxed ${
              expired ? 'text-red-600' : 'text-amber-800'
            }`}
          >
            {alert.itemName}
          </p>
          <p
            className={`mt-1 text-[12.5px] leading-relaxed ${
              expired ? 'text-red-600' : 'text-amber-800'
            }`}
          >
            {alert.message}
          </p>

          <div
            className={`mt-2.5 h-1 overflow-hidden rounded-full ${
              expired ? 'bg-red-200/60' : 'bg-amber-200/60'
            }`}
          >
            <div
              className={`h-full rounded-full ${expired ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
