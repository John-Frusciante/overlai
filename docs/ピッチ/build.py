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
# 二つのエピソード（組み合わせの迷い・重複の迷い）→ 共通する原因 → 両方を解くプロダクト → コンセプト → 締め
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


def episode(no, kind, who, color, cloud, people, scene, doubts):
    """人物のイラストと、そのとき浮かんだ迷いの吹き出し。迷いを一番大きく見せる。
    イラストは illust/make.py で描いたもの（素材サイトの画像は使わない）"""
    cw, ch = 8.3, None
    cl = image(cloud, 0.6, 2.6, w=cw)
    ch = cl['h']
    cx, cy = 0.6 + 0.494 * cw, 2.6 + 0.491 * ch  # 吹き出しの本体の中心
    ppl = image(people, 0, 0, h=2.75)
    ppl['x'], ppl['y'] = 12.95 - ppl['w'], 7.5 - ppl['h']
    out = [
        text(0.9, 0.8, 8, 0.5, f'エピソード {no}｜{kind}', 20, color, bold=True),
        text(0.9, 1.3, 11.5, 0.5, who, 18, MUTED),
        text(0.9, 1.85, 12, 0.6, scene, 26, MUTED, bold=True),
        cl, ppl,
    ]
    for i, q in enumerate(doubts):
        out.append(text(cx - 3.6, cy - 0.76 + i * 0.86, 7.2, 0.72, q, 32, NAVY, bold=True, align='center'))
    return out


# スローガン。店頭の判定だけでなく、塗る順番・飲み合わせまで含めて「重ねる前に確かめる」アプリだと言う。
# 表紙・コンセプト・締めの3か所で使う（パネルの見出しも同じ文にそろえる）
SLOGAN = '重ねる前に、重ねて見る。'

# 0. 表紙（話しながら次へ送る）
SLIDES.append(dict(bg=WHITE, notes=(
    '鈴鹿高専の、Overlaiです。'
), items=[
    image('logo-faint.png', 8.6, 1.1, h=5.4),
    text(0.9, 1.25, 9, 0.5, 'ユメカタリ 学生生成AIコンテスト 2026｜開発部門', 16, MUTED),
    *brand(0.9, 2.35, size=72),
    text(0.9, 4.2, 8.5, 0.9, SLOGAN, 34, NAVY, bold=True),
    text(0.9, 6.05, 10, 0.4, '鈴鹿工業高等専門学校', 15, MUTED, bold=True),
    text(0.9, 6.45, 10, 0.4, '井上 高志・濱田 圭太郎・杉本 隼都', 15, MUTED),
]))

# 1. エピソード1：組み合わせの迷い
SLIDES.append(dict(bg=WHITE, notes=(
    'ステロイドの塗り薬を使う濱田と杉本は、ある日、化粧水を手に取って、手が止まりました。'
    '使っていいのか。どっちが先か。'
), items=episode(
    1, '組み合わせの迷い', '濱田・杉本｜肌が弱く、ステロイドの塗り薬を使っている', BLUE, 'cloud-blue.png', 'people-1.png',
    'ある日、ドラッグストアで化粧水を手に取って、手が止まった。',
    ['薬を塗った肌に、使っていい？', '薬と化粧品、どっちが先？'],
)))

# 2. エピソード2：重複の迷い（人物紹介はエピソード1と同じく「どんな人か」を書く）
SLIDES.append(dict(bg=WHITE, notes=(
    '井上は、風邪薬を買って帰ると、似た薬がもう家にありました。'
), items=episode(
    2, '重複の迷い', '井上｜店頭に立つと、家にある薬を思い出せない', AMBER, 'cloud-amber.png', 'people-2.png',
    '風邪薬を買って帰ると、似たような薬がもう家にあった。',
    ['家に、同じような薬あったっけ？', '名前は違うけど、中身は同じ？'],
)))

