'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilLine, Trash2, X } from 'lucide-react';
import { categoryStyle } from '@/lib/ui';
import type { StockItem } from '@/lib/types';

/**
 * ストックをタップしたときの操作シート。
 *
 * 編集モードに入ってから操作する導線は残しているが、
 * 「一覧の項目をタップしたら中身をいじれる」ほうが先に手が出るため、
 * こちらを主の導線にする。
 */
export function StockActionSheet({
  item,
  onClose,
  onRemove,
}: {
  item: StockItem | null;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  /** 削除の確認待ちか。localStorage から戻せないため一段はさむ */
  const [confirming, setConfirming] = useState(false);

  // 開くたびに確認状態をリセットする
  useEffect(() => {
    if (item) setConfirming(false);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [item, onClose]);

  if (!item) return null;

  const cat = categoryStyle(item.category);
  const Icon = cat.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px] animate-fade-up"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} の操作`}
        className="animate-sheet-up relative mx-2 mb-2 w-full max-w-md rounded-3xl bg-surface p-4 pb-safe shadow-e4"
      >
        <div className="flex items-start gap-3 px-1">
          <span
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cat.bg} ${cat.text}`}
          >
            <Icon size={19} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold leading-snug text-ink">{item.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-faint">
              <span>{cat.label}</span>
              <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px]">
                {item.form}
              </span>
              <span className="tabular-nums text-muted">
                {item.remaining ? `残${item.remaining.count}${item.remaining.unit}` : item.status}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-muted transition-transform active:scale-90"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        {item.ingredients.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 px-1">
            {item.ingredients.slice(0, 4).map((ing) => (
              <span
                key={ing}
                className="rounded-full bg-surface-sunken px-2.5 py-1 text-[12px] font-medium text-muted"
              >
                {ing}
              </span>
            ))}
          </div>
        )}

        {confirming ? (
          <div className="mt-4 rounded-2xl bg-red-50 p-4">
            <p className="text-[13.5px] font-semibold text-red-700">
              このストックを削除しますか？
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-red-600">
              削除すると元に戻せません。判定の基準からも外れます。
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl bg-surface py-3 text-[14px] font-medium text-muted transition-transform active:scale-95"
              >
                やめる
              </button>
              <button
                onClick={() => {
                  onRemove(item.id);
                  onClose();
                }}
                className="flex-1 rounded-xl bg-red-600 py-3 text-[14px] font-semibold text-white transition-transform active:scale-95"
              >
                削除する
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <button
              onClick={() => router.push(`/stock/new?id=${item.id}`)}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left shadow-e1 transition-transform active:scale-[0.99]"
            >
              <PencilLine size={17} className="text-muted" strokeWidth={2.2} />
              <span className="flex-1 text-[15px] font-semibold text-ink">編集する</span>
              <span className="text-[12.5px] text-faint">名前・成分・残量</span>
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
            >
              <Trash2 size={17} className="text-red-600" strokeWidth={2.2} />
              <span className="flex-1 text-[15px] font-semibold text-red-700">削除する</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
