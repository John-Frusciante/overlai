/**
 * 薬の知識 — 判定とルーティンが共有する、出典つきの知識ベース
 *
 * これまで判定プロンプト（lib/prompts.ts）の地の文と lib/routine.ts の定数に
 * 散らばっていたものを、1箇所に集めた。狙いは3つ。
 *
 * 1. **出典を持たせる。** どの組み合わせも `source` に根拠を書く。
 *    出典を書けない組み合わせはここに載せない、という線引きをコードで表す。
 * 2. **テストできるようにする。** プロンプトの地の文はテストできないが、
 *    データなら「この組み合わせが引けること」を検証できる（tests/knowledge.test.ts）。
 * 3. **判定と表示で同じものを使う。** プロンプトへの列挙と、返ってきた理由の
 *    裏取り（lib/verify.ts）が同じ表を見る。プロンプトだけ直して検証側が古いままになる、
 *    という食い違いが起きない。
 *
 * ⚠ ここに載っているのは**代表例であって網羅ではない**。判定プロンプトは
 * 「ここに挙げた以外の組み合わせを推測で作ってはいけない」と縛っている（lib/prompts.ts）。
 * 表を増やすことはできても、網羅したことにはならない。UIの文言でも
 * 「〜の可能性があります」を崩さないこと（設計仕様書 §12）。
 */

/** 出典。一次情報にあたれる形で書く */
export interface Sourced {
  /** 添付文書・インタビューフォーム・公的資料のいずれか。人が読んで探せる粒度で書く */
  source: string;
}

// ── 同効薬（効能重複） ────────────────────────────────────────────────

/**
 * 同じ働きをする成分の群。成分名が違っても、ここで同じ群に入るなら効能重複として扱う。
 *
 * 市販の総合感冒薬・鼻炎薬は複数の群にまたがるため、単剤と重なりやすい。
 */
export interface TherapeuticClass extends Sourced {
  /** 群の名前。プロンプトにも画面にもこの名前で出る */
  name: string;
  ingredients: string[];
}

export const THERAPEUTIC_CLASSES: TherapeuticClass[] = [
  {
    name: '解熱鎮痛',
    ingredients: [
      'アセトアミノフェン',
      'イブプロフェン',
      'ロキソプロフェン',
      'アスピリン',
      'アセチルサリチル酸',
      'エテンザミド',
      'イソプロピルアンチピリン',
    ],
    source: '一般用医薬品「解熱鎮痛薬」製造販売承認基準（厚生労働省）の有効成分区分',
  },
  {
    name: '抗ヒスタミン',
    ingredients: [
      'クロルフェニラミン',
      'd-クロルフェニラミン',
      'ジフェニルピラリン',
      'ジフェンヒドラミン',
      'フェキソフェナジン',
      'ロラタジン',
      'セチリジン',
      'エピナスチン',
    ],
    source: '各成分の添付文書「効能・効果」（抗ヒスタミン作用）',
  },
  {
    name: '鎮咳',
    ingredients: ['ジヒドロコデイン', 'コデイン', 'デキストロメトルファン', 'ノスカピン'],
    source: '一般用医薬品「鎮咳去痰薬」製造販売承認基準の有効成分区分',
  },
  {
    name: '交感神経刺激（鼻づまり）',
    ingredients: ['メチルエフェドリン', 'プソイドエフェドリン', 'フェニレフリン', 'ナファゾリン'],
    source: '一般用医薬品「鼻炎用内服薬」製造販売承認基準の有効成分区分',
  },
  {
    name: '鎮静・催眠',
    ingredients: [
      'アリルイソプロピルアセチル尿素',
      'ブロモバレリル尿素',
      'ジフェンヒドラミン',
    ],
    source: '各成分の添付文書「効能・効果」（鎮静・催眠作用）',
  },
];

// ── 吸収阻害 ────────────────────────────────────────────────────────

