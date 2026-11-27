# Seedling fidelity WANDSWINGDRILL (wave 70) — `itemPressHeldBySlash`, `drillSightLineGame`

Session `seedling-fidelity-wandswingdrill` (planner `seedling-fidelity-planning-26`, wave 70). ⚖ GO: Robert, 2026-11-27
(*"All of these in parallel, if possible."*, option "Draft W70: W68's two gaps"), and the launch GO.

| | |
|---|---|
| start (base) | `48824c3310442d26097108134d4c05e2a4363eaa`, wave 68's final tip (`claude/wandshot-enemy-bodies-vuzsvv`) |
| head | this report's commit (the last); the last CODE head is `fac6c1697b1c4fdbb49c2a8460e40c46d64ebe8e` |
| harness branch | `claude/seedling-fidelity-wave-70-cbs41u` (local `seedling-fidelity-wandswingdrill`) |
| verdict | **PASS**: two keys, default OFF, byte-identical OFF; 22 game witnesses (15 GAP, 7 NO GAP controls), ON is the game at every sampled tick for all 22; no committed tape or acceptance seed moves ON |

## The one thing to know first

**Both errors are real and both are narrow: neither touches any committed tape, the acceptance batch or a recorded
route.** The wand gate is broader than the brief said: `set firing` carries the same `!slashing` term, and the game drops
a fire press the same way. So the key is renamed **`itemPressHeldBySlash`** (wand + fire). The drill's sight line is a
**first-frame** fact, not a sampling or mask fact. A `Tile` is typed `"Tile"` until its own first `update()`, and the
drills update before the tiles, so on a world's first frame a drill's `collideLine("Solid", …)` sees no tile at all.
From the second frame the tiles are walls again: three walk-in witnesses show the game's drill never hops at a player who
arrives behind a tile later.

**For the hit gate:** `drillSightLineGame` ON can turn a hitless stance into a hit-taking one, and the game does the
same. In `drill-l88-se` the tick-1 hop puts the drill where a second hop lands on the player: 3 contacts on t 17/37/57,
on the game's ticks, against 0 OFF. No committed tape and no batch seed holds such a stance. The keyed sweep's L88/L91
legs are where the planner's gate has to look.

## Counts at the head

| | base (W68) | head |
|---|---|---|
| `CONTACT_FIDELITY` keys | 157 | **159** |
| ON by default | 126 | **126** |
| last keys | `wandShotEnemyBodies` | `wandShotEnemyBodies`, **`itemPressHeldBySlash`**, **`drillSightLineGame`** (both OFF) |
| `SOLVER_ENV_NAMES` | 254 | **256** (`SEEDLING_ITEM_PRESS_HELD_BY_SLASH`, `SEEDLING_DRILL_SIGHT_LINE_GAME`; sorted, unique) |

## D1: the rules, the witnesses, the census, the map

### Gap 1: the game (AS3, read)

- `Player.input()` calls `useItem(Main.primary)` / `useItem(Main.secondary)` on `Input.pressed(keys[4|5])`
  (`Player.as:1561-1568`): an **edge**. A press its setter refuses is lost, and there is no buffer.
- `useItem` (`:1575-1615`) has six cases. 0 and 4 (sword, ghost sword) go to `slashing = true`. 1 (fire) is
  `if (!firing) firing = true`. 2 (wand) is `if (!wanding) wanding = true`. 5 (FireWand) sets both. 3 (spear) is
  `if (!spearing) spearing = true`. **There is no bow, bomb or lantern item**: the brief's list does not exist in this
  game.
- The gates:
  - `set wanding` (`:832-849`): `(hasWand || hasFireWand) && !slashing && (!firing || hasFireWand) && !deathRaying && !spearing`.
  - `set firing` (`:856-873`): `!slashing && (!wanding || hasFireWand) && …`.
  - `set spearing` (`:815`): `… && !slashing`.
  - `set deathRaying` (`:882`): `… && !slashing`.
  - `set slashing` (`:782`): `!wanding && !firing && !deathRaying && !spearing` (the converse).
