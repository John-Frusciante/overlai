"""本選1分ピッチのスライドを pptx とプレビューPNGに書き出す。

文言はブースパネル（docs/パネル/panel.tpl.html）と同じにし、見せ方はスライド向けに組む（1枚に1つのこと）。
  表紙 → CASE 1（重複）→ CASE 2（組み合わせ）→ Overlai → できること×3 → 使い方×2 → 目指すこと → 締め
CASE はメンバーの実体験（エピソード）。使い方1（店で選ぶ）はパネルの「しくみ」、使い方2（家で使う）は
ルーティンの流れ（登録 → 順番と助言 → 毎日の表示・服薬の記録）。
エピソードの順は、パネルの「できること」の順（重複 → 組み合わせ → 順番）に合わせる。
できることの各スライドは、エピソードで浮かんだ迷いから始めて、その答えとして実機の画面を大きく見せる。
目指すこと・締めは、作り直す前の版の2枚を戻したもの（ユーザー判断）。

パネルで決めたことのうち、ここでも守るもの。
- 説明は使う人にとってうれしいことを書く。開発者向けの補足は載せない
- しくみは「やること」が主役で、「うれしいこと」はその横にぶら下げる（一回り小さく、縦線を付ける）
- 実機の画面には、どこを見ればいいかの囲みを付ける（位置はパネルと同じ割合）
- 判定画面は実機で市販品を撮った実際の出力。画面にない内容をスライドに書かない

  uv run --with python-pptx --with pillow python docs/ピッチ/build.py

プレビューは Noto Sans JP の otf（Regular・Bold）がある場合だけ作る。置き場所は環境変数 NOTO_DIR か、
このフォルダ。PREVIEW_DIR を渡すと、1枚ずつの PNG もそこに書き出す。
Googleスライドに取り込んだあとはそちらが正本。ここは作り直すときに使う。
"""
import os
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
FONTS = Path(os.environ.get('NOTO_DIR', HERE))
PREVIEW_DIR = os.environ.get('PREVIEW_DIR')

W, H = 13.333, 7.5
X0, X1 = 0.75, 12.583  # 左右の余白
FONT = 'Noto Sans JP'
DPI = 144
LEAD = 1.45  # Noto Sans JP の行送り（フォントサイズ比）
MIN_PT = 14  # 投影で読める下限

# パネルと同じ色
NAVY, INK, MUTED, PALE, LINE, MIST, WHITE = '1B2A4A', '0F172A', '475569', 'C9D0DB', 'D9DFE7', 'F2F4F7', 'FFFFFF'
BLUE, AMBER, RED = '2563EB', 'D97706', 'DC2626'
FAINT, CANVAS = '94A3B8', 'F5F7FA'
SQ_A, SQ_B = 'E4E7EC', 'BCC3CE'  # 重なりの図の二つの四角

SLOGAN = '重ねる前に、重ねて見る。'


# ── 要素 ─────────────────────────────────────────────
def rect(x, y, w, h, fill, radius=0, line=None, line_w=1, label=None, size=18, color=INK, bold=True, shape='round'):
    """label を渡すと図形の中央に文字を置く（札・番号の丸）。
    shape='diag' は左上と右下だけ丸い四角（重なりの図の、重なった部分）"""
    return dict(kind='rect', x=x, y=y, w=w, h=h, fill=fill, radius=radius, line=line, line_w=line_w,
                label=label, size=size, color=color, bold=bold, shape=shape)


def text(x, y, w, h, body, size, color=INK, bold=False, align='left', spacing=1.0):
    """改行は body の \\n で決める（勝手に折り返さない）。"""
    return dict(kind='text', x=x, y=y, w=w, h=h, body=body, size=size, color=color,
                bold=bold, align=align, spacing=spacing)


def image(path, x, y, h=None, w=None):
    iw, ih = Image.open(A / path).size
    if h is None:
        h = w * ih / iw
    if w is None:
        w = h * iw / ih
    return dict(kind='image', path=path, x=x, y=y, w=w, h=h)


