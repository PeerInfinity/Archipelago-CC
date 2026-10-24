#!/bin/bash
# usage: d1-run.sh <out.jsonl> <ids...>; each (leg, variant) its own process, 900 s cap, $PAR at a time
S=${S:?scratchpad}; E=$(dirname "$0"); out=$1; shift
for id in "$@"; do for g in 0 1; do echo "$id $g"; done; done | xargs -P ${PAR:-3} -n 2 sh -c '
  s=$(date +%s.%N); l=$(cut -d" " -f1 /proc/loadavg)
  row=$(timeout ${CAP:-900} node '"$E"'/d1-leg.mjs --legs='"$S"'/legs.jsonl --dump='"$S"'/dump.json --ids=$0 --ghost=$1 ${SAVE:+--save=$SAVE} 2>/dev/null); rc=$?
  e=$(date +%s.%N)
  echo "{\"id\":$0,\"ghost\":$1,\"rc\":$rc,\"load\":$l,\"wall\":$(echo "$e - $s" | bc),\"row\":${row:-null}}" >> '"$out"'
'
echo done >> $out.done
