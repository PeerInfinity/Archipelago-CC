#!/bin/bash
# SCRATCH (seedling-hammer-cross-pass-cache): one workload in one mode.
#   run.sh <mode> <workload>   ROOT = tree; TAG = output dir; LAB=1 writes the D1 lab's records
#   modes: off | on (STRIKE_ETA_FLOOR=1) | coff | con (SEEDLING_ESCAPE_CROSS_PASS_CACHE=1, floor OFF / ON)
#   workloads: l18 A-sword A-ghost prod-<producer> killgate-<seed> campaign progress-<tape>
S=/tmp/claude-0/-home-user-Archipelago-CC/2f4d6e0e-1690-55e4-985b-1d7061ddd905/scratchpad
T=$S/tools
ROOT=${ROOT:-/home/user/Archipelago-CC}
mode=$1; wl=$2; tag=${TAG:-$mode}
mkdir -p "$S/runs/$tag"
out="$S/runs/$tag/$wl"
unset SEEDLING_STRIKE_ETA_FLOOR SEEDLING_ESCAPE_CROSS_PASS_CACHE SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY EX_LAB_OUT
case "$mode" in
  off) ;;
  on) export SEEDLING_STRIKE_ETA_FLOOR=1 ;;
  coff) export SEEDLING_ESCAPE_CROSS_PASS_CACHE=1 ;;
  con) export SEEDLING_ESCAPE_CROSS_PASS_CACHE=1 SEEDLING_STRIKE_ETA_FLOOR=1 ;;
  voff) export SEEDLING_ESCAPE_CROSS_PASS_CACHE=1 SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1 ;;
  von) export SEEDLING_ESCAPE_CROSS_PASS_CACHE=1 SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1 SEEDLING_STRIKE_ETA_FLOOR=1 ;;
  *) echo "unknown mode $mode" >&2; exit 2 ;;
esac
if [ -n "$LAB" ]; then : > "$out.jsonl"; export EX_LAB_OUT="$out.jsonl"; fi
export REPO=$ROOT
cd "$ROOT" || exit 2
VIEW=$ROOT/frontend/modules/seedlingDemo/fixtures/hammer-p1-l40-south-boot.json
l=$(cut -d" " -f1 /proc/loadavg); s=$(date +%s.%N)
case "$wl" in
  A-sword) node $T/g1-solve.mjs --view=$VIEW --goal=collect:880,816 --ghost=0 --tape=$out.tape.json ;;
  A-ghost) node $T/g1-solve.mjs --view=$VIEW --goal=collect:880,816 --ghost=1 --tape=$out.tape.json ;;
  l18) node scripts/procgen/sweep-seedling-l18-residues.mjs --json ;;
  prod-*) node scripts/procgen/${wl#prod-}.mjs --check ;;
  killgate-*) node scripts/procgen/census-seedling-killgate-clears.mjs --seeds=${wl#killgate-}-${wl#killgate-} ;;
  campaign) node scripts/procgen/solve-seedling-r9-campaign.mjs --check ;;
  p18) node scripts/procgen/probe-seedling-solve-progress.mjs --tape=r9-solve-18 --goal=exit:176,112 --residue=21 --deadline=never --every=100000 ;;
  p40) node scripts/procgen/probe-seedling-solve-progress.mjs --tape=r5-l40-part5 --goal=collect:160,640 --deadline=never --every=100000 ;;
  *) echo "unknown workload $wl" >&2; exit 2 ;;
esac > "$out.out" 2> "$out.err"
rc=$?
e=$(date +%s.%N)
echo "{\"mode\":\"$tag\",\"wl\":\"$wl\",\"rc\":$rc,\"load\":$l,\"wall\":$(python3 -c "print(round($e-$s,1))")}" | tee "$out.time"
