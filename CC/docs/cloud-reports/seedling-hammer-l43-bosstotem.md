# Seedling hammer-phase L43-BOSSTOTEM — the second hidden death loop (vanilla survey step 150)

Slice `seedling-hammer-l43-bosstotem` (Opus, cloud). Brief from `seedling-hammer-phase-planning-7`, approved by the
user on 2026-11-12 (the hammer replan). No planner follow-up arrived during the slice.

Evidence: `seedling-hammer-l43-bosstotem-evidence/` (`trace/`, `survey/`, `sweep/`, `witness/`).

## 1. SHAs

| | SHA |
|---|---|
| start (base) | `66046d4d48` = `origin/hammer-connected-l22` (main `a3a5b8182e` + `WALK_DEATH_REFUSED` OFF) |
| the change | `1bcca2098d` |
| head | the commit carrying this report (`Cloud-Status: final`) |
| branch | `claude/seedling-l43-bosstotem-death-wyuiak` |

## 2. The answer

**Switch: `AWAKE_BOSS_FIRST` (`SEEDLING_AWAKE_BOSS_FIRST=1`, ships OFF).** With it ON, survey step 150
**solves hitless**: 1055 ticks, 0 hits, 0 deaths, ending in L37. OFF it is byte-identical.

**The one thing to know first:** this is a **solver gap (hammer)**, not a model gap. The model steps the Totem in
full: its wake, its clamp, its body contact and its death. The solver already has a hitless verb that fights it
(`totem` / `execTotemBoss`, under `CONTACT_FIDELITY.totemBossFight`, which is ON). What was missing is the order. The
Wand pickup wakes the boss in the middle of the solve. A woken boss is no longer a Solid, so the corridor planner
walks straight through its body. The frontier never names it, and the verb is never asked. With the switch ON, a walk
that a live, woken boss bars fights that boss first, using the strategy table's own row.

## 3. The reproduction (measured, at the base)

`node scripts/procgen/survey-seedling-route.mjs --through=end --only=150 --out=<f>`. Step 150 is L43 visit 1, staged
from `r8-solve-11` at (176,448). Goals: `collect-placement` the Wand at (144,224), then `reach-exit` teleporter@144,64
→ L37.

- **OFF:** REFUSED. *"reach-exit (144,64)->L37 -> wand stance (magicallock@144,112): the re-planned corridor failed
  too — … waypoint 0 (168,184): not reached within 400 ticks; stalled at (178.57,423.62) … after grazing 82 solid(s):
  tile:Blue Wall at (168,456)…"*. This matches the CONNECTED-L22 census.
- **`SEEDLING_WALK_DEATH_REFUSED=1`:** REFUSED. *"the player DIED at run tick 237 in level 43 (2 death(s) on the walk;
  the hits before the first: bosstotem@152,168 at t173, … t213, … t237)"*. This also matches.

**The trace.** These are temporary `L43DBG` prints in `drive` and in the attempts loop. They are kept as
`trace/l43dbg-temporary-instrumentation.patch` and were reverted before the commit. The solve ran in a direct
`--step=150` child.

| t | what |
|---|---|
| 0–159 | collect walk from (184,456) via `[(184,248),(136,248),(136,232)]`; the boss sleeps (`activated: false`, a Solid) |
| 160 | Wand taken (equip slot 3). The wake: `classCount(Wand) <= 0` |
| 161 | `activated: true` (`fullyActivated: false`, `clampY: null`, the body at (152,168), state 0, not walking) |
| 160 | **the plan:** `reach-exit -> wand stance (magicallock@144,112)`, attempt 0 from (150.08,233.92): `wps [(152,184)]`. The straight line goes up into the woken body's box |
| 173 | hit 1: `bossBody` `bosstotem@152,168` |
| 190 | `fullyActivated: true`, `clampY: 212`. The player is clamped and pushes `up` against the body |
| 213 | hit 2 (`bossBody`) |
| 237 | hit 3 (`bossBody`). **Death 1.** Respawn at the room entry (184,456). The boss resets to asleep, then re-wakes at t238 (the Wand is gone) |
| 439, 465, 490 | three hits, death 2 |
| 560 | attempt 1 from (170.70,372.52): `wps [(168,184),(152,184)]`. Same aim |
| 611, 631, 680 | death 3 |
| 882, 906, 932 | death 4. The attempt ends at its 400-tick bound, and OFF's "stall … grazing tile:Blue Wall" are the respawn's grazes by the entry wall |