/**
 * 一緒に使うと相手の吸収を妨げる組み合わせ。
 *
 * 多くは**時間をあけることで避けられる**ため、「使ってはいけない」ではなく
 * 「使うタイミングに注意が必要な可能性がある」という趣旨で書く。
 */
export interface AbsorptionRule extends Sourced {
  /** 妨げる側 */
  agent: { label: string; examples: string[] };
  /** 効きが落ちる側 */
  affected: { label: string; examples: string[] };
  /** 時間をあけることで避けられるか */
  separable: boolean;
}

export const ABSORPTION_RULES: AbsorptionRule[] = [
  {
    agent: { label: '鉄（鉄剤・鉄配合サプリ）', examples: ['クエン酸第一鉄', 'フマル酸第一鉄', '鉄', 'ヘム鉄'] },
    affected: {
      label: 'テトラサイクリン系抗菌薬',
      examples: ['ミノサイクリン', 'ドキシサイクリン', 'テトラサイクリン'],
    },
    separable: true,
    source: 'ミノサイクリン塩酸塩錠 添付文書「相互作用（併用注意）」— キレート形成による吸収低下',
  },
  {
    agent: { label: '鉄（鉄剤・鉄配合サプリ）', examples: ['クエン酸第一鉄', 'フマル酸第一鉄', '鉄'] },
    affected: {
      label: 'ニューキノロン系抗菌薬',
      examples: ['レボフロキサシン', 'シプロフロキサシン', 'トスフロキサシン'],
    },
    separable: true,
    source: 'レボフロキサシン錠 添付文書「相互作用（併用注意）」— キレート形成による吸収低下',
  },
  {
    agent: {
      label: 'カルシウム・マグネシウム・アルミニウム（制酸剤、Ca/Mgサプリ）',
      examples: ['炭酸カルシウム', '酸化マグネシウム', '乾燥水酸化アルミニウムゲル', 'カルシウム', 'マグネシウム'],
    },
    affected: {
      label: 'テトラサイクリン系／ニューキノロン系抗菌薬',
      examples: ['ミノサイクリン', 'ドキシサイクリン', 'レボフロキサシン', 'シプロフロキサシン'],
    },
    separable: true,
    source: '各抗菌薬の添付文書「相互作用（併用注意）」— 金属カチオンとのキレート形成',
  },
  {
    agent: { label: '亜鉛', examples: ['グルコン酸亜鉛', '亜鉛'] },
    affected: {
      label: 'テトラサイクリン系／ニューキノロン系抗菌薬',
      examples: ['ミノサイクリン', 'ドキシサイクリン', 'レボフロキサシン'],
    },
    separable: true,
    source: '各抗菌薬の添付文書「相互作用（併用注意）」— 金属カチオンとのキレート形成',
  },
  {
    agent: { label: 'カルシウム', examples: ['炭酸カルシウム', 'カルシウム'] },
    affected: {
      label: 'ビスホスホネート系（骨粗鬆症の薬）',
      examples: ['アレンドロン酸', 'リセドロン酸', 'ミノドロン酸'],
    },
    separable: true,
    source: 'アレンドロン酸ナトリウム錠 添付文書「相互作用（併用注意）」— キレート形成による吸収低下',
  },
  {
    agent: {
      label: 'カルシウム・マグネシウム・鉄',
      examples: ['炭酸カルシウム', '酸化マグネシウム', 'カルシウム', 'マグネシウム', '鉄'],
    },
    affected: { label: '甲状腺ホルモン薬', examples: ['レボチロキシン'] },
    separable: true,
    source: 'レボチロキシンナトリウム錠 添付文書「相互作用（併用注意）」— 吸収遅延・低下',
  },
];

// ── 相互作用（併用注意・併用禁忌） ──────────────────────────────────────