# 3. 共通する原因
SLIDES.append(dict(bg=WHITE, notes=(
    'どの迷いも、家にある薬と見比べないと答えが出ません。でも、店の棚の前では、それができません。'
), items=[
    text(0.9, 1.3, 11.5, 0.6, '「使っていい？」「どっちが先？」「もう家にある？」', 24, FAINT),
    text(0.9, 2.05, 11.5, 0.7, 'どの迷いも、家にある薬と見比べないと答えが出ない。', 30, MUTED),
    rect(0.9, 3.2, 0.9, 0.06, NAVY),
    text(0.9, 3.6, 11.8, 2.4, 'でも、店の棚の前では、\n家の薬と見比べられない。', 50, NAVY, bold=True),
]))

# 4. しくみ
def step(n, y, head, sub, ai=False):
    out = [
        rect(0.9, y + 0.04, 0.52, 0.52, NAVY, radius=0.26, label=str(n), color=WHITE),
        text(1.65, y, 6.6, 0.5, head, 22, INK, bold=True),
        text(1.65, y + 0.5, 7.2, 0.4, sub, 15, MUTED),
    ]
    if ai:  # 生成AIを使う段にだけ札を付ける
        out.append(rect(1.65 + len(head) * 22 / 72 + 0.15, y + 0.07, 0.95, 0.36, 'EFF6FF', radius=0.18,
                        line='BFDBFE', label='生成AI', size=12, color=BLUE))
    return out

def legend(x, y):
    """3色の意味。アプリの判定の見出しと同じ言葉を使う"""
    out = []
    for c, lb in [('2563EB', '買っても問題なさそう'), ('D97706', '家にあるもので足りそう'), ('DC2626', '注意が必要')]:
        out += [rect(x, y + 0.1, 0.2, 0.2, c, radius=0.1), text(x + 0.28, y, 2.3, 0.4, lb, 14, MUTED, bold=True)]
        x += 0.28 + len(lb) * 14 / 72 + 0.35
    return out

SLIDES.append(dict(bg=WHITE, notes=(
    'そこで作ったのが、Overlaiです。店頭で撮るだけで、生成AIが家にあるものと重ねて判定し、出典つきで理由を示します。'
), items=[
    *brand(0.9, 0.7, size=66),
    text(5.75, 1.45, 3.2, 0.4, 'Overlay（重ねる）＋ AI', 16, MUTED),
    text(0.9, 2.5, 8.2, 1.4, '店頭で撮るだけで、\n家にあるものと重ねて判定する。', 30, INK, bold=True),
    *step(1, 4.05, '家にあるものを登録する', '薬も化粧品も、撮れば成分まで入る。これが判定の基準になる。'),
    *step(2, 4.95, '店頭で、成分表示を撮る', '気になった商品を撮るだけ。書式がばらばらでも読み取る。', ai=True),
    *step(3, 5.85, '家の在庫と重ねて判定する', '重複も組み合わせも考え、買うべきかを3色と出典つきの理由で伝える。', ai=True),
    *legend(1.65, 6.75),
    *phone('stock-mid.jpg', 9.55, 0.55, 6.2),
    text(9.3, 6.93, 3.5, 0.4, '家の在庫（マイストック）', 12, FAINT, align='center'),
]))

# 5. エピソード1への答え（何ができるかではなく、使う人に何がうれしいかを書く）
SLIDES.append(dict(bg=CANVAS, notes=(
    '使っていいかの目安がその場で分かり、塗る順番まで案内します。'
), items=[
    text(0.9, 0.95, 6, 0.5, 'エピソード 1 への答え｜組み合わせ', 20, BLUE, bold=True),
    text(0.9, 1.5, 5.8, 1.3, '「使っていい？」の目安が、\nその場でわかる。', 30, INK, bold=True),
    text(0.9, 2.9, 5.8, 1.1, '薬を塗っている肌に刺激になりうる化粧品は、\n理由つきで教えてくれる。\n例）エタノール → 薬を塗った肌の刺激になる可能性', 15, MUTED),
    rect(0.9, 4.25, 0.6, 0.05, LINE),
    text(0.9, 4.5, 6.0, 1.3, '今ある薬と化粧品の\n塗る順番が、ひと目でわかる。', 30, INK, bold=True),
    text(0.9, 5.9, 5.8, 0.8, '化粧水から処方の軟膏まで、家にあるものを\n塗る順に並べて見せる。※医師・薬剤師の指示が優先', 15, MUTED),
    *phone('red-real.png', 6.95, 0.75, 5.5),
    *phone('routine-crop.jpg', 10.25, 0.75, 5.5),
    text(6.86, 6.5, 6.14, 0.4, '実際の判定画面（市販の薬用化粧水）・塗る順番の画面', 12, FAINT, align='center'),
]))

