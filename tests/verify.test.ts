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
      stock,
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
      judgement([reason('イブプロフェン')], 'red'),
      extraction,
      stock,
    );
    assert.equal(out.consult_recommended, true);
  });

  it('理由が全部落ちてもシグナルは下げない', () => {
    const { judgement: out } = verifyJudgement(
      judgement([reason('存在しない成分')], 'red'),
      extraction,
      stock,
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
});