/**
 * 成分が重ならなくても、**併せて体に入ること自体**にリスクがある組み合わせ。
 *
 * 吸収阻害（効きが落ちる）と分けているのは、避け方が違うため。
 * 吸収阻害は時間をあければ済むことが多いが、こちらは時間をあけても解決しない。
 *
 * ⚠ ここに載せるのは**在庫の処方薬と市販薬の組み合わせ**として現実に起こるものだけ。
 * 処方薬どうしの組み合わせは、そもそも処方した医師・薬剤師が見ている領域なので扱わない。
 */
export interface InteractionRule extends Sourced {
  /** 在庫側（多くは処方薬） */
  stock: { label: string; examples: string[] };
  /** 店頭側（多くは市販薬・サプリ） */
  otc: { label: string; examples: string[] };
  /** 何が起きうるか。断定しない書き方で持つ */
  risk: string;
  level: '併用禁忌' | '併用注意';
}

export const INTERACTION_RULES: InteractionRule[] = [
  {
    stock: { label: '抗凝固薬（血液をさらさらにする薬）', examples: ['ワルファリン', 'ワーファリン', 'エドキサバン', 'リバーロキサバン', 'アピキサバン'] },
    otc: { label: 'NSAIDs（解熱鎮痛薬）', examples: ['イブプロフェン', 'ロキソプロフェン', 'アスピリン', 'アセチルサリチル酸', 'ジクロフェナク'] },
    risk: '出血しやすくなる可能性があります',
    level: '併用注意',
    source: 'ワルファリンカリウム錠 添付文書「相互作用（併用注意）」— 抗凝固作用の増強',
  },
  {
    stock: { label: '抗血小板薬', examples: ['クロピドグレル', 'シロスタゾール', 'チカグレロル'] },
    otc: { label: 'NSAIDs（解熱鎮痛薬）', examples: ['イブプロフェン', 'ロキソプロフェン', 'アスピリン', 'アセチルサリチル酸'] },
    risk: '出血しやすくなる可能性があります',
    level: '併用注意',
    source: 'クロピドグレル硫酸塩錠 添付文書「相互作用（併用注意）」— 出血傾向の増強',
  },
  {
    stock: { label: '降圧薬（ACE阻害薬・ARB）', examples: ['リシノプリル', 'エナラプリル', 'カンデサルタン', 'ロサルタン', 'テルミサルタン', 'アムロジピン'] },
    otc: { label: 'NSAIDs（解熱鎮痛薬）', examples: ['イブプロフェン', 'ロキソプロフェン', 'アスピリン'] },
    risk: '血圧を下げる働きが弱まる可能性があります。利尿薬も併用している場合は腎臓への負担が増す可能性があります',
    level: '併用注意',
    source: 'カンデサルタン シレキセチル錠 添付文書「相互作用（併用注意）」— 降圧作用の減弱・腎機能障害',
  },
  {
    stock: { label: '利尿薬', examples: ['フロセミド', 'トリクロルメチアジド', 'スピロノラクトン', 'アゾセミド'] },
    otc: { label: 'NSAIDs（解熱鎮痛薬）', examples: ['イブプロフェン', 'ロキソプロフェン', 'アスピリン'] },
    risk: '利尿作用が弱まり、腎臓への負担が増す可能性があります',
    level: '併用注意',
    source: 'フロセミド錠 添付文書「相互作用（併用注意）」— 利尿作用の減弱',
  },
  {
    stock: { label: '抗うつ薬（SSRI・SNRI）', examples: ['セルトラリン', 'エスシタロプラム', 'パロキセチン', 'フルボキサミン', 'デュロキセチン'] },
    otc: { label: 'NSAIDs・アスピリン', examples: ['イブプロフェン', 'ロキソプロフェン', 'アスピリン', 'アセチルサリチル酸'] },
    risk: '胃や腸から出血しやすくなる可能性があります',
    level: '併用注意',
    source: 'セルトラリン塩酸塩錠 添付文書「相互作用（併用注意）」— 出血リスクの増加',
  },
  {
    stock: { label: 'メトトレキサート', examples: ['メトトレキサート'] },
    otc: { label: 'NSAIDs（解熱鎮痛薬）', examples: ['イブプロフェン', 'ロキソプロフェン', 'アスピリン'] },
    risk: 'メトトレキサートの血中濃度が上がり、副作用が出やすくなる可能性があります',
    level: '併用注意',
    source: 'メトトレキサートカプセル 添付文書「相互作用（併用注意）」— 排泄遅延による血中濃度上昇',
  },
  {
    stock: { label: '経口ステロイド', examples: ['プレドニゾロン', 'ベタメタゾン', 'デキサメタゾン'] },
    otc: { label: 'NSAIDs（解熱鎮痛薬）', examples: ['イブプロフェン', 'ロキソプロフェン', 'アスピリン'] },
    risk: '胃や腸の粘膜が荒れやすくなる可能性があります',
    level: '併用注意',
    source: 'プレドニゾロン錠 添付文書「相互作用（併用注意）」— 消化管潰瘍のリスク増加',
  },
  {
    stock: { label: '高血圧・心臓の薬', examples: ['アムロジピン', 'カンデサルタン', 'ビソプロロール', 'カルベジロール', 'ジゴキシン'] },
    otc: { label: '交感神経刺激成分（鼻炎薬・かぜ薬に入る）', examples: ['プソイドエフェドリン', 'メチルエフェドリン', 'フェニレフリン'] },
    risk: '血圧や脈拍が上がり、治療中の状態に影響する可能性があります',
    level: '併用注意',
    source: 'プソイドエフェドリン塩酸塩を含む一般用医薬品の添付文書「相談すること」— 高血圧・心臓病の治療を受けている人',
  },
  {
    stock: { label: '糖尿病の薬（スルホニル尿素薬）', examples: ['グリメピリド', 'グリベンクラミド', 'グリクラジド'] },
    otc: { label: 'アスピリン（サリチル酸系）', examples: ['アスピリン', 'アセチルサリチル酸'] },
    risk: '血糖が下がりすぎる可能性があります',
    level: '併用注意',
    source: 'グリメピリド錠 添付文書「相互作用（併用注意）」— 血糖降下作用の増強',
  },
  {
    stock: { label: 'MAO阻害薬（パーキンソン病・うつの薬）', examples: ['セレギリン', 'ラサギリン', 'サフィナミド'] },
    otc: { label: '交感神経刺激成分（鼻炎薬・かぜ薬に入る）', examples: ['プソイドエフェドリン', 'メチルエフェドリン', 'フェニレフリン'] },
    risk: '血圧が急に上がる可能性があります',
    level: '併用禁忌',
    source: 'セレギリン塩酸塩錠 添付文書「相互作用（併用禁忌・併用注意）」— 血圧上昇',
  },
];

