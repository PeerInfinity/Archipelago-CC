# seedling-fidelity-unbilledhits — wave 44 (planner `seedling-fidelity-planning-21`)

**Verdict: STOP after D1 (the brief's own STOP rule). D3 done. No D2 key was added.** The model already
bills these hits, at the game's exact ticks and positions. "Unbilled" means the solver's forced-hit ledger
(`plan.forcedHits`) holds no row for them. That is a solver-acceptance question, and the existing OFF switch
`CONTACT_FIDELITY.unbilledDamageGate` (`solverBot.UNBILLED_DAMAGE`) is the one that decides it.

## 1. Start, head, branch
- Start: `62958fa4742e23dbc33c08ac2232df883f1102ee` (origin/main, "train: seedling-map-check"). 135 contactFidelity keys, 125 default ON (measured in node).
- Head: see the last commit on the harness branch `claude/unbilled-hits-fidelity-l4xc70` (local `seedling-fidelity-unbilledhits`). Code head `afe423f9` (D3); then `a8066835` (solver-surface census `--write`) and this report.
- Not rebased, no `main` push, no stash, no force-push.

## 2. D1 — the witness
**Method.** Hammer's keyed capture sweep, run **43739354840** (ref `hammer-scratch/main-pin-80650`, head 80650ed1b6), artifacts
`divergence-shard-1/-2` (`requests-*.jsonl`, `rows-*.jsonl`) fetched with `gh run download`. `divergence-merged` was not in the
download, and the shard rows were enough. Each leg's first captured request was replayed in node at my base, the same way
`replay-seedling-solve-request.mjs` does it (`solveAnytime`, the captured passes and budgets). The plan was then run on a fresh
`replayTape` of the staging, recording per tick: the player, the damage state, each chaser, every new `playerHits` row and every
new `contactsSuppressed` row. Tools: `seedling-fidelity-unbilledhits-evidence/tools/trace.mjs` (`trace2.mjs` adds `--pass=`).
Traces: `evidence/d1/trace-128.txt` (t440–541) and `trace-308.txt` (t90–191). Plans: `evidence/d1/plan-*.json`.

**The plan at my base still matches the capture.** It has the same tick count as the captured row (541 for 128, 191 for 308), and
the same end, to the bit: 128 ends at (445.92267885076507, 258.043640504536) with 0 deaths, 308 ends at (184, 56) with 1 death.
These match the sweep's `expectedEnd` and the game's end.

### Key 128 — L12 r0c19 ← in_L35_32_64 → flag 5 (bosslock@432,240), keylock 541 t
| t | player | puncher@416,256 | model decision |
|---|---|---|---|
| 462 | (440.84,258.04), keys idle from here to 541 | (417.20,261.09), chasing | — |
| 482 | idle | (431.03,261.09): d ≤ 10 → wind-up starts (`chaserAttackDecision`; 11 updates) | — |
| 487–492 | idle | (432.81,261.12), v 0 (solids include "Player") | — |
| **493** | → (445.25,258.04) | punch fires | **HIT `punch`, hits 1, knockback dx +4.67, shake 5** |
| 509 | (445.92,258.04) | second punch | suppressed: `hitsTimer` (player i-frames) |
| **520** | (445.92,258.04) | punch | **HIT `punch`, hits 2, dx +4.86** |
| 531 | — | punch | suppressed: `hitsTimer` |
| 541 | end (445.92,258.04), deaths 0 | (437.76,260.01) | — |

Game (botStatus `hits_timer` sampler): **493 @445.25,258.04 · 520 @445.92,258.04**. The model matches at ±0 ticks with identical
positions. The "no visible knockback" in the brief is about y. The knockback is in **x** (+4.7 px).

### Key 308 — L30 r2c10 ← in_L31_160_384 → flag 0 (bosslock@64,32), walk 191 t
| t | player | bobsoldier@48,80 | model decision |
|---|---|---|---|
| 130–150 | (72.06,50.05), idle | climbing from (71.84,65.32) to (71.84,55.27) | — |
| **151** | (72.06,50.05) | (72.06,54.76) | **HIT `chaser` (body contact), hits 1, knockback dy −3.0 (blocked: landed y)** |
| 152–155 | — | — | suppressed: `hitsTimer` |
| 170 | — | — | sword suppressed: `hitsTimer` |
| **171** | (72.06,50.05) | (72.55,57.10) | **HIT `sword`, hits 2, dy −2.99 (blocked)** |
| 176–190 | — | — | chaser and sword suppressed: `hitsTimer` |
| **191** | → respawn (184,56) | — | **HIT `sword`, hits 3, died: true** |

Game: **151 @72.06,50.05 · 171 @72.06,50.05**, and the game's leg ends at (184,56). The sampler's "max 2" is the death resetting
`hits`. The model matches at ±0 ticks, and its plan already predicts the death (`expectedEnd.deaths: 1` in the sweep row).

### AS3 cites (the game's hit path, which the model does take)
- `Enemies/Puncher.as:111-117` decides the attack (`d <= attackRange`, 10). `:127-143` `endAnim` → `attackPlayer()` at the wind-up's end. `:172-218` `attackPlayer`: its own `hitsTimer` gate, the re-aim, the `r = 8` box, `p.hit(this, punchForce, …)` (`:216`). `:167-170` empty `knockback`. These are transcribed in `chasers.js` (`chaserAttackDecision`, `puncherPunchRect`) and `levelRun.punchNow`.
- `Enemies/Enemy.as:211-218` `hitPlayer` → `p.hit(this, 3, …)`. `Enemies/BobSoldier.as:161-169` `swordHitting` → `hitPlayer.hit(this, 3*damage, …)`.
- `Player.as:1374-1401` `hit`: the `hitsTimer`/`hitsMax`/freeze gate, `hits += d`, `die()` at `hitsMax`, otherwise `knockback`.
- **Why the plans stand in reach:** `Puzzlements/BossLock.as:58-90`. Activation latches. Then `keyTimer` counts 60, then alpha fades 0.05 per tick (20), and only then `Game.setPersistence(tag, false)`. That is ≈80 ticks between the "up" press and the flag. Both plans idle in place for that whole wait (128: t462–541; 308: t~110–191), beside the room's only chaser.

### Cause, per family
- **L12 (keys 127/128/160/161/171/172): solver stance, not model.** The keylock plan waits out the BossLock fade 12–13 px from `puncher@416,256`. The puncher walks up, and its punch lands twice. The model bills both hits (`playerHits`, source `punch`). The plan ships because nothing in acceptance weighs a hit the forced-hit rung did not bill. I replayed key 128 only. The brief's other five L12 keys have no captured requests in that run. Their hit rows have the same signature (first hit at the lock's x+12–14, then the 445.9 knockback rest), so I expect the same cause, but that is **not measured**.
- **L30 (key 308): the same shape, and worse.** The full pass's 191 t plan dies on its last tick (3rd hit), which the model also predicts. The dashless pass found a **255 t hitless** plan (`trace2.mjs --pass=dashless`: 0 hits, 0 deaths). `betterAnswer` keeps the shorter one (`jsRuntimeSolver.js:360`: plan length only).
- **The two families are the same mechanism** (an idle wait in reach of a chaser), with different bodies (puncher punch vs bobsoldier body plus sword). Neither is a model gap.
- Hammer's step-227 `spinningaxe@128,64` hits (L98, under the reverted KILLLOCK_LINE_STANCE): not examined. My cause says nothing about a model gap there.

