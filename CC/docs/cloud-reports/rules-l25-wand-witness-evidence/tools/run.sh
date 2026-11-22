#!/usr/bin/env bash
# run.sh <name> [witness2 flags...] — compile segs/<name>.json to tapes/<name>.json, play it on a fresh game page.
set -e
E="$(cd "$(dirname "$0")/.." && pwd)"; n="$1"; shift
node "$E/tools/segtape.mjs" "$E/segs/$n.json" --out="$E/tapes/$n.json" >/dev/null
node "$E/tools/witness2.mjs" "$E/tapes/$n.json" --out="$E/runs" "$@" 2>&1 | grep -v "^PAGE\|^# box\|^CHANNEL\|^MOVERS" | tee "$E/runs/$n${*:+.$(echo "$*" | tr -c 'a-z0-9' '_')}.log"
