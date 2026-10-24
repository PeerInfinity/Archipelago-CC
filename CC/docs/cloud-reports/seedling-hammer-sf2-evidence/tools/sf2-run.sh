#!/bin/bash
# SCRATCH (seedling-hammer-sf2): one workload in one mode. SC's sc-run.sh, re-cut for SF's switch.
#   sf-run.sh <mode> <workload>      (ROOT = the tree to run in; S = the scratchpad)
#   modes: census (the lab, SF_LAB=census, follows OFF) · off · on (STRIKE_ETA_FLOOR=1, the shipped shape)
#          · on-a / on-b / floor (lab knob SEEDLING_STRIKE_ETA_FLOOR_SHAPE, while the tree carries it)
#   workloads: A-sword A-ghost leg-<id>-<sword|ghost> l18 ghost-sweep campaign prod-<producer> killgate-<seed>
# Writes $S/<tag>/<wl>.out / .err / .jsonl (census records) / .time (wall seconds + load at start).
S=${S:-/tmp/claude-0/sf2}
T=$S/tools
ROOT=${ROOT:-$S/lab}
mode=$1; wl=$2; tag=${TAG:-$mode}
mkdir -p "$S/$tag"
out="$S/$tag/$wl"
unset SF_LAB SF_VARIANTS SF2_SHAPE SEEDLING_STRIKE_ETA_FLOOR SEEDLING_STRIKE_ETA_FLOOR_SHAPE
case "$mode" in
  census) export SF_LAB=census ;;
  off|base) ;;
  on) export SEEDLING_STRIKE_ETA_FLOOR=1 ;;
  on-*) export SEEDLING_STRIKE_ETA_FLOOR=1 SF2_SHAPE=${mode#on-} ;;
  lab-*) export SF_LAB=census SF_VARIANTS=${mode#lab-} ;;
  *) echo "unknown mode $mode" >&2; exit 2 ;;
esac
: > "$out.jsonl"
export SF_LAB_OUT="$out.jsonl" REPO=$ROOT NODE_OPTIONS="--import $T/sink.mjs"
cd "$ROOT" || exit 2
VIEW=$ROOT/frontend/modules/seedlingDemo/fixtures/hammer-p1-l40-south-boot.json
l=$(cut -d" " -f1 /proc/loadavg); s=$(date +%s.%N)
case "$wl" in
  A-sword) node $T/g1-solve.mjs --view=$VIEW --goal=collect:880,816 --ghost=0 --tape=$out.tape.json ;;
  A-ghost) node $T/g1-solve.mjs --view=$VIEW --goal=collect:880,816 --ghost=1 --tape=$out.tape.json ;;
  leg-*-sword) id=${wl#leg-}; id=${id%-sword}
     node $T/d1-leg.mjs --legs=$S/legs.jsonl --dump=$S/dump.json --ids=$id --ghost=0 --full ;;
  leg-*-ghost) id=${wl#leg-}; id=${id%-ghost}
     node $T/d1-leg.mjs --legs=$S/legs.jsonl --dump=$S/dump.json --ids=$id --ghost=1 --full ;;
  l18) node scripts/procgen/sweep-seedling-l18-residues.mjs --json ;;
  ghost-sweep) node $T/ghost-sweep.mjs ;;
  prod-*) node scripts/procgen/${wl#prod-}.mjs --check ;;
  killgate-*) node scripts/procgen/census-seedling-killgate-clears.mjs --seeds=${wl#killgate-}-${wl#killgate-} ;;
  campaign) node scripts/procgen/solve-seedling-r9-campaign.mjs --check ;;
  enemy) node scripts/procgen/census-seedling-enemies.mjs ;;
  *) echo "unknown workload $wl" >&2; exit 2 ;;
esac > "$out.out" 2> "$out.err"
rc=$?
e=$(date +%s.%N)
echo "{\"mode\":\"$tag\",\"wl\":\"$wl\",\"rc\":$rc,\"load\":$l,\"wall\":$(python3 -c "print(round($e-$s,1))")}" | tee "$out.time"
