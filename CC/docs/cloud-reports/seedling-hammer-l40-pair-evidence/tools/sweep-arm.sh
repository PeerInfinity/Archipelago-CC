#!/bin/bash
# sweep-arm.sh <outfile.jsonl> <jobs> <arm: off|claim|pkc|pair> <fx...> — every clock 5213..5257 (one hammer period) per
# fixture at budget 2560, the arm's SEEDLING_ switches =1, each solve capped at CAP seconds of wall time (default 300; a
# capped solve is recorded as {"cap":true}). Clocks already in <outfile.jsonl> are skipped (resumable).
out=$1; jobs=$2; arm=$3; shift 3
case $arm in
  off) envs="";;
  claim) envs="SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1";;
  pkc) envs="SEEDLING_PRESS_KILL_CHASERS=1";;
  pair) envs="SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1 SEEDLING_PRESS_KILL_CHASERS=1";;
  *) echo "arm?"; exit 2;;
esac
touch "$out"
done_pairs=$(node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").trim().split("\n")){if(!l)continue;const r=JSON.parse(l);console.log(r.fx+" "+r.seam)}' "$out")
export ENVS="$envs" ARM="$arm" CAP="${CAP:-300}" TOOLS="$(dirname "$0")"
for fx in "$@"; do for s in $(seq 5213 5257); do echo "$fx $s"; done; done | grep -v -x -F "${done_pairs:-@@none@@}" \
 | xargs -P"$jobs" -n2 sh -c 'line=$(env $ENVS timeout $CAP node "$TOOLS/seam.mjs" --fx=$0 --seam=$1 --budget=2560 2>/dev/null); rc=$?; if [ $rc -eq 124 ]; then echo "{\"fx\":\"$0\",\"seam\":$1,\"arm\":\"$ARM\",\"cap\":true,\"capS\":$CAP,\"ok\":false,\"message\":\"WALL CAP ${CAP}s\"}"; elif [ -n "$line" ]; then printf "%s\n" "$line"; else echo "{\"fx\":\"$0\",\"seam\":$1,\"arm\":\"$ARM\",\"ok\":false,\"crash\":$rc,\"message\":\"CRASH rc=$rc\"}"; fi' >> "$out"
