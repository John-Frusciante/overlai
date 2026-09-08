import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { ExtractionSchema } from '@/lib/schemas';
import { EXTRACTION_SYSTEM_PROMPT } from '@/lib/prompts';
import { parseDataUrl } from '@/lib/request';
import { MOCK_EXTRACTION } from '@/lib/mock';
import type { ExtractionResult } from '@/lib/types';

/**
 * 成分抽出のみを行うエンドポイント — 在庫登録用
 *
 * /api/analyze はステップ2（在庫照合）まで走るが、在庫登録では抽出結果だけが要る。
 * ステップ1のプロンプトとスキーマは analyze と共有している。
 */

export const maxDuration = 60;

const MODEL = 'claude-opus-5';

function useMock(): boolean {
  return process.env.OVERLAI_MOCK === '1' || !process.env.ANTHROPIC_API_KEY;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ timeout: 60_000 });
  return _client;
}

export async function POST(req: Request) {
  let body: { image?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_IMAGE', message: 'リクエストの形式が正しくありません' } },
      { status: 400 },
    );
  }

  const image = parseDataUrl(body.image);
  if (!image) {
    return NextResponse.json(
      { error: { code: 'INVALID_IMAGE', message: '画像を読み込めませんでした' } },
      { status: 400 },
    );
  }

  if (useMock()) {
    console.warn('[extract] モックモードで応答しています（ANTHROPIC_API_KEY 未設定）');
    await new Promise((r) => setTimeout(r, 2600));
    return NextResponse.json({ extraction: MOCK_EXTRACTION, mocked: true });
  }

  try {
    const res = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 16000,
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

    const extraction = res.parsed_output as ExtractionResult | null;
    if (!extraction || extraction.ingredients.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'EXTRACTION_FAILED',
            message: '成分表示を読み取れませんでした。成分表示に寄せて撮り直してください',
          },
        },
        { status: 422 },
      );
    }
    return NextResponse.json({ extraction });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: '混み合っています。少し待って再試行してください' } },
        { status: 429 },
      );
    }
    console.error('[extract] error', err);
    return NextResponse.json(
      { error: { code: 'UPSTREAM_ERROR', message: '読み取りに失敗しました' } },
      { status: 500 },
    );
  }
}
