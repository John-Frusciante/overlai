# 作品概要書のソース

提出用PDF → [`../Overlai_作品概要書.pdf`](../Overlai_作品概要書.pdf)（**A4・4ページ**）

## 構成

| ページ | 内容 |
| :---: | :--- |
| 1 | ヘッダー（QR）・作品サマリー（**3つの柱**）・課題・なぜ解決されないのか |
| 2 | 機能の全体像（4分類で全機能を網羅）・3色判定の実画面・そのほかの画面 |
| 3 | **システム構成図・2段階のAIパイプライン・AIを使う場所と使わない場所** |
| 4 | 実物商品での実証・安全設計・これから・技術スタック |

3ページ目は実装力の説明にあてている。**AIを使っていない箇所とその理由**を明示することが、
技術的な判断ができている証拠になる。

## 訴求の構造

価値は3本あり、**どれか一本だけだと弱い**。

| 柱 | 内容 |
| :--- | :--- |
| **つくる** | 自分がいま使っている薬・化粧品の成分データベースが手元にできる |
| **判断する** | 重複した成分・効能、飲み合わせ・塗り合わせのリスク（🟡🔴） |
| **使いこなす** | 塗る順序・洗う順序・服薬スケジュール・残薬・使用期限 |

**「もう持っているか」だけを前に出すと家計簿アプリの一種に見え、
「判定」だけを前に出すと買うときしか使わないアプリに見える。**
3本が並んでいる構造を崩さないこと。

## 書かないこと

- **Anthropic 経路とモックモードの話は概要書に載せない。** コードには残っているが、
  概要書で伝えるべきは「いま何で動いているか」であって、切り替えの仕組みではない
  （技術的な詳細は [ARCHITECTURE.md](../ARCHITECTURE.md) にある）

## 作り直しかた

`overview.tpl.html` の `{{BLUE}}` などを同ディレクトリの素材で置換して `overview.html` を作り、
Chrome の `--print-to-pdf` に渡す。

```bash
python3 - <<'PY'
import base64, pathlib
d = pathlib.Path('docs/概要書')
t = (d/'overview.tpl.html').read_text()
for k, f in [('BLUE','blue'),('YELLOW','yellow'),('RED','red'),
             ('STOCK','stock'),('REASON','reasonfull'),('ROUTINE','routine')]:
    t = t.replace('{{'+k+'}}', 'data:image/png;base64,'
                  + base64.b64encode((d/f'{f}-s.png').read_bytes()).decode())
t = t.replace('{{QR}}', (d/'qr.svg').read_text())
(d/'overview.html').write_text(t)
PY

CHROME="$HOME/.cache/puppeteer/chrome/mac_arm-148.0.7778.97/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="docs/Overlai_作品概要書.pdf" "file://$PWD/docs/概要書/overview.html"
```

## QRコード

`qr.svg` は公開URL（`https://overlai-delta.vercel.app`）のQRコード。
**紙で読む審査員がその場で実機を触れるようにするためのもの。** URLを打ち込んではもらえない。

segno で生成し、**A4解像度でレンダリングしたページから OpenCV の QRCodeDetector で
実際にデコードして一致を確認してある。** URLが変わったら作り直すこと。

```python
import segno, pathlib
qr = segno.make('https://overlai-delta.vercel.app', error='m')
q = 2  # クワイエットゾーン
n = len(qr.matrix); size = n + q*2
d = ''.join(f"M{x+q} {y+q}h1v1h-1z"
            for y, row in enumerate(qr.matrix) for x, v in enumerate(row) if v)
pathlib.Path('docs/概要書/qr.svg').write_text(
    f'<svg viewBox="0 0 {size} {size}" shape-rendering="crispEdges">'
    f'<rect width="{size}" height="{size}" fill="#fff"/>'
    f'<path d="{d}" fill="#1B2A4A"/></svg>')
```

紙面では21mm角で置いている（29×29モジュール＋クワイエットゾーン）。
**これ以上小さくすると読み取れなくなる可能性がある。**

## 注意

- **1ページに収まるかは `.page` の高さで決まる。** 内容を足したら必ずPDFを開いて
  はみ出していないか確認する（`overflow:hidden` なので、はみ出しても静かに切れる）
- スクリーンショットは本番（overlai-delta.vercel.app）から取得したもの。UIを変えたら撮り直す
- **応募者は井上 高志・濱田 圭太郎・杉本 隼都（鈴鹿工業高等専門学校）の3名。**
  変わったらヘッダーのメタを直す
