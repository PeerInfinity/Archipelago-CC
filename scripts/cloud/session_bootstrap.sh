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

# --- 4. frontend/modules/shared ------------------------------------------------------
# Point the submodule at the setup-time mirror (a .git/config override only;
# .gitmodules is untouched). If the mirror lacks the pinned commit, try to
# fetch it - that goes through the relay and may 403.
SUB=frontend/modules/shared
PIN=$(git ls-tree HEAD "$SUB" | awk '{print $3}')
MIRROR="$CACHE/mirrors/archipelago-shared"
if [ ! -f "$SUB/ruleEngine.js" ]; then
  if [ -d "$MIRROR/.git" ]; then
    git -C "$MIRROR" cat-file -e "$PIN^{commit}" 2>/dev/null || git -C "$MIRROR" fetch -q origin || true
    git config "submodule.$SUB.url" "$MIRROR"
    git -c protocol.file.allow=always submodule update --init "$SUB" || bad "submodule $SUB from mirror (pin $PIN)"
  else
    timeout 600 git submodule update --init "$SUB" || bad "submodule $SUB (no mirror; the relay may need add_repo peerinfinity/archipelago-shared)"
  fi
fi

# --- 5. per-checkout gitignored files -------------------------------------------------
if [ ! -d Players/Templates ] || [ -z "$(ls Players/Templates 2>/dev/null)" ]; then
  python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')" \
    >/tmp/archcc-templates.log 2>&1 || bad "template generation (see /tmp/archcc-templates.log)"
fi
if [ ! -f host.yaml ]; then
  python Launcher.py --update_settings >/tmp/archcc-hostyaml.log 2>&1 || bad "Launcher.py --update_settings (see /tmp/archcc-hostyaml.log)"
fi
python scripts/setup/update_host_settings.py minimal-spoilers >/dev/null 2>&1 || bad "update_host_settings.py minimal-spoilers"

# --- 6. summary ----------------------------------------------------------------------
say "python $(python --version 2>&1 | cut -d' ' -f2), node $(node --version)"
say "templates: $(ls Players/Templates 2>/dev/null | wc -l)"
[ -f host.yaml ]                           && say "host.yaml: OK"          || bad "host.yaml missing"
[ -f "$SUB/ruleEngine.js" ]                && say "shared submodule: OK"   || bad "shared submodule missing"
[ -x node_modules/.bin/playwright ]        && say "playwright: OK"         || bad "playwright missing"
ls ~/.cache/ms-playwright 2>/dev/null | grep -q chromium && say "chromium: OK" \
  || bad "no Playwright chromium in ~/.cache/ms-playwright"
[ -z "$(git status --porcelain)" ] && say "tree: clean" || { say "tree NOT clean:"; git status --short | head -20; }
[ $FAIL -eq 0 ] && say "READY" || say "NOT READY - see FAILED lines above"
exit $FAIL
