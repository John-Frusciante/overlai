import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { ExtractionSchema, JudgementSchema } from '@/lib/schemas';
import {
  EXTRACTION_SYSTEM_PROMPT,
  JUDGEMENT_SYSTEM_PROMPT,
  buildJudgementUserMessage,
} from '@/lib/prompts';
import type { ApiErrorCode, ExtractionResult, Judgement, StockItem } from '@/lib/types';

/**
 * 判定API — 設計仕様書 §7・§8
 *
 * 抽出（ステップ1）と判定（ステップ2）をサーバー側で直列実行する。
 * エンドポイントを1本に集約しているのは、分割すると往復が2回になりレイテンシが倍増するため（§8.3）。
 * 2段階に分ける設計思想はパイプラインの話であって、エンドポイント数の話ではない。
 *
 * APIキーはこのファイル（サーバー側）でのみ保持する。クライアントから直接叩かせない（NFR-05）。
 */

export const maxDuration = 60;

const MODEL = 'claude-opus-5';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_STOCK_ITEMS = 50;
const MAX_FIELD_LEN = 200;

const client = new Anthropic({ timeout: 60_000 }); // TypeScript SDK はミリ秒指定

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

function fail(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** data URL を Vision 入力用に分解する */
function parseDataUrl(image: unknown): { mediaType: MediaType; data: string } | null {
  if (typeof image !== 'string') return null;
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m) return null;
  const data = m[2];
  // base64 は元データの約4/3のサイズになる
  if ((data.length * 3) / 4 > MAX_IMAGE_BYTES) return null;
  return { mediaType: m[1] as MediaType, data };
}

/**
 * stock はクライアント由来の入力として検証する（§8.3）。
 * デモではシード固定だが、外部入力をそのままLLMへ渡す経路であることに変わりはない。
 */
function sanitizeStock(input: unknown): StockItem[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  if (input.length > MAX_STOCK_ITEMS) return null;

  const clip = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX_FIELD_LEN) : '');

  return input.map((raw) => {
    const item = raw as Partial<StockItem>;
    return {
      id: clip(item.id),
      name: clip(item.name),
      category: clip(item.category) as StockItem['category'],
      ingredients: Array.isArray(item.ingredients)
        ? item.ingredients.slice(0, 30).map(clip).filter(Boolean)
        : [],
      status: clip(item.status),
      isPrescription: Boolean(item.isPrescription),
      bodyPart: item.bodyPart ? clip(item.bodyPart) : undefined,
    };
  });
}

export async function POST(req: Request) {
  const started = Date.now();

  let body: { image?: unknown; stock?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('INVALID_IMAGE', 'リクエストの形式が正しくありません', 400);
  }

  const image = parseDataUrl(body.image);
  if (!image) {
    return fail('INVALID_IMAGE', '画像を読み込めませんでした。選び直してください', 400);
  }

  const stock = sanitizeStock(body.stock);
  if (!stock) {
    return fail('INVALID_IMAGE', '在庫データが不正です', 400);
  }

  try {
    // ── ステップ1: 成分抽出（Vision） ────────────────────────────────
    // thinking は明示的に無効化しない（既定の adaptive のまま）。§7.5
    const step1 = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000, // thinking トークンもここから消費されるため切り詰めない
      output_config: { format: zodOutputFormat(ExtractionSchema), effort: 'medium' },
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.data },
            },
            { type: 'text', text: 'この商品パッケージから成分情報を抽出してください。' },
          ],
        },
      ],
    });

    const extraction = step1.parsed_output as ExtractionResult | null;
    if (!extraction) {
      return fail('UPSTREAM_ERROR', '成分の解析に失敗しました', 500);
    }

    // ingredients が空なら照合できない。confidence は条件に含めない（§8.1）
    if (extraction.ingredients.length === 0) {
      return fail(
        'EXTRACTION_FAILED',
        '成分表示を読み取れませんでした。成分表示に寄せて撮り直してください',
        422,
      );
    }

    // ── ステップ2: 在庫照合判定 ──────────────────────────────────────
    // effort はここでは下げない。判定品質がそのまま評価対象になるため（§7.5）
    const step2 = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { format: zodOutputFormat(JudgementSchema), effort: 'high' },
      system: JUDGEMENT_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildJudgementUserMessage(extraction, stock) },
      ],
    });

    const raw = step2.parsed_output as Judgement | null;
    if (!raw) {
      return fail('UPSTREAM_ERROR', '判定に失敗しました', 500);
    }

    // 安全に関わる値をモデル出力に委ねない（§7.4）
    const judgement: Judgement = {
      ...raw,
      consult_recommended: raw.signal === 'red' ? true : raw.consult_recommended,
      // 成分名のない理由は根拠として成立しないため落とす
      reasons: raw.reasons.filter((r) => r.ingredient.trim().length > 0),
    };

    return NextResponse.json({
      extraction,
      judgement,
      elapsed_ms: Date.now() - started,
    });
  } catch (err) {
    // 具体的なものから順に判定する（広い catch 一本にしない）
    if (err instanceof Anthropic.RateLimitError) {
      return fail('RATE_LIMITED', '混み合っています。少し待って再試行してください', 429);
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[analyze] 認証エラー: ANTHROPIC_API_KEY を確認してください');
      return fail('UPSTREAM_ERROR', '解析サービスに接続できませんでした', 500);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      console.error('[analyze] 接続エラー', err.message);
      return fail('UPSTREAM_ERROR', '通信に失敗しました', 500);
    }
    if (err instanceof Anthropic.APIError) {
      console.error('[analyze] APIError', err.status, err.message);
      return fail('UPSTREAM_ERROR', '解析サービスでエラーが発生しました', 500);
    }
    console.error('[analyze] unexpected', err);
    return fail('UPSTREAM_ERROR', '予期しないエラーが発生しました', 500);
  }
}
