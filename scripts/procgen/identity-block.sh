#!/bin/bash
# identity-block — ⚖ RULING 8's BYTE-INERTIA SET, WITH ITS COMMANDS.
#
# ⛔ WHY THIS FILE EXISTS. Ruling 8 publishes the identity set as VALUES —
# `maze 677b7d9c…`, `killgate s2 37a1f5f6…` — and every slice rebuilt the
# commands in its own scratchpad, which was then thrown away. R9 slice 7 went
# to reproduce the block at a pristine worktree and could reproduce only the
# rows whose command it could guess: THREE ROWS (the AREA census, killgate
# s2/s5/s9, the default levels pre/post-sword s1) could not be compared to
# their published values at all, because a value without its command is not a
# reproducible measurement. ⇒ ⚖ ruling 17 (c): the derivation is committed.
#
# USAGE:  bash scripts/procgen/identity-block.sh <tree>
#         bash scripts/procgen/identity-block.sh .            # this tree
#
# Run it at a PRISTINE detached worktree for the BEFORE and on the finished
# tree for the AFTER, and `diff` the two — that comparison is the point, and it
# is valid even for a row whose published value predates this script.
#
# ── THE PUBLISHED VALUES AT `855a6d200` (R9 slice 7's baseline) ────────
#   maze byte-identity            677b7d9cae51023e82fa2e365a8095dc   ✔ ruling 8
#   acceptance batch              8ad7bda2ae4b470122334f71b4e92651   ✔ ruling 8
#   empty pairs c3                4643933e38c96d1f076ffb4fbe65e682   ✔ ruling 8
#   empty pairs c6                f54d7e75815385c67b009e46d6015dd2   ✔ ruling 8
#   carved pairs c4               b078e54dd3081cbf88ce4a1d20e9ebab   ✔ ruling 8
#   ENEMY census default          fcc77cfd7072e3bf04f89dcb24e73de3   ✔ ruling 8
#   guard census (elements)       a6d18d49ae256c321d175f45ec76dccc   ✔ ruling 8
#   generated set                 OK                                 ✔ ruling 8
#   reference --check             ALL 6 MODULES + 3 REGIONS MATCH    ✔ ruling 8
#   battery --check               75adf82610fa7ea21f6822590a3b0330  [R9 s7]
#   tail --check                  9a6a31925cb5204eee4cb0ad66febed6  [R9 s7]
#   d2-chain / l18 / l3 / campaign --check      exit 0, unmoved since slice 6
#
# ⚠ THREE ROWS BELOW CARRY A COMMAND THIS SCRIPT CHOSE, NOT THE ONE THAT MADE
#   RULING 8's PUBLISHED VALUE — the AREA census, the three `killgate` levels
#   and the default levels pre/post-sword s1. Their published values
#   (`b211f57b…`; `37a1f5f6…`/`4f736b5e…`/`0a09e1e6…`; `387850c8…`/`133a10f9…`)
#   do NOT reproduce here, and the difference is in the FLAGS, not the code:
#   nothing in the plans records which arguments were passed. Until somebody
#   recovers them, those three rows are BEFORE-vs-AFTER inertia only and must
#   not be compared against ruling 8's numbers. Every other row reproduces.
#
# ⛔ THE BATTERY'S md5 IS THE PIPE FORM. `$(...)` strips the trailing newline
#   and gives a different digest for identical bytes; ruling 8's value is
#   `--check 2>&1 | md5sum`.
set -u
T="${1:-.}"
cd "$T" || exit 1
r () { printf '%-46s %s\n' "$1" "$2"; }
m () { md5sum | cut -d' ' -f1; }

r "maze byte-identity"          "$(node scripts/procgen/dump-maze-byteidentity.mjs 2>/dev/null | m)"
r "acceptance batch"            "$(node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | m)"
r "empty pairs c3"              "$(node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=empty --seeds=1-40 --count=3 2>/dev/null | m)"
r "empty pairs c6"              "$(node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=empty --seeds=1-40 --count=6 2>/dev/null | m)"
r "carved pairs c4"             "$(node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=winding,rooms,branchy,bushy,loopy,open --seeds=1-12 --count=4 2>/dev/null | m)"
r "ENEMY census default"        "$(node scripts/procgen/census-seedling-enemies.mjs 2>/dev/null | m)"
r "guard census (elements)"     "$(node scripts/procgen/census-seedling-elements.mjs 2>/dev/null | m)"
r "AREA census default    [*]"  "$(node scripts/procgen/census-seedling-areas.mjs 2>/dev/null | m)"
for s in 2 5 9; do
  r "killgate s$s            [*]" "$(node scripts/procgen/census-seedling-killgate-clears.mjs --seeds=$s-$s 2>/dev/null | m)"
done
r "level pre-sword s1     [*]"  "$(node scripts/procgen/generate-seedling-level.mjs --seed=1 --biome=pre-sword 2>/dev/null | m)"
r "level post-sword s1    [*]"  "$(node scripts/procgen/generate-seedling-level.mjs --seed=1 --biome=post-sword 2>/dev/null | m)"
r "generated set"               "$(node scripts/procgen/check-seedling-generated-set.mjs 2>&1 | tail -1)"

echo "--- every producer's own --check (⚖ ruling 8's 2026-08-21 extension) ---"
for p in solve-seedling-r8-battery solve-seedling-r8-d2-chain solve-seedling-r8-l18 \
         solve-seedling-r8-tail solve-seedling-r9-l3 solve-seedling-r9-campaign; do
  d=$(node "scripts/procgen/$p.mjs" --check 2>&1 | m)
  node "scripts/procgen/$p.mjs" --check >/dev/null 2>&1
  r "$p --check" "$d [exit $?]"
done

echo "--- reference ---"
node scripts/procgen/generate-procgen-reference.mjs --check 2>&1 | tail -1
echo "[*] = command chosen by this script; NOT ruling 8's original — see the header."
