import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ApiError, GoogleGenAI, type Part } from '@google/genai';
import { z } from 'zod';
import { ExtractionSchema, JudgementSchema, RoutineAdviceSchema } from './schemas';
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_TEXT,
  JUDGEMENT_SYSTEM_PROMPT,
  ROUTINE_ADVICE_SYSTEM_PROMPT,
  buildJudgementUserMessage,
  buildRoutineAdviceUserMessage,
} from './prompts';
import type { ExtractionResult, Judgement, Provider, RoutineAdvice, StockItem } from './types';

/**
 * AIプロバイダの抽象 — 設計仕様書 §7
 *
 * プロンプト（lib/prompts.ts）とスキーマ（lib/schemas.ts）はプロバイダに依存しない。
 * ここで差し替えるのは呼び出し方だけであり、2段階パイプラインの構造は変わらない。
 *
 * 優先順位（キーがあるものを上から順に使い、失敗したら次に落ちる）:
 *   OVERLAI_MOCK=1        → モック（AIを呼ばない。以降は評価しない）
 *   ANTHROPIC_API_KEY     → Anthropic Claude
 *   AZURE_PROXY_KEY       → Azure OpenAI 互換プロキシ（学校配布）
 *   GEMINI_API_KEY        → Google Gemini
 *   いずれも無し           → モック
 *
 * 本番は学校配布のプロキシ1本で動いており、その停止・失効がそのまま機能停止になる。
 * Gemini はそのための保険であり、独立した事業者のクォータに乗ることに意味がある。
 */

export type { Provider };

/** 使用するプロバイダを優先順で返す。先頭が第一候補、以降がフォールバック先。 */
export function providerChain(): Provider[] {
  if (process.env.OVERLAI_MOCK === '1') return ['mock'];
  const chain: Provider[] = [];
  if (process.env.ANTHROPIC_API_KEY) chain.push('anthropic');
  if (process.env.AZURE_PROXY_KEY) chain.push('azure');
  if (process.env.GEMINI_API_KEY) chain.push('gemini');
  return chain.length > 0 ? chain : ['mock'];
}

export function activeProvider(): Provider {
  return providerChain()[0] ?? 'mock';
}

/** 現在どのAIで動いているかを人が読める形で返す（ログ・ドキュメント用） */
export function providerLabel(p: Provider = activeProvider()): string {
  if (p === 'anthropic') return `Anthropic Claude (${ANTHROPIC_MODEL})`;
  if (p === 'azure') return `Azure OpenAI proxy (${AZURE_MODEL_EXTRACT} / ${AZURE_MODEL_JUDGE})`;
  if (p === 'gemini') return `Google Gemini (${GEMINI_MODEL_EXTRACT} / ${GEMINI_MODEL_JUDGE})`;
  return 'モック（AIを呼んでいません）';
}

/**
 * AI呼び出しの結果。どのプロバイダが実際に答えたかを一緒に返す。
 * フォールバックが起きたとき、レスポンスの provider が実態とズレると
 * 「どのAIで動いているか」を示すデモの表示が嘘になるため。
 */
export interface LlmResult<T> {
  value: T | null;
  provider: Provider;
  /** フォールバックが発火した場合、本来使うはずだったプロバイダ */
  fellBackFrom?: Provider;
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

/**
 * 時間の使い方 — route の `maxDuration`（60秒）を超えると Vercel が関数ごと打ち切る。
 * 打ち切られるとユーザーには何も返らないので、その内側に収まるよう区切っている。
 *
 * `PROVIDER_TIMEOUT_MS` は1プロバイダあたりの待ち時間の上限。
 * 先頭のプロバイダが「エラーを返す」のではなく「応答しない」障害のとき、
 * ここが長すぎるとフォールバックが動く前に関数が終わってしまう。
 * 実測は Azure 4〜10秒 / Gemini 5〜13秒なので、20秒あれば正常系は切らない。
 *
 * `CHAIN_BUDGET_MS` は1ステップ（抽出／判定）でチェーン全体に使ってよい時間。
 * 抽出と判定で2回使うため、最悪ケースでも 60秒に収まる幅にしてある。
 */
const PROVIDER_TIMEOUT_MS = 20_000;
const CHAIN_BUDGET_MS = 24_000;

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  // SDK はミリ秒指定。effort `high` の思考時間もこの中に収める必要がある
  if (!_anthropic) _anthropic = new Anthropic({ timeout: PROVIDER_TIMEOUT_MS });
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
      timeout: PROVIDER_TIMEOUT_MS,
    });
  }
  return _azure;
}

/**
 * Gemini で使うモデル。実測で選んだ（詳細は ARCHITECTURE.md §7）。
 *
 * `gemini-2.5-pro` と `gemini-2.5-flash` は新規プロジェクトには 404 を返す。
 * `gemini-3.8-flash` は無料枠だと 503（高需要）が返り続けて実用にならなかった。
 * 実際に通ったのは 3.6 / 3.5 の flash 2つで、成分名の読み取りはどちらも正確。
 *
 * 速い方（3.6）を判定に、遅い方（3.5）を抽出に割り当てている。
 * 判定は 🟡/🔴 の分かれ目そのものなので下げない。下げてよいのは抽出側だけ（§7.5）。
 * モデルを分けるとクォータも分かれる（無料枠の 5 RPM はモデル単位）。
 */
