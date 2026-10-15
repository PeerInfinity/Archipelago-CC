#!/bin/bash
# SCRATCH (seedling-hammer-re D1): one workload in one lab mode, from the lab copy (RE_LAB=census|cut|lb|wall|lbwall,
# or base for the untouched code path). Writes $S/<mode>/<wl>.out (the driver's stdout), .jsonl (census records),
# .time (wall seconds + load at start). ROOT=<tree> runs another tree (the real one, for D3), defaulting to the lab.
#   lab-run.sh <mode> <workload>
#   workloads: A-sword A-ghost leg-<id>-<sword|ghost> leg381-mwbombs l18 ghost-sweep campaign
S=${S:-/tmp/claude-0/-home-user-Archipelago-CC/22cadb85-a67d-568f-8ad2-b972be0ae53c/scratchpad}
E=/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-hammer-re-evidence
ROOT=${ROOT:-$S/lab}
mode=$1; wl=$2; tag=${TAG:-$mode}
mkdir -p "$S/$tag"
out="$S/$tag/$wl"
lab=""; [ "$mode" != base ] && [ "$mode" != on ] && [ "$mode" != off ] && lab=$mode
export RE_LAB=$lab RE_LAB_OUT="$out.jsonl" REPO=$ROOT
cd "$ROOT" || exit 2
VIEW=$ROOT/frontend/modules/seedlingDemo/fixtures/hammer-p1-l40-south-boot.json
l=$(cut -d" " -f1 /proc/loadavg); s=$(date +%s.%N)
case "$wl" in
  A-sword) node --import $E/sink.mjs $E/g1-solve.mjs --view=$VIEW --goal=collect:880,816 --ghost=0 ;;
  A-ghost) node --import $E/sink.mjs $E/g1-solve.mjs --view=$VIEW --goal=collect:880,816 --ghost=1 ;;
  leg-*-sword) id=${wl#leg-}; id=${id%-sword}
     node --import $E/sink.mjs $E/d1-leg.mjs --legs=$S/legs.jsonl --dump=$S/dump.json --ids=$id --ghost=0 --full ;;
  leg-*-ghost) id=${wl#leg-}; id=${id%-ghost}
     node --import $E/sink.mjs $E/d1-leg.mjs --legs=$S/legs.jsonl --dump=$S/dump.json --ids=$id --ghost=1 --full ;;
  leg381-mwbombs) SEEDLING_MOVING_WAIT=1 SEEDLING_PRESS_KILL_BOMBS=1 node --import $E/sink.mjs $E/d1-leg.mjs \
     --legs=$S/legs.jsonl --dump=$S/dump.json --ids=381 --ghost=0 --full ;;
  l18) node --import $E/sink.mjs scripts/procgen/sweep-seedling-l18-residues.mjs --json ;;
  ghost-sweep) node --import $E/sink.mjs $E/ghost-sweep.mjs ;;
  campaign) node --import $E/sink.mjs scripts/procgen/solve-seedling-r9-campaign.mjs --check ;;
  *) echo "unknown workload $wl" >&2; exit 2 ;;
esac > "$out.out" 2> "$out.err"
rc=$?
e=$(date +%s.%N)
echo "{\"mode\":\"$tag\",\"wl\":\"$wl\",\"rc\":$rc,\"load\":$l,\"wall\":$(python3 -c "print(round($e-$s,1))")}" | tee "$out.time"
