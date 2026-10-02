"""エピソードのスライドに置く、人物のイラストと考え事の吹き出しを描いて PNG にする。

素材サイトの画像は使わない。色は紺と灰色（パネルの「重なり」の図と同じ2色）にそろえ、
判定の3色（青・黄・赤）はここでは使わない。

  python3 docs/ピッチ/illust/make.py   → docs/ピッチ/assets/ に cloud.png・people-1.png・people-2.png
"""
import math
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
ASSETS = HERE.parent / 'assets'
CHROME = (Path.home() / '.cache/puppeteer/chrome/mac_arm-148.0.7778.97/chrome-mac-arm64'
          / 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
INK = '#1B2A4A'
MIST, LIGHT, MID = '#F2F4F7', '#E4E7EC', '#BCC3CE'


def cloud(fill, w=900, h=440):
    cx, cy, rx, ry = 425, 195, 350, 140
    circles = []
    n = 16
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 88 if i % 2 == 0 else 72
        circles.append((cx + rx * math.cos(a), cy + ry * math.sin(a), r))
    tail = [(800, 368, 24), (842, 402, 15), (868, 426, 9)]
    sw = 7
    l1 = ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}" stroke="{INK}" stroke-width="{sw*2}"/>' for x, y, r in circles)
    l2 = ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}"/>' for x, y, r in circles)
    core = f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}"/>'
    t = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{INK}" stroke-width="{sw}"/>' for x, y, r in tail)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -50 {w+40} {h+60}">{l1}{l2}{core}{t}</svg>'


def person(ox, shirt, hair, variant=0):
    """迷っている人（上半身）。ox はずらす量"""
    g = f'<g transform="translate({ox},0)" stroke="{INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">'
    g += f'<path d="M28 250 C28 196 60 172 100 172 C140 172 172 196 172 250 Z" fill="{shirt}"/>'
    g += '<path d="M84 172 L100 192 L116 172" fill="none"/>'
    g += '<circle cx="100" cy="108" r="58" fill="#FDE7D3"/>'
    if variant == 0:
        g += f'<path d="M42 110 C36 56 70 40 100 40 C134 40 166 58 158 110 C150 84 128 74 106 76 C98 88 80 92 60 90 C52 96 46 102 42 110 Z" fill="{hair}"/>'
    else:
        g += f'<path d="M42 112 C38 58 68 40 100 40 C132 40 164 58 158 112 C154 92 144 80 128 76 C118 86 96 90 76 84 C62 88 50 98 42 112 Z" fill="{hair}"/>'
    g += f'<circle cx="80" cy="116" r="5.5" fill="{INK}" stroke="none"/><circle cx="120" cy="116" r="5.5" fill="{INK}" stroke="none"/>'
    g += '<path d="M68 99 Q79 93 90 100" fill="none" stroke-width="5"/><path d="M110 97 Q121 90 132 94" fill="none" stroke-width="5"/>'
    g += '<path d="M88 142 Q94 137 100 142 Q106 147 112 142" fill="none" stroke-width="5"/>'
    g += '<ellipse cx="68" cy="132" rx="9" ry="5.5" fill="#F6B8A8" stroke="none" opacity=".8"/><ellipse cx="132" cy="132" rx="9" ry="5.5" fill="#F6B8A8" stroke="none" opacity=".8"/>'
    g += f'<path d="M166 62 C174 76 176 86 166 90 C156 86 158 76 166 62 Z" fill="{LIGHT}" stroke-width="4"/>'
    g += '</g>'
    return g


def people(specs, w):
    body = ''.join(person(ox, s, h, v) for ox, s, h, v in specs)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 30 {w} 226">{body}</svg>'


# エピソード1は井上（重複）、エピソード2は濱田・杉本（組み合わせ）。パネルの「できること」と同じ順
ART = {
    'cloud': (cloud(MIST), 1840, 920),
    'people-1': (people([(0, MID, '#3A3030', 0)], 202), 808, 904),
    'people-2': (people([(0, MID, '#5B4636', 0), (170, LIGHT, '#2B2B35', 1)], 372), 1488, 904),
}

with tempfile.TemporaryDirectory() as tmp:
    for name, (svg, w, h) in ART.items():
        page = Path(tmp) / f'{name}.html'
        page.write_text(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width=\"{w}\" height=\"{h}\" ", 1)}</body></html>')
        subprocess.run([str(CHROME), '--headless', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                        f'--window-size={w},{h}', f'--screenshot={ASSETS / (name + ".png")}', page.as_uri()],
                       check=True, capture_output=True)
        print('書き出し:', ASSETS / (name + '.png'))
