#!/usr/bin/env bash
#
# apply-post-preset-merge.sh
#
# Deterministic post-merge fixups for release checklist Phase 2, run AFTER
# the regenerated `generated-presets` branch has been merged into main and
# WHILE the restore ref (default: origin/main) still points at the PRE-regen
# release — so the preserved dev presets can be restored from it.
#
# It encodes what was previously done by hand:
#
#   1. Snapshot the workflow-produced preset_files.json -> preset_files.live.json
#      (the canonical / "live" index the deployed site uses; contains only the
#      games the workflow actually generates).
#
#   2. Restore the preserved dev/demo/test presets that the workflow does not
#      produce (its clean_existing step wipes frontend/presets/) from the
#      restore ref, and merge their preset_files.json entries back in — so the
#      dev index (preset_files.json) = canonical (live) + preserved dev presets.
#
# The set of preserved presets is read from preserved-dev-presets.txt (one
# game-id per line). Worldgen worlds (worlds/*_worldgen) and *_worldgen preset
# dirs are intentionally NOT restored.
#
# Idempotent: re-running recomputes the canonical index by stripping the
# preserved ids from the current preset_files.json, so it is stable no matter
# what state preset_files.json starts in.
#
# Usage:
#   scripts/release/apply-post-preset-merge.sh [--from-ref REF] [--list FILE] [--dry-run]
#
#   --from-ref REF   Git ref holding the preserved dev presets (default: origin/main)
#   --list FILE      Preserved-preset list (default: scripts/release/preserved-dev-presets.txt)
#   --dry-run        Show what would change without writing
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FROM_REF="origin/main"
LIST_FILE="$SCRIPT_DIR/preserved-dev-presets.txt"
PRESETS_DIR="frontend/presets"
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --from-ref) FROM_REF="$2"; shift 2 ;;
    --list)     LIST_FILE="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=1; shift ;;
    -h|--help)  grep '^#' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

cd "$REPO_ROOT"

PRESET_FILES="$PRESETS_DIR/preset_files.json"
LIVE_FILES="$PRESETS_DIR/preset_files.live.json"

[ -f "$LIST_FILE" ]    || { echo "error: list file not found: $LIST_FILE" >&2; exit 1; }
[ -f "$PRESET_FILES" ] || { echo "error: $PRESET_FILES not found (run after merging generated-presets into main)" >&2; exit 1; }
git rev-parse --verify --quiet "$FROM_REF" >/dev/null || { echo "error: ref not found: $FROM_REF" >&2; exit 1; }

# Read preserved ids (skip blanks / comments).
mapfile -t PRESERVED < <(grep -vE '^\s*(#|$)' "$LIST_FILE" | sed 's/[[:space:]]*$//')
echo "Restore ref          : $FROM_REF"
echo "Preserved presets    : ${PRESERVED[*]:-<none>}"
echo "Dry run              : $DRY_RUN"
echo

# --- 1 + 2 (index): recompute live (canonical) and dev (canonical + preserved) ---
PRESERVED_CSV="$(IFS=,; echo "${PRESERVED[*]:-}")"
FROM_REF="$FROM_REF" PRESERVED_CSV="$PRESERVED_CSV" \
PRESET_FILES="$PRESET_FILES" LIVE_FILES="$LIVE_FILES" DRY_RUN="$DRY_RUN" \
python3 - <<'PY'
import json, os, subprocess, sys

preset_files = os.environ["PRESET_FILES"]
live_files   = os.environ["LIVE_FILES"]
from_ref     = os.environ["FROM_REF"]
dry_run      = os.environ["DRY_RUN"] == "1"
preserved    = [x for x in os.environ["PRESERVED_CSV"].split(",") if x]

with open(preset_files, encoding="utf-8") as f:
    pf = json.load(f)

# Pre-regen index (source of preserved entries).
ref_raw = subprocess.check_output(["git", "show", f"{from_ref}:{preset_files}"])
ref = json.loads(ref_raw)

NON_GAME = {"metadata", "multiworld"}

# Canonical = current index with preserved ids stripped (idempotent).
canonical = {k: v for k, v in pf.items() if k not in preserved}

# Dev index = canonical games + preserved (from ref), metadata last.
dev = {k: v for k, v in canonical.items() if k != "metadata"}
missing = []
for pid in preserved:
    if pid in ref:
        dev[pid] = ref[pid]
    else:
        missing.append(pid)
if "metadata" in canonical:
    dev["metadata"] = canonical["metadata"]

if missing:
    print(f"  WARNING: preserved ids absent from {from_ref}: {missing}", file=sys.stderr)

def count(d):
    return len([k for k in d if k not in NON_GAME])

print(f"  live (canonical) index : {count(canonical)} games -> {live_files}")
print(f"  dev index              : {count(dev)} games -> {preset_files}  (+{count(dev)-count(canonical)} preserved)")

if not dry_run:
    with open(live_files, "w", encoding="utf-8") as f:
        json.dump(canonical, f, indent=2, sort_keys=False); f.write("\n")
    with open(preset_files, "w", encoding="utf-8") as f:
        json.dump(dev, f, indent=2, sort_keys=False); f.write("\n")
PY

# --- 2 (dirs): restore preserved preset directories from the ref ---
echo
echo "Restoring preserved preset directories from $FROM_REF:"
for id in "${PRESERVED[@]}"; do
  path="$PRESETS_DIR/$id"
  if git cat-file -e "$FROM_REF:$path" 2>/dev/null || \
     [ -n "$(git ls-tree -r --name-only "$FROM_REF" -- "$path")" ]; then
    echo "  restore $path"
    [ "$DRY_RUN" = "1" ] || git checkout "$FROM_REF" -- "$path"
  else
    echo "  WARNING: $path absent from $FROM_REF — skipped" >&2
  fi
done

echo
if [ "$DRY_RUN" = "1" ]; then
  echo "Done (dry-run — nothing written; re-run without --dry-run to apply)."
else
  echo "Done."
fi
exit 0
