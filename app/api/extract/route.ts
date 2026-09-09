import { NextResponse } from 'next/server';
import { MOCK_EXTRACTION } from '@/lib/mock';
import { parseDataUrl } from '@/lib/request';
import { activeProvider, classifyError, extractIngredients } from '@/lib/llm';

/**
 * 成分抽出のみを行うエンドポイント — 在庫登録用
 *
 * /api/analyze はステップ2（在庫照合）まで走るが、在庫登録では抽出結果だけが要る。
 * ステップ1のプロンプトとスキーマは analyze と共有している（lib/llm.ts）。
 */

export const maxDuration = 60;

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

  const provider = activeProvider();

  if (provider === 'mock') {
    console.warn('[extract] モックモードで応答しています（APIキー未設定）');
    await new Promise((r) => setTimeout(r, 2600));
    return NextResponse.json({ extraction: MOCK_EXTRACTION, provider, mocked: true });
  }

  try {
    // 呼び出しは失敗したプロバイダを自動で次に落とす（lib/llm.ts）
    const extracted = await extractIngredients(image);
    const extraction = extracted.value;
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
    return NextResponse.json({
      extraction,
      provider: extracted.provider,
      fell_back: Boolean(extracted.fellBackFrom),
    });
  } catch (err) {
    if (classifyError(err) === 'rate_limited') {
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
