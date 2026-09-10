# 応募作品概要書

### 買う前に、家の棚を重ねて見る。

**「その商品がいいかどうか」ではなく、「あなたの家に、もうあるかどうか」を判定する。**

店頭の商品パッケージにカメラをかざすと、自宅の在庫と突合した判定が3色で返る。

🔗 **https://overlai-delta.vercel.app**

---

> ### AIは実際に動いている
>
> 学校配布の **Azure OpenAI プロキシ（`gpt-5.1`）** で2段階パイプラインが本番稼働している（実測 約9秒）。
> `lib/llm.ts` が環境変数からプロバイダを決めるため、**Anthropic Claude / Azure OpenAI / Google Gemini / モック**を
> コード変更なしで切り替えられる。さらに**先頭が失敗したら次に落ちる**ので、
> 配布キーが止まってもAI機能ごと停止しない。詳細 → [docs/STATUS.md](docs/STATUS.md)

---

## 何をするアプリか

| | 意味 | 例 |
| :---: | :--- | :--- |
| 🔵 | 手持ちにない、または目的別の買い分けとして妥当 | 普段はアミノ酸系シャンプー、これはワックス落とし用 |
| 🟡 | 同一成分・同効能が自宅にある。買わなくていい | 同じ鎮痛成分が残12錠ある |
| 🔴 | 手持ちの処方薬との併用でリスクや強い刺激 | ステロイド外用中の肌にアルコール系化粧水／抗凝固薬を飲んでいる人が市販の鎮痛薬 |

**判定の基準は商品の良し悪しではなく、その人の家の在庫。** 既存のコスメ成分アプリもお薬手帳アプリも「商品側のデータベース」で戦っており、「あなたの家にもうあるか」だけは商品DBをどれだけ大きくしても答えられない。

さらに、**処方外用薬 × 化粧品**の相互作用データベースは日本に存在しない。医療の側からは「外用薬」、生活の側からは「肌に塗るもの」であり、どちらの産業も互いの領域を見に行く動機を持たないまま残された空白地帯になっている。

## 画面

| 画面 | パス | 内容 |
| :--- | :--- | :--- |
| マイストック | `/` | 在庫一覧（カテゴリの折りたたみ・追加）・期限アラート・各カードから編集／削除 |
| 今日のルーティン | `/routine` | 服薬チェック・洗う順序・塗る順序（順序はルール、一言はAI） |
| スキャン | `/scan` | カメラ／画像選択 → 3色判定 |
| ストックを追加・編集 | `/stock/new` | 成分表の撮影読み取り＋手入力（`?id=` で編集） |
| 肌質の設定 | `/profile` | 肌質・頭皮の自己申告（洗浄基剤の相性判定と、ルーティンの一言に使う） |
| 設定 | `/settings` | 年代・性別、カテゴリとルーティンの管理、書き出し・読み込み、初期化 |
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

| 何をテストすればいいか | [docs/TESTING.md](docs/TESTING.md) |

**実装前に [docs/DEVELOPMENT.md §5「壊してはいけない制約」](docs/DEVELOPMENT.md) を読むこと。** 医療に隣接する領域のため、安全設計に関わる決定がいくつかある。

```bash
npm run check   # 型・lint・自動テスト75件
```

## セットアップ

```bash
npm install
npm run dev          # http://localhost:3000
```

APIキーは**なくても動く**（モックモードで起動する）。実際のAIを使うには `.env.local` にいずれかを置く。

```bash
# Azure OpenAI 互換プロキシを使う場合
AZURE_PROXY_KEY=...
AZURE_PROXY_ENDPOINT=https://.../
AZURE_PROXY_API_VERSION=2025-04-01-preview

# Anthropic を使う場合
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini を使う場合（他のキーと併記すると保険として働く）
GEMINI_API_KEY=...
```

**コード変更は不要**。`lib/llm.ts` が環境変数を見て優先順を決め、複数あるときは失敗した順に次へ落ちる。

## 技術構成

| 層 | 選択 |
| :--- | :--- |
| フレームワーク | Next.js 16（App Router）+ TypeScript |
| UI | React 19 + Tailwind CSS 4 |
| AI | Azure OpenAI プロキシ（`gpt-5.1`）／ Anthropic（`claude-opus-5`）／ Google Gemini（`gemini-3.5-flash` / `gemini-3.6-flash`）。Vision + 構造化出力、失敗時は自動フォールバック |
| データ | シードJSON + localStorage（**DB不使用**） |
| デプロイ | Vercel |

```
app/
  page.tsx              マイストック
  routine/page.tsx      今日のルーティン
  scan/page.tsx         スキャン
  stock/new/page.tsx    在庫の追加・編集
  profile/page.tsx      肌質の設定（自由記述を含む）
  settings/page.tsx     設定（年代・性別・カテゴリ・ルーティン・初期化）
  api/analyze/route.ts  判定API（抽出 → 照合）
  api/extract/route.ts  成分抽出のみ（在庫登録用）
  api/routine/route.ts  ルーティンの解説（順序はルール、言葉だけAI）
lib/llm.ts              AIプロバイダの抽象とフォールバック（Anthropic / Azure / Gemini / モック）
components/             BottomNav / StockList / StockActionSheet / JudgementCard / CleanserMatchCard
components/ui/          Card / Chip / Button / SectionHeader
lib/                    types・schemas・prompts・storage・routine・expiry・cleanser ほか
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

Issue は [GitHub Issues](https://github.com/John-Frusciante/overlai/issues) で管理している。

### マイルストーン

| マイルストーン | 期限 | 内容 |
| :--- | :--- | :--- |
| [デモ提出](https://github.com/John-Frusciante/overlai/milestone/1) | 2026-09-10 | **完了**。エントリーまでに必要なもの |
| [本選](https://github.com/John-Frusciante/overlai/milestone/3) | 2026-10-01 | ブース展示と連続デモに耐えるための整備 |
| [将来構想](https://github.com/John-Frusciante/overlai/milestone/2) | — | 登録経路の追加、ネイティブ化、家族共有 |

**本選はブース展示で来場者が実機を触る。** 会場のネットワークで動くこと、
連続して触られても崩れないことが、そのマイルストーンの判断基準になる。

### ラベル

| ラベル | 意味 |
| :--- | :--- |
| `must` | そのマイルストーンの成立に必須 |
| `should` | 加点項目 |
| `low` | 余力があれば |
| `future` | 本選より先 |
| `frontend` `backend` `ai` `infra` `docs` | 領域 |

変更を加えたら [docs/STATUS.md](docs/STATUS.md) を更新すること。**実装状況の唯一の出所**にしている。

## 応募

ユメカタリ 学生生成AIコンテスト 2026・開発部門。
**井上 高志・濱田 圭太郎・杉本 隼都（鈴鹿工業高等専門学校）の3名チーム。**

| 提出物 | 場所 |
| :--- | :--- |
| 作品概要書 | [docs/Overlai_作品概要書.pdf](docs/Overlai_作品概要書.pdf)（A4・3ページ） |
| デモ動画・ピッチ動画 | 撮影手順は [docs/TESTING.md](docs/TESTING.md)、台本は[企画書の付録](docs/企画書_Overlai_ユメカタリ2026.md) |
| 公開URL | https://overlai-delta.vercel.app |

日程と評価軸は [docs/CONTEST.md](docs/CONTEST.md) にまとめてある。

## ライセンス

未定（ユメカタリ学生生成AIコンテスト2026 応募作品）
