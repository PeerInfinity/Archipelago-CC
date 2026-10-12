# Seedling fidelity FLIP14 — five switches ON; the flip moves more than its measured list, and the campaign re-record is held

Slice `seedling-fidelity-flip14` (Opus, cloud), planner `seedling-fidelity-planning-6`, the WAVE-14 FLIP.

| | |
|---|---|
| Start SHA | **`cb73ec83a7`** (`cb73ec83a73b005b0ebc47dbf664fe48ed2842fd`, main with wave 14 merged; not rebased) |
| Head | the commit carrying this report (code `9b84531` D1, `0168ce8` D1 CI movers; records `c43ce5e`; this report) |
| Branch | `claude/seedling-fidelity-flip14-ck0tk4` (the harness's; the brief's `seedling-fidelity-flip14`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9655` (`SEEDLING_PORT=9655`), PID 564, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS (licensed list + 1 bounded + 9 CI-caught movers, all re-pinned; CI green) · D2 STOP (the re-record reaches past the licence: `r9-solve-18` and `r9-solve-12` walks; measured on the game and held as a patch) · D3 PASS** |

## The one thing to know first

**The flip makes the survey worse in two places and solves nothing new.** Measured locally with the survey's own
runner at base and at head (the base reproduces CI run 38168138687 row for row): SOLVED **169 → 167**. Step 50 (L30 →
L32, BOBSOLDIER2's staging) goes SOLVED 460 → **REFUSED**, and step 62 (L45 → L46) goes SOLVED 386 → **REFUSED**. 22
rows change length and 7 refusals change their text. Leg 624, the reason for the flip, is a sweep row and not a survey
row.

Second thing: **D2 is a STOP.** The producer cannot re-record `r9-solve-14`/`-16` alone. `r9-solve-18` boots from
`-16`'s new game latch and re-solves **518 → 440 t** in the hammer room, which moves `playthroughWalk`'s kill-lock
provenance and `fidelityF1c`'s residue pin. `r9-solve-12`'s inputs also move. The complete candidate (15 tapes, 4
expectations, 4 traces, the index, the provenance row) is verified on the game and kept as a patch for the licence.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | the harness branch at `cb73ec83a7` | `cb73ec83a7`; bootstrap `READY`, node v22.22.0; five non-wasm submodules uninitialised again, `git submodule update --init` on each |
| identity block | `SEEDLING_PORT=9655 bash scripts/procgen/identity-block.sh .` | non-`#` md5 **`77080c2ed34820619273d5d9d6fcdaa9`** (= L74LEG624's bank): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK, reference ALL 7 + 5 MATCH |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, all exit 0 |
| tapeRunner pairs | inside the bounded run, sorted `status\tfullName` | **611**, `86af85259c2ab3a51b1f0ebb409743f4` |
| surface / constants / entities / profile | each `--check` | GREEN **279** · PASS **5,820** · PASS 558 · PASS 138 (both JSONs) |
| roster | `fixtures/tapes/index.json` `.tapes` | **277** |
| bounded vitest BEFORE | 94 files: L74LEG624's 86 + the brief's standing list + every non-slow test naming a switch key, `hitsTimer > 0`, `fallrock`, `chaserForecastNow`, `explosionHitRadius`, `settleCameraForLoad`, `CONTACT_FIDELITY_DEFAULTS` or `withContactFidelity` (`grep -a -l`) | **3,476 / 3,476**, md5 `2ad9da013438d7a410cd7a37c49c4b93` |

## D1 — the flip and the re-pins (PASS)

**Change.** `contactFidelity.js`: `strikeIframeLapse`, `fallRockPostFall`, `forecastSpeedByTerrain`,
`totemShotBlastInt` and `rebootShake` default `true`, each with "⚖ ON since the wave-14 flip, user 2026-10-12". The
`SEEDLING_STRIKE_IFRAME_LAPSE`/`_FALLROCK_POSTFALL`/`_FORECAST_SPEED_BY_TERRAIN=0` opt-outs are kept;
`totemShotBlastInt` and `rebootShake` never had their own variable (`SEEDLING_CONTACT_FIDELITY=<keys>` covers them).
`movingWait` is untouched.

**The rule applied to each mover.** A row whose plan IS a game witness recorded under the old gate keeps its
assertion as an OFF control, with the solve and the replay both inside `withContactFidelity({<key>: false}, …)`. A
model-only value is re-pinned with its old value named in the comment. Where it is cheap, an ON assertion is added
next to the control.

**Default pins (4).** `contactFidelity` (the defaults), `fidelityL74Leg624` ("all three ship ON"), `fidelityMovingWait`
(`totemShotBlastInt` and `rebootShake` ship ON).

**`fallRockPostFall` (4: the licensed 3 + 1 the list did not name).** In each one the OFF refusal is kept as the
control, and an ON row now asserts the rock built fallen:
- `fallRock.test.js` {39,10}: ON, `fallrock@144,624` `postFall`, tag 10.
- `fidelityCrossRoom` vanilla L37: ON, the walk enters L37 at t6 with `fallrock@288,32` built fallen.
- `levelWorld.test.js` cleared-tag census: ON, L74 `fallrock@288,144` `postFall`.
- **`flashPanel/seedlingWasmPlayback.test.js` "L74 SILENT STALL"**: the JS arc's test. It provokes the room build's
  throw with a cleared non-arena `fallrock`, which ON is built fallen. I wrapped the row OFF in the test only. No JS-arc
  code was changed.

**`strikeIframeLapse`: the licensed 21 rows, all moved as measured.**

| file | rows | treatment | ON, measured |
|---|---|---|---|
| `solverBot` 12b′ | 4 | re-pinned (the hammer arc's pins) | `bob@32,32` (40,56)/115/193 → **(40,24)/106/234**; `bob@64,64` (72,88)/109/16.0 px/170 → **(88,40)/190/35.8 px/241** (now also clears `bob@96,48`); `bob@176,112` (168,120) → **(184,104)**. Only 1 of 3 runners-up is nearer now ((168,104) at 32.0 px vs 35.8), so the row asserts that one; the claim "the nearest qualifying cell is not the winner" holds. Bounds 115/126/105/120 → **106/125/101/116** (two above the formula, two below) |
| `solverBot` 12c | 2 | stance stand: OFF control (45/45/63/14, **1 hit**) + ON (**55/55/69/5, 0 hits**); L14 chain: re-pinned | dashRefusals 22 → **27** |
| `solverDeadline` | 1 | re-pinned (the hammer arc's kill-chaser stance) | (40,56) → **(40,24)** |
| `fidelityBobSoldier2` D2 | 4 | OFF controls | step 50 **REFUSES** at every switch setting ON (below) |
| `fidelityL30KeyLock` D2 | 5 | OFF controls (with the mechanism row) | (224,80) 347 → **320 t**, (240,80) 360 → **341 t**, 0 hits; chaser stance (88,120) → **(88,88)** |
| `fidelityLeash` leg 629 | 1 | OFF control | solves **290 t** (witness 307), verbs bait/collect/kill/walk, 0 deaths |
| `fidelityIceTurretSpear` C3 | 1 | OFF control | **724 t** (witness 693), the sword back at t533 (was t501) |
| `seedlingCanCross` | 2 | OFF controls | `none` 206 → **222 t**, `all` 117 → **124 t**, rungs `['avoid']` (no PULL climb), 0 hits |
| `ropeSword` PULL | 1 | OFF control | the approach's own swing pulls `rope@32,16` (write t90); PULL never climbs; 0 hits, into L17 |

**Caught by CI and not by the bounded set: 9 rows** (run 38300410923 at `9b84531`: 20,142 passed / 9 failed). All
are pins of L16 and L65 plans that the game witnessed under the old gate:
- `fidelityDash` D2 and D3 ×3: kept as OFF controls. ON the `all` plan is 124 t (14 dashes, walks [[5,12],[1,2]]) and
  the dashless plan is 222 t.
- `seedlingRobust` D2 ×2 and D3 ×2: kept as OFF controls. ON, idle 1 is 223 t and {sword, conch} → L18 is 808 t,
  both 0 hits.
- `spearPush` L65 from L63: 539 → **546** ON (re-pinned), with the witnessed 539 kept as the OFF control.

**Witness / mutant.** No new game witness: D1 changes defaults, not code. The controls are the old behaviour,
still asserted. The "mutant" is the flip itself. Each re-pinned row went red at the flip with the exact values above
(soft-assert copies of every mover file, made and deleted, `zzsoft_*`), and it goes green again under its control.

**CI** at `0168ce8` (run **38302485956**): job success. Suite: vitest (unfiltered) 792 files / **20,151 passed**, 0
failed, 0 skipped. Slow battery 18 files / **253 / 253**.

## D2 — the campaign re-record (STOP, with the list and a verified patch)

**The producer's `--check` at head** = **`dce96321`** exit 1, exactly the licensed digest. That digest already carries
**`r9-solve-12`'s walk drift** (inputs, 197 → 214 spans, 2364 t either way). The licence prose does not name it, and
neither did L74LEG624's report (it is in that slice's own `r9-campaign-lapse-on.diff`).

**The `--write` path** (`SEEDLING_PORT=9655 node scripts/procgen/solve-seedling-r9-campaign.mjs`, headless latch
drives) re-boots every successor from the game. It moves:

| window | tape | moves | licensed? |
|---|---|---|---|
| 16 | `r9-solve-14` | walk **98 → 103 t** | yes |
| 17 | `r9-solve-15` | boot: seam.time 8756 → 8761, `seam.music` | yes (its oracle "follows") |
| 18 | `r9-solve-16` | walk **688 → 655 t**, seam.time 9232 → 9237 | yes |
| 19 | **`r9-solve-18`** | **walk 518 → 440 t**, persistence (the `{18,0}` clear at t406, was t467), `rng.cosmetic`, seam.time 9940 → 9912 | **no**: only its seam.time oracle was named |
| 20–30 | `-19`, `-20`, `-13-v2`, `-0-v3`, `-21`, `-22`, `-29`, `-31`, `-30`, `-32` | boot only: seam.time −106; `grass_cut` +11 from `-21` on; `rng.cosmetic` on `-19`/`-21` | not named |
| 24 | **`r9-solve-12`** | **inputs** (2364 t either way) + boot | **no** |

Why the licence cannot hold as written: L18's solve is clock- and persistence-dependent, so `r9-solve-18`'s seam.time
cannot "follow" while its walk stays. The `--check` arm did not show this because it reads each successor's committed
boot.

**What else the candidate moves.**
- `playthroughWalk.js`'s L18 kill-lock provenance row: `removedAt` 367 → **306**. This matches the new tape's own note.
  Without this edit the whole-chain differential fails twice on `{18,0}` at t406/t467.
- `fidelityF1c` ("the committed window IS at the chain's residue"): 40 → **12**. This is the hammer-phase arc's pin. It
  is the only red among the 40 test files that name a moved tape.

**Measured on the game anyway** (p4f, headless, port 9655). The tree was then restored to the committed head:
1. `check-seedling-bot-differential --record --only=<the 15>`: **15 RECORDED, 15 "THE MODEL REPRODUCES THE RECORDING
   IT JUST MADE"**, ALL CHECKS PASSED (recording mode). Only the 4 walk movers' expectations changed (`-12` `3e7cd43b →
   ea6ecfd3`, `-14` `3f3b6b8b → 1fc23cb0`, `-16` `a19a4d1a → 021b0b23`, `-18` `5784e092 → b4649776`); the 11 boot-only
   ones re-recorded byte-identical. These are each tape's game check.
2. `derive-seedling-tick0 --check`: 14 FAIL, exactly the moved boots. `--only=` those 14 wrote 14 of 14, after which
   `--check` gives ALL CHECKS PASSED (md5 `5ca74c06`). `generate-tape-index.mjs`: 277 tapes, `1922bb31` → `555c35e3`.
3. With the provenance row at 306, the whole-chain differential (`--only=` all 30, no `--record`) gives **ALL CHECKS
   PASSED, 879 PASS, 30/30 "live game matches the committed oracle stream"**, endsAt 10931 → **10825**.
4. `solve-seedling-r9-campaign --check` on the candidate: **exit 0**, 0 FAIL, md5 **`6b1bf15cbb2c6259ba15962cb9082438`**.

**The held patch:** `seedling-fidelity-flip14-evidence/d2/d2-candidate.patch` (md5 `b2d3401c…`, `git apply --check`
clean at this head; 25 files, listed in `candidate-files.txt` and `moved-md5.txt`). With the logs of every step
above. ⚠ To land it: `git apply`, then re-pin `fidelityF1c`'s residue row 40 → 12 (the hammer arc's call), then re-run
the identity block.

## D3 — confirm (PASS)

| row | result |
|---|---|
| identity block at head (`0168ce8`, tree clean) | non-`#` md5 **`4c578d1e032441ec61c8804f3e87660e`**. Against W0, exactly two rows move: **ENEMY `afdc6d1a` → `36b59445`** (= the licence) and **r9-campaign `712f0ead` → `dce96321` exit 1** (= the licence; it stays red until D2 lands). Every other row, the other five `--check`s, generated OK and reference MATCH are unchanged |
| tapeRunner pairs | **611**, `86af85259c2ab3a51b1f0ebb409743f4` (= W0) |
| bounded vitest AFTER | 97 files (W0's 94 + `fidelityDash`, `seedlingRobust`, `spearPush`): **3,496 / 3,496**, md5 `41787ec461ad25b43638b0c6cb7ed01c`. Gone names are only renames: the default pins, and `contactFidelityHook`'s derived rows, which now read `default true` |
| surface / constants / entities / profile | GREEN 279 · PASS 5,820 · PASS 558 · PASS 138: nothing to `--write` (a boolean default is not a censused literal) |
| reference | regenerated (docs index word counts); `--check` ALL 7 + 5 MATCH; `procgenDocs` 493/493; `check-procgen-docs` ALL CHECKS PASSED |
| CI | `0168ce8`: 20,151 / 20,151, slow 253 / 253 (above). The records and report commits touch only docs, outside the workflow's path filter apart from `procgenDocs/generated/docsIndex.js` (its run is read in the closing message) |

## The survey and sweep rows this moves (before → after)

**Survey**, measured locally with `survey-seedling-route.mjs --through=end --route=full`. Base = worktree at
`cb73ec83a7`, which reproduces CI 38168138687 by (level, goals, boot) with 0 diffs. Head = worktree at `9b84531`.
Compared by (level, goals, boot). Full rows: `seedling-fidelity-flip14-evidence/survey-movers-local.json`.

| step | level | goal | before | after |
|---|---|---|---|---|
| 16, 24, 35 | L14 | → L15 | SOLVED 98 | SOLVED 103 |
| 18 | L16 | → L17 | SOLVED 117 | SOLVED 124 |
| 19 | L17 | Chest | SOLVED 122 | SOLVED 132 |
| 26, 37 | L16 | → L18 | SOLVED 688 | SOLVED 655 |
| **50** | L30 | Torchpickup; → L32 | SOLVED 460 | **REFUSED**: the danger map forbids (71.04,67.07), `chaser:bobsoldier@48,80` ("its sword is timed"), unclassified |
| 52 | L30 | → L22 | SOLVED 347 | SOLVED 320 |
| **62** | L45 | → L46 | SOLVED 386 | **REFUSED**: "the re-planned corridor failed too … waypoint 4 (120,72): not reached within 400 ticks; stalled at (121.19,72.71)", unclassified |
| 69 | L14 | → L15 | SOLVED 103 | SOLVED 117 |
| 71 | L14 | → L13 | SOLVED 66 | SOLVED 55 |
| 74, 80 | L12 | → L37 | SOLVED 921 | SOLVED 953 |
| 135 | L12 | → L37 | SOLVED 925 | SOLVED 957 |
| 104 | L60 | → L61 | SOLVED 483 | SOLVED 530 |
| 145, 180 | L60 | → L61 | SOLVED 523 | SOLVED 497 |
| 148 | L65 | → L68 | SOLVED 539 | SOLVED 546 |
| 163 | L75 | → L71 | SOLVED 364 | SOLVED 366 |
| 170 | L77 | → L76 | SOLVED 480 | SOLVED 475 |
| 192 | L80 | Chest; → L71 | SOLVED 666 | SOLVED 671 |
| 207 | L104 | → L105 | SOLVED 268 | SOLVED 261 |
| 208 | L105 | → L106 | SOLVED 264 | SOLVED 300 |
| 57, 110, 153, 161, 182, 184, 201 | — | — | REFUSED | REFUSED (text changed) |

Totals: SOLVED 169 → 167, REFUSED 51 → 53, NO-EDGE 1, NO-ARRIVAL 1.

**Sweep (node, by key; not dispatched).**
- Leg 629 `level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield`: solved 307 → **290 t** (LEASH's staging).
- L98 C3 `c3-l98-spear-l93`: 693 → **724 t**.
- Leg 624: per L74LEG624 (CI 38289124638), done 331 t with all three ON.

**Dispatches for the planner** (cloud sessions get 403). All are on ref `claude/seedling-fidelity-flip14-ck0tk4` with
`contact_fidelity` EMPTY, so the new defaults apply:
1. `seedling-divergence-sweep.yml`: `mode=inv`, `producer=solver`, `shards=1`,
   `keys=level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144|level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0|level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield|level_74 <- in_L75_64_0 -> exit:out_teleporter_288_144|level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield`
   (624/622/626/628/629). Expect 624 done 331 t; 622 forced-hit 4 t; 628 refused (skirt stance); 629 done ~290 t.
2. The same workflow with `ids=` L43's **419–444** (MOVINGWAIT's D4 set: `totemShotBlastInt`/`rebootShake` predicted
   inert).
3. `seedling-survey.yml`, `--through=end --route=full` (the defaults): expect the table above (SOLVED 167).
4. The full tier, and `seedling-probe.yml` `battery=standard`, at this head.
5. After D2 is licensed and the patch applied: the full tier again (15 tapes re-recorded).

## The JS arc's pins and what it must wire

- **No signature or contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging`
  are untouched. No new staging or result field, and no new `SolverRefusal.obstacle.kind`.
- **One of its tests changed (test only):** `seedlingWasmPlayback.test.js`'s "L74 SILENT STALL" row now runs
  `fallRockPostFall` OFF, because ON the cleared fallrock no longer throws. If the JS arc wants an ON-default witness
  for the timer-throw net, it needs another throwing room build (`fallrocklarge` outside the arena still refuses).
- **Wiring:** none. `seedlingContactSettings.js` derives each setting's default from `CONTACT_FIDELITY_DEFAULTS`, so
  the five settings now default to `true` (`contactFidelityHook`'s rows say so, green).

## Handed to the hammer arc

- **Re-pinned here** (licensed; the arc should check them):
  - `solverBot` 12b′: the 4 derived-stance rows (values above), including the "BEST stance" row now asserting one
    nearer runner-up instead of three.
  - `solverDeadline`: the kill-chaser stance, (40,24).
  - `solverBot` 12c: the stance stand (OFF control + ON 0 hits) and the L14 chain's 27 refusals.
- **Not re-pinned, held with D2:** `fidelityF1c`'s residue row (40 → 12) and `playthroughWalk`'s `{18,0}` provenance
  (`removedAt` 306). Both move only when `r9-solve-18` is re-recorded.
- Nothing in the arc's functions was edited.

## Deltas (base → head)

- Code: `contactFidelity.js` (five defaults, their doc lines).
- Tests: the 4 default pins, the 4 fallrock controls (+ ON rows), the 21 licensed strike rows, and the 9 CI-caught
  rows, in 18 files: `contactFidelity`, `fidelityL74Leg624`, `fidelityMovingWait`, `fallRock`, `fidelityCrossRoom`,
  `levelWorld`, `flashPanel/seedlingWasmPlayback`, `solverBot`, `solverDeadline`, `fidelityBobSoldier2`,
  `fidelityL30KeyLock`, `fidelityLeash`, `fidelityIceTurretSpear`, `seedlingCanCross`, `ropeSword`, `fidelityDash`,
  `seedlingRobust`, `spearPush`.
- Docs: the `seedling-bot-log.md` FLIP14 entry (with trap candidates), the two `seedling-bot.md` paragraphs marked ON,
  and the regenerated reference.
- No tape, expectation, trace, index or roster change is committed (D2 is held). Shared tables: only
  `CONTACT_FIDELITY`'s values changed, with no reorder or reword of keys. `OBSTACLE_STRATEGIES`, `DEADLINE_SITES`,
  `KNOWN_STRATEGY_VERBS`, `KILL_ARM_POLICY` and `FAMILY_RULES` are untouched.

## Byte-inertia

The flip is not byte-inert by design. What did not move:
- every identity-block row but ENEMY and r9-campaign;
- the other five producers' `--check`s;
- tapeRunner (611 replays, `86af8525`);
- every committed tape;
- surface, constants, entities and profile;
- the roster (277).

`totemShotBlastInt` and `rebootShake` moved nothing beyond their default pins, as measured by MOVINGWAIT.
`forecastSpeedByTerrain` moved nothing measurable on its own.

## What the brief got wrong (measured)

1. *"only ENEMY + r9-campaign move"* in the identity block: true. But *"re-record `r9-solve-14`/`-16` (and the
   `-15`/`-18` seam.time oracles)"* is not a separable set. `-18` re-solves 518 → 440 t from `-16`'s new latch, and
   `-12`'s walk drifts (already in the licensed `dce96321`). The boot cascade reaches every window to 30.
2. *"The movers were measured"*: the bounded list was exact, but it was a floor. One JS-arc fallrock control was
   missing, and CI found 9 more strike movers (`fidelityDash`, `seedlingRobust`, `spearPush`), all L16/L65 witness
   pins.
3. *"bobsoldier REFUSED → SOLVED"* (the ENEMY census) reads as an improvement, but the route survey loses two steps
   (50, 62) and gains none. The licence's measured list carried step 50's rows (`fidelityBobSoldier2`) without saying
   the survey step itself refuses ON.
4. The bootstrap's `READY` again left five non-wasm submodules uninitialised (C3/C4/L74LEG624's finding).

## Residue

1. **Step 50** (L30 → L32) refuses ON at the walk gate for `bobsoldier@48,80`, with its sword timed. This is
   BOBSOLDIER2's kill stance plus the lapse gate, i.e. this arc's (fidelity) next slice.
2. **Step 62** (L45 → L46) refuses ON with a walk STALL at waypoint (120,72) (v 0.95, 0), not a combat refusal. Not
   diagnosed here.
3. D2's held patch and the two hammer-arc pins it moves.
4. The witnesses kept as OFF controls are now off-default plans. Each ON plan is named in its row's note and is
   unwitnessed: L30 ×2, 629, C3, L16 ×4, L65.

## Rows to BANK

- `CONTACT_FIDELITY`: `strikeIframeLapse`, `fallRockPostFall`, `forecastSpeedByTerrain`, `totemShotBlastInt`,
  `rebootShake` default **ON**; `movingWait` OFF.
- Identity at head `4c578d1e…`: ENEMY **`36b59445`**, r9-campaign `--check` `dce96321` (exit 1 until D2 lands). With
  the D2 patch: r9-campaign `--check` **`6b1bf15c`** exit 0, tape index `555c35e3`, chain endsAt **10825**.
- tapeRunner 611 `86af8525`; bounded AFTER 97 / 3,496 `41787ec4`; CI 20,151 / 20,151 + slow 253.
- Survey ON (local): SOLVED **167** (the table above).
- The re-pins by name (D1's lists), and the evidence dir `seedling-fidelity-flip14-evidence/`.
- Not run: `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, no rebase, no
  force-push.
