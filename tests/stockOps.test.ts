import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { inheritFrom, replaceWith, replacementCandidates } from '../lib/stockOps';
import type { ItemForm, StockItem } from '../lib/types';

/** 買い替えたときの入れ替え — 何を候補にし、何を引き継ぐか */

function item(id: string, form: ItemForm, extra: Partial<StockItem> = {}): StockItem {
  return {
    id,
    name: id,
    category: 'スキンケア',
    form,
    ingredients: [],
    status: '使用中',
    isPrescription: false,
    ...extra,
  };
}

describe('入れ替え候補', () => {
  const stock = [
    item('lotion', '化粧水'),
    item('cream', 'クリーム'),
    item('rx', '錠剤', { category: '処方薬', isPrescription: true }),
    item('otc', '錠剤', { category: '市販薬・サプリ' }),
    item('misc', 'その他'),
  ];

  it('同じ剤形だけを出す', () => {
    assert.deepEqual(replacementCandidates(stock, '化粧水').map((i) => i.id), ['lotion']);
  });

  it('処方薬は候補にしない（店頭の商品で置き換えるものではない）', () => {
    assert.deepEqual(replacementCandidates(stock, '錠剤').map((i) => i.id), ['otc']);
  });

  it('剤形が「その他」なら候補を出さない', () => {
    assert.deepEqual(replacementCandidates(stock, 'その他'), []);
  });
});

describe('引き継ぎ', () => {
  const old = item('old', '化粧水', {
    category: '出先用',
    routine: 'outbath',
    routineOrder: 2,
    openedAt: '2026-05-01',
  });

  it('カテゴリと区分を引き継ぐ', () => {
    assert.deepEqual(inheritFrom(old), { category: '出先用', routine: 'outbath' });
  });

  it('同じ区分なら並び順も引き継ぐ', () => {
    const next = replaceWith(old, { ...item('x', '化粧水'), routine: 'outbath' }, 'new');
    assert.equal(next.id, 'new');
    assert.equal(next.routineOrder, 2);
  });

  it('区分を変えたら並び順は捨てる（別の区分の並びに割り込まない）', () => {
    const next = replaceWith(old, { ...item('x', '化粧水'), routine: 'inbath' }, 'new');
    assert.equal(next.routineOrder, undefined);
  });

  it('開封日は引き継がない（新しい品は未開封）', () => {
    const next = replaceWith(old, { ...item('x', '化粧水'), routine: 'outbath' }, 'new');
    assert.equal(next.openedAt, undefined);
  });
});
