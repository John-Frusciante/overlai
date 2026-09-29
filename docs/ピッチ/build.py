"""本選1分ピッチのスライドを pptx とプレビューPNGの両方に書き出す。

同じ定義から両方を作るので、PNG を見れば pptx の配置を確かめられる。

  pip install python-pptx pillow
  python3 docs/ピッチ/build.py

プレビューPNGは、同じフォルダに NotoSansJP-Regular.otf / NotoSansJP-Bold.otf を置いたときだけ作る。
Googleスライドに取り込んだあとはそちらが正本。ここは叩き台を作り直すときに使う。
"""
import sys
from pathlib import Path

from lxml import etree
from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

HERE = Path(__file__).parent
A = HERE / 'assets'
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE
OUT.mkdir(parents=True, exist_ok=True)

W, H = 13.333, 7.5
FONT = 'Noto Sans JP'
DPI = 144

NAVY, INK, MUTED, FAINT = '1B2A4A', '0F172A', '475569', '94A3B8'
CANVAS, LINE, WHITE = 'F5F7FA', 'E2E8F0', 'FFFFFF'
RED, AMBER, BLUE, PALE = 'DC2626', 'C2410C', '2563EB', 'CBD5E1'

LEAD = 1.45  # Noto Sans JP の行送り（フォントサイズ比）


# ── 要素 ─────────────────────────────────────────────
def rect(x, y, w, h, fill, radius=0, line=None, label=None, size=18, color=INK, bold=True):
    """label を渡すと図形の中央に文字を置く（札・番号の丸）。"""
    return dict(kind='rect', x=x, y=y, w=w, h=h, fill=fill, radius=radius, line=line,
                label=label, size=size, color=color, bold=bold)


def text(x, y, w, h, body, size, color=INK, bold=False, align='left', spacing=1.0):
    return dict(kind='text', x=x, y=y, w=w, h=h, body=body, size=size, color=color,
                bold=bold, align=align, spacing=spacing)


def image(path, x, y, h=None, w=None):
    iw, ih = Image.open(A / path).size
    if h is None:
        h = w * ih / iw
    if w is None:
        w = h * iw / ih
    return dict(kind='image', path=path, x=x, y=y, w=w, h=h)


def phone(path, x, y, h):
    """スクリーンショットを白い枠に入れる。"""
    im = image(path, x, y, h=h)
    p = 0.09
    return [rect(x - p, y - p, im['w'] + 2 * p, h + 2 * p, WHITE, radius=0.22, line=LINE), im]


def brand(x, y, size=20, color=NAVY, logo='logo.png'):
    s = size / 72 * 1.5
    return [image(logo, x, y, h=s), text(x + s * 1.02, y + s * 0.5 - size * LEAD / 144, size / 72 * 4.5, size * LEAD / 72 + 0.05, 'Overlai', size, color)]


# ── スライド ────────────────────────────────────────
# 二つのエピソード（組み合わせの迷い・重複の迷い）→ 共通する原因 → 両方を解くプロダクト → 締め
# 判定画面は赤・黄とも、実機で市販品を撮った実際の出力（red-real.png・yellow-real.png）。
# 画面にない内容（残量に触れた文など）をスライドに書かないこと
SLIDES = []


def chip(x, y, label, color, bg, border, size=20):
    """エピソードの中の「迷い」を吹き出し風の札にする。"""
    w = len(label) * size / 72 * 1.02 + 0.7
    return [rect(x, y, w, 0.72, bg, radius=0.36, line=border, label=label, size=size, color=color)], w


def chips(y, labels, color, bg, border):
    out, x = [], 0.9
    for lb in labels:
        items, w = chip(x, y, lb, color, bg, border)
        out += items
        x += w + 0.3
    return out


def episode(no, kind, who, color, bg, border, lead, big, doubts):
    return [
        text(0.9, 1.0, 6, 0.5, f'エピソード {no}｜{kind}', 20, color, bold=True),
        text(0.9, 1.5, 11, 0.5, who, 18, MUTED),
        text(0.9, 2.45, 11.5, 0.6, lead, 24, MUTED, bold=True),
        text(0.9, 3.15, 11.5, 2.2, big, 54, NAVY, bold=True),
        *chips(5.75, doubts, color, bg, border),
    ]