def font(size, bold):
    return ImageFont.truetype(str(FONTS / ('NotoSansJP-Bold.otf' if bold else 'NotoSansJP-Regular.otf')),
                              round(size * DPI / 72))


HAVE_FONTS = (FONTS / 'NotoSansJP-Bold.otf').exists() and (FONTS / 'NotoSansJP-Regular.otf').exists()


def width_of(s, size, bold=False):
    """文字列の幅（インチ）。フォントが無ければ全角1文字＝1em で見積もる。"""
    if HAVE_FONTS:
        return font(size, bold).getlength(s) / DPI
    return len(s) * size / 72


def line_h(size, spacing=1.0, lines=1):
    return size * LEAD * spacing / 72 * lines


def brand(x, y, size, color=NAVY):
    """ロゴの四角と「Overlai」。返り値は要素と全体の幅"""
    s = size / 72 * 1.5
    tx = x + s * 1.02
    return [image('logo.png', x, y, h=s),
            text(tx, y + s * 0.5 - line_h(size) / 2, width_of('Overlai', size) + 0.2, line_h(size), 'Overlai', size, color)], \
        s * 1.02 + width_of('Overlai', size)


def label(s, y=0.75, align='left'):
    """スライドの左上（または中央）に置く小さな見出し"""
    return text(X0 if align == 'left' else 0, y, 8 if align == 'left' else W, line_h(20), s, 20, BLUE, bold=True, align=align)


def phone(path, x, y, h, rings=(), sig=NAVY):
    """実機の画面を白い枠に入れ、見てほしい所を囲む。rings は (left, top, width, height, 札) を画像に対する割合で"""
    im = image(path, x, y, h=h)
    p = 0.09
    out = [rect(x - p, y - p, im['w'] + 2 * p, h + 2 * p, WHITE, radius=0.22, line=LINE), im]
    for l, t, w, hh, label in rings:
        rx, ry, rw, rh = x + im['w'] * l, y + h * t, im['w'] * w, h * hh
        out.append(rect(rx, ry, rw, rh, None, radius=0.06, line=sig, line_w=2.25))
        tw = width_of(label, 16, True) + 0.2
        out.append(rect(rx - 0.03, ry - 0.36, tw, 0.33, sig, radius=0.05, label=label, size=16, color=WHITE))
    return out, im['w']


# ── スライド ────────────────────────────────────────
SLIDES = []
TEAM = '井上 高志・濱田 圭太郎・杉本 隼都'

# 0. 表紙（スローガンは、目指すことと締めまで取っておく）
SLIDES.append(dict(notes='鈴鹿高専の、Overlaiです。', items=[
    image('logo-faint.png', 7.75, 1.05, h=5.4),
    text(X0, 0.75, 9, line_h(16), 'ユメカタリ 学生生成AIコンテスト 2026｜開発部門', 16, MUTED),
    *brand(X0, 2.45, 80)[0],
    text(X0, 4.3, 8, line_h(22), 'Overlay（重ねる）＋ AI', 22, MUTED),
    text(X0, 6.0, 8, line_h(16), '鈴鹿工業高等専門学校', 16, MUTED, bold=True),
    text(X0, 6.4, 8, line_h(16), TEAM, 16, MUTED),
]))


def episode(no, kind, who, people, scene, doubts):
    """人物のイラストと、そのとき浮かんだ迷いの吹き出し。迷いを一番大きく見せる。
    イラストは illust/make.py で描いたもの。エピソードは実話だけで組む"""
    cl = image('cloud.png', 0.45, 2.55, w=8.5)
    cx, cy = cl['x'] + 0.495 * cl['w'], cl['y'] + 0.49 * cl['h']  # 吹き出しの本体の中心
    ppl = image(people, 0, 0, h=2.75)
    ppl['x'], ppl['y'] = X1 + 0.3 - ppl['w'], H - ppl['h']
    out = [
        label(f'CASE {no}｜{kind}'),
        text(X0, 1.25, 11.5, line_h(18), who, 18, MUTED),
        text(X0, 1.8, 11.8, line_h(26), scene, 26, INK, bold=True),
        cl, ppl,
    ]
    for i, q in enumerate(doubts):
        out.append(text(cx - 3.7, cy - 0.78 + i * 0.86, 7.4, line_h(32), q, 32, NAVY, bold=True, align='center'))
    return out


