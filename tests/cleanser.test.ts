import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { classifyCleanser, matchCleanser } from '../lib/cleanser';
import type { CleanserBase, ScalpType, SkinType } from '../lib/types';

/**
 * 洗浄基剤 × 肌質・頭皮 — 全部の値に判定が出ることを確かめる
 *
 * 以前は頭皮 × 石鹸系と、肌質の「普通」「混合」が抜けていて、
 * 設定しているのに何も出ない組み合わせがあった。抜けは目視では気づけないので、
 * 総当たりで確かめる。
 */

const SKINS: SkinType[] = ['乾燥', '脂性', '混合', '敏感', '普通'];
const SCALPS: ScalpType[] = ['乾燥', '脂性', 'ふけ・かゆみ', '普通'];

/** 系統ごとの代表的な主剤 */
const MAIN: Record<Exclude<CleanserBase, '不明'>, string> = {
  アミノ酸系: 'ココイルグルタミン酸TEA',
  ベタイン系: 'コカミドプロピルベタイン',
  高級アルコール系: 'ラウレス硫酸Na',
  石鹸系: 'ラウリン酸Na',
};

const BASES = Object.keys(MAIN) as Array<Exclude<CleanserBase, '不明'>>;

describe('洗浄基剤の判定', () => {
  it('主剤の成分名から系統が決まる', () => {
    for (const base of BASES) {
      const result = classifyCleanser([MAIN[base], '水']);
      assert.equal(result.base, base, `${MAIN[base]} が ${base} と判定されません`);
      assert.equal(result.ingredient, MAIN[base]);
    }
  });

  it('心当たりのない成分だけなら「不明」にする', () => {
    assert.equal(classifyCleanser(['水', 'グリセリン']).base, '不明');
  });
});

describe('肌質・頭皮との相性', () => {
  it('シャンプー × 頭皮の全組み合わせに判定が出る', () => {
    for (const base of BASES) {
      for (const scalp of SCALPS) {
        const match = matchCleanser({ form: 'シャンプー', ingredients: [MAIN[base]] }, { scalp });
        assert.ok(match, `${base} × ${scalp} で判定が出ません`);
        assert.ok(match!.message.length > 0);
      }
    }
  });

  it('洗顔 × 肌質の全組み合わせに判定が出る', () => {
    for (const base of BASES) {
      for (const skin of SKINS) {
        const match = matchCleanser({ form: '洗顔', ingredients: [MAIN[base]] }, { skin });
        assert.ok(match, `${base} × ${skin} で判定が出ません`);
      }
    }
  });

  it('未設定なら系統の説明にとどめる', () => {
    const match = matchCleanser({ form: '洗顔', ingredients: [MAIN.アミノ酸系] }, {});
    assert.equal(match?.level, 'neutral');
  });

  it('洗浄料でない剤形には何も出さない', () => {
    assert.equal(matchCleanser({ form: '化粧水', ingredients: [MAIN.石鹸系] }, { skin: '乾燥' }), null);
  });

  it('断定・指示の表現を使わない（設計仕様書 §12）', () => {
    // 診断や指示に読める言い回しが混ざっていないかを見る
    const forbidden = /必ず|確実に|治りま|効きます|してください|使わないでください|べきです/;
    for (const base of BASES) {
      for (const scalp of SCALPS) {
        const message = matchCleanser(
          { form: 'シャンプー', ingredients: [MAIN[base]] },
          { scalp },
        )!.message;
        assert.ok(!forbidden.test(message), `断定・指示に読めます: ${message}`);
      }
      for (const skin of SKINS) {
        const message = matchCleanser({ form: '洗顔', ingredients: [MAIN[base]] }, { skin })!
          .message;
        assert.ok(!forbidden.test(message), `断定・指示に読めます: ${message}`);
      }
    }
  });
});
