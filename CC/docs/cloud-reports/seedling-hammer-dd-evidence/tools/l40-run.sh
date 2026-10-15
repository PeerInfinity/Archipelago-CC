#!/bin/bash
# SCRATCH (seedling-hammer-dd): the L40 table (G1's d1-leg.mjs), each (leg, ghost 0|1) its own process.
#   ROOT=<tree> TAG=<name> [EXTRA="ENV=1 ..."] PAR=2 CAP=900 l40-run.sh <ids...>
# Writes $S/l40/<TAG>.jsonl (one row per run) and DD census rows to $S/l40/<TAG>-census.jsonl.
S=/tmp/claude-0/-home-user-Archipelago-CC/f67fa899-7a7b-532f-82e5-bb4433913e4b/scratchpad
out=$S/l40/$TAG.jsonl
for id in "$@"; do for g in 0 1; do echo "$id $g"; done; done | xargs -P ${PAR:-2} -n 2 sh -c '
  s=$(date +%s.%N)
  row=$(cd '"$ROOT"' && env REPO='"$ROOT"' DD_CENSUS_FILE='"$S"'/l40/'"$TAG"'-census.jsonl '"$EXTRA"' timeout ${CAP:-900} node '"$S"'/tools/d1-leg.mjs --legs='"$S"'/l40/legs.jsonl --dump='"$S"'/l40/dump.json --ids=$0 --ghost=$1 2>/dev/null); rc=$?
  e=$(date +%s.%N)
  echo "{\"id\":$0,\"ghost\":$1,\"rc\":$rc,\"wall\":$(echo "$e - $s" | bc),\"row\":${row:-null}}" >> '"$out"'
'
echo done >> $out.done