# 1. エピソード1：重複（→ できること1）
SLIDES.append(dict(notes='井上は、風邪薬を買って帰ったら、似た薬がもう家にありました。', items=episode(
    1, '重複の迷い', '井上｜店頭に立つと、家にある薬を思い出せない', 'people-1.png',
    '風邪薬を買って帰ると、似たような薬がもう家にあった。',
    ['家に、同じような薬あったっけ？', '名前は違うけど、中身は同じ？'],
)))

# 2. エピソード2：組み合わせ（→ できること2・3）
SLIDES.append(dict(notes=(
    '病院で処方された薬を使う濱田と杉本は、化粧水を前に、'
    '使っていいのか、どっちが先か迷いました。'
), items=episode(
    2, '組み合わせの迷い', '濱田・杉本｜肌が弱く、病院で処方された薬を使っている', 'people-2.png',
    'ある日、ドラッグストアで化粧水を手に取って、手が止まった。',
    ['薬を塗った肌に、使っていい？', '薬と化粧品、どっちが先？'],
)))


# 3. Overlai（アプリの一文と、重なりの図）
def venn(x, y, s):
    """ロゴと同じ二つの四角を重ね、重なった所が判定になることを図で見せる"""
    a, off, ov, r = 0.7 * s, 0.3 * s, 0.4 * s, 0.117 * s
    pad = 0.067 * s
    lb = '撮って登録した\n家の薬・化粧品'
    out = [
        rect(x, y, a, a, SQ_A, radius=r),
        rect(x + off, y + off, a, a, SQ_B, radius=r),
        rect(x + off, y + off, ov, ov, NAVY, radius=r, shape='diag'),
        text(x + off, y + off + ov * 0.28, ov, line_h(18), '重ねて判定', 18, WHITE, bold=True, align='center'),
        text(x + pad, y + pad, a, line_h(18), '店で撮った商品', 18, NAVY, bold=True),
        text(x + s - pad - 2.4, y + s - pad - line_h(18, 1.0, 2), 2.4, line_h(18, 1.0, 2), lb, 18, NAVY,
             bold=True, align='right'),
    ]
    d, g = 0.16, 0.09
    dx = x + off + ov / 2 - (3 * d + 2 * g) / 2
    for i, c in enumerate([BLUE, AMBER, RED]):
        out.append(rect(dx + i * (d + g), y + off + ov * 0.62, d, d, c, radius=d / 2))
    return out


SLIDES.append(dict(notes=(
    'そこで作ったのがOverlaiです。店で成分表示を撮るだけで、買うべきかの目安がわかります。'
), items=[
    *brand(X0, 1.55, 72)[0],
    text(X0, 3.25, 6, line_h(18), 'Overlay（重ねる）＋ AI', 18, MUTED),
    text(X0, 4.1, 7.6, line_h(30, 1.0, 3), '店で成分表示を撮るだけで、\n家の薬・化粧品と比べて\n「買うべきか」の目安がわかる。', 30, INK, bold=True),
    *venn(X1 - 4.0, 1.75, 4.0),
]))


# 4〜6. できること（1枚に1つ。エピソードの迷いから始め、答えを実機の画面で見せる）
def legend(x, y):
    """3色の意味。アプリの判定の見出しと同じ言葉を使う"""
    out = [text(x, y, 1.6, line_h(15), '判定は3色', 15, MUTED, bold=True)]
    x += width_of('判定は3色', 15, True) + 0.35
    for c, lb in [(BLUE, '買っても問題なさそう'), (AMBER, '買わなくて大丈夫'), (RED, '注意が必要')]:
        out += [rect(x, y + 0.12, 0.19, 0.19, c, radius=0.095),
                text(x + 0.28, y, width_of(lb, 15, True) + 0.1, line_h(15), lb, 15, INK, bold=True)]
        x += 0.28 + width_of(lb, 15, True) + 0.4
    return out


