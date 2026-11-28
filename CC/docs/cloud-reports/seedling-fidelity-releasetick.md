# seedling-fidelity-releasetick — the update a family takes on the tick a freeze releases (wave 55)

⚖ GO: Robert 2026-11-21 (planning-23's session), *"W55: closing tick (Recommended)"*, plus the launch GO for this brief.
Scope: ONE new `contactFidelity` key, default OFF, covering wave 54's two hand-overs. No flip, no default change, no
change to any existing key's ON branch.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-23` |
| Base | `c019510fa57b4cb718268316b6180969e9ef49df` (the W54 harvest, TRAIN 185). Measured there: 145 keys, 126 ON, the last seven `darkSuitBossRetaliation`, `owlContactInStep`, `turretSuitRetaliation`, `pickupTickFreeze`, `dialogueFrameFreeze`, `frozenTickUngated`, `freezeEdgeFrames`; `SOLVER_ENV_NAMES` 236, sorted, no duplicates |
| Harness branch | `claude/ceremony-tower-finishing-tick-18x367` (local branch `seedling-fidelity-releasetick`). The only branch pushed |
| Commits | D2 `f3ef9c50` (the code, the key, the pins, the rows) · evidence `16eefdfc` · D1 doc correction `a05cc76b` (**the last CODE commit**: comments in `levelRun.js` and `contactFidelity.js`, plus the regenerated census line numbers) · evidence `5c60169a`, `b0b2e606` (leg census, train ON) · producer line · this report (the head) |
| Verdict | **PASS for gap 1; gap 2 needs no code (its premise is refuted by a game witness).** The key ships OFF and OFF is byte-identical. The acceptance md5 is the standing value at all four settings. 294/294 tapes are ON = OFF. **0 legs** can move ON: no shipped room holds a texted ceremony beside one of the four families |

**The one thing to know first:** gap 2 is not a gap. A rope's pull runs inside `Player.update`, above `super.update()`.
So `fall()` raises the flag before the player's gated `friction(); input(); moveX; moveY`. The game's player takes **no**
step on the pull frame and **one** on the release frame, and the model's pull-tick step is that one. This is
game-witnessed: on `rockbutton-l28-livefall` the model OFF matches the game's player at Δ 0 after the cut, with the
player in mid-motion. The banked step the brief proposed breaks that witness (mutant 5), and wave 49's ROCKBUTTON
0-px row goes red with it. Gap 1 is modelled and vacuous on shipped content, like wave 54's gap 1.

## D1 — the AS3 and the model

### D1.1 — a texted ceremony, frame by frame

The AS3, with the add order from `Game.as` loadlevel (`addUpdate` prepends, `World.as:937-951`, so the last added
updates first):
- The player is added at `:2250`.
- The four families come after it: the drill at `:2290`, the turret at `:2295`, the ice turret at `:2296`, the beam
  tower at `:2297`.
- The pickups come after those (`:2330-2351`).
- The text NPC and the spits/blasts are runtime adds.
- So the update order is: runtime adds → pickups → the four families → the chasers → the player.

What happens on each frame:
- **T, the contact** (`Pickup.update` → `pick_up()`, `Pickups/Pickup.as:78-95`): it raises `Game.freezeObjects` and
  counts `specialTimer` from 150 to 149.
- **Phase A** (`:57-60,96-104`): every frame, `pick_up()` re-raises the flag and counts down. At 0 it adds the NPC and
  calls `myText.setTemp(this)`. **`setTemp` sets `talking = true` at once** (`NPCs/NPC.as:95-100`), and the setter
  raises `Game.talking` (`:264-271`).
- **The end of every frame where `Game.talking` is up** (`Game.as:1044-1051`): `canInventory()` is false
  (`:1549-1553`), so `inventory.open = false`, which is `Game.freezeObjects = false` (`Inventory.as:151-153`). That
  is why the `Bot`'s gate (`Bot.as:3201`, flag read at the frame's top) sees the dialogue frames live.