### The gate, measured ON (`SEEDLING_UNBILLED_DAMAGE_GATE=1`; `evidence/d1/gate-on-*.txt`)
- **128: REFUSED.** "UNBILLED DAMAGE — the segment reached its 1 goal(s), but its drive took 2 hit(s) no plan billed [t357 (run t358, L12) punch:puncher@416,256, t385 (run t386, L12) punch:puncher@416,256] (the forced-hit rung billed 0)". Both passes leave the punch in reach, so with the gate the leg has no plan.
- **308: PLAN 255 t, 0 hits, 0 deaths.** This is the dashless plan, so with the gate the leg comes out hitless.

## 3. D2 — not built (STOP)
The brief's STOP rule applies: there is no model-side cause. A new contactFidelity key that "bills the hits" would bill them a
second time. No key was added, so `CONTACT_FIDELITY_DEFAULTS` still has 135 keys, 125 ON. Nothing was added to `SOLVER_ENV_NAMES`
and no pin was changed.

**Byte-inertia, for the whole slice (D3 only):**
- `git diff --name-only 62958fa474 HEAD | grep -aE 'fixtures/|golden|tapes/'` → **empty** (rc 1).
- `batch-seedling-acceptance.mjs | md5sum`: base **391322d681b7aa0229d94b3f6906d024** (measured with the base levelRun.js and camera.js checked out in place, then restored) and head **391322d681b7aa0229d94b3f6906d024**. There is no ON arm because there is no key.

**Census / sweep economy:** no key, so there is no ON arm to sweep and no OFF sweep is owed. For the planner's later decision on
the existing **`unbilledDamageGate`**, name this keyed ON-arm sweep: keys **127, 128, 160, 161, 171, 172, 308**, `contact_fidelity=`
with `unbilledDamageGate` added, shards = min(10, 7) = 7, ×1 per arm, with `capture_requests` on. Prediction from §2: 308 turns
hitless (255 t), and the L12 six refuse unless hammer's keylock stance moves.

