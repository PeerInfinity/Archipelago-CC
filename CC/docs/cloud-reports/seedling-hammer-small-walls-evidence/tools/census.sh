#!/bin/bash
# census.sh <out-dir> <ids-file> : each leg id, 3 in parallel, one node process per leg; env passes through
S=${S:?}; E=CC/docs/cloud-reports/seedling-hammer-small-walls-evidence
mkdir -p "$1"
xargs -P 3 -I{} bash -c 'timeout 300 node '$E'/tools/census-leg.mjs --legs='$S'/legs.jsonl --spheres='$S'/cen/spheres.rows.jsonl --dump='$S'/cen/dump.json --id={} > '"$1"'/{}.json 2>/dev/null || echo "{\"id\":{},\"crash\":true}" > '"$1"'/{}.json' < "$2"
echo DONE > "$1.done"
