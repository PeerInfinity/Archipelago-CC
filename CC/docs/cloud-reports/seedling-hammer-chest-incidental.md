# Seedling hammer-phase CHEST-INCIDENTAL — `CHEST_LEG_DELTA` (OFF): the chest leg's exact set is the leg's delta

Session `seedling-hammer-chest-incidental` (Opus, cloud), planner `seedling-hammer-phase-planning-2`. ⚖ Queued by the user
2026-11-03; a lone slice. No mid-run scope message was received.

## 1. SHAs

| | |
|---|---|
| start (main) | `491f3286d9` (`train: rules-certifier-tail a53112f7d4`) |
| branch | `claude/seedling-chest-incidental-bo3y6s` (on main's base, NOT on the lab's branch) |
| head | the commit that adds this report (the last on the branch); the code-final head is `ed2f16709e` (JSUT 41678782408 green) |
| the lab's branch | `origin/seedling-gen-chest-loot-goal` @ `54abcfcaee`, NOT on main at start: measured in a throwaway worktree with it merged (`git worktree add --detach` + `git merge`), never committed here |

## 2. The answer first

**The one thing to know first: the brief's cause is wrong. There is no incidental open.** The loot chest is dropped
because `botDriverV2.runChest` checks its effect against the VISIT's open set, not the leg's. A chest stays open for the
rest of the visit once `open()` has run, so the SECOND chest leg of any visit sees the FIRST leg's chest (opened by name)
and refuses with *"the leg opened [A B] and named only B. A chest the leg did not name …"*. Every room with two chests
both named fails this way, whatever the walk crosses.

| question | answer (measured) |
|---|---|
| Is the 11/12 reproduced? | Yes: 11 of 12 rooms (empty + winding, seeds 1–6, pre-sword 10x10, `goalClass: 'chest'`, `chestloot`) graded `the-skeleton-does-not-solve-with-the-element`, all with the chest leg's text. The 12th (winding seed 6) is `the-stance-is-not-floor`, unrelated. |
| The refusal's site | `frontend/modules/seedlingDemo/botDriverV2.js` `runChest`, the "THE EFFECT, AS AN EXACT SET" block (5366–5374 at head; 5366–5370 at start). Not `solverBot.js`. |
| The trigger line | `chestProbeLine(target.x, target.y)`, the one-pixel row under the chest; the stance band is two integer rows (`chestStanceBand`, `[66, 67]` for a chest at y 48). |
| What the run records for the open | `run.ledger('chestOpens')` `{t, level, id, persistTag}`, `run.ledger('sealCollections')`, and `run.entities('openChests')`, the visit's open set, which keeps the chest. |
| Which chest was "unnamed"? | In **11/11** refusals, the chest the previous chest leg opened by name. It is in `before.chests` (the pre-approach snapshot) and opened at the previous leg's tick (empty seed 1: `chest@128,16` at t107, leg 1; the refusing leg 2 targets `chest@112,96`, opened t286). |
| Does any walk open a chest it did not name? | **No.** 0 in 100 lab rooms; 0 in 64 hand-built two-chest rooms (adjacent and diagonal pairs, four starts, one or both named). A walk along the row directly under an unnamed chest (a one-tile corridor) does not touch the two-pixel band. |
| Game witness | p4g headless logic-only: the solver's ON tape (244 ticks) opens chest A and then chest B on one visit; the game clears both tags (`{0,1}`, `{0,2}`), and the model is 0 px over all 245 observations. |
| The fix | `CHEST_LEG_DELTA` (OFF): the exact set is the chests open now minus those open before the leg's approach. It must still be exactly `{target}`, and the record carries `openBefore`. |
| Before → after (ON) | 12 rooms: **0/11 → 11/11** loot chests kept. 100 lab rooms: **19 → 97** kept (the 19 OFF keeps are all one-chest rooms). Hand-built: **32/64 → 64/64**. |
| ON radius | ON = OFF wherever OFF passes (the proof is in §5), so ON moves only solves that met this refusal. Measured: the identity block (every producer's `--check` hash) is identical ON and OFF, and the bounded set, the hammer slow files and `ci-producer-checks` are green both ways (§6). |

## 3. W0 — reproduce

- **Recipe.** `generateSeedlingLevel({seed, palette: PRE_SWORD_PALETTE, defaults: {width: 10, height: 10, goalClass:
  'chest'}, skeleton: parseSkeleton(kind), elements: parseElementSpec('chestloot')})`, the lab's own B1+B3 row
  (`procgenChestLoot.test.js` "B1 + B3 together"). Evidence: `…-evidence/w0-twelve-rooms.txt` (OFF and ON, one JSON line
  per room).
- **Attribution.** A scratch probe in `runChest` printed `before.chests` and the leg's own gain for every refusal: in
  11/11 the gain is exactly `[target]` and the extra chest is in `before.chests`. The ENTER trace shows a successful
  `runChest` naming that chest earlier in the same solve (for empty seed 1, the goal chest is the first leg).
- **The lab's rows, in the scratch tree.** `procgenChestLoot.test.js` + `chestLoot.test.js`: OFF 28/28; ON 27/28, and
  the one red is the lab's own gap pin "B1 + B3 together: the loot chest is DROPPED (graded)", which ON makes false (the
  lab flips it when the switch flips). `seedlingGenChestLootAp.test.js`: 16/16 OFF and ON. (`…-evidence/w0-lab-rows.txt`;
  the AP file needs the non-wasm submodules checked out, not symlinked: a symlinked `shared` loads twice and throws
  `registerBackend: duplicate id 'empty'`.)
