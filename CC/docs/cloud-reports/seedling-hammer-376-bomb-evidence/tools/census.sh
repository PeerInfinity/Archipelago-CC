#!/bin/bash
# usage: census.sh <outdir> <cap> [ENV=..] — the 45 hammer phases 5243..5287, 3 at a time
S=${SCRATCH}
out=$1; cap=$2; mkdir -p $out
seq 5243 5287 | xargs -P 3 -I{} sh -c "node $S/tools/s376.mjs --seam={} --cap=$cap > $out/{}.txt 2>&1"