const GEMINI_MODEL_EXTRACT = process.env.GEMINI_MODEL_EXTRACT ?? 'gemini-3.5-flash';
const GEMINI_MODEL_JUDGE = process.env.GEMINI_MODEL_JUDGE ?? 'gemini-3.6-flash';

let _gemini: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (!_gemini) {
    _gemini = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY ?? '',
      httpOptions: { timeout: PROVIDER_TIMEOUT_MS },
    });
  }
  return _gemini;
}

/**
 * Zod スキーマを Gemini の responseJsonSchema に変換する。
 *
 * Anthropic の zodOutputFormat / OpenAI の zodResponseFormat にあたるヘルパーが
 * Gemini SDK には無いので、ここで JSON Schema に落として使えない語彙を削る。
 * Gemini が受け付けるのは JSON Schema のサブセットであり、
 *   - $schema         … 未対応キーワード。送ると拒否される
 *   - type: [A, null] … 配列形式の型指定は未対応。anyOf に開く必要がある
 * の2点が Zod の出力と食い違う。
 */
function geminiJsonSchema(schema: z.ZodType): unknown {
  return pruneForGemini(z.toJSONSchema(schema));
}

function pruneForGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(pruneForGemini);
  if (node === null || typeof node !== 'object') return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === '$schema') continue;
    if (key === 'type' && Array.isArray(value)) {
      out.anyOf = value.map((t) => ({ type: t }));
      continue;
    }
    out[key] = pruneForGemini(value);
  }
  return out;
}

/**
 * Gemini を1回呼んで構造化出力を得る。
 *
 * maxOutputTokens は指定しない（出力上限を切り詰めない — §7.5）。
 * thinking も明示的に無効化しない。Anthropic 経路で本文にツール呼び出しが混入した
 * 既知の失敗モードと同じ理由で、モデル既定の思考を止めにいかない。
 */
async function callGemini<T>(
  model: string,
  system: string,
  parts: Part[],
  schema: z.ZodType<T>,
): Promise<T | null> {
  const res = await gemini().models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: system,
      responseMimeType: 'application/json',
      responseJsonSchema: geminiJsonSchema(schema),
    },
  });

  // 安全フィルタや出力上限で途中終了した応答を、正常な結果として扱わない。
  // 黙って壊れた判定を返すより、失敗として次のプロバイダに落とすほうが安全。
  const finishReason = String(res.candidates?.[0]?.finishReason ?? 'STOP');
  if (finishReason !== 'STOP') {
    throw new Error(`Gemini が応答を完了しませんでした (finishReason: ${finishReason})`);
  }

  const text = res.text;
  if (!text) return null;

  const parsed = schema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

/**
 * 一時的な失敗（5xx）だけは、同じプロバイダで1回だけ待って再試行する。
 *
 * Gemini の無料枠は 503（高需要）をかなりの頻度で返す（実測で4回中2回）。
 * 1回で諦めると保険が半分の確率で効かないので、ここだけ粘る。
 * 429 は対象にしない — 復帰まで数十秒かかるため、待たせるより次に行くほうが速い。
 */
function isTransient(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500;
  return (
    err instanceof Anthropic.InternalServerError || err instanceof OpenAI.InternalServerError
  );
}

const TRANSIENT_RETRY_DELAY_MS = 1500;

async function attempt<T>(run: () => Promise<T | null>, deadline: number): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    if (!isTransient(err)) throw err;
    // 待って試し直すだけの余裕が無いなら、粘らずに次のプロバイダへ譲る
    if (Date.now() + TRANSIENT_RETRY_DELAY_MS >= deadline) throw err;
    await new Promise((r) => setTimeout(r, TRANSIENT_RETRY_DELAY_MS));
    return run();
  }
}

/**
 * チェーンの先頭から順に試し、失敗したら次のプロバイダに落とす。
 *
 * どのエラーでも次に進む。レート制限とキー失効はもちろん、スキーマ違反や
 * 5xx でも「そのプロバイダでは結果が出なかった」ことに変わりはないため。
 * 全滅したときだけ最後の例外を投げ、route 側でユーザー向け文言に変換する。
 */
async function withFallback<T>(
  label: string,
  run: (provider: Provider) => Promise<T | null>,
): Promise<LlmResult<T>> {
  const chain = providerChain().filter((p) => p !== 'mock');
  const deadline = Date.now() + CHAIN_BUDGET_MS;
  let lastError: unknown = new Error('利用可能なAIプロバイダがありません');

  for (const provider of chain) {
    // 残り時間が無いのに次を始めると、返す前に関数ごと打ち切られる
    if (Date.now() >= deadline) {
      console.warn(`[${label}] 時間切れのため ${provider} は試していません`);
      break;
    }
    try {
      const value = await attempt(() => run(provider), deadline);
      if (provider !== chain[0]) {
        console.warn(`[${label}] ${chain[0]} が失敗したため ${provider} で応答しました`);
        return { value, provider, fellBackFrom: chain[0] };
      }
      return { value, provider };
    } catch (err) {
      lastError = err;
      console.error(`[${label}] ${provider} 失敗 (${classifyError(err)})`, err);
    }
  }

  throw lastError;
}

