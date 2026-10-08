#!/bin/sh
# Noto Sans JP（可変フォント・OFL）を public/fonts に取ってくる
cd "$(dirname "$0")" && mkdir -p public/fonts && \
  curl -sL -o public/fonts/NotoSansJP.ttf "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"
