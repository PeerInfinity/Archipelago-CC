#!/usr/bin/env bash
# SCRATCH (FF): one fresh node process per seam, one file per seam (no interleaved appends). Switches by env.
# Usage: census.sh <tool.mjs> <requests.jsonl> <from> <to> <outdir> [jobs=3] [extra args...]
set -u
tool=$1; req=$2; from=$3; to=$4; out=$5; jobs=${6:-3}; shift 6 2>/dev/null || shift $#; extra="$*"
mkdir -p "$out"
seq "$from" "$to" | while read s; do [ -s "$out/$s.json" ] || echo "$s"; done \
  | xargs -r -P "$jobs" -I{} sh -c "node '$tool' --requests='$req' --seam={} $extra 2>'$out/{}.err' | grep '^RESULT ' | cut -c8- > '$out/{}.json.tmp' && mv '$out/{}.json.tmp' '$out/{}.json'"
