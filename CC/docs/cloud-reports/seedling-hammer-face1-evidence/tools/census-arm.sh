#!/bin/bash
# FACE 1: census-arm.sh <out.jsonl> <jobs> <off|on> <cen-dir> — every leg id of census/l40-arrival-ids.txt solved by
# census-leg.mjs (L40-PAIR's: the page's producer ask + its one held retry) under the arm; resumable; CAP s per leg.
out=$1; jobs=$2; arm=$3; C=$4; D=$(dirname "$0")/..
case $arm in off) envs="";; on) envs="SEEDLING_GOAL_START_WAIT=1";; *) exit 2;; esac
export ENVS="$envs" CAP="${CAP:-900}" T="$D/tools" C ARM="$arm"
touch "$out"; node -e 'const fs=require("fs");const d=new Set(fs.readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean).map((l)=>JSON.parse(l).id));for(const i of fs.readFileSync(process.argv[2],"utf8").trim().split("\n"))if(!d.has(Number(i)))console.log(i)' "$out" "${IDS:-$D/census/l40-arrival-ids.txt}" | xargs -P"$jobs" -I{} bash -c 'l=$(env $ENVS timeout $CAP node "$T/census-leg.mjs" --legs="$C/legs.jsonl" --spheres="$C/sphere-items.jsonl" --dump="$C/dump.json" --id={} 2>/dev/null); rc=$?; if [ $rc -eq 124 ]; then echo "{\"id\":{},\"arm\":\"$ARM\",\"cap\":true,\"capS\":$CAP}"; elif [ -n "$l" ]; then printf "%s\n" "$l"; else echo "{\"id\":{},\"arm\":\"$ARM\",\"crash\":$rc}"; fi' >> "$out"
