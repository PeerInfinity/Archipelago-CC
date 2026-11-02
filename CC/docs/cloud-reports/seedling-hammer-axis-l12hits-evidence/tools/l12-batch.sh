#!/bin/bash
# MEASUREMENT ONLY: replay every captured L12 request OFF and ON, one fresh process each; one JSON line per replay
# (axis-replay's answer + the model's player hits / strike landings on the answer's run, from axis-register).
# Usage: l12-batch.sh <requests.jsonl> <out.jsonl> <tag>
REQ=$1; OUT=$2; TAG=$3; T=$(cd "$(dirname "$0")" && pwd)
export AXIS_ROOT=${AXIS_ROOT:-$(cd "$T/../../../../.." && pwd)}
for id in $(node -e "require('fs').readFileSync('$REQ','utf8').trim().split('\n').forEach(l=>console.log(JSON.parse(l).id))"); do
  for a in "" --on; do
    C=$(mktemp); AXIS_OUT=$C node ${L12_DESIGN:+--import $T/design-register.mjs} --import $T/axis-register.mjs $T/axis-replay.mjs --root=$AXIS_ROOT --requests=$REQ --id=$id $a > $C.ans
    node -e "const a=JSON.parse(require('fs').readFileSync('$C.ans','utf8'));const c=JSON.parse(require('fs').readFileSync('$C','utf8').trim()||'{}');
      console.log(JSON.stringify({tag:'$TAG',id:a.id,on:a.on,ok:a.ok,ticks:a.ticks,plan:a.plan,work:a.work,axisTicks:a.census.axisTicks,
        modelHits:c.lastAxisRun?c.lastAxisRun.playerHits:[],pressHits:c.lastAxisRun?c.lastAxisRun.pressHits:[],message:a.message}))" >> $OUT
    rm -f $C $C.ans
  done
done