// ── ステップ1: 成分抽出（Vision） ─────────────────────────────────────

export async function extractIngredients(
  image: ImageInput,
): Promise<LlmResult<ExtractionResult>> {
  return withFallback('extract', (provider) => extractWith(provider, image));
}

async function extractWith(
  provider: Provider,
  image: ImageInput,
): Promise<ExtractionResult | null> {
  if (provider === 'gemini') {
    return callGemini(
      GEMINI_MODEL_EXTRACT,
      EXTRACTION_SYSTEM_PROMPT,
      [
        { inlineData: { mimeType: image.mediaType, data: image.data } },
        { text: EXTRACTION_USER_TEXT },
      ],
      ExtractionSchema,
    );
  }

  if (provider === 'anthropic') {
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
): Promise<LlmResult<Judgement>> {
  return withFallback('analyze', (provider) => judgeWith(provider, extraction, stock));
}

async function judgeWith(
  provider: Provider,
  extraction: ExtractionResult,
  stock: StockItem[],
): Promise<Judgement | null> {
  const userMessage = buildJudgementUserMessage(extraction, stock);

  if (provider === 'gemini') {
    return callGemini(
      GEMINI_MODEL_JUDGE,
      JUDGEMENT_SYSTEM_PROMPT,
      [{ text: userMessage }],
      JudgementSchema,
    );
  }

  if (provider === 'anthropic') {
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

// ── ルーティンの解説 ──────────────────────────────────────────────────

export type RoutineAdviceInput = Parameters<typeof buildRoutineAdviceUserMessage>[0];

/**
 * 毎日のルーティンに、その人向けの一言を足す。
 *
 * 並び順そのものは lib/routine.ts がルールで決めており、ここでは扱わない。
 * 判定（ステップ2）と違って安全上の分岐に使われる出力ではないため、
 * 抽出側と同じ軽いモデルを使う。これは「速度のために下げてよいのは抽出側だけ」
 * という制約（§7.5）に反しない — 判定の設定は据え置いている。
 */
export async function adviseRoutine(
  input: RoutineAdviceInput,
): Promise<LlmResult<RoutineAdvice>> {
  return withFallback('routine', (provider) => adviseWith(provider, input));
}

async function adviseWith(
  provider: Provider,
  input: RoutineAdviceInput,
): Promise<RoutineAdvice | null> {
  const userMessage = buildRoutineAdviceUserMessage(input);

  if (provider === 'gemini') {
    return callGemini(
      GEMINI_MODEL_EXTRACT,
      ROUTINE_ADVICE_SYSTEM_PROMPT,
      [{ text: userMessage }],
      RoutineAdviceSchema,
    );
  }

  if (provider === 'anthropic') {
    const res = await anthropic().messages.parse({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      output_config: { format: zodOutputFormat(RoutineAdviceSchema), effort: 'medium' },
      system: ROUTINE_ADVICE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    return (res.parsed_output as RoutineAdvice | null) ?? null;
  }

  const res = await azure().chat.completions.parse({
    model: AZURE_MODEL_EXTRACT,
    max_completion_tokens: 4000,
    response_format: zodResponseFormat(RoutineAdviceSchema, 'routine_advice'),
    messages: [
      { role: 'system', content: ROUTINE_ADVICE_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  });
  return (res.choices[0]?.message.parsed as RoutineAdvice | null) ?? null;
}

// ── エラー分類（プロバイダごとの例外を共通の形に落とす） ───────────────────

export type LlmFailure = 'rate_limited' | 'auth' | 'connection' | 'upstream';

export function classifyError(err: unknown): LlmFailure {
  if (err instanceof Anthropic.RateLimitError || err instanceof OpenAI.RateLimitError) {
    return 'rate_limited';
  }
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof OpenAI.AuthenticationError ||
    // 学校配布プロキシは無効なキーに 401 ではなく 403 を返す（実測）
    err instanceof OpenAI.PermissionDeniedError
  ) {
    return 'auth';
  }
  if (
    err instanceof Anthropic.APIConnectionError ||
    err instanceof OpenAI.APIConnectionError
  ) {
    return 'connection';
  }
  // Gemini SDK は種類ごとの例外クラスを持たず、ApiError.status で判別する。
  // キー失効は 401/403 ではなく 400 + API_KEY_INVALID で返ってくる（実測）ため、
  // ここだけはメッセージを見る。会場でキーが切れたときログから原因を追えるようにする。
  if (err instanceof ApiError) {
    if (err.status === 429) return 'rate_limited';
    if (err.status === 401 || err.status === 403) return 'auth';
    if (err.status === 400 && /api[_ ]?key/i.test(err.message)) return 'auth';
  }
  return 'upstream';
}
