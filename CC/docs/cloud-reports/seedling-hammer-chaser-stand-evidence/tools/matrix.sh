#!/bin/bash
# MEASUREMENT-ONLY: run solve.mjs for every (job line × variant). Job lines: "fx <path>" or "cap <jsonl> <id> <i> [seam]".
# usage: matrix.sh <jobs.txt> <out.jsonl> [parallel=3]   (variants from variants.sh; legs 371/376 first if listed first)
T=$(cd "$(dirname "$0")" && pwd); . "$T/variants.sh"
jobs=$1; out=$2; P=${3:-3}
cd /tmp/claude-0/-home-user-Archipelago-CC/71f3de28-d5be-51d6-97a1-b4b3a0697b79/scratchpad/tools || exit 1
while read -r line; do [ -z "$line" ] && continue; for v in $VARIANTS; do echo "$v|$line"; done; done < "$jobs" |
  xargs -P "$P" -d '\n' -I{} bash -c '. "$0/variants.sh"; IFS="|" read -r v l <<< "$1"; set -- $l; seam=0; [ "$1" = cap ] && seam=${5:-0};
    cd "$0" && env $(venv $v) VARIANT=$v SEAM_SHIFT=$seam timeout 1500 node --import ./seg-reg.mjs solve.mjs $1 $(case $2 in /*) echo $2;; *) echo /home/user/Archipelago-CC/$2;; esac) $3 $4 2>/dev/null | tail -1 || echo "{\"variant\":\"$v\",\"job\":\"$l\",\"error\":\"timeout/crash\"}"' "$T" {} >> "$out"
