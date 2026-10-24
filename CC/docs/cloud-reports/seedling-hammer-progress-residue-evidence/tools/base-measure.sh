#!/bin/bash
# base-measure.sh <outdir> <tag> — the runtime census (RK2's census.sh, every rejection the tree tallies over the six
# producers' --check and the four probe solves), the v1 projections and the rkprobe rows of L18 / L40 (unhooked and
# under the real tap at 100 ms). Measure only.
set -u
O="$1"; T="$2"; R=/home/user/Archipelago-CC; E=$R/CC/docs/cloud-reports/seedling-hammer-progress-residue-evidence
cd "$R" || exit 1
bash $E/tools/census.sh "$O/census-raw-$T.jsonl" > "$O/census-md5s-$T.txt" 2>&1
node $E/tools/census-classify.mjs "$O/census-raw-$T.jsonl" "$R/frontend/modules/seedlingDemo/solveProgress.js" > "$O/census-kinds-$T.txt" 2>&1
node $E/tools/v1proj.mjs > "$O/v1proj-$T.jsonl" 2>&1
: > "$O/rkprobe-$T.jsonl"
for solve in "--tape=r9-solve-18 --goal=exit:176,112 --residue=21" "--tape=r5-l40-part5 --goal=collect:160,640"; do
  for iv in none 100; do node $E/tools/rkprobe.mjs $solve --interval=$iv >> "$O/rkprobe-$T.jsonl" 2>&1; done
done
echo finished > "$O/base-measure-done-$T.txt"
