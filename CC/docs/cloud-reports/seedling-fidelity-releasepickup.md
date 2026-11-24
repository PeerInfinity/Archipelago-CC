# seedling-fidelity-releasepickup — the updates inside a freeze's dead span (wave 56)

⚖ GO: Robert 2026-11-21 (planning-23's session), *"Launch W56 now (Recommended)"*, plus the launch GO for this brief.
Scope: ONE new `contactFidelity` key, default OFF, covering wave 54's and 55's last freeze-edge hand-overs. No flip, no
default change, no change to any existing key's ON branch.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-23` |
| Base | `fae509e41dfb094fd7ddab89a11f9ed0a6466822` (the W55 harvest). Measured there with node imports of the base files: **146 keys, 126 ON**, the last eight `darkSuitBossRetaliation`, `owlContactInStep`, `turretSuitRetaliation`, `pickupTickFreeze`, `dialogueFrameFreeze`, `frozenTickUngated`, `freezeEdgeFrames`, `freezeReleaseTick`; `SOLVER_ENV_NAMES` **237**, sorted, no duplicates |
| Harness branch | `claude/seedling-fidelity-release-pickups-levv53` (local branch `seedling-fidelity-releasepickup`). The only branch pushed |
| Commits | D2 `54e959e9` (the code, the key, the pins, the rows, the census regen, the mutants: **the last CODE commit**) · D3 evidence `69eba749` · train ON, producer line and this report (the head) |
| Verdict | **PASS for gap 2 (modelled); STOP for gap 1's model, with a named interim refusal ON.** The key ships OFF, and OFF is byte-identical: the two source files take 130 inserted lines and 0 deleted, every one behind the key. The acceptance md5 is the standing value at all four settings. 294/294 tapes give ON = OFF. **0 legs** can move ON: the runtime probe fired 0 times on every tape, the acceptance batch and the five survey steps in the reached rooms |

**The one thing to know first:** gap 1's premise is wrong, and the wrong part matters.
- `Pickup.update`'s `collide("Player")` has **no freeze gate**. Only `super.update()`, `Mobile`'s move, has one.
- So the game asks every pickup on **every** frame of a rock's span, not only on R.
- The player does not move through the span. So a pickup under the player at R was under it from the span's first
  frame, and the game collects it **there**, not on R.
- Its ceremony then runs *inside* the rock's freeze. `pick_up` re-raises the flag after the rock every frame, so R does
  not release. That is two concurrent freezes, which the model does not hold: **STOP**.
- The model had already asked every span position but two: a button's frame A, and the wand's landing snap. ON refuses
  those by name, as the interim.
- Gap 2 is modelled. The tower's frozen update is its Spritemap alone, a pure function of the frame count. With the
  three neighbouring keys ON, a tower room with a texted pickup no longer refuses: R bills the beam.

## D1 — the AS3 and the model

### D1.1 — a rock's span and the pickups

**The AS3:**
- `FallRock.update` (`Scenery/FallRock.as:51-101`):
  - the landing arm runs at `:64-85`;
  - the release frame R is at `:92-97`: `cameraTimer == 0` → `Game.freezeObjects = false; Game.resetCamera()`;
  - from the landing on, its first arm (`:54-60`) snaps an overlapping player to the rock's top;
  - `fall()` (`:103-109`) raises the flag.
- `Pickup.update` (`Pickups/Pickup.as:50-88`):
  - while `special && specialTimer < 150`, it calls `pick_up()` (phase A, `:57-60`);
  - else it looks up the nearest player, does the attraction, and at **`collide("Player", x, y)` → `pick_up()`**
    (`:63-84`) collects. This sits **outside** `Mobile.mobileUpdate`'s gate (`Mobile.as:31-41`), which only
    `super.update()` reaches (`:86`).
  - `pick_up()` (`:90-124`): a special pickup raises the flag (`:95`) and counts down; a plain one calls `removeSelf()`.
  - Every placed pickup class but `APItem` sets `special = true`. `Coin` (an `Enemy`/`Chest` drop) and `APItem` are
    plain.
- **The add order** (`Game.as` loadlevel; `addUpdate` prepends): the player is at `:2250` and the drill to the beam tower
  at `:2290-2297`. Then come the pickups: `apitem` … `fire` at `:2330-2340`, the `button` at `:2341`, and `bosskey`,
  `totempart`, `health`, `seed` at `:2348-2351`. The `pull` is at `:2352` and the `fallrock` at `:2353`. Runtime adds
  (coins, the Seed, the DarkSword, the Fire) update first.

**Frame by frame**, per rock source:

| source | frame | game | the model's ask |
|---|---|---|---|
| rope (`dropRock`) | P, the pull | the pickups update before the player and test the player's post-(P−1) box. The pull runs inside `Player.update` (wave 55), so the player does not move | the pull tick's detection (`pickupUnderfoot`, line ~23674), above the press slot: **the same box** |
| rope | span, R | the player is still. The pickups test the same box every frame, R included (they update after the rock, but the collide is ungated anyway). A landing snap moves the player | — (the snap is already **refused** by name at `publishRopeGroup`) |
| button (`resolveButtonFalls`) | A, the press | `Button.update` presses from the player's post-(A−1) box and `fall()` raises the flag. The pickups added before the button (`:2330-2340`) update after it; the rest update before it. Either way they test **the post-(A−1) box** | **not asked**: tick A is `runFrozenTick` + `resolveButtonFalls`, with no detection. The last ask (tick A−1) tested post-(A−2) |
| button | span, R | the same box; the release step moves the player after the pickups | the snap is already refused (`resolveButtonFalls`) |
| button | R+1 | the pickups test the post-R box | tick R+1's detection tests the post-R box: **correct** |
| wand (`dropRocksTogether`) | span | the wand's own ceremony position | the snap is **applied** (`state.y = dropped.snapY`) and never asked |

So a pickup "under the player on R" is, in the game:
- **under it from the span's first frame** (P, A or the landing), and collected **there**;
- **then a nested freeze.** `pick_up` re-raises the flag after the rock every frame, so R does not release.
  - A texted ceremony's NPC arrives at T+150 and `Game.talking` lowers the flag at each frame's end, so its dialogue
    frames are observed while the rock's camera still holds.
  - A text-less one lowers the flag at T+150 and ends the rock's freeze early (no arbitration).
  - Either way, the span is not 172 dead frames plus a fresh 150.
- A pickup reached only by R's release step is collected on **R+1**. The model already does that (row below).

**Measured** (`tools/rockspan-pickup.mjs`; L29 + a feather, the player walking up onto `button@112,128`):

| feather | overlaps | game (from the AS3) | model OFF | model ON |
|---|---|---|---|---|
| `@112,127` | the frame-A box (post-t24) | collected at A, the ceremony nested in the rock's span | rock t25 (172 dead), then the ceremony starts at **t25**, after the span: a fresh 150 on top | **refused by name** at frame A |
| `@112,126` | only the post-release box | collected at R+1 | the ceremony starts at t25 (R+1) | **ON = OFF**, the whole result |
| `@112,128` and up | an earlier box | collected first; the button is then pressed during the ceremony | the existing refusal (*"a button is pressed DURING a pickup ceremony"*) | the same |

**The census per rock room** (`tools/pickuprooms.mjs` → `d1/pickuprooms.json`):

| room | source → rock | pickups | under the player at a span position? |
|---|---|---|---|
| L28 | `rope@160,64` → `fallrock@112,240` (`button@112,240` tset 0 drops nothing) | none | no |
| L29 | `button@112,128` → `fallrock@112,112` | `bosskey@112,64` (keyType 1, text-less) | no: 64 px above the button, and the rock lies between them |
| L39 | `rope@96,384` → `fallrock@144,624` | `totempart@72,40` | no: 344 px from the rope |
| L43 | the wand's removal → 3 tset-0 rocks | the wand itself (the source) | no: no rock lands on the wand's stance (no snap) |
| L74 | `button@288,128` → `fallrock@288,144` | `darkshield@48,32` | no: 240 px from the button |
| L32, L82 | `fallrocklarge` (the BobBoss and lava-arena paths) | — | not these paths |

Runtime pickups: the Seed (L103), the DarkSword (the Witch's room) and the Fire (the BobBoss arenas). None is in a
rock room on these paths. Coins and `APItem`s are not in `pickupUnderfoot` (an `APItem` take is told through
`takeApItem`); named in the residue.

**What a one-frame-late collect would move:** nothing. There is no one-frame-late case. The ON-able case is "collected
inside the span". What it moves (OFF) is the whole timeline: a fresh 150-frame phase A after a 172-frame span, where the
game overlaps them. The ceremony's start, the flag and the clock all shift by the overlap.

### D1.2 — the beam tower through phase A

- **`BeamTower.update`** (`Puzzlements/BeamTower.as:52-103`): `if (Game.freezeObjects) return;` (`:54-57`) is its
  first line. Above it nothing runs; below it are the beam test (`:59-97`) and the drift `y += 0.3·sin(worldFrame…)`
  (`:99-102`).
- **`World.update`** (`net/flashpunk/World.as:58`) calls `e._graphic.update()` for every entity **outside** that
  gate. So under the flag the tower's Spritemap plays on, and its `animEnd` callback (`:186-197`) turns `direction` and
  plays the next anim.
- **The verdict:** the frozen update is a pure function of the frame count. No `y` changes, no beam is tested.
  `stepBeamTowerFrame(t, { time: null, frozen: true })` is exactly that.
- **The model's phase-A lump** (wave 55's D1.1): at the contact, after `spendCeremonyPhaseA` (the clock +150), the
  turrets get `stepShootersThroughFreeze(149 or 150)` and the bombs `stepBombsThroughFreeze(150)`. The tower gets
  nothing.
- **The refusal it causes:** `stepBeamTowersNow` tests `clockNow === t.lastClock + 1`. T's main-slot step reads `g`,
  and the next step reads `g + 150`, so the jump marks the anim (and `y`) unknown. A player in the tower's reach is then
  refused by name.
  - Measured (`tools/tower-phasea.mjs`, L29 + `beamtower@112,40` + a feather, with `seam: {time: 900}`): OFF refuses
    at R, under any setting of the three neighbour keys.
- **⚠ A pre-existing hole, found here:** when T is the tower's FIRST stepped tick (a ceremony on the room's first tick,
  or a boot on the pickup), `lastClock` is null. The jump test then cannot see phase A. OFF, with `pickupTickFreeze`
  and `freezeEdgeFrames` ON, claims the anim **known** with 150 frames missing (`[1,'sit',0,0,true]` at the close where
  the stepped model has `[0,'right',1,2,true]`), and the beam that R bills ON goes unbilled.
