#!/bin/bash
# Copy decoded real assets into the webapp public dir.
set -e
cd /work/nds
D=assets/launcher/decoded
cp -f $D/bg/*.png webapp/public/bg/ 2>/dev/null || true
cp -f $D/font/TBF1_*.png $D/font/TBF1_*.json webapp/public/font/ 2>/dev/null || true
cp -f $D/text/*.json webapp/public/text/ 2>/dev/null || true
if [ -d "$D/sprites" ]; then
  for layout in $D/sprites/*/; do
    name=$(basename "$layout")
    mkdir -p webapp/public/sprites/$name
    cp -f "$layout"*.png webapp/public/sprites/$name/ 2>/dev/null || true
  done
  cp -f $D/sprites/sprites.json webapp/public/sprites/ 2>/dev/null || true
fi
echo "integrated assets"
