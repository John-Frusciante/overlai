import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { restoreRemoval, snapshotRemoval } from '../lib/removal';
import type { StockItem } from '../lib/types';

/**
 * 判定カードの「元に戻す」— 外す前の判定と、その判定が古いかどうかを一緒に戻す
 *
 * やり直しに失敗して灰色になった判定のまま次を外し、元に戻したとき、
 * 灰色が消えて「外したはずの薬の警告」が色付きで戻ってはいけない。
 */

const item: StockItem = {
  id: 'b',
  name: 'B',
  category: 'スキンケア',
  form: '化粧水',
  ingredients: [],
  status: '',
  isPrescription: false,
};

describe('元に戻す', () => {
  it('外す前の判定に戻す', () => {
    const snap = snapshotRemoval(item, 2, 'judgement-1', null);
    assert.deepEqual(restoreRemoval(snap), { result: 'judgement-1', stale: null });
  });

  it('外す前の判定が古かったなら、古いことも一緒に戻す', () => {
    const snap = snapshotRemoval(item, 2, 'judgement-1', 'やり直せませんでした');
    assert.deepEqual(restoreRemoval(snap), {
      result: 'judgement-1',
      stale: 'やり直せませんでした',
    });
  });

  it('外したものと位置を持つ', () => {
    const snap = snapshotRemoval(item, 2, 'judgement-1', null);
    assert.equal(snap.item, item);
    assert.equal(snap.index, 2);
  });
});