# 0. 表紙（話しながら次へ送る）
SLIDES.append(dict(bg=WHITE, notes=(
    '鈴鹿高専の、Overlaiです。'
), items=[
    image('logo-faint.png', 8.6, 1.1, h=5.4),
    text(0.9, 1.25, 9, 0.5, 'ユメカタリ 学生生成AIコンテスト 2026｜開発部門', 16, MUTED),
    *brand(0.9, 2.35, size=72),
    text(0.9, 4.2, 8.5, 0.9, '買う前に、家の棚を重ねて見る。', 34, NAVY, bold=True),
    text(0.9, 6.05, 10, 0.4, '鈴鹿工業高等専門学校', 15, MUTED, bold=True),
    text(0.9, 6.45, 10, 0.4, '井上 高志・濱田 圭太郎・杉本 隼都', 15, MUTED),
]))

# 1. エピソード1：組み合わせの迷い
SLIDES.append(dict(bg=WHITE, notes=(
    'ステロイドの塗り薬を使う濱田と杉本は、ある日、化粧水を手に取って、手が止まりました。'
    '薬を塗った肌に使っていいのか。どっちが先か。'
), items=episode(
    1, '組み合わせの迷い', '濱田・杉本｜肌が弱く、ステロイドの塗り薬を使っている', BLUE, 'EFF6FF', 'BFDBFE',
    'ある日、ドラッグストアで――',
    '化粧水を手に取って、\n手が止まった。',
    ['薬を塗った肌に、使っていい？', '薬と化粧品、どっちが先？'],
)))

# 2. エピソード2：重複の迷い
SLIDES.append(dict(bg=WHITE, notes=(
    '井上は、風邪薬を買って帰ると、似た薬がもう家にありました。名前が違うと、同じ薬だと気づけないんです。'
), items=episode(
    2, '重複の迷い', '井上', AMBER, 'FFF7ED', 'FED7AA',
    '風邪薬を買って、家に帰ると――',
    '似たような薬が、\nもう家にあった。',
    ['家に、同じような薬あったっけ？', '名前は違うけど、中身は同じ？'],
)))

# 3. 共通する原因
SLIDES.append(dict(bg=NAVY, notes=(
    'どの迷いも、答えは家にあるもの次第。なのに、店頭で確かめる方法がなかったんです。'
), items=[
    text(0.9, 1.3, 11.5, 0.6, '使っていい？　どっちが先？　もう家にある？', 24, FAINT),
    text(0.9, 2.05, 11.5, 0.7, 'どの迷いも、答えは「家にあるもの」次第。', 30, PALE),
    rect(0.9, 3.2, 0.9, 0.06, PALE),
    text(0.9, 3.6, 11.8, 2.4, 'なのに、店頭で家にあるものと\n重ねて確かめる方法がなかった。', 48, WHITE, bold=True),
]))

# 4. だから作った：仕組み
def step(n, y, head, sub, ai=False):
    out = [
        rect(0.9, y + 0.04, 0.52, 0.52, NAVY, radius=0.26, label=str(n), color=WHITE),
        text(1.65, y, 6.6, 0.5, head, 22, INK, bold=True),
        text(1.65, y + 0.5, 6.8, 0.4, sub, 15, MUTED),
    ]
    if ai:  # 生成AIを使う段にだけ札を付ける
        out.append(rect(1.65 + len(head) * 22 / 72 + 0.15, y + 0.07, 0.95, 0.36, 'EFF6FF', radius=0.18,
                        line='BFDBFE', label='生成AI', size=12, color=BLUE))
    return out

SLIDES.append(dict(bg=WHITE, notes=(
    'だから作りました。家の薬と化粧品を登録しておけば、店頭で撮るだけで、生成AIが重ねて判定します。'
), items=[
    text(0.9, 0.8, 6, 0.5, 'だから、作りました', 20, BLUE, bold=True),
    *brand(0.9, 1.3, size=44),
    text(4.2, 1.6, 4.5, 0.4, 'Overlay（重ねる）＋ AI', 16, MUTED),
    text(0.9, 2.55, 7.6, 1.4, '店頭で撮るだけで、\n家にあるものと重ねて判定する。', 30, INK, bold=True),
    *step(1, 4.15, '家の薬と化粧品を登録する', '処方薬・市販薬・スキンケアをひとつの在庫に（残量・期限も管理）'),
    *step(2, 5.1, '店頭で、商品の成分表示を撮る', '商品ごとに書式がばらばらな成分表示も、そのまま読み取る', ai=True),
    *step(3, 6.05, '家の在庫と重ねて判定する', '青・黄・赤の3色と、成分名つきの理由で示す', ai=True),
    *phone('stock-top.jpg', 9.55, 0.55, 6.2),
    text(9.46, 6.93, 3.04, 0.4, '在庫画面', 12, FAINT, align='center'),
]))

