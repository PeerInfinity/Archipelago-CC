#!/bin/bash
# matrix.sh <jobs-file> <out.jsonl> : each line "<arm> <key> <seam> <ENV,ENV|->", solved with those SEEDLING_<ENV>=1 set
S=$(dirname "$0")/..
while read -r arm key seam envs; do
  e=(); if [ "$envs" != "-" ]; then IFS=, read -ra xs <<< "$envs"; for x in "${xs[@]}"; do e+=("SEEDLING_$x=1"); done; fi
  env "${e[@]}" timeout 1800 node $S/tools/solve.mjs --req=$S/req-$arm.jsonl --key=in_$key --seam=$seam 2>/dev/null >> $2 || echo "{\"seam\":$seam,\"envs\":\"$envs\",\"err\":true}" >> $2
done < $1
