"""1分ピッチの挿絵（薬箱・ドラッグストアの棚）を描く。

make.py の人物と同じタッチ（紺の太い線＋淡いフラット塗り）にそろえる。素材サイトの画像は使わない。
SVG を書き、PNG への変換は props.mjs（sharp）で行う。

  python3 docs/ピッチ/illust/props.py
  node docs/ピッチ/illust/props.mjs
"""
from pathlib import Path

HERE = Path(__file__).parent
INK = '#1B2A4A'
SW = 6  # 線の太さ（make.py の人物と同じ）


def question(x, y, s=1.0, rot=0):
    """はてなマーク。文字ではなく線で描く（変換時のフォント依存を避ける）"""
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})" fill="none" stroke="{INK}" '
            f'stroke-width="9" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="M-16 -22 C-16 -46 18 -46 18 -24 C18 -8 0 -6 0 10"/>'
            f'<circle cx="0" cy="30" r="3" fill="{INK}"/></g>')


def medbox():
    """家の薬箱。中身が思い出せない（はてなが浮かぶ）"""
    cross = 'M182 172 h36 v30 h30 v36 h-30 v30 h-36 v-30 h-30 v-36 h30 Z'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 -40 400 360">
  <g stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M150 78 C150 36 250 36 250 78" fill="none" stroke-width="16"/>
    <path d="M150 78 C150 36 250 36 250 78" fill="none" stroke="#E2E8F0" stroke-width="5"/>
    <rect x="60" y="110" width="280" height="190" rx="16" fill="#FFFFFF"/>
    <rect x="52" y="76" width="296" height="60" rx="14" fill="#BFDBFE"/>
    <path d="{cross}" fill="#93C5FD"/>
  </g>
  {question(330, 20, 1.0, 12)}
  {question(378, 92, 0.75, 20)}
  {question(76, 4, 0.8, -14)}
</svg>'''


def shelf():
    """ドラッグストアの棚。似た箱やボトルがずらりと並ぶ"""
    colors = ['#93C5FD', '#FDBA74', '#BFDBFE', '#FDE7D3', '#F6B8A8', '#E2E8F0']
    items = []
    tiers = [(130, 0), (250, 2), (370, 4)]  # 段の底の y と、色の始まり
    pattern = [('box', 54, 78), ('bottle', 40, 88), ('box', 62, 64), ('box', 48, 84), ('bottle', 40, 76),
               ('box', 58, 70), ('bottle', 42, 90), ('box', 50, 74)]
    left, right = 48, 492
    gap = (right - left - sum(w for _, w, _ in pattern)) / (len(pattern) - 1)  # 棚の幅いっぱいに並べる
    for floor, c0 in tiers:
        x, k = left, c0
        for kind, w, h in pattern:
            fill = colors[k % len(colors)]
            y = floor - h
            if kind == 'box':
                items.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}"/>')
                items.append(f'<line x1="{x + 10}" y1="{y + h * 0.35:.0f}" x2="{x + w - 10}" y2="{y + h * 0.35:.0f}" stroke-width="4"/>')
            else:
                items.append(f'<rect x="{x + 12}" y="{y}" width="{w - 24}" height="14" rx="4" fill="{INK}"/>')
                items.append(f'<rect x="{x}" y="{y + 12}" width="{w}" height="{h - 12}" rx="12" fill="{fill}"/>')
            x += w + gap
            k += 1
    body = ''.join(items)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 400">
  <g stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round" stroke-linecap="round">
    <rect x="22" y="22" width="496" height="356" rx="12" fill="#F5F7FA"/>
    {body}
    <line x1="22" y1="133" x2="518" y2="133"/>
    <line x1="22" y1="253" x2="518" y2="253"/>
  </g>
</svg>'''


(HERE / 'medbox.svg').write_text(medbox(), encoding='utf-8')
(HERE / 'shelf.svg').write_text(shelf(), encoding='utf-8')
print('medbox.svg / shelf.svg を書きました')
