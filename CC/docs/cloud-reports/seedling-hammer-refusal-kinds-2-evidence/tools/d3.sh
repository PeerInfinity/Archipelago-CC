#!/bin/bash
# d3.sh <out.jsonl> — 3 interleaved rounds: L18 and L40, v1 (the base worktree) and v2 (this tree), each unhooked and
# under the real tap at 100 ms (rkprobe.mjs). One line per run, tagged with the tree and the load average.
set -u
OUT="$1"; E=/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-hammer-refusal-kinds-2-evidence; : > "$OUT"
for round in 1 2 3; do
  for solve in "--tape=r9-solve-18 --goal=exit:176,112 --residue=21" "--tape=r5-l40-part5 --goal=collect:160,640"; do
    for tree in v1:/home/user/rk-base v2:/home/user/Archipelago-CC; do
      for iv in none 100; do
        load=$(cut -d' ' -f1 /proc/loadavg)
        line=$(REPO=${tree#*:} node $E/tools/rkprobe.mjs $solve --interval=$iv)
        echo "{\"round\":$round,\"tree\":\"${tree%%:*}\",\"load\":$load,\"run\":$line}" >> "$OUT"
      done
    done
  done
done
