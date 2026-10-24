#!/bin/bash
# usage: run-legs.sh <repo> <tag> [env...]  — one inv-leg per id, census sink on
REPO=$1; TAG=$2; S=/tmp/claude-0/-home-user-Archipelago-CC/e1f8ea7c-6ce7-5606-8d32-f0c078a14144/scratchpad
OUT=$S/census/legs-$TAG.jsonl; : > $OUT; : > $S/census/legs-$TAG-census.jsonl
for id in ${IDS:-703 262 635 773 288 696 265 322 283 768 160 328 130 161 131 698 257 171 290 302 633 140 141}; do
  cd $REPO && REPO=$REPO CENSUS_OUT=$S/census/legs-$TAG-census.jsonl NODE_OPTIONS=--import=$S/census/census-preload.mjs \
    timeout 1800 node $S/census/inv-leg.mjs --legs=$S/census/legs.jsonl --rows=$S/ci/sweep/merged/rows.jsonl \
    --dump=$S/ci/sweep/merged/delivered-set.json --id=$id >> $OUT 2>> $S/census/legs-$TAG.err || echo "{\"id\":$id,\"crash\":true}" >> $OUT
done
echo DONE >> $S/census/legs-$TAG.err
