#!/bin/bash
# usage: run.sh <jobs.txt> <outdir>   each line: name lapse args...
J=$1; O=$2; E=/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-hammer-cw-evidence
while read -r name lapse rest; do echo "$name $lapse $rest"; done < "$J" | xargs -P ${PAR:-4} -L 1 sh -c '
  n=$0; l=$1; shift 1
  SEEDLING_STRIKE_IFRAME_LAPSE=$l timeout ${CAP:-1800} node '"$E"'/cw-solve.mjs "$@" --json='"$O"'/$n.json --tape='"$O"'/$n.tape.json --trail='"$O"'/$n.trail.json > '"$O"'/$n.log 2>&1; echo "$n rc=$?" >> '"$O"'/done.txt'
