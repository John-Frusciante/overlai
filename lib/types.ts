/**
 * データモデル — 設計仕様書 §6 ＋ ルーティン／在庫維持機能の拡張
 *
 * ExtractionResult.category と StockCategory は別軸であり、値が一致しないのは意図的。
 * 前者は店頭商品の分類（処方薬は店頭に並ばない）、後者は自宅在庫の分類（処方の内服・外用を区別する）。
 * 一方を他方へキャストしないこと。
 */

export type StockCategory =
  | '処方薬'
  | '処方薬(外用)'
  | '市販薬・サプリ'
  | 'スキンケア'
  | 'ヘアケア'
  | 'ボディケア';

/**
 * 剤形。塗る順序のソートキーになる（lib/routine.ts）。
 * 水分が多く浸透の速いものから、油分が多く蓋になるものへ並べる。
 */
export type ItemForm =
  | '錠剤'
  | 'カプセル'
  | '導入液'
  | '化粧水'
  | '美容液'
  | 'ローション'
  | '乳液'
  | 'クリーム'
  | '軟膏'
  | 'オイル'
  | 'シャンプー'
  | 'トリートメント'
  | '洗顔'
  | 'ボディソープ'
  | 'その他';

/** 服用タイミング */
export type DoseTime = '朝' | '昼' | '夜';

/** ルーティンの区分 */
export type RoutineKind = 'inbath' | 'outbath';

export interface StockItem {
  id: string;
  name: string;
  category: StockCategory;
  form: ItemForm;
  ingredients: string[];
  /** 表示用の状態テキスト。remaining があればそちらを優先表示する */
  status: string;
  isPrescription: boolean;
  bodyPart?: string;

  /** 残量。服薬記録で減っていく */
  remaining?: { count: number; unit: string };
  /** 服用タイミング。指定があると今日のルーティンに並ぶ */
  dose?: { times: DoseTime[]; perTime: number };
  /** 開封日（ISO日付）。酸化目安の起点 */
  openedAt?: string;
  /** 使用期限（ISO日付） */
  expiresAt?: string;
  /** 洗う／塗るルーティンの対象か */
  routine?: RoutineKind;
}

export type ProductCategory = '市販薬' | 'サプリ' | 'スキンケア' | 'ヘアケア' | '不明';

export type ProductForm =
  | '錠剤' | 'カプセル' | '化粧水' | '乳液' | 'クリーム' | '軟膏' | 'シャンプー' | '不明';

/** ステップ1（成分抽出）の出力 — §6.3 */
export interface ExtractionResult {
  product_name: string | null;
  category: ProductCategory;
  form: ProductForm;
  ingredients: string[];
  confidence: 'high' | 'medium' | 'low';
}

export type Signal = 'blue' | 'yellow' | 'red';
export type ReasonType = '成分重複' | '効能重複' | '刺激リスク' | '吸収阻害';

export interface Reason {
  type: ReasonType;
  /** 該当成分名。空文字は禁止（根拠なき警告を出さないため） */
  ingredient: string;
  detail: string;
  related_item: string;
}

/** ステップ2（在庫照合判定）の出力 — §6.4 */
export interface Judgement {
  signal: Signal;
  headline: string;
  summary: string;
  matched_item_ids: string[];
  reasons: Reason[];
  consult_recommended: boolean;
}

export interface AnalyzeResponse {
  extraction: ExtractionResult;
  judgement: Judgement;
  elapsed_ms: number;
  mocked?: boolean;
}

export type ApiErrorCode =
  | 'INVALID_IMAGE'
  | 'EMPTY_STOCK'
  | 'EXTRACTION_FAILED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

/** 服薬記録。日付ごとに「どのアイテムのどのタイミングを飲んだか」を持つ */
export interface DoseLog {
  /** 'YYYY-MM-DD' */
  date: string;
  /** `${itemId}:${time}` の集合 */
  taken: string[];
}

/** 期限・酸化のアラート — lib/expiry.ts */
export interface ExpiryAlert {
  itemId: string;
  itemName: string;
  kind: '使用期限' | '開封後の目安';
  /** 残り日数。負なら超過 */
  daysLeft: number;
  level: 'expired' | 'soon' | 'ok';
  message: string;
}

/** 塗る／洗う順序の1ステップ — lib/routine.ts */
export interface RoutineStep {
  order: number;
  item: StockItem;
  /** なぜこの順序なのかの説明 */
  note: string;
}

/** 成分バッティング警告 — lib/routine.ts */
export interface ConflictWarning {
  items: [string, string];
  ingredients: [string, string];
  detail: string;
}

// ── 肌質プロフィールと洗浄基剤 ────────────────────────────────────────

/**
 * 肌質・頭皮状態。ユーザーの自己申告であり、診断ではない。
 * 画面にもその旨を明示すること（設計仕様書 §12）。
 */
export type SkinType = '乾燥' | '脂性' | '混合' | '敏感' | '普通';
export type ScalpType = '乾燥' | '脂性' | 'ふけ・かゆみ' | '普通';

export interface Profile {
  skin?: SkinType;
  scalp?: ScalpType;
}

/** 洗浄成分の系統 */
export type CleanserBase =
  | 'アミノ酸系'
  | 'ベタイン系'
  | '高級アルコール系'
  | '石鹸系'
  | '不明';

/** 洗浄基剤と肌質・頭皮の相性 */
export interface CleanserMatch {
  base: CleanserBase;
  /** 主剤と判定した成分名。根拠として必ず示す */
  ingredient: string | null;
  level: 'good' | 'caution' | 'neutral';
  message: string;
}
