import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { SEED_STOCK, seedStock } from '../lib/seed';
import {
  ABSORPTION_RULES,
  INTERACTION_RULES,
  findAbsorptionRule,
  findInteractionRule,
  matchesIngredient,
  sharedTherapeuticClass,
} from '../lib/knowledge';
import { endedCourses, localDateKey } from '../lib/course';

/**
 * シードデータの決まりごと — デモが崩れる置き方を防ぐ
 *
 * AGENTS.md の「壊してはいけない制約」のうち、シードに関するものをここで押さえる。
 * 文章で書いてあるだけだと、後から薬を足すときに気づけない。
 */

const PRESCRIPTIONS = SEED_STOCK.filter((i) => i.isPrescription);
const ORAL = PRESCRIPTIONS.filter((i) => i.form === '錠剤' || i.form === 'カプセル');

describe('シードデータ', () => {
  it('展示の初期化直後に「飲み終わりましたか」が出ない', () => {
    // 見本に戻した直後から終わった薬が並ぶと、来場者に最初に見せる画面が崩れる
    const today = localDateKey();
    assert.deepEqual(endedCourses(SEED_STOCK, today), []);
  });

  it('見本はその日を基準に作り直せる（展示端末を何日も開いたままでも崩れない）', () => {
    const later = new Date();
    later.setDate(later.getDate() + 30);
    assert.deepEqual(endedCourses(seedStock(later), localDateKey(later)), []);
  });

  it('処方の飲む期間の見本が1つはある（機能の見本として）', () => {
    assert.ok(SEED_STOCK.some((i) => i.course));
  });

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

  // ── 本選の🟡デモ（docs/本選デモ手順.md ②）──────────────────────────
  // 店頭で撮る商品の有効成分。成分が変わる商品に替えたら、ここも合わせる

  const DEMO_YELLOW = { name: 'カロナールA', ingredients: ['アセトアミノフェン'] };
  const SEED_INGREDIENTS = SEED_STOCK.flatMap((i) => i.ingredients);

  it('🟡デモの商品が、シードと吸収阻害・相互作用を起こさない（#41）', () => {
    for (const ingredient of DEMO_YELLOW.ingredients) {
      assert.equal(
        findAbsorptionRule(ingredient, DEMO_YELLOW.ingredients, SEED_INGREDIENTS),
        null,
        `${DEMO_YELLOW.name} がシードと吸収阻害を起こします（🟡デモが🔴に振れます）`,
      );
      assert.equal(
        findInteractionRule(ingredient, DEMO_YELLOW.ingredients, SEED_INGREDIENTS),
        null,
        `${DEMO_YELLOW.name} がシードと相互作用を起こします（🟡デモが🔴に振れます）`,
      );
    }
  });

  it('🟡デモの商品が、家のイブA錠と同じ働きの薬として重なる', () => {
    const ibuA = SEED_STOCK.find((i) => i.name === 'イブA錠');
    assert.ok(ibuA, 'シードにイブA錠がありません');
    assert.ok(
      DEMO_YELLOW.ingredients.some((i) =>
        sharedTherapeuticClass(i, DEMO_YELLOW.ingredients, ibuA!.ingredients),
      ),
    );
  });

  it('制酸剤入りの鎮痛薬は🟡デモに使えない（バファリン プレミアムDX が🔴になった理由）', () => {
    // 乾燥水酸化アルミニウムゲルが、シードのミノサイクリンの吸収を妨げる。判定としては正しい
    const bufferin = ['イブプロフェン', 'アセトアミノフェン', '乾燥水酸化アルミニウムゲル'];
    assert.ok(findAbsorptionRule('乾燥水酸化アルミニウムゲル', bufferin, SEED_INGREDIENTS));
  });
});
