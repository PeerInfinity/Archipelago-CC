#!/bin/bash
cd /tmp/claude-0/c1
for mode in off chooser; do
  for id in 376 379 382 394 398; do
    E=""; [ $mode = chooser ] && E="SEEDLING_CHOOSER_HIT_SOURCES=1"
    s=$(date +%s.%N)
    out=$(env $E timeout 900 node inv-leg.mjs --legs=legs.jsonl --rows=sweep3/merged/rows.jsonl --dump=sweep3/merged/delivered-set.json --ids=$id 2>/dev/null)
    rc=$?
    e=$(date +%s.%N)
    echo "{\"mode\":\"$mode\",\"id\":$id,\"rc\":$rc,\"wall\":$(echo "$e - $s" | bc),\"row\":${out:-null}}" >> l40cost.jsonl
  done
done
