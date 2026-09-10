'use client';

import { JudgementCard } from '@/components/JudgementCard';
import { useStoredState } from '@/lib/client';
import { loadProfile, loadStock } from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import { MOCK_FIXTURES as FIXTURES } from '@/lib/mock';
import type { Profile, Signal, StockItem } from '@/lib/types';

/**
 * 判定カードのプレビュー（開発用）— Issue #3 の受け入れ条件
 *
 * APIキーなしで 🔵🟡🔴 の表示を確認・調整するための画面。
 * 本番デモの導線には含まれない。実機デモ当日にAPI障害が起きた場合の
 * 最終手段としても機能する（§11）。
 */

export default function PreviewPage() {
  const [stock] = useStoredState<StockItem[]>(loadStock, SEED_STOCK);
  const [profile] = useStoredState<Profile>(loadProfile, {});
  // ?open=red のように直接カードを開ける（スクリーンショット・デモ用）
  const [signal, setSignal] = useStoredState<Signal | null>(() => {
    const open = new URLSearchParams(window.location.search).get('open');
    return open === 'yellow' || open === 'red' || open === 'blue' ? open : null;
  }, null);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pt-safe">
      <h1 className="text-[22px] font-bold text-ink">判定カード プレビュー</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        開発用。APIを呼ばずに3色の表示を確認できます。
      </p>

      <div className="mt-8 space-y-2.5">
        {(['yellow', 'red', 'blue'] as Signal[]).map((s) => (
          <button
            key={s}
            onClick={() => setSignal(s)}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-4 text-left shadow-e1 transition-transform active:scale-[0.99]"
          >
            <span className="text-[15px] font-semibold text-ink">
              {s === 'yellow' ? '🟡' : s === 'red' ? '🔴' : '🔵'}{' '}
              {FIXTURES[s].judgement.headline}
            </span>
            <span className="mt-1 block text-[13px] text-muted">
              {FIXTURES[s].extraction.product_name}
            </span>
          </button>
        ))}
      </div>

      {signal && (
        <JudgementCard
          result={FIXTURES[signal]}
          stock={stock}
          profile={profile}
          onClose={() => setSignal(null)}
        />
      )}
    </main>
  );
}