- **Game witness** (`scripts/procgen/probe-seedling-chest-incidental.mjs`, `…-evidence/w0-game-witness.log`,
  `…-evidence/game/chest-incidental-game.json`). It uses a hand-built 10x10 room (chest A (4,3) tag 1, chest B (6,3) tag
  2, boot (1,8)) delivered as a one-room set (`buildLevelSet`); the solver's tape for [A, B] with the switch ON; p4g,
  headless logic-only (the GPU device lost at the first present, as designed). 4/4 PASS: the tape ran to its end (245
  obs); the game cleared `{0,1}` and `{0,2}`; the model's `chestOpens` = A at t66 and B at t174; 0 px over the whole tape.
  The witness is the fact the OFF check misreads: the first chest is still open (its tag still cleared) while the second
  leg opens the second chest. The fixture `frontend/modules/seedlingDemo/fixtures/chest-incidental-game-p4g.json`
  (11 KB) carries the game's stream, and a row replays the rebuilt tape against it.

## 4. M — the design check

| design | measured | verdict |
|---|---|---|
| (1) the leg tolerates and records an unnamed chest's open | no case anywhere: 0 incidental opens in 164 rooms. The refusals it was meant for are not incidental. | not built: there is nothing to tolerate, and tolerating an open no room exhibits is the "accept an open the model did not see" mutant |
| (2) the walk avoids the other chest's trigger line | no walk crosses one (a corridor walk under a chest misses the two-pixel band) | not built (planning around an interaction, with no case) |
| (3) the solver names both chests as goals | this is what the lab already does (`model.goals = [loot, goal]`), and it is exactly what refuses: the second named leg | the status quo, refused |
| **(4) the exact set is the leg's delta** (`CHEST_LEG_DELTA`) | 12 rooms 0/11 → 11/11; 100 rooms 19 → 97; hand-built 32 → 64 of 64; the game witness at 0 px | **built, OFF** |

Scratch measurements: `…-evidence/w0-hundred-rooms.txt` (100 lab rooms: empty, winding, bushy, loopy and branchy ×
seeds 1–20; ON leaves 2 `the-chest-walls-off-its-stance` and 1 `the-stance-is-not-floor`, both the generator's own
refusals) and `…-evidence/m-handbuilt-64.txt` (8 chest pairs × 4 starts × goals `b` | `ab`: OFF `ab` 32/32 REFUSED,
`b` 32/32 SOLVED; ON 64/64 SOLVED).

## 5. I — the fix

- **Module** `frontend/modules/seedlingDemo/chestLegDelta.js`: `CHEST_LEG_DELTA` (`SEEDLING_CHEST_LEG_DELTA === '1'`),
  `CHEST_LEG_DELTA_DEFAULT = false`, `withChestLegDelta(enabled, fn)`, and `chestLegOpened(openNow, openBefore,
  targetId)` → `{opened, openBefore, exact}`. OFF: `opened` = the whole set (the pre-slice array, same order) and
  `openBefore` = `[]`. ON: `opened` = the set minus `openBefore`, and `openBefore` = the excluded chests still open, sorted.
  `exact` = `opened` is exactly `[targetId]`, either way.
