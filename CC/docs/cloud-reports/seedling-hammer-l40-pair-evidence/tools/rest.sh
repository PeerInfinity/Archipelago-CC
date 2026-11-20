#!/bin/bash
# rest.sh — everything after the seam sweeps, in order, each step resumable or idempotent (a container restart cost one
# chain): the recapped solves, the census (off/pkc/pair), flip readiness (off/pkc/pair), the survey (off/pkc/pair).
P=CC/docs/cloud-reports/seedling-hammer-l40-pair-evidence; S=$1
[ -s $P/seams/recap.jsonl ] || $P/tools/recap.sh $P/seams/recap.jsonl
for a in pkc pair off; do $P/tools/census-arm.sh $P/census/$a.jsonl 4 $a $S/cen/legs.jsonl $S/cen/dump.json; done
echo CENSUSDONE
for a in off pkc pair; do [ -s $P/flip/identity-$a.txt ] || $P/tools/flip.sh $P/flip $a; done
echo FLIPDONE
for a in off pkc pair; do
  [ -s $S/end-$a.json ] && continue
  case $a in off) e="";; pkc) e=SEEDLING_PRESS_KILL_CHASERS=1;; pair) e="SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1 SEEDLING_PRESS_KILL_CHASERS=1";; esac
  env $e node scripts/procgen/survey-seedling-route.mjs --through=end --out=$S/end-$a.json > $P/survey/end-$a.log 2>&1
done
echo ALLDONE
