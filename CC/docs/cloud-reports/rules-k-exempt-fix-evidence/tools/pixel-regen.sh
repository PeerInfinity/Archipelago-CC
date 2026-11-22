#!/usr/bin/env bash
# rules-k-exempt-fix: the K fix measured on ANOTHER tree ($1, a read-only detached worktree, patch applied there as a
# throwaway) by the derived-rule table's REGEN_RECIPE shape: pass 1 (rules, partition, maze, ER), the table derived
# locally (probe-seedling-derived-rules.mjs), pass 2 with it, the certifier (vanilla + er, arm new), the engine closure.
# Logs and copies to $2. Seed 1 / world package not run. Nothing is committed from that tree.
set -u
W=$1; O=$2; mkdir -p "$O"; cd "$W" || exit 2
T=frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json
step() { echo "== $1"; shift; "$@"; echo "rc=$?"; }
{
for p in seedling_playthrough seedling_er seedling_playthrough_maze; do mkdir -p "$O/base/$p"; cp frontend/presets/$p/AP_1/AP_1_rules.json "$O/base/$p/"; done
cp "$T" "$O/base/table.json"
step engine-base node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure
step apply git apply "$3"
step rules1 node scripts/procgen/make-seedling-playthrough-rules.mjs --quiet
step partition1 node scripts/procgen/make-seedling-subregion-partition.mjs
step maze1 node scripts/procgen/make-seedling-playthrough-maze.mjs
step er1 node scripts/procgen/make-seedling-er-preset.mjs
step table node scripts/procgen/probe-seedling-derived-rules.mjs --shards=2 --out="$O/table"
cp "$O/table/seedling-playthrough-derived-rules.json" "$T"
step rules2 node scripts/procgen/make-seedling-playthrough-rules.mjs --quiet
step partition2 node scripts/procgen/make-seedling-subregion-partition.mjs
step maze2 node scripts/procgen/make-seedling-playthrough-maze.mjs
step er2 node scripts/procgen/make-seedling-er-preset.mjs
for p in seedling_playthrough seedling_er seedling_playthrough_maze; do mkdir -p "$O/patch/$p"; cp frontend/presets/$p/AP_1/AP_1_rules.json "$O/patch/$p/"; done
step cert-vanilla node scripts/procgen/probe-seedling-whole-game-certify.mjs --shards=2 --arms=new --source=vanilla --out="$O/cert-vanilla"
step cert-er node scripts/procgen/probe-seedling-whole-game-certify.mjs --shards=2 --arms=new --source=er --out="$O/cert-er"
step engine-patch node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure
} > "$O/regen.log" 2>&1
