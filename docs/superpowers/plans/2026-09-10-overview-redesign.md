# Overlai 作品概要書 再構成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 原体験から解決策、実証、安全設計までを初見の審査員が順に理解できるA4縦3ページの作品概要書を作る。

**Architecture:** 既存のHTMLテンプレート生成方式と画像素材を維持し、ページ構成と本文を全面的に再設計する。本文は natural-japanese のフル工程で推敲し、PDF生成後は全ページを画像化して視覚検査する。

**Tech Stack:** HTML/CSS、既存の埋め込み画像生成手順、Chromium印刷、PDFレンダリング、natural-japanese lint

**Spec:** `docs/superpowers/specs/2026-09-10-overview-redesign-design.md`

## Global Constraints

- A4縦3ページとし、各ページの役割を一つに限定する。
- UI文言と本文で診断・治療判断に見える断定表現を使わない。
- 未実装のJAHIS読み取りとレシート一括登録を現行機能として書かない。
- 在庫情報は「判定時のみ送信し、サーバーに永続保存しない」と正確に説明する。
- QRコードは21mm角を維持する。
- 既存アプリ本体の安全設計やコードは変更しない。

---

### Task 1: 3ページ分の本文と情報階層を確定する

**Files:**
- Modify: `docs/概要書/overview.tpl.html`
- Reference: `docs/企画書_Overlai_ユメカタリ2026.md`
- Reference: `docs/STATUS.md`
- Reference: `docs/CONTEST.md`

**Interfaces:**
- Consumes: 再構成デザインと現在の実装・検証結果
- Produces: 3ページに配置できる確定本文と見出し

- [ ] **Step 1: natural-japanese の企画書型、文体憲法、推敲手順を読む**

  `references/doctypes/memo.md`、`references/writing-constitution.md`、`references/revision-guide.md`、読みやすさ関連資料を確認する。

- [ ] **Step 2: 1ページ目を原体験中心に書き直す**

  井上の風邪薬の重複、杉本・濱田のステロイド外用薬と化粧品の悩みから始め、「薬も化粧品も実際に使う体はひとつ」へ収束させる。

- [ ] **Step 3: 2ページ目を一本道の利用フローと青→黄の実証中心に書き直す**

  在庫登録、撮影、照合、3色判定を一つの流れとして示し、御岳百草丸の在庫追加前後を最大の視覚要素にする。

- [ ] **Step 4: 3ページ目をAIの必然性、安全設計、検証中心に書き直す**

  技術名の羅列ではなく、「なぜ分けたか」「なぜAIに任せない箇所があるか」「誤りをどう抑えるか」を説明する。

- [ ] **Step 5: 現在の実装との整合性を確認する**

  `docs/STATUS.md` と照合し、未実装機能を現在形で書いていないこと、出典付き知識と理由の裏取りを反映していることを確認する。

### Task 2: 紙面の視線誘導を3ページ用に再設計する

**Files:**
- Modify: `docs/概要書/overview.tpl.html`

**Interfaces:**
- Consumes: Task 1の確定本文
- Produces: A4印刷用の3ページHTMLテンプレート

- [ ] **Step 1: 既存CSSから再利用する基礎設定を残す**

  A4サイズ、余白、配色、ロゴ、フッター、QRコードの印刷設定を維持する。

- [ ] **Step 2: ページごとに一つの主役ができるレイアウトへ変更する**

  1ページ目は原体験、2ページ目は青→黄の比較、3ページ目は安全なAI設計を最大面積にする。

- [ ] **Step 3: 同じ大きさのカードの反復を減らす**

  重要度に応じて面積と文字サイズに差をつけ、補足情報は小さな帯または短いリストにまとめる。

- [ ] **Step 4: スクリーンショットを読める大きさで配置する**

  画面全体を多数並べず、判定の意味が伝わる箇所へ絞って配置する。

### Task 3: 印刷用HTMLとPDFを生成する

**Files:**
- Modify: `docs/概要書/overview.html`
- Modify: `docs/Overlai_作品概要書.pdf`
- Modify: `docs/概要書/README.md`
- Modify: `docs/CONTEST.md`

**Interfaces:**
- Consumes: Task 2のHTMLテンプレートと既存画像素材
- Produces: 埋め込み済みHTML、提出用PDF、更新された再生成手順

- [ ] **Step 1: PDF編集操作を開始記録する**

  `node container_tools/mark_artifact_operation_started.mjs --operation-kind edit --expected-output-count 1 --output-format pdf` を一度だけ実行する。

- [ ] **Step 2: 画像とQRコードをテンプレートへ埋め込む**

  `docs/概要書/README.md` の既存手順に従い、`overview.html` を再生成する。

- [ ] **Step 3: ChromiumでA4 PDFを生成する**

  ヘッダーとフッターをブラウザ側で付けず、CSSの3ページだけを出力する。

- [ ] **Step 4: ページ数とテキスト抽出を検査する**

  PDFが3ページであること、主要見出しと原体験の氏名が抽出できることを確認する。

- [ ] **Step 5: READMEとCONTESTのページ数記載を3ページへ更新する**

  再生成手順と提出前チェックリストが成果物と一致するようにする。

### Task 4: 日本語と視覚品質を検証して収束させる

**Files:**
- Modify: `docs/概要書/overview.tpl.html`
- Modify: `docs/概要書/overview.html`
- Modify: `docs/Overlai_作品概要書.pdf`

**Interfaces:**
- Consumes: Task 3のPDFと本文
- Produces: 推敲・視覚検査済みの提出用PDF

- [ ] **Step 1: 本文を検査用テキストとして抽出する**

  HTMLから表示本文だけを一時ファイルへ取り出す。中間ファイルは `tmp/` に置く。

- [ ] **Step 2: natural-japanese のlint、outline、terms、reading-loadを実行する**

  findingsを判断台帳へ整理し、直すものと文脈上残すものを分ける。

- [ ] **Step 3: 構造・読みやすさ・企画書型の3レビューを行う**

  各レビューの所見を統合し、読者の理解を妨げる指摘だけを本文へ反映する。

- [ ] **Step 4: PDFをページ画像へ変換して全ページを目視する**

  文字切れ、重なり、極端に小さい本文、余白、視線の順序、QRコードの大きさを確認する。

- [ ] **Step 5: 修正後にHTMLとPDFを再生成し、検査を反復する**

  新しいfindingや視覚欠陥がなくなるまで再生成する。

- [ ] **Step 6: 中間ファイルを削除する**

  判断台帳、抽出テキスト、レンダリング画像などの作業ファイルを削除し、成果物だけを残す。

### Task 5: 最終確認を行う

**Files:**
- Verify: `docs/概要書/overview.tpl.html`
- Verify: `docs/概要書/overview.html`
- Verify: `docs/Overlai_作品概要書.pdf`
- Verify: `docs/概要書/README.md`
- Verify: `docs/CONTEST.md`

**Interfaces:**
- Consumes: Task 4の最終成果物
- Produces: 検証結果とレビュー可能な差分

- [ ] **Step 1: `git diff --check` を実行する**

  空白エラーや意図しないファイル変更がないことを確認する。

- [ ] **Step 2: `npm run check` を実行する**

  型、lint、75件のテストが通ることを確認する。

- [ ] **Step 3: 成果物を要件と照合する**

  3ページ、原体験、一本道の利用フロー、在庫で変わる実証、AIとルールの分担、安全設計、実装済み範囲の各要件を再確認する。

- [ ] **Step 4: 変更差分と検証結果を報告する**

  最終PDF、主な変更、検証結果、残る注意点を簡潔にまとめる。
