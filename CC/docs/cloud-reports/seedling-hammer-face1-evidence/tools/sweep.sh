#!/bin/bash
# FACE 1: sweep one captured request over arrival clocks [base-45, base+45] (the spinner's period either side), 4 at a time.
#   sweep.sh <req.json.gz> <out.jsonl> [extra seam.mjs args]   (env SEEDLING_*=… pass through)
REQ=$1; OUT=$2; shift 2
DIR=$(dirname "$0")
BASE=$(node -e 'const z=require("zlib"),f=require("fs");console.log(JSON.parse(z.gunzipSync(f.readFileSync(process.argv[1]))).request.staging.seam.time)' "$REQ")
seq $((BASE-45)) $((BASE+45)) | xargs -P 4 -I{} timeout 900 node "$DIR/seam.mjs" --req="$REQ" --seam={} "$@" >> "$OUT"
