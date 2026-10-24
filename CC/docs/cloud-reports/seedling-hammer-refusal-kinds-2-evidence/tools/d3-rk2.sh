#!/bin/bash
# d3-rk2.sh <out.jsonl> — RK's d3.sh with RK2's two trees: `base` (origin/main at W0, RK's v2) and `rk2` (this slice's
# code, in the dev worktree). 3 interleaved rounds; L18 and L40; each unhooked and under the real tap at 100 ms.
set -u
OUT="$1"; E=/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-hammer-refusal-kinds-2-evidence; : > "$OUT"
BASE="${RK2_BASE:-/home/user/Archipelago-CC}"; RK2="${RK2_TREE:-/home/user/rk2-wt}"
for round in 1 2 3; do
  for solve in "--tape=r9-solve-18 --goal=exit:176,112 --residue=21" "--tape=r5-l40-part5 --goal=collect:160,640"; do
    for tree in base:$BASE rk2:$RK2; do
      for iv in none 100; do
        load=$(cut -d' ' -f1 /proc/loadavg)
        line=$(REPO=${tree#*:} node $E/tools/rkprobe.mjs $solve --interval=$iv)
        echo "{\"round\":$round,\"tree\":\"${tree%%:*}\",\"load\":$load,\"run\":$line}" >> "$OUT"
      done
    done
  done
done