CASES = [
    ('名前は違うけど、中身は同じ？', '名前が違っても、\n同じ働きの薬に気づける', '風邪薬と頭痛薬のように、別の薬でも\n成分がかぶっていれば知らせる',
     'yellow-real.png', 'B45309', [(0.05, 0.513, 0.29, 0.043, '重複する成分'), (0.035, 0.67, 0.93, 0.122, '家の薬')],
     '名前が違っても、同じ働きの薬に気づけます。'),
    ('薬を塗った肌に、使っていい？', '使っている薬との相性が、\n買う前にわかる', '飲み薬だけでなく、塗り薬や\n化粧品との組み合わせも確かめられる',
     'red-real.png', RED, [(0.035, 0.504, 0.42, 0.044, '店の商品'), (0.035, 0.796, 0.93, 0.094, '家の薬')],
     '使っている薬との相性も、買う前にわかります。'),
    ('薬と化粧品、どっちが先？', '薬や化粧品を使う順番や、\n詳しい使い方がわかる', '処方薬と化粧品を一緒に使う日も、\nどれから、どう塗ればいいか迷わない',
     'routine-crop.jpg', NAVY, [(0.018, 0.096, 0.13, 0.734, '塗る順番')],
     '塗る順番まで案内します。'),
]
PH = 6.3  # 画面の高さ
for i, (doubt, h3, sub, shot, sig, rings, note) in enumerate(CASES):
    iw = image(shot, 0, 0, h=PH)['w']
    items = [
        label(f'できること {i + 1}'),
        text(X0, 1.75, 7.5, line_h(22), f'「{doubt}」', 22, FAINT, bold=True),
        rect(X0, 2.45, 0.6, 0.05, NAVY, shape='rect'),
        text(X0, 2.75, 7.5, line_h(36, 1.0, 2), h3, 36, INK, bold=True),
        text(X0, 4.4, 7.5, line_h(20, 1.0, 2), sub, 20, MUTED),
        *phone(shot, X1 - 0.35 - iw, 0.6, PH, rings, sig)[0],
    ]
    if shot != 'routine-crop.jpg':  # 判定の画面にだけ、3色の意味を添える
        items += legend(X0, 6.45)
    SLIDES.append(dict(notes=note, items=items))


# 7〜8. 使い方（店で選ぶ・家で使うの2枚）
# やることが主役。右の列は、そのステップにぶら下がるもの（一回り小さくし、縦線を付ける）
DOT = 0.5


def benefits(*pairs):
    """うれしいこと（見出しと説明）。2つ並べるときは説明を1行にする。返り値は (要素, 高さ)"""
    def draw(x, y, w):
        out, yy = [], y
        for head, body in pairs:
            n = body.count('\n') + 1
            out += [text(x, yy + 0.06, w, line_h(22), head, 22, INK, bold=True),
                    text(x, yy + 0.53, w, line_h(18, 1.0, n), body, 18, MUTED)]
            yy += 0.53 + line_h(18, 1.0, n) + 0.16
        return out, yy - 0.16 - y
    return draw