- **Census:** the tower rooms are L103, L104, L105, L107 and L108. **No placed pickup** in any. L103 holds the Watcher,
  whose bloody Seed is a runtime texted pickup, so the lump can reach it.
- **The tower's state at R:**
  - Staged (`TOWER_ROOM`): after R's unfrozen step it is `direction 0, 'sit', index 0, frame 0`, known. C's frozen step
    left it beaming right (frame 2), and R's step tests that beam and bills it at **t25**. The next beams are t37–39
    (the turn to "up").
  - OFF: unknown, and refused at t25.

### D1.3 — the change chosen

**Gap 2: `stepBeamTowersThroughPhaseANow()`**
- It is called beside `stepShootersThroughFreeze` in the placed-pickup branch, and after the runtime Seed's, the
  DarkSword's and the Fire's ceremony starts. Only a texted ceremony (`ceremony.dialogue`) takes it.
- It steps every tower 149 frames, frozen: T+1..T+149, where T is `clock.now() − 150`. The frames carry no trace row.
- **The anim is claimed known** only when it is `exact`: `pickupTickFreeze` (T's one frozen step, `runFrozenTick`'s),
  `freezeEdgeFrames` (one per dialogue frame) and `freezeReleaseTick` (R's) are all ON.
  - Then `lastClock := clock.now() − 1`, but only from a continuous history: `lastClock` is T's frame, the frame before
    it, or null. Under `pickupTickFreeze`, T's own step comes after the lump, and frozen anim steps commute.
  - Otherwise it marks `animKnown = false`, so the hole above cannot claim a stale anim.
- **The count, exact:** T 1 + lump 149 + 1 per dialogue frame + C 1 (main slot, frozen) + R 1 (unfrozen) is the
  game's T, T+1..T+149, the dialogue frames, C and R.
- `relabelBeamTowerCloseFrameNow()` runs at the top of wave 55's `stepCeremonyReleaseFamiliesNow` try block, before
  R's tower step, and is gated by this key.
  - The finishing tick's clock reads R's `Game.time` (the phase-A spend counted R), so C's frozen step and R's step
    read the same `clock.now()`, and the jump test would fire at R.
  - C's `lastClock` is relabelled one frame back. This is truthful: C is the frame before R.
- **A text-less pickup is not lumped.** Its F+150 is UNFROZEN for the tower, and T's main-slot step stands for it at
  T's anim phase (wave 51's stand-in). A lump would get the count right and test the beam at the wrong phase. Named,
  not modelled; its row is ON = OFF.

