import { z } from 'zod';

/**
 * 構造化出力スキーマ — 設計仕様書 §7.3・§7.4
 *
 * ingredient を必須にすることで「根拠なき警告を出さない」という安全制約を
 * プロンプトのお願いではなくスキーマレベルで強制する（§12）。
 */

export const ExtractionSchema = z.object({
  product_name: z.string().nullable(),
  category: z.enum(['市販薬', 'サプリ', 'スキンケア', 'ヘアケア', '不明']),
  form: z.enum(['錠剤', 'カプセル', '化粧水', '乳液', 'クリーム', '軟膏', 'シャンプー', '不明']),
  ingredients: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const JudgementSchema = z.object({
  signal: z.enum(['blue', 'yellow', 'red']),
  headline: z.string(),
  summary: z.string(),
  matched_item_ids: z.array(z.string()),
  reasons: z.array(
    z.object({
      type: z.enum(['成分重複', '効能重複', '刺激リスク', '吸収阻害']),
      ingredient: z.string(),
      detail: z.string(),
      related_item: z.string(),
    }),
  ),
  consult_recommended: z.boolean(),
});
