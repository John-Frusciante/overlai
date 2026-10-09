import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { traceIngredient, verifyJudgement } from '../lib/verify';
import type { ExtractionResult, Judgement, Reason, StockItem } from '../lib/types';

/** 判定理由の裏取り — 根拠なき警告を落とし、辿れた理由には出典を付ける */

const extraction: ExtractionResult = {
  product_name: 'イブプロフェン配合 解熱鎮痛薬',
  category: '市販薬',
  form: '錠剤',
  ingredients: ['イブプロフェン', '無水カフェイン'],
  confidence: 'high',
};

const stock: StockItem[] = [
  {
    id: 'stk-002',
    name: 'イブA錠',
    category: '市販薬・サプリ',
    form: '錠剤',
    ingredients: ['イブプロフェン', 'アリルイソプロピルアセチル尿素'],
    status: '残12錠',
    isPrescription: false,
  },
  {
    id: 'stk-004',
    name: 'ベタメタゾン吉草酸エステル軟膏（処方）',
    category: '処方薬(外用)',
    form: '軟膏',
    ingredients: ['ベタメタゾン吉草酸エステル'],
    status: '使用中・顔',
    isPrescription: true,
  },
];

/** 店頭のイブプロフェンと重ならない在庫（色をそろえる処理が重複の理由を足さないように） */
const noOverlap = stock.filter((s) => s.id !== 'stk-002');

function judgement(reasons: Reason[], signal: Judgement['signal'] = 'yellow'): Judgement {
  return {
    signal,
    headline: '買わなくて大丈夫です',
    summary: '家にあります',
    matched_item_ids: ['stk-002'],
    reasons,
    consult_recommended: false,
  };
}

const reason = (ingredient: string): Reason => ({
  type: '成分重複',
  ingredient,
  detail: 'イブA錠と重なります',
  related_item: 'イブA錠',
});

describe('判定理由の裏取り', () => {
  it('入力に実在する成分名は辿れる', () => {
    assert.equal(traceIngredient('イブプロフェン', ['イブプロフェン']), 'イブプロフェン');
  });

  it('一般名と成分名の併記でも辿れる', () => {
    const known = ['ベタメタゾン吉草酸エステル'];
    assert.equal(
      traceIngredient('ステロイド（ベタメタゾン吉草酸エステル）', known),
      'ベタメタゾン吉草酸エステル',
    );
  });

  it('どこにも無い成分名は辿れない', () => {
    assert.equal(traceIngredient('ロキソプロフェン', ['イブプロフェン']), null);
  });

  it('辿れる理由は残り、出典が付く', () => {
    const { judgement: out, dropped } = verifyJudgement(
      judgement([reason('イブプロフェン')]),
      extraction,
      stock,
    );
    assert.equal(dropped.length, 0);
    assert.equal(out.reasons.length, 1);
    assert.ok(out.reasons[0].evidence);
    assert.ok(out.reasons[0].evidence!.url.startsWith('https://www.pmda.go.jp/'));
  });

  it('入力に無い成分を挙げた理由は落とす', () => {
    const { judgement: out, dropped } = verifyJudgement(
      judgement([reason('ロキソプロフェンナトリウム')]),
      extraction,
      noOverlap,
    );
    assert.equal(out.reasons.length, 0);
    assert.equal(dropped.length, 1);
  });

  it('成分名が空の理由は落とす', () => {
    const { dropped } = verifyJudgement(judgement([reason('  ')]), extraction, stock);
    assert.equal(dropped.length, 1);
  });

  it('red なら相談の推奨をサーバー側で立てる', () => {
    const { judgement: out } = verifyJudgement(
      judgement([reason('存在しない成分')], 'red'),
      extraction,
      noOverlap,
    );
    assert.equal(out.consult_recommended, true);
  });

  it('理由が全部落ちてもシグナルは下げない', () => {
    const { judgement: out } = verifyJudgement(
      judgement([reason('存在しない成分')], 'red'),
      extraction,
      noOverlap,
    );
    assert.equal(out.signal, 'red');
    assert.equal(out.consult_recommended, true);
  });

  it('表に無い成分でも、探す入り口だけは渡す', () => {
    const { judgement: out } = verifyJudgement(
      judgement([{ ...reason('アリルイソプロピルアセチル尿素'), type: '効能重複' }]),
      extraction,
      stock,
    );
    assert.ok(out.reasons[0].evidence);
  });

  it('成分重複の理由に、在庫に無い薬の添付文書名を付けない（#42）', () => {
    const { judgement: out } = verifyJudgement(
      judgement([reason('イブプロフェン')]),
      extraction,
      stock,
    );
    assert.ok(!out.reasons[0].evidence!.label.includes('ワルファリン'));
    assert.ok(out.reasons[0].evidence!.label.includes('PMDA'));
  });

  it('相手がワルファリンのときだけ、その添付文書名を名乗る', () => {
    const warfarin: StockItem = {
      id: 'stk-w',
      name: 'ワーファリン錠1mg（処方）',
      category: '処方薬',
      form: '錠剤',
      ingredients: ['ワルファリンカリウム'],
      status: '服用中',
      isPrescription: true,
    };
    const { judgement: out } = verifyJudgement(
      judgement(
        [{ type: '相互作用', ingredient: 'イブプロフェン', detail: '出血', related_item: warfarin.name }],
        'red',
      ),
      extraction,
      [...noOverlap, warfarin],
    );
    assert.equal(out.reasons.length, 1);
    assert.ok(out.reasons[0].evidence!.label.includes('ワルファリン'));
  });

  it('処方の外用薬への刺激の理由は、その外用薬の添付文書へ案内する', () => {
    const lotion: ExtractionResult = {
      ...extraction,
      category: 'スキンケア',
      form: '化粧水',
      ingredients: ['水', 'エタノール', 'メントール'],
    };
    const { judgement: out } = verifyJudgement(
      judgement(
        [
          {
            type: '刺激リスク',
            ingredient: 'エタノール',
            detail: '顔に塗っている軟膏',
            related_item: 'ベタメタゾン吉草酸エステル軟膏（処方）',
          },
        ],
        'red',
      ),
      lotion,
      stock,
    );
    assert.equal(out.reasons.length, 1);
    assert.ok(out.reasons[0].evidence!.label.startsWith('ベタメタゾン吉草酸エステル'));
    // 経口ステロイドの規則（プレドニゾロン）を名乗らない
    assert.ok(!out.reasons[0].evidence!.label.includes('プレドニゾロン'));
  });
});