**Gap 1: `assertNoPickupInRockSpanNow(what, at)`, the interim**
- ON, it refuses by name when a pickup is under the player at a span position the model never asked:
  - a button's frame A, at the top of the `pendingButtonFalls` branch (the run's own box, plus the runtime pickups
    through `predictPickupCeremonyStart`);
  - the wand's landing snap (`at` = the snapped box, the wand itself skipped).
- The rope's and the button's snaps were refused already. The rope's span box is the pull tick's own detection box.

**What it does to:**
- **`spitForecastNow` and the hammer forecasts:** no line changed. No forecast steps a ceremony's phase A or a rock's
  span. After a texted ceremony in a tower room, ON (exact) they start from a KNOWN tower anim where OFF had an unknown
  one (a refusal). That is hammer's to read (hand-over).
- **Wave 50's turret slot** (`turretSlotContact`, `turretHitPlayerNow`): untouched. The lump steps no turret, and the
  refusal fires before any slot.
- **Waves 51–55's predicates and keys:**
  - `pickupFreezesFamilyNow`, `dialogueFreezeAheadNow` and `ceremonyHoldsThroughNow` are not asked by either new site.
  - `stepCeremonyReleaseFamiliesNow` gains one gated call; its R steps are unchanged.
  - The `ceremony` machinery a collect starts (`ceremony`, `stepCeremonyReleaseFrameNow`) is unchanged.
  - `frozenTickUngated`'s span steps, `freezeEdgeFrames`' rock release and the frame-A turret step
    (`stepRockSpanShootersNow(false)`) all run after the new refusal, which only throws.
  - No existing key's ON line moved. The composition rows are below.
