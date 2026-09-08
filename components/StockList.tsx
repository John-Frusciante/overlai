import Link from 'next/link';
import type { ExpiryAlert, StockCategory, StockItem } from '@/lib/types';
import { CATEGORY_ORDER } from '@/lib/seed';

/** マイストック一覧 — 設計仕様書 §9.2 */
export function StockList({
  items,
  alerts,
  editing,
  onRemove,
}: {
  items: StockItem[];
  alerts: ExpiryAlert[];
  editing: boolean;
  onRemove: (id: string) => void;
}) {
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);

  const alertOf = (id: string) => alerts.find((a) => a.itemId === id);

  return (
    <div className="space-y-7">
      {grouped.map(({ category, items: group }) => (
        <section key={category}>
          <h2 className="px-1 text-xs font-semibold tracking-wide text-zinc-500">
            {category as StockCategory}
            <span className="ml-1.5 font-normal text-zinc-400">{group.length}</span>
          </h2>
          <ul className="mt-2 space-y-2">
            {group.map((item) => {
              const alert = alertOf(item.id);
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex items-start gap-2">
                    <h3 className="flex-1 text-[15px] font-semibold leading-snug text-zinc-900">
                      {item.name}
                    </h3>
                    {item.isPrescription && (
                      <span className="mt-0.5 shrink-0 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        処方
                      </span>
                    )}
                    {editing && (
                      <>
                        <Link
                          href={`/stock/new?id=${item.id}`}
                          aria-label={`${item.name} を編集`}
                          className="-mt-1 shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[12px] font-medium text-zinc-700 active:bg-zinc-200"
                        >
                          編集
                        </Link>
                        <button
                          onClick={() => onRemove(item.id)}
                          aria-label={`${item.name} を削除`}
                          className="-mt-1 shrink-0 rounded-full bg-red-50 px-2 py-1 text-[12px] font-medium text-red-600 active:bg-red-100"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {item.ingredients.slice(0, 3).map((ing) => (
                      <span
                        key={ing}
                        className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12.5px] font-medium text-zinc-600"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>

                  <p className="mt-2.5 text-[13px] text-zinc-500">
                    {item.remaining ? `残${item.remaining.count}${item.remaining.unit}` : item.status}
                    {item.bodyPart && ` ／ ${item.bodyPart}`}
                    <span className="ml-1.5 text-zinc-400">{item.form}</span>
                  </p>

                  {alert && (
                    <p
                      className={`mt-2.5 rounded-lg px-2.5 py-2 text-[12.5px] leading-relaxed ${
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
        </section>
      ))}
    </div>
  );
}
