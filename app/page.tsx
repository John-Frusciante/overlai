'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  PencilLine,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { StockList } from '@/components/StockList';
import { StockActionSheet } from '@/components/StockActionSheet';
import { ButtonLink } from '@/components/ui/Button';
import { collectAlerts, lowStock } from '@/lib/expiry';
import {
  loadCollapsed,
  loadCustomCategories,
  loadStock,
  removeStock,
  resetStock,
  saveCollapsed,
  saveCustomCategories,
} from '@/lib/storage';
import { MAX_CATEGORY_LENGTH, countIn, validateCategoryName } from '@/lib/categories';
import { SEED_STOCK } from '@/lib/seed';
import { overlaySymbolPath } from '@/lib/ui';
import type { ExpiryAlert, StockItem } from '@/lib/types';

export default function MyStockPage() {
  const [stock, setStock] = useState<StockItem[]>(SEED_STOCK);
  const [editing, setEditing] = useState(false);
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
  /** タップで開いている操作シートの対象 */
  const [selected, setSelected] = useState<StockItem | null>(null);
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

  const onReset = useCallback(() => {
    refresh(resetStock());
    setCollapsed([]);
    setCustomCategories([]);
  }, [refresh]);

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
        <button
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
          className={`mt-1.5 flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors active:scale-95 ${
            editing
              ? 'bg-brand text-white shadow-e2'
              : 'border border-line bg-surface text-muted shadow-e1'
          }`}
        >
          {editing ? <Check size={14} strokeWidth={2.6} /> : <SlidersHorizontal size={14} strokeWidth={2.4} />}
          {editing ? '完了' : '編集'}
        </button>
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

      {editing && (
        <>
          <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-muted shadow-e1">
            各項目の <PencilLine size={12} className="inline align-[-1px]" strokeWidth={2.4} /> で内容を編集、
            <Trash2 size={12} className="inline align-[-1px] text-red-600" strokeWidth={2.4} /> で削除できます。
            編集モードに入らなくても、<span className="font-semibold text-ink">項目をタップ</span>すれば同じ操作ができます。
          </p>
          <CategoryManager
            categories={customCategories}
            stock={stock}
            onChange={(next) => {
              saveCustomCategories(next);
              setCustomCategories(next);
            }}
          />
        </>
      )}

      <div className="mt-7 flex gap-2">
        <ButtonLink href="/stock/new" variant="secondary" className="py-3 text-[14px]">
          <Plus size={16} strokeWidth={2.4} />
          ストックを追加
        </ButtonLink>
        {editing && (
          <button
            onClick={onReset}
            aria-label="シードデータに戻す"
            className="flex w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-muted shadow-e1 transition-transform active:scale-95"
          >
            <RotateCcw size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-8">
        <StockList
          items={stock}
          alerts={alerts}
          editing={editing}
          customCategories={customCategories}
          collapsed={collapsed}
          onToggleCategory={onToggleCategory}
          onSelect={setSelected}
          onRemove={onRemove}
        />
      </div>

      <StockActionSheet
        item={selected}
        onClose={() => setSelected(null)}
        onRemove={onRemove}
      />

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

/**
 * カテゴリの管理 — 編集モード中だけ出す。
 *
 * 組み込みの6区分は消せない。ユーザーが作ったものだけを対象にする。
 * **使っている在庫があるカテゴリは消せない。** 消せてしまうと、
 * その項目がどこにも属さない状態になり、一覧での置き場所が説明できなくなるため。
 */
function CategoryManager({
  categories,
  stock,
  onChange,
}: {
  categories: string[];
  stock: StockItem[];
  onChange: (next: string[]) => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState('');

  const commit = () => {
    const result = validateCategoryName(adding ?? '', categories);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onChange([...categories, result.name]);
    setAdding(null);
    setError('');
  };

  return (
    <section className="mt-2 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-e1">
      <h2 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">
        <Tag size={12} strokeWidth={2.4} />
        自分で作ったカテゴリ
      </h2>

      {categories.length === 0 && adding === null && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint">
          「出先用」「常備薬」など、自分の分け方でカテゴリを増やせます。
        </p>
      )}

      {categories.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const used = countIn(stock, c);
            return (
              <li
                key={c}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface-sunken py-1.5 pl-3 pr-1.5 text-[13px] font-medium text-ink"
              >
                {c}
                {used > 0 ? (
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] tabular-nums text-faint">
                    {used}件
                  </span>
                ) : (
                  <button
                    onClick={() => onChange(categories.filter((x) => x !== c))}
                    aria-label={`${c} を削除`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-faint transition-transform active:scale-90"
                  >
                    <X size={13} strokeWidth={2.6} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {adding === null ? (
        <button
          onClick={() => {
            setAdding('');
            setError('');
          }}
          className="mt-2.5 flex items-center gap-1 rounded-full border border-dashed border-line-strong px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors active:bg-surface-sunken"
        >
          <Plus size={13} strokeWidth={2.6} />
          カテゴリを追加
        </button>
      ) : (
        <div className="mt-2.5">
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={adding}
              onChange={(e) => {
                setAdding(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setAdding(null);
              }}
              maxLength={MAX_CATEGORY_LENGTH}
              placeholder="例：出先用"
              className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-brand"
            />
            <button
              onClick={commit}
              aria-label="カテゴリを作る"
              className="flex w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-transform active:scale-95"
            >
              <Check size={16} strokeWidth={2.6} />
            </button>
            <button
              onClick={() => setAdding(null)}
              aria-label="やめる"
              className="flex w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-transform active:scale-95"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>
          {error && <p className="mt-1.5 text-[12.5px] text-red-600">{error}</p>}
        </div>
      )}

      <p className="mt-2.5 text-[12px] leading-relaxed text-faint">
        使っている在庫があるカテゴリは、件数だけ表示して削除できないようにしています。
      </p>
    </section>
  );
}