- **STOP rule: triggered for gap 1's MODEL.** A pickup collected inside a rock's span starts a ceremony nested in the
  rock's freeze: the rock's camera timer and the pickup's `specialTimer`/dialogue run together, and the single flag is
  arbitrated by whichever writes last in the frame. The model holds one freeze at a time (`ceremony` *or* a collapsed
  span), so that state does not exist at the point it would be needed. Gap 2 needed nothing the model lacks.

## D2 — the key

`CONTACT_FIDELITY.freezeSpanUpdates`:
- It is **OFF** and appended LAST: **147 keys, 126 ON**, from a node import of `contactFidelity.js`. That import works
  here (the brief warned it fails).
- Its env is `SEEDLING_FREEZE_SPAN_UPDATES=0|1`.
- Its `SOLVER_ENV_NAMES` entry sits after `SEEDLING_FREEZE_RELEASE_TICK`. A node import of `solverEnvChannel.js` gives
  **238** names, sorted, no duplicates.

Its doc block, in brief:

> fidelity RELEASEPICKUP D2 (wave 56) — THE UPDATES INSIDE A FREEZE'S DEAD SPAN THAT THE MODEL DID NOT TAKE … (1) The
> tower. `BeamTower.update` returns at its first line under `Game.freezeObjects` … but `World.update` runs every
> entity's graphic outside that gate … ON the lump steps every tower 149 frames frozen … and claims the anim KNOWN only
> where every other frame of the ceremony steps the tower exactly once … A text-less pickup is not lumped … (2) The
> pickups. `Pickup.update`'s `collide("Player")` has NO freeze gate … a pickup under the player at R was under it from
> the span's first frame … and its ceremony then runs INSIDE the rock's span … the STOP … ON either one with a pickup
> under the player is REFUSED by name … avoidance as a named INTERIM … OFF: byte-identical.

