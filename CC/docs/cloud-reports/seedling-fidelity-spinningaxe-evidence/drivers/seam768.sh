#!/bin/bash
# leg 768 solved in node at seamTime 5497..5517, OFF and ON; one JSON row per (seam, switch)
S=/tmp/claude-0/sa; D=$S/sweep/merged; out=$S/seam768.jsonl; : > $out
for st in $(seq 5497 5517); do
  for sw in 0 1; do
    r=$(SEEDLING_SPINNING_AXE_PLAYER_HIT=$sw SEAM_TIME=$st TAPE_OUT=$S/seam768/tape-$st-$sw.json timeout 400 node $S/drv/leg.mjs --legs=$S/legs.jsonl --rows=$D/rows.jsonl --dump=$D/delivered-set.json --id=768 2>/dev/null)
    echo "{\"seam\":$st,\"axe\":$sw,\"r\":${r:-null}}" >> $out
  done
done
