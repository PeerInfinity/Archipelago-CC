#!/usr/bin/env bash
# new-worktree.sh — ONE command for a slice's own git worktree (BOX PROTOCOL P0).
#
# Concurrent slices run in worktrees, never two on one tree: a commit in a
# shared tree moves another session's frozen box-lock head, and its push
# publishes the other session's commits. This is the whole recipe, so no
# launch prompt has to carry it (and none can forget a step of it).
#
# CREATION ONLY. There is deliberately no removal path in this script.

set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$SELF_DIR" rev-parse --show-toplevel)"
# The PRIMARY tree (the common git dir's parent) names the family and its parent dir.
COMMON_DIR="$(cd "$REPO" && cd "$(git rev-parse --git-common-dir)" && pwd)"
PRIMARY="$(dirname "$COMMON_DIR")"
PARENT="${NEW_WORKTREE_PARENT:-$(dirname "$PRIMARY")}"
FAMILY="$(basename "$PRIMARY")"

# The one submodule left out unless asked for: the Seedling wasm builds.
WASM_SUBMODULE="frontend/modules/flashPanel/wasm"
# The worktree-slice port convention: the first free port from here, in steps.
PORT_BASE=8130
PORT_STEP=10
HOOKS_PATH="scripts/git-hooks"
# Step 6. The ladder is ASKED, never re-spelled here: repoPython.js is its one spelling.
REPO_PYTHON="scripts/procgen/repoPython.js"
# A key of PRESETS in scripts/setup/update_host_settings.py. full, not minimal: the
# primary's host.yaml json_tools equals it exactly, and a preset regenerated under
# other settings differs from the committed one (plan §19.1 rung D).
HOST_PRESET="full-spoilers"
# The guide's step 3, verbatim (docs/json/developer/getting-started.md); 'Players' is
# settings.py's generator.player_files_path default, which Generate.py scans.
TEMPLATES_PY="from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"
# The three, in the guide's order: one list, read by the plan, the run and the by-hand text.
STEP6_1=(-c "$TEMPLATES_PY")
STEP6_2=(Launcher.py --update_settings)
STEP6_3=(scripts/setup/update_host_settings.py "$HOST_PRESET")
STEP6=(STEP6_1 STEP6_2 STEP6_3)

usage() {
  local wasm_size="not checked out in $PRIMARY, so not measured"
  if [ -d "$PRIMARY/$WASM_SUBMODULE" ]; then
    wasm_size="$(du -sh --apparent-size --exclude=.git "$PRIMARY/$WASM_SUBMODULE" 2>/dev/null | cut -f1) checkout, measured now in $PRIMARY"
  fi
  cat <<EOF
Usage: scripts/dev/new-worktree.sh [--dry-run] [--with-wasm] <name> [<base>]

Creates $PARENT/$FAMILY-wt-<name> on a NEW branch <name> from <base>
(default: origin/main, fetched first), ready for a slice:
  1. git worktree add -b <name> <dir> <base>
  2. git submodule update --init for every submodule in <base>'s .gitmodules
     EXCEPT $WASM_SUBMODULE ($wasm_size)
     unless --with-wasm
  3. user.name / user.email copied from this repo into each submodule clone
     (a worktree's submodule clone has no identity of its own, and a commit
     there falls back to the global one, which GitHub may refuse)
  4. npm ci
  5. git config --worktree core.hooksPath $HOOKS_PATH
     (the pre-commit hook that refuses a commit under a foreign box lock)
  6. the getting-started guide's steps 3 and 4, run IN the worktree with the
     Python $REPO_PYTHON --generate chooses (the primary's venv is
     activated, not copied): Players/Templates, Launcher.py --update_settings,
     update_host_settings.py $HOST_PRESET — so the Generate.py gates run there.
     With no such Python the worktree is still made, and the refusal and the
     three commands are printed to run by hand.
and prints the dev-server command on a free port (scanned from $PORT_BASE in
steps of $PORT_STEP), the matching npm test form, and the venv to activate.

  --dry-run    print the plan, change nothing
  --with-wasm  also initialise $WASM_SUBMODULE
  --help       this text

Environment: NEW_WORKTREE_PARENT overrides the parent directory ($PARENT).
There is no removal path: this script only creates.
EOF
}