# 5. エピソード1への答え
SLIDES.append(dict(bg=CANVAS, notes=(
    '合わない組み合わせには理由つきで注意を出し、塗る順番まで組み立てます。'
), items=[
    text(0.9, 1.0, 6, 0.5, 'エピソード 1 への答え｜組み合わせ', 20, BLUE, bold=True),
    text(0.9, 1.6, 5.8, 1.6, '合わない組み合わせは、\n理由つきで知らせる。', 34, INK, bold=True),
    text(0.9, 3.2, 5.8, 1.1, '例）顔に塗っているステロイド軟膏\n　　× エタノールを含む化粧水\n　　→ 刺激が強くなる可能性', 16, MUTED),
    rect(0.9, 4.45, 0.6, 0.05, LINE),
    text(0.9, 4.75, 5.8, 1.1, '塗る順番も、\n家にあるもので組み立てる。', 26, INK, bold=True),
    text(0.9, 5.95, 5.8, 0.4, '順番はAIに任せず、剤形からルールで決めています。', 15, MUTED),
    text(0.9, 6.35, 5.8, 0.4, '赤の判定には、必ず薬剤師・皮膚科への相談を添えます。', 15, MUTED),
    *phone('red-real.png', 6.95, 0.75, 5.5),
    *phone('routine-crop.jpg', 10.25, 0.75, 5.5),
    text(6.86, 6.5, 6.14, 0.4, '実際の判定画面（市販の薬用化粧水）・ルーティン画面', 12, FAINT, align='center'),
]))

# 6. エピソード2への答え（5枚目と同じ組み方にそろえる）
SLIDES.append(dict(bg=CANVAS, notes=(
    '名前が違っても、成分で重なりに気づけます。'
), items=[
    text(0.9, 1.0, 6, 0.5, 'エピソード 2 への答え｜重複', 20, AMBER, bold=True),
    text(0.9, 1.6, 7.8, 1.6, '商品名が違っても、\n成分で重なりに気づく。', 34, INK, bold=True),
    text(0.9, 3.25, 7.8, 0.9, '例）店頭の解熱鎮痛薬 × 家の「イブA錠」\n　　→ 同じイブプロフェン', 16, MUTED),
    rect(0.9, 4.45, 0.6, 0.05, LINE),
    text(0.9, 4.75, 7.8, 1.1, '家にある薬で足りるなら、\n買わなくていいと伝える。', 26, INK, bold=True),
    text(0.9, 5.95, 7.8, 0.4, '重なっている家の薬を、その場で並べて見せます。', 15, MUTED),
    *phone('yellow-real.png', 9.35, 0.55, 6.2),
    text(9.26, 6.93, 3.25, 0.4, '実際の判定画面（市販の解熱鎮痛薬）', 12, FAINT, align='center'),
]))

# 7. 締め
SLIDES.append(dict(bg=NAVY, notes=(
    'Overlai。買う前に、家の棚を重ねて見る。'
), items=[
    text(0, 1.2, W, 0.7, '組み合わせも、重複も、店頭で。', 26, PALE, align='center'),
    *brand(4.05, 2.3, size=80, color=WHITE, logo='logo-white.png'),
    text(0, 4.45, W, 0.8, '買う前に、家の棚を重ねて見る。', 34, WHITE, bold=True, align='center'),
    text(0.9, 6.62, 9, 0.4, '鈴鹿工業高等専門学校　井上 高志・濱田 圭太郎・杉本 隼都', 15, PALE),
    rect(11.28, 5.0, 1.4, 1.4, WHITE, radius=0.12),
    image('qr.png', 11.33, 5.05, h=1.3),
    text(11.08, 6.5, 1.8, 0.4, '実機を試す', 13, PALE, align='center'),
]))


# ── pptx ─────────────────────────────────────────────
def rgb(h):
    return RGBColor.from_string(h)


def set_font(run, size, color, bold):
    f = run.font
    f.size, f.bold, f.name = Pt(size), bold, FONT
    f.color.rgb = rgb(color)
    rpr = run._r.get_or_add_rPr()
    for tag in ('a:ea', 'a:cs'):
        el = rpr.find(qn(tag))
        if el is None:
            el = etree.SubElement(rpr, qn(tag))
        el.set('typeface', FONT)