def howto(tag, title, steps, notes, top=1.95, min_pitch=1.7, gap=0.3, bx=7.3):
    """左に番号つきの3段（やること）、右の列（bx から）にぶら下がるもの。段の高さは右の列に合わせて伸びる。
    right が None の段は、右の列を空けて縦線も引かない"""
    items = [label(tag, y=0.55), text(X0, 0.97, 11, line_h(30), title, 30, INK, bold=True)]
    tx = X0 + DOT + 0.3
    y, centers = top, []
    for i, (when, act, sub, right) in enumerate(steps):
        ritems, rh = right(bx + 0.3, y, X1 - bx - 0.3) if right else ([], 0)
        if right:
            items.append(rect(bx, y + 0.1, 0.05, max(1.2, rh), PALE, shape='rect'))
        items += [
            rect(X0, y + 0.02, DOT, DOT, NAVY, radius=DOT / 2, label=str(i + 1), size=18, color=WHITE),
            text(tx, y + 0.04, 3, line_h(17), when, 17, MUTED, bold=True),
            text(tx, y + 0.45, bx - tx - 0.2, line_h(28), act, 28, NAVY, bold=True),
            text(tx, y + 1.02, bx - tx - 0.2, line_h(17), sub, 17, MUTED),
            *ritems,
        ]
        centers.append(y + 0.02 + DOT / 2)
        y += max(min_pitch, max(1.36, rh) + gap)
    # 番号をつなぐ線（番号の丸より先に描く）
    items.insert(2, rect(X0 + DOT / 2 - 0.0125, centers[0], 0.025, centers[-1] - centers[0], PALE, shape='rect'))
    SLIDES.append(dict(notes=notes, items=items))


howto('使い方 1｜店で選ぶ', '家で一度登録すれば、店では撮るだけ。', [
    ('家で', '薬・化粧品を撮って登録', 'AIが成分表示を読み取る',
     benefits(('自分の体質も登録できる', '肌質や年代、悩みを登録すると、\n使い方の助言がパーソナライズされる'))),
    ('店で', '気になる商品を撮る', 'AIが家のものと照らし合わせる',
     benefits(('撮るだけで、すぐ確かめられる', '商品名の入力も検索もいらない\n店先で成分表示を1枚撮れば済む'))),
    ('その場で', '買うべきかの目安が出る', '3色の判定と、成分名つきの理由',
     benefits(('理由に根拠と出典を添える', '根拠の薄い推測は、最初から出さない\n表示された理由は、安心して読める'))),
], '家で一度登録すれば、店では撮るだけ。理由には出典を添えます。')

# 家で使う側。順番は剤形で決まり（lib/routine.ts）、AIが書くのは助言の言葉だけ。「AIが順番を決める」と書かないこと
# ①は右の列を空ける（ぶら下げるものが無い。体質は撮らずに設定から入れる）
# ③の「順番の理由」は lib/routine.ts の剤形ごとの説明、「コツ」はAIの一言、記録は服薬（朝・昼・夜、直近7日）
howto('使い方 2｜家で使う', '登録した薬と体質から、毎日の使い方がわかる。', [
    ('家で', '薬・化粧品と体質を登録', '薬・化粧品は撮るだけ、体質は設定から',
     None),
    ('アプリが', 'その人に合った使い方を考える', '順番は剤形で決め、助言はAIが書く',
     benefits(('悩みまで入れて、パーソナライズ', '体質・年代・性別のほかに、\n朝は手早く済ませたい、といった悩みも'))),
    ('毎日', '順番と使い方が表示される', 'その日に使うものが、使う順に並ぶ',
     benefits(('薬を使ったかをチェックで記録', '朝・昼・夜ごとに付けて、7日分を見返せる'),
              ('手順ごとに、使い方の説明が付く', 'その順番の理由と、使うときのコツがわかる'))),
], '登録した薬と体質から、毎日の使う順番と使い方も案内します。', min_pitch=1.5, gap=0.2)


# 8. 目指すこと（作り直す前の版の1枚。店頭の判定だけでなく、買う・塗る・飲むの全部で「重ねる前に確かめる」）
def pillar(x, head, sub, tag):
    return [
        rect(x, 3.05, 3.72, 2.75, CANVAS, radius=0.25),
        text(x + 0.4, 3.4, 3.1, line_h(26), head, 26, NAVY, bold=True),
        text(x + 0.4, 4.15, 3.1, line_h(18, 1.0, 2), sub, 18, MUTED),
        text(x + 0.4, 5.2, 3.1, line_h(14), tag, 14, BLUE, bold=True),
    ]


