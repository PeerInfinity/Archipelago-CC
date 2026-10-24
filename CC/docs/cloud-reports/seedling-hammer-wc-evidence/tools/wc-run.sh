#!/bin/bash
# SCRATCH (seedling-hammer-wc): one workload in one mode. SF2's sf2-run.sh, re-cut for WC.
#   wc-run.sh <mode> <workload>      (ROOT = the tree to run in; S = the scratchpad; TAG = the output dir name)
#   modes: off · on (STRIKE_ETA_FLOOR=1) · lab-off / lab-on (WC_LAB=1, the D1 lab) ·
#          coff / con (SEEDLING_STRIKE_WALK_CACHE=1, floor OFF / ON)
#   workloads: A-sword A-ghost leg-<id>-<sword|ghost> l18 ghost-sweep campaign prod-<producer> killgate-<seed> enemy
S=${S:-/tmp/claude-0/wc}
T=$S/tools
ROOT=${ROOT:-$S/lab}
mode=$1; wl=$2; tag=${TAG:-$mode}
mkdir -p "$S/runs/$tag"
out="$S/runs/$tag/$wl"
unset WC_LAB SEEDLING_STRIKE_ETA_FLOOR SEEDLING_STRIKE_WALK_CACHE
case "$mode" in
  off) ;;
  on) export SEEDLING_STRIKE_ETA_FLOOR=1 ;;
  lab-off) export WC_LAB=1 ;;
  lab-on) export WC_LAB=1 SEEDLING_STRIKE_ETA_FLOOR=1 ;;
  coff) export SEEDLING_STRIKE_WALK_CACHE=1 ;;
  con) export SEEDLING_STRIKE_WALK_CACHE=1 SEEDLING_STRIKE_ETA_FLOOR=1 ;;
  *) echo "unknown mode $mode" >&2; exit 2 ;;
esac
: > "$out.jsonl"
export WC_LAB_OUT="$out.jsonl" REPO=$ROOT
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