**Key-order pins**, found by grep rather than a list:
- the 21 tail lists ending `'freezeReleaseTick']` now end `'freezeReleaseTick', 'freezeSpanUpdates']`;
- `contactFidelity.test.js`: the defaults row and the env guard;
- `fidelityFreezeReleaseTick.test.js`: its `.at(-1)` became a tail of `['freezeSpanUpdates']`.

`fidelityFencepost`'s SOURCE-SHAPE pin is untouched (nothing was added near `spinnersSteppedThisTick`), and its file is
green. The one-spelling law is green: no new import (`stepBeamTowerFrame` and `CEREMONY_DEAD_FRAMES` were imported
already).

### Rows (`fidelityFreezeSpanUpdates.test.js`, fast tier, 10 rows)

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| tower + texted pickup (L29 + `beamtower@112,40`, walk onto `feather@144,28`, `Game.time` 900), the three ON | refused at **t25** (R): "a `Game.time` that jumped" | no throw; at R `[0,'sit',0,0]` known; **beam billed t25**; next beams t37, 38, 39 |
| ON alone, or with any one of the three OFF | the jump refusal | the **same** refusal, byte for byte |
| composition: all seven ON (the three + `frozenTickUngated`, `dialogueFrameFreeze`, `turretSuitRetaliation`, `owlContactInStep`) | the jump refusal | the same hits, beams and R state as the three alone |
| T on the tower's first stepped tick (booted on the feather), `pickupTickFreeze` + `freezeEdgeFrames` | **no refusal, no hit**: anim `[1,'sit',0,0]` claimed known, 150 frames stale | without R's step: refused at t24 (unknown); with all three: beam billed t23, `[0,'right',1,2]` |
| text-less pickup (`bosskey` keyType 1) there, the three ON | — | **ON = OFF**, the whole result |
| frame A (L29, `feather@112,127`, walking onto the button) | rock t25 (172), the ceremony at t25 after the span | **refused by name** at frame A; the same under all seven |
| release-step reach (`feather@112,126`) | the ceremony at t25 (R+1), the game's frame | **ON = OFF**, the whole result; under all seven too |
| rope (`rockbutton-l28-livefall`) | fall t155, 181 dead | **ON = OFF**; under all seven too |
| no freeze (L29 + the tower, idle) | — | **ON = OFF**, the whole result; under all seven too |

**Mutants.** Each was applied to the source, run over 7 files and 79 rows, then restored. `grep -c MUTANT` gave 0 after
each, and `cmp` showed the file equal to the commit (`d2/mutant-*.txt`, `d2/mutants-predicted.txt`). The 7 files:
`fidelityFreezeSpanUpdates`, `fidelityFreezeReleaseTick`, `fidelityFreezeEdgeFrames`, `fidelityPickupFreeze`,
`fidelityFrozenTick`, `fidelityDialogueFreeze` and `fidelityBeamTower`.
1. **Continuity never claimed.** Predicted: the exact tower row and composition. Measured: **exactly those 2**.
2. **A lump of 0 frames, continuity claimed.** Predicted: the exact row and the boot row (a stale anim). Measured:
   **exactly those 2**. Composition stays green: both of its sides carry the mutant.
3. **No relabel before R.** Predicted: the exact row, composition and the boot row (R jumps). Measured: **exactly those
   3**.
4. **No frame-A refusal.** Predicted: the frame-A row. Measured: **exactly that 1**.
5. **The not-exact lump leaves `animKnown` alone.** Predicted: the boot row (ON without R stops refusing). Measured:
   **exactly that 1**.

