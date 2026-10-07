import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  MAX_FIELD_LEN,
  MAX_PROFILE_NOTE,
  MAX_STOCK_ITEMS,
  parseAnalyzeInput,
  parseDataUrl,
  sanitizeExtraction,
  sanitizeProfile,
  sanitizeStock,
} from '../lib/request';

/** リクエスト入力の検証 — 端末から来る値をそのままプロンプトへ流さない */

const valid = {
  id: 'stk-1',
  name: 'イブA錠',
  category: '市販薬・サプリ',
  form: '錠剤',
  ingredients: ['イブプロフェン'],
  status: '残12錠',
  isPrescription: false,
};

describe('画像の受け取り', () => {
  it('data URL を分解できる', () => {
    const parsed = parseDataUrl('data:image/jpeg;base64,AAAA');
    assert.equal(parsed?.mediaType, 'image/jpeg');
    assert.equal(parsed?.data, 'AAAA');
  });

  it('画像以外や壊れた形は受け取らない', () => {
    assert.equal(parseDataUrl('data:text/html;base64,AAAA'), null);
    assert.equal(parseDataUrl('https://example.com/a.jpg'), null);
    assert.equal(parseDataUrl(null), null);
  });

  it('大きすぎる画像は受け取らない', () => {
    const huge = 'A'.repeat(8 * 1024 * 1024);
    assert.equal(parseDataUrl(`data:image/png;base64,${huge}`), null);
  });
});

describe('在庫の検証', () => {
  it('空や件数超過は受け取らない', () => {
    assert.equal(sanitizeStock([]), null);
    assert.equal(sanitizeStock('とても長い文字列'), null);
    assert.equal(sanitizeStock(new Array(MAX_STOCK_ITEMS + 1).fill(valid)), null);
  });

  it('長すぎる文字列は切る', () => {
    const items = sanitizeStock([{ ...valid, name: 'あ'.repeat(500) }]);
    assert.equal(items![0].name.length, MAX_FIELD_LEN);
  });

  it('ユーザーが作った区分名も通す', () => {
    const items = sanitizeStock([{ ...valid, routine: '朝のスキンケア' }]);
    assert.equal(items![0].routine, '朝のスキンケア');
  });

  it('空文字の区分は「指定なし」にする', () => {
    const items = sanitizeStock([{ ...valid, routine: '   ' }]);
    assert.equal(items![0].routine, undefined);
  });

  it('数値でない並び順は捨てる（0 に化けさせない）', () => {
    assert.equal(sanitizeStock([{ ...valid, routineOrder: null }])![0].routineOrder, undefined);
    assert.equal(sanitizeStock([{ ...valid, routineOrder: '2' }])![0].routineOrder, undefined);
    assert.equal(sanitizeStock([{ ...valid, routineOrder: 0 }])![0].routineOrder, 0);
  });

  it('知らない服用タイミングは落とし、朝昼夜の順に整える', () => {
    const items = sanitizeStock([
      { ...valid, dose: { times: ['夜', '朝', '真夜中'], perTime: 2 } },
    ]);
    assert.deepEqual(items![0].dose?.times, ['朝', '夜']);
    assert.equal(items![0].dose?.perTime, 2);
  });
});

describe('プロフィールの検証', () => {
  it('選択肢に無い値は落とす', () => {
    const p = sanitizeProfile({ skin: 'つやつや', scalp: '乾燥', age: '100代', gender: '女性' });
    assert.equal(p.skin, undefined);
    assert.equal(p.scalp, '乾燥');
    assert.equal(p.age, undefined);
    assert.equal(p.gender, '女性');
  });

  it('自由記述は長さを切る', () => {
    const p = sanitizeProfile({ note: 'あ'.repeat(1000) });
    assert.equal(p.note?.length, MAX_PROFILE_NOTE);
  });

  it('空の自由記述は持たない', () => {
    assert.equal(sanitizeProfile({ note: '  ' }).note, undefined);
    assert.equal(sanitizeProfile(null).note, undefined);
  });
});

describe('読み取り済みの成分の受け取り', () => {
  const extraction = {
    product_name: 'イブクイック頭痛薬',
    category: '市販薬',
    form: '錠剤',
    ingredients: ['イブプロフェン', '無水カフェイン'],
    confidence: 'high',
  };

  it('正しい形ならそのまま通す', () => {
    assert.deepEqual(sanitizeExtraction(extraction), extraction);
  });

  it('列挙外のカテゴリ・剤形は通さない（処方薬を名乗らせない）', () => {
    assert.equal(sanitizeExtraction({ ...extraction, category: '処方薬' }), null);
    assert.equal(sanitizeExtraction({ ...extraction, form: '注射' }), null);
  });

  it('形が違えば通さない', () => {
    assert.equal(sanitizeExtraction(null), null);
    assert.equal(sanitizeExtraction('イブ'), null);
    assert.equal(sanitizeExtraction({ ...extraction, ingredients: 'イブプロフェン' }), null);
  });

  it('長さと件数を切る', () => {
    const long = 'あ'.repeat(MAX_FIELD_LEN + 50);
    const result = sanitizeExtraction({
      ...extraction,
      product_name: long,
      ingredients: [long, ...Array.from({ length: 100 }, (_, i) => `成分${i}`)],
    });
    assert.equal(result?.product_name?.length, MAX_FIELD_LEN);
    assert.equal(result?.ingredients.length, 30);
    assert.equal(result?.ingredients[0].length, MAX_FIELD_LEN);
  });

  it('空の成分名は落とす', () => {
    const result = sanitizeExtraction({ ...extraction, ingredients: ['', '  ', 'イブプロフェン'] });
    assert.deepEqual(result?.ingredients, ['イブプロフェン']);
  });
});

describe('判定APIの入力の振り分け', () => {
  const extraction = {
    product_name: null,
    category: '市販薬',
    form: '錠剤',
    ingredients: ['イブプロフェン'],
    confidence: 'medium',
  };

  it('extraction があれば読み取りを飛ばす', () => {
    const input = parseAnalyzeInput({ extraction });
    assert.equal(input.kind, 'extraction');
  });

  it('両方あれば extraction を優先する', () => {
    const input = parseAnalyzeInput({ extraction, image: 'data:image/jpeg;base64,AAAA' });
    assert.equal(input.kind, 'extraction');
  });

  it('画像だけなら読み取りから', () => {
    const input = parseAnalyzeInput({ image: 'data:image/jpeg;base64,AAAA' });
    assert.equal(input.kind, 'image');
  });

  it('extraction が壊れていたら画像に落とさず弾く', () => {
    const input = parseAnalyzeInput({
      extraction: { ...extraction, category: '処方薬' },
      image: 'data:image/jpeg;base64,AAAA',
    });
    assert.equal(input.kind, 'invalid');
  });

  it('どちらも無ければ弾く', () => {
    assert.equal(parseAnalyzeInput({}).kind, 'invalid');
  });
});
