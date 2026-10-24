#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/6f8cb257-c0d0-5512-9faf-5f8714505200/scratchpad
cd /home/user/Archipelago-CC
mkdir -p $S/logs/check
grep -al -- --check scripts/procgen/plan-seedling-*.mjs | xargs -P 3 -I{} bash -c 'n=$(basename {} .mjs); st=$(date +%s); SEEDLING_PORT=9695 node {} --check > '$S'/logs/check/$n.log 2>&1; e=$?; printf "%s\t%s\t%ss\t%s\n" $n $e $(( $(date +%s)-st )) "$(grep -a -m1 "^FAIL" '$S'/logs/check/$n.log | cut -c1-160)" >> '$S'/logs/check-head.tsv'
echo done > $S/logs/check.done
