<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Overlai — このリポジトリで作業するときの指針

**作業を始める前に [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) と [docs/STATUS.md](docs/STATUS.md) を読むこと。**

## このプロジェクトの性質

医薬品・化粧品に隣接するアプリであり、**安全設計に関わる決定がコードに埋め込まれている**。見た目は普通のCRUDに見えても、変更すると安全性が崩れる箇所がある。

## 壊してはいけない制約（詳細は DEVELOPMENT.md §5）

1. **`lib/seed.ts` の内服薬に処方NSAIDsを追加しない** — 🟡判定が🔴の条件にも該当して不安定になる
2. **`consult_recommended` のサーバー側上書きを消さない** — 安全に関わる値をLLMに委ねない
3. **成分名のない `reason` のフィルタを消さない** — 根拠なき警告を出さない
4. **判定（ステップ2）の設定を弱めない** — 判定品質がそのまま評価対象。
   Anthropic 経路は `effort: 'high'`、Azure 経路は `gpt-5.1`、Gemini 経路は `gemini-3.6-flash`。
   速度のために下げるなら**抽出側だけ**にする
5. **Anthropic 経路で `thinking` を明示的に無効化しない** — ツール呼び出しが本文に混入する既知の失敗モードがある
6. **出力トークン上限を切り詰めない** — Anthropic は `max_tokens: 16000`（thinking 分を含む）、
   Azure の gpt-5 系は **`max_tokens` が使えず `max_completion_tokens`** を指定する
7. **`localStorage` をコンポーネントから直接呼ばない** — `lib/storage.ts` を経由する
8. **APIキーに `NEXT_PUBLIC_` を付けない** — `ANTHROPIC_API_KEY` も `AZURE_PROXY_KEY` も `GEMINI_API_KEY` も Route Handler でのみ読む
9. **UIの文言に断定表現を使わない** — 「〜の可能性があります」で統一する
10. **プロバイダのフォールバックを単一経路に戻さない** — 本番は学校配布のプロキシ1本で動いており、
    その停止・失効がそのまま機能停止になる。`providerChain()` は独立した事業者を並べるためのもの
11. **Gemini 経路で `finishReason` のチェックを外さない** — 安全フィルタや出力上限で切れた応答を
    成功として扱うと、壊れた判定が黙って返る
12. **ルーティンの順序をAIに委ねない** — 洗う順・塗る順は `lib/routine.ts` が剤形で決める。
    AIが書くのは言葉だけで、`RoutineAdviceSchema` の出力に並び順は含まれない。
    `routineSignature()` に残量を含めないこと（開くたびAIを呼ぶことになる）

## 書く場所

| 対象 | 場所 |
| :--- | :--- |
| プロンプト | `lib/prompts.ts` のみ |
| AI出力スキーマ | `lib/schemas.ts` |
| データ構造 | `lib/types.ts` |
| localStorage | `lib/storage.ts` |
| ルールベースの判定 | `lib/routine.ts` `lib/expiry.ts` `lib/cleanser.ts` `lib/categories.ts` |
| リクエストの検証 | `lib/request.ts`（3つのAPIで共有） |
| AIの呼び出し | `lib/llm.ts`（プロバイダ抽象。route から直接SDKを呼ばない） |

## 作業後にやること

- `npx tsc --noEmit` を通す
- 実装状況が変わったら `docs/STATUS.md` を更新する
- アーキテクチャが変わったら `docs/ARCHITECTURE.md` を更新する
- コミットメッセージは**日本語**で書く