- **The dialogue frames:** `NPC.talk()` raises inside `if (talking)` (`:193-195`), and `pick_up()` re-raises.
- **The close C:** on the last page, `talking = false` lowers the flag and clears `Game.talking` (`:207-214`,
  `:250-263`), and `FP.world.remove(this)` is deferred. `Pickup.update` then re-raises it, because `myText` is still
  set. At C's end `Game.talking` is down, so nothing lowers the flag. `NPC.removed()` nulls `myText` (`:71-85`).
- **The release R:** the top of the frame is DEAD (the flag is up). `pick_up()` takes its `!myText` arm: the flag goes
  down and `removeSelf()` runs (`Pickup.as:106-112`). Everything after the pickup updates UNFROZEN.
- **The count, measured:** a texted collect costs **150** dead frames (`fixtures/dead-frame-observations.json`,
  `r3-collect-feather` and the rest: 170 with one 20-frame load). That is phase A's 149 plus R. The model's
  phase-A spend of 150 counts R's frame, so the finishing tick's `clock.now()` is R's `Game.time`.

| frame | game: the four families | game: chasers / player | model OFF | model ON |
|---|---|---|---|---|
| T (observed) | frozen once (the pickup is first) | frozen | wave 51's `pickupTickFreeze` (OFF unfrozen) | unchanged |
| phase A (149 dead) | turret anim and drill graphic run; the rest return | — | turrets stepped through the lump; the others not | unchanged |
| dialogue ticks (observed) | frozen, once each | frozen | the main slot (the tower: `runFrozenTick`'s under `freezeEdgeFrames`) | unchanged |
| **C (observed)**, the finishing tick | **frozen**, once | chasers frozen (ceremonyShove's dead frame); player frozen | each family **once, frozen**, in its main slot (`ceremony` is still set) — this is C's update | unchanged |
| **R (dead)**, the same model tick | **UNFROZEN**, once | chasers and player unfrozen | **missing** | **one unfrozen step per family**, at the finishing arm |
| R+1 | live | live | live | live |

- The spits and blasts update ahead of the pickup, so they are frozen on C and R. The model steps them once on the
  finishing tick. ON adds R's frozen step.
- The chasers already take C and R: `stepCeremonyReleaseFrameNow` (C's dead frame, under `ceremonyShove`) and the
  tick's live step (R). ON does not touch them.
- **A text-less special pickup (no NPC) does not share the shape.** It has no C. Its R is F+150, the frame where
  `specialTimer` is already 0 and `!myText` lowers the flag. Wave 51 models that frame: the turrets'
  `stepShooterReleaseFrameNow` under `pickupTickFreeze`, and T's unfrozen step stands for it for the lump-less three.
  ON leaves it untouched; its row is ON = OFF.
- **A Seed** keeps the flag up (`Seed.removeSelf`). It takes its own arm and is untouched.

Measured (`d1/release-frames.txt`, `tools/release-tick.mjs`). Each row is staged: `.oel` rows appended to a cloned
atlas level, the player booted on a feather, and talk tapped until the close at t23:

| family (staging) | OFF | ON |
|---|---|---|
| beam tower (L29 + `beamtower@112,40`) | t23 `[true]`; first beam t25 | t23 `[true,false]`; first beam **t24** |
| turret (L29, feather `@128,168`) | t23 `shootTimer` 40; next spit t70; spit hit t77 | 39; **t69**; **t76** |
| ice turret (L59 without its turret, `iceturret@144,72`) | volleys `[4, 52]` | `[4, 51]` |
| drill (L59, `drill@120,64`, `pickupTickFreeze` ON so it is idle at C) | at C `(128,72) sit`; hop t24 | `(144,56) drill`; hop **t23** |

### D1.2 — the rope's release frame

- **The pull.** `Player.update` (`Player.as:476-583`) calls `slash()` / `spear()` / `fire()` (`:562-571`) above
  `super.update()` (`:573-576`). `genericHit` → `RopeStart.hit()` (`Puzzlements/RopeStart.as:40-49`) → `set activate`
  (`:79-91`) → `FallRock.set activate` (`Scenery/FallRock.as:111-118`) → `fall()` (`:103-109`), which raises
  `Game.freezeObjects`. `Mobile.mobileUpdate` gates `friction(); input(); moveX(v.x); moveY(v.y)` on the flag
  (`Mobile.as:31-41`), so **the player does not move on the pull frame P.**
- **The span.** The frames after P are dead. The rock's release frame (`FallRock.as:92-97`) lowers the flag before the
  player updates (the rock is added at `:2353`, the player at `:2250`), so **the player moves once, on R**, with the
  velocity P left and the keys held.
- **The model.** The press runs at the pull tick's press slot (`applyThrust` / `applyFire`), above
  `pendingFreeSteps` and the main `stepV2`. `dropRock` collapses the span there, with the player still at P's top,
  which is the game's position through the span. Then the tick's own `stepV2` runs. **That step is R's**, and it comes
  after wave 54's release-frame bodies (`stepRockReleaseBodiesNow`), which is the game's order.
- **The button differs**, which is why `dropRocksTogether` banks one step. The `Button` presses in its own update,
  ahead of the player, and the model resolves frame A through `runFrozenTick`, which takes no player step.
- **The witness** (`d1/rope-witness.txt`, `tools/rope-witness.mjs`): `rockbutton-l28-livefall` cuts the rope at t155
  with the player moving east at about 2 px a tick. Model OFF against the game's samples gives **Δ 0.0000 from t140
  to the end**. ON (this key with `freezeEdgeFrames`) gives the same.

| rope room | rope → rocks | legs | what the "missed" step changes |
|---|---|---|---|
| L28 | `rope@160,64` → `fallrock@112,240` | 8 | nothing: it is not missed (witnessed, Δ 0) |
| L39 | `rope@96,384` → `fallrock@144,624` | 3 | nothing, the same mechanism |
| L16 | `rope@32,16` → no rock | — | no freeze |

### D1.3 — the change chosen

- **Gap 1:** `stepCeremonyReleaseFamiliesNow()`, called at the top of the ceremony branch's ordinary finishing arm.
  That is below the main slots (C) and below `stepCeremonyReleaseFrameNow` (the chasers' C), and above the chasers'
  and the player's R (the tick's fall-through). In the game's order:
  - first the runtime adds, frozen (`stepBlastsNow`, `stepSpitsNow`; `ceremony` is still set);
  - then, with `ceremony` held to null for the call and restored: the tower (`stepBeamTowersNow({ frozen: false })`,
    when the BEAMTOWER switches step it), the ice turret (`stepIceTurretsNow({ mainSlot: false })`), the turrets
    (`stepShootersNow(…turretHitPlayerNow…, { frozen: false })`, `stepShooterReleaseFrameNow`'s shape), and the drills
    (`stepDrillsNow()`, not the main tick).
  - Only a ceremony with a dialogue takes it. The Seed arm and text-less pickups do not.
  - `stepIceTurretsNow` gains `{ mainSlot = true }`. False skips the pickup and dialogue predicates (R is not a
    pickup's T). Every existing caller passes nothing, so its behaviour is unchanged.
- **Gap 2:** no change. The `fallRockFrozenFrame` doc said the player's release-frame step was "not modelled". That
  line is corrected to the witnessed account.
- **What it does to:**
  - **`spitForecastNow` and the hammer forecasts:** no line changed. `spitForecastNow` steps every previewed tick
    unfrozen from the live state (`stepTurretSpit(…, { frozen: false })`), so no forecast previews a ceremony. After a
    texted close they start from the live state, which ON is one tick further along.
  - **Wave 50's turret slot:** R's turret step passes `turretHitPlayerNow` when `turretSuitRetaliation` and
    `STATIC_SWORD_ARM` are ON. Its `turretSlotContact` is NOT saved and restored, unlike wave 54's dead-span steps.
    The finishing tick falls through to `stepContactsNow` in the same tick, so the static scan reads it and skips the
    double bill. Measured: one bill, on t23, where the scan alone also bills it; OFF the slot bills it a tick late (t24).
  - **Waves 51–54's predicates and keys:**
    - `pickupFreezesFamilyNow` and `dialogueFreezeAheadNow` are asked by the main slots only. The mutant that asks them
      at R goes red (mutant 4).
    - `ceremonyHoldsThroughNow` (wave 54) is false on the finishing tick, so the tower's C step stays in the main slot.
    - `frozenTickUngated`'s span steps and `freezeEdgeFrames`'s rock release are other paths.
    - No predicate or key line moved. Composition rows are below.
- **STOP rule:** not triggered. Every family's R step reads state the model holds at the finishing arm. Two edges are
  named rather than modelled:
  - a second pickup collected ON R itself (it would start in the next tick's detection);
  - the tower's anim with a `Game.time`. It is already unknown from T on, because phase A is not stepped for the
    tower (pre-existing). R's step leaves it unknown.

## D2 — the key

`CONTACT_FIDELITY.freezeReleaseTick` is **OFF** and appended LAST: 146 keys, 126 ON (node import of
`contactFidelity.js`). Its env is `SEEDLING_FREEZE_RELEASE_TICK=0|1`. In `SOLVER_ENV_NAMES` it sits between
`SEEDLING_FREEZE_EDGE_FRAMES` and `SEEDLING_FRONTIER_DOOR_ROUTE`. A node import of `solverEnvChannel.js` gives 237
names, sorted, no duplicates. Its doc block, in brief:

> fidelity RELEASETICK D2 (wave 55) — A TEXTED CEREMONY'S FINISHING TICK: THE RELEASE FRAME'S ONE UNFROZEN UPDATE.
> The finishing tick stands for two game frames … the four are FROZEN on C and UNFROZEN on R. The model stepped each
> once, frozen, in its main slot … C's update, and R's was missing … ON the ceremony branch's finishing arm takes R's
> update … A text-less pickup has no C and is untouched … a Seed keeps the flag up … C is the observed frame and R a
> dead one … The rope rock's player release step needs no key … (game-witnessed, `rockbutton-l28-livefall`, Δ 0) …
> OFF: byte-identical.

**Key-order pins re-pinned.** I grepped `'freezeEdgeFrames']` rather than trusting a list:
- the 20 tail lists now end `'freezeEdgeFrames', 'freezeReleaseTick']`;
- `contactFidelity.test.js`: the defaults row and the env guard;
- `fidelityFreezeEdgeFrames.test.js`: its `.at(-1)` became a tail of `['freezeReleaseTick']`.

`fidelityFencepost`'s SOURCE-SHAPE pin is untouched (nothing was added near `spinnersSteppedThisTick`), and its file
is green. The one-spelling law is green: no new import.

### Rows (`fidelityFreezeReleaseTick.test.js`, fast tier, 10 rows)

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| beam tower (staged) | close `[true]`, beams t25, t26 | `[true,false]`, beams t24, t25 |
| turret (staged) | close `shootTimer` 40/40/40; spits t70; hit t77 | 39/39/40; t69; t76 |
| ice turret (staged) | volleys `[4,52]` | `[4,51]` |
| drill (staged, `pickupTickFreeze` under) | `(128,72) sit`; hop t24 | `(144,56) drill`; hop t23; equal from the next tick |
| composition: all five (W50–W54) ON | tower `[true]`, beams t33; turrets idle, spits t30; volleys `[27,72]`; hop t24 | `[true,false]`, t32; `startshot`, t29; `[26,71]`; t23; no throw |
| wave 50's slot (booted in `turret@128,192`'s box) | slot ON: billed t24; scan: t23 | slot ON: **t23**, once; scan: t23; all five: t23 |
| text-less key in the turrets' range | — | **ON = OFF**, the whole result, under nothing, `pickupTickFreeze`, and all five |
| no freeze (L29 idle) | — | **ON = OFF**, the whole result |
| rope rock (`rockbutton-l28-livefall`) | the model's player = the game's samples from t150 to the end | **ON = OFF** (with `freezeEdgeFrames`) |

**Mutants.** Each was applied to a copy and restored (`grep -c MUTANT` → 0 after each; `d2/mutant-*.txt`). Mutants 1–4
ran over this file, `fidelityPickupFreeze`, `fidelityFreezeEdgeFrames`, `fidelityFrozenTick` and
`fidelityDialogueFreeze` (54 rows):
1. **No R step.** Predicted: the four family rows, composition and the slot row. Measured: **exactly those 6**.
2. **R stepped frozen** (`ceremony` not lowered; the tower `frozen: true`). Predicted 6. Measured **5**: the TURRET row
   stays green. `stepShootersNow` is passed `{ frozen: false }` explicitly, so only `turretHitPlayerNow` (which reads
   `ceremony`) sees the mutant, and that is the slot row's failure. The prediction was wrong; the measurement is the
   finding.
3. **No drill at R.** Predicted: the drill row and composition. Measured: **exactly those 2**.
4. **The ice turret asks the predicates at R** (`mainSlot: true`). Predicted: the composition row alone. Under
   `pickupTickFreeze` the predicate finds the feather still underfoot and freezes R. Measured: **exactly that 1**.
5. **Gap 2 as the brief proposed it** (`dropRock` banks one `pendingFreeSteps`), over this file, `fidelityRockButton`,
   `fidelityFreezeEdgeFrames` and `fidelityFrozenTick`. Predicted: the rope witness row. Measured: **3 red**:
   - the rope row, at t156: 143.666 where the game has 142.729;
   - wave 49's ROCKBUTTON "all three witnesses reproduce at 0 px";
   - its OFF walk row.

   The game refutes the banked step twice.

⚠ **Not game-witnessed:** every ON family row. The pieces are the AS3 lines above and the families' own
transcriptions. The rope rows ARE game-witnessed.

## D3 — the ON measurement

- **Byte-inertia OFF.** `git diff --name-only c019510f HEAD | grep -aE 'fixtures/|golden|tapes/'` is EMPTY.
- **Acceptance.** `batch-seedling-acceptance.mjs | md5sum` gives the standing `391322d681b7aa0229d94b3f6906d024` at all
  four settings (`d3/acceptance-*.md5`):
  - the base (a clean worktree at `c019510f`);
  - the head OFF;
  - the head with this key ON;
  - the head with this key and all six others ON (`freezeEdgeFrames`, `frozenTickUngated`, `pickupTickFreeze`,
    `dialogueFrameFreeze`, `turretSuitRetaliation`, `owlContactInStep`).

  Measured at `f3ef9c50`; `a05cc76b` changed comments only.
- **Committed tapes.** All **294** replay byte-identical ON vs OFF (`d3/tapes-onoff.txt`, wave 54's `tape-onoff.mjs`
  with `KEY=freezeReleaseTick`).
- **The census.**
  - **Method.** `tools/rooms.mjs` (→ `d1/rooms.json`) lists every room holding a texted ceremony source (placed
    special pickups by their ceremony text, plus the runtime DarkSword, Fire and Watcher Seed) beside any of the four
    families, and every rope with its rocks. Then the legs (`seedling-divergence-legs.mjs`, **922** at the head) are
    filtered by level (`d3/leg-census.txt`).
  - **Rooms:** **none**.
    - L29 and L40 hold only text-less sources (boss keys of keyType 1 and 2, totem parts): `PICKUP_CEREMONY_BY_KEYTYPE`
      gives text to keyType 0 only.
    - L103's Watcher Seed takes the Seed arm.
  - **Legs where ON can step something: 0.** Survey steps: 0, the same rooms. Gap 2 adds no code path.
  - **Runtime confirmation** (`d3/census-probe.txt`). A temporary throw at the R step whenever the room holds a family,
    a spit or a blast (copy and restore): **0 hits** over the 294 tapes ON and the acceptance batch ON. It does fire on
    the staged L29 feather row, so the probe can fire.
- **Vitest ON** (the 54 gate files, `--maxWorkers=3`, `SEEDLING_FREEZE_RELEASE_TICK=1`; `d3/vitest-on.txt`): 53/54
  files; 1346 passed, 2 failed, 2 skipped (the env-guarded "ships OFF" rows). **ON movers**, both wave 54's
  finishing-tick pins, which ON corrects by construction (`[true]` → `[true,false]`):
  - `fidelityFreezeEdgeFrames.test.js:147` — the tower through a texted ceremony, closing tick;
  - `fidelityFreezeEdgeFrames.test.js:154` — the same, composed with every wave 51–53 key.
- **W54's two ON movers under this key and `freezeEdgeFrames` ON** (`d3/w54-movers.txt`):
  `fidelityFrozenTick.test.js:174` (`hitsTimer` 25 for 26) and `seedlingSoundCues.test.js:215` (the `stand:29` golden)
  fail exactly as under `freezeEdgeFrames` alone, with the same assertions. This key adds no mover there (both are
  rock-span rows).
- **Train ON** (`vitest.train.config.js`, one file at a time, `SEEDLING_FREEZE_RELEASE_TICK=1`; `d3/train-on.txt`).
  The rooms' `.train.` files: the 32 naming L28/L29/L39/L40/L103 (`d3/train-files.txt`), narrowed to the 10 that stage
  or name one of the four families or a feather (`d3/train-narrow.txt`):
  **10/10 files, 34 tests passed ON, 0 movers**: `fidelityL40Latch`, `hammerApproachOrder`, `hammerBk2Combat`,
  `hammerEscapeExact`, `hammerIceTurretStatic`, `hammerKeylockTurret`, `hammerLatchWeigh`, `hammerSouthDoor`,
  `hammerSpinnerPress`, `hammerWallFlyerDrillKill`. The other 22 were not run: they name only a room number and stage
  none of the four families (and the census probe fired 0 times on shipped content).

### The named sweep (for the planner)

- **`freezeReleaseTick`: 0 legs.** No shipped room holds a texted ceremony beside one of the four families (the census
  above), and the probe fired 0 times on every committed tape and the acceptance batch. Shards = min(10, 0) = 0, so
  there is no sweep to run. The flip gate (a hitless leg stays hitless) is vacuous on shipped content.
- **Gap 2:** no key, no sweep.

## Gates

- **Bounded vitest BEFORE** (a clean worktree at the base, submodules symlinked; 53 gate files, the new test absent):
  **53/53 files, 1339 passed** (`d3/vitest-before.txt`, `d2/gate-files-before.txt`).
- **AFTER** (`f3ef9c50`, OFF; 54 files): **54/54, 1350 passed** (`d3/vitest-after.txt`, `d2/gate-files-after.txt`).
  After the doc commit `a05cc76b`, the new file, `contactFidelity`, `seedlingConstantsCensus`, `seedlingSolverSurface`,
  `lintGateLabels`, `oneSpelling` and `fidelityFencepost` were re-run: 7/7, 167 passed.
  - The set:
    - `contactFidelity*`, `playerDamage*`, `levelRun*`, `fidelityPickupFreeze*`, `fidelityDialogueFreeze*`,
      `fidelityFrozenTick*`, `fidelityFreezeEdge*`, `fidelityCeremony*`, `fidelityRock*`, `fidelityTurret*`,
      `seedlingSoundCues*`, `oneSpelling`;
    - every test file `grep -a -l` finds for `runFrozenTick`, `stepCeremonyReleaseFrameNow`, `dropRock`,
      `dropRocksTogether`, `pendingFreeSteps`, `beamTower`, `BeamTower`, `freezeEdgeFrames`, `frozenTickUngated`,
      `pickupTickFreeze` and `freezeReleaseTick` (the key-order pins among them);
    - `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus`
      and `seedlingSolverSurface`.
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red, 1 skipped** (`plan-seedling-r7-ends-meet`, a browser arm in CI), on a still tree (`d3/producer-checks.txt`).
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions
  match.
- **Constants census:** `--check` PASSes after `--write` (0 new, 0 vanished; line moves only). `--profile-rows` left
  `seedling-constants-fields.csv` byte-identical, and a second `--write` then `--check` showed 0 drift. Repeated after
  `a05cc76b`.
- **Solver surface:** `--check` GREEN (374 rows) after `--write` (line numbers only).
- **CI** `JavaScript Unit Tests` at the code head `a05cc76b`: run 44939083905 **success**: suite 29295 passed, 0 skipped, 0 failed (3 shards); slow battery 438/438. Later commits are evidence and docs only. (The run at `f3ef9c50` was superseded by this one.)
- **Owed by the planner (I cannot dispatch):**
  `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/ceremony-tower-finishing-tick-18x367 -f train_only=true`

## What the brief got wrong (measured)

1. **"A rope's `dropRock` banks none: the player's update on the release frame is not modelled at all."** It is
   modelled, as the pull tick's own step. The pull raises the flag inside `Player.update` above `super.update()`, so
   the game's player is frozen on the pull frame, and its one step is R's. Game-witnessed at Δ 0, and the proposed
   banked step breaks two witness rows (mutant 5). The `dropRock` doc line that said so (wave 49's "⚠ Not modelled")
   was the source; it is corrected.
2. **"The close frame C is a dead frame … On the release frame R …"** (also wave 54's table). **C is the observed
   frame and R the dead one.** `setTemp` raises `Game.talking` when the NPC is added, and `Game.update` lowers the flag
   at the end of every frame while `Game.talking` is up, but not at C's end. Phase A is 149 dead frames and R the
   150th: the measured 150. Both frames are in the one finishing tick either way, so the change is the same, but the
   clock reading follows from it: the finishing tick's `clock.now()` is R's `Game.time`.
3. **"C gets its frozen family step (lump-less families included)."** C already has it: the main slots step every
   family once, frozen, on the finishing tick (`ceremony` is still set). What was missing is R alone. The model's one
   step was frozen in the right state for C; it was not R's step in the wrong state.
4. **`ENCOUNTERS2`'s `pickupRemoval.js` doc says "the player moves on F".** On the close frame `Pickup.update`
   re-raises the flag before the player (the pickups are added after it), so the player moves on F+1 (R), inside the
   same model tick. Its flag-timing measurements are untouched by this; its prose is named here, not edited (not this
   key's).
5. Wave 54 counted 924 legs; the head counts 922 (`seedling-divergence-legs.mjs`, 909 run + 13 skipped by name).

## Hand-overs

- **To the planner:**
  - the `train_only` dispatch at my head;
  - the sweep: 0 legs (no shipped room);
  - at harvest, `SOLVER_ENV_NAMES`: my entry sits after `SEEDLING_FREEZE_EDGE_FRAMES`;
  - wave 54's two finishing-tick pins (`fidelityFreezeEdgeFrames.test.js:147,154`) move ON by design. A flip re-pins
    them to `[true,false]`.
- **To fidelity (later), beyond this licence:**
  - **The tower through phase A.** The 149 frames are not stepped for the beam tower (only the turrets and the
    bombs), so with a `Game.time` its anim is unknown from T on. That is the room-level reason a tower beside a texted
    pickup refuses rather than models.
  - **A pickup collected ON R** (a second special pickup under the player on the release frame): not asked at R. It
    starts in the next tick's detection.
  - Carried from wave 54, unchanged:
    - the release frame's pickups after a ROCK (collected a frame late);
    - the ice turret and beam tower in a rock room (refused ON);
    - the crusher, bomb pusher and arrow traps in a rock room.
- **To hammer:** nothing moves on shipped content. After a staged texted close beside a turret, the live run ON is
  one `shootTimer` further along.
- **To ENCOUNTERS2's owner:** the "player moves on F" sentence in `pickupRemoval.js` (point 4 above).

## Residue

- Every ON family row is staged, not game-witnessed (no shipped room has the shape). The rope rows are game-witnessed.
- The reached legs: none, so no browser sweep was needed.
- Evidence: `seedling-fidelity-releasetick-evidence/`:
  - `tools/`: `release-tick.mjs` (the finishing-tick probe, per family, OFF/ON), `rope-witness.mjs` (the model's player
    against a witness fixture), `rooms.mjs` (the room census), `tape-onoff.mjs` (wave 54's);
  - `d1/`: `release-frames.txt`, `rope-witness.txt`, `rooms.json`;
  - `d2/`: the gate file lists and the five mutants;
  - `d3/`: the acceptance md5s, the tapes OFF/ON, the census probe, the leg census, vitest BEFORE/AFTER/ON, the W54
    movers, the train files and train ON, the producer line.
