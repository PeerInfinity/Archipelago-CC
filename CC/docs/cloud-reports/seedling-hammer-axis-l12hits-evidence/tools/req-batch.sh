#!/bin/bash
# MEASUREMENT ONLY: replay EVERY captured request (each leg's every i) in a tree ($AXIS_ROOT), switch ON, one fresh process
# each; one JSON line per request (verdict, ticks, plan sha, work, message head). Usage: req-batch.sh <requests.jsonl> <out> <tag>
REQ=$1; OUT=$2; TAG=$3; T=$(cd "$(dirname "$0")" && pwd)
export AXIS_ROOT=${AXIS_ROOT:-$(cd "$T/../../../../.." && pwd)}
node -e "require('fs').readFileSync('$REQ','utf8').trim().split('\n').forEach(l=>{const r=JSON.parse(l);r.requests.forEach(q=>console.log(r.id+' '+q.i))})" | while read id i; do
  node $T/axis-replay.mjs --root=$AXIS_ROOT --requests=$REQ --id=$id --i=$i --on 2>/dev/null \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const a=JSON.parse(s);console.log(JSON.stringify({tag:'$TAG',id:a.id,i:a.i,ok:a.ok,kind:a.kind,ticks:a.ticks,plan:a.plan,work:a.work,message:(a.message||'').slice(0,200)}))}catch(e){console.log(JSON.stringify({tag:'$TAG',id:$id,i:$i,error:String(s).slice(0,200)}))}})" >> $OUT
done
