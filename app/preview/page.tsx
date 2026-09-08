'use client';

import { useEffect, useState } from 'react';
import { JudgementCard } from '@/components/JudgementCard';
import { loadStock } from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import { MOCK_FIXTURES as FIXTURES } from '@/lib/mock';
import type { Signal, StockItem } from '@/lib/types';

/**
 * 判定カードのプレビュー（開発用）— Issue #3 の受け入れ条件
 *
 * APIキーなしで 🔵🟡🔴 の表示を確認・調整するための画面。
 * 本番デモの導線には含まれない。実機デモ当日にAPI障害が起きた場合の
 * 最終手段としても機能する（§11）。
 */

export default function PreviewPage() {
  const [stock, setStock] = useState<StockItem[]>(SEED_STOCK);
  const [signal, setSignal] = useState<Signal | null>(null);

  useEffect(() => {
    setStock(loadStock());
  }, []);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pt-16">
      <h1 className="text-[22px] font-bold text-zinc-900">判定カード プレビュー</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500">
        開発用。APIを呼ばずに3色の表示を確認できます。
      </p>

      <div className="mt-8 space-y-2.5">
        {(['yellow', 'red', 'blue'] as Signal[]).map((s) => (
          <button
            key={s}
            onClick={() => setSignal(s)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-4 text-left active:bg-zinc-50"
          >
            <span className="text-[15px] font-semibold text-zinc-900">
              {s === 'yellow' ? '🟡' : s === 'red' ? '🔴' : '🔵'}{' '}
              {FIXTURES[s].judgement.headline}
            </span>
            <span className="mt-1 block text-[13px] text-zinc-500">
              {FIXTURES[s].extraction.product_name}
            </span>
          </button>
        ))}
      </div>

      {signal && (
        <JudgementCard
          result={FIXTURES[signal]}
          stock={stock}
          onClose={() => setSignal(null)}
        />
      )}
    </main>
  );
}