All 12 hits are `bossBody` contact. There is **no laser and no projectile**: the boss never left state 0 (rest).

**What certified the corridor, and why it did not price the boss.** Nothing certified a crossing of the boss: the
plan does not treat it as an obstacle at all. Before the wake, `bossRectsNow` gives the run a `rect` (the Solid). After
the wake that is `null`, and the body is `bodyRect`, an `Enemy` box, which no collider holds. The clamp is an
assignment (`bossTotem.js` §2), not a collider either. So `planWaypoints` returns a free one-waypoint line to
(152,184). `corridorBodyPricing` is OFF (`contactFidelity.js:555`), and `dangerMap.js` reads no `bosses` family
(0 occurrences), so no danger probe priced the body. The frontier only names Solids on a blocked corridor, so
`solid:bosstotem` → `totem` was never reached.

**Classification: hammer.** The forecast does carry the attack: the run bills every hit and death, and the game
witness (§6) agrees with the model to 0 px through the whole fight. The gap is the solver's ordering: it walks into a
priced danger it already has a verb for.

## 4. Design + change, OFF identity

**Design (stated before building).** One switch and one helper, with a single call site in `solveSegmentUnder`'s
`walkTo` wrapper (`solverBot.js`). Every walk reaches that wrapper: the goals, the rungs, and the walks that verbs
hand down.

- `awakeBossBarring(run, from, aim)` reads the run's own `bosses` view. A body is live when it is `activated`, not
  `removed` and not `destroy`. It **bars** the walk when the aim lies past its clamp (`aim.y < clampY`), or when the
  straight segment from the player to the aim crosses its `bodyRect` (slab clipping, `segmentCrossesRect`). A sleeping
  body is a Solid that the frontier already names, so it is never asked.
