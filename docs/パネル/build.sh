#!/bin/sh
# ブースパネル（A4縦）を PDF とプレビューPNGに書き出す。A1 への拡大は運営が行う。
set -e
cd "$(dirname "$0")"
python3 - <<'PY'
from pathlib import Path
t = Path('panel.tpl.html').read_text()
qr = Path('../概要書/qr.svg').read_text()
Path('panel.html').write_text(t.replace('{{QR}}', qr))
PY
CHROME="$HOME/.cache/puppeteer/chrome/mac_arm-148.0.7778.97/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
"$CHROME" --headless --disable-gpu --no-pdf-header-footer --allow-file-access-from-files \
  --print-to-pdf="$PWD/Overlai_ブースパネル.pdf" "file://$PWD/panel.html" 2>/dev/null
"$CHROME" --headless --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --window-size=794,1123 --force-device-scale-factor=2 \
  --screenshot="$PWD/preview.png" "file://$PWD/panel.html" 2>/dev/null
echo "書き出し: Overlai_ブースパネル.pdf / preview.png"