- How long `slashing` holds: `_slashing` rises in `set slashing` and falls in `slashEnd`, the sword sprite's
  complete-callback (`:41-45`, `:1046-1049`). `sprites()` fires that callback below `input()`, so the swing holds every
  press from its own press tick through its `slashEnd` tick.
  - The plain sword's "slash" is 5 frames at 30: **5 ticks** (`ghostSword.slashEndTicksFor`).
  - "slashnarrow" (the dash) also ends on its 5th tick.
  - The ghost sword's swings are 7 and 6 ticks.
  - Only the plain sword's "slash" is witnessed here.
- The model already had the gate for a **second** call of an X+C tick (`xcSecondCallAdmitted`), but admitted a lone
  call unconditionally (`pressCalls.length === 0 || …`). The spear has its own gate (`spearingWindow`, ON). The death
  ray has no writer. The FireWand (case 5) is refused upstream by `weaponForPress`.

### Gap 2: the game (AS3, read)

- `Drill.update` hops only on `sit && d <= 48 && !FP.world.collideLine("Solid", x, y, player.x, player.y)`
  (`Enemies/Drill.as:84`).
- `World.collideLine` (`net/flashpunk/World.as:411-...`) samples one pixel per major-axis step with the end point
  exclusive. This is the model's transcription (`levelRun.collideLineSolid`), and it is not the suspect.
- A `Tile`'s ctor writes `type = "Tile"` (`Scenery/Tile.as:110`). Its `update()` writes `type = types[t]` and then
  `active = false` (`:117-121`). Cliff (9), Stone (2) and the rest are `"Solid"` in `types`, but only from the tile's
  **first update**.
- `loadlevel` adds the tiles before the drills, and `World.addUpdate` prepends, so on a world's first frame every drill
  updates while no tile is `"Solid"`. Its line meets only the object solids: the pixelmasks (CliffSide, Building, …),
  the bridges and every object class, all of which type themselves in their ctors.
- The model already holds this fact for the player's own sweep (`levelWorld.collidesSolid`'s `beforeTypeFlip` →
  `objectSolids`), but `collideLineSolid` read `world.solidBoxesForMover`, which walks the full list.
- **The brief's suspects:** it is not the sampling step and not the cliff's mask. It is the tile's **type** on the
  first frame (the third suspect, read as "not yet flipped").

### The witnesses

All recorded on p4g with the delivered vanilla set `seedling-vanilla-record-23510f80`, a fresh page per shape.

`scripts/procgen/probe-seedling-wandswingdrill.mjs` (new; it reuses wave 68's sampler and join) recorded 22 files to
`frontend/modules/seedlingDemo/fixtures/wandswingdrill-witness/`. Each compares the player (0 px), every WandShot and the
six enemy classes' bodies (the drill's point and anim) at every sampled tick, OFF and ON. All 22 are **ON = the game**.

**Gap 1** (L10, boot (16,48). C is the sword (seam `secondary` 0) and X is the wand (equip slot 2) or fire (slot 1).
The sword is pressed at 4, so `slashEnd` is on 9.)

| witness | shape | the game | OFF (shipped) | verdict |
|---|---|---|---|---|
| `swing-wand-0` | X+C on 4 | the wand fires (shot from t 12); the sword is refused | the same (the second-call gate) | NO GAP |
| `swing-wand-1` … `-5` | the wand at 5, 6, 7, 8, 9 | **no shot** | a shot from t 13 … 17 (x 41, flying E) | **GAP** ×5 |
| `swing-wand-6` | the wand at 10 | fires (t 18) | the same | NO GAP (the edge) |
| `swing-wand-held` | X held 6 → 14 (one edge, inside the swing) | **no shot, ever** | a shot from t 14 | **GAP** |
| `swing-fire-2` | right held; fire at 6; the sword at 12 | the fire is dropped, so the sword at 12 **dashes**: x 40.9 on t 13 | the fire window gates the dash: x 38.9 | **GAP** |
| `swing-fire-6` | fire at 10 (after the swing); the sword at 14 | fires; the dash is gated | the same | NO GAP |
| `wand-swing-2` | the wand at 4; the sword at 6 (the converse) | the sword is refused (`!wanding`) | the same | NO GAP |
| `c1-wand-87`, `-88`, `-89` | C1's L62 sword kill (its press at 84) cut at 86, the Wand at 86, X at 87/88/89 (both wand keys ON) | **no shot** | a shot stopping at (236, 255) on 95/96/97 | **GAP** ×3 |

