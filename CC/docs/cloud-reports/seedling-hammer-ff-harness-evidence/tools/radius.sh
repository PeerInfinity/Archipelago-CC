#!/usr/bin/env bash
# SCRATCH (FF): every captured request at its OWN seam, default vs SEEDLING_HAMMER_FIGHT_FALLBACK=1, one fresh
# process per (request, arm), one file per cell. Usage: radius.sh <requests.jsonl> <outdir> [jobs=3]
S=$(cd "$(dirname "$0")/.." && pwd); req=$1; out=$2; jobs=${3:-3}; mkdir -p "$out"
python3 -c "
import json,sys
for l in open('$req'):
    if not l.strip(): continue
    d=json.loads(l)
    for q in d['requests']: print(f\"{d['id']}:{q['i']}\")" > "$out/cells.txt"
{ while read c; do echo "dflt:$c"; echo "ff:$c"; done < "$out/cells.txt"; } | xargs -P "$jobs" -I{} sh -c '
  arm=$(echo $1 | cut -d: -f1); id=$(echo $1 | cut -d: -f2); i=$(echo $1 | cut -d: -f3); o="$3/$arm-$id-$i.json"
  [ -s "$o" ] && exit 0
  if [ $arm = ff ]; then e=SEEDLING_HAMMER_FIGHT_FALLBACK=1; else e=FF_NOOP=1; fi
  env $e node "$2/tools/ff-solve.mjs" --requests="$4" --id=$id --i=$i 2>/dev/null | grep "^RESULT " | cut -c8- > "$o.tmp" && mv "$o.tmp" "$o"
' _ {} "$S" "$out" "$req"
