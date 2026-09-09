import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ExtractionSchema, JudgementSchema } from './schemas';
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_TEXT,
  JUDGEMENT_SYSTEM_PROMPT,
  buildJudgementUserMessage,
} from './prompts';
import type { ExtractionResult, Judgement, StockItem } from './types';

/**
 * AIプロバイダの抽象 — 設計仕様書 §7
 *
 * プロンプト（lib/prompts.ts）とスキーマ（lib/schemas.ts）はプロバイダに依存しない。
 * ここで差し替えるのは呼び出し方だけであり、2段階パイプラインの構造は変わらない。
 *
 * 優先順位:
 *   OVERLAI_MOCK=1        → モック（AIを呼ばない）
 *   ANTHROPIC_API_KEY     → Anthropic Claude
 *   AZURE_PROXY_KEY       → Azure OpenAI 互換プロキシ（gpt-4o-mini）
 *   いずれも無し           → モック
 */

export type Provider = 'anthropic' | 'azure' | 'mock';

export function activeProvider(): Provider {
  if (process.env.OVERLAI_MOCK === '1') return 'mock';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.AZURE_PROXY_KEY) return 'azure';
  return 'mock';
}

/** 現在どのAIで動いているかを人が読める形で返す（ログ・ドキュメント用） */
export function providerLabel(p: Provider = activeProvider()): string {
  if (p === 'anthropic') return `Anthropic Claude (${ANTHROPIC_MODEL})`;
  if (p === 'azure') return `Azure OpenAI proxy (${AZURE_MODEL_EXTRACT} / ${AZURE_MODEL_JUDGE})`;
  return 'モック（AIを呼んでいません）';
}

export interface ImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  data: string;
}

// ── クライアント（遅延生成。キーが無くてもアプリが起動できるように） ──────────

const ANTHROPIC_MODEL = 'claude-opus-5';

/**
 * Azure プロキシで使うモデル。
 * gpt-4o-mini は速いが成分名を誤読することがある（「いブプロフェン」など）。
 * 成分名の正確さは照合の前提なので、抽出・判定とも gpt-5.1 を既定にしている。
 * 実測: 抽出 4.7秒 / 判定 4.1秒（合計約9秒。NFR-01 の10秒以内に収まる）
 */
const AZURE_MODEL_EXTRACT = process.env.AZURE_MODEL_EXTRACT ?? 'gpt-5.1';
const AZURE_MODEL_JUDGE = process.env.AZURE_MODEL_JUDGE ?? 'gpt-5.1';

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ timeout: 60_000 }); // SDK はミリ秒指定
  return _anthropic;
}

let _azure: OpenAI | null = null;
function azure(): OpenAI {
  if (!_azure) {
    const endpoint = (
      process.env.AZURE_PROXY_ENDPOINT ??
      'https://proxy-openai.thankfulmeadow-3cc38609.japaneast.azurecontainerapps.io/'
    ).replace(/\/+$/, '');
    const key = process.env.AZURE_PROXY_KEY ?? '';
    _azure = new OpenAI({
      apiKey: key,
      baseURL: `${endpoint}/models`,
      // プロキシは api-key ヘッダーと api-version クエリを要求する
      defaultHeaders: { 'api-key': key },
      defaultQuery: { 'api-version': process.env.AZURE_PROXY_API_VERSION ?? '2025-04-01-preview' },
      timeout: 60_000,
    });
  }
  return _azure;
}

// ── ステップ1: 成分抽出（Vision） ─────────────────────────────────────

export async function extractIngredients(image: ImageInput): Promise<ExtractionResult | null> {
  if (activeProvider() === 'anthropic') {
    // thinking は明示的に無効化しない（既定の adaptive のまま）。§7.5
    const res = await anthropic().messages.parse({
      model: ANTHROPIC_MODEL,
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
            { type: 'text', text: EXTRACTION_USER_TEXT },
          ],
        },
      ],
    });
    return (res.parsed_output as ExtractionResult | null) ?? null;
  }

  const res = await azure().chat.completions.parse({
    model: AZURE_MODEL_EXTRACT,
    // gpt-5 系は max_tokens を受け付けない
    max_completion_tokens: 4000,
    response_format: zodResponseFormat(ExtractionSchema, 'extraction'),
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${image.mediaType};base64,${image.data}` },
          },
          { type: 'text', text: EXTRACTION_USER_TEXT },
        ],
      },
    ],
  });
  return (res.choices[0]?.message.parsed as ExtractionResult | null) ?? null;
}

// ── ステップ2: 在庫照合判定 ────────────────────────────────────────────

export async function judgeAgainstStock(
  extraction: ExtractionResult,
  stock: StockItem[],
): Promise<Judgement | null> {
  const userMessage = buildJudgementUserMessage(extraction, stock);

  if (activeProvider() === 'anthropic') {
    // effort はここでは下げない。判定品質がそのまま評価対象になるため（§7.5）
    const res = await anthropic().messages.parse({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      output_config: { format: zodOutputFormat(JudgementSchema), effort: 'high' },
      system: JUDGEMENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    return (res.parsed_output as Judgement | null) ?? null;
  }

  const res = await azure().chat.completions.parse({
    model: AZURE_MODEL_JUDGE,
    max_completion_tokens: 4000,
    response_format: zodResponseFormat(JudgementSchema, 'judgement'),
    messages: [
      { role: 'system', content: JUDGEMENT_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  });
  return (res.choices[0]?.message.parsed as Judgement | null) ?? null;
}

// ── エラー分類（プロバイダごとの例外を共通の形に落とす） ───────────────────

export type LlmFailure = 'rate_limited' | 'auth' | 'connection' | 'upstream';

export function classifyError(err: unknown): LlmFailure {
  if (err instanceof Anthropic.RateLimitError || err instanceof OpenAI.RateLimitError) {
    return 'rate_limited';
  }
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof OpenAI.AuthenticationError
  ) {
    return 'auth';
  }
  if (
    err instanceof Anthropic.APIConnectionError ||
    err instanceof OpenAI.APIConnectionError
  ) {
    return 'connection';
  }
  return 'upstream';
}
