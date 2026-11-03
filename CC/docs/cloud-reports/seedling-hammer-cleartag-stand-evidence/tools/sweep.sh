#!/bin/bash
# MEASUREMENT ONLY: the page sweep over the 14 L12 bosslock legs (inv, solver, one page per leg, CI's defaults),
# capturing every solve request. Usage: sweep.sh <tag> [--solver-env=...]
TAG=$1; shift; R=$(cd "$(dirname "$0")/../../../../.." && pwd); E=$R/CC/docs/cloud-reports/seedling-hammer-cleartag-stand-evidence
OUT=${OUT_DIR:-/tmp/claude-0/sweep}; mkdir -p $OUT
cd $R && node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=test-results/divergence-sweep/legs.jsonl \
  --mode=inv --producer=solver --page-legs=1 --keys="$(cat $E/w0/l12-keys.txt)" \
  --capture-requests=$OUT/$TAG-req.jsonl --out=$OUT/$TAG-rows.jsonl "$@"
