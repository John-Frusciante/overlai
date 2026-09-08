import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { ExtractionSchema, JudgementSchema } from '@/lib/schemas';
import {
  EXTRACTION_SYSTEM_PROMPT,
  JUDGEMENT_SYSTEM_PROMPT,
  buildJudgementUserMessage,
} from '@/lib/prompts';
import { MOCK_FIXTURES, isSignal } from '@/lib/mock';
import { parseDataUrl, sanitizeStock } from '@/lib/request';
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
/**
 * モックモード — 設計仕様書には無い運用上の分岐。
 * ANTHROPIC_API_KEY が設定されていなければ固定応答を返す。
 * キーを設定すれば、コード変更なしで本物のパイプラインに切り替わる。
 */
function useMock(): boolean {
  return process.env.OVERLAI_MOCK === '1' || !process.env.ANTHROPIC_API_KEY;
}

// キー未設定でも起動できるよう遅延生成する
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ timeout: 60_000 }); // SDK はミリ秒指定
  return _client;
}

function fail(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  const started = Date.now();

  let body: { image?: unknown; stock?: unknown; demo?: unknown };
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

  // ── モック応答 ──────────────────────────────────────────────────
  // AIを呼ばない。デモ動画の撮影とUI確認のための経路。
  if (useMock()) {
    console.warn('[analyze] モックモードで応答しています（ANTHROPIC_API_KEY 未設定）');
    const scenario = isSignal(body.demo) ? body.demo : 'yellow';
    // 2段階ローディングが映る程度の待ち時間を入れる
    await new Promise((r) => setTimeout(r, 5200));
    return NextResponse.json({
      ...MOCK_FIXTURES[scenario],
      elapsed_ms: Date.now() - started,
      mocked: true,
    });
  }

  try {
    // ── ステップ1: 成分抽出（Vision） ────────────────────────────────
    // thinking は明示的に無効化しない（既定の adaptive のまま）。§7.5
    const step1 = await getClient().messages.parse({
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
    const step2 = await getClient().messages.parse({
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