def build_pptx(path):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(W), Inches(H)
    blank = prs.slide_layouts[6]
    for s in SLIDES:
        sl = prs.slides.add_slide(blank)
        bg = sl.background.fill
        bg.solid()
        bg.fore_color.rgb = rgb(s['bg'])
        for it in s['items']:
            x, y, w, h = (Inches(it[k]) for k in ('x', 'y', 'w', 'h'))
            if it['kind'] == 'rect':
                shp = sl.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if it['radius'] else MSO_SHAPE.RECTANGLE,
                                          x, y, w, h)
                if it['radius']:
                    shp.adjustments[0] = it['radius'] / min(it['w'], it['h'])
                shp.fill.solid()
                shp.fill.fore_color.rgb = rgb(it['fill'])
                if it['line']:
                    shp.line.color.rgb = rgb(it['line'])
                    shp.line.width = Pt(1)
                else:
                    shp.line.fill.background()
                shp.shadow.inherit = False
                tf = shp.text_frame
                tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
                if it['label']:
                    tf.word_wrap = False
                    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
                    p = tf.paragraphs[0]
                    p.alignment = PP_ALIGN.CENTER
                    r = p.add_run()
                    r.text = it['label']
                    set_font(r, it['size'], it['color'], it['bold'])
            elif it['kind'] == 'image':
                sl.shapes.add_picture(str(A / it['path']), x, y, w, h)
            else:
                tb = sl.shapes.add_textbox(x, y, w, h)
                tf = tb.text_frame
                tf.word_wrap = True
                tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
                tf.vertical_anchor = MSO_ANCHOR.TOP
                for i, line in enumerate(it['body'].split('\n')):
                    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
                    p.alignment = {'left': PP_ALIGN.LEFT, 'center': PP_ALIGN.CENTER}[it['align']]
                    p.line_spacing = it['spacing']
                    r = p.add_run()
                    r.text = line
                    set_font(r, it['size'], it['color'], it['bold'])
        sl.notes_slide.notes_text_frame.text = s['notes']
    prs.save(path)


# ── プレビュー ───────────────────────────────────────
def px(v):
    return round(v * DPI)


def build_preview(i, s, path):
    img = Image.new('RGB', (px(W), px(H)), '#' + s['bg'])
    d = ImageDraw.Draw(img)
    for it in s['items']:
        box = [px(it['x']), px(it['y']), px(it['x'] + it['w']), px(it['y'] + it['h'])]
        if it['kind'] == 'rect':
            d.rounded_rectangle(box, radius=px(it['radius']), fill='#' + it['fill'],
                                outline=('#' + it['line']) if it['line'] else None, width=2)
            if it['label']:
                f = ImageFont.truetype(str(HERE / ('NotoSansJP-Bold.otf' if it['bold'] else 'NotoSansJP-Regular.otf')),
                                       round(it['size'] * DPI / 72))
                d.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), it['label'], font=f,
                       fill='#' + it['color'], anchor='mm')
        elif it['kind'] == 'image':
            im = Image.open(A / it['path']).convert('RGBA').resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
            img.paste(im, box[:2], im)
        else:
            f = ImageFont.truetype(str(HERE / ('NotoSansJP-Bold.otf' if it['bold'] else 'NotoSansJP-Regular.otf')),
                                   round(it['size'] * DPI / 72))
            pitch = it['size'] * LEAD * it['spacing'] * DPI / 72
            yy = box[1]
            for para in it['body'].split('\n'):
                # 箱の幅で折り返す（pptx 側の折り返しを真似る）
                lines, cur = [], ''
                for ch in para:
                    if f.getlength(cur + ch) > box[2] - box[0] and cur:
                        lines.append(cur)
                        cur = ch
                    else:
                        cur += ch
                lines.append(cur)
                for ln in lines:
                    lw = f.getlength(ln)
                    xx = box[0] if it['align'] == 'left' else (box[0] + box[2] - lw) / 2
                    d.text((xx, yy + pitch * 0.12), ln, font=f, fill='#' + it['color'])
                    yy += pitch
            if yy > box[3] + 2:
                print(f'  ! スライド{i + 1}: 文字が箱からはみ出しています → {it["body"][:16]}…')
    img.save(path)


build_pptx(OUT / 'Overlai_本選ピッチ.pptx')
if (HERE / 'NotoSansJP-Bold.otf').exists():
    for i, s in enumerate(SLIDES):
        build_preview(i, s, OUT / f'preview-{i + 1}.png')
else:
    print('Noto Sans JP の otf が無いのでプレビューは作りません')
total = sum(len(s['notes']) for s in SLIDES)
print(f'{len(SLIDES)}枚 / 台本 {total}字（約{total / 5:.0f}秒）')
