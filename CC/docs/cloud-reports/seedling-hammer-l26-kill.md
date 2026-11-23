# seedling-hammer-l26-kill — L26's two-puncher kill-lock from the chest route's L25 arrival (survey step 35)

## 1. SHAs

| | |
|---|---|
| Start (base) | `8894df078b` (`origin/hammer-scratch/rocklock-chest`: the chest-solid latch f884bf87c4 + the ROCKLOCK/FADE flip) |
| Branch | `claude/seedling-l26-kill-lock-qmf1cy` |
| Code commit | `b8a892ba` (the switch) |
| Rows commit | `fb51df0d` (test file + step-35 boot fixture) |
| Game witness commit | `cb5f63f5` (tool, tapes, log) |
| Head | this report's commit (the branch tip) |

Planner follow-ups: none arrived. I followed the brief as written.

## 2. The answer first

**New switch, OFF:** `KILLLOCK_STANCE_AS_FORECAST`. Turn it on with `SEEDLING_KILLLOCK_STANCE_AS_FORECAST=1`, or in a
test with `withKillLockStanceAsForecast(enabled, fn)`. It is read on the **worker / solver thread**, inside
`killLockChaserAttempt`. No main-thread mapper reads it.

**With it ON, step 35 solves: 508 ticks, 0 hits, 0 deaths, ends on L28.** The game agrees (p4g, fresh page): 508 of 508
ticks sampled, 0 game hits, ends on L28, and the game never parts from the model.

**The one thing to know first: this is class (a), and nothing about kill order or stance geometry was missing.**
- The arm's own first stance for `puncher@80,168`, (120,232), is a hitless line in the model.
- The same survey child at `--dash=none` solves with the switch OFF: 474 t, 0 hits, L28.
- The cause is the walk. `deriveKillByChaser` prices each stance on an **undashed** preview. The kill-lock attempt
  then walked there with a bare `walkTo`, which **dashes** (`planSwordDash`).
- The dashed walk arrives about 120 ticks before the forecast does. The second puncher is then in the same dwell.
- The combat ladder's chaser arm already walks its stance undashed (`KILL_STANCE_AS_FORECAST`, ON since 2026-10-10).
  This kill-lock arm was the one caller that did not.

**No step gains a hit.** On `--through=end`, ON vs OFF, solved goes 226 → 227 and hits stay the same 3 steps (24, 205,
223), which are pre-existing.

**The rules witness is not needed for this step.** A hitless Sword line exists in the model and in the game (§6).

## 3. The reproduction (measured at base)

`node scripts/procgen/survey-seedling-route.mjs --through=4.2 --only=35 --out=<f>` gives the brief's refusal, word for
word: *"no stance kills one of them in 5 attempt(s), each rewound (KILLLOCK_CHASER_REWIND)"*.

**Inventory at step 35** (the staged save grant):
- Sword (latched) and Shield ×1.
- Red Key, and 5 seal parts.
- No Ghost Spear, no Wand. Shield ×2 is not held.
- So the rule `Or(Shield×2, Ghost Spear, Sword, Wand)` is met by the **Sword** arm.

**The 5 attempts** (rewind ledger; every attempt starts from the arrival at t0):

| target | stance | the dwell was hit at | source |
|---|---|---|---|
| puncher@80,168 | (120,232) | dwell t55 (run t224) | puncher@32,208 |
| puncher@80,168 | (104,248) | dwell t56 (run t219) | puncher@32,208 |
| puncher@80,168 | (120,248) | dwell t63 (run t242) | puncher@32,208 |
| puncher@32,208 | (104,248) | dwell t56 (run t219) | puncher@32,208 (the target itself) |
| puncher@32,208 | (104,264) | dwell t67 (run t238) | puncher@32,208 (the target itself) |

