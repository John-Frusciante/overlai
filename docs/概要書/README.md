# 作品概要書のソース

編集用PPTX → [`../Overlai_作品概要書.pptx`](../Overlai_作品概要書.pptx)（**A4縦・3ページ**）  
提出用PDF → [`../Overlai_作品概要書.pdf`](../Overlai_作品概要書.pdf)（PowerPointから書き出し）

現在の提出物はPPTXを原本とする。`overview.tpl.html` と `overview.html` は、再構成時の比較資料として残している。

## 構成

| ページ | 内容 |
| :---: | :--- |
| 1 | **3人の原体験**・既存サービスの境界・開発の着想 |
| 2 | 利用の流れ・**在庫によって同じ商品の判定が変わる実証**・3色判定・日常利用 |
| 3 | **2段階のAI・AIとルールの役割分担・安全設計・実物商品での検証** |

1ページ目で「なぜ作ったか」、2ページ目で「何がこれまでと違うか」、3ページ目で
「どう実現し、安全を守るか」を伝える。見出しだけを追っても、この順序が崩れないようにする。

## 訴求の構造

価値の中心は、**判断の基準を商品から「その人の家」へ移すこと**。

| 位置づけ | 内容 |
| :--- | :--- |
| **中核** | 自分が使っている薬・化粧品を在庫にし、店頭の商品と照合する |
| **判定** | 成分・効能の重複、飲み合わせ・塗り合わせの可能性を3色と根拠で示す |
| **日常への広がり** | 同じ在庫を塗る順、洗う順、服薬記録、残量、使用期限にも使う |

機能を同じ強さで並べない。作品の独自性は、同じ商品でも家の在庫によって判定が変わる実証で見せる。
日常機能は、店頭判定のためにつくった在庫を買ったあとも生かすものとして短く扱う。

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
