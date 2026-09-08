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
4. **判定（ステップ2）の `effort: 'high'` を下げない** — 判定品質がそのまま評価対象
5. **`thinking` を明示的に無効化しない** — ツール呼び出しが本文に混入する既知の失敗モードがある
6. **`max_tokens` を切り詰めない（16000）** — thinking トークンもここから消費される
7. **`localStorage` をコンポーネントから直接呼ばない** — `lib/storage.ts` を経由する
8. **`ANTHROPIC_API_KEY` に `NEXT_PUBLIC_` を付けない** — Route Handler でのみ読む
9. **UIの文言に断定表現を使わない** — 「〜の可能性があります」で統一する

## 書く場所

| 対象 | 場所 |
| :--- | :--- |
| プロンプト | `lib/prompts.ts` のみ |
| AI出力スキーマ | `lib/schemas.ts` |
| データ構造 | `lib/types.ts` |
| localStorage | `lib/storage.ts` |
| ルールベースの判定 | `lib/routine.ts` `lib/expiry.ts` |

## 作業後にやること

- `npx tsc --noEmit` を通す
- 実装状況が変わったら `docs/STATUS.md` を更新する
- アーキテクチャが変わったら `docs/ARCHITECTURE.md` を更新する
- コミットメッセージは**日本語**で書く
