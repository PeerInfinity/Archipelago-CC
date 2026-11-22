#!/usr/bin/env bash
# rules-k-exempt-entry: the sketch's producer run, in a THROWAWAY worktree ($1), by the derived-rule table's REGEN_RECIPE
# shape: pass 1 with the stale table aside, the table regenerated locally (probe-seedling-derived-rules.mjs), pass 2 with
# it; then the certifier (vanilla + er, arm new) and the engine closure. Logs to $2. Seed 1 / world package not run.
set -u
W=$1; O=$2; mkdir -p "$O"; cd "$W" || exit 2
T=frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json
step() { echo "== $1"; shift; "$@"; echo "rc=$?"; }
{
mv "$T" "$O/table-before.json"
step rules1 node scripts/procgen/make-seedling-playthrough-rules.mjs --quiet
step partition1 node scripts/procgen/make-seedling-subregion-partition.mjs
step maze1 node scripts/procgen/make-seedling-playthrough-maze.mjs
step er1 node scripts/procgen/make-seedling-er-preset.mjs
step table node scripts/procgen/probe-seedling-derived-rules.mjs --shards=2 --out="$O/table"
cp "$O/table/seedling-playthrough-derived-rules.json" "$T" 2>/dev/null || find "$O/table" -name 'seedling-playthrough-derived-rules.json' -exec cp {} "$T" \;
step rules2 node scripts/procgen/make-seedling-playthrough-rules.mjs --quiet
step partition2 node scripts/procgen/make-seedling-subregion-partition.mjs
step maze2 node scripts/procgen/make-seedling-playthrough-maze.mjs
step er2 node scripts/procgen/make-seedling-er-preset.mjs
step cert-vanilla node scripts/procgen/probe-seedling-whole-game-certify.mjs --shards=2 --arms=new --source=vanilla --out="$O/cert-vanilla"
step cert-er node scripts/procgen/probe-seedling-whole-game-certify.mjs --shards=2 --arms=new --source=er --out="$O/cert-er"
step engine node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure
} > "$O/regen.log" 2>&1
