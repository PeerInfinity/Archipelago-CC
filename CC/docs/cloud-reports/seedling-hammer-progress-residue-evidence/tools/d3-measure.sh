#!/bin/bash
# d3-measure.sh <outdir> — PR D3's rows at the D3 code: rkprobe (L18 / L40, unhooked and under the real tap at 100 ms),
# the v1 projections (frame / caches / churn dropped), and each solve's caches + churn (XC OFF, then L18 with XC ON).
set -u
O="$1"; R=/home/user/Archipelago-CC; E=$R/CC/docs/cloud-reports/seedling-hammer-progress-residue-evidence
cd "$R" || exit 1
: > "$O/rkprobe-d3.jsonl"
for solve in "--tape=r9-solve-18 --goal=exit:176,112 --residue=21" "--tape=r5-l40-part5 --goal=collect:160,640"; do
  for iv in none 100; do node $E/tools/rkprobe.mjs $solve --interval=$iv >> "$O/rkprobe-d3.jsonl" 2>&1; done
done
node $E/tools/v1proj.mjs > "$O/v1proj-d3.jsonl" 2>&1
node $E/tools/d3-caches.mjs > "$O/caches-d3.jsonl" 2>&1
node $E/tools/d3-caches.mjs L18 --xc >> "$O/caches-d3.jsonl" 2>&1
echo finished > "$O/d3-measure-done.txt"