- **The one edit in `botDriverV2.js`** (the chest leg's check only, by the brief's exception): `runChest` asks
  `chestLegOpened(run.entities('openChests'), chestsBefore, target.id)` and fails on `!exact`, with the same text.
  `chestsBefore` is the existing pre-approach snapshot (`before.chests`), already used by the positive control. The record
  gains `openBefore`, only when non-empty.
- **`SOLVER_ENV_NAMES`** gains `SEEDLING_CHEST_LEG_DELTA` (sorted).
- **OFF is byte-identical:** the same array, the same comparison, the same text, and no record field.
- **The ON radius, by construction.** If OFF passes a leg, the visit's open set is exactly `{target}`. The positive
  control already refused a target that was open before the leg, so `before.chests ∩ open = ∅`, ON's delta is the same
  `[target]`, and `openBefore` is empty: the record and the tape are identical. ON differs only on a leg OFF refused by
  this text, so the movers are solves that met this refusal (and whatever their fallbacks did after it). By mover class:
  **chest-leg solves only**. No other verb reads the switch.
- **Rows** `frontend/modules/seedlingDemo/hammerChestIncidental.test.js` (12): ships OFF (the default, the env, the
  channel); `withChestLegDelta` restores; the `chestLegOpened` units OFF and ON, and ⛔ "a chest the leg itself opened
  beyond its target is NEVER excused"; a source row on `runChest`'s call and record; a two-chest room OFF refuses by the
  leg's text / ON keeps both (two sealpiece collects, the second record `openBefore: [A]`); identity ON = OFF for a
  one-chest room and for a two-chest room with one goal (records, tape and certification compared as JSON); the game
  witness's fixture (both tags, the ledger) and the rebuilt ON tape replayed at 0 px against the game's stream.
- **Mutants** (`…-evidence/i-mutants.txt`, each reverted from a copy):

  | mutant | red rows |
  |---|---|
  | (a) drop the record (`openBefore` not spread) | 2: "ON keeps both chests", the source row |
  | (b) accept an open the model did not see (`exact` = nothing new, or the target among them) | 3: "never excused", the OFF unit, "OFF refuses by the leg's text" |
  | (c) the delta taken OFF too (the `enabled` gate dropped) | 2: the OFF unit, "OFF refuses by the leg's text" |

## 6. D — gates

All evidence is under `CC/docs/cloud-reports/seedling-hammer-chest-incidental-evidence/`.

