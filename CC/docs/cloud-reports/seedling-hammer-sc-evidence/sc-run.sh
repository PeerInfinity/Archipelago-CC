#!/bin/bash
# SCRATCH (seedling-hammer-sc D2): one workload in one lab mode, from the lab copy (SC_LAB=census|floorB, or base for
# the untouched floor). Writes $S/<tag>/<wl>.out (the driver's stdout), .jsonl (census records), .time (wall seconds +
# load at start). RE's drivers (g1-solve, d1-leg, ghost-sweep) and workload names.
#   sc-run.sh <mode> <workload>
#   workloads: A-sword A-ghost leg-<id>-<sword|ghost> l18 ghost-sweep campaign prod-<producer> killgate-<seed>
S=${S:-/tmp/claude-0/-home-user-Archipelago-CC/507826ac-12b4-5994-a664-5fe07cb34f34/scratchpad}
T=$S/tools
ROOT=${ROOT:-$S/lab}
mode=$1; wl=$2; tag=${TAG:-$mode}
mkdir -p "$S/$tag"
out="$S/$tag/$wl"
lab=""; [ "$mode" != base ] && lab=$mode
export SC_LAB=$lab SC_LAB_OUT="$out.jsonl" REPO=$ROOT
cd "$ROOT" || exit 2
VIEW=$ROOT/frontend/modules/seedlingDemo/fixtures/hammer-p1-l40-south-boot.json
l=$(cut -d" " -f1 /proc/loadavg); s=$(date +%s.%N)
case "$wl" in
  A-sword) node --import $T/sink.mjs $T/g1-solve.mjs --view=$VIEW --goal=collect:880,816 --ghost=0 ;;
  A-ghost) node --import $T/sink.mjs $T/g1-solve.mjs --view=$VIEW --goal=collect:880,816 --ghost=1 ;;
  leg-*-sword) id=${wl#leg-}; id=${id%-sword}
     node --import $T/sink.mjs $T/d1-leg.mjs --legs=$S/legs.jsonl --dump=$S/dump.json --ids=$id --ghost=0 --full ;;
  leg-*-ghost) id=${wl#leg-}; id=${id%-ghost}
     node --import $T/sink.mjs $T/d1-leg.mjs --legs=$S/legs.jsonl --dump=$S/dump.json --ids=$id --ghost=1 --full ;;
  l18) node --import $T/sink.mjs scripts/procgen/sweep-seedling-l18-residues.mjs --json ;;
  ghost-sweep) node --import $T/sink.mjs $T/ghost-sweep.mjs ;;
  prod-*) node --import $T/sink.mjs scripts/procgen/${wl#prod-}.mjs --check ;;
  killgate-*) node --import $T/sink.mjs scripts/procgen/census-seedling-killgate-clears.mjs --seeds=${wl#killgate-}-${wl#killgate-} ;;
  campaign) node --import $T/sink.mjs scripts/procgen/solve-seedling-r9-campaign.mjs --check ;;
  *) echo "unknown workload $wl" >&2; exit 2 ;;
esac > "$out.out" 2> "$out.err"
rc=$?
e=$(date +%s.%N)
echo "{\"mode\":\"$tag\",\"wl\":\"$wl\",\"rc\":$rc,\"load\":$l,\"wall\":$(python3 -c "print(round($e-$s,1))")}" | tee "$out.time"
