# Overlai作品概要書 横向き再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** パソコンで2〜3分以内に読める、16:9横向き5ページの作品概要書をPPTXとPDFで作成する。

**Architecture:** `@oai/artifact-tool`で、文章・図形・線・矢印を編集可能なPowerPoint要素として構築する。実際のアプリ画面とQRコードだけを画像として配置し、Microsoft PowerPointからPDFへ書き出す。PPTXの構造検査と、PPTX・PDF双方の全ページ画像確認を別工程にして、変換時の文字切れも検出する。

**Tech Stack:** JavaScript ES modules、`@oai/artifact-tool`、Microsoft PowerPoint、PyMuPDF、PowerShell

**Spec:** `docs/superpowers/specs/2026-09-10-overview-landscape-redesign-design.md`

## Global Constraints

- 16:9横向き、全5ページとする。
- 主な閲覧環境はパソコンとし、2〜3分で読み切れる情報量にする。
- 本文は最低16pt、重要な説明は18〜22pt、ページタイトルは30pt以上とする。
- 白地と濃紺を基本にし、強調色は青・黄・赤の判定色に限定する。
- QRコードは1ページ目だけに置く。
- アプリ画面以外の文字、図形、線、矢印はPowerPoint上で編集可能にする。
- 診断・治療を行うと誤解させる断定表現を使わない。
- 最終PPTXは `docs/Overlai_作品概要書.pptx`、PDFは `docs/Overlai_作品概要書.pdf` とする。
- `.codex-pptx-landscape/` は一時生成先とし、最終コミットへ含めない。

---

### Task 1: 横向き5ページの生成スクリプトを作る

**Files:**
- Create temporarily: `.codex-pptx-landscape/build-overview.mjs`
- Read: `docs/概要書/qr.svg`
- Read: `docs/概要書/stock-s.png`
- Read: `docs/概要書/reasonfull-s.png`
- Read: `docs/概要書/routine-s.png`
- Create temporarily: `.codex-pptx-landscape/candidate.pptx`
- Create temporarily: `.codex-pptx-landscape/slide-1.png` through `.codex-pptx-landscape/slide-5.png`

**Interfaces:**
- Consumes: 設計書のページ構成、既存のQRコード、実機画面3点、付属ランタイムのNode.jsと`@oai/artifact-tool`
- Produces: `buildDeck(): Promise<Presentation>`、検査前PPTX、5枚のプレビューPNG

- [ ] **Step 1: 付属ランタイムと作業先を確認する**

Run:

```powershell
Get-Content -Raw 'C:\Users\cadix\.cache\codex-runtimes\codex-primary-runtime\runtime.json'
Get-Item 'docs/概要書/qr.svg','docs/概要書/stock-s.png','docs/概要書/reasonfull-s.png','docs/概要書/routine-s.png'
```

Expected: ランタイム情報と4素材のファイル情報が表示される。

- [ ] **Step 2: 成果物作成の開始を記録する**

Run from the Presentations skill directory, exactly once:

```powershell
& 'C:\Users\cadix\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' container_tools/mark_artifact_operation_started.mjs --operation-kind edit --expected-output-count 1 --output-format pptx
```

Expected: exit code 0。

- [ ] **Step 3: 生成スクリプトへ共通要素を実装する**

`.codex-pptx-landscape/build-overview.mjs`へ、次の定数と関数を実装する。

```js
const WIDTH = 1280;
const HEIGHT = 720;
const FONT = "Yu Gothic";
const COLORS = {
  navy: "#172746",
  ink: "#142039",
  muted: "#46546A",
  faint: "#748197",
  line: "#D8DEE8",
  wash: "#F4F6F9",
  blue: "#2563EB",
  blueWash: "#EDF4FF",
  amber: "#C76B00",
  amberWash: "#FFF5E3",
  red: "#D92D20",
  white: "#FFFFFF",
};

function addText(slide, value, frame, fontSize, color, options = {}) {}
function addRect(slide, frame, fill, options = {}) {}
function addLine(slide, x, y, width, color, weight = 1) {}
function addHeader(slide, pageNumber, shortLabel) {}
function addFooter(slide, pageNumber, leftLabel) {}
function addImage(slide, bytes, contentType, alt, frame, fit = "contain") {}
async function buildDeck() {}
```

`addText()`は`autoFit: "shrinkText"`へ依存して小さくしない。指定領域に収まらない場合は文章か配置を直す。すべてのテキストへ`Yu Gothic`を明示する。

- [ ] **Step 4: 1ページ目と2ページ目を実装する**

