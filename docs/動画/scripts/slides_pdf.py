"""out/slides/ の PNG（Slides の1フレーム＝1枚）を1つの PDF にまとめる。

  npm run slides   … 書き出しからまとめまで一度にやる
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent.parent
OUT = HERE.parent / 'ピッチ' / '動画版' / 'Overlai_1分ピッチ_動画版.pdf'

pages = [Image.open(p).convert('RGB') for p in sorted((HERE / 'out' / 'slides').glob('*.png'))]
OUT.parent.mkdir(parents=True, exist_ok=True)
pages[0].save(OUT, save_all=True, append_images=pages[1:], resolution=144)
print(f'{len(pages)}枚 → {OUT}')
