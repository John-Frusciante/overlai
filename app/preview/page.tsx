'use client';

import { useEffect, useState } from 'react';
import { JudgementCard } from '@/components/JudgementCard';
import { loadStock } from '@/lib/storage';
import { SEED_STOCK } from '@/lib/seed';
import type { AnalyzeResponse, Signal, StockItem } from '@/lib/types';

/**
 * 判定カードのプレビュー（開発用）— Issue #3 の受け入れ条件
 *
 * APIキーなしで 🔵🟡🔴 の表示を確認・調整するための画面。
 * 本番デモの導線には含まれない。実機デモ当日にAPI障害が起きた場合の
 * 最終手段としても機能する（§11）。
 */

const FIXTURES: Record<Signal, AnalyzeResponse> = {
  yellow: {
    extraction: {
      product_name: 'イブプロフェン配合 解熱鎮痛薬',
      category: '市販薬',
      form: '錠剤',
      ingredients: ['イブプロフェン', '無水カフェイン', '酸化マグネシウム'],
      confidence: 'high',
    },
    judgement: {
      signal: 'yellow',
      headline: '買わなくて大丈夫です',
      summary:
        'この商品の主成分であるイブプロフェンは、ご自宅の「イブA錠」にも含まれています。残り12錠あるため、今回は購入しなくても足りる可能性があります。',
      matched_item_ids: ['stk-002'],
      reasons: [
        {
          type: '成分重複',
          ingredient: 'イブプロフェン',
          detail:
            'ご自宅の「イブA錠」に同じイブプロフェンが含まれています。同一成分の鎮痛薬を重ねて購入する必要はない可能性があります。',
          related_item: 'イブA錠',
        },
      ],
      consult_recommended: false,
    },
    elapsed_ms: 4820,
  },
  red: {
    extraction: {
      product_name: '薬用アクネケア化粧水',
      category: 'スキンケア',
      form: '化粧水',
      ingredients: ['エタノール', 'サリチル酸', 'グリセリン', 'BG'],
      confidence: 'high',
    },
    judgement: {
      signal: 'red',
      headline: '注意が必要です',
      summary:
        'この化粧水にはエタノールとサリチル酸が含まれています。現在お顔にステロイド外用薬を使用中のため、薬を塗っている部位への使用は刺激になる可能性があります。',
      matched_item_ids: ['stk-004', 'stk-003'],
      reasons: [
        {
          type: '刺激リスク',
          ingredient: 'エタノール',
          detail:
            'ステロイド外用薬を使用している部位はバリア機能が低下している場合があり、エタノールが刺激となる可能性があります。',
          related_item: 'ベタメタゾン吉草酸エステル軟膏（処方）',
        },
        {
          type: '刺激リスク',
          ingredient: 'サリチル酸',
          detail:
            'サリチル酸は角質を柔らかくする働きがあり、治療中の肌への使用は刺激となる可能性があります。皮膚科でご確認ください。',
          related_item: 'ヒルドイドローション（処方）',
        },
      ],
      consult_recommended: true,
    },
    elapsed_ms: 5310,
  },
  blue: {
    extraction: {
      product_name: 'クレンジングシャンプー（ワックス用）',
      category: 'ヘアケア',
      form: 'シャンプー',
      ingredients: ['ラウレス硫酸Na', 'コカミドDEA', 'クエン酸'],
      confidence: 'high',
    },
    judgement: {
      signal: 'blue',
      headline: '買っても問題なさそうです',
      summary:
        'ご自宅のシャンプーはアミノ酸系で、日常の洗浄向けです。この商品は洗浄力の強い高級アルコール系で、ワックスの洗い落とし用として用途が異なります。',
      matched_item_ids: ['stk-007'],
      reasons: [],
      consult_recommended: false,
    },
    elapsed_ms: 3940,
  },
};

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
