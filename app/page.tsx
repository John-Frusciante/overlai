'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Clock, Plus, Settings } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { StockList } from '@/components/StockList';
import { ButtonLink } from '@/components/ui/Button';
import { useIsClient, useStoredState } from '@/lib/client';
import { collectAlerts, lowStock } from '@/lib/expiry';
import {
  loadCollapsed,
  loadCustomCategories,
  loadStock,
  removeStock,
  resetAll,
  saveCollapsed,
} from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import { overlaySymbolPath } from '@/lib/ui';
import type { ExpiryAlert } from '@/lib/types';

/**
 * 見出しの長押しで初期化の確認を出すまでの時間。
 * ブース展示では説明しながら片手で操作するので、設定画面まで潜らずに戻せる導線が要る（#25）。
 * 普通に使っている人が偶然押し続ける長さではなく、確認もはさむので誤操作では消えない。
 */
const HOLD_TO_RESET_MS = 1200;

export default function MyStockPage() {
  const [stock, setStock] = useStoredState(loadStock, SEED_STOCK);
  /** 閉じているカテゴリ。件数が増えても一覧をたどれるようにする */
  const [collapsed, setCollapsed] = useStoredState<string[]>(loadCollapsed, []);
  /** ユーザーが追加したカテゴリ */
  const [customCategories, setCustomCategories] = useStoredState<string[]>(
    loadCustomCategories,
    [],
  );
  /** 初期化の確認シートを出しているか */
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const holdTimer = useRef<number | null>(null);
  /**
   * 期限アラートは現在時刻に依存する。SSRで計算するとクライアントとの差で
   * ハイドレーションが壊れるため、クライアントで描画されてからだけ求める。
   */
  const isClient = useIsClient();
  const alerts: ExpiryAlert[] = useMemo(
    () => (isClient ? collectAlerts(stock) : []),
    [isClient, stock],
  );
  const low = useMemo(() => (isClient ? lowStock(stock) : []), [isClient, stock]);

  const onRemove = useCallback((id: string) => setStock(removeStock(id)), [setStock]);

  const onToggleCategory = useCallback((category: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category];
      saveCollapsed(next);
      return next;
    });
  }, [setCollapsed]);

  const symbol = overlaySymbolPath();

  const startHold = useCallback(() => {
    if (holdTimer.current !== null) return;
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      navigator.vibrate?.(20);
      setResetting(true);
    }, HOLD_TO_RESET_MS);
  }, []);
  const cancelHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  /** 端末の中身をすべて見本に戻し、この画面の状態も追従させる */
  const onReset = useCallback(() => {
    setStock(resetAll());
    setCollapsed([]);
    setCustomCategories([]);
    setResetting(false);
    setResetDone(true);
    window.setTimeout(() => setResetDone(false), 2200);
  }, [setStock, setCollapsed, setCustomCategories]);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-safe">
      <header className="flex items-start justify-between px-1">
        {/* 見出しの長押しで初期化の確認を出す（#25）。テキスト選択やコンテキストメニューが
            先に出ると長押しが成立しないので、この塊だけ止める */}
        <div
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={(e) => e.preventDefault()}
          className="select-none"
          style={{ WebkitTouchCallout: 'none' }}
        >
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

      {/* 初期化の確認 — 展示の合間に、説明役以外でも迷わず押せる形にする */}
      {resetting && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={() => setResetting(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onClick={(e) => e.stopPropagation()}
            className="animate-sheet-up w-full max-w-md rounded-t-[26px] bg-surface px-5 pb-safe pt-6 shadow-e4"
          >
            <h2 id="reset-title" className="text-[17px] font-bold text-ink">
              見本のデータに戻しますか？
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              いま入っているストック
              <span className="font-semibold tabular-nums text-ink"> {stock.length} </span>
              件と、服薬記録・肌質・自分で作ったカテゴリとルーティン区分がすべて消えて、
              最初の状態に戻ります。元には戻せません。
            </p>
            <div className="mt-5 flex gap-2.5 pb-4">
              <button
                onClick={() => setResetting(false)}
                className="flex-1 rounded-2xl bg-surface-sunken py-3.5 text-[15px] font-medium text-muted transition-transform active:scale-[0.98]"
              >
                やめる
              </button>
              <button
                onClick={onReset}
                className="flex-1 rounded-2xl bg-red-600 py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[0.98]"
              >
                戻す
              </button>
            </div>
          </div>
        </div>
      )}

      {resetDone && (
        <div
          role="status"
          className="animate-fade-up pointer-events-none fixed inset-x-0 bottom-28 z-40 flex justify-center"
        >
          <span className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-e3">
            見本のデータに戻しました
          </span>
        </div>
      )}

      {/* 撮影の流れを止めないよう、?demo= はスキャン画面へ引き継ぐ。
          URL はルーターから受け取る — 描画中の window.location は遷移前のものを指す */}
      <Suspense fallback={<BottomNav scanHref="/scan" />}>
        <ScanNav />
      </Suspense>
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

function ScanNav() {
  const demo = useSearchParams().get('demo');
  return <BottomNav scanHref={demo ? `/scan?demo=${encodeURIComponent(demo)}` : '/scan'} />;
}
