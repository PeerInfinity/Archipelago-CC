#!/bin/bash
# usage: legs-run.sh <out.jsonl> <ids...>; each (leg, MOVING_WAIT 0|1) its own process; env REPO, PAR, CAP, EXTRA (env assignments)
S=/tmp/claude-0/-home-user-Archipelago-CC/b5b1f0ed-6a24-5130-a3b0-645912f108c0/scratchpad; out=$1; shift
for id in "$@"; do for mw in ${MWS:-0 1}; do echo "$id $mw"; done; done | xargs -P ${PAR:-2} -n 2 sh -c '
  s=$(date +%s.%N)
  row=$(env SEEDLING_MOVING_WAIT=$1 '"$EXTRA"' timeout ${CAP:-900} node '"$S"'/bw-leg.mjs --legs='"$S"'/legs.jsonl --dump='"$S"'/dump.json --ids=$0 --ghost=0 --trace='"$S"'/trace-'"${TAG:-x}"'-$0-$1.json 2>/dev/null); rc=$?
  e=$(date +%s.%N)
  echo "{\"id\":$0,\"mw\":$1,\"rc\":$rc,\"wall\":$(echo "$e - $s" | bc),\"row\":${row:-null}}" >> '"$out"'
'
echo done >> $out.done
