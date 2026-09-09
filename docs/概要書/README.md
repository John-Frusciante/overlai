# 作品概要書のソース

提出用PDF → [`../Overlai_作品概要書.pdf`](../Overlai_作品概要書.pdf)（A4・3ページ）

## 構成

| ページ | 内容 |
| :---: | :--- |
| 1 | ヘッダー・作品サマリー・課題・なぜ解決されないのか |
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

## 注意

- **1ページに収まるかは `.page` の高さで決まる。** 内容を足したら必ずPDFを開いて
  はみ出していないか確認する（`overflow:hidden` なので、はみ出しても静かに切れる）
- スクリーンショットは本番（overlai-delta.vercel.app）から取得したもの。
  UIを変えたら撮り直す
- **応募区分を「個人応募」と書いている。** チーム応募にするならヘッダーのメタを直す
