#!/bin/bash
# Runs the census over every biome (seeds 1-40) and caldera-cf (13-60), 4 lanes. Usage: census-run.sh <outdir>
E=$(dirname "$0"); OUT=$1; mkdir -p "$OUT"
lane() { for job in "$@"; do set -- $job; node "$E/census-direction-throws.mjs" $1 $2 >> "$OUT/$1.jsonl" 2>>"$OUT/$1.err"; done; }
lane "pre-sword 1-40" "post-sword 1-40" "post-shield 1-40" "caldera-cf 13-30" &
lane "post-swim 1-40" "post-feather 1-40" "post-fire 1-40" "caldera-cf 31-45" &
lane "post-spear 1-40" "post-dark-suit 1-40" "endgame 1-40" "caldera-cf 46-60" &
lane "caldera 13-40" "frozen-forge 9-40" "flooded-ruins 9-40" &
wait; echo DONE > "$OUT/DONE"
