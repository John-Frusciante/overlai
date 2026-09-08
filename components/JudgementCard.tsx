'use client';

import { useState } from 'react';
import type { AnalyzeResponse, Signal, StockItem } from '@/lib/types';

/**
 * 判定カード — 設計仕様書 §9.4
 * デモ映像の山場。3秒で色が判別できる視認性を最優先にする。
 */

const SIGNAL_STYLE: Record<
  Signal,
  { bar: string; chip: string; ring: string; emoji: string; label: string }
> = {
  blue: {
    bar: 'bg-[#2563EB]',
    chip: 'bg-[#2563EB]/10 text-[#1D4ED8]',
    ring: 'ring-[#2563EB]/20',
    emoji: '🔵',
    label: '買ってよさそうです',
  },
  yellow: {
    // 視認性のため黄色ではなくアンバーを使う（§9.4）
    bar: 'bg-[#D97706]',
    chip: 'bg-[#D97706]/10 text-[#B45309]',
    ring: 'ring-[#D97706]/20',
    emoji: '🟡',
    label: '家にあります',
  },
  red: {
    bar: 'bg-[#DC2626]',
    chip: 'bg-[#DC2626]/10 text-[#B91C1C]',
    ring: 'ring-[#DC2626]/20',
    emoji: '🔴',
    label: '注意が必要です',
  },
};

export function JudgementCard({
  result,
  stock,
  onClose,
}: {
  result: AnalyzeResponse;
  stock: StockItem[];
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { extraction, judgement } = result;
  const style = SIGNAL_STYLE[judgement.signal];
  const matched = stock.filter((s) => judgement.matched_item_ids.includes(s.id));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* シグナル — 画面上部に大きく */}
      <div className={`${style.bar} px-5 pt-14 pb-8 text-white`}>
        <div className="flex items-start justify-between">
          <span className="text-5xl leading-none">{style.emoji}</span>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium active:bg-white/30"
          >
            閉じる
          </button>
        </div>
        <h1 className="mt-5 text-[2rem] font-bold leading-tight tracking-tight">
          {judgement.headline}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/90">{judgement.summary}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-28 pt-6">
        {/* 検出成分 */}
        <section>
          <h2 className="text-xs font-semibold tracking-wide text-zinc-500">
            この商品から検出された成分
          </h2>
          {extraction.product_name && (
            <p className="mt-1.5 text-[15px] font-semibold text-zinc-900">
              {extraction.product_name}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {extraction.ingredients.slice(0, 3).map((ing) => (
              <span
                key={ing}
                className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${style.chip}`}
              >
                {ing}
              </span>
            ))}
            {extraction.ingredients.length > 3 && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[13px] text-zinc-500">
                ほか{extraction.ingredients.length - 3}件
              </span>
            )}
          </div>
          {extraction.confidence === 'low' && (
            <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-amber-800">
              読み取り精度が低い可能性があります。判定は参考程度にご覧ください。
            </p>
          )}
        </section>

        {/* 該当する自宅アイテム */}
        {matched.length > 0 && (
          <section className="mt-7">
            <h2 className="text-xs font-semibold tracking-wide text-zinc-500">
              あなたの家にあるもの
            </h2>
            <ul className="mt-2 space-y-2">
              {matched.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-xl bg-white p-3.5 ring-1 ${style.ring} shadow-sm`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[15px] font-semibold text-zinc-900">{item.name}</span>
                    {item.isPrescription && (
                      <span className="mt-0.5 shrink-0 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        処方
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-zinc-500">
                    {item.ingredients.join('、')} ／ {item.status}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 根拠を見る */}
        {judgement.reasons.length > 0 && (
          <section className="mt-7">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-left active:bg-zinc-50"
            >
              <span className="text-[15px] font-semibold text-zinc-900">根拠を見る</span>
              <span
                className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
                aria-hidden
              >
                ▾
              </span>
            </button>

            {open && (
              <ul className="mt-2 space-y-2.5">
                {judgement.reasons.map((r, i) => (
                  <li key={i} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white">
                        {r.type}
                      </span>
                      <span className="text-[14px] font-semibold text-zinc-900">
                        {r.ingredient}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] leading-relaxed text-zinc-700">{r.detail}</p>
                    <p className="mt-1.5 text-[13px] text-zinc-500">該当：{r.related_item}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* 免責 — §12.2 */}
        <p className="mt-8 text-[12px] leading-relaxed text-zinc-400">
          本アプリは一般的な成分情報を提示するものであり、診断・治療の判断を行うものではありません。
          実際の使用可否は薬剤師・医師にご相談ください。
        </p>
      </div>

      {/* 相談導線 — 全判定色で常設（FR-10） */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 px-5 pb-7 pt-3 backdrop-blur">
        <button className="w-full rounded-xl bg-zinc-900 py-3.5 text-[15px] font-semibold text-white active:bg-zinc-700">
          薬剤師・皮膚科に相談する
        </button>
      </div>
    </div>
  );
}
