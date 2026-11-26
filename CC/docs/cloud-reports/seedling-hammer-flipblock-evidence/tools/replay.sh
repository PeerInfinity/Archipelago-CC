#!/bin/bash
# usage: run.sh <reqs> <id> <i> <tag> [ENV=1 ...]
Q=$1; ID=$2; I=$3; TAG=$4; shift 4
D=$(dirname "$0")
s=$(date +%s.%N)
env "$@" node /home/user/Archipelago-CC/scripts/procgen/replay-seedling-solve-request.mjs --requests=$Q --id=$ID --i=$I --n=1 --out=$D/$ID-$I-$TAG.jsonl > $D/$ID-$I-$TAG.log 2>&1
e=$(date +%s.%N)
echo "WALL $(python3 -c "print(round($e-$s,1))") s" >> $D/$ID-$I-$TAG.log