SLIDES.append(dict(notes='買い重ねる前に。塗り重ねる前に。一緒に飲む前に。', items=[
    label('Overlai が目指すこと', y=0.95, align='center'),
    text(0, 1.5, W, line_h(54), SLOGAN, 54, NAVY, bold=True, align='center'),
    *pillar(0.9, '買い重ねる前に', 'もう家にある？\n名前違いの同じ薬は？', '重複'),
    *pillar(4.81, '塗り重ねる前に', '一緒に使っていい？\nどれを先に塗る？', '組み合わせ・塗る順番'),
    *pillar(8.72, '一緒に飲む前に', '今飲んでいる薬と\n一緒で大丈夫？', '飲み合わせ'),
    text(0, 6.25, W, line_h(20), '肌の治療を続ける人も、家族の薬を買う人も、店頭で迷わない毎日へ。', 20, MUTED, bold=True, align='center'),
]))

# 9. 締め（作り直す前の版の1枚）
br, bw = brand(0, 2.3, 80)
for it in br:
    it['x'] += (W - bw) / 2
SLIDES.append(dict(notes='Overlai。' + SLOGAN, items=[
    text(0, 1.2, W, line_h(26), '店頭で撮るだけで、家の薬や化粧品と重ねて判定する。', 26, MUTED, align='center'),
    *br,
    text(0, 4.45, W, line_h(34), SLOGAN, 34, NAVY, bold=True, align='center'),
    text(0.9, 6.62, 9, line_h(15), '鈴鹿工業高等専門学校　' + TEAM, 15, MUTED),
    rect(11.28, 4.9, 1.4, 1.4, WHITE, radius=0.12, line=LINE),
    image('qr.png', 11.33, 4.95, h=1.3),
    text(10.98, 6.4, 2.0, line_h(14), '実機を試す', 14, MUTED, align='center'),
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


SHAPES = {'round': MSO_SHAPE.ROUNDED_RECTANGLE, 'rect': MSO_SHAPE.RECTANGLE, 'diag': MSO_SHAPE.ROUND_2_DIAG_RECTANGLE}
ALIGN = {'left': PP_ALIGN.LEFT, 'center': PP_ALIGN.CENTER, 'right': PP_ALIGN.RIGHT}


def build_pptx(path):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(W), Inches(H)
    for s in SLIDES:
        sl = prs.slides.add_slide(prs.slide_layouts[6])
        sl.background.fill.solid()
        sl.background.fill.fore_color.rgb = rgb(WHITE)
        for it in s['items']:
            x, y, w, h = (Inches(it[k]) for k in ('x', 'y', 'w', 'h'))
            if it['kind'] == 'rect':
                kind = it['shape'] if it['radius'] or it['shape'] == 'diag' else 'rect'
                shp = sl.shapes.add_shape(SHAPES[kind], x, y, w, h)
                if kind != 'rect':
                    shp.adjustments[0] = min(0.5, it['radius'] / min(it['w'], it['h']))
                if kind == 'diag':
                    shp.adjustments[1] = 0
                if it['fill']:
                    shp.fill.solid()
                    shp.fill.fore_color.rgb = rgb(it['fill'])
                else:
                    shp.fill.background()
                if it['line']:
                    shp.line.color.rgb = rgb(it['line'])
                    shp.line.width = Pt(it['line_w'])
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
                tf.word_wrap = False
                tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
                tf.vertical_anchor = MSO_ANCHOR.TOP
                for i, line in enumerate(it['body'].split('\n')):
                    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
                    p.alignment = ALIGN[it['align']]
                    p.line_spacing = it['spacing']
                    r = p.add_run()
                    r.text = line
                    set_font(r, it['size'], it['color'], it['bold'])
        sl.notes_slide.notes_text_frame.text = s['notes']
    prs.save(path)


# ── プレビューと確かめ ───────────────────────────────
def px(v):
    return round(v * DPI)


def render(i, s):
    img = Image.new('RGB', (px(W), px(H)), '#' + WHITE)
    d = ImageDraw.Draw(img)
    issues = []
    for it in s['items']:
        box = [px(it['x']), px(it['y']), px(it['x'] + it['w']), px(it['y'] + it['h'])]
        if it['x'] < -0.01 or it['y'] < -0.01 or it['x'] + it['w'] > W + 0.01 or it['y'] + it['h'] > H + 0.01:
            issues.append(f'スライドの外にはみ出し: {it.get("body") or it.get("label") or it.get("path") or it["kind"]}')
        if it['kind'] == 'rect':
            fill = ('#' + it['fill']) if it['fill'] else None
            outline = ('#' + it['line']) if it['line'] else None
            lw = max(1, round(it['line_w'] * DPI / 72)) if it['line'] else 0
            r = px(it['radius']) if it['shape'] != 'rect' else 0
            d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=lw)
            if it['shape'] == 'diag':  # 右上と左下は角を立てる
                d.rectangle([box[2] - r, box[1], box[2], box[1] + r], fill=fill)
                d.rectangle([box[0], box[3] - r, box[0] + r, box[3]], fill=fill)
            if it['label']:
                if it['size'] < MIN_PT:
                    issues.append(f'文字が小さい（{it["size"]}pt）: {it["label"]}')
                d.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), it['label'], font=font(it['size'], it['bold']),
                       fill='#' + it['color'], anchor='mm')
        elif it['kind'] == 'image':
            im = Image.open(A / it['path']).convert('RGBA').resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
            img.paste(im, box[:2], im)
        else:
            f = font(it['size'], it['bold'])
            if it['size'] < MIN_PT:
                issues.append(f'文字が小さい（{it["size"]}pt）: {it["body"][:16]}')
            pitch = it['size'] * LEAD * it['spacing'] * DPI / 72
            yy = box[1]
            for ln in it['body'].split('\n'):
                lw = f.getlength(ln)
                if lw > box[2] - box[0] + 2:
                    issues.append(f'横にはみ出し {(lw - box[2] + box[0]) / DPI:.2f}in: {ln[:16]}')
                xx = {'left': box[0], 'center': (box[0] + box[2] - lw) / 2, 'right': box[2] - lw}[it['align']]
                d.text((xx, yy + pitch * 0.12), ln, font=f, fill='#' + it['color'])
                yy += pitch
            if yy > box[3] + 2:
                issues.append(f'縦にはみ出し: {it["body"][:16]}')
    for msg in issues:
        print(f'  ! スライド{i + 1}: {msg}')
    return img


build_pptx(HERE / 'Overlai_本選ピッチ.pptx')
if HAVE_FONTS:
    pages = [render(i, s) for i, s in enumerate(SLIDES)]
    if PREVIEW_DIR:
        Path(PREVIEW_DIR).mkdir(parents=True, exist_ok=True)
        for i, pg in enumerate(pages):
            pg.save(Path(PREVIEW_DIR) / f'slide-{i + 1}.png')
    # 一覧（2列）
    tw, th, gap = px(W) // 2, px(H) // 2, 16
    rows = (len(pages) + 1) // 2
    sheet = Image.new('RGB', (2 * tw + 3 * gap, rows * th + (rows + 1) * gap), '#8A8F98')
    for i, pg in enumerate(pages):
        sheet.paste(pg.resize((tw, th), Image.LANCZOS), (gap + (i % 2) * (tw + gap), gap + (i // 2) * (th + gap)))
    sheet.save(HERE / 'preview.png')
else:
    print('Noto Sans JP の otf が無いのでプレビューは作りません（NOTO_DIR で場所を渡せる）')
total = sum(len(s['notes']) for s in SLIDES)
print(f'{len(SLIDES)}枚 / 台本 {total}字（約{total / 5:.0f}秒）')