# 6. エピソード2への答え（5枚目と同じ組み方にそろえる）
SLIDES.append(dict(bg=CANVAS, notes=(
    '名前が違っても、成分で重なりに気づけます。'
), items=[
    text(0.9, 0.95, 6, 0.5, 'エピソード 2 への答え｜重複', 20, AMBER, bold=True),
    text(0.9, 1.5, 7.8, 1.3, '名前が違っても、同じ成分が\n入っていれば気づける。', 30, INK, bold=True),
    text(0.9, 2.9, 7.8, 1.1, '店の解熱鎮痛薬と、家の「イブA錠」。商品名は違っても、\nどちらにもイブプロフェンが入っている。風邪薬にも同じ成分が\n入っていることがあるので、成分で見比べる。', 15, MUTED),
    rect(0.9, 4.25, 0.6, 0.05, LINE),
    text(0.9, 4.5, 7.8, 1.3, '家にある薬で足りるなら、\n買わずに済む。', 30, INK, bold=True),
    text(0.9, 5.9, 7.8, 0.8, '重なっている家の薬を、その場で並べて見せる。\n無駄な買い物も、同じ成分の重ね飲みも防ぎやすくなる。', 15, MUTED),
    *phone('yellow-real.png', 9.35, 0.55, 6.2),
    text(9.26, 6.93, 3.25, 0.4, '実際の判定画面（市販の解熱鎮痛薬）', 12, FAINT, align='center'),
]))

# 7. コンセプト：店頭の判定だけでなく、買う・塗る・飲むの全部で「重ねる前に確かめる」
def pillar(x, head, sub, tag):
    return [
        rect(x, 3.05, 3.72, 2.75, CANVAS, radius=0.25),
        text(x + 0.4, 3.4, 3.1, 0.6, head, 26, NAVY, bold=True),
        text(x + 0.4, 4.15, 3.1, 1.0, sub, 18, MUTED),
        text(x + 0.4, 5.2, 3.1, 0.4, tag, 14, BLUE, bold=True),
    ]

SLIDES.append(dict(bg=WHITE, notes=(
    '買い重ねる前に。塗り重ねる前に。一緒に飲む前に。'
), items=[
    text(0, 0.95, W, 0.5, 'Overlai が目指すこと', 20, BLUE, bold=True, align='center'),
    text(0, 1.5, W, 1.1, SLOGAN, 54, NAVY, bold=True, align='center'),
    *pillar(0.9, '買い重ねる前に', 'もう家にある？\n名前違いの同じ薬は？', '重複'),
    *pillar(4.81, '塗り重ねる前に', '一緒に使っていい？\nどれを先に塗る？', '組み合わせ・塗る順番'),
    *pillar(8.72, '一緒に飲む前に', '今飲んでいる薬と\n一緒で大丈夫？', '飲み合わせ'),
    text(0, 6.25, W, 0.5, '肌の治療を続ける人も、家族の薬を買う人も、店頭で迷わない毎日へ。', 20, MUTED, bold=True, align='center'),
]))

# 8. 締め
SLIDES.append(dict(bg=WHITE, notes=(
    'Overlai。' + SLOGAN
), items=[
    text(0, 1.2, W, 0.7, '店頭で撮るだけで、家の薬や化粧品と重ねて判定する。', 26, MUTED, align='center'),
    *brand(4.05, 2.3, size=80),
    text(0, 4.45, W, 0.8, SLOGAN, 34, NAVY, bold=True, align='center'),
    text(0.9, 6.62, 9, 0.4, '鈴鹿工業高等専門学校　井上 高志・濱田 圭太郎・杉本 隼都', 15, MUTED),
    rect(11.28, 5.0, 1.4, 1.4, WHITE, radius=0.12, line=LINE),
    image('qr.png', 11.33, 5.05, h=1.3),
    text(11.08, 6.5, 1.8, 0.4, '実機を試す', 13, MUTED, align='center'),
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
