import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { SEED_STOCK } from '../lib/seed';
import { ABSORPTION_RULES, INTERACTION_RULES, matchesIngredient } from '../lib/knowledge';

/**
 * シードデータの決まりごと — デモが崩れる置き方を防ぐ
 *
 * AGENTS.md の「壊してはいけない制約」のうち、シードに関するものをここで押さえる。
 * 文章で書いてあるだけだと、後から薬を足すときに気づけない。
 */

const PRESCRIPTIONS = SEED_STOCK.filter((i) => i.isPrescription);
const ORAL = PRESCRIPTIONS.filter((i) => i.form === '錠剤' || i.form === 'カプセル');

describe('シードデータ', () => {
  it('処方の内服に NSAIDs を置かない', () => {
    // 置くと、市販イブプロフェン製剤のスキャンが🔴の条件にも該当し、
    // デモの主役である🟡が不安定になる（AGENTS.md 制約1）
    const nsaids = ['ロキソプロフェン', 'イブプロフェン', 'ジクロフェナク', 'セレコキシブ'];
    for (const item of ORAL) {
      for (const ingredient of item.ingredients) {
        for (const n of nsaids) {
          assert.ok(
            !matchesIngredient(ingredient, n),
            `処方の内服に NSAIDs があります: ${item.name}`,
          );
        }
      }
    }
  });

  it('処方の内服が、市販の解熱鎮痛薬と相互作用しない', () => {
    // 🟡デモ（在庫のイブA錠と同じイブプロフェンを店頭で見る）を安定させるための決まり。
    // キノロン系抗菌薬を置くと NSAIDs との併用注意で🔴に振れる
    const otcPainkillers = ['イブプロフェン', 'ロキソプロフェン', 'アセトアミノフェン', 'アスピリン'];
    for (const item of ORAL) {
      for (const ingredient of item.ingredients) {
        for (const rule of INTERACTION_RULES) {
          const inStock = rule.stock.examples.some((e) => matchesIngredient(ingredient, e));
          if (!inStock) continue;
          const hitsOtc = rule.otc.examples.some((e) =>
            otcPainkillers.some((p) => matchesIngredient(p, e)),
          );
          assert.ok(
            !hitsOtc,
            `${item.name} は市販の解熱鎮痛薬と相互作用します（🟡デモが🔴に振れます）`,
          );
        }
      }
    }
  });

  it('吸収阻害のデモが成立する抗菌薬が入っている', () => {
    const found = SEED_STOCK.some((item) =>
      item.ingredients.some((ingredient) =>
        ABSORPTION_RULES.some((rule) =>
          rule.affected.examples.some((e) => matchesIngredient(ingredient, e)),
        ),
      ),
    );
    assert.ok(found, '吸収阻害を実演できる薬がシードにありません');
  });

  it('id が重複しない', () => {
    const ids = SEED_STOCK.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('処方の外用薬が顔に指定してある（🔴デモの前提）', () => {
    const topical = PRESCRIPTIONS.filter((i) => i.form === '軟膏' || i.form === 'ローション');
    assert.ok(topical.length > 0);
    assert.ok(topical.every((i) => i.bodyPart === '顔'));
  });

  it('ルーティンに並ぶ在庫がある', () => {
    assert.ok(SEED_STOCK.some((i) => i.routine === 'inbath'));
    assert.ok(SEED_STOCK.some((i) => i.routine === 'outbath'));
  });

  it('服薬記録に出る薬に残量が入っている', () => {
    for (const item of SEED_STOCK) {
      if (!item.dose) continue;
      assert.ok(item.remaining, `${item.name} に残量がありません`);
    }
  });
});