// ── 刺激リスク（外用薬を使っている部位） ────────────────────────────────

/**
 * 刺激性が明確に知られている成分と、**逆に刺激として扱ってはいけない成分**。
 *
 * 後者を持っているのが要点。防腐剤や保湿剤はほとんどすべての化粧品に入っており、
 * これで警告を出すと全部が赤になって警告の意味が失われる。
 */
export const IRRITANT_INGREDIENTS: string[] = [
  'エタノール',
  '変性アルコール',
  'サリチル酸',
  'グリコール酸',
  '乳酸',
  'メントール',
  'カンフル',
  'ハッカ油',
  'レチノール',
  'レチノイン酸',
  'アスコルビン酸（高濃度）',
  'スクラブ剤・物理的な角質除去成分',
];

export const NON_IRRITANT_INGREDIENTS: Array<{ group: string; examples: string[] }> = [
  { group: '防腐剤', examples: ['フェノキシエタノール', 'パラベン類', '安息香酸Na'] },
  { group: '保湿剤', examples: ['グリセリン', 'BG', 'DPG', 'ヒアルロン酸Na', 'ジグリセリン'] },
  {
    group: '基剤・乳化剤・増粘剤',
    examples: ['水', 'ジメチコン', 'カルボマー', '水酸化K', 'クエン酸'],
  },
];

