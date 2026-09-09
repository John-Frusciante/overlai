'use client';

import { useState } from 'react';
import { Check, ListOrdered, Plus, X } from 'lucide-react';
import {
  MAX_ROUTINE_LENGTH,
  countInRoutine,
  orderedRoutines,
  routineChipLabel,
  validateRoutineName,
} from '@/lib/routine';
import type { RoutineKind, StockItem } from '@/lib/types';

/**
 * ルーティンの区分の管理 — 設定画面（/settings）に置く。カテゴリと同じ流儀。
 *
 * 組み込みの2つ（お風呂で洗う／お風呂上がりに塗る）は消せない。
 * **中身がある区分を消すときは、移す先を選ばせる。** 選ばなければルーティンから
 * 外れるだけで、在庫そのものは消えない（カテゴリと違い、区分は任意の項目のため）。
 */
export function RoutineManager({
  routines,
  stock,
  onChange,
  onDelete,
}: {
  routines: string[];
  stock: StockItem[];
  onChange: (next: string[]) => void;
  onDelete: (name: string, moveTo?: RoutineKind) => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<RoutineKind | ''>('');

  const commit = () => {
    const result = validateRoutineName(adding ?? '', routines);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onChange([...routines, result.name]);
    setAdding(null);
    setError('');
  };

  const askRemove = (name: string) => {
    if (countInRoutine(stock, name) === 0) {
      onDelete(name);
      return;
    }
    setRemoving(name);
    setMoveTo('');
  };

  const movable: RoutineKind[] = removing
    ? orderedRoutines(routines, stock).filter((k) => k !== removing)
    : [];

  return (
    <section className="rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-e1">
      <h2 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">
        <ListOrdered size={12} strokeWidth={2.4} />
        自分で作ったルーティン
      </h2>

      {routines.length === 0 && adding === null && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint">
          「朝のスキンケア」「寝る前」など、自分の生活に合わせて増やせます。
        </p>
      )}

      {routines.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {routines.map((r) => {
            const used = countInRoutine(stock, r);
            return (
              <li
                key={r}
                className={`flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-1.5 text-[13px] font-medium ${
                  removing === r
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-line bg-surface-sunken text-ink'
                }`}
              >
                {r}
                {used > 0 && (
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] tabular-nums text-faint">
                    {used}件
                  </span>
                )}
                <button
                  onClick={() => (removing === r ? setRemoving(null) : askRemove(r))}
                  aria-label={`${r} を削除`}
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
          <p className="text-[12.5px] font-semibold text-red-700">「{removing}」を削除します</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-red-600">
            中の
            <span className="tabular-nums"> {countInRoutine(stock, removing)} </span>
            件は消えません。移す先を選ばなければ、ルーティンから外れるだけです。
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => setMoveTo('')}
              className={`rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                moveTo === '' ? 'bg-brand text-white' : 'border border-line bg-surface text-muted'
              }`}
            >
              どこにも入れない
            </button>
            {movable.map((m) => (
              <button
                key={m}
                onClick={() => setMoveTo(m)}
                className={`rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  moveTo === m ? 'bg-brand text-white' : 'border border-line bg-surface text-muted'
                }`}
              >
                {routineChipLabel(m)}
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
                onDelete(removing, moveTo || undefined);
                setRemoving(null);
              }}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-[13px] font-semibold text-white transition-transform active:scale-95"
            >
              削除する
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
          ルーティンを追加
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
              maxLength={MAX_ROUTINE_LENGTH}
              placeholder="例：朝のスキンケア"
              className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-brand"
            />
            <button
              onClick={commit}
              aria-label="ルーティンを作る"
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
        もとからある2つは消せません。ストックの登録画面からも作れます。
      </p>
    </section>
  );
}