(Wave 68's `turret-die`, the wand at 90, is the fourth C1 edge: it fires in both.)

**Gap 2** (no input unless named; the drill's first update reads the boot point)

| witness | shape | the game | OFF | verdict |
|---|---|---|---|---|
| `drill-l88-e` | L88, the player at (176, 168), 40 px E of `drill@128,160` across `tile:Cliff` (160..176, 160..176) | hops to **(152, 168) on tick 1**, then sits there for the whole tape (its line from 152 crosses the Cliff) | never hops | **GAP** |
| `drill-l88-se` | L88, (174, 178) | hops to **(152, 184)** on 1; a second hop on t 16 to (168, 184) (that line is clear), onto the player: `p.hits` 1 on t 17, 2 on t 37 | never hops, no hit | **GAP** (hitless → hit, the game's) |
| `drill-l88-nw` | L88, (97, 141) | hops to **(120, 152)** on 1 | never hops | **GAP** |
| `drill-l91-e` | L91, `drill@64,80` beside three Bobs, the player at (117, 72) | hops to **(88, 72)** on 1 | never hops | **GAP** |
| `drill-l91-w` | L91, (29, 80) | hops to **(56, 88)** on 1 | never hops | **GAP** |
| `drill-l91-walkin` | L91, booted out of range at (78, 34), walking down: in range from t 6 behind the tiles | **never hops** | the same | NO GAP (first frame only) |
| `drill-l91-walkin-free`, `drill-l88-walkin-free` | the same shape with the hop cell free (from (86, 34) and L88's (120, 102)) | **never hops** | the same | NO GAP: a flip read on every tick would hop (at t 9 to (88, 88); at t 19 to (120, 152)) |

**Residue witness (report only, never recorded):** `wand-walk` (L10, right held, the wand at 4, no sword). The game's
shot **vanishes** at t 25 (x 89, then gone, with no "die" anim, 13 updates into its 16), while the model's flies on to
L10's Stone at x 96 and dies on 27. It is not a swing effect: the same happens with no sword pressed. The walking gap-1
tapes stop at t 24 for that reason. Not this slice's (`WandShot.update`'s other exits: `life`, the camera margin).
Named below.

### The census (a 0 is a result)

A temporary counting patch to `levelRun.js` (copied, measured, restored; `cmp` clean) logged every press made while
`slashState.slashing` holds, and every drill first-tick line whose full-list and object-only answers differ.

| corpus | presses inside a swing | of them wand / fire / spear | drill first-tick lines that differ |
|---|---|---|---|
| every committed tape (322: `fixtures/tapes/*.json` + `fixtures/**/*.tape.json`) | 620 (96 tapes), all sword/ghost sword (the dash/swallow arm, already modelled) | **0** | **0** |
| the acceptance batch (`batch-seedling-acceptance.mjs`) | 1305, all sword | **0** | **0** |

Geometry census of the four drill rooms: these are player entity points within 48 px whose full line is blocked by a
tile but whose object-only line is clear, with the 4×5 box free. **L88: 104** points. **L91: 836**. **L28 (both drills):
0** (there the shipped line was already right). L28's drills meet only the CliffSide masks, which wave 41's
`drillMixedRooms` / `pixelMaskSightLines` already read.

### The map

| site | OFF | ON |
|---|---|---|
| `levelRun` `pressCalls` (the press block above the step): a lone call's `admitted` | `true` | `!itemPressHeldBySlashNow(weapon)`: false for a wand/fire call while `slashState.slashing` |
| `xcFlagsRaisedBy`, `xcSecondAdmitted` / `xcSecondCallAdmitted` (the X+C second call) | gate on `slashing` already | unchanged (a dropped first call raises no flag) |
| the post-step press loop (`for … of pressCalls`, `if (!admitted) continue`) | opens the wand/fire window, calls `assertWandShotSolidsBound` | a dropped call does neither |
| `dashImpulse` (`pressCalls.find(… 'dash')`) | sword calls only | unchanged |
| `solverBot` wand verb (`~:2540-2575`: settle, lean, settle, press), `previewWandShot` (`:2403`), `slashInfo`'s gate (`:7390-7413`, the sword preview) | read-only | read-only: the wand verb settles before it presses, so no planned press inside a swing exists by construction there |
| `levelRun.collideLineSolid` → `world.solidBoxesForMover` | the full `solids` | `{beforeTypeFlip}` → `{objectOnly: true}` → `objectSolids`, **only** from `stepDrillsNow`'s `lineBlocked` on `firstTickInWorld` |
| `levelRun.collideLineSolid`'s other callers (the sword LOS gates `:8332-8550`, `:18644`, `:19168`, `:19337`, `:19500`, `:19997`; the shield boss `:12109`, `:12503`; the spinner lines `:12297-12301`; the corridor forecast's drill line `:14145` and its LOS `:14199`; the run's exported `collideLineSolid` `:22899`) | full list | **unchanged** (named residue; see below) |
| `crusher.collideLineSolid` users (`bobBossFight`, `crusher`, `dangerMap`, `lightsVerb`, `seedlingRoomBodySkin`, `spinner`), `corridorLineHits` / `collideLineBoxes` | own lists | unchanged |
| `solverBot`'s drill lines (`:25404`, `:25498`, `:25997`, `:26050`, via `run.collideLineSolid`) | full list | unchanged (read-only: hand-over) |

## D2: the keys

Both are OFF, appended last in this order, each with a doc block in `contactFidelity.js` (the witnesses and the cites
above), its env lines (`SEEDLING_ITEM_PRESS_HELD_BY_SLASH=0|1`, `SEEDLING_DRILL_SIGHT_LINE_GAME=0|1`) and its
`SOLVER_ENV_NAMES` entry.

- **`itemPressHeldBySlash`** (renamed from the brief's `wandPressHeldBySlash`: the fire arm shares the gate and is
  witnessed, `swing-fire-2`). `levelRun.itemPressHeldBySlashNow(weapon)` reads `CONTACT_FIDELITY.itemPressHeldBySlash
  && (wand || fire) && slashState.slashing`. It is consulted only for a lone (first) call.
  - It is dropped, not buffered: the game reads an edge (`swing-wand-held`).
  - **OFF**: `false`, so `admitted` is `true` as shipped.
- **`drillSightLineGame`**: `stepDrillsNow`'s `lineBlocked` passes `beforeTypeFlip: drillSightLineGame &&
  firstTickInWorld` to `collideLineSolid`, which hands `world.solidBoxesForMover(…, null, {objectOnly: true})` the
  object list. `solidBoxesForMover`'s new third argument defaults to the full list and no other caller passes it. The
  call site count is unchanged (one `liveSolidOpts()` call: `R8_NORMALIZE_LIVE_BATCH` holds the census). **OFF**: the
  argument is `undefined`, so the walk is the same list.
- **How they compose:** the two touch disjoint state (the press admission and the drill's first-tick line). Each is
  byte-inert on the other's witnesses (a row). Both compose with both wand keys (the C1 rows run with them ON) and with
  the base's OFF tail.

### Rows: `fidelityWandSwingDrill.test.js` (fast; 62 rows) and `.slow.test.js` (4)

- The keys: OFF, last in order, env names in the table (sorted, unique), and both env arms in the source.
- The recordings: every non-residue probe witness is recorded on p4g and the delivered set, with the probe's own tape.
- Per witness (22 × 2):
  - ON (its gap's key) = the game at every sampled tick.
  - OFF disagrees with the game iff it is a GAP (15) and agrees otherwise (7).
- Gap 1's numbers:
  - the edge is the swing's `slashEndTicksFor` (5): k = 1..5 have no shot, and k = 0 and k = 6 fire at the derived tick;
  - the held key fires nothing;
  - the dropped fire lets the sword dash (+2 px on t 13; OFF is the control's x);
  - C1 87/88/89 fire nothing in the game, while OFF fires at (236, 255);
  - the converse is NO GAP.
- Gap 2's numbers and the rule:
  - each drill's tick-1 hop cell;
  - L88 E never moves again and sits;
  - the walk-in is never hopped at;
  - L88's object-only list holds no tile solid, while the full list holds `tile:Cliff`@160,160, and `{objectOnly:
    false}` equals the default;
  - ON reads the flip on tick 1 only.
- Composition:
  - all 22 with both keys and both wand keys ON;
  - all 22 with both keys beside the base's OFF tail (the last nine OFF keys);
  - each key is inert on the other gap's witnesses.
- `fidelityWandSwingDrill.slow.test.js`: every committed tape OFF vs ON, in four arms. Census pins: the slow file (0
  movers), plus the two 0s above (measured; the counting patch is not committed).

Key-order pins: 31 test files took the two keys at the end of their lists. The two `slice(-N)` rows went to N+2
(`fidelityFreezeSpanUpdates` −11 → −13, `fidelityNestedRockCeremony` −10 → −12). `contactFidelity.test.js`'s
full-defaults object took both. `fidelityWandEnemyBodies.test.js`'s "is the last key" row is now "followed only by
wave 70's keys".

### Mutants (predicted, broken in a copy, restored with `cmp`)

| mutant | predicted | shown (the failing rows) |
|---|---|---|
| M1: the gate is the wand's alone (fire not held) | `swing-fire-2` ON + the two composition rows | exactly those 3 |
| M2: the release tick is free (`… && ticksCompleted < slashEndsAt`) | `swing-wand-5` ON, `c1-wand-89` ON + the two composition rows | exactly those 4 |
| M3: the flip read on every tick (not `firstTickInWorld`) | the walk-in-free witnesses + composition | first run: **survived** (the first walk-in's hop cell is blocked), which is why the two `-walkin-free` witnesses were added; then exactly `drill-l91-walkin-free`, `drill-l88-walkin-free` ON + the two composition rows |
| M4: `solidBoxesForMover` ignores `objectOnly` | the five hop witnesses, the list row, the first-tick row, composition | those 5 + the object-only-list row + the first-tick row + the walk-in row (its list-length check) + the two composition rows (10) |

## D3: the ON measurement

- **Byte-inertia OFF.** `git diff --name-only --diff-filter=MD 48824c33 HEAD | grep -aE 'fixtures/|golden|tapes/'` is
  **empty**. The only added fixtures are the 22 `fixtures/wandswingdrill-witness/*.json`.
- **Acceptance batch** (`batch-seedling-acceptance.mjs 2>/dev/null | md5sum`), all **`391322d681b7aa0229d94b3f6906d024`**
  (the standing value):
  - the base (a worktree at `48824c33`);
  - the head OFF;
  - `SEEDLING_ITEM_PRESS_HELD_BY_SLASH=1`;
  - `SEEDLING_DRILL_SIGHT_LINE_GAME=1`;
  - both + `wandShotTrapBodies` + `wandShotEnemyBodies`.

  No seed or field moved.
- **Every committed tape, OFF vs ON** (`fidelityWandSwingDrill.slow.test.js`): 322 tapes, **0 movers** with
  `itemPressHeldBySlash` alone, **0** with `drillSightLineGame` alone, **0** with both, and **0** with both beside both
  wand keys.
- **The hit gate:** no committed tape (322) and no acceptance seed moves ON, so **no tape or route goes hitless →
  hit**. On the witnesses, one shape does, and it is the game's:
  - **`drill-l88-se`**: the game's `p.hits` (read per frame with the probe's `--dump`) goes 0 → **1 on t 17, 2 on
    t 37**, and back to 0 on t 57 (the third contact, at `hitsMax` 3). The cause is the drill's tick-1 hop to
    (152, 184) and then its t-16 hop onto the player at (168, 184).
  - The model takes **3 hits ON and 0 OFF**, with the player at 0 px against the game at every sampled tick ON.

  So `drillSightLineGame` ON **does** turn a hitless stance into a hit-taking one, exactly as the game does. A route
  that boots or enters L88/L91 next to a drill across a tile would take it. The planner's gate should read the keyed
  sweep's L88/L91 legs for exactly this.

  Every other witness takes no hit in the game (`p.hits` 0 throughout; `drill-l91-e`'s final status `hits 1` is read
  after the tape ends, not inside it) and none in either model arm. `itemPressHeldBySlash` can only remove a shot or a
  fire window, never add a contact.
- **ON movers** (both env keys ON over every test file naming `wand`, `slash`, `swing`, `pressCalls`, `useItem`,
  `drill` or `collideLine`, case-insensitive): **333 fast files** (9027 rows), 21 red ON, **none a model mover**:
  - `contactFidelity.test.js` › *"the shipped defaults: all three ON"*: **OFF-contract** (it pins the live process's
    `CONTACT_FIDELITY` to the defaults; any env key reds it). Green OFF.
  - `dashShape.test.js` › *"the defaults add no field (today's request key list exactly)"*: **OFF-contract** (an
    off-default key stamps the request; any env key does). Green OFF.
  - `fidelityWandSwingDrill.test.js`: the 15 GAP witnesses' *"OFF disagrees with the game"* rows and the two OFF-number
    rows (the fire dash, C1). **OFF-contract** (the env forces the key into the "OFF" replay). Green OFF.
  - `r8Acceptance.test.js` › *"accounts for every live-geometry bag builder call site on disk"*: **not a model mover**.
    It was red OFF too (my first cut had two `liveSolidOpts()` call sites); **fixed** (`ccbcb924`, one site), green.
  - `boxLock.test.js` › *"takes conditionally exactly where a headless arm would have been queued"*: **not this slice's
    model**. The new probe takes the box inside `main()` and had to be declared in the import-door list. It was red OFF
    too; **fixed** (`ccbcb924`), green.
  - The **20 slow/train files** that name the words, one at a time, ON (`vitest.slow.config.js` /
    `vitest.train.config.js`): all **green** — `actionNodesTownScale.slow` 11, `braidRegime2.slow` 47, `deriveLevelWorldLogic.latchSandwich.slow` 3, `deriveLevelWorldLogic.slow` 2, `fidelityCorpseBump2.train` 3, `fidelityL40Latch.train` 5, `fidelityWandEnemyBodies.slow` 4, `fidelityWandSwingDrill.slow` 4 (trivial ON: both arms carry the env), `fidelityWandTrapBodies.slow` 3, `hammerBodyGate.train` 4, `hammerEscapeExact.train` 2, `hammerGhostKillRung.train` 7, `hammerLatchWeigh.train` 2, `hammerOppDashDefers.train` 2, `hammerOppFallbackHits.train` 3, `hammerOppPressFallback.train` 4, `hammerSouthDoor.train` 4, `hammerTurretApproach.train` 3, `hammerWallFlyerDrillKill.train` 5, `strategySwitchEscape.slow` 2.
- **The named sweep** (the keyed ON-arm, shards = min(10, legs)):
  - `itemPressHeldBySlash`: every leg whose route presses the wand or fire while a swing is up. Not countable here: the
    survey cache is not in the container. The census says the committed corpus and the acceptance batch hold none.
    The solver's wand verb settles before it presses. So the expected leg count is 0, and the sweep should filter on
    legs whose plan presses X/C within 5 ticks of a sword press (7 for the ghost sword).
  - `drillSightLineGame`: the survey legs that ENTER (or boot in) **L88, L91 or L28**, the four drill rooms. Only
    L88 and L91 can move (L28's census is 0). Legs not countable here, for the same reason.

## What the brief got wrong (measured)

- *"`wandPressHeldBySlash`"*: the rule is broader. `set firing` carries the same `!slashing`, and the game drops a fire
  press inside a swing (`swing-fire-2`). Renamed `itemPressHeldBySlash`, covering wand + fire. The spear's own gate was
  already modelled (`spearingWindow`); the death ray has no writer; the FireWand is refused upstream.
- *"other item uses (bow, bomb, the other wand types, the lantern)"*: Seedling's `useItem` has no bow, bomb or
  lantern. Its six cases are sword, fire, wand, spear, ghost sword and FireWand.
- *"The suspects are the line's sampling step or the cliff's mask, or the tile being a different type in the game's
  grid"*: it is none of the first two. The tile **is** a Cliff, `"Solid"` in `types`, but not until its own first
  `update()`. The drill's tick-1 line runs before that update. The model already had the fact (`beforeTypeFlip`) for the
  player's sweep and not for the line.
- *"the game's drill hops at the player on tick 1 … the model's never does"*: yes, and **only** on tick 1. A player
  arriving behind the same kind of tile later is never hopped at (`drill-l91-walkin*`, `drill-l88-walkin-free`).

## Hand-overs

- **Hammer (`seedling-hammer-phase-planning-16`)**:
  - With `itemPressHeldBySlash` ON, a solver plan that presses the wand or fire inside a swing fires nothing. No
    committed plan or batch seed does that (census 0). The wand verb (`solverBot ~:2540-2575`) settles first, so it
    cannot arise there. A plan that interleaves X/C with a sword press would need its own check.
  - With `drillSightLineGame` ON, the solver's drill lines (`solverBot:25404`, `:25498`, `:25997`, `:26050`, via
    `run.collideLineSolid`) still read the full list on a visit's first tick. A route that boots or enters L88/L91
    within 48 px of a drill across a tile would see the run's drill hop where the solver's view did not. Rows:
    `drill-l88-e`, `-se`, `-nw`, `drill-l91-e`, `-w`.
- **The press-verb owner**: a lone press's OTHER setter terms are still admitted: a wand press inside a fire window or
  the spear's animation, and a fire press inside a wand window. Unwitnessed; not this key.

## Residue (named, not modelled)

- Every other `collideLine("Solid", …)` reader on a world's first frame: the sword's line-of-sight gates, the
  shield boss's line, the spinner lines, the run's exported `collideLineSolid` (the solver's), and the corridor
  forecast's drill line (`levelRun:14145`, a forecast, not the run's step). The same Tile fact applies to each of them;
  this key models it for the drill only (brief).
- The FireWand (`useItem` case 5, refused upstream); the ghost sword's swing (7 / 6 ticks) is derived, not witnessed.
- `wand-walk`: a shot fired while walking in L10 vanishes on the game at t 25 (x 89, no "die"), where the model flies
  on to the Stone at 96. It is independent of the sword. Not diagnosed (`WandShot.update`'s exits).

## Gates

Last CODE head: `fac6c1697b1c4fdbb49c2a8460e40c46d64ebe8e` (it touches `frontend/modules/seedlingDemo/` and `scripts/procgen/`, filtered paths).

| gate | base `48824c33` | head |
|---|---|---|
| bounded vitest (`--maxWorkers=3`), 69 files: `contactFidelity*`, `levelRun*`, `levelWorld*`, `oneSpelling`, `fidelityDrill*`, `fidelityWand*`, `wand*`, `drill*`, `ghostSword*`, every file naming `collideLineSolid` / `solidBoxesForMover` / `stepDrillsNow` / `xcSecondCallAdmitted` / `pressCalls` / either key / `wandShotEnemyBodies` (the key-order pins), `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus`, `seedlingSolverSurface`, `boxLock` | 67 files (the new test absent), 1861 passed, 3 skipped (rows that skip without the wasm submodule, which the base worktree lacks) | **69 files, 1954 passed**. The first head run had 33 red key-order pins (expected; re-pinned), then `r8Acceptance` and `boxLock` red OFF (fixed in `ccbcb924`) |
| `fidelityWandSwingDrill.slow.test.js` | — | 4/4 |
| `ci-producer-checks.mjs --jobs=3` | — | 99 run, **0 red**, 1 skipped, 0 known-red. A first run said TREE-MOVED, on this report's own untracked file written mid-run; re-run on a still tree |
| `check-procgen-docs.mjs` | — | ALL CHECKS PASSED |
| `generate-procgen-reference.mjs --check` | — | red on the new probe (instruments, 564 → 565), so regenerated: **ALL 7 MODULES AND 5 REGIONS MATCH** |
| `census-seedling-constants.mjs --check` (PASS with green drift: 1 new + 1 vanished, 878 moved; then `--write`, `--profile-rows` (byte-identical csv), `--write`) | — | PASS (0 new, 0 moved) |
| `census-seedling-solver-surface.mjs --check` (after `--write`: line moves only) | — | GREEN, 374 rows |
| `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check` | — | all six green |

CI: `JavaScript Unit Tests` at the last code head: run `45932498270` at `fac6c169`: the three Vitest shards and the slow Vitest all **success**. Suite: vitest (unfiltered) **30548 passed, 0 skipped, 0 failed**; slow battery 473 passed. **For the planner:** `unittests_frontend.yml -f
train_only=true` at the head (I cannot dispatch: 403).
