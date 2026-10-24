# Seedling fidelity L14 — the swordless attempt (cloud report)

**Slice:** `seedling-fidelity-l14` (planner `seedling-fidelity-planning-2`), one attempt at a swordless crossing of L14.

| | |
|---|---|
| Started from | `main` **`a2d10de28cc4caac8ae55c64011a4f90c7781f62`** |
| Harness branch | **`claude/seedling-fidelity-l14-attempt-y38c1x`** (the harness's own branch; nothing pushed to `main`) |
| Commits | D1 `0447f7c` · D2 `56828f1` · D3 `53649d6` · this report (the head) |
| Evidence | scratch branch `fidelity-scratch/planning-2-evidence` (`capture-vm-old.json` read 4), checked out and never committed |

## Verdict: **(A) L14 is crossed swordless, with no hit, and the game agrees**

| D | Result | Summary |
|---|---|---|
| W0 | **PASS** | Baseline banked: identity log `aa46950b…`, six `--check`s all exit 0, tapeRunner 465/465, roster 204, bounded vitest 47 files / 2,115 tests all green. The L14 decline reproduces: *"the combat ladder is EXHAUSTED"* in 1.1–1.5 s. |
| D1 | **PASS (found)** | Two hand routes from the captured arrival cross with 0 hits: over the pack along the top wall (L15 on t227), and under it along the bottom wall (t237). The planner's straight line is hit on t20. No luring, no body-blocking, no item. |
| D2 | **PASS (game-witnessed)** | The **DETOUR** rung (`solverBot.deriveChaserDetour`) solves the arrival in 173 t, 0 hits, onto L15. The game recorded it and the model reproduces all 174 observations; a second game re-play matches the oracle. With the hook disabled, the refusal is byte-identical to the base's. Census below. |
| D3 | **PASS, 2 reds named** | Every identity row and every `--check` is identical. tapeRunner keeps the 465 old pairs and adds 2 for the witness. Two vitest reds remain, both expected: the bank row (`rosterCategories:175`) and one JS-arc test that pins the very decline this slice removes (`jsRuntimeVanillaDelivery`). |

**The one thing to know first.** L14's requirement now derives as **"none"**: from the captured swordless arrival the solver crosses with ∅. But the new rung has a cost. Any climb whose danger is **only chasers** and still ends EXHAUSTED now spends the rung's search before it refuses. L16's pre-sword refusal goes from **0.13 s to ~10–14 s**, and L25/L26 refusals take 2–6 s. The SF budget slice should put its `shouldStop()` hook into `deriveChaserDetour`.

## W0 (base `a2d10de`, primary tree, `SEEDLING_PORT=9210`)

- **identity block** (`bash scripts/procgen/identity-block.sh .`): log md5 **`aa46950b5958b32136111155250dd253`**
  - maze `246dfbce…` · acceptance `608693d2…` · c3 `05c5ef94…` · c6 `e88baf9d…` · c4 `f8cba3a8…`
  - ENEMY `1d7bd8cc…` · guard `a6d18d49…` · AREA `02b22525…`
  - killgate s2/s5/s9 `01210c82…`/`07ce222a…`/`30a1e3e7…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK
  - six `--check`s: battery `405d9c4bb37a0ab00fb0ef9a99194783` · d2-chain `8e7a43be0509882d753f54155ef284c2` · l18 `33d20889ebd8c72452ce7262bce9505b` · tail `35456fbc07e7151ddbc4c2a1fd00c789` · r9-l3 `6cd35fe1414af6bf5beb7605f235cb8e` · campaign `b29b589b26e6ad996c2a328d16b52c90`, **all exit 0**
  - reference: ALL 7 + 5 MATCH
- **tapeRunner**: 465/465; sorted (fullName, status) pairs md5 `77472b1ed651ebdfc2706418f0f27b03`. **Roster** 204.
- **The L14 decline**, from `replay.mjs … '{"read":{"level":14},"dashMode":"none","long":1}'`: 1,107–1,491 ms, 0 advances. The words: *"the combat ladder is EXHAUSTED. The corridor passes through danger at (145.9,72.0) — chaser:bob@128,64 …"*. The rungs refused as follows:
  - AVOID still probes at (119.3,56.2), `bob@96,48`.
  - TIME's reach bound is 48 px.
  - BAIT finds no killing region.
  - KILL has 0 pressers and 0 traps, and 59/59 chaser stances are refused by the WAIT forecast.
- **bounded vitest BEFORE**: 47 files, **2,115 / 2,115 green**. The files are every file `rg -al "deriveBait|chaser" frontend` finds, plus `solverBot`, `solverBotLethalPit`, `dangerMap`, `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`, `tapeRunner`, `jsRuntimeDeclarations` (read-only), `lintGateLabels`, `entityBlocks`, `r8Acceptance`, the four roster pins, `rosterCategories`, `r5SwimCloseout`, `procgenWeigh`, `procgenRoam` and `surveyFamily`.

## D1 — is a 0-hit swordless crossing possible? **Found** (`0447f7c`)

`scripts/procgen/probe-seedling-l14-swordless.mjs` plays hand-authored key spans through `createRunForStaging`, with no solver, from the captured arrival. The staging literal is `plan-seedling-l14-swordless.mjs`'s `L14_ARRIVAL_STAGING`, which is `stagingFromWasmArrival` of read 4, so no uncommitted file is read. The tightest gap is the Chebyshev gap between the player's 4×5 box and a bob's 8×8 box.

| route | keys | result | tightest gap |
|---|---|---|---|
| **top-wall** | up 45, left 125, down 45, right | **no hit, L15 on t227** | 5.18 px, `bob@32,32` at the NW corner, t152 |
| **bottom-wall** | down 50, left 130, up 45, right | **no hit, L15 on t237** | 2.59 px, `bob@176,112`, t51 |
| straight (control) | left | **hit on t20** by `bob@128,64` | −0.55 |

**The route's shape.** No bob is lured anywhere on purpose. In the model the walk covers ~1.15 px/tick, and the bobs' measured displacement is ~0.2–0.3 px/tick (`bob@176,112` moves (184,120) → (179,115) in 30 ticks). A bob chases only inside 80 px. So the corridor goes **around the pack along a wall**, and the bodies that wake fall behind. The search's bounds are the three hand routes; it was not run as a brute force, because the first route already answered the question.

**Dash or another item is not needed**: both routes are dashless and use no item.

## D2 — the DETOUR rung (`56828f1`)

**What it is.** `solverBot.deriveChaserDetour` is a new module-scope function. It is hooked at **ONE site: `climbLadder`, immediately after `rowFor('kill', refused)`**, the place where the ladder used to refuse with EXHAUSTED. It is **conditional**, like DODGE and PULL: present only when every danger the corridor probe named is a `chaser`. In every other climb it is absent: no row, and the refusal's words are unchanged.

**How it searches.**
- It searches best-first over corridors bent through at most 2 via cells. The via cells are every lattice cell the walk can plan to.
- Each leg is the planner's own `planWaypoints`, run with the walk's own `solverPlanOpts`.
- Order: shortest planned length plus the straight line to the aim. Ties break by the vias' y, then x.
- Legs are planned lazily. The open set is a heap, and an unplanned leg enters at its straight-line lower bound.
- Each candidate is previewed by `previewWalk`, with the chasers stepped against that candidate's player. It is certified by `probeSamples`, the probe's own predicate, under the same strike policy `probeCorridor` uses.
- One preview also answers its prefix. A sample carries the waypoint index it walks toward, so a danger met before the last via condemns the prefix and every extension of it.

**`previewWalk` change.** It gains an opt-in `stopWhen` (default `null`), so the search can stop a preview at its first danger. Every other caller is unchanged; the identity rows below are the receipt.

**Bounds.** `DETOUR_RUNG = {maxVias: 2, maxPreviews: 300, maxPlanned: 500}`. ⚠ The two work bounds are **calibrated**: L14 needs 253 previews and 397 legs, and the bounds are ~1.2× that. The docblock says so.

**The solve** (captured arrival, `dashMode` none or all): **173 t**, vias **(120,40) → (104,24)**, 0 hits, 0 deaths, onto L15. It takes 2.3–5 s here, depending on load. The JS runtime's in-place solve of the same leg takes 2.7 s (dashless pass, 173 keys).

**Game witness.** The witness is `l14-swordless-detour`: the tape is `plan-seedling-l14-swordless.mjs` (`--check` byte-identical), recorded with `check-seedling-bot-differential --record --only=l14-swordless-detour` on headless p4f.
- On the record run: **"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 174 observations, 1 transition(s)"**. The game's `hits` is 0, `save.time` agrees (5918), and the game saw every key edge.
- A second, non-record re-play: **"live game matches the committed oracle stream"**, ALL CHECKS PASSED.

**Mutant** (predicted: with the hook disabled, the words are exactly the base's). I copied `solverBot.js`, changed the condition to `false && …`, solved and restored (`cmp`-verified). The refusal is **byte-identical to the base's full message (1,819 characters)**. ✔ as predicted.

**What changed while building, measured.** I measured these after the first, unconditional cut:
1. It **solved two committed spinner census rooms that pin REFUSED** (`solverSpinnerKill`: the pre-sword corridor spinner and F2's (5,5)). A spinner is not outrun by walking round it, so the rung was made conditional on chaser-only danger, and both are REFUSED again with their old words.
2. L16's pre-sword refusal (`solverBot.test.js`'s slice-10 rows) took **73 s** and timed out the tests. A profile put ~55 s in leg planning: `planWaypoints`' string-pull costs ~35 ms per leg in L16. Three changes brought it to **~10–14 s** and turned those rows green:
   - lazy legs and a heap;
   - one preview per candidate (the prefix verdict read from `wp`);
   - `stopWhen`;
   - the `maxPlanned` bound.

**Census.** No committed tape moves. The brief's "S4/combat refusal census" names no committed artifact I could find, so I ran two populations.

*Captured arrivals.* All 25 reads of the scratch captures, each under both dash modes, base vs head: **only L14 (read 4) changes**, DECLINE → 173 t. Every other read is the same verdict and the same key hash.

*Fresh-boot vanilla legs into a chaser room.* Bare kit, dashless, `leg.mjs`: every arrival × every other exit in the 22 levels that hold a `bob`/`jellyfish`/`puncher`, 271 legs. At the base, 21 end EXHAUSTED. 11 of them are chaser-only:

| leg | base | head |
|---|---|---|
| L14 13→15 | EXHAUSTED 1.2 s | **SOLVED 173 t, 0 hits** (DETOUR) |
| L14 15→13 | EXHAUSTED 1.0 s | **SOLVED 132 t, 0 hits** |
| L22 25→30 | EXHAUSTED 1.0 s | **SOLVED 132 t, 0 hits** |
| L22 30→25 | EXHAUSTED 2.2 s | **SOLVED 132 t, 0 hits** |
| L16 15→17 | EXHAUSTED 0.2 s | EXHAUSTED + `detour:` line, 13.9 s (500 legs spent) |
| L25 22→26, 26→22, 28→26 | EXHAUSTED 0.1–1.1 s | EXHAUSTED + `detour:` line, 2.2–3.0 s |
| L26 25→27 | EXHAUSTED 1.1 s | EXHAUSTED + `detour:` line, 6.3 s |
| L22 30→21, 30→29 | EXHAUSTED 2.7–3.4 s | ⚠ **declines differently**: DETOUR certified a corridor (via (88,168)) and the **drive stalled** on it (*"not reached within 400 ticks … grazing tree@64,176"*), then the re-plan refused. 5.1 / 10.5 s |

The other 10 EXHAUSTED legs (danger not chaser-only: L6, L22 25→29, L63 ×4, L104 ×2, L105 ×2) have **byte-identical words** at head.

## D3 — the verdict table (the rules arc's input for the derivation)

From the captured arrival. `primary` is slot 0, which is how `stagingFromWasmArrival` stages it. Each item alone. ms are single runs on a loaded 4-core box.

| inventory | primary weapon | base `a2d10de` (none / all) | head (none / all) |
|---|---|---|---|
| **∅** | — | **DECLINE** EXHAUSTED, 1.1 s / 1.1 s | **SOLVES** DETOUR, 173 t, 0 hits (4.7 s / 4.6 s, load-sensitive; 2.3 s alone) |
| **Sword** | `sword` | SOLVES, AVOID with strikes: 145 t / 118 t | **same keys** (hash `7f0165df18` / `36cd4f6200`) |
| **Spear** | `spear` | DECLINE EXHAUSTED | SOLVES DETOUR, 173 t |
| **Wand** | `wand` | DECLINE EXHAUSTED | SOLVES DETOUR, 173 t |
| **Dark Sword** (alone) | none (no slot without the Sword) | DECLINE EXHAUSTED | SOLVES DETOUR, 173 t |
| **Fire Wand** | — | model refusal: *"the tape presses X with slot 0 holding the FIREWAND (item 5) … refused rather than approximated"* (thrown reading `primaryWeapon`) | same |
| **Ghost Sword** | `ghostsword` | model refusal: *"a ghostsword press routes the slash rect through `genericHit`'s Spear arm … Neither is modelled (R5)"* | same |

**⇒ L14's requirement, as the solver derives it at head: none.** The Sword solves it shorter (145 t vs 173 t).

## Deltas

| row | before (W0) | after (head) |
|---|---|---|
| identity log | `aa46950b…` | the 22 measurement rows and six `--check`s identical. The reference row first read **4 DIFFER**: the two new scripts enter the instruments index. After `generate-procgen-reference` it reads **ALL 7 + 5 MATCH**, so the log is identical |
| tapeRunner | 465/465, `77472b1e…` | **467/467**, `1c06e410db5c3c653b0e2e2039be4667`. The 465 old pairs are identical, plus the witness's differential and stepping rows |
| roster | 204 | **205** (`l14-swordless-detour`) |
| solver surface | GREEN 193 | GREEN 193 (`--write`: site counts only) |
| constants | PASS 4,965 | PASS 4,965 (0 new / 0 vanished / 0 moved) |
| bounded vitest | 47 files / 2,115 green | the W0 set plus `fidelityL14`, `procgenDocs/*`, `seedlingSolverSurface` and `seedlingConstantsCensus`: **58 files / 2,675 tests, 2,673 green after the `dialogueAutoAdvance` fix**. Reds: `rosterCategories:175` (`expected 144 to be 145`, the bank row) and `jsRuntimeVanillaDelivery` (below) |
| `R8_ENEMY_BRIDGE` exposure | 44 | **45** |
| ladder | `avoid dodge pull time bait kill` | **+ `detour`** (conditional) |

**Files changed:**
- `solverBot.js`: the rung, the hook, `stopWhen`.
- `r8Acceptance.js` and its test: the ladder row and the bridge row.
- `fidelityL14.test.js` (new, 6 rows).
- The witness tape and its expectation, `index.json`, and the four roster pins (204 → 205).
- `seedling-solver-surface.json`.
- Docs: `seedling-bot.md`, `seedling-bot-log.md`, and the regenerated reference.
- Two scripts.

## What the brief got wrong (measured)

1. **"A swordless crossing needs a DIFFERENT idea of baiting (leash-luring, body-blocking)."** It needs neither. The walk is ~4× faster than a bob in the model, so a corridor that goes round the pack along a wall is enough. What the solver lacked was a rung that asks about a *longer* corridor: every existing rung asks about the planner's shortest one, or about a stance to wait in.
2. **"A new rung tried only where the ladder is EXHAUSTED ⇒ no committed solve can change."** True for committed tapes (none moved), but not sufficient. An unconditional rung **flipped two committed census pins** (`solverSpinnerKill`, spinner rooms REFUSED → SOLVED). It also **timed out** the slice-10 L16 refusal rows (73 s). And it flips the JS arc's own pin of the L14 decline (`jsRuntimeVanillaDelivery`). The first two are fixed in-rung (chaser-only condition; cost bounds). The third is the intended effect, in a file outside my lane.
3. **"The S4/combat refusal census rooms."** No committed census by that name exists on main. S4 is the JS arc's fresh-boot leg survey in `l16-budget-report.md`. I ran captured arrivals plus a derived vanilla fresh-boot population instead (above).
4. **Dark Sword as "any other weapon the solver uses":** alone it gives **no** inventory slot (`slots []`), so the solver sees ∅. The Fire Wand and Ghost Sword are **model** refusals, not solver verdicts.
5. **"The six `--check`s".** They all exited 0 at the base (the brief did not say whether any was red), and they are unmoved.

## Residue

| # | item | owner |
|---|---|---|
| 1 | **`jsRuntimeVanillaDelivery.test.js:231` reds.** It pins *"the FIRST refusal is the solver's decline at L14"*, and the JS runtime now solves L14: in-place, dashless, 173 keys, 2.7 s, L15, 0 deaths, measured with a copy+restore probe of the test. Proposed patch: retitle the case and replace the `lastDecline` assertion with `walk(rt, doorGoal(14, 15))` → `DONE`, `rt.run.level === 15`, `declines: 0`. ⛔ Not edited: `jsRuntime*` is the JS arc's | JS arc |
| 2 | **`rosterCategories:175` bank row** (144 → 145). This is `standing-values --write` only, which is forbidden here | coordinator |
| 3 | **The cost of a failing chaser-only climb** (L16 ~10–14 s, L25/L26 2–6 s). `deriveChaserDetour` takes no `shouldStop` yet. SF's hook belongs there, and a cheaper leg plan (no string-pull for via legs) would cut L16's ~35 ms per leg | SF / budget |
| 4 | **L22 30→21 / 30→29: a certified DETOUR corridor stalls in the drive.** The preview walked it clean, and the drive did not reach (88,56). Both legs still decline (the run is the truth), but the preview/drive equality fails on a corridor no committed walk took. Unwitnessed and undiagnosed | fidelity |
| 5 | **The witness is new**, so the full tier owes it a CI drive (`check-seedling-full-tier-owed`) | CI |
| 6 | `check-procgen-help` lists 25 pre-existing FAILs, none of them this slice's scripts (both new scripts pass) | — |
| 7 | **Merge order with SF.** I edited none of SF's function bodies. The hook is one block after `rowFor('kill', refused)` inside `climbLadder`, plus one optional `previewWalk` parameter. If SF lands first, rebase onto it and re-run `fidelityL14` + `plan-seedling-l14-swordless --check` | whoever merges second |

## Byte-inertia

- Every identity measurement row and all six `--check` digests are equal to W0's. The reference row is equal after its regeneration; only the instruments/docs counts for the two new scripts changed.
- tapeRunner's 465 old pairs are identical.
- No committed tape moved. `campaign-frontier.json` is untouched. There is no AS3, wasm, gitlink, rules or requirement edit.
- I did not run `standing-values --write` or `pytest`, and ran no unfiltered vitest.
- Every refusal whose danger is not chaser-only keeps its words, measured on 10 vanilla legs.

## The identity rows the coordinator must BANK

- **Unmoved** (all of W0's): identity log `aa46950b5958b32136111155250dd253`, and six `--check`s `405d9c4b` `8e7a43be` `33d20889` `35456fbc` `6cd35fe1` `b29b589b` (full digests above), all exit 0.
- **tapeRunner 467/467**, pairs md5 **`1c06e410db5c3c653b0e2e2039be4667`**. **Roster 205.**
- New fixtures:
  - `l14-swordless-detour` tape **`e9b170d64b6ac821724dd2383f5501ac`**
  - its expectation **`a51d52f0b30f80fa71dc0653bd66999d`**
  - `fixtures/tapes/index.json` **`4aec7ba4228638d4f709877ea21aa1ff`**
- Surface table `seedling-solver-surface.json` **`ff9bd45b55399bb8e5b28d4914151c63`** (GREEN 193). Constants PASS 4,965.
- The composite roster row (`rosterCategories:175`) is owed one tape (145).

**Scratch** (not committed): the scratchpad's probe/solve/census scripts and logs, the two worktrees (`/home/user/l14w` head, `/home/user/l14base` base, symlinked node_modules and submodules), and both identity logs.