**Attempt 1, traced tick by tick:**
- The dashed walk goes down the x≈72/88 corridor and strikes `puncher@80,168` once in passing (t97).
- It reaches (104,231) at t151 and settles at (120.5,231.5) by t168.
- Both punchers converge on the stance. Their homes are 62.5 px apart, inside the 80 px run range.
- The player strikes `puncher@32,208` at t193 and `puncher@80,168` at t213.
- The first puncher's 30-tick i-frame lapses at t224 and it hits first. Punchers take no knockback
  (`Puncher.as:167-170`), so it is still adjacent.

**Why the forecast scored that stance anyway.** The scan's preview of (120,232) arrives in 275 ticks (undashed). The
drive arrived at about t151.

**What else I ruled out:**
- *Upper-room stances* (where `puncher@32,208` is out of its 80 px range): the scan rejects every one, "the WAIT is
  dangerous at tick ~200 — chaser:puncher@80,168" (the target itself).
- *Booting the arm from an upper-room cell* (88,120): its stance (104,152) is hit by the target at the i-frame lapse.
  The press came 4 ticks early and the punch at the lapse lands first. Not this slice's cause.
- *The shield:* removing it from the staging changes nothing (still 5 hit attempts).
- *`KILL_STANCE_SIGHT=0`:* changes nothing.
- *Leg 286* (the same L26 (8,2) arrival, a page capture, Sword only) solves at 629 t, 0 hits, on its `dashless` anytime
  pass. That is what pointed at the dash.
- *`dashMode: 'none'`:* SOLVED 474 t, 0 h, ends on L28, through the survey's own child
  (`--step=35 --through=4.2 --route=full --dash=none`) and through my probe.
- *The undashed stance walk at the default dash mode:* SOLVED 508 t, 0 h, ends on L28.
- *`KILLLOCK_LINE_STANCE=1`* (shipped OFF): both punchers read as PINNED from the arrival, so the arm's scan is
  skipped. All 6 line stances are hit (dwell t96–110), with this switch OFF or ON. LINE_STANCE does not reach the line
  that works.

## 4. Design and change; OFF identity

**The change is one call site.** In `killLockChaserAttempt`, the stance walk becomes
`ctx.walkTo(goal, stance, {what, ...(KILLLOCK_STANCE_AS_FORECAST.enabled ? {undashed: true} : {})})`.

What does not change:
- the dwell (`guardedChaserDwell`) and its strike policy;
- the re-derivation;
- the rewind queue.

Also added:
- the flag object, `KILLLOCK_STANCE_AS_FORECAST_DEFAULT = false`, and the `with…` wrapper, as new exports beside
  `KILLLOCK_CHASER_REWIND`;
- the name in `solverEnvChannel.SOLVER_ENV_NAMES`.

The change is generic: it reads no level, coordinate, enemy id or Seedling constant.

**OFF is byte-identical.** Acceptance md5 (`batch-seedling-acceptance.mjs 2>/dev/null | md5sum`):

| | md5 |
|---|---|
| base `8894df078b` | `391322d681b7aa0229d94b3f6906d024` |
| tip | `391322d681b7aa0229d94b3f6906d024` |

**Regenerated:**
- `census-seedling-solver-surface.mjs --write` → GREEN `--check` (374 rows, unchanged bytes);
- `generate-procgen-reference.mjs` (0 findings);
- `generate-docs-index.mjs`.

None of these produced a tracked diff. No docs under `docs/json/developer/procgen/` were edited.

## 5. Rows and bounded vitest runs

`frontend/modules/seedlingDemo/hammerL26Kill.test.js` is in the default tier: 5 tests, 6.1 s. It solves from
`fixtures/hammer-l26-kill/survey-step-35-boot.json`, the survey's own 0-tick boot view (md5 `5a0011ec…`), as the survey
does (`twoPassSolve`), and replays each plan on a fresh run.
- **The switch:** ships OFF, the env name is on the channel, and the wrapper restores (thrown or not).
- **OFF:** refuses, and the rewind ledger is exactly the 5 rows above, all with "the dwell was HIT".
- **Control:** `dashMode: 'none'` with the switch OFF → 474 t, 0 hits, 0 deaths, ends on L28.
- **ON:** 508 t, 0 hits, 0 deaths, ends on L28.

