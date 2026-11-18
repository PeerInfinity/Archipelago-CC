# seedling-fidelity-pickupfreeze — a pickup's first frame freezes the families that update after it (wave 51)

⚖ GO: Robert 2026-11-17 (planning-21's session), *"Pickup turret freeze (Recommended)"*, plus the launch GO for this brief
(planning-22's session). Scope: ONE new `contactFidelity` key, default OFF. No flip, no default change.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-22` |
| Base | `60c8a0374584807477d3e79e8104e3ca5aacc223` (wave 50's head; 141 keys, 126 ON, measured) |
| Harness branch | `claude/pickup-freeze-tick-order-jr8r81` (local branch `seedling-fidelity-pickupfreeze`) |
| Commits | D1 evidence `db8b73a8` · D2 `f56afcae` + `b76ac737` · D3 evidence · this report (the head) |
| Verdict | **PASS** (key OFF; OFF byte-identical; ON moves no measured route answer: 0 ON movers in vitest, train, the survey and 293 tapes; the 57-leg sweep is the planner's) |

**The one thing to know first:** every pickup the game ships beside one of these families is **TEXT-LESS** (L29's green
key; L40's totem parts and purple key). For a text-less pickup the game's freeze is NOT the whole collecting tick: on the
last frame (F+150) `pick_up` lowers the flag BEFORE the turrets update, so they get one UNFROZEN update at the end. So
"step them frozen on T" alone would be wrong the other way. ON is a reorder: T frozen, 149 frozen, then the unfrozen
release frame. And it moves a spit: in the staged row the turret's spit leaves at t7 instead of t1, and its hit on an
idle player moves from t55 to t68.

## D1 — the AS3 order and the model's split

### The game

- **Update order.** `World.addUpdate` PREPENDS (`net/flashpunk/World.as:937-947`), and `World.update` runs each entity's
  `update()` then its graphic's (`:47-61`). So the update list is reverse add order.
- **Add order** (`Game.loadlevel`, `Game.as`): Player `:2251`; … `drill :2290`, `sandtrap/icetrap/lavatrap/darktrap
  :2291-2294`, **`turret :2295`, `iceturret :2296`, `beamtower :2297`**, `bombpusher :2299`, `crusher :2300`, …; the
  pickups **`apitem :2330` … `torchpickup :2339`**, `fire :2340`, `arrowtrap :2343`, `bosskey :2348`, `totempart
  :2349`, `health :2350`, `seed :2351`; then `pull :2352`, `pulser :2357`, `lightpole :2373`, `chest :2377`, the NPCs
  (`watcher :2394`, `sign :2400`, …), `wallflyer :2415`, `spinner :2416`. Runtime adds (spits, bombs, blasts, wand shots,
  a chest's `SealPiece`, a pickup's text NPC) prepend later still, so they update FIRST.
- **The freeze.** `Pickup.update` → `collide("Player")` → `pick_up()` (`Pickups/Pickup.as:78-83`), and
  `pick_up` sets `Game.freezeObjects = true` **only for a `special` pickup** (`:93-95`). Then `specialTimer` counts 150 → 0
  over that frame and the next 149 (`:96-98`). On the frame after it reaches 0 (F+150), a texted pickup's NPC (added at
  `:101`, updating first) keeps the flag up; a **text-less** one runs `else if (!myText) { Game.freezeObjects = false; …
  removeSelf(); }` (`:106-112`), so everything that updates after it is UNFROZEN on F+150.
- **The bot.** `Bot.update` gates at the TOP of the frame (`Bot.as:3201`: `if (blackCover > 0 || Game.freezeObjects)`
  → a dead frame) and records the observation before the world updates (`:3232-3234`). So F is a live tape tick,
  F+1..F+150 are dead, and the model's collecting tick T stands for **frames F..F+150**. `CEREMONY_DEAD_FRAMES.pickup`
  = 150 (`sealCeremony.js:169-173`, "as the game reported it"), and U15-swim measured it on the game for a text-less key
  in a turret room: `r9-solve-29` (L29's green key), *"190 dead = 150 pickup + 40"* (`seedling-swim-u15.md:93`).
- **A dialogue's first frame is not a freeze.** `NPC.talk` sets `Game.freezeObjects = true` only inside `if (talking)`
  (`NPCs/NPC.as:193-195`). On the frame `startTalking()` runs (`:225-226`, `:240-246`) `talking` was still false at that
  test, and `set talking(true)` writes `Game.talking` only (`:264-270`). So the families update unfrozen on the start
  frame; from the next frame `talk()` raises the flag before them.

### The family table (the families above the model's detection)

"Gate" = the class's own `update` returns on `Game.freezeObjects` (the graphic still steps). "Model OFF" = what the model
steps on T, at base line numbers.

| family | game add slot vs pickups | gate | game on F (texted / text-less) | game on F+150 | model OFF on T | differs? |
|---|---|---|---|---|---|---|
| **Turret** | before (`:2295`) | `Turret.as:48` (aim, `shootTimer`, fire gate; after `super.update` = `hitPlayer`, refused by `Player.hit`'s `!freezeObjects`) | frozen / frozen | frozen / **unfrozen** | `stepShootersNow` `:22551`, `frozen: ceremony !== null` = **unfrozen**, then 150 frozen (`stepShootersThroughFreeze` `:23128`) | **yes** (both kinds) |
| **IceTurret** | before (`:2296`) | `IceTurret.as:58` (aim, timer, fire; anim runs) | frozen / frozen | frozen / **unfrozen** | `stepIceTurretsNow` `:22545`, unfrozen; **no lump** | texted: yes. Text-less: T's one unfrozen step IS the release frame (the 150 anim-only frames are not stepped: pre-existing) |
| **BeamTower** | before (`:2297`) | `BeamTower.as:54,126` (drift, beam) | frozen / frozen | frozen / unfrozen | `stepBeamTowersNow` `:22544`, unfrozen; no lump | texted: yes. Text-less: as the ice turret |
| **Drill** | before (`:2290`) | `Drill.as:54` (the whole update) | frozen / frozen | frozen / unfrozen | `stepDrillsNow` `:22361`, unfrozen; no lump | texted: yes. Text-less: as the ice turret |
| BombPusher | before (`:2299`) | none (no `freezeObjects` in the class) | runs | runs | runs | no |
| Crusher | before (`:2300`) | none | runs | runs | runs | no |
| static bodies (F4: `hitUpdate`, "die", fade) | before | `Enemy.update`'s `hitUpdate`/`death` are ungated | run | run | run | no |
| spits, bombs, blasts, wand/boss shots | runtime (first) | Mobile move gated | update BEFORE the pickup: unfrozen on F | frozen (flag up from F) | unfrozen on T; lump frozen | no |
| spinners, wallflyers, shieldboss, pushables, LightPole, chest, pulser, pull, arrowtrap | after the pickups, or ungated | — | unfrozen | — | unfrozen | no |
| chasers (Bob, Flyer, Puncher, …) | before | `Mobile.mobileUpdate` | frozen | — | stepped BELOW the detection (`:23466`/`:23673`), `ceremony !== null` = frozen on T | no |

So four families differ, and the Turret is the only one with a lump in this model.

### The model's order (base line numbers)

`stepSpitsNow :22217` → `stepBombsNow :22219` → spinners → `stepWallFlyersNow` → **`stepDrillsNow :22361`** → shieldboss,
pushables, LightPole → activators, `pendingSnapY` (`:22389`, writes `state.y`) → the button-fall frozen return
(`:22420`) → chests, pulsers, pulls, arrow traps → `stepStaticBodiesNow :22495` → dark traps → `stepCrushersNow :22522` →
`stepBombPushersNow :22540` → **`stepBeamTowersNow :22544`** → **`stepIceTurretsNow :22545`** → **`stepShootersNow
:22551`** (wave 50's `turretHitPlayerNow` slot) → `frozenTimer` → credits/tree/walk → Lights, talkers (`:22784`),
watchers (`:22800`), final door, moonrock, Owl, BobBoss arena (each `return runFrozenTick(…)`) → the wand fade → **the
detections** (runtime seed `:23003`, DarkSword `:23031`, BobBoss Fire `:23062`, placed `pickupUnderfoot` `:23081`;
`spendCeremonyPhaseA :23097`; `stepShootersThroughFreeze(150) :23128`) → `if (ceremony !== null)`: texted →
`return runFrozenTick(…, 'a pickup ceremony') :23469`; text-less (`dialogue === null`, finishing on T) → falls through
to the live step → `stepContactsNow :23661` → `stepChasersNow :23673`. Wave 50's refusal sits at the top of
`runFrozenTick` (`:15972`).

### Is the detection tick the game's `pick_up` tick?

Yes: `pickupUnderfoot` tests the box the previous tick left (`levelRun.js:15886-15892`, measured on
`r3-collect-sword`), which is the observation `Bot.as` recorded at F's gate, the box `collide("Player")` reads on F. The
phase-A count is pinned three ways: the constant (150, `sealCeremony.js:169-173`), the clock's lump
(`spendCeremonyPhaseA`, `levelRun.js:3754`) and U15-swim's measured dead counter on `r9-solve-29` (above). The U15-swim
docblock on `stepShootersThroughFreeze` (`:14781-14793`) names the lump as frozen frames for the turrets and spits. (The
"R5 SLICE 22" comment at the main tick is `freezeStep()`'s, not phase A's.) **The reorder does not disturb the count:**
OFF and ON both step a turret 151 times for F..F+150 (T + 150). ON changes which of them are frozen.

### The reorder chosen

Detect the start BEFORE the families, as a pure predicate, and pass `frozen` (option 1 of the brief).
- `predictPickupCeremonyStart` asks the detection's own tests in the detection's order (runtime seed, DarkSword, Fire,
  `pickupUnderfoot`) and reads `textless` off `ceremonyFor(hit).text === ''`. It writes nothing.
- Each family's MAIN-TICK slot asks it (`pickupFreezeAheadNow(slot)`), only when the family is in the room. The answer is
  recorded per tick; a later slot that reads a different answer (the box moved between slots) is refused by name.
- `assertPickupFreezeAheadHeld`, just above `if (ceremony !== null)`, checks the prediction against `ceremonyStarts`
  (tag and text-less) and refuses a disagreement by name. `runFrozenTick` refuses a predicted start that another freeze
  pre-empted. So ON is exact or refused, never a guess.

What it does to:
- **Phase A's dead-frame count:** nothing (above).
- **Spits and bombs:** untouched. They update before the pickup (runtime prepends), so they are unfrozen on F in the game
  too; their lump stays frozen; on a text-less release frame the spits are stepped frozen (the flag is still up when they
  update), then the turrets unfrozen.
- **`spitForecastNow`:** unchanged; it clones the shooters' state, which ON now holds as the game does after a pickup.
  It never predicts a pickup's freeze (named, hand-over).
- **Wave 50's slot contact:** see D2 (composition).

**STOP rule: not triggered.** The predicate reads only state the model holds at the slot (the box, the pickup roster,
the runtime seeds, the Witch and BobBoss records), and OFF the slots never ask it.

## D2 — the key

`CONTACT_FIDELITY.pickupTickFreeze` is **OFF**, appended LAST (142 keys, 126 ON, measured). Its env is
`SEEDLING_PICKUP_TICK_FREEZE=0|1`, entered in `SOLVER_ENV_NAMES` after `SEEDLING_PICKUP_REMOVED_NEXT` (sorted,
duplicate-free: measured by a node import of `solverEnvChannel.js`, 220 names). Doc block (`contactFidelity.js`), in
brief:

> fidelity PICKUPFREEZE D2 (wave 51) — A PICKUP'S FIRST FRAME FREEZES THE FAMILIES THAT UPDATE AFTER IT. … The bot
> gates at frame START (`Bot.as:3201`), so the model's collecting tick T stands for frames F..F+150 … ON: the touch is
> predicted before the four step … The turrets step FROZEN on T; their lump is 150 frozen frames for a texted pickup, and
> 149 frozen plus one UNFROZEN release frame … for a text-less one. The ice turret, the beam tower and the drill have no
> lump in this model, so their T step is frozen for a texted pickup and is left as the release frame for a text-less one.
> … A dialogue's FIRST frame does not freeze … OFF: byte-identical.

**The change** (`levelRun.js`, plus the key):
- `stepShootersNow(onHitPlayer, { frozen = ceremony !== null } = {})`; the main slot passes `{frozen: true}` and no hook
  when a pickup is predicted.
- `stepShooterReleaseFrameNow()`: spits (frozen), then the turrets UNFROZEN, with wave 50's hook when that key and
  `STATIC_SWORD_ARM` are ON. `ceremony` stands for the flag in every reader (the fire gate, `turretHitPlayerNow`'s
  exit, `applyPlayerHit`'s `frozen`), so it is lowered for exactly the turrets' turn and restored.
- The placed-pickup lump: ON and text-less, `stepShootersThroughFreeze(149)` then the release frame; else 150 as before.
- `stepIceTurretsNow`, `stepBeamTowersNow` (the main slot's call), `stepDrillsNow({ mainTick: true })`:
  `frozen: ceremony !== null || frozenAhead`, where `frozenAhead` is a texted start. The drill asks only from the main
  tick (it is also the L28 fall-rock span's release frame, `fallRockFrozenFrame`).
- `turretHitPlayerNow`, `applyPlayerHit`, `stepTurret` and the detections are **unchanged**.

### How it composes with `turretSuitRetaliation` (wave 50)

| pickup on T | `turretSuitRetaliation` | `pickupTickFreeze` | a turret contact on T |
|---|---|---|---|
| texted | ON | OFF | billed in the slot, then **refused by name** in `runFrozenTick` (wave 50, unchanged) |
| texted | ON | ON | **nothing billed, nothing refused** (the game's `Player.hit` is refused on F..F+150 and on the dialogue frames): the refusal is retired for this case |
| text-less | ON | OFF | billed in the slot BEFORE the lump (wave 50 never refused it: a text-less ceremony finishes on T and does not reach `runFrozenTick`) |
| text-less | ON | ON | billed in the slot of the **release frame**, after the lump (the game's F+150); the turret's fire gate and the shot read it in that order |
| either | OFF | either | the static scan bills it after the player's step (OFF order, untouched) |

Wave 50's refusal code is untouched: with this key ON a pickup's T slot never records a slot contact, so it cannot fire
for a pickup; it still fires for the other freezes (Lights, Owl, final door, moonrock, BobBoss arena, a dialogue's later
frames), none of which shares a room with a turret.

### Key-order pins re-pinned (19 files)

- The 16 lists that ended `'turretSuitRetaliation']` gain `'pickupTickFreeze'`: `fidelityCeremony126` (its filter list),
  `CorridorBody`, `DarkSuitBosses`, `DarkSuitStatic`, `DrillWater`, `Fencepost`, `FireBreak`, `FireSpinner`, `FrozenPress`
  (`W39`), `L39Hit`, `L39Phantom`, `OwlSuit`, `RockButton`, `RockFire`, `RockGone`, `WallFlyerCorpse`.
- `fidelityTurretSuit`'s `.at(-1)` → a tail of `['pickupTickFreeze']`, and its label.
- `contactFidelity.test.js`: the defaults row and the env-guard line.
- `contactFidelityHook.test.js` gains its per-key row by itself.

### Rows (`fidelityPickupFreeze.test.js`, fast tier, 11 rows)

Every pickup is STAGED (`.oel` rows appended to a cloned atlas level): no shipped room holds a texted pickup beside one
of the four, and L29's own green key stands out of every turret's range.

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| turret, text-less (L29, `bosskey keyType 1` under the boot) | T's unfrozen step starts the shot: `turret@128,192` spawns `[1, 48]`; at t1 it reads `(40, "")`; the spit hits the idle player at **t55** | frozen T + 149, the release frame starts the shot: spawns `[7, 61]`; t1 `(40, "startshot")`; the hit at **t68** |
| turret, texted (a feather) | spawns `[1]` (inside the lump) | none while the dialogue is up; t1 `(0, "")` |
| ice turret, texted (L59, its turret swapped for `iceturret@144,72`) | a volley at t4 | none while the dialogue is up |
| ice turret, text-less | volley t4 | **ON = OFF**, the whole result |
| drill, texted (`drill@120,64`) | hops to (144,56) on T | sits at (128,72) |
| beam tower, texted | its slot's trace row on T `frozen: false` (then `runFrozenTick`'s second, frozen) | `[true, true]` |
| composition, texted + contact on T (`turretSuitRetaliation` ON) | wave 50's refusal, by name | no hit, no throw, no spawn |
| composition, text-less + contact on T | hit t1, spawn `[1]` | hit t1 (release slot), spawn `[7]`; and with wave 50's key OFF the scan bills t1 as before |
| dialogue start (L88 `introchar@56,104` beside `drill@128,160`) | the dialogue's frozen ticks start at index 3 | **ON = OFF** |
| no pickup (wave 50's held-`down` walk into the turret; a no-pickup ice turret room) | — | **ON = OFF**, the whole result |

**Mutants** (copy + restore; `grep -c MUTANT` → 0 after each; `d2/`):
1. **No release frame** (a text-less lump of 150 frozen). Predicted: 2 red, the turret text-less row and the
   text-less composition row. Measured: **exactly those 2** (`expected [8, 62] to deeply equal [7, 61]`;
   `expected [[2, 'enemy', …]] to deeply equal [[1, 'enemy', …]]`), 9 green.
2. **Lump-less families frozen for a text-less pickup too.** Predicted: 1 red, the ice turret text-less row. Measured:
   **exactly that** (10 green).

⚠ **Not game-witnessed:** every ON row. The pieces are: the dead-frame count on `r9-solve-29` (U15-swim), the turret
cadence (`turret.js`'s transcription), `Pickup.pick_up`'s two arms (source). No recording has a turret in range of a
pickup.

## D3 — the ON measurement

- **Byte-inertia OFF.** The fixtures/golden/tapes grep over the diff is empty. The four acceptance md5s are all the
  standing `391322d681b7aa0229d94b3f6906d024`: base, head OFF, head ON, and head ON + `turretSuitRetaliation`
  (`d3/acceptance-*.md5`).
- **The census** (`d3/leg-census.txt`, `d3/pickup_room_legs.json`):

| set | count |
|---|---|
| legs | 924 |
| legs in a room holding one of the four differing families | 150 (L28 8, L29 7, L40 50, L59 16, L62 25, L65 7, L88 9, L91 4, L98 6, L103-L108 18) |
| legs in a room holding a `special` pickup beside one (L29 turrets + bosskey; L40 ice turret + totem parts + bosskey) | **57** (ids 290-296, 359-396, 856-867) |
| legs that collect such a pickup | **8**: 292, 295 (L29 Boss Key 1); 379, 395 (L40 totem 160,640); 856, 858 (totem 64,144); 864, 865 (Boss Key 2). **All text-less** |

- **Survey** (`--through=end`, OFF vs `SEEDLING_PICKUP_TICK_FREEZE=1`; `d3/survey-{off,on}.*`). The steps that collect
  a pickup beside a differing family: 36 (L29) SOLVED 257 ticks, 0 hits, OFF = ON; 66, 96, 149 (L40) REFUSED, OFF and
  ON with the same reason (pre-existing: a spinner corridor, and two ladder-routed corridors).
- **Committed tapes.** All **293** replay byte-identical ON vs OFF (`d3/tapes-onoff.txt`), `r9-solve-29` and
  `r5-bosskey-leg` included.
- **Vitest ON** (the gate set, `--maxWorkers=3`, `SEEDLING_PICKUP_TICK_FREEZE=1`): 192/192 files, 5281 passed,
  2 skipped (the env-guarded "ships OFF" rows). **0 ON movers** (`d3/vitest-on.txt`).
- **Train ON.** The 13 `.train.` files of those rooms (`d3/train-files.txt`; the StagedHuntScanMemo and WallFlyerGaps
  files are left out as not of these rooms), `vitest.train.config.js`, `--maxWorkers=2`: 13/13 files, 44/44 tests,
  72 min. `strategySwitchApproach.slow.test.js` ON: 1/1. **0 ON movers** (`d3/train-on.txt`, `d3/slow-on.txt`).
- **Why ON moves nothing measured:** every shipped collecting leg is text-less. L40's pickups sit beside a lump-less
  ice turret, so ON is inert there by construction (text-less ⇒ only the lumped turret is reordered). L29's turrets
  are out of range at Boss Key 1, so the reordered shot hits nothing either way.

### The named sweep (for the planner)

- Keys: the **57** legs in `d3/pickup_room_legs.json` (ids 290-296, 359-396, 856-867).
- Shards = min(10, 57) = **10**, ×1 per arm, OFF and `SEEDLING_PICKUP_TICK_FREEZE=1`.
- Expectation: no mover. A possible mover is a named refusal (the prediction/ceremony cross-check), never a silent
  change. Measure for the flip test anyway: a leg that is hitless OFF must stay hitless ON.

## Gates

- **Bounded vitest BEFORE** (base worktree, submodules symlinked): 190/191 files, 5269 passed, 2 skipped. The 1 red
  (`seedlingWasmPlayback`, "registerBackend: duplicate id 'empty'") is the symlink artifact, not the base.
- **AFTER** (head, OFF): 191/192, the 1 red was `seedlingConstantsCensus` (the profile-rows order), fixed in `7e6edf46`
  and re-run 24/24 green. With that: 192/192.
- `lintGateLabels` and `oneSpelling`: green locally.
- `ci-producer-checks.mjs --jobs=3`: 99 run, 0 red, 1 skipped (`plan-seedling-r7-ends-meet`, a browser arm in CI).
- `check-procgen-docs.mjs`: ALL PASSED. `generate-procgen-reference.mjs --check`: all match. Census and
  solver-surface checks: green after `--write` (the surface moved line numbers only).
- **CI** `JavaScript Unit Tests` at the last head: see the chat line (read after the push).
- **Owed by the planner (I cannot dispatch):**
  `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/pickup-freeze-tick-order-jr8r81 -f train_only=true`

## What the brief got wrong (measured)

1. **"A talking NPC sets it in `talk()` (`NPCs/NPC.as:194`)", so a dialogue start freezes them.** Not on the start frame:
   the flag is raised only inside `if (talking)`, false on the frame `startTalking` runs. So the key does not touch a
   dialogue start (row: L88, ON = OFF). The dialogue's LATER frames do freeze them in the game, and the model steps the
   four unfrozen through every dialogue tick (`ceremony` is null): a separate gap, handed over.
2. **"The model steps them unfrozen that tick; the dead frames that follow are stepped frozen."** True, but "make that
   tick frozen" is not the fix for a text-less pickup, which is every pickup the game ships beside one of these
   families. Its last frame is unfrozen for them (`Pickup.as:106-112`). The exact ON order is T frozen, 149 frozen, one
   unfrozen release frame (mutant 1 pins it).
3. **"Is it only the Turret?"** No, but not the whole list either. `Mobile.mobileUpdate` gates every enemy's move, but the
   chasers are stepped BELOW the detection and are already frozen on T. The four that are stepped above it with a
   null ceremony are the drill, the beam tower, the ice turret and the turret. Spits, bombs and blasts update before the
   pickup and are correctly unfrozen on T, as the brief expected. Only `special` pickups freeze (`Pickup.as:93`): coins
   do not.
4. **"Wave 50 added a refusal for a turret contact answered in its slot on a tick that then freezes."** It covers texted
   pickups only. A text-less ceremony finishes on T and falls through to the live step, so it never reaches
   `runFrozenTick`; wave 50 ON billed that contact before the lump, where the game bills it on F+150.
5. **"The candidates: `stepIceTurretsNow`, `stepBeamTowersNow`, `stepBombPushersNow`/`stepBombsNow`, `stepSpitsNow`,
   chasers, `stepStaticBodiesNow`, activators."** BombPusher, Crusher, the static bodies and the activators carry no
   freeze gate; the drill was missing from the list and does differ.

## Hand-overs

- **To the planner:**
  - the keyed sweep (D3);
  - the `train_only` dispatch at my head (below);
  - train 141's `SOLVER_ENV_NAMES` merge (my entry sits after `SEEDLING_PICKUP_REMOVED_NEXT`);
  - the census `--write` moved one classified rule row (`terrainAt`, `hb402bd13` → `h53a7bb63`, the ice turret's
    `stepIceTurret` call): its fields row was retired and re-added at the END with the same classification.
- **To fidelity (later), each beyond this slice's licence:**
  - **The lump-less families' dead frames.** The ice turret, beam tower and drill are not stepped through a pickup's 150
    dead frames at all. Their entity update is frozen there, but their GRAPHIC runs (the ice turret's volley anim, the
    drill's anim, the tower's beam phase). Exact when the anim is idle; not otherwise. Every L40 text-less pickup sits
    beside `iceturret@472,400`.
  - **Dialogue frames.** After a dialogue's first frame the game freezes the four for every dialogue frame; the model
    steps them unfrozen (`ceremony` is null on a talker/watcher tick). Rooms: L88 (introchar + drill), L103 (watcher +
    beam towers).
  - **The beam tower is stepped twice on a frozen tick.** The main slot steps it, then `runFrozenTick` steps it again
    (`levelRun.js` BEAMTOWER D1). Measured in the beam-tower row: two trace rows at t1. Its `lastClock` check then
    marks the anim unknown. Rooms: L103-L108 (no pickup; L103's watcher dialogue reaches it).
  - **A chest's `SealPiece`** (L40, L98 beside an ice turret) is runtime-added, updates before the ice turret and
    freezes it for 331 frames; `stepSealPieceNow` resolves it as a lump above `stepIceTurretsNow` and steps the turret
    unfrozen on that tick and not at all through the lump.
  - **The runtime pickups** (seed, DarkSword, Fire) never call `stepShootersThroughFreeze`; none shares a room with a
    turret today.
  - **The other freezes** (a button-dropped fall rock's frozen tick returns above the beam tower, the ice turret and the turret, below the drill; the wand's approach fade
    spends 99 frozen frames with no family stepped). L29 and L28 hold a button and a fall rock beside a turret / drill.
- **To hammer:** `spitForecastNow` and anything that steps `turret.js` never predict a pickup's freeze: a plan that
  collects a pickup beside a turret previews the shot on the old timeline. With this key ON the live run moves the shot
  by up to the lump (row: spawn t1 → t7).

## Residue

- Every ON row is staged and model-derived, not game-witnessed.
- The 8 collecting legs (and the 57-leg sweep) were not replayed in node: the leg runner is the browser sweep.
- Evidence: `seedling-fidelity-pickupfreeze-evidence/`: `tools/rooms.mjs` (room census), `tools/probe.mjs` (the staging,
  OFF vs ON), `tools/tape-onoff.mjs` (committed tapes OFF vs ON); `d1/rooms.json`; `d2/` the mutants; `d3/` the acceptance md5s, the leg census and the 57 legs, the survey OFF/ON, the tapes OFF/ON, vitest BEFORE/AFTER/ON, train and slow ON, the gate file list and the producer line.
