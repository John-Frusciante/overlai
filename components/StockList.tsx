import type { StockItem, StockCategory } from '@/lib/types';
import { CATEGORY_ORDER } from '@/lib/seed';

/** マイストック一覧 — 設計仕様書 §9.2 */
export function StockList({ items }: { items: StockItem[] }) {
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-7">
      {grouped.map(({ category, items: group }) => (
        <section key={category}>
          <h2 className="px-1 text-xs font-semibold tracking-wide text-zinc-500">
            {category as StockCategory}
            <span className="ml-1.5 font-normal text-zinc-400">{group.length}</span>
          </h2>
          <ul className="mt-2 space-y-2">
            {group.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-start gap-2">
                  <h3 className="flex-1 text-[15px] font-semibold leading-snug text-zinc-900">
                    {item.name}
                  </h3>
                  {/* 処方バッジ — 判定の根拠が可視化される（§9.2） */}
                  {item.isPrescription && (
                    <span className="mt-0.5 shrink-0 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      処方
                    </span>
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
                  {item.status}
                  {item.bodyPart && ` ／ ${item.bodyPart}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
