#!/bin/bash
# usage: bis.sh <producer>   exit 0 green, 1 drift-red, 125 other
out=$(timeout 300 node scripts/procgen/plan-seedling-$1.mjs --check 2>&1); rc=$?
if [ $rc -eq 0 ]; then exit 0; fi
if echo "$out" | grep -aq "DRIFT"; then exit 1; fi
echo "$out" | tail -5; exit 125