**Bounded runs, OFF (the shipped state):**

| command | result |
|---|---|
| `npx vitest run frontend/modules/seedlingDemo/hammerL26Kill.test.js` | 5/5 |
| `npx vitest run frontend/modules/seedlingDemo/solverEnvChannel.test.js` | 11/11 |
| `npx vitest run …/hammerNewLocks.test.js …/jsRuntimeSolverRockLockMapper.test.js` | 36/36 |

**The NEW-LOCKS L26 legs with the switch ON.** Each keeps its verdict and 0 hits; only ticks and shas move. Their rows
pin today's (OFF) plans, so 5 assertions read the ON numbers as a difference (`SEEDLING_KILLLOCK_STANCE_AS_FORECAST=1`
on those two files: 31/36).

| leg | OFF | ON |
|---|---|---|
| 286 ALL (clear-tag) | 629 t, 0 h | 629 t, 0 h (same sha `2e67ef21dc8b`) |
| 289 ALL (clear-tag) | 315 t, 0 h | 318 t, 0 h, flag written at 317 |
| 289 → L28 door (rock+rewind, and ALL) | 357 t, 0 h, L28 | 354 t, 0 h, L28 |
| mapper 286 (solveAnytime, sight default) | 428 t, 0 h | 430 t, 0 h |
| mapper 289 | 315 t, 0 h | 318 t, 0 h |
| 911 L53 with LINE_STANCE (not shipped) | 606 t, 0 h | 574 t, 0 h |

A flip of this switch re-records those pins.

## 6. Game witness (p4g)

- **Tool:** `seedling-hammer-l26-kill-evidence/tools/witness-l26-kill.mjs`, adapted from L98-L99's.
- **What it does:** solves in node, folds the plan with `buildStagedTape`, replays the model on the survey's rooms and on
  the delivered set (`l25Sets`), and plays on `seedling_bot_ap_p4g`.
- **Setup:** headless logic-only, a fresh page per arm, under the box lock. The dev server was one I started
  (`serve-nocache.py 8000`) and killed by PID.
- **Outputs:** the log is `evidence/witness-game.log`; the tapes are in `evidence/witness/`.

| arm | ticks | sampled | model hits (survey / delivered) | game hits | end | parting |
|---|---|---|---|---|---|---|
| **ON** (default dash) | 508 | 508 | none / none | **none** | L28 | none |
| OFF, `dashMode: none` | 474 | 474 | none / none | none | L28 | none |

## 7. Census: which seed-1 divergence-sweep legs the change can move

**What the changed code is.** Only the kill-lock chaser arm's attempt walk (`killLockChaserAttempt`). It runs in:
- the rewound turns (`KILLLOCK_CHASER_REWIND`, ON);
- the line-stance turns (`KILLLOCK_LINE_STANCE`, OFF).

It moves a leg only when that leg's solve reaches a kill-lock's chaser arm **and** walks to a stance it is not already on.

**Static census of the rooms.** I ran `combat.killLocksIn` over the patched map; only these rooms hold a `tset == -1`
lock whose bill has a chaser:

| room | lock | bill |
|---|---|---|
| L5 | lock | bob |
| L26 | rocklock | puncher×2 (reached only with `ROCKLOCK_KILL`) |
| L53 | lock | jellyfish + puncher |
| L60 | lock | jellyfish |
| L71 | lock | lavarunner |
| L78 | lock | lavarunner + grenade |
| L98 | lock | jellyfish + ice turret |
| L99 | lock | lavarunner |

L18 and L39 count spinners only, which the chaser attempt never takes.

**Sweep legs.** In `seedling-divergence-legs.mjs`'s seed-1 list (908 legs), **63 legs** sit in those rooms. They are
listed by KEY in `evidence/census-killlock-legs.txt`:

