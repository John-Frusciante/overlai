'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, PencilLine, Trash2 } from 'lucide-react';
import { categoryStyle } from '@/lib/ui';
import { orderedCategories } from '@/lib/categories';
import type { ExpiryAlert, StockItem } from '@/lib/types';

/** マイストック一覧 — 設計仕様書 §9.2 */
export function StockList({
  items,
  alerts,
  editing,
  customCategories,
  collapsed,
  onToggleCategory,
  onSelect,
  onRemove,
}: {
  items: StockItem[];
  alerts: ExpiryAlert[];
  editing: boolean;
  /** ユーザーが追加したカテゴリ。組み込みの後ろに並ぶ */
  customCategories: string[];
  collapsed: string[];
  onToggleCategory: (category: string) => void;
  onSelect: (item: StockItem) => void;
  onRemove: (id: string) => void;
}) {
  /** 削除の確認待ちのid。誤タップで消えると復元できないため二段階にする */
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const grouped = orderedCategories(customCategories, items)
    .map((category) => ({ category, items: items.filter((i) => i.category === category) }))
    .filter((g) => g.items.length > 0);

  const alertOf = (id: string) => alerts.find((a) => a.itemId === id);

  return (
    <div className="space-y-3">
      {grouped.map(({ category, items: group }) => {
        const cat = categoryStyle(category);
        const Icon = cat.icon;
        const open = !collapsed.includes(category);
        const alertCount = group.filter((i) => alertOf(i.id)).length;

        return (
          <section key={category}>
            <button
              type="button"
              onClick={() => onToggleCategory(category)}
              aria-expanded={open}
              className="flex w-full items-center gap-2 rounded-xl px-1 py-2 text-left transition-colors active:bg-surface-sunken"
            >
              <Icon size={14} className={cat.text} strokeWidth={2.4} />
              <span className="text-[12px] font-semibold tracking-[0.06em] text-muted">
                {cat.label}
              </span>
              <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-faint">
                {group.length}
              </span>
              {alertCount > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
              )}
              <span className="flex-1" />
              {/* 閉じているときは横向き、開くと下向き。開閉の向きと矢印の向きを揃える */}
              <ChevronDown
                size={16}
                strokeWidth={2.2}
                className={`text-faint transition-transform duration-300 ${
                  open ? '' : '-rotate-90'
                }`}
              />
            </button>

            {/* 閉じているあいだも中身が想像できるよう、名前だけ残す */}
            {!open && (
              <p className="truncate px-1 pb-1 text-[12.5px] text-faint">
                {group.map((i) => i.name).join('、')}
              </p>
            )}

            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <ul className="-mx-1 space-y-2 overflow-hidden px-1 pb-1">
                {group.map((item) => {
                  const alert = alertOf(item.id);
                  const confirming = confirmId === item.id;

                  return (
                    <li
                      key={item.id}
                      className="relative rounded-2xl border border-line bg-surface p-4 shadow-e1"
                    >
                      {/* カードのどこを押しても操作シートが開く。
                          Link を内側に持つため、入れ子のボタンにせず透明な層を重ねる */}
                      <button
                        onClick={() => onSelect(item)}
                        aria-label={`${item.name} の操作`}
                        className="absolute inset-0 rounded-2xl"
                      />

                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cat.bg} ${cat.text}`}
                        >
                          <Icon size={17} strokeWidth={2} />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <h3 className="flex-1 text-[15px] font-semibold leading-snug text-ink">
                              {item.name}
                            </h3>
                            {item.isPrescription && (
                              <span className="mt-0.5 shrink-0 rounded-md bg-brand px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-white">
                                処方
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.ingredients.slice(0, 3).map((ing) => (
                              <span
                                key={ing}
                                className="rounded-full bg-surface-sunken px-2.5 py-1 text-[12px] font-medium text-muted"
                              >
                                {ing}
                              </span>
                            ))}
                          </div>

                          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-faint">
                            <span className="font-medium tabular-nums text-muted">
                              {item.remaining
                                ? `残${item.remaining.count}${item.remaining.unit}`
                                : item.status}
                            </span>
                            {item.bodyPart && <span>{item.bodyPart}</span>}
                            <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px]">
                              {item.form}
                            </span>
                          </p>
                        </div>

                        {editing && (
                          <div className="relative z-10 flex shrink-0 flex-col gap-1.5">
                            <Link
                              href={`/stock/new?id=${item.id}`}
                              aria-label={`${item.name} を編集`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sunken text-muted transition-transform active:scale-90"
                            >
                              <PencilLine size={15} strokeWidth={2} />
                            </Link>
                            <button
                              onClick={() => setConfirmId(confirming ? null : item.id)}
                              aria-label={`${item.name} を削除`}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform active:scale-90 ${
                                confirming
                                  ? 'bg-red-600 text-white'
                                  : 'bg-red-50 text-red-600'
                              }`}
                            >
                              <Trash2 size={15} strokeWidth={2} />
                            </button>
                          </div>
                        )}
                      </div>

                      {editing && confirming && (
                        <div className="relative z-10 mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-2.5 pl-3.5">
                          <p className="flex-1 text-[12.5px] font-medium text-red-700">
                            このストックを削除しますか？
                          </p>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-medium text-muted transition-transform active:scale-95"
                          >
                            やめる
                          </button>
                          <button
                            onClick={() => {
                              setConfirmId(null);
                              onRemove(item.id);
                            }}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-transform active:scale-95"
                          >
                            削除
                          </button>
                        </div>
                      )}

                      {alert && (
                        <p
                          className={`mt-3 rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${
                            alert.level === 'expired'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {alert.message}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