// ── 成分バッティング（化粧品どうし） ───────────────────────────────────

/**
 * 同時に重ねると刺激になる可能性が指摘されている組み合わせ。
 * ルーティン画面（lib/routine.ts）が使う。判定には使わない。
 */
export interface ConflictRule extends Sourced {
  a: string[];
  b: string[];
  detail: string;
}

export const CONFLICT_RULES: ConflictRule[] = [
  {
    a: ['レチノール', 'レチノイン酸', 'パルミチン酸レチノール'],
    b: ['アスコルビン酸', 'ビタミンC', 'アスコルビルグルコシド'],
    detail:
      'レチノールと高濃度のビタミンCは、同じタイミングで重ねると刺激になる可能性があります。朝と夜で分けることが一般的です。',
    source: '日本皮膚科学会「美容医療診療指針」— レチノイド外用時の皮膚刺激',
  },
  {
    a: ['レチノール', 'レチノイン酸'],
    b: ['グリコール酸', 'サリチル酸', '乳酸'],
    detail:
      'レチノールとAHA／BHAを同時に使うと、角質への作用が重なって刺激になる可能性があります。',
    source: '日本皮膚科学会「美容医療診療指針」— ケミカルピーリングとレチノイドの併用',
  },
  {
    a: ['アスコルビン酸', 'ビタミンC'],
    b: ['グリコール酸', 'サリチル酸'],
    detail:
      'ビタミンCとAHA／BHAはどちらも酸性度が高く、重ねると刺激になる可能性があります。',
    source: '日本皮膚科学会「美容医療診療指針」— 低pH製剤の重ね塗りによる刺激',
  },
];

// ── 引き当て ─────────────────────────────────────────────────────────

/**
 * 成分名の照合。表記ゆれを吸収するため、双方向の部分一致で見る。
 *
 * 「ワルファリンカリウム」と「ワルファリン」、「イブプロフェン」と
 * 「イブプロフェン（400mg）」のどちらの向きでも当たるようにしている。
 * 読み取り結果には剤形や含量が付いてくることが多く、完全一致では取りこぼす。
 */
export function matchesIngredient(text: string, keyword: string): boolean {
  const a = normalize(text);
  const b = normalize(keyword);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function normalize(s: string): string {
  return s
    .replace(/[\s　]/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .toLowerCase();
}

/** 与えられた成分名が属する同効薬の群（無ければ null） */
export function therapeuticClassOf(ingredient: string): TherapeuticClass | null {
  return (
    THERAPEUTIC_CLASSES.find((c) =>
      c.ingredients.some((i) => matchesIngredient(ingredient, i)),
    ) ?? null
  );
}

/**
 * 成分名から、根拠として示せる出典を引く。
 *
 * 判定理由に一次情報のあたりを付けるために使う（lib/verify.ts）。
 * どの表にも載っていない成分なら null を返す — 出典を捏造しないため。
 */
export function sourceForIngredient(ingredient: string): string | null {
  for (const rule of INTERACTION_RULES) {
    if (
      rule.stock.examples.some((e) => matchesIngredient(ingredient, e)) ||
      rule.otc.examples.some((e) => matchesIngredient(ingredient, e))
    ) {
      return rule.source;
    }
  }
  for (const rule of ABSORPTION_RULES) {
    if (
      rule.agent.examples.some((e) => matchesIngredient(ingredient, e)) ||
      rule.affected.examples.some((e) => matchesIngredient(ingredient, e))
    ) {
      return rule.source;
    }
  }
  const klass = therapeuticClassOf(ingredient);
  return klass ? klass.source : null;
}