1ページ目は原体験を左右に置き、下段で着想へ合流させる。2ページ目は左から右へ、次の関係を示す。

```text
家にあるもの
薬・サプリ・化粧品・ヘアケア
        ↓ 一つの在庫へ
Overlai
        ↓ 店頭の商品と照合
重複・組み合わせ・使う順番を確認
```

1ページ目だけに`qr.svg`を配置する。2ページ目ではアプリの一文定義を最も大きくし、機能一覧を追加しない。

- [ ] **Step 5: 3ページ目から5ページ目を実装する**

3ページ目は`stock-s.png`、`reasonfull-s.png`、`routine-s.png`を使い、次の5段階を横方向に接続する。

```text
在庫登録 → 店頭で撮影 → 家の在庫と照合 → 3色と根拠 → 購入後の順番・記録
```

4ページ目は同じ御岳百草丸について、青と黄を左右比較する。中央メッセージは次の文言とする。

```text
商品は変えていない。
変えたのは、家の在庫だけ。
```

5ページ目は上段へ「読み取り→判定」と「AI／ルール」の役割分担、下段へ安全設計4項目と検証値を置く。検証値は`5商品`、`計9回`、`75テスト`の3つに限定する。

- [ ] **Step 6: プレビューと検査前PPTXを出力する**

生成スクリプトの末尾で次を実行する。

```js
const presentation = await buildDeck();
for (let index = 0; index < presentation.slides.items.length; index += 1) {
  const slide = presentation.slides.items[index];
  const png = await presentation.export({ slide, format: "png", scale: 1.5 });
  await fs.writeFile(
    path.join(TMP_DIR, `slide-${index + 1}.png`),
    new Uint8Array(await png.arrayBuffer()),
  );
}
await (await PresentationFile.exportPptx(presentation)).save(
  path.join(TMP_DIR, "candidate.pptx"),
);
```

Run:

```powershell
& 'C:\Users\cadix\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.codex-pptx-landscape/build-overview.mjs'
```

Expected: `candidate.pptx`と5枚のPNGが作成される。

### Task 2: ページ単位で視覚品質を直す

**Files:**
- Modify temporarily: `.codex-pptx-landscape/build-overview.mjs`
- Inspect: `.codex-pptx-landscape/slide-1.png` through `.codex-pptx-landscape/slide-5.png`

**Interfaces:**
- Consumes: Task 1の5枚のプレビューPNG
- Produces: 文字切れや視線競合がない5ページのレイアウト

- [ ] **Step 1: 5枚を個別に原寸確認する**

`view_image`で5枚を個別に開き、次を確認する。

```text
1ページ目：二つの原体験から着想へ視線が流れる
2ページ目：一つの在庫という解決方法が最初に読める
3ページ目：実画面と5段階の操作が対応している
4ページ目：青と黄の差、中央メッセージが最も強い
5ページ目：役割分担、安全設計、検証値の順で読める
```

- [ ] **Step 2: タイトルだけを通読する**

Expected order:

```text
私たちが困っていたこと
二つの問題を、一つの在庫で解く
店頭から、購入後まで
家の在庫で、答えが変わる
AIに任せる範囲を絞り、安全性を支える
```

この順番だけで「背景→解決→利用→独自性→信頼性」が伝わらない場合は、本文ではなくタイトルを直す。

- [ ] **Step 3: 文字サイズと配置を修正する**

本文16pt未満、重要説明18pt未満、タイトル30pt未満のテキストをなくす。修正後は生成スクリプトを再実行し、5枚すべてをもう一度確認する。

- [ ] **Step 4: 視覚検証結果を記録する**

作業メモへ次の5点以上について「問題なし」または修正内容を記録する。

```text
タイトルの優先順位
本文の可読性
アプリ画面の切り抜き
判定3色の使い分け
余白と要素間隔
ページ間の一貫性
```

### Task 3: PPTXを検証して正式成果物へ置く

**Files:**
- Read: `.codex-pptx-landscape/candidate.pptx`
- Create temporarily: `.codex-pptx-landscape/final/Overlai_作品概要書-landscape.pptx`
- Modify: `docs/Overlai_作品概要書.pptx`

**Interfaces:**
- Consumes: Task 2で確認した`candidate.pptx`
- Produces: 構造検査を通過した16:9・5ページの正式PPTX

- [ ] **Step 1: finalizerを生成スクリプトへ追加する**

