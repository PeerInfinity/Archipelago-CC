#!/bin/bash
# Archipelago-CC cloud environment setup script.
#
# Source of truth for the "Archipelago" Claude Code cloud environment: paste
# this file into claude.ai/code -> cloud icon -> environment -> "Setup script"
# whenever it changes (the environment does not read it from the repo).
# Network access: "Trusted" or wider (Ubuntu archive, PyPI, npm, GitHub).
#
# Runs as root on Ubuntu 24.04 BEFORE Claude starts, and its result is cached,
# so it does the slow work and does NOT assume the repo checkout exists:
#   - a shallow clone of the public repo (for requirement files + lockfile)
#   - a Python venv with the repo's requirements (git-sourced deps skipped)
#   - node_modules built from package-lock.json
#   - Playwright's Chromium + its apt dependencies
#   - a bare mirror of every submodule's repo (shared, the Seedling wasm builds, ...)
# The session then runs scripts/cloud/session_bootstrap.sh in the repo, which
# links these in (and repairs anything that moved since the cache was built).
#
# Always exits 0 so one failed step never breaks the environment; read
# /root/CC/SETUP_STATUS to see what succeeded and how long each step took.

set -u
DEST="${ARCHCC_SETUP_DEST:-/root/CC}"
SEED="$DEST/seed"                     # shallow clone of Archipelago-CC main
VENV="$DEST/venv"
MIRRORS="$DEST/mirrors"
STATUS="$DEST/SETUP_STATUS"
REPO_URL="https://github.com/PeerInfinity/Archipelago-CC.git"

mkdir -p "$DEST" "$MIRRORS"
: > "$STATUS"
log() { echo "[archcc-setup] $*"; echo "$*" >> "$STATUS"; }
T0=$SECONDS
step() { log "$1 ($((SECONDS - T0))s elapsed)"; }

export DEBIAN_FRONTEND=noninteractive
export PIP_DISABLE_PIP_VERSION_CHECK=1

# --- 1. seed clone ----------------------------------------------------------
# Only the files the later steps read; submodules are not needed here.
rm -rf "$SEED"
if timeout 180 git clone -q --depth 1 --branch main "$REPO_URL" "$SEED"; then
  step "seed clone: OK ($(git -C "$SEED" rev-parse --short HEAD))"
else
  step "seed clone: FAILED - nothing else can run"; exit 0
fi

# --- 2. submodule mirrors -----------------------------------------------------
# A bare mirror of EVERY submodule the seed's .gitmodules names (all public; the
# largest, seedling-wasm, is ~36 MB packed). Full history, so the bootstrap can
# check out whatever commit the session's HEAD pins. In-session git goes
# through a relay that 403s repos outside the session's scope; setup-time git
# does not.
git -C "$SEED" config -f .gitmodules --get-regexp '^submodule\..*\.url$' | while read -r _ url; do
  name=$(basename "$url" .git)
  m="$MIRRORS/$name.git"
  if [ -d "$m" ]; then
    timeout 180 git -C "$m" fetch -q --prune origin && step "mirror $name: refreshed" \
      || step "mirror $name: refresh FAILED (stale copy kept)"
  elif timeout 240 git clone -q --mirror "$url" "$m"; then
    step "mirror $name: OK ($(du -sh "$m" | cut -f1))"
  else
    step "mirror $name: FAILED"
  fi
done

# --- 3. Python venv -------------------------------------------------------------
# kivymd (root, GUI-only: a git+ line AND a >=2.0.1.dev0 pin PyPI cannot meet)
# and zilliandomizer (worlds/zillion, git+) cannot install here; comment them
# out in the seed, then let the repo's own ModuleUpdate install every
# requirements file separately (one file mixes in --hash pins, so they cannot
# be merged into a single pip call).
if ! python3 -c "import ensurepip, venv" 2>/dev/null; then
  timeout 120 apt-get update -qq >/dev/null 2>&1 || true
  timeout 120 apt-get install -y -qq python3-venv >/dev/null 2>&1 || true
fi
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
for f in "$SEED"/requirements.txt "$SEED"/worlds/*/requirements.txt; do
  sed -i -E 's/^([^#].*git\+|kivymd)/# \1/' "$f"
done
if (cd "$SEED" && timeout 480 "$VENV/bin/python" ModuleUpdate.py --yes >"$DEST/pip.log" 2>&1) \
   && (cd "$SEED" && "$VENV/bin/python" -c "import ModuleUpdate; ModuleUpdate.update()" >>"$DEST/pip.log" 2>&1 </dev/null); then
  step "pip: OK (ModuleUpdate reports every requirement met)"
else
  step "pip: FAILED (see $DEST/pip.log)"
fi

# The Python half of the headless Seedling channel (pinned to node's playwright).
if [ -f "$SEED/scripts/procgen/requirements-headless.txt" ]; then
  timeout 120 "$VENV/bin/pip" install -q -r "$SEED/scripts/procgen/requirements-headless.txt" >>"$DEST/pip.log" 2>&1 \
    && step "pip headless (python playwright): OK" || step "pip headless: FAILED (see $DEST/pip.log)"
fi

# --- 4. node_modules --------------------------------------------------------------
# Built in the seed; the bootstrap copies it in when package-lock.json matches.
if (cd "$SEED" && timeout 300 npm ci --no-audit --no-fund --loglevel=error >"$DEST/npm.log" 2>&1); then
  sha256sum "$SEED/package-lock.json" | cut -d' ' -f1 > "$DEST/node_modules.lock-sha"
  step "npm ci: OK (node $(node --version))"
else
  step "npm ci: FAILED (see $DEST/npm.log)"
fi

# --- 5. Playwright Chromium ---------------------------------------------------------
# Version comes from the seed's own @playwright/test, so the browser matches.
if [ -x "$SEED/node_modules/.bin/playwright" ]; then
  if (cd "$SEED" && PLAYWRIGHT_SKIP_BROWSER_GC=1 timeout 360 npx playwright install --with-deps chromium >"$DEST/playwright.log" 2>&1); then
    step "playwright chromium: OK ($(ls "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}" 2>/dev/null | tr '\n' ' '))"
  else
    step "playwright chromium: FAILED (see $DEST/playwright.log)"
  fi
else
  step "playwright chromium: SKIPPED (no node_modules)"
fi

step "done"
exit 0
