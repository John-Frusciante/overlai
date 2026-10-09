import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { applyReadName, typeName } from '../lib/productName';

/** 読み取った商品名の扱い — 入れたうえで、本人が直せる（Issue #40） */

describe('読み取った商品名', () => {
  it('空の欄には読み取った名前を入れ、読み取ったものだと印を付ける', () => {
    assert.deepEqual(applyReadName({ name: '', origin: null }, 'カロナールA'), {
      name: 'カロナールA',
      origin: 'read',
    });
  });

  it('読み取ったまま直していない名前は、撮り直すと差し替える', () => {
    const next = applyReadName({ name: 'カロナー儿A', origin: 'read' }, 'カロナールA');
    assert.equal(next.name, 'カロナールA');
  });

  it('手で入れた名前は上書きせず、違う名前が読めたら候補として残す', () => {
    const next = applyReadName({ name: 'いつもの頭痛薬', origin: null }, 'カロナールA');
    assert.equal(next.name, 'いつもの頭痛薬');
    assert.equal(next.origin, null);
    assert.equal(next.suggested, 'カロナールA');
  });

  it('手で入れた名前と同じものが読めたら、候補は出さない', () => {
    const next = applyReadName({ name: 'カロナールA', origin: null }, 'カロナールA');
    assert.equal(next.suggested, undefined);
  });

  it('商品名が読めなければ、空の欄に「読み取れなかった」と印を付ける', () => {
    assert.deepEqual(applyReadName({ name: '', origin: null }, null), { name: '', origin: 'unread' });
  });

  it('成分表示だけの面を撮っても、前に読み取った名前は残す', () => {
    const next = applyReadName({ name: 'カロナールA', origin: 'read' }, null);
    assert.equal(next.name, 'カロナールA');
    assert.equal(next.origin, 'read');
  });

  it('空白だけの読み取り結果は、読めなかったものとして扱う', () => {
    assert.equal(applyReadName({ name: '', origin: null }, '  ').origin, 'unread');
  });

  it('本人が直したら、読み取りの印と候補を消す', () => {
    assert.deepEqual(typeName('カロナールA 20錠'), { name: 'カロナールA 20錠', origin: null });
  });
});