describe('組み合わせの裏取り（#43）', () => {
  const minocycline: StockItem = {
    id: 'stk-m',
    name: 'ミノサイクリン塩酸塩錠100mg（処方）',
    category: '処方薬',
    form: '錠剤',
    ingredients: ['ミノサイクリン塩酸塩'],
    status: '服用中',
    isPrescription: true,
  };
  const withMino = [...noOverlap, minocycline];

  it('成分重複は、相手の在庫にもその成分が無ければ落とす', () => {
    const vitamin: ExtractionResult = {
      ...extraction,
      category: 'サプリ',
      ingredients: ['ビタミンC', 'V.B2', 'V.B6'],
    };
    const { judgement: out, dropped } = verifyJudgement(
      judgement([{ ...reason('V.B2'), related_item: 'イブA錠' }]),
      vitamin,
      stock,
    );
    assert.equal(out.reasons.length, 0);
    assert.equal(dropped.length, 1);
  });

  it('表に無い吸収阻害は落とす（金属を含まない鎮痛薬 × 抗菌薬）', () => {
    const { judgement: out, dropped } = verifyJudgement(
      judgement(
        [{ type: '吸収阻害', ingredient: 'ミノサイクリン', detail: '吸収が落ちる', related_item: minocycline.name }],
        'red',
      ),
      extraction,
      withMino,
    );
    assert.equal(out.reasons.length, 0);
    assert.equal(dropped.length, 1);
    // シグナルは下げない
    assert.equal(out.signal, 'red');
  });

  it('表にある吸収阻害は残し、その規則の出典を付ける（制酸剤 × ミノサイクリン）', () => {
    const antacid: ExtractionResult = {
      ...extraction,
      ingredients: ['イブプロフェン', 'アセトアミノフェン', '乾燥水酸化アルミニウムゲル'],
    };
    const { judgement: out } = verifyJudgement(
      judgement(
        [
          {
            type: '吸収阻害',
            ingredient: '乾燥水酸化アルミニウムゲル',
            detail: 'ミノサイクリンの吸収が落ちる',
            related_item: minocycline.name,
          },
        ],
        'red',
      ),
      antacid,
      withMino,
    );
    assert.equal(out.reasons.length, 1);
    assert.ok(out.reasons[0].evidence!.label.includes('キレート'));
  });

  it('表にない相互作用は落とす', () => {
    const { judgement: out } = verifyJudgement(
      judgement(
        [{ type: '相互作用', ingredient: 'イブプロフェン', detail: '何か', related_item: minocycline.name }],
        'red',
      ),
      extraction,
      withMino,
    );
    assert.equal(out.reasons.length, 0);
  });

  it('相手の名前が在庫に無ければ、根拠になった在庫を相手にする', () => {
    const { judgement: out } = verifyJudgement(
      judgement([{ ...reason('イブプロフェン'), related_item: '家の鎮痛薬' }]),
      extraction,
      stock,
    );
    assert.equal(out.reasons.length, 1);
  });
});

