#!/bin/bash
# census.sh <out.jsonl> — every rejection the tree tallies, verbatim, over the committed solves: the six producers'
# --check and the four probe solves (L18 residue 21, L40 part 5, L6, L3), under census-preload.mjs.
set -u
R=/home/user/Archipelago-CC; E=$R/CC/docs/cloud-reports/seedling-hammer-refusal-kinds-evidence; OUT="$1"
cd "$R"; : > "$OUT"
P="--import=$E/tools/census-preload.mjs"
for p in solve-seedling-r8-battery solve-seedling-r8-d2-chain solve-seedling-r8-l18 solve-seedling-r8-tail \
         solve-seedling-r9-l3 solve-seedling-r9-campaign; do
  RK_CENSUS_OUT="$OUT" node $P scripts/procgen/$p.mjs --check 2>&1 | md5sum | sed "s#-#$p#"
done
RK_CENSUS_OUT="$OUT" node $P $E/tools/rkprobe.mjs --tape=r9-solve-18 --goal=exit:176,112 --residue=21 --interval=none
RK_CENSUS_OUT="$OUT" node $P $E/tools/rkprobe.mjs --tape=r5-l40-part5 --goal=collect:160,640 --interval=none
RK_CENSUS_OUT="$OUT" node $P $E/tools/rkprobe.mjs --tape=r8-solve-6 --goal=exit:224,32 --interval=none
RK_CENSUS_OUT="$OUT" node $P $E/tools/rkprobe.mjs --tape=r8-solve-3 --goal=exit:128,48 --interval=none
