#!/bin/bash
# In-session half of the Archipelago-CC cloud setup. Run from the repo root at
# the start of a cloud session:   bash scripts/cloud/session_bootstrap.sh
#
# Links in what scripts/cloud/env_setup.sh cached under /root/CC, repairs
# whatever moved since that cache was built (requirements, lockfile, the
# shared submodule's pin), and writes the per-checkout files that are
# gitignored (Players/Templates, host.yaml). Falls back to installing from
# scratch where the cache is missing, so it also works with no setup script.
#
# Leaves the tree clean apart from the two requirement files it marks
# skip-worktree (same as CC/cloud-setup.md step 2). Exit status is non-zero if
# anything a template test needs is missing; the summary says what.

set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
CACHE="${ARCHCC_SETUP_DEST:-/root/CC}"
FAIL=0
SUBS="frontend/modules/shared"
case "${1:-}" in
  "") ;;
  --seedling) SUBS="$SUBS frontend/modules/flashPanel/wasm vendor/seedling" ;;
  --all) SUBS=$(git config -f .gitmodules --get-regexp '^submodule\..*\.path$' | awk '{print $2}') ;;
  *) echo "usage: $0 [--seedling|--all]" >&2; exit 2 ;;
esac
say() { echo "[archcc-bootstrap] $*"; }
bad() { say "FAILED: $*"; FAIL=1; }

[ -f "$CACHE/SETUP_STATUS" ] && { say "environment setup status:"; sed 's/^/    /' "$CACHE/SETUP_STATUS"; } \
  || say "no $CACHE/SETUP_STATUS - environment setup did not run; installing from scratch"

# --- 1. venv -----------------------------------------------------------------
if [ ! -e .venv ]; then
  if [ -x "$CACHE/venv/bin/python" ]; then ln -s "$CACHE/venv" .venv; else python3 -m venv .venv; fi
fi
# shellcheck disable=SC1091
source .venv/bin/activate

# --- 2. git-sourced requirements -----------------------------------------------
# The session relay 403s them, and kivymd's other line pins a dev release PyPI
# does not have (both GUI-only); comment them out locally and keep the edit
# uncommittable. ModuleUpdate then stops prompting for them.
for f in requirements.txt worlds/*/requirements.txt; do
  if grep -qE '^([^#].*git\+|kivymd)' "$f" 2>/dev/null; then
    sed -i -E 's/^([^#].*git\+|kivymd)/# \1/' "$f"
    git update-index --skip-worktree "$f"
  fi
done
python ModuleUpdate.py --yes </dev/null >/tmp/archcc-moduleupdate.log 2>&1 || bad "ModuleUpdate.py --yes (see /tmp/archcc-moduleupdate.log)"

# --- 3. node_modules -------------------------------------------------------------
LOCK_SHA=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ -d node_modules ]; then
  :
elif [ -d "$CACHE/seed/node_modules" ] && [ "$(cat "$CACHE/node_modules.lock-sha" 2>/dev/null)" = "$LOCK_SHA" ]; then
  cp -a "$CACHE/seed/node_modules" node_modules || bad "copy cached node_modules"
else
  say "lockfile differs from the cached one (or no cache): npm ci"
  npm ci --no-audit --no-fund --loglevel=error || bad "npm ci"
fi

# --- 4. submodules -------------------------------------------------------------------
# Point each wanted submodule at its setup-time mirror (a .git/config override
# only; .gitmodules is untouched). If a mirror lacks the pinned commit, try to
# fetch it - that goes through the relay and may 403.
for SUB in $SUBS; do
  [ -n "$(ls -A "$SUB" 2>/dev/null)" ] && continue
  PIN=$(git ls-tree HEAD "$SUB" | awk '{print $3}')
  URL=$(git config -f .gitmodules "submodule.$SUB.url")
  MIRROR="$CACHE/mirrors/$(basename "$URL" .git).git"
  if [ -d "$MIRROR" ]; then
    git -C "$MIRROR" cat-file -e "$PIN^{commit}" 2>/dev/null || git -C "$MIRROR" fetch -q origin || true
    git config "submodule.$SUB.url" "$MIRROR"
    git -c protocol.file.allow=always submodule update --init "$SUB" || bad "submodule $SUB from mirror (pin $PIN)"
  else
    timeout 600 git submodule update --init "$SUB" || bad "submodule $SUB (no mirror; the relay may need add_repo for it)"
  fi
done

# --- 5. per-checkout gitignored files -------------------------------------------------
if [ ! -d Players/Templates ] || [ -z "$(ls Players/Templates 2>/dev/null)" ]; then
  python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')" \
    >/tmp/archcc-templates.log 2>&1 || bad "template generation (see /tmp/archcc-templates.log)"
fi
if [ ! -f host.yaml ]; then
  python Launcher.py --update_settings >/tmp/archcc-hostyaml.log 2>&1 || bad "Launcher.py --update_settings (see /tmp/archcc-hostyaml.log)"
fi
python scripts/setup/update_host_settings.py minimal-spoilers >/dev/null 2>&1 || bad "update_host_settings.py minimal-spoilers"
case " $SUBS " in *" frontend/modules/flashPanel/wasm "*)
  python -c "import playwright" 2>/dev/null \
    || pip install -q -r scripts/procgen/requirements-headless.txt >/tmp/archcc-pip-headless.log 2>&1 \
    || bad "requirements-headless.txt (see /tmp/archcc-pip-headless.log)" ;;
esac

# --- 6. summary ----------------------------------------------------------------------
say "python $(python --version 2>&1 | cut -d' ' -f2), node $(node --version)"
say "templates: $(ls Players/Templates 2>/dev/null | wc -l)"
[ -f host.yaml ]                           && say "host.yaml: OK"          || bad "host.yaml missing"
[ -f frontend/modules/shared/ruleEngine.js ] && say "shared submodule: OK" || bad "shared submodule missing"
for SUB in $SUBS; do
  [ "$SUB" = frontend/modules/shared ] && continue
  [ -n "$(ls -A "$SUB" 2>/dev/null)" ] && say "submodule $SUB: OK" || bad "submodule $SUB missing"
done
if [ -f frontend/modules/flashPanel/wasm/builds.json ]; then
  # Every build the pin manifest lists must have its wasm payload on disk.
  MISSING=$(python - <<'PY'
import json, os
root = 'frontend/modules/flashPanel/wasm'
d = json.load(open(os.path.join(root, 'builds.json')))
for b in d.get('builds', []):
    name = b.get('name') or b.get('dir')
    w = b.get('wasm')
    if name and w and not os.path.isfile(os.path.join(root, name, w)):
        print(name)
PY
)
  [ -z "$MISSING" ] && say "seedling wasm builds: OK ($(ls -d frontend/modules/flashPanel/wasm/*/ | wc -l) dirs)" \
    || bad "seedling wasm payloads missing: $MISSING"
fi
[ -x node_modules/.bin/playwright ]        && say "playwright: OK"         || bad "playwright missing"
# The cloud image sets PLAYWRIGHT_BROWSERS_PATH (browsers outside ~/.cache).
PW_BROWSERS="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
ls "$PW_BROWSERS" 2>/dev/null | grep -q chromium && say "chromium: OK ($PW_BROWSERS)" \
  || bad "no Playwright chromium in $PW_BROWSERS"
[ -z "$(git status --porcelain)" ] && say "tree: clean" || { say "tree NOT clean:"; git status --short | head -20; }
[ $FAIL -eq 0 ] && say "READY" || say "NOT READY - see FAILED lines above"
exit $FAIL