⚠ **Not game-witnessed:** every ON row. The pieces are the AS3 lines above and the model's own `stepBeamTowerFrame`
(wave BEAMTOWER's, game-witnessed for live frames: `fidelityBeamTower.test.js`).

## D3 — the ON measurement

- **Byte-inertia OFF.** `git diff --name-only fae509e4 HEAD | grep -aE 'fixtures/|golden|tapes/'` is EMPTY
  (`d3/byte-inertia.txt`). `levelRun.js` and `contactFidelity.js` take 130 inserted lines and 0 deleted.
- **Acceptance.** `batch-seedling-acceptance.mjs | md5sum` gives the standing **`391322d681b7aa0229d94b3f6906d024`** at
  all four settings (`d3/acceptance-*.md5`):
  - the base;
  - the head OFF;
  - the head with this key ON;
  - the head with this key and all seven ON (`freezeReleaseTick`, `freezeEdgeFrames`, `frozenTickUngated`,
    `pickupTickFreeze`, `dialogueFrameFreeze`, `turretSuitRetaliation`, `owlContactInStep`).
- **Committed tapes.** All **294** replay byte-identical ON vs OFF (`d3/tapes-onoff.txt`, `tools/tape-onoff-probe.mjs`).
- **The census.**
  - **Method.** The room census (`d1/pickuprooms.json`) names every room where ON can do anything:
    - a rock room whose source asks a frame A or a snap: L29 and L74 (buttons), L43 (the wand's snap);
    - a tower room with a texted ceremony: L103 (the Watcher's Seed).

    Then the legs (`seedling-divergence-legs.mjs`, **922** at the head) were filtered by level (`d3/leg-census.txt`),
    as were the survey's steps (`d3/survey-steps.txt`).

| set | count |
|---|---|
| legs in a reached room (`d3/reached_legs.json`) | **69** (L29 7, L43 52, L74 6, L103 4). L28's 8 and L39's 3 are rope rooms: no new span position |
| of them, legs where ON can step or refuse something | **0** |
| survey steps in a reached room | **5**: 36 (L29), 167 and 174 (L43), 191 (L74), 232 (L103) |

  - **The ON answer per set:**
    - **L29, L74:** a pickup under the player at frame A needs it within a box of the button cell. L29's key is 64 px
      off and L74's shield 240 px, so the refusal cannot fire.
    - **L43:** no rock lands on the wand's stance, so there is no snap to ask.
    - **L103:** the four legs are exits. The Seed exists only after the Watcher is killed.
  - **Survey** (`--through=end --only=36,167,174,191,232`, OFF / `SEEDLING_FREEZE_SPAN_UPDATES=1` / ON with the three;
    `d3/survey-*.txt`): every step line is equal, and the rows JSON is equal once the `ms` fields are stripped (md5
    `3f51e071…` at all three).
    - 36 and 191 are SOLVED with 0 hits.
    - 167, 174 and 232 are REFUSED for the same pre-existing reasons: the wand stance's corridor, the sleeping totem,
      and L103's combat ladder at `beamtower@208,248`.
  - **Runtime confirmation** (`d3/census-probe.txt`): a temporary line at both ON sites, every call counted (copied in
    and restored). **0 hits** over the 294 tapes ON, the acceptance batch ON and the five survey steps in all three
    settings. It does fire on both staged rows, so the probe can fire.
- **Vitest ON** (the 55 gate files, `--maxWorkers=3`, `SEEDLING_FREEZE_SPAN_UPDATES=1`; `d3/vitest-on.txt`): 54/55
  files; 1357 passed, 2 failed, 2 skipped (the env-guarded "ships OFF" rows). **ON movers:** two of wave 55's
  clock-less staged tower rows, which move by construction (ON steps the tower's anim through phase A, so the first
  beam after the close moves):
  - `fidelityFreezeReleaseTick.test.js:115`, the tower row: beams `[25, 26]` become `[30, 31]`;
  - `fidelityFreezeReleaseTick.test.js:170`, the composition: `[[33,34],[32,33]]` becomes `[[24,25],[24,25]]`.
- **Train ON** (`vitest.train.config.js`, one file at a time, `SEEDLING_FREEZE_SPAN_UPDATES=1`; `d3/train-on.txt`): the
  13 `.train.` files that name L28, L29, L39, L43, L74 or L103, or stage a tower, a feather, a key, a shield, a rock or
  the Watcher (`d3/train-files.txt`).
  **13/13 files, 50 tests passed ON, 0 movers**: `hammerApproachOrder`, `hammerBaitRemoved`, `hammerBaitSubwalkGoal`,
  `hammerBodyGate`, `hammerChooserPair`, `hammerClearTagChain`, `hammerKeylockTurret`, `hammerL53Killlock`,
  `hammerL98L99`, `hammerOppDashDefers`, `hammerPitWest`, `hammerShovedLookahead`, `hammerWallFlyerDrillKill`.

### The named sweep (for the planner)

- **`freezeSpanUpdates`: 0 legs.** No shipped room puts a pickup at a frame-A or snap position, and none collects a
  texted pickup beside a tower on a seed-1 leg (the census above). The probe fired 0 times on every committed tape, the
  acceptance batch and the survey's reached steps.
- Shards = min(10, 0) = 0, so there is no sweep to run.
- The flip gate (a hitless leg stays hitless) is vacuous on shipped content.
- ⚠ If the planner wants belt and braces: L103's 4 legs (756–759) are the only legs in a room the lump can reach (were
  the Watcher killed). Shards = min(10, 4) = 4, ×1 per arm: OFF, and `SEEDLING_FREEZE_SPAN_UPDATES=1`.

## Gates

- **Bounded vitest BEFORE** (the untouched base, 54 gate files, the new test absent): **54/54 files, 1350 passed**
  (`d3/vitest-before.txt`, `d2/gate-files-before.txt`).
- **AFTER** (`54e959e9`, OFF; 55 files): **55/55, 1361 passed** (`d3/vitest-after.txt`, `d2/gate-files-after.txt`).
  - The first AFTER run (before the census `--write`) had one red, `seedlingConstantsCensus`'s line-shift mutant
    (`d3/vitest-after-1.txt`). It went green after the regen.
  - The set:
    - `contactFidelity*`, `playerDamage*`, `levelRun*`, `fidelityPickupFreeze*`, `fidelityDialogueFreeze*`,
      `fidelityFrozenTick*`, `fidelityFreezeEdge*`, `fidelityFreezeReleaseTick*`, `fidelityCeremony*`, `fidelityRock*`,
      `fidelityTurret*`, `seedlingSoundCues*`, `oneSpelling`;
    - every test file `grep -a -l` finds for `stepRockReleaseBodiesNow`, `stepCeremonyReleaseFamiliesNow`,
      `stepShootersThroughFreeze`, `dropRock`, `dropRocksTogether`, `pendingFreeSteps`, `beamTower`, `BeamTower`,
      `freezeReleaseTick`, `freezeEdgeFrames`, `frozenTickUngated`, `pickupTickFreeze` and `freezeSpanUpdates` (the
      key-order pins among them);
    - `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus` and
      `seedlingSolverSurface`.
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red, 1 skipped** (`plan-seedling-r7-ends-meet`, a browser arm in CI),
  on a still tree (`d3/producer-checks.txt`).
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions
  match.
- **Constants census:** `--check` PASSes after `--write` (8 new cosmetic/structural, 406 line moves; then 0 drift).
  `--profile-rows` left `seedling-constants-fields.csv` byte-identical, and a second `--write` then `--check` showed 0
  drift.
- **Solver surface:** `--check` GREEN (374 rows) after `--write` (line numbers only).
- **CI** `JavaScript Unit Tests` at the code head `54e959e9`: run 44971733471 **success**: suite 29443 passed, 0 skipped,
  0 failed (3 shards); slow battery 438/438. Later commits are evidence and docs only.
- **Owed by the planner (I cannot dispatch):**
  `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/seedling-fidelity-release-pickups-levv53 -f train_only=true`

## What the brief got wrong (measured)

1. **"A pickup under the player on R is collected ON R in the game."** It is collected on the span's FIRST frame.
   - `Pickup.update`'s collide has no freeze gate, and the player does not move through the span. So "under it at R"
     means "under it from P, A or the landing".
   - Its ceremony then nests inside the rock's freeze (`pick_up` re-raises the flag after the rock), which is not a
     one-frame-late collect. It is a different timeline.
   - A pickup reached only by R's release step is collected on R+1, and the model already does that (the
     `feather@112,126` row).
2. **"The model does not ask the pickups on the release frame … so it collects a frame late."** The model's existing
   asks already cover every span position but two (a button's frame A, the wand's snap). The rope's span position is
   its pull tick's own detection box.
3. **"Ask the pickups once on the release frame, after the rock … reusing the live tick's collect path"** (the proposed
   change). It would collect at R, but the game collects ~172 frames earlier, with phase A overlapping the span. Not
   built. The STOP and the interim refusal replace it.
4. **"A tower room with a special pickup refuses rather than models."** That holds only when the tower has a step
   before T. When T is its first stepped tick, OFF does not refuse: it silently claims an anim 150 frames stale (the
   boot row). ON closes that hole too.
5. **"Check it with a node import of `solverEnvChannel.js`, NOT `contactFidelity.js` (which fails with 'n is not
   iterable')."** The `contactFidelity.js` import works here at the base and the head (146 → 147 keys).
6. **The census's "special/texted, key, totem part, runtime drops":** coins (`Enemy`/`Chest` drops) and `APItem`s are
   the only plain pickups. Neither is in the model's pickup detection, so neither can be asked; named in the residue.

## Hand-overs

- **To the planner:**
  - the `train_only` dispatch at my head;
  - the sweep: 0 legs (optionally L103's 4);
  - at harvest, `SOLVER_ENV_NAMES`: my entry sits after `SEEDLING_FREEZE_RELEASE_TICK`;
  - wave 55's two clock-less tower rows (`fidelityFreezeReleaseTick.test.js:115,170`) move ON by design. A flip
    re-pins them.
  - ⚠ A flip of this key alone does not model gap 2. It claims the tower known only with `pickupTickFreeze`,
    `freezeEdgeFrames` and `freezeReleaseTick` ON; alone it marks the anim unknown, which is OFF's answer except in the
    boot-tick hole.
- **To fidelity (later), beyond this licence:**
  - **A ceremony nested in a rock's freeze** (gap 1's STOP). Model the rock's span and a pickup's phase A/dialogue
    together, with the flag arbitrated per writer in update order. Until then: refused ON at frame A and the wand's snap;
    unreachable on shipped content.
  - **A text-less pickup in a tower room:** its F+150 is the tower's unfrozen frame, and T's step stands in for it at
    T's phase. Re-ordering needs the T slot to know a text-less start is coming (`pickupFreezeAheadNow`).
  - **The runtime ceremonies' turret/bomb lumps:** the Seed, DarkSword and Fire branches call no
    `stepShootersThroughFreeze` / `stepBombsThroughFreeze` (only the placed branch does). No shipped room holds both.
  - **Coins and `APItem`s inside a rock's span:** collected there in the game (no freeze, plain); not in the model's
    pickup detection.
  - Carried, unchanged: a second pickup collected on a ceremony's R (wave 55); the ice turret and beam tower in a ROCK
    room (refused ON by wave 54); the crusher, bomb pusher and arrow traps in a rock room. Gap 2's change does not
    answer the rock-room tower refusal. That is a rock's release frame (an UNFROZEN tower update, beam and drift), not a
    frozen lump.
- **To hammer:** nothing moves on shipped content. ON (exact), after a texted ceremony in a tower room, the live tower
  anim is known where OFF refused, so a solver plan there may now proceed where it refused.

## Residue

- Every ON row is staged, not game-witnessed (no shipped room has either shape).
- The reached legs were not replayed in a browser (0 can move, by the census and the probe).
- Evidence: `seedling-fidelity-releasepickup-evidence/`:
  - `tools/`:
    - `pickuprooms.mjs` (the room census);
    - `tower-phasea.mjs` (the tower through a ceremony, with a `Game.time`, OFF/ON per setting);
    - `rockspan-pickup.mjs` (a pickup in a rock's span, OFF/ON);
    - `tape-onoff.mjs` (wave 55's), and `tape-onoff-probe.mjs` (all tapes OFF/ON plus the probe);
  - `d1/pickuprooms.json`;
  - `d2/`: the gate file lists and the five mutants, with their predictions;
  - `d3/`: the acceptance md5s, byte-inertia, the tapes OFF/ON, the census probe, the leg census and the 69 legs, the
    survey steps and the survey OFF/ON/exact, vitest BEFORE/AFTER/ON, the train files and train ON, the producer line.
