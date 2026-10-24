#!/usr/bin/env bash
# Measure-only (slice L371): one FRESH node process per seam time, `l371-solve.mjs` each, RESULT lines → <out>.
# The arm's switches come from the caller's env (inherited by every child).
# Usage: census.sh <requests.jsonl> <from> <to> <out.jsonl> [jobs=1]
set -u
req=$1; from=$2; to=$3; out=$4; jobs=${5:-1}
tool="$(dirname "$0")/l371-solve.mjs"
seq "$from" "$to" | xargs -P "$jobs" -I{} sh -c "node '$tool' --requests='$req' --seam={} | grep '^RESULT ' | cut -c8- >> '$out'"
