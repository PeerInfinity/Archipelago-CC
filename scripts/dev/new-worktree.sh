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
and prints the dev-server command on a free port (scanned from $PORT_BASE in
steps of $PORT_STEP) and the matching npm test form.

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
git -C "$REPO" rev-parse --verify --quiet "$BASE^{commit}" >/dev/null \
  || refuse "base '$BASE' is not a commit in $REPO"
while read -r _key path; do
  [ -n "$path" ] || continue
  if [ "$path" = "$WASM_SUBMODULE" ] && [ "$WITH_WASM" = 0 ]; then
    SKIPPED+=("$path")
  else
    SUBMODULES+=("$path")
  fi
done < <(git -C "$REPO" config --blob "$BASE:.gitmodules" --get-regexp '^submodule\..*\.path$' 2>/dev/null || true)

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

if [ "$DRY_RUN" = 1 ]; then
  echo "# new-worktree --dry-run: nothing is changed"
  for step in "${PLAN[@]}"; do echo "+ $step"; done
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
fi
[ "${#SKIPPED[@]}" -eq 0 ] || echo "# skipped (pass --with-wasm to include): ${SKIPPED[*]}"
[ -n "$USER_NAME" ] && [ -n "$USER_EMAIL" ] \
  || echo "# ⚠ no user.name/user.email in $REPO — submodule clones were given no identity"

echo "# serve it:  (cd $DEST && python -m http.server $PORT)"
echo "# test it:   (cd $DEST && npm test -- --port=$PORT …)"
