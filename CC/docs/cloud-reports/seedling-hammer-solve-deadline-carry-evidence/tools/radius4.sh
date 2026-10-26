#!/usr/bin/env bash
# SCRATCH (SDC, from FF-HARNESS's radius.sh): every captured request at its OWN seam in 4 arms — base/fix (solverBot.js
# swapped by a loader hook) x OFF/ON (SEEDLING_HAMMER_FIGHT_FALLBACK=1) — one fresh process per cell, one file per cell.
# Usage: radius4.sh <ff-solve.mjs> <base-register.mjs> <requests.jsonl> <outdir> [jobs=3]
tool=$1; reg=$2; req=$3; out=$4; jobs=${5:-3}; mkdir -p "$out"
python3 -c "
import json
for l in open('$req'):
    if not l.strip(): continue
    d=json.loads(l)
    for q in d['requests']: print(f\"{d['id']}:{q['i']}\")" > "$out/cells.txt"
{ while read c; do for a in baseoff baseon fixoff fixon; do echo "$a:$c"; done; done < "$out/cells.txt"; } | xargs -P "$jobs" -I{} sh -c '
  arm=$(echo $1 | cut -d: -f1); id=$(echo $1 | cut -d: -f2); i=$(echo $1 | cut -d: -f3); o="$3/$arm-$id-$i.json"
  [ -s "$o" ] && exit 0
  case $arm in *on) e=SEEDLING_HAMMER_FIGHT_FALLBACK=1;; *) e=FF_NOOP=1;; esac
  case $arm in base*) imp="--import $5";; *) imp="";; esac
  env $e node $imp "$2" --requests="$4" --id=$id --i=$i 2>/dev/null | grep "^RESULT " | cut -c8- > "$o.tmp" && mv "$o.tmp" "$o"
' _ {} "$tool" "$out" "$req" "$reg"