| room | legs |
|---|---|
| L5 | 5 |
| L26 | 7 |
| L53 | 8 (1 skipped) |
| L60 | 3 |
| L71 | 29 (1 skipped) |
| L78 | 2 |
| L98 | 6 |
| L99 | 3 |

Every other leg is untouched by construction.

**The L26 keys:**
- `level_26__r2c4 <- in_L25_0_96 -> {exit:out_teleporter_64_304, exit:out_teleporter_144_32, location:L26 flag 0: rocklock@112,208 cleared}`
- `level_26__r2c4 <- in_L27_32_0 -> {the same three}`
- `level_26__r13c8 <- in_L28_0_96 -> exit:out_teleporter_144_208`

**On main's route.** `ROCKLOCK_KILL` is OFF there, so the L26 legs refuse before the arm runs and cannot move. The
candidates are the `lock` rooms' legs (L5, L53, L60, L71, L78, L98, L99).

**On the chest route** (this base), measured as survey movers, `--through=end`:

| step | room | OFF | ON |
|---|---|---|---|
| 35 | L26 | REFUSED | 508 t, 0 h |
| 81 | L53 | 655 t, 0 h | 784 t, 0 h |
| 123 | L60 | 443 t, 0 h | 418 t, 0 h |
| 230 | L98 | 537 t, 0 h | 488 t, 0 h |

All four are kill-lock rooms from the census; no other step moved. The full per-step table is in
`evidence/survey-on-vs-off.txt`. This census is static plus the route measurement. I did not run the divergence sweep
(no full sweeps).

## 8. What the brief got wrong (measured)

1. *"every one of 5 rewound kill stances gets hit during the dwell by the other puncher"*:
   - Only the 3 attempts on `puncher@80,168` were hit by the other puncher.
   - The 2 attempts on `puncher@32,208` were hit by **the target itself** (§3).
2. The premise that a stance or kill-order search was missing does not hold.
   - The arm's own stance is a hitless line in the model.
   - What fails is that the walk to it is not the forecast's walk (dashed vs undashed).
   - So the "measure first" fork lands on class (a). The rules witness is not this step's gate.
3. `--dash=none` on the survey parent does nothing.
   - The parent re-spawns each step as a child (`execFile … --step=N`) and does not forward `--dash` (`dashModeArgv` is
     never used there).
   - So `survey-seedling-route.mjs --through=4.2 --only=35 --dash=none` still refuses at dash `all`.
   - The child alone (`--step=35 --through=4.2 --route=full --dash=none`) solves. Not mine to fix here (§9).

## 9. Residue and hand-overs

- **Survey script (owner: whoever keeps `survey-seedling-route.mjs`).** The parent should forward
  `dashModeArgv(DASH_MODE)` to its per-step children. Today `--dash` on the parent is silently dropped.
- **The non-rewind path.** `execKillByChaser`'s own stance walk (used when the segment has no `forkRun`, or with
  `KILLLOCK_CHASER_REWIND=0`) still walks dashed. I left it out to keep to one call site. A flip that wants the same
  guarantee there is one more `undashed` key.
- **LINE_STANCE (OFF).** From the L25 arrival both punchers read as PINNED, so the pinned-skip hides the arm's working
  stance and every line stance is hit. That is a question for LINE_STANCE's owner if it is re-flipped.
- **Flip cost.** If the planner flips this switch: the NEW-LOCKS and mapper pins re-record (§5, ticks only), plus the
  three route movers 81/123/230 (ticks only, 0 hits). The landing needs the user's SHA-bound OK.
- **Pre-existing hits** on the chest-route survey, the same OFF and ON: step 24 (L16, 1), step 205 (L82, 2), step 223
  (L82, 2).
- **Tree.** No `pytest`, no `standing-values --write`, no full sweep, no unfiltered vitest. Nothing outside this
  slice's own files was touched.
