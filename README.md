# Overlai

### 買う前に、家の棚を重ねて見る。

**「その商品がいいかどうか」ではなく、「あなたの家に、もうあるかどうか」を判定する。**

店頭の商品パッケージにカメラをかざすと、自宅の在庫と突合した判定が3色で返る。

🔗 **https://overlai-delta.vercel.app**

---

> ### ⚠️ いまAIは動いていない
>
> `ANTHROPIC_API_KEY` が未設定のため、**成分の読み取りと判定はモックの固定応答**を返している。
> 画面・データフロー・UIはすべて本物で、キーを設定すればコード変更なしで切り替わる。
> 詳細と切り替え手順 → [docs/STATUS.md](docs/STATUS.md)

---

## 何をするアプリか

| | 意味 | 例 |
| :---: | :--- | :--- |
| 🔵 | 手持ちにない、または目的別の買い分けとして妥当 | 普段はアミノ酸系シャンプー、これはワックス落とし用 |
| 🟡 | 同一成分・同効能が自宅にある。買わなくていい | 同じ鎮痛成分が残12錠ある |
| 🔴 | 手持ちの処方薬との併用でリスクや強い刺激 | ステロイド外用中の肌にアルコール系化粧水 |

**判定の基準は商品の良し悪しではなく、その人の家の在庫。** 既存のコスメ成分アプリもお薬手帳アプリも「商品側のデータベース」で戦っており、「あなたの家にもうあるか」だけは商品DBをどれだけ大きくしても答えられない。

さらに、**処方外用薬 × 化粧品**の相互作用データベースは日本に存在しない。医療の側からは「外用薬」、生活の側からは「肌に塗るもの」であり、どちらの産業も互いの領域を見に行く動機を持たないまま残された空白地帯になっている。

## 画面

| 画面 | パス | 内容 |
| :--- | :--- | :--- |
| マイストック | `/` | 在庫一覧・期限アラート・追加・削除 |
| 今日のルーティン | `/routine` | 服薬チェック・洗う順序・塗る順序 |
| スキャン | `/scan` | カメラ／画像選択 → 3色判定 |
| ストックを追加 | `/stock/new` | 成分表の撮影読み取り＋手入力 |
| プレビュー（開発用） | `/preview` | 判定カードの3色を切り替えて確認 |

**まず `/preview` を見ると、このアプリの中核が分かる。**

## ドキュメント

| 知りたいこと | ファイル |
| :--- | :--- |
| **いま何が動いていて何が動いていないか** | [docs/STATUS.md](docs/STATUS.md) |
| **開発を始める / 守るべき制約** | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| どう作られているか（アーキテクチャ・AIパイプライン） | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 何を作るべきか・なぜその仕様か | [docs/設計仕様書_Overlai_デモ版.md](docs/設計仕様書_Overlai_デモ版.md) |
| なぜこれを作るのか（課題・競合・社会的インパクト） | [docs/企画書_Overlai_ユメカタリ2026.md](docs/企画書_Overlai_ユメカタリ2026.md) |
| 用語の意味（医薬・化粧品・技術） | [docs/GLOSSARY.md](docs/GLOSSARY.md) |
| 応募先の評価軸 | [docs/CONTEST.md](docs/CONTEST.md) |

**実装前に [docs/DEVELOPMENT.md §5「壊してはいけない制約」](docs/DEVELOPMENT.md) を読むこと。** 医療に隣接する領域のため、安全設計に関わる決定がいくつかある。

## セットアップ

```bash
npm install
npm run dev          # http://localhost:3000
```

APIキーは**なくても動く**（モックモードで起動する）。本物のAIに切り替えるには：

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local
```

コード変更は不要。

## 技術構成

| 層 | 選択 |
| :--- | :--- |
| フレームワーク | Next.js 16（App Router）+ TypeScript |
| UI | React 19 + Tailwind CSS 4 |
| AI | Anthropic API（`claude-opus-5`）Vision + 構造化出力 |
| データ | シードJSON + localStorage（**DB不使用**） |
| デプロイ | Vercel |

```
app/
  page.tsx              マイストック
  routine/page.tsx      今日のルーティン
  scan/page.tsx         スキャン
  stock/new/page.tsx    在庫の追加
  api/analyze/route.ts  判定API（抽出 → 照合）
  api/extract/route.ts  成分抽出のみ（在庫登録用）
components/             BottomNav / StockList / JudgementCard
lib/                    types・schemas・prompts・storage・routine・expiry ほか
docs/                   全ドキュメント
```

## 設計上の要点

- **2段階のAIパイプライン**（成分抽出 → 在庫照合判定）。単一プロンプトにしない理由は [ARCHITECTURE.md §4.2](docs/ARCHITECTURE.md)
- **JANコードではなく成分表示を直接読む。** 化粧品の公式成分DBが日本に存在しないため
- **順序ナビはAIを使わずルールベース。** 剤形と基剤から順序が一意に決まるため、決定的に動く
- **安全に関わる値をLLMに委ねない。** 赤判定の相談導線はサーバー側で強制し、成分名のない理由は除外する
- **APIキーは Route Handler でのみ保持**。クライアントバンドルに入れない
- **`localStorage` は `lib/storage.ts` に集約**。将来のネイティブ化で差し替えるのはこの1ファイル

## 開発の進め方

Issue は [GitHub Issues](https://github.com/John-Frusciante/overlai/issues) で管理している。ラベルの意味：

| ラベル | 意味 |
| :--- | :--- |
| `must` | デモ成立に必須 |
| `should` | 加点項目 |
| `low` | 余力があれば |
| `frontend` `backend` `ai` `infra` `docs` | 領域 |

変更を加えたら [docs/STATUS.md](docs/STATUS.md) を更新すること。**実装状況の唯一の出所**にしている。

## ライセンス

未定（ユメカタリ学生生成AIコンテスト2026 応募作品）