| gate | OFF (defaults) | ON (`SEEDLING_CHEST_LEG_DELTA=1`) | file |
|---|---|---|---|
| bounded vitest by path (⚖ 52): 14 files (the new rows, `solverEnvChannel`, `strategySwitch`, `botDriverV2`, `chest`, `fidelityChestSeal`, `fidelityL1516`, `procgenChestDoor`, `procgenChestGoal`, `seedlingGenChestDoorAp`, `jsRuntimeGeneratedSolver`, `jsRuntimeVerbs`, `solverBot`, `r7Acceptance`) | 498/498 | 498/498 | `d-vitest.txt`, `d-vitest-files.txt` |
| hammer `*.slow` (9 files) | 20/20 (3888 s) | 20/20 (3618 s, solo re-run: the first ON arm was cut off by the session's 2-hour background limit, not by a test) | `d-slow.txt` |
| `ci-producer-checks` (`--jobs=3`: a 4-core box shared with the slow arm, not 4) | 97 run, 0 red, 1 skipped | 97 run, 0 red, 1 skipped | `d-producers-{off,on}.txt` |
| …the skipped producer, `plan-seedling-r7-ends-meet --check` (needs a server) | CHECK CLEAN | CHECK CLEAN | `d-r7-ends-meet.txt` |
| identity block (`identity-block.sh`) | = the start SHA on every row (two environmental lines: `generated set` is blank at the base worktree, which has no wasm submodule; the reference line, regenerated afterwards) | = OFF, byte for byte, every row, including every producer's `--check` hash | `d-identity.txt` |
| `census-seedling-solver-surface --check` | `--write`: the closure gains `chestLegDelta.js`; 371 rows, no new row to classify | — | `d-census.txt` |
| `census-seedling-constants --check`, `derive-seedling-tick0 --check` | PASS, PASS | — | `d-census.txt` |
| `generate-procgen-reference` → `check-procgen-reference`; `generate-docs-index --check` | regenerated (the new probe, the docs); ALL CHECKS PASSED; OK | — | `d-census.txt` |
| `check-seedling-wasm-ship` (headless, p4g) | 415 PASS, 0 FAIL (incl. GENERATE, ROOM, CAMPAIGN) | — | `d-wasm-ship.txt` |
| `solverEnvChannel.test.js`, `strategySwitch.test.js` | in the bounded set, green | green | |

**JSUT.** Run **41678782408** at `ed2f16709e`: **suite 25161/25161 passed, 0 failed; slow battery 375/375** (`ci-summary.mjs
--run=41678782408`). The earlier run 41663978336 (`418c810a`) was red on 6 rows that this slice caused, all fixed in
`ed2f1670`:
- 3 × `contentIdentity`: the witness fixture's `set_id` field was read as a stamped level set. It is now `witness_set`.
- `entityBlocks` D2: a docblock in `chestLegDelta.js` spelled the `openChests` entity read literally, which the family
  grep counts as a reader. Reworded.
- `boxLock`: the probe's take sits behind its import door. Now listed with the other conditional takers.
- `procgenDocs/generated` `--check`: the reference before the regen.

None of these rows is in the bounded set I ran first. The lesson for the next slice: run the repo-wide document gates
(`contentIdentity`, `entityBlocks`, `boxLock`) when adding a fixture, a probe, or a module that names an entity family.

## 7. What the harvest A/B should expect, and the ON sweep to run

- **OFF: no movers.** OFF is the pre-slice code byte for byte (§5).
- **ON:** movers only where a solve met *"A chest the leg did not name"*. At the defaults none of the local gates met
  it. The vanilla route rarely opens two chests in one visit, and where it would, OFF has been refusing all along, so a
  sweep mover would be a leg that newly SOLVES (or reaches a later wall).
- **The exact ON sweep dispatch** (`seedling-divergence-sweep.yml`, on `claude/seedling-chest-incidental-bo3y6s`):
  `mode=inv`, `producer=solver`, `page_legs=1`, `keys=` empty (every leg), `solver_env=SEEDLING_CHEST_LEG_DELTA=1`,
  and the same dispatch without `solver_env` as its OFF control. Expect zero movers, or only legs whose OFF log carries
  the chest leg's text. Any other mover is a defect in this slice.
- The lab's arm, for the flip: with `SEEDLING_CHEST_LEG_DELTA=1`, `procgenChestLoot.test.js`'s "B1 + B3 together" row
  reds (the gap closes). The lab re-pins it to "both chests certified" when the switch flips, and its sweep
  (`sweep-yield-table.mjs --goal=chest --elements=chestloot`) should move from ~19% to ~97% loot chests kept.

## 8. What the brief got wrong (measured)

1. **The cause.** "The walk to one chest crosses the OTHER chest's line, the game opens it": no. The other chest was
   opened by the previous named leg, and the check reads the visit's set. 0 incidental opens in 164 rooms.
2. **The planner's direction** ("the leg accepts an unnamed chest's open … and RECORDS it") therefore had no subject.
   What is recorded ON is the chests the check EXCLUDED (`openBefore`), and their collects were already recorded by their
   own legs (`certification.collected` gains both sealpieces).
3. **The site:** `botDriverV2.js` `runChest`, not `solverBot.js` (the brief allowed either).
4. **"11/12" is right, but the 12th is not the gap:** winding seed 6 refuses `the-stance-is-not-floor`.

## 9. Residue and hand-overs

- **To the lab** (`seedling-gen-chest-loot-goal`): when `CHEST_LEG_DELTA` flips, re-pin "B1 + B3 together" to both
  chests kept. The note in that row ("the walk … crosses the other's trigger line") is the misread reported here.
- **To the planner:** the ON sweep above. An AP note: a goal-chest room's two chest legs each produce their own chest
  record, so the location carrier (`summary.lootChests`) has both opens to read. Playback targeting (gap 2) stays the lab's.
- **Not measured here:** a true incidental open, because none exists to measure. If one appears (a room whose chest
  stance band is ON another chest's walk), ON still refuses it by the same text, and that is where design (1) would be
  weighed, with a case.
- Scratch worktrees were removed at the end (`wt-lab`, `wt-base`); the two dev servers (ports 9743, 9744) were stopped by
  PID.