```js
const requirements = {
  explicitTotalSlideCount: 5,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};
const fontPolicy = { basis: "design", families: ["Yu Gothic"] };

await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath: path.join(TMP_DIR, "candidate.pptx"),
  finalPath: path.join(TMP_DIR, "final", "Overlai_作品概要書-landscape.pptx"),
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-heading-fit",
  ],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(TMP_DIR, "validation.json"),
});
```

実際のEMUsが異なる場合は、生成した16:9サイズの値を検査結果から確認し、意図したキャンバスの値へ合わせる。

- [ ] **Step 2: finalizerを実行する**

Run:

```powershell
& 'C:\Users\cadix\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.codex-pptx-landscape/build-overview.mjs'
```

Expected: package integrity、presentation layout、font policy、first-party importがpassし、5ページと報告される。

- [ ] **Step 3: 正式ファイル名へコピーする**

Run:

```powershell
Copy-Item -LiteralPath '.codex-pptx-landscape/final/Overlai_作品概要書-landscape.pptx' -Destination 'docs/Overlai_作品概要書.pptx' -Force
```

Expected: `docs/Overlai_作品概要書.pptx`が更新される。

### Task 4: PowerPointからPDFへ書き出して確認する

**Files:**
- Read: `docs/Overlai_作品概要書.pptx`
- Modify: `docs/Overlai_作品概要書.pdf`
- Create temporarily: `.codex-pptx-landscape/pdf-render/page-1.png` through `page-5.png`

**Interfaces:**
- Consumes: Task 3の正式PPTX
- Produces: PowerPointで描画された5ページの提出用PDF

- [ ] **Step 1: Microsoft PowerPointでPDFへ変換する**

Run:

```powershell
$pptxPath=(Resolve-Path -LiteralPath 'docs/Overlai_作品概要書.pptx').Path
$pdfPath=(Join-Path (Resolve-Path -LiteralPath 'docs').Path 'Overlai_作品概要書.pdf')
$powerpoint=New-Object -ComObject PowerPoint.Application
$deck=$powerpoint.Presentations.Open($pptxPath,$true,$false,$false)
$deck.SaveAs($pdfPath,32)
$deck.Close()
$powerpoint.Quit()
```

Expected: `docs/Overlai_作品概要書.pdf`が5ページのPDFとして更新される。

- [ ] **Step 2: PDFを画像化する**

Run:

```powershell
python -c "import fitz, pathlib; p=fitz.open(r'docs/Overlai_作品概要書.pdf'); out=pathlib.Path(r'.codex-pptx-landscape/pdf-render'); out.mkdir(parents=True,exist_ok=True); [(out/f'page-{i+1}.png').write_bytes(page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).tobytes('png')) for i,page in enumerate(p)]; print(len(p))"
```

Expected: `5`と表示され、5枚のPNGが生成される。

- [ ] **Step 3: PDFの5ページを個別確認する**

`view_image`で5枚を開き、PPTXプレビューと比較する。確認項目は、文章、配置、色、画面画像、余白、ページ番号とする。PowerPoint変換で生じた文字切れや改行差があれば生成スクリプトへ戻って直す。

### Task 5: 文書更新、最終検査、コミット

**Files:**
- Modify: `docs/概要書/README.md`
- Modify: `docs/Overlai_作品概要書.pptx`
- Modify: `docs/Overlai_作品概要書.pdf`

**Interfaces:**
- Consumes: Task 4で確認したPPTXとPDF
- Produces: 横向き5ページ版の成果物と再生成方針を説明するREADME

- [ ] **Step 1: READMEを更新する**

次の情報を明記する。

```markdown
- 原本は16:9横向き・5ページのPPTX
- 提出用PDFはMicrosoft PowerPointから書き出す
- HTML版は比較資料として残す
- ページ構成は「原体験／解決方法／使い方／独自性の実証／技術と安全性」
```

- [ ] **Step 2: 中間生成物をコミット対象から外す**

Run:

```powershell
git status --short
```

Expected: `.codex-pptx-landscape/`は未追跡のままで、`git add`の対象に含めない。

- [ ] **Step 3: リポジトリ全体を検査する**

Run:

```powershell
npm run check
```

Expected: 型検査、lint、75件のテストがすべて成功する。

- [ ] **Step 4: 成果物だけをコミットする**

Run:

```powershell
git add -- 'docs/Overlai_作品概要書.pptx' 'docs/Overlai_作品概要書.pdf' 'docs/概要書/README.md'
git commit -m '作品概要書を横向き5ページに再構成する'
```

Expected: PPTX、PDF、READMEだけがコミットされる。
