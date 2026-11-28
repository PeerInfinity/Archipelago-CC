#!/bin/bash
# MEASUREMENT-ONLY: each fixture under one variant (env), one JSON line.
cd /home/user/Archipelago-CC || exit 1
v=$1; shift
case $v in
  off) e="";;
  mine) e="SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1";;
  pksw) e="SEEDLING_PRESS_KILL_START_WAIT=1";;
  pksw_mine) e="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1";;
esac
while read -r f; do env $e VARIANT=$v timeout 900 node "$S/fxsolve.mjs" "$f" 2>/dev/null | tail -1; done < "$S/fixtures.txt"
