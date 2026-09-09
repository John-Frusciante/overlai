# 作品概要書のソース

提出用PDF → [`../Overlai_作品概要書.pdf`](../Overlai_作品概要書.pdf)（A4・3ページ）

## 構成

| ページ | 内容 |
| :---: | :--- |
| 1 | ヘッダー・作品サマリー（**2つの判断軸**）・課題・なぜ解決されないのか |
| 2 | 3色判定（実画面）・2段階のAIパイプライン・そのほかの画面 |
| 3 | 実物商品での実証・安全設計・実装状況とこれから |

## 作り直しかた

`overview.tpl.html` の `{{BLUE}}` などを同ディレクトリのPNGのdata URIに置換して
`overview.html` を作り、Chrome の `--print-to-pdf` に渡す。

```bash
python3 - <<'PY'
import base64, pathlib
d = pathlib.Path('docs/概要書')
t = (d/'overview.tpl.html').read_text()
for k, f in [('BLUE','blue'),('YELLOW','yellow'),('RED','red'),
             ('STOCK','stock'),('REASON','reasonfull'),('ROUTINE','routine')]:
    t = t.replace('{{'+k+'}}', 'data:image/png;base64,'
                  + base64.b64encode((d/f'{f}-s.png').read_bytes()).decode())
(d/'overview.html').write_text(t)
PY

CHROME="$HOME/.cache/puppeteer/chrome/mac_arm-148.0.7778.97/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="docs/Overlai_作品概要書.pdf" "file://$PWD/docs/概要書/overview.html"
```

## 訴求の構造

このプロダクトの価値は2本あり、**どちらか一方だけだと弱い**。

| 軸 | 内容 | 判定 |
| :--- | :--- | :---: |
| もう持っていないか | 同一成分・同効能が家にある。重複購入と残薬を防ぐ | 🟡 |
| いま使っている薬と合うか | 手持ちの処方薬との併用リスク。**外用薬 × 化粧品の相互作用DBは日本に存在しない** | 🔴 |

概要書では、この2軸を **§00 のサマリー直後に並べて示し**、§01 の2つの場面を
それぞれの軸に対応づけている（色も 🟡🔴 と揃えている）。
**片方だけを前に出すと「家計簿アプリの一種」に見えてしまう**ため、
文言を編集するときも2軸が並んでいる構造を崩さないこと。

## 注意

- **1ページに収まるかは `.page` の高さで決まる。** 内容を足したら必ずPDFを開いて
  はみ出していないか確認する（`overflow:hidden` なので、はみ出しても静かに切れる）
- スクリーンショットは本番（overlai-delta.vercel.app）から取得したもの。
  UIを変えたら撮り直す
- **応募者は井上 高志・濱田 圭太郎・杉本 隼都（鈴鹿工業高等専門学校）の3名。** 変わったらヘッダーのメタを直す
