#!/bin/bash
# MEASUREMENT ONLY: replay every leg of a capture (all requests of each leg) under env; one JSON line each.
# Usage: batch.sh <requests.jsonl> <out.jsonl> <tag> [register.mjs]   (env: SEEDLING_* as wanted)
REQ=$1; OUT=$2; TAG=$3; REG=${4:-walk-register.mjs}; T=$(cd "$(dirname "$0")" && pwd)
node -e "require('fs').readFileSync('$REQ','utf8').trim().split('\n').forEach(l=>{const r=JSON.parse(l);r.requests.forEach(q=>console.log(r.id+' '+(q.i??0)))})" | while read id i; do
  node --import $T/$REG $T/replay.mjs --requests=$REQ --id=$id --i=$i | node -e "const o=JSON.parse(require('fs').readFileSync(0,'utf8'));o.tag='$TAG';console.log(JSON.stringify(o))" >> $OUT
done
