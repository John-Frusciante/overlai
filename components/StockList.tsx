import Link from 'next/link';
import { PencilLine, Trash2 } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { CATEGORY_STYLE, FALLBACK_ICON } from '@/lib/ui';
import { CATEGORY_ORDER } from '@/lib/seed';
import type { ExpiryAlert, StockItem } from '@/lib/types';

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
    <div className="space-y-8">
      {grouped.map(({ category, items: group }) => {
        const cat = CATEGORY_STYLE[category];
        const Icon = cat?.icon ?? FALLBACK_ICON;

        return (
          <section key={category}>
            <SectionHeader
              title={
                <span className="flex items-center gap-1.5">
                  <Icon size={13} className={cat?.text} strokeWidth={2.4} />
                  {cat?.label ?? category}
                </span>
              }
              count={group.length}
            />

            <ul className="stagger mt-2.5 space-y-2">
              {group.map((item, i) => {
                const alert = alertOf(item.id);
                return (
                  <li
                    key={item.id}
                    style={{ '--i': i } as React.CSSProperties}
                    className="rounded-2xl border border-line bg-surface p-4 shadow-e1"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cat?.bg} ${cat?.text}`}
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
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <Link
                            href={`/stock/new?id=${item.id}`}
                            aria-label={`${item.name} を編集`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sunken text-muted transition-transform active:scale-90"
                          >
                            <PencilLine size={15} strokeWidth={2} />
                          </Link>
                          <button
                            onClick={() => onRemove(item.id)}
                            aria-label={`${item.name} を削除`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-transform active:scale-90"
                          >
                            <Trash2 size={15} strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </div>

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
          </section>
        );
      })}
    </div>
  );
}
