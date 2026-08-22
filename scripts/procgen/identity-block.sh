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
# ⛓⛓ BASELINE BY QUOTATION (⚖ ruling 32 A). When your head EQUALS the commit
# named beside a value below, that value IS your BEFORE — quote it and do not
# spend a worktree re-measuring what a clean tree cannot have changed. Then
# re-measure only what your change REACHES:
#     node scripts/procgen/reach-seedling-change.mjs --range=<base>..HEAD
# which prints the rows of this block a change can move (⚠ an UPPER BOUND: what
# CAN move, not what will). R9 slice 11 spent ~55 minutes on a pristine baseline
# whose every row it could have quoted, and still missed four rows because it
# sealed by grep instead.
#
# ── THE PUBLISHED VALUES AT `855a6d200` (R9 slice 7's baseline) ────────
#   maze byte-identity            677b7d9cae51023e82fa2e365a8095dc   ✔ ruling 8
#   acceptance batch              8ad7bda2ae4b470122334f71b4e92651   ✔ ruling 8
#   empty pairs c3                4643933e38c96d1f076ffb4fbe65e682   ⛓ SUPERSEDED
#   empty pairs c6                f54d7e75815385c67b009e46d6015dd2   ⛓ SUPERSEDED
#   carved pairs c4               b078e54dd3081cbf88ce4a1d20e9ebab   ⛓ SUPERSEDED
#   ENEMY census default          fcc77cfd7072e3bf04f89dcb24e73de3   ⛓ SUPERSEDED
#   ⛔ THE FOUR ROWS MARKED SUPERSEDED MOVED AT R9 SLICE 11 — successors below.
#   guard census (elements)       a6d18d49ae256c321d175f45ec76dccc   ✔ ruling 8
#   generated set                 OK                                 ✔ ruling 8
#   reference --check             ALL 6 MODULES + 3 REGIONS MATCH    ✔ ruling 8
#
# ── ⛓ THE STANDING VALUES, RE-SEALED AT R9 SLICE 11 (`143846faf`) ──────
# ⛔ TRAP 549: a published digest DECAYS unless the slice that moves the producer
#   re-seals it, and a value without its commit cannot be reproduced. Slice 7's
#   `75adf826…` sat in this header through three briefs and reproduced at NEITHER
#   end (§20.1 measured it). Every value below names the commit it was taken at.
#   ⚠ TWO OF THEM MOVED AT SLICE 11 and the reason is the `facingToward` repair
#   (trap 498): the kill arm gained vertical strike cells, so L18 solves 32 ticks
#   sooner and every artifact that reads it followed.
#
#   battery --check      18682c65be4d41066fd99b6ac87248c9   @143846faf  (unmoved)
#   tail --check         9a6a31925cb5204eee4cb0ad66febed6   @143846faf  (unmoved)
#   r9-l3 --check        8ac17aca76f18b3370b091219f876b19   @143846faf  (unmoved)
#   campaign --check     0f3119fbdd3a742c8a96137bbe82b56f   @143846faf  (unmoved)
#   l18 --check          c0ecf701e3a39c18ad5c6d8bdf26187e   @143846faf  ⛓ MOVED
#                        (was 691dc7f3…) — r8-solve-18 573 -> 541 ticks
#   d2-chain --check     4e21c680e586917d1e02f3e5ed7e8377   @143846faf  ⛓ MOVED
#                        (was e46183d6…) — through segment 1 only; r8-d2-19 and
#                        r8-d2-20 stayed byte-identical in their WALKS
#   ⛓ Both re-read exit 0 once the re-record landed: mid-slice they read exit 1
#     ("⛔ DRIFT — the committed artifact is not what the solver produces today"),
#     which is what a licensed mover looks like BEFORE its record.
#   r7-ends-meet --check 75cf816affb3cfb903ae22b4120395ec   @70f14a502  CHECK CLEAN
#                        ⚠ the SEVENTH producer (ruling 22) and NOT run by this
#                        script — it drives a browser inside its own `--check`.
#                        §18.11 warned its md5 is not a fingerprint; at
#                        `70f14a502` it reproduced BYTE-IDENTICALLY over two
#                        consecutive runs (empty `diff`), so it is quotable there.
#
#   ⛓ SIX MEASUREMENT ROWS MOVED AT SLICE 11, because `procgenSeedling` imports
#   `procgenOracle` — GENERATING A LEVEL RUNS THE CERTIFY SOLVE, so the repaired
#   kill arm reaches them transitively. ⚠ Every mover is POST-SWORD and not one
#   pre-sword row moved, which is the mechanism confirming itself:
#   `wall-gap-spinner-killlock` is a post-sword template.
#
#   empty pairs c3       9a7cffe618a796a5bd2f7bf228a2dcb1   @143846faf
#   empty pairs c6       5824d3276e88af7dbb893128bd0aefb1   @143846faf
#   carved pairs c4      e2cf97a1a2287f3939245f0e9ceb3e81   @143846faf
#   ENEMY census         bc64aaf88920338cc52cef9d100daecd   @143846faf
#                        (one row: `spinner@nub` SOLVED 384 -> 365)
#   killgate s2     [*]  51da6d6acf45b92ccdaa58ac82767319   @143846faf
#                        ⚠ its PRINTED TABLE is identical; only unrendered fields
#                        moved (`ticks` 416->360, `at` 292->259). A row that
#                        cannot SEE a change is not a row that saw none.
#   killgate s9     [*]  d0687559341d1414839f27dba13a669b   @143846faf
#                        (DROPPED -> placed/certified/SOLVED, cause `sword`)
#   ⛓ UNMOVED and worth saying: maze, acceptance batch (it holds NO spinner
#   traffic at all), guard census, AREA census, killgate s5 (its gate is
#   DROPPED), level pre-sword s1 AND level post-sword s1.
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