- `fightAwakeBossFirst`: the verb comes from `OBSTACLE_STRATEGIES['solid:<tag>']` (the tag is the id's prefix),
  `frontierExecutor(strategy)` and `resolveObstacleStrategy`. This is the same lookup the frontier and rules-2's
  `bossGoal` use. The executor runs with the segment's own `walkTo`, `equip`, `fork` and `rewind`, and its record
  joins `records`. If no row, executor or held resolution exists, the walk **refuses by name**
  (`obstacle: {kind: 'solid', id, tag}`). `bossFirstActive` keeps the verb's own stance walk from asking again.
  `AWAKE_BOSS_FIRST.fought` collects one row per ask.
- The change has no level id, coordinate or Seedling constant. The boss family, its fields and the strategy row are
  all read from the model and the table.
- `SEEDLING_AWAKE_BOSS_FIRST` is in `solverEnvChannel.SOLVER_ENV_NAMES`. **Thread:** the solve worker
  (`jsRuntimeSolveWorker`). The decision is a solver decision, not a main-thread mapper's. The sweep's `--solver-env`
  echoed `SOLVER_ENV: … SEEDLING_AWAKE_BOSS_FIRST=1` and stamped every row (§7).
- `withAwakeBossFirst(enabled, fn)` is the test wrapper (`withSwitch`).

**Files:** `solverBot.js` (+98: the switch block after `WALK_DEATH_REFUSED`, the two functions, the call site);
`solverEnvChannel.js` (+1 name); `scripts/procgen/seedling-solver-surface.json` (regenerated, 16 lines move: the
`solverBot.js` line numbers it cites).

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`

| tree | md5 |
|---|---|
| base `66046d4d48` (the two files restored from HEAD, measured here) | `391322d681b7aa0229d94b3f6906d024` |
| change, switch OFF | `391322d681b7aa0229d94b3f6906d024` |
| change, switch ON | `391322d681b7aa0229d94b3f6906d024` |

The md5 equals the brief's main `fe98f37f22` value.

## 5. Rows + bounded vitest

**Survey rows** (`survey/steps-control-{off,on}.json`; `--through=end --only=150,152,163,168,170,177,179,200,207`):

| step | level | OFF | ON |
|---|---|---|---|
| **150** | L43 (Wand, then the north exit) | REFUSED (stall, Blue Wall) | **SOLVED 1055 t, replay hits 0, deaths 0, end L37**, earned `{43,0} {43,4} {43,5}` |
| 152, 170, 200 | L12 → L95 (`teleporter@0,352`) | SOLVED 1269 t, 0 hits | identical row |
| 163 | L12 Witch encounter | SOLVED 1189 t, 0 hits | identical row |
| 179, 207 | L12 → L83 (`teleporter@32,848`, the stacked wand-shot doors; tape: slot 2 selected t1736, slot 0 restored t1759) | SOLVED 1825 t, 0 hits | identical row (the control wand stance) |
| 168 | L43 visit 2, clear-tag `{43,5}` (Totem) | REFUSED: *"bosstotem@152,168 sleeps while wand@… stands"* | identical row (see §9) |
| 177 | L68 Health | REFUSED (no corridor, `pickup:health`) | identical row |

Apart from 150, every row matches byte for byte (`ms` excluded). The ON plan (`trace/on_wps.txt`): at t160 the walk to
the wand stance asks first. `bosstotem@152,168` bars it (the line crosses the body), so the `totem` verb walks its
stance (131.5,265) and plays the policy on forks, hitless first. At t782 the wand stance walk runs
`[(136,184),(152,184)]`, then the lock opens and the walk exits at t1055.

**The pin:** `frontend/modules/seedlingDemo/hammerAwakeBossFirst.test.js` (4 rows):

1. The switch ships OFF, the env turns it on, and the channel carries the name.
2. `awakeBossBarring` truth table: crosses, misses, past the clamp, asleep/removed/destroyed.
3. Step 150 OFF refuses with the stall words.
4. Step 150 ON solves with one `fought` row `{id: 'bosstotem@152,168', strategy: 'totem', hits: 0}`.

The witness staging is the survey's own 0-tick boot view (`fixtures/awake-boss-first/survey-step-150-boot.json`) on
`patchedMapDocument` (the survey's room set). My first draft used the unpatched atlas, and row 3 failed on
`fallrock@176,384`: L43's fallrock is a set patch. That draft was fixed before the commit.

**Bounded runs:**

- `hammerAwakeBossFirst`, `hammerWalkDeathRefused`, `solverEnvChannel`, `wandL43`, `bossTotemFight`: 5 files,
  **90 tests** green.
- The same pin with `SEEDLING_AWAKE_BOSS_FIRST=1`: 1 file, 4 tests green.
- `npx vitest run frontend/modules/procgenDocs/`: 8 files, **493 tests** green.

**Regenerated and checked:**

- `census-seedling-solver-surface.mjs --write` / `--check`: GREEN, 372 rows.
- `generate-procgen-reference.mjs` (then `--check`): all 7 modules and 5 regions match.
- `generate-docs-index.mjs --check`: current.

No unfiltered vitest, no pytest, no `standing-values --write`.

## 6. Game witness (p4g)

The ON step-150 tape is the survey's own fold (`views/step-150-walk.json`, 1055 ticks, equip slot 3 at t160). It is
saved as `witness/step-150-on-walk.tape.json` and was played on `seedling_bot_ap_p4g` (headless logic-only, dev server
at the repo root) by `probe-seedling-wand-mobiles.mjs --file=… --out=…` (`witness/step-150-on-game-p4g.json`,
`witness/probe.log`).

- **The game:** at t1055 it is in **level 37**, with **hits 0**, the player at (151.65,81.60), and L43's cleared flags
  `[43:0,43:1,43:2,43:3,43:4,43:5]`. So the Totem died (`{43,5}`), the magical lock opened (`{43,4}`), and the walk left
  hitless.
- **The probe:** PASS on every WandShot (473 comparisons over 364 samples) and on the lock's flag. **FAIL** on its
  calibrated-clock check: the player first differs at t100 (game y 247.90, model 246.55).
- **Measured drift** (`witness/drift.mjs`, model vs game per sampled tick, patched and unpatched atlas alike):

  | ticks | max drift |
  |---|---|
  | t0–99 | 0.000 px |
  | t100–160 (the Wand walk and pickup, before the wake) | ≤ 1.985 px |
  | t161–199 | 0.000 px |
  | **t200–781 (the whole Totem fight)** | **0.000 px** |
  | t782–1055 (the lock and the exit) | 0.000 px |

  The drift lies in the collect prefix, which OFF and ON share. The change does not touch it. It is a fidelity item
  (§9), not this slice's.

The witness is not recorded as a fixture: the probe records only on a PASS. A whole-game walk was not asked for and
was not run.

## 7. Census: which seed-1 legs the change can move

`bosstotem` appears only in level 43 (atlas: `levels[43]`, one placement). The seed-1 leg list
(`seedling-divergence-legs.mjs`, `seedling_playthrough`, 936 legs) has 52 L43 legs (ids 413–438, 881–906), every
one from L40's door or one of its 12 pits:

- `level_43__r13c7 <- … -> exit:out_stairsup_176_464` and `… -> location:Level 043 - Wand` (13 + 13). These walk the
  south half only.
- `level_43__r3c8 <- … ~> level_43__r13c7 ~> level_43__r8c7 -> exit:out_teleporter_144_64` (13).
- `level_43__r8c7 <- … ~> level_43__r13c7 -> location:Level 043 - Totem of Lacste` (13).

**Bounded wasm sweep** (`probe-seedling-divergence-sweep.mjs --keys=…`, `--mode=inv --page=seedling_bot_ap_p4g`, the
workflow's defaults; `sweep/`). It ran on one arrival per goal kind (L40's door), OFF and
`--solver-env=SEEDLING_AWAKE_BOSS_FIRST=1`:

| key | OFF | ON |
|---|---|---|
| `level_43__r13c7 <- in_L40_320_576 -> exit:out_stairsup_176_464` | done, [walk] 4 t, 0 hits | identical |
| `level_43__r13c7 <- in_L40_320_576 -> location:Level 043 - Wand` | done, [apitem] 96 t, 0 hits | identical |
| `level_43__r3c8 <- in_L40_320_576 ~> level_43__r13c7 ~> level_43__r8c7 -> exit:out_teleporter_144_64` | done, [totem, walk, wand] 1054 t + [walk, wand] 389 t, 0 hits | identical |
| `level_43__r8c7 <- in_L40_320_576 ~> level_43__r13c7 -> location:Level 043 - Totem of Lacste` | done, [totem, walk] 808 t, 0 hits | identical |

**Why none moves.** In the AP world the Wand location holds an `apitem`, not the vanilla `Wand`. No pickup wakes the
boss in the middle of the solve, so the frontier meets it while it is still a Solid and asks `totem` itself (OFF
already plays [totem, …]). The switch only moves a solve in which the boss wakes **after** planning starts: the
vanilla Wand room. That is survey step 150, and no other survey step (no other level holds a `bosses` body). The other
48 L43 legs (the pit arrivals) share these four goals and were not run. They are expected to behave as the door's rows do,
since the change reads only the live boss, not the arrival. That is a reading, not a measurement.

## 8. What the brief got wrong (measured)

- *"the walk is certified, then dies"*: no check **certified** a crossing of the boss. The woken body is absent from
  the planner's world (no collider, no danger row), so the plan is a free straight line and nothing was asked of it.
- *"(and why it did not price the bosstotem: `corridorBodyPricing` OFF? a body class the forecast does not carry? a
  projectile?)"*: it was not a projectile or the laser. All 12 hits are `bossBody` contact, and the boss stayed in its
  rest state (state 0) throughout. The forecast (the run) carries it. `corridorBodyPricing` is OFF, but that is not the
  missing piece: the fix is the existing fight verb, ordered first.
- *"2 death(s)"* (the switch-ON words) undercounts the loop. The solve dies **4 times** (t237, 490, 680, 932), and each
  respawn re-wakes the boss.

## 9. Residue / hand-overs

- **Fidelity (hand-over, rows):** on the ON tape, model vs game drift up to **1.985 px** over t100–160 (the Wand walk
  and pickup, `[(136,248)→(136,232)]`, before the wake), first at t100 (y 246.55 vs 247.90). It is back to 0.000 px from
  t161. The probe's calibrated-clock check FAILS on it, so the witness cannot be recorded as a fixture until it closes.
  Owner: fidelity (the pickup's approach or fade).
- **Survey staging (planner):** step 168 (L43 visit 2, the Totem's clear-tag) boots the room with the Wand still
  standing, so `totem` refuses *"sleeps while wand@… stands"* OFF and ON. In a carried campaign, step 150 ON now earns
  `{43,5}` itself. Whether the survey should carry step 150's take into 168 is a route-staging question.
- **Not built:** a general "woken body" row in the corridor probe (`corridorBodyPricing` for the `bosses` family). This
  switch fights the boss; it does not price walking past a live one. No measured case needs that.
- **Landing:** OFF by default. Landing needs the user's SHA-bound OK, which the planner asks for.
- **Process:** the temporary `L43DBG` prints (`botDriverV2.js`, `solverBot.js`) were reverted before the change's
  commit (`git diff` showed only the change). I started a dev server on :8000 for the sweep and witness and stopped it
  by PID. Nothing under `flashPanel/`, `worlds/`, the exporter, AS3, wasm or gitlinks was touched. Fidelity's model
  files and `botDriverV*.js` are unchanged in the committed diff.