DRY_RUN=0
WITH_WASM=0
ARGS=()
for a in "$@"; do
  case "$a" in
    --help|-h) usage; exit 0 ;;
    --dry-run) DRY_RUN=1 ;;
    --with-wasm) WITH_WASM=1 ;;
    --*) echo "new-worktree: unknown option $a (see --help)" >&2; exit 2 ;;
    *) ARGS+=("$a") ;;
  esac
done
if [ "${#ARGS[@]}" -lt 1 ] || [ "${#ARGS[@]}" -gt 2 ]; then
  usage >&2
  exit 2
fi
NAME="${ARGS[0]}"
BASE="${ARGS[1]:-origin/main}"
DEST="$PARENT/$FAMILY-wt-$NAME"

refuse() { echo "⛔ new-worktree: $1" >&2; exit 1; }

git check-ref-format --branch "$NAME" >/dev/null 2>&1 \
  || refuse "'$NAME' is not a valid branch name"
[ ! -e "$DEST" ] || refuse "$DEST already exists — this script only creates, never reuses"
if git -C "$REPO" show-ref --verify --quiet "refs/heads/$NAME"; then
  refuse "branch '$NAME' already exists"
fi
[ "$(git -C "$REPO" config --get extensions.worktreeConfig || true)" = "true" ] \
  || refuse "extensions.worktreeConfig is not enabled, so core.hooksPath cannot be set for ONE worktree (plain git config would install the hook on every tree sharing this repo). Enable it once: git -C $PRIMARY config extensions.worktreeConfig true"