describe('裏取りした理由に色をそろえる', () => {
  const minocycline: StockItem = {
    id: 'stk-m',
    name: 'ミノサイクリン塩酸塩錠100mg（処方）',
    category: '処方薬',
    form: '錠剤',
    ingredients: ['ミノサイクリン塩酸塩'],
    status: '服用中',
    isPrescription: true,
  };
  const withMino = [...stock, minocycline];
  const fabricated: Reason = {
    type: '相互作用',
    ingredient: 'イブプロフェン',
    detail: 'ミノサイクリンと併用注意',
    related_item: minocycline.name,
  };

  it('表に無い相互作用で🔴にし、重複の理由だけが残ったら🟡に下げる（実測の🟡デモ）', () => {
    const { judgement: out, adjusted } = verifyJudgement(
      { ...judgement([fabricated, reason('イブプロフェン')], 'red'), matched_item_ids: ['stk-m', 'stk-002'] },
      extraction,
      withMino,
    );
    assert.equal(out.signal, 'yellow');
    assert.deepEqual(adjusted, { from: 'red', to: 'yellow' });
    // AIの見出しと説明は🔴を前提に書かれているので差し替える
    assert.equal(out.headline, '買わなくて大丈夫です');
    assert.ok(out.summary.includes('イブA錠'));
    assert.ok(!out.summary.includes('ミノサイクリン'));
    // 「あなたの家にあるもの」に、根拠の無くなった処方薬を並べない
    assert.deepEqual(out.matched_item_ids, ['stk-002']);
  });

  it('AIが重複を書かなくても、表で分かる重複があれば🔴を🟡に下げる', () => {
    const { judgement: out } = verifyJudgement(judgement([fabricated], 'red'), extraction, withMino);
    assert.equal(out.signal, 'yellow');
    assert.equal(out.reasons.length, 1);
    assert.equal(out.reasons[0].related_item, 'イブA錠');
  });

  it('同じ働きの薬が家にあるのに🔵なら、🟡に上げて理由を足す（カロナールA × イブA錠）', () => {
    const calonal: ExtractionResult = { ...extraction, product_name: 'カロナールA', ingredients: ['アセトアミノフェン'] };
    const { judgement: out } = verifyJudgement(
      { ...judgement([], 'blue'), matched_item_ids: [] },
      calonal,
      withMino,
    );
    assert.equal(out.signal, 'yellow');
    assert.equal(out.reasons.length, 1);
    assert.equal(out.reasons[0].type, '効能重複');
    assert.ok(out.reasons[0].evidence!.label.includes('解熱鎮痛'));
    assert.deepEqual(out.matched_item_ids, ['stk-002']);
  });

  it('同じ働きの薬が処方薬なら🔴に上げ、相談を勧める', () => {
    const loxo: StockItem = {
      id: 'stk-l',
      name: 'ロキソプロフェン錠60mg（処方）',
      category: '処方薬',
      form: '錠剤',
      ingredients: ['ロキソプロフェンナトリウム水和物'],
      status: '服用中',
      isPrescription: true,
    };
    const { judgement: out } = verifyJudgement({ ...judgement([], 'yellow'), matched_item_ids: [] }, extraction, [loxo]);
    assert.equal(out.signal, 'red');
    assert.equal(out.consult_recommended, true);
    assert.ok(out.summary.startsWith('処方薬の「ロキソプロフェン錠60mg（処方）」'));
  });

  it('表にある吸収阻害が処方薬との間で残れば、🟡でも🔴に上げる', () => {
    const iron: ExtractionResult = { ...extraction, category: 'サプリ', ingredients: ['クエン酸第一鉄ナトリウム'] };
    const { judgement: out } = verifyJudgement(
      judgement(
        [{ type: '吸収阻害', ingredient: 'クエン酸第一鉄ナトリウム', detail: '吸収', related_item: minocycline.name }],
        'yellow',
      ),
      iron,
      withMino,
    );
    assert.equal(out.signal, 'red');
  });

  it('化粧品どうしの共通成分では色を上げない', () => {
    const lotion: ExtractionResult = { ...extraction, category: 'スキンケア', ingredients: ['水', 'グリセリン', 'BG'] };
    const cosmetics: StockItem[] = [
      { id: 'c1', name: 'しっとり化粧水', category: 'スキンケア', form: '化粧水', ingredients: ['水', 'グリセリン', 'BG'], status: '使用中', isPrescription: false },
    ];
    const { judgement: out, adjusted } = verifyJudgement(judgement([], 'blue'), lotion, cosmetics);
    assert.equal(out.signal, 'blue');
    assert.equal(adjusted, undefined);
  });

  it('処方の外用薬への刺激が残る🔴はそのまま', () => {
    const lotion: ExtractionResult = { ...extraction, category: 'スキンケア', ingredients: ['水', 'エタノール'] };
    const { judgement: out, adjusted } = verifyJudgement(
      judgement(
        [{ type: '刺激リスク', ingredient: 'エタノール', detail: '刺激', related_item: 'ベタメタゾン吉草酸エステル軟膏（処方）' }],
        'red',
      ),
      lotion,
      stock,
    );
    assert.equal(out.signal, 'red');
    assert.equal(adjusted, undefined);
  });

  it('表にある組み合わせをAIが見落とし、表に無い理由を書いても、表から引き直して🔴を保つ', () => {
    // 実測：制酸剤入りの鎮痛薬で、アルミニウムではなくイブプロフェンを理由に挙げた
    const bufferin: ExtractionResult = {
      ...extraction,
      ingredients: ['イブプロフェン', 'アセトアミノフェン', '乾燥水酸化アルミニウムゲル'],
    };
    const { judgement: out } = verifyJudgement(judgement([fabricated], 'red'), bufferin, withMino);
    assert.equal(out.signal, 'red');
    const absorption = out.reasons.find((r) => r.type === '吸収阻害');
    assert.ok(absorption, '吸収阻害の理由が足されていません');
    assert.equal(absorption!.ingredient, '乾燥水酸化アルミニウムゲル');
    assert.equal(absorption!.related_item, minocycline.name);
  });

  it('AIが抗凝固薬 × NSAIDs を見落として🔵にしても、表から🔴にする', () => {
    const warfarin: StockItem = {
      ...minocycline,
      id: 'stk-w',
      name: 'ワーファリン錠1mg（処方）',
      ingredients: ['ワルファリンカリウム'],
    };
    const { judgement: out } = verifyJudgement(judgement([], 'blue'), extraction, [warfarin]);
    assert.equal(out.signal, 'red');
    assert.ok(out.reasons[0].evidence!.label.includes('ワルファリン'));
  });

  it('錠剤の添加物（ステアリン酸マグネシウム）を制酸剤として拾わない', () => {
    const tablet: ExtractionResult = {
      ...extraction,
      ingredients: ['アセトアミノフェン', '乳糖', 'ステアリン酸マグネシウム'],
    };
    const { judgement: out } = verifyJudgement(judgement([], 'blue'), tablet, [minocycline]);
    assert.equal(out.signal, 'blue');
  });

  it('顔に塗るステロイドの軟膏を「経口ステロイド × NSAIDs」に当てない', () => {
    const { judgement: out } = verifyJudgement(judgement([], 'blue'), extraction, noOverlap);
    assert.equal(out.signal, 'blue');
  });
});
