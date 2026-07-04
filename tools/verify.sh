#!/bin/bash
# Full verification + per-region gap analysis.
set -e
cd /work/nds
node tools/verify.js > compare/verify.log 2>&1 || true
# per-pixel / per-region gap analysis for the idle menu (both screens)
{
  node tools/pixdiff.js assets/reference/idle.top.png compare/shots/menu_idle.top.png top menu_idle 2>&1 || true
  node tools/pixdiff.js assets/reference/idle.bot.png compare/shots/menu_idle.bot.png bot menu_idle 2>&1 || true
} > compare/gaps.txt 2>&1
# labeled side-by-side (real | clone) for the idle menu
T=compare/deliver/_t; mkdir -p $T compare/deliver
if [ -f compare/shots/menu_idle.bot.png ]; then
  convert assets/reference/idle.top.png assets/reference/idle.bot.png -append $T/r.png
  convert compare/shots/menu_idle.top.png compare/shots/menu_idle.bot.png -append $T/c.png
  montage -label 'melonDS (real)' $T/r.png -label 'Web clone' $T/c.png -tile 2x1 -geometry +10+6 \
    -background '#16161a' -fill '#ddd' -pointsize 20 -filter point compare/deliver/compare_idle.png 2>/dev/null || true
  rm -rf $T
fi
echo "=== gap report ==="; cat compare/gaps.txt
# settings coverage
node tools/capsettings.mjs > /dev/null 2>&1 || true
if [ -f compare/settings/pg1.bottom.png ]; then
  ST=$(node tools/pixdiff.js out/settings/pg1.top.ppm compare/settings/pg1.top.png top set_pg1 2>/dev/null | grep -oE '[0-9]+\.[0-9]+%' | head -1)
  SB=$(node tools/pixdiff.js out/settings/pg1.bot.ppm compare/settings/pg1.bottom.png bot set_pg1 2>/dev/null | grep -oE '[0-9]+\.[0-9]+%' | head -1)
  echo "settings_pg1: top diff ${ST} bot diff ${SB}" >> compare/STATUS.txt
fi