FETCH=0
case "$BASE" in origin/*) FETCH=1 ;; esac

# Submodules come from the BASE's .gitmodules, so the plan is right before the tree exists.
SUBMODULES=()
SKIPPED=()
if [ "$FETCH" = 1 ] && [ "$DRY_RUN" = 0 ]; then
  echo "+ git -C $REPO fetch origin"
  git -C "$REPO" fetch origin
fi
GITMODULES_FROM="$BASE"
if ! git -C "$REPO" rev-parse --verify --quiet "$BASE^{commit}" >/dev/null; then
  # A dry run does not fetch, so an origin/ base it has never seen is not a refusal:
  # the real run fetches first. The plan reads the submodules from HEAD and says so.
  if [ "$FETCH" = 1 ] && [ "$DRY_RUN" = 1 ]; then
    GITMODULES_FROM="HEAD"
    echo "# $BASE is not fetched here (a dry run does not fetch): submodules read from HEAD's .gitmodules"
  else
    refuse "base '$BASE' is not a commit in $REPO"
  fi
fi
while read -r _key path; do
  [ -n "$path" ] || continue
  if [ "$path" = "$WASM_SUBMODULE" ] && [ "$WITH_WASM" = 0 ]; then
    SKIPPED+=("$path")
  else
    SUBMODULES+=("$path")
  fi
done < <(git -C "$REPO" config --blob "$GITMODULES_FROM:.gitmodules" --get-regexp '^submodule\..*\.path$' 2>/dev/null || true)

USER_NAME="$(git -C "$REPO" config --get user.name || true)"
USER_EMAIL="$(git -C "$REPO" config --get user.email || true)"

# A free port: nothing listening on it now.
PORT=$PORT_BASE
listening() { ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"; }
while listening "$PORT"; do PORT=$((PORT + PORT_STEP)); done

PLAN=()
[ "$FETCH" = 1 ] && PLAN+=("git -C $REPO fetch origin")
PLAN+=("git -C $REPO worktree add -b $NAME $DEST $BASE")
if [ "${#SUBMODULES[@]}" -gt 0 ]; then
  PLAN+=("git -C $DEST submodule update --init -- ${SUBMODULES[*]}")
  if [ -n "$USER_NAME" ] && [ -n "$USER_EMAIL" ]; then
    for s in "${SUBMODULES[@]}"; do
      PLAN+=("git -C $DEST/$s config user.name $USER_NAME")
      PLAN+=("git -C $DEST/$s config user.email $USER_EMAIL")
    done
  fi
fi
PLAN+=("npm ci --prefix $DEST")
PLAN+=("git -C $DEST config --worktree core.hooksPath $HOOKS_PATH")

# One argv as a copy-pasteable line (an argument with a space is double-quoted).
show() {
  local out="" a
  for a in "$@"; do case "$a" in *' '*) out+=" \"$a\"" ;; *) out+=" $a" ;; esac; done
  echo "${out# }"
}
step6_line() { local -n argv="$1"; echo "(cd $DEST && $2 $(show "${argv[@]}"))"; }
PLAN+=("PY=\$(cd $DEST && node $REPO_PYTHON --generate)")
for s in "${STEP6[@]}"; do PLAN+=("$(step6_line "$s" '$PY')"); done

# Step 6's Python, asked of TREE's own repoPython.js. Prints the path, or the refusal and returns 1.
ask_python() {
  local tree="$1" out rc=0
  out="$(cd "$tree" && node "$REPO_PYTHON" --generate)" || rc=$?
  if [ "$rc" = 0 ] && [ -n "$out" ] && command -v -- "$out" >/dev/null; then
    echo "$out"
    return 0
  fi
  [ -n "$out" ] || out="$tree/$REPO_PYTHON --generate answered nothing (exit $rc) — a base older than that CLI"
  echo "$out"
  return 1
}
by_hand() {
  echo "# ⚠ step 6 NOT run — the worktree is made, but Generate.py cannot run in it yet. The refusal above;"
  echo "#   with a Python that carries Archipelago's requirements active, run by hand:"
  for s in "${STEP6[@]}"; do echo "#   $(step6_line "$s" python)"; done
}

# Step 6 itself: ask TREE for the Python, then run the three there (EXECUTE=1) or only
# name the answer (a dry run; NOTE labels it). ⛔ A refusal is NOT a failure: the worktree
# stays valid for frontend-only work, so the script goes on and exits 0 (like the identity
# warning).
step6() {
  local tree="$1" execute="$2" note="${3:-}" s
  if ! PY="$(ask_python "$tree")"; then
    echo "$PY"
    by_hand
    return 0
  fi
  echo "# PY=$PY${note:+ $note}"
  [ "$execute" = 1 ] || return 0
  for s in "${STEP6[@]}"; do
    local -n step_argv="$s"
    echo "+ $(step6_line "$s" "$PY")"
    (cd "$tree" && "$PY" "${step_argv[@]}" </dev/null) \
      || refuse "step 6 failed at: $(step6_line "$s" "$PY") — the worktree exists at $DEST; finish that step and the ones after it by hand"
    unset -n step_argv
  done
}

if [ "$DRY_RUN" = 1 ]; then
  echo "# new-worktree --dry-run: nothing is changed"
  for step in "${PLAN[@]}"; do echo "+ $step"; done
  # The new tree does not exist in a dry run, so step 6's ladder is asked of THIS tree —
  # kept, not skipped: the dry run is how a refusal is seen without creating anything.
  step6 "$REPO" 0 "(asked of $REPO; the new tree answers differently only at rung 3, its own .venv, absent at creation)"
else
  run() { echo "+ $*"; "$@"; }
  run git -C "$REPO" worktree add -b "$NAME" "$DEST" "$BASE"
  if [ "${#SUBMODULES[@]}" -gt 0 ]; then
    run git -C "$DEST" submodule update --init -- "${SUBMODULES[@]}"
    if [ -n "$USER_NAME" ] && [ -n "$USER_EMAIL" ]; then
      for s in "${SUBMODULES[@]}"; do
        run git -C "$DEST/$s" config user.name "$USER_NAME"
        run git -C "$DEST/$s" config user.email "$USER_EMAIL"
      done
    fi
  fi
  run npm ci --prefix "$DEST"
  run git -C "$DEST" config --worktree core.hooksPath "$HOOKS_PATH"
  echo "+ PY=\$(cd $DEST && node $REPO_PYTHON --generate)"
  step6 "$DEST" 1
fi
[ "${#SKIPPED[@]}" -eq 0 ] || echo "# skipped (pass --with-wasm to include): ${SKIPPED[*]}"
[ -n "$USER_NAME" ] && [ -n "$USER_EMAIL" ] \
  || echo "# ⚠ no user.name/user.email in $REPO — submodule clones were given no identity"

echo "# serve it:  (cd $DEST && python -m http.server $PORT)"
echo "# test it:   (cd $DEST && npm test -- --port=$PORT …)"
echo "# python:    source $PRIMARY/.venv/bin/activate   (the primary's venv, shared by activation, never copied)"
