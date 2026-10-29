# Seedling fidelity LIGHTPOLE — an in-room pole lit by one "Spear" hit from its own room (`inRoomPoleThrust`, OFF)

Wave 34, planner `seedling-fidelity-planning-16`. Session `seedling-fidelity-lightpole`.

- **Start:** main `caa42ea5df` (97 default-ON keys of 109, as the brief says; 98 of 110 ON-capable keys with mine).
- **Head:** the report is the last commit (see `git log` on the branch); the head before the report is `0ee94c2c`.
- **Harness branch:** `claude/seedling-fidelity-wave-34-xaxfl9` (the harness's own; no `seedling-fidelity-lightpole` branch was pushed).
- **Evidence:** `seedling-fidelity-lightpole-evidence/` (tools in `tools/`).
- **Ports:** 9762 (this tree), 9763 (the pristine base worktree, for the BEFORE banks).

| D | verdict | switch | what changed |
|---|---|---|---|
| W0 | **PASS — no model gap** | — | The four legs refuse `no-verb` before any solve. The run already steps the pole's toggle, its tag write and the dark trap's death; the ghost swing's "Spear" arm is modelled too. |
| D1 model | **not needed** | — | (W0 found nothing to model.) |
| D2 verb | **PASS** | `inRoomPoleThrust` (OFF) | `solid:lightpole` → `pole`. Stance from the press rect × the pole's core in four facings (through walls, wall-flush points included). ONE press. The arm is the bag's: the Spear, or the ghost swing once the Ghost Sword fused the slots. Game-witnessed on all four edges (×2) and in two committed p4g tapes at 0 px. |
| Movers | **measured, bounded** | — | Survey full ON vs OFF: 0 movers (201/39 both). Keyed sweep (53 legs) ON vs sweep 10: exactly legs 558/569/740/742, failed → done. |

## W0 — the base, the legs, and what the model already steps

| row | command | result |
|---|---|---|
| base | `git checkout` at `caa42ea5df`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block BEFORE | `identity-block.sh <base worktree>` (venv active, its own server :9763) → `identity-w0.txt` | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | in the block | battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `be9c19c8`, **all exit 0** |
| reference | in the block | 4 DIFFER (registry/capabilities and their two regions — the known box artifact, L100's report has the same four) |
| roster | `fixtures/tapes/index.json` | **291** tapes |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` at the base (`tape-runner-pairs-w0.txt`) | **639**, md5 **`beea3ad6`** |
| bounded vitest BEFORE | the brief's list + every test naming what I touch (`vitest-files.txt`, 102 paths; 101 exist at the base) at the base worktree | **3,100 / 3,100** (`vitest-before.txt`) |
| surface / constants / entities / profile | `--check` at my tree | surface RED (my new reads; re-written and classified below) · constants PASS **6,999** · entities PASS **566** · profile PASS **138** |

**The legs at this base** (`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`, 912 legs; keys match the
brief's): **558** `level_63__r10c2 <- in_L61_224_208 -> location:L63 flag 6: lightpole@48,272 cleared` (@(16,208)),
**569** `level_65__r0c8 <- in_L63_128_304 -> location:L65 flag 0: lightpole@128,168 cleared` (@(128,16)),
**740** `level_101__r4c2 <- in_L100_288_96 -> location:L101 flag 0: lightpole@144,64 cleared` (@(288,240)),
**742** `level_101__r4c2 <- in_L102_64_96 -> location:L101 flag 0: lightpole@144,64 cleared` (@(32,96)).
Skipped by name: 555 (L63 f7 @(128,288)) and 561 (L63 f6 @(32,288)), *goal-is-a-staged-event*.

**The refusal** (live p4g sweep at the base, `w0-sweep-base-rows.txt`): every one `failed` before a solve —
`jsRuntimeSolver.eventSolverGoal` → `clearTagVerbOf('solid:lightpole')` → *"no strategy row exists for solid:lightpole —
the catalogue names no verb that clears it"*. No request is ever made.

**What the model already steps** (read, then exercised by the witnesses below):
- `levelRun`'s pole arm (`applyThrust`, `r.as3 === 'LightPole'`): `hit()` toggles `activate` behind the 25-tick
  `hitsTimer`; `set activate` writes `poleFlags` at the press tick; `earnedClears` derives from the FINAL state
  (`by: 'lightpole'`, `t` = the last toggle). A spear's T+3/T+5 repeats land inside the `hitsTimer`, so one press is one
  toggle.
- The dark trap's death from a lit pole (`stepDarkTrapsNow`, STATICLADDER D2 / DARKTRAP2, `darkTrapLight` ON).
- The ghost swing passes `"Spear"` (`pressHitType`) and `GHOST_PRESS_ARMS.LightPole` is `modelled`.

No D1. ⚠ One finding that shapes D2: a `LightPole` is `notSolid` (`levelWorld`), so `execClearTag`'s generic arm finds
no solid and answers **`already-clear`** for the goal — the survey's step 226 OFF does exactly that today (it walks on
to the reach-exit with the flag unwritten). A row alone would therefore "succeed" vacuously; the arm must bind the pole
from the press census.

## D2 — the verb (`inRoomPoleThrust`, OFF)

**Change** (`solverBot.js`, all new functions; `deriveSwingStance` and every existing row's body untouched):
- `OBSTACLE_STRATEGIES`: `'solid:lightpole' → 'pole'` and `STRATEGY_EXECUTORS`: `'pole' → execPoleThrust`, each its OWN
  `switchGatedRow` (non-enumerable; OFF the tables read byte for byte as before). `resolveObstacleStrategy` gains one
  dispatch line.
- `execClearTag`: a pole arm beside the Watcher/Lights arms — bind the pole from `world.pressResponders` (its own
  `persistTag` must be the flag's, else `cannot-act`); a pole already `activate` at the build is the game's own
  `already-clear` (a thrust would toggle it OUT); otherwise the generic arm runs `pole` and finishes on the run's write.
- `resolvePoleThrustStrategy`: the ARM is the bag's — the Spear's slot, or (Ghost Sword held, its swing not refused) the
  ghost swing (`ghostSlashRect`, reach `GHOST_SWORD_REACH` measured to the core). Candidates: every walkable tile within
  reach, sampled every 2 px **plus the flush edges a 4x5 box can stand against** (x 2/14, y 2/13), in each facing whose
  rect touches the pole's bob-invariant core (the `LIGHTPOLE_PRESS_BOX` envelope less 2 × `bob`, as `deriveLightPole`
  reads it). A point flush on the FACING axis is dropped (a box pinned against what it faces gets no velocity from the
  face tap, so no facing). Filters: no other press responder, no bridge tile, no non-DarkTrap body in the rect; no solid
  under the box; clear of every live dark trap; a corridor at 16 px then 8 px. Order: deep (≥ `LIGHT_ARM_CORE_MARGIN`
  px on both axes), lattice points, distance. No stance → refused by name with the counts.
- `execPoleThrust`: settle, face tap, re-ask the rect (and the ghost reach) where the walk stopped, the POSITIVE CONTROL
  (`activate` false and `hitsTimer` 0), equip, ONE `primary` tick, wait ≤ `POLE_THRUST_WRITE_TICKS` (4) for `activate`,
  restore the slot. The record names the weapon, the stance, where it settled and the run's `hitsTimer` (25).
- `levelRun.js`: `darkTrapPolesFor`'s row (and so `run.lightPolesNow`) gains the game's own `activate` (the flag is
  `!activate`; an inverted pole's clear is UNLIT, so `lit` cannot answer "is the tag cleared"). A read-only view field;
  `darkTraps`' rows build their own shape and are unchanged. ⚠ `lightPolesNow` is read by the player skin
  (`seedlingSkinRenderer` / `seedlingNightSkin` tests green, `vitest-after.txt`).
- `solverView.js`: exports `GHOST_SWORD_REACH`, `ghostSlashRect` (the import door).
- `contactFidelity.js`: `inRoomPoleThrust: false`, `SEEDLING_IN_ROOM_POLE_THRUST=0|1`; `contactFidelity.test.js`'s default
  list pins it OFF.

**Why the ghost arm (measured, not planned).** The first build refused survey step 226 (L101, the route's bag)
*"the run holds NO SPEAR"* although the bag holds `hasSpear`: the Ghost Sword FUSES the Sword and Spear slots
(`appendInventorySlots` removes the spear slot; the step-226 slots are `[4,1,2]`). The game still lights the pole —
`slash()` passes `hasGhostSword ? "Spear" : "Sword"` — so that refusal was a gap, not a correct refusal. The arm is now
the bag's; the game agrees (witness below).

**Game witnesses (p4g, headless, port 9762).**
1. The four edges, the live sweep's own plans (`probe-seedling-divergence-sweep.mjs --ids=558,569,740,742 --mode=inv
   --page=seedling_bot_ap_p4g --contact-fidelity=<the 97 default-ON keys>,inRoomPoleThrust`), TWICE (the first at the
   Spear-only code, the second at the final code inside the 53-leg run; `sweep-pole-legs-on.txt`):

   | leg | end | the game's flag | room hits | divergence rows | verbs | ticks | game end = model end |
   |---|---|---|---|---|---|---|---|
   | 558 L63 f6 @(16,208) | done | {63,6} set, collected | 0 | 0 | pole | 65 | (55.5, 250.3) both |
   | 569 L65 f0 @(128,16) | done | {65,0} set, collected | 0 | 0 | pole | 58 | (136, 137.3) both |
   | 740 L101 f0 @(288,240) | done | {101,0} set, collected | 0 | 0 | dodge, kill, walk (+ the pole) | 709 | (124.28, 66.06) both |
   | 742 L101 f0 @(32,96) | done | {101,0} set, collected | 0 | 0 | dodge, walk (+ the pole) | 252 | (119.20, 66.07) both |

   (A plan's `verbs` list is the walk's; the pole verb's own record is in the segment — the node replays show
   `strategy: 'pole'` with `hitsTimer` 25 on every one.) Seam-time census on the captured requests (`--seam-time-sweep=
   -3..3`): **1 distinct answer over 7 clocks on every leg** (`seam-census-pole-legs.txt`).
2. Two committed tapes from survey step 226's boot view (`step-226-boot.json`), producer
   `scripts/procgen/plan-seedling-lightpole-witness.mjs` (`--check` re-derives both byte for byte), recorded with
   `check-seedling-bot-differential --record --only=lightpole-l101-ghost,lightpole-l101-spear` (`differential-record.txt`,
   ALL CHECKS PASSED; the re-check `differential-check.txt` ALL CHECKS PASSED); `tapeRunner.test.js`: *"JS stream matches the
   real game recording, exactly"* for both:
   - **`lightpole-l101-ghost`** — the route's bag: the ghost swing facing **N** from (126,76) in [7,4]; its 48 px-wide rect
     reaches the core across the wall corner. 307 t, 308 observations, hits 0, `save.time` game 8914 = model 8914.
   - **`lightpole-l101-spear`** — the same staging with `hasGhostSword` false: the thrust facing **E** from (124.4, 66.0) in
     [7,4], flush against the wall above, THROUGH the wall [8,4] — the rules-4 witness reproduced by the solver's own plan.
     280 t + 1 idle (see below), 282 observations, hits 0.

**Mutants** (predicted in `fidelityLightPole.test.js`'s docblock first; copy + restore, `cmp` clean; `mutants.txt`):
m1 the row unconditional → "OFF: no row" red (1). m2 the flush points dropped → the L101 geometry rows AND both witness
rows red (4) — ⚠ predicted the L101 rows only; the ghost stance x 126 is the flush column too (only the facing axis drops
flush points), so the prediction under-counted one row, and the docblock now says so. m3 a second press → every
"ONE thrust" row and both witnesses (6). m4 the boot-active check dropped → "already active at the build" (1).

**Unit file** `fidelityLightPole.test.js` (14 rows): OFF tables/refusals; ON row registered; the four edges (one press,
`activate`, the ledger, `hitsTimer` 25); the L101 geometry (E, [7,4], y 66); no Spear → `cannot-act`; a boot-cleared
pole → `already-clear` with zero ticks; both witness tapes ARE the solver's plans key for key; the ghost bag has no
spear slot.

## Movers — what this moves (before → after)

**Route survey** (local, `survey-seedling-route.mjs --through=end --route=full`, all 240 steps, ON vs OFF;
`survey-full-{on,off}.rows.txt`, md5 **`e0bc8835`** both): **201 SOLVED / 39 REFUSED both arms — 0 movers** by
(step, verdict, ticks, refusal text). It equals the CI baseline `40617953040` (201/39).
- Step **226** (L101 visit 2, `clear-tag {101,0}` then `reach-exit stairsup@144,96`) is the one step that reaches the
  verb. OFF: the clear-tag is a false `already-clear` (no solid), then REFUSED ITEM-GATE at `magicallockfire@112,48`.
  ON: the pole verb RUNS (the ghost swing), then the same REFUSED ITEM-GATE, same text. Same row, a truthful path.
- Step 124 (L63 → the L62 pole via its cross-room presser) is the presser arm, untouched; SOLVED both.

**Divergence sweep** (local, live p4g, the 53 legs of L63/L65/L101/L102 plus every pole leg, ON, against sweep 10
`40601015971`'s merged rows by KEY; `sweep-keys-on-vs-sweep10.txt`): ON 45 done / 6 failed / 2 skipped vs sweep 10's
41 / 10 / 2. **Exactly four movers, all predicted:** 558, 569, 740, 742 failed → done. The other 49 keys equal by end.

**Probes.** `seedling-probe.yml battery=standard` cannot run this switch ON: none of its 11 probes carries a contact
hook, and none walks a pole goal (grep `lightpole|clear-tag|contactFidelity` over the eleven: no hit). OFF it is
byte-identical by construction. Not run locally (≈1 h of box time for a byte-identical arm); dispatch it at the flip.

**The exact CI dispatches for the planner** (branch `claude/seedling-fidelity-wave-34-xaxfl9`):
1. Survey ON: `seedling-survey.yml` with the switch on is not a workflow input; re-run my local pair instead, or
   `-f only=226` at a build where the key is flipped. Expected: 201/39, step 226 REFUSED (same ITEM-GATE text).
2. Keyed sweep ×2, ON: `seedling-divergence-sweep.yml -f keys='<the 53 keys in sweep-keys-on-vs-sweep10.txt>'
   -f contact_fidelity='<the 97 default-ON keys>,inRoomPoleThrust' -f capture_requests=true` — twice. Expected: 558/569/
   740/742 done; the other 49 as sweep 10. (⚠ `contact_fidelity` turns every unlisted key OFF: list all 98.)
3. The same keys with `contact_fidelity` empty (the defaults, OFF) once, as the control (expected = sweep 10).
4. `seedling-probe.yml -f battery=standard` at the flip head.
5. ⚠ **`seedling-full-tier`** (the roster's `--tier=full` run) to bank the roster row: my two witness tapes take the
   `mechanic` category from 231 to **233** tapes, and `rosterCategories.test.js` ("the LIVE row carries one part per
   derived category") reads the standing value — it is the ONE red on this branch's push CI (`ci-vitest-summary`
   below). That is the planner's bank (`standing-values --write` is not mine to run), exactly as L100's tape was banked
   at the W33 flip (`dbbcc83a`).

**Send-ready for rules-4:** re-read the pole legs at this branch's head with the dispatch in (2); in my local run
`level_63__r10c2 … L63 flag 6`, `level_65__r0c8 … L65 flag 0` and both `level_101__r4c2 … L101 flag 0` are `done` on
p4g with the game's flag set.

## The JS arc

- **Nothing to wire.** `clearTagVerbOf` reads the solver's tables generically: ON, `solid:lightpole` → `{verb: 'pole',
  registered: true}` and `eventSolverGoal` emits the clear-tag; OFF it is `{verb: null}` and refuses `no-verb` as before
  (`jsRuntimeSolverEventGoal.test.js` green both arms).
- No signature or contract changed (`solveSegment`, `twoPassSolve`, `createRunForStaging` untouched). No new
  `SolverRefusal.obstacle.kind`: refusals stay `clear-tag` with the existing reasons (`cannot-act`, `unresolved`).
- `run.lightPolesNow` rows gained a field, `activate` (additive; the skin tests are green).

## The hammer arc

Nothing handed over; no hammer-owned function touched. The verb's walks use `walkTo` as every clear-tag verb does.

## Records, byte-inertia, banks

| row | result |
|---|---|
| identity block AFTER (this tree, OFF) | `identity-after.txt`: every row and all six producer `--check`s **equal** the BEFORE (`590b0b88` file md5 BEFORE). The one line that differed was the reference (4 → 8 DIFFER): my own doc commits moved the docs index and the instruments' citations; regenerated and committed (`0ee94c2c`), the `--check` is back to the base's 4 (the box artifact) |
| bounded vitest AFTER (OFF) | **3,119 / 3,120** — the one red is `rosterCategories` (the standing roster bank, 231 → 233; planner) (`vitest-after.txt`) |
| bounded vitest ON (`SEEDLING_IN_ROOM_POLE_THRUST=1`) | **3,117 / 3,120** — the reds are the defaults pins (`contactFidelity` "shipped defaults", LightPole "ships OFF") and the same roster bank (`vitest-on.txt`). No other row moves ON. |
| tapeRunner pairs AFTER | `tape-runner-pairs-after.txt` | **643**, md5 **`c2260ed7`**: +4 rows, all `passed` (the two tapes' differential and stepping rows); 0 failed; no row changed |
| surface census | `--write` + classified: `run:lightPolesNow` (seedling, live-state), `import:GHOST_SWORD_REACH` (seedling, constant), `import:ghostSlashRect` (seedling, function); `--check` GREEN 363 rows |
| constants census | `--write`; `--check` PASS 6,999 |
| entities / profile | PASS 566 / PASS 138 |
| tape index | `generate-tape-index.mjs` → 293; `--check` OK |
| roster pins (names) | `tapeEnvelope` 291 → 293, `observationTolerance` 291 → 293 and swapped 291 → 293 (measured), `dialogueAutoAdvance` 291 → 293 (292 inert), `r8Acceptance` exposed 94 → 96 + the two rows in `R8_ENEMY_BRIDGE` (L101, three flyers) and the mirror rows — all `lightpole-l101-ghost`, `lightpole-l101-spear` |
| reference | instruments index regenerated (497); `generate-procgen-reference --check` ALL MATCH; registry/capabilities left as committed (box artifact) |
| `check-procgen-help` / `check-procgen-docs` | ALL PASS |
| docs | `seedling-bot-log.md` entry; `seedling-bot.md` paragraph |
| push CI at `43e724d0` | run `40722511828`: 23,961 / 23,962 — the one red is `rosterCategories` (above); slow battery 271/271 |

## Deltas from the brief / what the brief got wrong (measured)

- **"thrust reaches only from the column's NORTH tile [*,16]" (L63)** — the solver's L63 f6 stance is (56,248) in
  **[3,15]**, one tile further north, thrusting S; the game lit the pole from (55.5, 250.3) (leg 558, twice). The 32 px
  rect reaches the core from y ≈ 250. The brief's statement is true of tile CENTRES one tile up; it is not the only
  stance.
- **"a refusal is CORRECT only if the game agrees (e.g. no Spear)"** — "no Spear" has a trap: with the Ghost Sword held
  the Spear's SLOT is gone and the pole is still lit by the ghost swing. The route survey's L101 step holds exactly that
  bag. Witnessed (`lightpole-l101-ghost`).
- The brief's four edges are all served by the Spear arm; the ghost arm is new scope I added because the route survey's
  step 226 needed it and the model already stepped it.

## Residue

- The reach-exit after the pole at survey step 226 refuses ITEM-GATE (`magicallockfire@112,48`, the Fire Wand) — the
  route's, not this slice's.
- The standard probe battery was not run (no ON hook; OFF byte-identical); dispatch (4).
- A pole lit by a press while a dark trap's death is still owed elsewhere in the room: not met on any route leg; the
  verb finishes on the write, and the light arm (`deriveLightPole`) still owns a dark trap on a corridor.

## Rows to BANK

- `inRoomPoleThrust` ships OFF; flip licence asks: the keyed sweep ×2 (dispatch 2) agreeing with the four movers; the
  bounded set ON already shows only the defaults pins.
- Roster: **293** tapes; `mechanic` 233 at the planner's next full-tier run.
- Survey 201 / 39 unchanged; sweep: +4 done (558, 569, 740, 742).
