#!/bin/bash
# census-arm.sh <out.jsonl> <jobs> <off|pair> <legs.jsonl> <dump.json> — every leg id of census/leg-ids.txt solved by
# census-leg.mjs under the arm, CAP seconds of wall time per leg (default 300; a capped leg is recorded {"cap":true}).
out=$1; jobs=$2; arm=$3; legs=$4; dump=$5; D=$(dirname "$0")/..
case $arm in off) envs="";; pair) envs="SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1 SEEDLING_PRESS_KILL_CHASERS=1";; *) exit 2;; esac
export ENVS="$envs" CAP="${CAP:-300}" T="$D/tools" LEGS="$legs" DUMP="$dump" SP="$D/census/sphere-items.jsonl" ARM="$arm"
xargs -P"$jobs" -I{} sh -c 'l=$(env $ENVS timeout $CAP node "$T/census-leg.mjs" --legs="$LEGS" --spheres="$SP" --dump="$DUMP" --id={} 2>/dev/null); rc=$?; if [ $rc -eq 124 ]; then echo "{\"id\":{},\"arm\":\"$ARM\",\"cap\":true,\"capS\":$CAP}"; elif [ -n "$l" ]; then printf "%s\n" "$l"; else echo "{\"id\":{},\"arm\":\"$ARM\",\"crash\":$rc}"; fi' < "$D/census/leg-ids.txt" >> "$out"
