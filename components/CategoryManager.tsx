'use client';

import { useState } from 'react';
import { Check, Plus, Tag, X } from 'lucide-react';
import {
  BUILTIN_CATEGORIES,
  MAX_CATEGORY_LENGTH,
  countIn,
  validateCategoryName,
} from '@/lib/categories';
import type { StockItem } from '@/lib/types';

/**
 * カテゴリの管理 — 設定画面（/settings）に置く。
 *
 * 組み込みの6区分は消せない。ユーザーが作ったものだけを対象にする。
 * **中身があるカテゴリを消すときは、移動先を選ばせる。**
 * 在庫を道連れに消したり、どこにも属さない項目を作ったりしないため。
 */
export function CategoryManager({
  categories,
  stock,
  onChange,
  onDelete,
}: {
  categories: string[];
  stock: StockItem[];
  onChange: (next: string[]) => void;
  onDelete: (name: string, moveTo: string | null) => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState('');
  /** 削除しようとしているカテゴリ。中身がある場合だけ移動先を聞く */
  const [removing, setRemoving] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string>('市販薬・サプリ');

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

  const askRemove = (name: string) => {
    if (countIn(stock, name) === 0) {
      onDelete(name, null);
      return;
    }
    setRemoving(name);
    setMoveTo('市販薬・サプリ');
  };

  const movable = [...BUILTIN_CATEGORIES, ...categories.filter((c) => c !== removing)];

  return (
    <section className="rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-e1">
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
                className={`flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-1.5 text-[13px] font-medium ${
                  removing === c
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-line bg-surface-sunken text-ink'
                }`}
              >
                {c}
                {used > 0 && (
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] tabular-nums text-faint">
                    {used}件
                  </span>
                )}
                <button
                  onClick={() => (removing === c ? setRemoving(null) : askRemove(c))}
                  aria-label={`${c} を削除`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-faint transition-transform active:scale-90"
                >
                  <X size={13} strokeWidth={2.6} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {removing && (
        <div className="mt-2.5 rounded-xl bg-red-50 p-3">
          <p className="text-[12.5px] font-semibold text-red-700">
            「{removing}」を削除します
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-red-600">
            中の
            <span className="tabular-nums"> {countIn(stock, removing)} </span>
            件は消さずに、選んだカテゴリへ移します。
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {movable.map((m) => (
              <button
                key={m}
                onClick={() => setMoveTo(m)}
                className={`rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  moveTo === m ? 'bg-brand text-white' : 'border border-line bg-surface text-muted'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => setRemoving(null)}
              className="flex-1 rounded-xl bg-surface py-2.5 text-[13px] font-medium text-muted transition-transform active:scale-95"
            >
              やめる
            </button>
            <button
              onClick={() => {
                onDelete(removing, moveTo);
                setRemoving(null);
              }}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-[13px] font-semibold text-white transition-transform active:scale-95"
            >
              移して削除
            </button>
          </div>
        </div>
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
        もとからある6区分は消せません。作ったカテゴリを消しても、中の在庫は消えません。
      </p>
    </section>
  );
}
