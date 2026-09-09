import type { AnalyzeResponse, ExtractionResult, RoutineAdvice, Signal } from './types';

/**
 * モック判定 — APIキーなしでデモを成立させるための固定応答
 *
 * ⚠ これはAIを呼んでいない。実際の判定ではない。
 * `ANTHROPIC_API_KEY` が設定されると自動的に本物のパイプラインに切り替わる
 * （app/api/analyze/route.ts）。コード変更は不要。
 *
 * 内容は設計仕様書 §6.2 のシードデータと整合させてある。
 * 本物のAIに切り替えたときに同じ結論が出ることを期待して書かれている。
 */

export const MOCK_FIXTURES: Record<Signal, AnalyzeResponse> = {
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

export function isSignal(v: unknown): v is Signal {
  return v === 'blue' || v === 'yellow' || v === 'red';
}

/** 在庫登録（/api/extract）用のモック応答 */
export const MOCK_EXTRACTION: ExtractionResult = {
  product_name: 'ビタミンC誘導体 化粧水',
  category: 'スキンケア',
  form: '化粧水',
  ingredients: ['水', 'BG', 'アスコルビルグルコシド', 'グリセリン', 'クエン酸'],
  confidence: 'high',
};

/**
 * ルーティン解説のモック — シードデータ（lib/seed.ts）に対応する固定文言
 *
 * ⚠ これはAIを呼んでいない。APIキーが無いときと OVERLAI_MOCK=1 のときだけ使う。
 * 肌質・頭皮の設定は反映されない（本物のAIは反映する）。
 */
export const MOCK_ROUTINE_ADVICE: RoutineAdvice = {
  overall:
    '処方のローションと軟膏が入っているため、塗る順番や間隔について指示を受けている場合は、医師・薬剤師の指示が優先されます。洗浄料はどちらもおだやかな系統で揃っているので、洗いすぎになりにくい組み合わせです。',
  steps: [
    { item_id: 'stk-007', tip: 'ココイルグルタミン酸TEAが主剤で、頭皮への負担を抑えやすい系統です。' },
    { item_id: 'stk-008', tip: '髪に残ると背中に付きやすいため、この後の洗顔・ボディソープで流れます。' },
    { item_id: 'stk-009', tip: '髪をすすいだ後なので、顔に残った整髪料や皮脂も一緒に落としやすくなります。' },
    { item_id: 'stk-010', tip: 'トリートメントの流し残しを最後に洗い流せる位置です。' },
    { item_id: 'stk-006', tip: 'グリセリンで水分を入れてから、この後の美容液がなじみやすくなります。' },
    { item_id: 'stk-005', tip: 'ナイアシンアミドは化粧水の後に置くと、油分にさえぎられにくくなります。' },
    { item_id: 'stk-003', tip: 'ヘパリン類似物質のローションです。薬を塗る前の土台になります。' },
    { item_id: 'stk-004', tip: '油分が最も多いため最後です。この上に他のものを重ねない使い方が一般的です。' },
  ],
};