## 4. D3 — text-only fixes (behaviour unchanged)
- (a) `frontend/modules/seedlingDemo/levelRun.js` — `bandKeptCaseAt` / `bandOpenerText` / `camBandCase` (beside `exactJiggleTime`, ≈l.5371-5383). The open sites carry the name: reboot settle ≈l.5419 (`rebootSettle`), `stepCameraNow` ≈l.5476 (`bandKeptCaseAt(viewTime)`, which gives `unsplit` / `noClock`, or names `shakeExactSplit` OFF), and the chaser forecast's `fbandCase` ≈l.8988 / ≈l.9016 (the live band's case, or its own open). The refusals now read "…the camera landed, and the band was opened by \`camera.SHAKE_BAND_KEPT.<case>\` — <the row's text>" in `onScreenNow` ≈l.5547 and `chaserForecast.onScreenAt` ≈l.9033. `acrossLoad` refuses at the load and never opens a band. `bandAlready` is the band staying open, so the name given is always the case that **opened** it. The recognisers' prefixes are unchanged (`pressKillGuards.isShakeBandThrow`, `surveyFamily` `/\`Game\.shake\`|is on screen at tick/`). The tests that match the old text match only the prefix and stay green. `fidelityLavaRunner.test.js` now pins the new text (its t155 grenade arm: `SHAKE_BAND_KEPT.unsplit`).
- (b) `levelRun.js` ≈l.5354: the SHAKEEXACT D1 comment now says `shakeExactSplit` is ON (⚖ 2026-10-25). `camera.js` ≈l.102 ("THE SHAKE, AND WHY IT IS A BAND") gains the note: split runs are exact, and only the `SHAKE_BAND_KEPT` cases band.
- (c) `fidelityIceTurretSpear.test.js` ≈l.117: `KILLLOCK_CHASER_REWIND` is ON and `KILLLOCK_LINE_STANCE` landed OFF (`solverBot.js:19717` `KILLLOCK_LINE_STANCE_DEFAULT = false`).
- `scripts/procgen/seedling-solver-surface.json` was regenerated with its own `--write`. Only line numbers moved (73 rows), and `--check` is GREEN.

## 5. Gates
- Bounded vitest **at head**: 49 files, **1542 passed**, 0 failed, `--maxWorkers=3`. The file list is in `/tmp` and not committed. It covers the brief's list, plus `fidelityArrowLane/F7/L40Guard/hammerPressKillGuards`, plus every non-train file that `grep -a -l` finds for `puncher`, `not indexable` and `SHAKE_BAND_KEPT`.
- **No "before" run:** the base-worktree setup for it was denied in-session. The change is text plus one test assertion, and the acceptance md5 is equal at base and head.
- `.train.` files were not run: there is no key, so there is no ON arm.
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red**, 1 skipped, 0 known-red.
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions match.
- Constants census `--check`: PASS (0 new, 0 vanished). Solver surface: regenerated, GREEN.
- CI `JavaScript Unit Tests` at `afe423f9` (the last code head; the later commits are JSON and docs, which the path filter skips): run 43740082735 **success**, suite **27821 passed / 0 failed**, slow battery 437/437.
- For the planner, name: `unittests_frontend.yml -f train_only=true` at head (not needed for a text-only slice; named because the brief asks).

## 6. What the brief got wrong (measured)
- "the model either never makes this puncher attack or never lets the attack land": both are false. It makes the attack and lands it, at t493 and t520 (key 128), the game's ticks.
- "y does not change, i.e. no visible knockback": the puncher's knockback is in x (+4.67 / +4.86 px). The bobsoldier's is in −y, and it is blocked by the wall (`landed.y`).
- L30's hits are not "2 hits and done". The leg's third hit kills the player at t191, the model plans that death, and a 255 t hitless plan exists.
- `acrossLoad` is listed among the cases that open a band. It never opens one: it refuses at the load (`settleCameraForLoad`).

## 7. Hand-overs
- **Hammer (solver):** (1) The keylock and walk executors idle through the BossLock's ≈80 t fade in reach of a chaser. A stance that steps out of reach after activation would make L12 hitless; activation latches (`BossLock.as:62-66`). (2) `betterAnswer` (`jsRuntimeSolver.js:360`) ranks only by length, so a 191 t dying plan beats a 255 t hitless one (key 308). (3) The flip of `unbilledDamageGate` is the user's licence. The §3 sweep measures it on these seven legs.
- **Planner:** run the §3 keyed sweep if the gate flip is on the table.

## 8. Residue
- Keys 127, 160, 161, 171 and 172 were not replayed (no captured requests). Producing them needs the browser sweep producer: run 43739354840's workflow with `capture_requests` on those keys.
