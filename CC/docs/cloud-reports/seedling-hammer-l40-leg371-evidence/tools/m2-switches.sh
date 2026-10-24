#!/usr/bin/env bash
# Measure-only (slice L371): each switch flipped ALONE by env, one fresh node process per (arm, seam), RESULT → <out>
# with the arm's name. Usage: m2-switches.sh <requests.jsonl> <out.jsonl> <jobs> <seam>...
set -u
req=$1; out=$2; jobs=$3; shift 3
tool="$(dirname "$0")/l371-solve.mjs"
arms=(
  "default=L371_ARM_DEFAULT=1"
  "rebootGuard-OFF=SEEDLING_PRESS_KILL_REBOOT_GUARD=0"
  "shakeGuard-OFF=SEEDLING_PRESS_KILL_SHAKE_GUARD=0"
  "bombBlastBody-OFF=SEEDLING_BOMB_BLAST_BODY=0"
  "strikeEtaFloor-ON=SEEDLING_STRIKE_ETA_FLOOR=1"
  "hammerEscape-OFF=SEEDLING_HAMMER_ESCAPE=0"
  "movingWait-OFF=SEEDLING_MOVING_WAIT=0"
  "pressKillBombs-ON=SEEDLING_PRESS_KILL_BOMBS=1"
  "hammerApproach-ON=SEEDLING_HAMMER_APPROACH=1"
  "hammerFightFallback-ON=SEEDLING_HAMMER_FIGHT_FALLBACK=1"
)
for s in "$@"; do for a in "${arms[@]}"; do echo "${a%%=*} ${a#*=} $s"; done; done |
  xargs -P "$jobs" -L1 sh -c 'env $1 node "'"$tool"'" --requests="'"$req"'" --seam=$2 | grep "^RESULT " | cut -c8- | sed "s/^{/{\"arm\":\"$0\",/" >> "'"$out"'"'
