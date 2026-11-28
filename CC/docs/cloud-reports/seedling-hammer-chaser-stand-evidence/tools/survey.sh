#!/bin/bash
# MEASUREMENT-ONLY: survey --through=end under each variant (variants.sh), two at a time.
T=$(cd "$(dirname "$0")" && pwd); . "$T/variants.sh"; out=$1; shift
cd /home/user/Archipelago-CC || exit 1
printf '%s\n' "$@" | xargs -P 2 -I{} bash -c '. "$0/variants.sh"; env $(venv $1) node scripts/procgen/survey-seedling-route.mjs --through=end --out="$2/survey-$1.json" > "$2/survey-$1.log" 2>&1; echo "$1 exit $?" >> "$2/done.txt"' "$T" {} "$out"
