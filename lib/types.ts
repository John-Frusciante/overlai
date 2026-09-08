/**
 * データモデル — 設計仕様書 §6
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
  | 'ヘアケア';

export interface StockItem {
  id: string;
  name: string;
  category: StockCategory;
  ingredients: string[];
  status: string;
  isPrescription: boolean;
  bodyPart?: string;
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
}

export type ApiErrorCode =
  | 'INVALID_IMAGE'
  | 'EXTRACTION_FAILED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}
