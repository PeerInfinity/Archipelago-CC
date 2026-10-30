#!/bin/bash
# probe-seedling-strategy-disable — THROWAWAY MEASUREMENT (seedling-solver-strategy-switch-design).
#
# Re-solves named route-survey steps with ONE solver strategy removed, to see which vanilla rooms NEED it.
# It applies a measure-only patch to solverBot.js (an env-read mask: SEEDLING_PROBE_DISABLE=<verb>), runs the
# survey's own per-step child, and reverts the patch on exit. ⛔ The patch is NOT a candidate: it masks the frozen
# table (so enumerating readers see a changed table) and reads process.env — both things the real switch must not do.
#
#   scripts/procgen/probe-seedling-strategy-disable.sh <out-dir> <verb>:<steps> [<verb>:<steps> …]
#   scripts/procgen/probe-seedling-strategy-disable.sh /tmp/x none:4,6 shove:4,8,23 burn:45,50
#
# `none` is the control: with the patch applied and nothing disabled, every step must solve at the survey's ticks.
set -u
here=$(cd "$(dirname "$0")/../.." && pwd)
patch="$here/CC/docs/cloud-reports/seedling-solver-strategy-switch-design-evidence/probe-disable.patch.txt"
out=$1; shift
mkdir -p "$out"
cd "$here" || exit 2
git apply "$patch" || { echo "patch does not apply at $(git rev-parse --short HEAD)"; exit 2; }
trap 'git checkout -- frontend/modules/seedlingDemo/solverBot.js' EXIT
for arg in "$@"; do
    v=${arg%%:*}; steps=${arg#*:}
    echo "### $v :: $steps $(date +%T)"
    SEEDLING_PROBE_DISABLE=$([ "$v" = none ] || echo "$v") timeout 900 node scripts/procgen/survey-seedling-route.mjs \
        --through=end --only="$steps" --timeout=300 --out="$out/$v.json" > "$out/$v.log" 2>&1
    echo "rc=$?"; grep -a '^== step' "$out/$v.log"
done
