#!/bin/bash
# D4.1 matrix: mode -> legs + survey 31 + the L62 staging. Usage: matrix.sh <mode> (off|chooser|static|both|order)
cd /tmp/claude-0/c1
mode=$1
env -u SEEDLING_CHOOSER_HIT_SOURCES -u SEEDLING_STATIC_SWORD_ARM -u SEEDLING_CHOOSER_HIT_SOURCES_MODE true
E=""
case $mode in
  off) E="";;
  chooser) E="SEEDLING_CHOOSER_HIT_SOURCES=1";;
  order) E="SEEDLING_CHOOSER_HIT_SOURCES=1 SEEDLING_CHOOSER_HIT_SOURCES_MODE=order";;
  static) E="SEEDLING_STATIC_SWORD_ARM=1";;
  both) E="SEEDLING_CHOOSER_HIT_SOURCES=1 SEEDLING_STATIC_SWORD_ARM=1";;
esac
env $E node inv-leg.mjs --legs=legs.jsonl --rows=sweep3/merged/rows.jsonl --dump=sweep3/merged/delivered-set.json --ids=76,85,539,544,549,550,551,552,553 > m-$mode-legs.jsonl 2> m-$mode-legs.err
env $E node view-solve.mjs --view=/home/user/Archipelago-CC/.cache/seedling-survey/through-end/views/step-31-boot.json --goal="collect:64,48;exit:32,128" --json=m-$mode-s31.json > /dev/null 2>&1
env $E node view-solve.mjs --view=step-113-boot.json --at=240,288 --goal=exit:96,304 --json=m-$mode-t551.json > /dev/null 2>&1
echo done > m-$mode.done
