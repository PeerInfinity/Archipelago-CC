# The Seedling Real-Game Bot, and the tracked record of the procgen arcs on `watch.html`

How we drive the **real recompiled Seedling** with a scripted input tape and
check a JavaScript model of its physics against what the game actually did —
movement, collision, room transitions and A\* pathing. This file is also the
tracked record of the procgen arcs built on `watch.html`, § *The procgen
ELEMENTS design* being the current one.

This is the region-atlas Phase 8 "real-game surface". The maze-surface bot
([maze.md](./maze.md)) proves generated worlds beatable on the *projected*
map; this proves things about the **original game**, which is the only
oracle that can say "beatable in the actual game". Plan:
`CC/docs/plans/region-atlas-plan.md` §Phase 8. Briefs and the full recon
trail: `CC/docs/plans/seedling-bot-v1-opus-kickoff.md`,
`seedling-bot-v2-opus-kickoff.md` (whose §7–§14 are the as-built record —
its §1–§6 are the original brief and are wrong in several places those
sections correct), `seedling-bot-r0-opus-kickoff.md` (§8 onward likewise)
and `seedling-bot-r1-opus-kickoff.md` (§8 the recon, §9 the scope ruling,
§10 the watch page, §11 the walk).

**⚠ THE LADDER ABOVE v2 IS SUBTRACTIVE, NOT ADDITIVE.** The old v3 → v4 → v5
sequence (item-gated terrain, then puzzles, then enemies) had a beatable game
appearing only at the very end. The ruled plan
(`CC/docs/plans/seedling-bot-subtractive-plan.md`, 2026-07-31) inverts it:
disable collision, damage and hazards so the whole map is walkable, walk the
WHOLE game reaching every item, then re-arm ONE obstacle type per rung until
the real game is beatable. Every rung is a full playthrough; progress is
measured in "what still blocks us", not in features built. v2's collision,
A\*, transitions and exact-differential harness are exactly what rungs R2+
re-enable — the ordering changed, the machinery did not.

**Scope as of R1:** everything v2 had, plus R0's three tape-declared
relaxations (`noDamage`, `noHazards`, `grants`), a `buildLevelWorld` that
relaxes BY ROLE, the full 137-tag proximity census and the item/win READOUT
in `botStatus` — plus R1's **pit transport as a modelled primitive**, ten
priced avoid volumes, and the committed 79-leg route the full walk is
planned from. Each rung lands in JavaScript first and then in the Seedling
source; the JS side is the iteration surface and is *never* a load-bearing
stratum for a beatability claim.

As of 2026-07-31 all **twenty-three** fixtures match **exactly** — 31,476
ticks, bit for bit, float noise included. Seven of them are the R1 walk:
six segments and the headline, and the headline is the six segments tick for
tick.

## The shape: two implementations, one tape, compared

```
        tape (JSON: tick-indexed hold spans)
         │                              │
         ▼                              ▼
  seedlingDemo (JS)              Bot.as (compiled into the game)
  playerPhysicsV1/V2             dispatches KeyboardEvents at FP.stage
         │                              │
         ▼                              ▼
   observation stream  ==EXACT==  observation stream   ← the differential
```

Both sides consume the *same* tape and emit the *same* observation-stream
shape, so the comparison is about physics rather than bookkeeping. The
game's streams are recorded and **committed** as fixtures, because the wasm
artifact is machine-local forever (there is no CI build in either repo) —
that way vitest checks JS-against-the-real-game on every CI run, and the
local verify script only has to answer "are the recordings still current?".

## Where things live

| Piece | Path |
|---|---|
| Tape format, key table, transitions contract, stream differ, the hazard/item vocabularies | `frontend/modules/seedlingDemo/tapeFormat.js` |
| Physics transcription (v1: movement, friction, clamp) | `frontend/modules/seedlingDemo/playerPhysicsV1.js` |
| Physics transcription (v2: collision, terrain, transitions) | `frontend/modules/seedlingDemo/playerPhysicsV2.js` |
| The level as `loadlevel` builds it, and the 137-tag ROLE table | `frontend/modules/seedlingDemo/levelWorld.js` |
| Level-record injection (node + browser halves) | `frontend/modules/seedlingDemo/levelSource.js` |
| One world-swapping run, shared by runner and driver; the inventory mirror | `frontend/modules/seedlingDemo/levelRun.js` |
| Tape replay → observation stream | `frontend/modules/seedlingDemo/tapeRunner.js` |
| Targets → tape synthesis (straight line / A\*) | `botDriverV1.js`, `botDriverV2.js` |
| The R1 walk: rooms, order, segments, tape specs | `frontend/modules/seedlingDemo/r1Walk.js` |
| R1's terminal claim + segment chain, as pure functions | `frontend/modules/seedlingDemo/r1Acceptance.js` |
| The committed R1 route (79 legs) | `frontend/modules/seedlingDemo/fixtures/r1-route.json` |
| Route authoring (the `(level, component)` search) | `scripts/procgen/plan-seedling-r1-route.mjs` |
| R1 tapes, re-synthesized from the route | `frontend/modules/seedlingDemo/fixtures/regenerate-r1-tapes.mjs` |
| Tapes + oracle recordings | `frontend/modules/seedlingDemo/fixtures/` |
| The differential harness | `scripts/procgen/verify-seedling-bot-differential.mjs` |
| Real-GPU browser driver | `scripts/procgen/seedling-bot-replay-win.py` |
| The in-game bot (tape interpreter, flags, grants, readout) | `~/CC/seedling` branch `bot`, `src/Bot.as` |
| The five one-line flag guards | `~/CC/seedling` branch `bot`, `src/Player.as` |
| Build script + pipeline recipe | `~/CC/seedling_bot_build/build_bot.sh` |

The module is engine-only — no panel, no substrate registration, therefore
no `__BUNDLED_MODULES__` entry. `runnerDemo` is the structural precedent.
Geometry comes from the committed Phase-2 extract
(`flashPanel/atlases/seedling-map.json`) plus the verbatim AS3 tables in
`flashPanel/seedlingSemantics.js`. **Reuse stops at those tables**: the
analyzer's `CELL_KINDS` / `buildSeedlingRegionGrid` layer is the
region-verifier's altitude and coupling physics to it would import its
assumptions (4-connectivity, tile-granular cliffsides, pits-as-sinks). A
bonus of consuming the extract: the oracle differential now live-tests the
same tables the Phase-5a analyzer trusts.

## The tape

Tick-indexed **hold spans**, `from` inclusive / `to` exclusive:

```json
{ "tape_version": 1, "game": "seedling",
  "boot": { "level": 0, "x": 80, "y": 128 }, "noclip": false,
  "tick_count": 40,
  "inputs": [ { "key": "right", "from": 0, "to": 30 } ] }
```

Spans rather than per-tick key states because Seedling reads input three
ways and the tape must express all of them: movement is `Input.check`
(held), item use is `Input.pressed` (down edge), and **dialogue/NPC/seal is
`Input.released`** — a full down-then-up. A length-1 span yields a press
edge on tick `from` and a release edge on tick `to`, so it covers all three.

Key names map to raw AS3 keycodes through one canonical table asserted by
both consumers (`Player.as:59`). `M`, `R`, `Esc` and `W` are not in the
vocabulary at all and are rejected by name: `Game.update` reads the first
three *before* entities and some branches call `Input.clear()` or rebuild
the world, and `W` opens an external URL.

Validation is loud everywhere — `noclip` has no default, unknown keys
throw, and overlapping spans on one key are rejected (FlashPunk's
`_key[code]` guard makes a second KEY_DOWN a no-op and the first KEY_UP
clears the hold, so overlapping holds do not compose the way an author
would assume).

**⚠ `boot` was a CLAIM about the build until R0, and for a v1 tape it still
is.** The spawn used to be baked into the SWF at `Main.as:51`
(`new Game(0, 80, 128)`) while `Bot.as` parsed `boot.level` into a field it
never read and ignored `boot.x`/`boot.y` entirely — so a tape declaring
anything else was silently honoured by the JS side and silently ignored by
the game, and the differential blamed physics for bookkeeping. R0's batch
made `botStart` honour the block (re-booting when it differs, skipping the
re-boot when it does not, so the v1 fixtures keep their exact frame
sequence). The check in `parseTape` is therefore **version-scoped rather
than retired**: a v1 tape must still declare `tapeFormat.BUILD_SPAWN`,
because a v1 tape is a claim about the v1-era build and the eleven committed
fixtures are v1. A v2 tape may name any level, and `hazard-boot-pit` does —
it is the only fixture that exercises the parameterisation at all.

## The version 2 tape: the ladder's relaxations

R0 adds three fields, all REQUIRED on a v2 tape, because each one selects
which experiment BOTH consumers are running:

```json
{ "tape_version": 2, "noclip": true, "noDamage": true,
  "noHazards": ["water", "pit", "lava", "ice", "waterfall"],
  "grants": [ { "level": 10, "items": ["sword"] } ], ... }
```

- **`noHazards` is a SET, not a boolean.** R4 re-arms hazards ONE AT A TIME
  by design, so a boolean could not express a single R4 rung — and shipping
  one would have guaranteed a second ~10-minute pipeline run just to change
  its type. Names rather than tile-type ints so a committed fixture says
  what it disables.
- **The coerce is on what the physics CONSUMES, never on what the resolver
  STORES.** `Player._state` keeps the raw tile type, so the `_s != _state`
  change gate, `lastState` and the splash-sound comparison are
  byte-identical with the flags on or off; only the effect sites read
  through `Bot.coerceState`. There are four of them, and
  **`Player.as:523` is the one a "guard the setter" patch misses** — it
  re-applies `moveSpeeds[state]` every tick and would put the raw hazard
  speed straight back. Storing raw is also what keeps the tests able to
  assert the resolver's OWN answer (the brick-not-ground lesson) instead of
  a value the relaxation already flattened.
- **A grant fires on the FIRST OBSERVATION TICK whose level matches.** On
  the JS side that is two call sites and no third — construction, and
  immediately after a world swap — because a swap lands at END of tick `t`,
  so "the run's level just became L" and "observation `t` reports level L"
  are the same instant. `Bot.as` applies it right after pushing the
  observation, so both sides name the same `t`. First entry only: for a
  boolean a re-grant is invisible, but `health` ADDS to `hitsMax`.
- **Grants are property writes ONLY.** `Game.setPersistence` is deliberately
  not called. Persistence tags are a shared cross-level namespace the
  endgame reads (`Scenery/FinalDoor.as:50` reads level 114's tag 0, the
  Watcher's), a grant on the arrival tick is already too late to despawn the
  pickup for that visit anyway — `check()` runs on a new `Game`'s first
  frame, above the `blackCover` gate — and leaving persistence alone is what
  makes "crutch off, real collection on" a clean swap at R3.
- **`noDamage` is carried but not consumed on the JS side.** The engine
  models no enemy, no projectile and no trap, so there is no site at which
  `Player.hit()` would have been called; `noDamage: false` is equally inert
  here. It is threaded so the schema is symmetric and the field reaches the
  game, where it does something. Recorded as a bounded vacuity below.

**Version 1 tapes are unchanged on disk and byte-identical.** `parseTape`
normalises a v1 tape to version 1's own semantics (`noDamage: false`,
`noHazards: []`, `grants: []`) so no engine carries a version branch, and
`serializeTape` writes the fields back only for a v2 tape. ⚠ The version
check is on the VALUE, not on presence, and the two are not
interchangeable: `parseTape` is idempotent by design, every consumer
re-validates, and the harness sends the PARSED object over the wire — so a
presence check rejects every v1 fixture. Both sides learned that the hard
way (see "Rebuilding" below).

## The version 7 tape: the RNG state (R6 slice 6a)

The versions between are documented at their own rungs (v3 persistence
clears, v4 equips, v5 determinism pins, v6 the save-array boot block). v7 is
the first field whose reason is that the game is not deterministic **enough**
from outside.

```json
{ "tape_version": 7, "rng": { "seed": 12345, "split": true }, ... }
```

`Math.random()` in the recompiled build is ONE global 31-bit XOR-shift LFSR
whose entire state is a single uint32
(`SWFModernRuntime/src/avm2/avm2_number.c`). That makes a page
**reproducible** — the same tape on a fresh page draws the same numbers —
and it does NOT make the stream **predictable**, because the position at any
moment is the whole page's history: three draws per `Tile` constructed, one
per `Enemy`, one per indexed sound, two per frame of camera shake, in the
title world as much as this one. The Owl (L112) is the first room whose
GAMEPLAY reads a draw — `FinalBoss` rolls its rock frequency and position,
and `RockFall` rolls its scale straight into a `setHitbox`, so whether a
rock HITS is a draw and a hit is a knockback in the compared stream.

- **`seed`** is written into the generator by `botStart` **AFTER the boot
  world is built**, which is the whole point: `new Game(...)` runs its
  constructor synchronously (three draws per tile) and the reset below it
  means the model owes nothing for the world build or the page's history.
  **0 means "inherit the page's stream"** — what every pre-R6 tape did — and
  is not a state the LFSR can reach.
- **`split`** routes the COSMETIC draws onto a second generator. 31 calls on
  25 lines in 13 files call `Rng.cos()` instead of `Math.random()`; with
  `split` false that function IS `Math.random()`, so every fixture recorded
  before the batch takes a byte-identical path. With it on, sprite frames,
  particles, sound indices and the camera jiggle stop moving the gameplay
  stream — and a window's dead frames stop costing the model anything.
- **The bound is `0..2147483647`, for two independent reasons.** The n = 31
  tap is `0x48000000` (bit 31 clear), so the orbit is `[1, 2^31)` — nothing
  above it is a state the game can be in. AND the recompiled runtime's
  `JSON.parse` coerces an integral Number to **int32**, so a declared
  2147483648 arrives in `Bot.as` as **-2147483648**. Measured; both
  validators state it.

⚠ **CLASSIFYING A DRAW IS THE RISKY HALF AND THE ERRORS ARE SILENT.**
`Tile.addGrass`'s blade positions look like decoration and are gameplay
(`Grass` has a hitbox and `cut()` increments `Main.grassCut`), and the
camera jiggle looks cosmetic while `FP.camera` gates `Enemy.update`'s
`onScreen()`. Route a site only when the drawn value's ONLY readers are
`render()`, a `Draw` call, an audio channel, or nothing at all. ⛓ And
`FP.choose`/`FP.rand` are FlashPunk's OWN LCG, seeded once per page from a
single `Math.random()` — they cost this stream nothing and never needed
routing.

### The hooks, and the readouts that rode with them

`swfmodern.Rng` (`getDefinitionByName`, so a build without it throws #1065
rather than silently ignoring a seed) exposes `state`/`setState`,
`cosmeticState`/`setCosmeticState` and `cosmetic`. ⛓ **`setState` IS the
reset** — the state is one uint32 and the seed goes straight in — which is
what lets `botRngProbe(seed, count, cosmetic)` sample the stream and PUT IT
BACK. That probe is `rng.js`'s oracle: the JS transcription's known answers
come from the game, and the first run of
`scripts/procgen/probe-seedling-rng.mjs` caught a wrong xor mask in the
plan by doing so.

The same rebuild carried three readouts that had been wanted-not-walls since
slices 0 and 5: `botMobiles().pods` (a `Pod` is Scenery, not a `Mobile`, so
it needs its own list — with `open`, `anim` and `frame`),
`botStatus.menu_state` (the credits state, read directly instead of by
eliminating four menu writers) and, on the enemy row, `activated` for the
ShieldBoss beside `botStatus.slash = {tests, hits}` — live counters that
measured "one press is FIVE hit tests" from the game's own side for the
first time.

## How the game is driven

`Bot.as` is a **generic, data-driven tape interpreter**, deliberately dumb.
One AS3 edit costs the entire pipeline (mxmlc → bridge injection →
SWFRecomp's ~165 MB C regeneration → an effectively cold emcc pass →
deploy), so behaviour lives in tapes and in JS, and the interpreter is
compiled in once per ladder rung.

**All of v2 landed with ZERO AS3 edits.** The v1 interpreter already read
`noclip` from the tape header and already re-resolved `Main.level` per
frame, so real collision runs and cross-level tapes were recordable on day
one — which inverted v1's slice order: v2 recorded oracles *first* and
transcribed toward them.

Input synthesis needs no patch. FlashPunk keeps its key state in
`private static` vectors with no setter, but `Input.enable()` registers its
listeners on `FP.stage`, so dispatching a `KeyboardEvent` there drives input
on exactly the hardware path. That holds in the *recompiled* runtime too,
not just Flash Player: its own key delivery ends at the same
`avm2_dispatch_event`.

The hook is the top of `Main.update()`, **above `super.update()`** — after
the previous frame's `Input.update()` cleared the edge queues and before
`World.update()` reaches `Player.input()`, so an injected event is live for
exactly one frame and self-clears.

Control surface, registered by the bot itself as ExternalInterface
callbacks and auto-wrapped by the page shim as `__swfBridge.game.*`:
`botLoadTape`, `botStart`, `botStatus`, `botDrain`, `botReset`. This needs
**no** change to `BridgeGeneric`, to `games/seedling.json`, or to the
one-configure-per-instance fence.

## The bookkeeping contracts

Every one of these is a place where a tidy-looking implementation makes
every differential red for a reason that has nothing to do with physics.

**RECORD-THEN-ACT.** The only hook is *before* the movement, so the bot
records the state it can see — the result of the previous tick — and then
dispatches this tick's edges. Observation `t` is the state after exactly
`t` completed movement ticks: index 0 is the boot position under no input,
and an N-tick tape yields **N+1** observations. `tapeRunner.js` mirrors this
exactly. It stayed in `tapeRunner` when the world swap was factored out
into `levelRun.js`, because it is a rule about where the AS3 hook sits, not
about the engine.

**Dead frames must not consume tape.** `Game.update` skips `super.update()`
entirely while `blackCover > 0` (~18-20 frames after every world load), and
`Mobile.mobileUpdate` skips the whole friction/input/move block while
`Game.freezeObjects`. Nothing moves on those frames, so the tick counter
gates on both. The fade frame count varies slightly run to run; that is
fine and observed, because dead frames are skipped rather than counted into
the tape. (`collide-up-rock` replayed with 17 fade frames against a
recording made at 18 and still matched exactly.)

### The transitions contract

`transitions` carries the minimal symmetric record
`[{ t, from_level, to_level }]`, where `t` is **the first observation tick
whose `level` is the new level**. Arrival position is already `ticks[t]`
and is not duplicated. Teleporter identity is deliberately **excluded**:
the AS3 bot cannot observe which teleporter fired without a patch, and an
asymmetrically-known field cannot be differentially checked.

**The settled tick order**, transcribed in `tapeFormat.js`'s docblock
because it is a contract both consumers share rather than an
implementation detail. Within one tick:

1. **Teleporters update BEFORE the player.** `World.addUpdate` PREPENDS
   (`World.as:937-947`) and `loadlevel` adds the player (`Game.as:2040`)
   before the teleporters (`:2169`), so a trigger tests the position the
   *previous* tick left — the position this tick starts from.
2. If one fires, the old player still runs this tick's **full movement in
   the old level**: `FP.world = new Game(...)` only records a `_goto`, and
   `Engine.checkWorld` defers the swap to end-of-tick.
3. The swap lands at end-of-tick: a whole new `Game` whose `Player` is
   constructed at **`(playerx + 8, playery + 8)`** (the ctor's half-tile
   offset, on int args) with **zero velocity** and a fresh terrain state,
   while the **held keys carry over** — FlashPunk's `Input` is static and
   no teleport path calls `Input.clear()`.
4. The ~19 `blackCover` frames that follow are dead frames.

**So there is no intermediate observation on a crossing tick.** The last
old-level observation is the first position overlapping the trigger; the
next live observation is already the arrival. Recorded in
`transition-west-return`: tick 60 is level 0 at x = 17.70000000000001, tick
61 is (296, 168) in level 94. The old player's doomed last step is never
observed and never feeds the new player (arrival comes from the
teleporter's own oel attrs), so the model may run that step or skip it —
and that "the stream cannot tell" claim was put to the test: mutating the
engine to skip it turns only its own unit case red. It *is* modelled,
because the game runs it.

**The field is DERIVED, and the derivation lives in one place.**
`botDrain` returns `transitions: []` unconditionally — the game does not
hand the field over and re-recording will never populate it. That forces no
AS3 edit, because the ruling's definition of `t` makes it a pure function
of the tick stream. Three rules hold this up, and all three are
load-bearing:

- the derivation is `tapeFormat.deriveTransitions`, applied by the harness
  on **both** paths (record *and* compare — the live game still reports
  `[]`, so a compare-only derivation would go red);
- the JS engine derives **its** side from its own world swap, never from
  the level field. If both sides read the level field, the transitions diff
  degenerates into diffing the tick stream against itself and checks
  nothing the tick comparison did not already check;
- the harness **checks that `botDrain`'s own field is still empty**, so a
  future AS3 build that starts reporting transitions for real is a named
  failure to reconcile rather than something the derivation silently
  overwrites.

Derivation happens at **record** time rather than compare time, so a
committed expectation states its central claim outright — the re-record
added twelve readable lines to `transition-west-return.json` and nothing
else, and "crosses at 61, comes back at 109" is now reviewable in
`git diff`. The differ compares elements **exactly**, not by count: a
count-only comparison passes a run that crossed the right number of times
in the wrong places.

## The level is injected, never loaded

Nothing in the engine reads the atlas. The caller passes
`levelSource(level) -> record`; `levelSource.js` holds the node-only half
(`atlasLevelSource()`) and `levelSourceFromAtlas(atlas)` is the
browser-usable one. `buildLevelWorld` then transcribes the `loadlevel`
subset over that record, and `tapeRunner` memoises what it builds.

A **record** source rather than a prebuilt world, for two reasons that are
both about transitions: the runner must build worlds for levels nobody
named at call time (a teleporter's `to`), and `buildLevelWorld`'s loud
throws should fire when a run walks INTO a level, naming it, rather than
eagerly for all 116.

`opts.levelSource` also **selects the engine**. Without it you get the v1
engine (stub terrain, no collision), which refuses a `noclip: false` tape
outright; with it you get v2, whose sweep probe is on or off exactly as the
tape says. The v1 five fixtures are run **both** ways, which is what makes
them a regression net rather than five files that happen to still pass.

`levelWorld` is dependency-free and browser-usable: it takes a level
RECORD, not a path, exactly as the other core modules take plain tapes. Two
things about the record itself: tile rows are **tile-space** while entity
x/y are **pixel-space** (the `[x, y, tx, ty]` rows are tiles; `tx` is a
pixel offset into the tileset strip, so `tx/16` is the column), and the
extract has **already applied `loadlevel`'s own out-of-bounds guard**,
recording what it dropped in `tiles_outside_level` (5 for level 0, 506
across 51 levels). Do not re-filter, and do not un-filter.

Level censuses, each reconciled against a hand count of the extract:
level 0 = 400 tiles (397 walkable, 3 solid), 74 solids, 2 pixelmasks, 8
teleporters. Level 94 = 400 tiles (338 walkable), 88 solids, 10
pixelmasks, 2 teleporters.

## The physics, and the things the source will mislead you about

`playerPhysicsV1.js` and `playerPhysicsV2.js` are a transcription, not a
model. Per tick: teleporter triggers → `getState()` → friction/speed
selection → `friction(); input(); moveX(); moveY()` → world clamp → the
end-of-tick swap, if one fired.

1. **`input()` OVERSHOOTS; it is not a clamp.** The branch is
   `if (v.x < moveSpeed) v.x += accel` with `accel === moveSpeed` — a
   threshold test followed by a full-magnitude add. Velocity therefore
   exceeds `moveSpeed` on most ticks and settles into a ~3-tick limit cycle
   (0.80 → 1.35 → 1.10 → 0.85 → 1.40 …) peaking near *twice* the "cap". The
   original design brief described this as "one held frame saturates the
   axis, velocity is effectively binary"; a port written to that diverges
   from the game on tick 1. **The real game confirmed the limit cycle**:
   holding RIGHT it reports `x = 88, 92.09999999999998, 99.15` at ticks
   0/4/10 and the JS engine emits the same doubles.
2. **Friction is VECTOR-length, not per-axis.** `v.normalize(max(v.length -
   f, 0))` then snap components under 0.05 to zero. Both axes accelerate
   independently but only one friction quantum leaves the combined length,
   so a diagonal covers ~√2 the ground of an axis-aligned run. A per-axis
   port diverges the moment both axes move.
3. **`Player` OVERRIDES `Mobile.moveX/moveY`.** The base-class movers are
   dead for the player, so the noclip flag has to live in the Player
   overrides — patching `Mobile` is a silent no-op.
4. **The clamp reads the LEVEL size, not the screen size.** `Game.as:1854`
   overwrites `FP.width`/`FP.height` from the level file on every load, so
   level 0 (`OverWorld.oel`, 320×320) clamps to x ∈ [2,318] — not the
   [2,158] that `Main.as`'s 160×160 screen implies.
5. **The player does not spawn at the constructor's coordinates.**
   `Player.as:357` re-centres onto the tile (`+Tile.w/2, +Tile.h/2`), so
   `new Game(0, 80, 128)` puts the entity at **(88, 136)**. A tape's `boot`
   block carries the *constructor* args and the offset is transcribed on
   top. (v1's "a later level may carry a `<player>` spawn override" caveat
   is RETIRED: no `.oel` in the repo contains one — grep across all 120.)

### Collision: solid geometry is ENTITIES, not a grid

FlashPunk's `Grid`/`Tilemap` masks have zero call sites. `loadlevel` builds
**one `Tile` entity per 16×16 cell** from the `<tiles>` layer via a 45-arm
switch on the tileset column; the entity POSITION is the cell **centre**
and the hitbox covers the cell exactly. Solidity is a **deferred type
flip**: every Tile is constructed `type = "Tile"` and its FIRST update sets
`type = Tile.types[t]`, marking t ∈ {2,9,11,14,15,19,20,23,24,27,34,35,36}
`"Solid"` and leaving everything else — including Water(1), Pit(6),
Lava(17) — walkable. The player's solid list is the base
`["Solid","Tree","Rock","Rope","ShieldBoss"]` plus `"LavaBoss"`, pushed
**unconditionally in the constructor** (`Player.as:355-359`, not a
boss-fight branch) and inert outside Dungeon 7. Transcribe it verbatim.

The sweep is 1-px steps, `collideTypes(solids, x + d, y)` per step, **X
fully resolved before Y**. Facts that only the running game settled:

- **On a hit the loop RETURNS and the caller DISCARDS the entity.**
  Position stays at the last free step and **velocity is NOT zeroed** — it
  persists and decays only through `friction()`. Pressing into a wall is a
  stable, oracle-observable state, and the observation is cheap:
  `collide-up-rock` releases UP at tick 40, holds y = 130.5 through tick 43,
  then creeps −0.45 to **130.05** at tick 44 as friction shrinks the step
  below the remaining gap. An engine that zeroed `v` on contact holds 130.5
  forever.
- **The stop is MID-PIXEL.** `d = min(1, |rel|) * sign` leaves the rest
  position wherever the fractional approach ended — y = 130.5 above.
  Anything that resolves collision to a tile edge or an integer is wrong
  here by half a pixel.
- **Sub-pixel moves DO sweep.** `for (i = 0; i < Math.abs(_xrel); i++)`
  executes for `_xrel = 0.8` (0 < 0.8). A recon sweep claimed otherwise and
  is wrong; v1's bit-exact friction tails had already proved it.
- **The first-tick type flip is modelled** (`beforeTypeFlip`), and only
  TILES are late — every object class assigns its type in its
  *constructor*, `CliffSide` included, so the pixelmask seam and object
  solids are armed on tick 1. The tick is per **WORLD**, not per run: the
  tick after an arrival is the destination world's first live tick, for the
  same reason tape tick 0 is the boot world's. It is genuinely unobservable
  today (a fresh Player moves ≤ 0.8 px and every solid tile type carries the
  plain 0.8 walk speed), which is exactly why it needed a synthetic unit
  case rather than a fixture.
- **`Rectangle.intersects` is positive-area only**, confirmed at the source
  that matters — `SWFModernRuntime/src/avm2/avm2_text.c:8029`, behind an
  isEmpty guard on both rects, the same comparison FlashPunk's
  `Entity.collide` makes. So one `rectsOverlap` predicate legitimately
  serves both the sweep and the terrain gate.

### The terrain resolver

`getState()` (`Player.as:656-668`) is not a pure function of position, and
v1's `terrainStateAt(x, y)` seam could not express it. Four properties,
all transcribed:

- **STICKY.** `state` is assigned only when the candidate tile's rect
  intersects the player's probe rect; otherwise the **previous** state
  persists. It survives nothing except a world swap, which resets it.
- **Nearest WALKABLE tile, by CENTRE distance.** `nearestToPoint` with the
  default `useHitboxes = false` measures squared distance to entity x/y —
  i.e. to tile centres. And solid tiles flipped their type and *left* the
  `"Tile"` list, so `state` can never become a wall type and the nearest
  candidate near a wall may be surprisingly distant.
- **STRICT intersect.** Touching edges with zero overlap area do not
  intersect.
- **`checkOffsetY = 1`.** The probe point is `(x, y + checkOffsetY)` and
  the probe rect is the player's box shifted down by the same 1 px.

**Noclip does not bypass terrain typing.** `getState()` types the tile
under the player every tick independently of collision, and `moveSpeed` is
selected from it — so a `noclip: true` tape that strays onto water or
stairs still produces a loud mismatch rather than hiding the assumption in
a constant. The modelled state set at the v2 rung is the default-speed
grounds plus stairs (10) and ghost step (30); water(1), pit(6), lava(17),
ice(22), waterfall(25) throw when the player stands on one. That is not
squeamishness: water and lava couple `moveSpeed` to **sound state**
(`+0.25 * int(Music.soundPosition("Swim") < 0.1)`), pits set
`receiveInput = false`, and ice rewrites both speed and friction — all v3+
mechanics.

Two things the running code said that no amount of reading had:
**level 0's spawn tile is BRICK (t = 3), not Ground** — the observation
stream cannot tell, because both walk at 0.8, so it is asserted on the
resolver's own answer, a standing reminder that "the streams match" is a
weaker claim than it reads. And **three `MOVE_SPEEDS` comment labels were
wrong** (17 is Lava, 25 is Waterfall, 30 is Ghost Tile Step); the values
were always right, which is why nothing caught them.

## The pit transport (R1)

A pit is not a floor with a speed. Standing on one starts a three-phase
transport the game drives and the player cannot steer, and **every frame of
it is a LIVE observed tick** — `receiveInput = false` stops input, not the
tick counter, so the differential sees all of it.

R1 leaves pits LIVE (`noHazards: ["water","lava","ice","waterfall"]`, pit
omitted) and models the fall, because pits are not only a hazard: they are
the only way into the underworld cluster that holds `darkshield` (L74) and
`darksuit` (L79). `hazard-boot-pit` (the full five-name set, pit COERCED)
stays committed beside `pit-fall-83` (pit live) as a contrast pair pinning
the set semantics from both sides.

**The edge** (`Player.as:685-716`). Inside the state SETTER, so it fires
only on a RAW change (`_s != _state`), only while `onGround`, and it reads
the COERCED value. `fallInPitPos` is the tile entity's position — the cell
CENTRE — because the probe args are byte-identical to `getState`'s own.
⚠ **The edge fires BEFORE the movement and `receiveInput = false` is set
AFTER it**, inside `checkFallingInPit`, which runs after `super.update()`.
So the tick the edge fires still accepts input and still accelerates
normally; refusal starts on the tick after. A transcription that kills
input on the edge tick diverges on tick 1 of every fall.

**The fall-out is exactly 20 ticks, and it is a knife-edge.** `alpha` starts
at 1 and `-= 0.05` per tick; twenty repeated double subtractions land on
**−3.191891195797325e-16**, just below zero. Computing the count as `1/0.05`
or accumulating differently gives 21. Transcribe it as repeated subtraction.
The lerp is a **geometric decay**, one tenth of the remaining offset per
tick toward `fallInPitPos` — not an arrival; 20 ticks leaves 12.16% of the
offset, which is observable in the stream and irrelevant to the swap,
because the swap reads `fallInPitPos` and never the player's x.

**The swap** is the SAME deferred end-of-tick swap as a teleporter, so it
flows through `levelRun`'s one-swap-two-callers machinery as a new arrival
KIND rather than a second swap implementation. ⚠ `Game.end()` resets
`fallthroughLevel` and the `Game` CONSTRUCTOR calls `end()` on itself, while
`loadlevel` runs from `begin()` — the chain works only because FlashPunk
orders `oldWorld.end()` → swap → `newWorld.begin()`.

**The descent is ALWAYS exactly 83 px and 41 ticks, in every level.**
`Player.check()` runs on the new world's first frame ABOVE the `blackCover`
gate and reads the camera `loadlevel` just set from the player's own
position, UNCLAMPED — `view()` clamps only afterwards. 160/2 + (5−2) = 83.

⚠ **THE LANDING POLARITY IS INVERTED from the obvious reading:**

```as3
if (bouncedFromCeiling || getStatePos(x, yStart) == 6 || == 1 || == 17) land;
else { y = yStart; v.y = -2; bouncedFromCeiling = true; }   // BOUNCE
```

You cannot bounce on a hole or a liquid, so **ordinary floor is the case
that bounces** — once, at `v.y = -2`, for exactly 39 ticks, returning to
`yStart` with zero float residue. ⚠ And `getStatePos` is **NOT** routed
through the coerce (R0's four sites do not include it), so the landing check
reads the RAW tile type while the physics reads the coerced one: the `48 ⇓
49` fall lands on Ice, flattened for the physics and seen as 22 by the
landing check, and therefore bounces.

⚠ **L84 is a PASS-THROUGH.** The `83 ⇓ 84` arrival lands in the centre of a
3×3 block of pit tiles: the descent ends on a pit, there is no bounce, and
the next tick's `getState` fires the edge again. **The arrival has no
walkable NEIGHBOUR** — the level has walkable tiles elsewhere, but none the
player could step into from where the fall puts them — so a router that
demanded a walkable component at the arrival reports darkshield and darksuit
unreachable — which is what the first cut of the R1 route search
did. A leg in a pass-through level has zero targets, zero input spans and an
automatic exit.

**Pit tiles are forbidden floor**, and that policy is load-bearing rather
than tidy: **27 of the 116 levels hold pit tiles with NO `control` block**,
and `checkFallingInPit`'s else branch is `die()` — Dungeon 6 and most of
Dungeon 8 are floors of lethal holes. It was free before R1 (an uncoerced 6
was unmodelled terrain, which `plannerBlockerAt` already reported);
modelling the transport took it off that list, so it is now an EXPLICIT
driver policy beside the teleporter one, with `exit: {pit: {tx, ty}}` the
single exemption.

**The driver emits NO input inside a transport window**, and the runner
asserts none: input is refused there, and a span one consumer honours while
the other drops it is the asymmetry this format exists to prevent. The
harness reads `saw_input_refused` **two-sidedly** against the model — a
transport means refusal is REQUIRED (its absence means no fall fired and the
fixture proves nothing), and no transport means refusal is a defect. Derived
from the model rather than from a new tape field, deliberately: a field
would need `Bot.as` to validate it, i.e. an AS3 change, to state something
both sides can already work out.

⚠ **Two things that THROW rather than being transcribed.** A teleporter
trigger overlapping the player during fall-out ticks, or a second pit edge
while a fall is pending — same doctrine as the two-teleporter throw. And a
**trigger tile that is also a pit tile is not an exit**: walking into it
fires the teleporter (from the position the previous tick left) and the pit
edge (from `getState`, inside the same tick's player update), and which one
wins is FlashPunk bookkeeping. Exactly two exist in the extract — L43's exit
to L37 and L100's to L101 — and the R1 route planner refuses both by name,
which is why the walk leaves L43 by its stairs instead.

⚠ **The `nearestToPoint` TIE is real and it bit on the first recording.**
Walking UP from a tile centre put the probe point on y = 32.0 exactly,
equidistant between two tiles of level 83. **The GAME fell into the pit**,
because `nearestToPoint` walks FlashPunk's entity list and `World.addUpdate`
PREPENDS — its order is the REVERSE of the extract's. Per the standing rule
the fixture MOVED (approach from the west, so x crosses the boundary between
samples). `levelWorld` now REPORTS a tie and
`playerPhysicsV2.resolveTerrainState` throws only when the two candidates
behave DIFFERENTLY under the tape's own relaxation — judging it in geometry
alone failed `hazard-boot-pit`, a committed R0 recording that ties Dirt
against a coerced pit.

## Roles: the census stopped being all-or-nothing

v2's `buildLevelWorld` threw on ANY entity tag it did not carry, which was
right while every caller ran collision and wrong the moment one did not: a
`noclip` walk never asks whether a `bob` blocks, and pricing 115 collider
footprints to find that out is R2's bill. So a tag is classified PER ROLE,
and the builder throws only for a role the caller says it CONSULTS:

| role | the question | who consults it |
|---|---|---|
| `blocking` | does it stop the sweep? | a `noclip: false` run |
| `trigger` | does it swap the world? | everything |
| `pickup` | is it a walk-over item? | a relaxed walk's planner |
| `proximity-hazard` | does APPROACHING it freeze the game, move the player, or consume gameplay RNG — with no key pressed? | a relaxed walk's planner |

"Classified" is an affirmative act, never a default: an entry LISTS the
roles it answers for, and a tag absent from the table is unclassified for
every role and still throws. **The census for the three cheap roles is
deliberately WIDER than the fixture levels** — all 137 tags in all 116
levels, the altitude the trigger census took after `stairsup` — and the
reason is worse here than there. A missed trigger is an exit that silently
does not exist; a missed proximity hazard is a mid-walk deadlock, 150 frozen
frames, or a shifted global RNG stream, and all three surface as "the
physics diverged".

What the census found, by scanning all 209 source files for
`Game.freezeObjects = true`, `setPersistence`, direct writes to a Player's
x/y/receiveInput, `.freeze()`/`.die()` on a player and `FP.world = new
Game`, then reading every hit:

- **`lightalpha`, `snow`, `blur`, `blur2`, `control` and `droplet` are not
  entities at all** — `loadlevel` reads them with `hasOwnProperty` or as
  parameter blocks. `lightalpha` appears in **98 of the 116 levels**, so the
  single largest blocker in the v2 census turned out not to be a collider
  question. (`control` is not idle trivia: it carries the PIT DESTINATION,
  which is why pits are a transport primitive — see "What's next".)
- **All fifteen placed `Pickup` subclasses are `special` with text**, so
  walking over one sets `Game.freezeObjects` and spawns an NPC dismissed
  only by `Input.released` — during frozen frames, which the bot's tick
  counter skips. **A walked-over pickup deadlocks the tape**, so a pickup is
  an avoid VOLUME, not something a route may clip. None of them blocks
  (`Mobile` assigns no type, so they stay `""`).
- **Fourteen proximity hazards**, of which only `chest` and `watcher` carry
  a transcribed volume — the two the R0 walk can reach. The rest are
  `'unpriced'`: classified as hazards on cited evidence with the volume
  deliberately NOT guessed, so the builder throws and the rung boundary is
  visible. Same shape as the pixelmask seam.

Levels that build: **3/116 at v2 → 11/116 with all roles** (the flags, the
pickups and the chest) **→ 82/116 consulting only the cheap roles.** The
remaining 34 are 31 unpriced hazards and 3 levels holding a Bridge tile.

⛔ **R5 FINISHED THE CENSUS AND THE ROLE SPLIT WENT VACUOUS WITH IT.** R5's
route leaves R2's bill behind at its first new room — L19 (ShieldBoss), L26,
L39–L42 (the wand), **L93, the only level with an edge into Dungeon 8**, and
L100–L109 (the ferry, `firewand`) — so 31 levels did not build at all.
Classifying the last 22 tags took the FULL census from 85 to **115 of 116**,
and the relaxed one is the same 115: the single holdout is L112, whose `pod`
avoid volume is unpriced by RULING (R6 owns the ending) rather than by
neglect. So `RELAXED_ROLES` no longer buys a level, and the role-scoped
census throw is a bounded vacuity with no live witness — recorded here
rather than left to be discovered, with the next tag the extract gains as
the thing that would close it.

⚠ **And widening it MOVED COMMITTED ROUTES.** More buildable levels means
more edges in the `(level, component)` graph, and `plan-seedling-r4-route.mjs`
promptly authored a route one leg SHORTER than the one whose six tapes are
recorded and frozen. Each planner now names the level set its OWN rung could
build, by number (`FROZEN_UNBUILDABLE`, 29 levels), so `--write` leaves a
clean `git diff` again — the "pin frozen historical sets BY NAME" rule, since
a predicate that happened to exclude them would rot at the next widening.

⚠ **`keyNeeded` is assigned in exactly ONE place in the whole codebase** —
`NPCs/Watcher.as:46`, `keyNeeded = !Game.checkPersistence(tag)`. Every other
NPC needs the key, so proximity alone only sets an `inRange` render flag.
But `Main.as:319-330` fills `levelPersistence` with `true` on a fresh boot,
so a Watcher with `tag >= 0` has `keyNeeded` FALSE and auto-talks within
24 px — and **all eleven watchers in the extract carry `tag >= 0`**. Level
94 holds one, inside a fixture level, five pixels off routes the v2 driver
was already walking.

⚠ **`Bot.noDamage` does NOT make enemies harmless.** Guarding
`Player.hit()` is the minimal complete guard for the DAMAGE path
(`Player.knockback` has exactly two callers — inside `hit()` and the sword
dash). Seven classes reach around it and write the player's position or
input state directly: `LavaTrap` (a `collideLine` tongue that DRAGS the
player and calls `die()`; its `hitPlayer()` is overridden to `{}`),
`Whirlpool` (radial displacement, then `drown()` — so `noHazards` does not
stop it either), `Pull` (adds force every tick to anything overlapping),
`IceTurretBlast` (`freeze()`), `ShieldLock`, `Pod` and `BossTotem`. They are
classified as proximity hazards and ROUTED AROUND; no flag covers them.

## The acceptance signal

A completion run without a terminal assertion is a demo, not a result. So
`botStatus` reports, live off the game's own statics:

- `items` — the 14 properties (13 booleans and **`hitsMax`, an int** that
  `health` ADDS 1 to over `Player.hitsMaxDef` = 3);
- `cutscene` (`Game.cutscene[]`) and `menu` (`Game.menu`) — both endings of
  the Seed are observable from these (`Pickups/Seed.as`);
- `grants` — a sticky list of `{t, level, items}` for grants that fired;
- `saw_auto_advance` — a sticky count.

**The JS inventory mirror supplies the EXPECTATION; the game supplies the
ANSWER.** `verify-seedling-bot-differential.mjs` runs the same tape through
`runTape` to learn which tick a grant should fire on and which properties
should then be true, and compares that against `botStatus`. Reading the
mirror for both would be the mirror agreeing with itself. All 14 properties
are checked, positives AND negatives — a check that only asserted the
granted item would pass a build that granted all fourteen.

⚠ `saw_auto_advance` is asserted ZERO on every tape. The auto-advance ships
DARK at R0 because every route avoids every ceremony, so a non-zero count
means the proximity census missed something and a freeze fired that nobody
planned for. ⚠ And the key it dispatches is **X (88), not V**:
`NPC.talk()` reads `Input.released(p.keys[6])` and `Player.as:59` is
`[RIGHT, UP, LEFT, DOWN, X, C, X, V, I]` — index 6 is the second `Key.X`,
the one the comment labels "Talk". V is index 7 and opens the inventory,
which would freeze the game rather than unfreeze it. The R0 kickoff had this
wrong; dispatching V would have shipped the feature silently dead.

## The seams that are loud on purpose

Each of these is a **throw**, not a fallback, and the reason is always the
same shape: an over-throw is a loud "move the fixture", while the quiet
alternative is a divergence nobody sees — or worse, a model that agrees
with the game everywhere the fixtures happen to look.

- **Pixelmask colliders** (Building, TreeLarge, SnowHill, TentacleBeast,
  OpenTree, Statue, **CliffSide**) — a sweep step whose candidate rect
  overlaps one's bounding rect throws "unmodeled pixelmask collider".
  Phase 5a already proved neither rectangle approximation is safe: the
  sprite rect swallows the building's own doorway, a smaller one merges
  rooms. `collidesSolid` throws **unconditionally**, even where a rect
  solid would also have blocked — the bounding rect over-approximates the
  mask, so this can only over-throw. Masks are MIT and extractable in a
  later rung if one is ever needed.
- **Two teleporters firing on one tick.** `FP.world =` only records a
  `_goto`, so the winner is whichever updates LAST — FlashPunk's prepend
  order, which this module deliberately does not transcribe. **Live, not
  theoretical:** level 0's own west pair sits at (0,128) and (0,144), and a
  player whose y lies in (141, 146) has their 5-tall box in both volumes at
  once, with different arrivals (296,168) vs (296,184).
  `transition-west-return` walks the row at y = 136 and misses it by five
  pixels.
- **A teleporter targeting its own level.** The game side derives its
  transitions from the level field, so a same-level teleport is invisible
  there; modelling it would put an entry in the JS stream the oracle could
  never report. Defensive only — 0 of 280 teleporters in the extract
  self-target.
- **An unclassified entity in a level being built.** Add it to
  `ENTITY_CLASSES` with its `Game.as` construction site and its `setHitbox`
  args rather than assuming it does not collide. This one is not an edge
  case, it is the ladder's real gate — see "What's next".
- **An unknown layer name.** `loadlevel` builds `tiles`, `objects` and
  `cliffsides` and nothing else; a layer the extract carries that the game
  never builds is a question about the extractor, not something to skip
  past.
- **Bridge (t = 29) fails at BUILD time**, not from the resolver. Its
  `Tile.types` entry is `"Unused"` because it rewrites its own entity type
  from an opening timer inside `render()`, so it cannot even be sorted into
  the walkable or solid list — the level is unmodellable rather than
  modellable-but-wrong. The merely special terrains (water, pit, lava, ice,
  waterfall) load fine and throw only if the player actually stands on one.

The general rule this arc keeps re-learning: **do not let the JS "clean up"
the game.** The first-tick type-flip ordering, the sticky state, the
discarded collision return, the strict `Rectangle.intersects` — transcribe
them all verbatim and let the oracle arbitrate. Every divergence in v1 and
v2 came from a description that was tidier than the code.

## The driver

`botDriverV2` plans A\* over walkable tiles of the current level, smooths
the waypoint chain, and executes each waypoint with v1's bang-bang
controller driving the **real** `step()` with collision on. Two doctrines
carry over from v1 and are why the file is short: **simulate, don't
solve** (velocity is not proportional to anything convenient, so a closed
form would be a second model of the physics, free to drift), and **the tape
is the artifact** (the tests re-run the emitted tape through `runTape`
independently rather than trusting the planner's running state).

**⚠ The controller is 45°-then-axis, not straight-line. This is the
correction most likely to be re-broken by someone reading the brief's
§3.4**, which says to smooth greedily while the straight *segment* stays
clear. Doing exactly that put a fixture in the lake. The braking rule is
per axis and both axes accelerate by the same quantum under vector
friction, so while both are held they advance at the same rate: the player
leaves a waypoint at **45 degrees** and only straightens out once the
shorter axis arrives. For a shallow leg — dx 128, dy 16 — that is most of
the level: from (104,184) toward (232,200) the straight line is at y = 185
by x = 112 while the player is at y = **192**, over the Water at tile
(7,12), where the terrain assertion fires. `controllerPathClear` models the
two legs actually traversed. It stays approximate in two bounded ways (the
X-first intra-tick corner, and up to one accel quantum of overshoot at a
waypoint, which the 6 px between a tile centre and its edges absorbs), and
the executor's throw is what makes approximation safe.

**The geometry has two faces, and only one may be quiet.** A planner cannot
use `collidesSolid`: routing around an obstacle by catching the exception
that says you already hit it is not routing around it, and one stray probe
aborts the search. `levelWorld.plannerBlockerAt` is the same geometry with
the throw taken off — and **strictly wider**, because it also reports
**unmodelled terrain**, which blocks nothing at all in the game (water is
walkable geometry) but ends a v2 run. A planner asking only about solids
routes straight into the lake. A fourth obstacle kind, **live teleporter
volumes**, is planning POLICY and lives in the driver rather than the
geometry: an in-level route that clipped a trigger would silently end up in
another level — the accident that ate v1's original `clamp-left` fixture.
The one teleporter a leg names as its `exit` is exempt.

**It refuses rather than recovers.** If the simulated run hits a wall en
route to a waypoint, that is a planner bug and it THROWS; it never re-plans
quietly, because silent re-planning is how a divergence hides (the tape
still reaches the target, every assertion passes, and the fact that the
model's geometry disagreed with the game's is never reported). Same for a
transition nobody asked for, a leg that starts in the wrong level, and an
`exit` whose teleporter does not go where the next leg says.

**Two obstacle kinds R1 added, and they point in opposite directions.**
`contacts` is an EXEMPTION: a leg starts where the previous leg's exit
landed, and an arrival is not a position the planner chose — four of the
extract's teleporters arrive on top of another trigger and at least one
arrives inside a priced avoid volume, so a leg DECLARES what it starts
inside and the planner exempts exactly that, with an undeclared or a stale
declaration both named failures. `extraVolumes` is the opposite: a volume
the STATIC census cannot know about because the ROUTE created it. R1 has
exactly one, cited — the L38 arrival presses a `buttonroom` whose
`room="37"` write arms L37's FallRock, and `FallRock`'s constructor reads
that flag, so on the return visit the rock is built already fallen and its
update writes the player's `y` directly.

**Cross-level legs**: a task is `[{ level, targets: [...], exit?: {x, y} }]`.
The driver walks the targets, then walks INTO the teleporter whose oel
coordinates are `exit`, and asserts it arrived in the next leg's `level`.
**The caller names the teleporter; the driver never searches the teleporter
graph.** Full auto cross-level routing waits for the rung that needs it —
the maze bot's `(region, arrival-exit)` routing lessons come into scope
then, not now.

**`levelRun.js` is not tidiness.** The driver's copy of a world swap is
what synthesizes the tape the differential then runs through the runner's
copy — two copies would be wrong *together* and the tape would still
reconcile against the game, which is the verifier-shared-assumption trap one
level up. So the swap (arrival offset, zeroed velocity, reset terrain,
pre-armed latch, the destination world's own `beforeTypeFlip` tick) has one
implementation and two callers.

**One property worth stealing for later rungs:** for a *synthesized*
fixture, "the driver still emits this tape" converts any geometry error
into a red, because the PLAN depends on the geometry. That is a strictly
stronger net than a replay-only fixture, and it is how the statue mutation
below gets caught even along a route that avoids the statue.

## Running it

```bash
# 1. dev server at the REPO ROOT (check first — do not double-start)
ss -ltn | grep ":8000" || python3 -m http.server 8000

# 2. the staleness gate: live game vs the committed recordings
node scripts/procgen/verify-seedling-bot-differential.mjs --win

# 3. re-record after a deliberate physics or fixture change
node scripts/procgen/verify-seedling-bot-differential.mjs --record --win \
    --only=collide-up-rock,transition-west-return
```

SKIPs (exit 0) when the wasm build is absent, like every other seedling
verifier. ⛓ 2026-08-19: "absent" now means *the submodule is not checked
out* — the builds ship in `PeerInfinity/seedling-wasm` at
`frontend/modules/flashPanel/wasm/`, and CI does check them out
(`.github/workflows/seedling-wasm.yml`).

⛓ **The build it runs against is `seedling_bot_ap_p4b`, and that move is
itself a measurement.** It defaulted to `seedling_bot_ap` — the R8 bot build
every expectation under `fixtures/expectations/` was recorded from — until
the wasm-hygiene slice ran this very sweep on both, back to back, with
nothing edited in between: **534 PASS / 0 FAIL / 67 SKIP, ALL CHECKS PASSED
on each**, 602 check lines agreeing in order and in text but for 13
free-running clocks, which a control arm (the same build re-run) moved at
least as far. p4b's bridge surface is a strict superset of the eight verbs,
so `seedling_bot_ap` retired from the submodule; it stays reachable as
`SEEDLING_PAGE=seedling_bot_ap` on a machine that still has the directory.
⛔ No expectation, tape or battery byte moved, then or since.

⚠ `PAGE_BASE` — the payload filename — is read out of `game.html`'s own
`<script src>` rather than being a constant. Both halves of that rule have
bitten: a variant directory can carry the ORIGINAL payload name (so
`${PAGE_NAME}.wasm` skips silently), and a build can carry a payload named
after ITS OWN directory (so a hardcoded `seedling_bot_ap` skips just as
silently). Either way the sweep exits 0 having checked nothing, which reads
exactly like a green run.

**Always pass `--only=` when recording.** `--record` does not compare
before it writes, so recording one new fixture otherwise rewrites every
already-oracle-recorded expectation on the way past — a genuine drift in a
v1 fixture would be silently baked into the regression net instead of
reported. A misspelled name is a named failure, not a silent empty sweep.
A missing expectation is likewise a named FAIL for that one tape rather
than an exception that aborts the sweep and leaves every later tape
unreported.

### Always pass `--win`

WSL's own Chromium is **SwiftShader (software)**; SWFRecomp-CC's `CLAUDE.md`
is explicit that it must never be used for performance work. Seedling runs
at **~0.5 frames/sec** on it, so a 140-tick tape takes 6½ minutes and a
fixture sweep takes twenty. `--win` drives real-GPU Windows Chrome from WSL
and gets **~25 fps** — the same sweep in ~50 seconds, a ~44x speedup. The
physics is identical either way; a deterministic tick loop does not care
what draws it.

Recipe and interop rules:
SWFRecomp-CC `tools/divergence/perf/WINDOWS_PLAYWRIGHT_FROM_WSL.md`. Two
notes from using it here:

- That doc says to call `python.exe`. On this box it is not on WSL's PATH
  and the WindowsApps entry is an uninstalled Store alias — **`py.exe
  -3.12`** is the working equivalent.
- Windows Python cannot take Linux paths, so the driver and its JSON files
  are staged under `C:\playwright\` (= `/mnt/c/playwright/`).
  `seedling-bot-replay-win.py` is only a browser driver; all fixture and
  diff logic stays on the Linux side so the tape format has one
  implementation.

Each replay prints its WebGPU adapter, so a run that silently fell back to
software rendering is visible rather than just mysteriously slow.

⚠ **And it writes a LIVE PROGRESS SIDECAR**, `C:\playwright\progress-<tape>.json`,
rewritten every second with the whole of `botStatus`. `execFileSync` with a
pipe shows nothing until the process exits, so on a 14,963-tick tape "still
running" and "done" were the only two observable states and a frozen game
was indistinguishable from a slow one for the entire deadline. The whole
status rather than a chosen subset, because a stall is diagnosed from the
fields nobody thought to forward — that file found the inventory ceremony in
ninety seconds. A driver that FAILS now also re-raises with its own
`REPLAY_FAIL` line and the last 25 page log lines attached, instead of
`execFileSync`'s bare command line.

**Every tape gets a fresh page.** `botReset` forgets the tape but cannot
rewind the *game* — the player stays where the last tape left them, so a
second tape on the same page starts from the wrong position and records
plausible garbage.

## Rebuilding the game after an AS3 change

`~/CC/seedling_bot_build/build_bot.sh` builds the SWF; its header documents
the rest (inject → SWFRecomp → `build_wasm_avm2.sh` → `deploy_wasm_avm2.sh`
→ copy into `frontend/modules/flashPanel/wasm/`). ⛓ 2026-08-19: that
directory is no longer gitignored — it is the submodule
`PeerInfinity/seedling-wasm`, so a rebuilt build is **committed and pushed
there**, then the pointer is bumped here in its own commit. A build belongs
in the submodule iff a tracked file of this repo names it, and
`scripts/procgen/check-seedling-wasm-pins.mjs` gates that; see
`frontend/modules/flashPanel/README.md` for the add/retire steps.
Budget roughly ten minutes and **batch AS3 edits** — that cost is the entire
reason `Bot.as` is a generic interpreter. Neither v2 slice needed one; R0
needed exactly one batch, of six changes; **R1 needed exactly one LINE.**

⚠ **R1's line, and why it is not a crutch.** `Inventory.update` sets
`firstUse` as soon as `items.length >= 2` (`addItemsFromSave` adds one entry
each for sword/fire/wand/spear) and `extended` as soon as `canSwim ||
hasFeather`, and BOTH setters raise a tutorial that holds
`Game.freezeObjects` until a key is pressed. Frozen frames are DEAD frames,
so the tape's tick counter skips them and **no span in any tape can ever
reach the release** — and `autoAdvance` cannot help, because it gates on
`Game.talking` and a `Help` is not an NPC. A walk that collects two items
deadlocks forever: tick stuck, `dead_frames` climbing, `cutscene` and `menu`
both false. R0 never saw it because `grant-sword-room` grants exactly one
item. `Bot.botStart` now sets `Inventory.help = false`, which gates both
ceremonies at their source — and **the game's own debug warps set exactly
that line** (`Player.as:1875`, `:1897`, `:1919`, `:1941`, `:1963`), for
exactly this reason. It suppresses a UI tutorial and nothing else, and R3's
real collection needs it too, so no later rung has to retire it.

Traps, all real: the `.o` cache keys on mtime not flags, so `FRESH=1` after
any define change — ⚠ **and R1 learned that an ABC change is enough**: the
incremental build of its one-line batch produced a page that died with
`heap_alloc(711162896) failed - out of memory` before the bot callbacks ever
registered, which looks exactly like a harness problem rather than a build
one. `FRESH=1` fixed it, at the cost of a full cold emcc pass; use `run-SWFRecomp.sh` rather than raw SWFRecomp or risk
a WSL2 VM `bad_alloc`; `deploy_wasm_avm2.sh` stages the *teleport* SWF as
`test.swf` unless you pass `DEMO_SWF`; mxmlc strips `trace()` without
`-omit-trace-statements=false`; and mxmlc's flow analysis does not credit
returns inside `try`/`catch`, so such functions need a terminal return.

**⚠ "Flags off must be byte-inert" is a GATE, and it earns its keep.** Before
recording anything new against a fresh build, re-verify every already-
recorded fixture against it. R0's first build failed that gate outright: the
new AS3 version-1 check was PRESENCE-based (`t.noDamage != null`) while
`parseTape`'s is VALUE-based, and since `parseTape` is idempotent by design
and the harness sends the PARSED object over the wire, the game rejected all
eleven committed tapes. Two consumers reading one tape differently — the
failure the format exists to prevent — found in one sweep and costing one
extra pipeline run instead of a mystery divergence later. **The live driver
task passing while all eleven fixtures failed was itself the diagnostic:**
the driver's tape comes straight from `buildTape` and never goes through
`parseTape`.

## Gates, and what would make them vacuous

- **G1 (CI, vitest):** every tape's JS stream equals its committed oracle
  recording, exactly — including element-wise `transitions`. Plus the
  hand-derived physics and geometry cases, a *second* independent stratum,
  since their values come from reading the AS3 rather than from recording
  anything.
- **G2 (local, verify script):** live wasm replay matches the recordings
  across all 14 fixtures, and the live driver task (thread-the-gap plus a
  cross-level leg, 517 ticks planned at run time) lands the real game on
  both targets in two levels with the crossing at the tick the driver
  named — asserted from the **game's own** drained observations, not the
  driver's internal state. R0 added the acceptance-signal checks to every
  tape: the readout is PRESENT (a build without it would make the rest
  vacuous by comparing undefined to undefined), `saw_auto_advance` is 0, the
  game's `grants` match the JS expectation tick for tick, all 14 item
  properties match positives and negatives, and the win statics are still
  false.

Both are quantitatively pinned (observation counts *and* transition counts
per tape), because every positional assertion is satisfiable by a bot that
teleports. Exactness is deliberate: AS3 `Number`, JS numbers and the
recompiled runtime are all IEEE-754 doubles, so a mismatch is a
transcription defect to investigate, not a tolerance to configure.

The fixture leg is only meaningful while the expectations are **oracle
recordings**. `fixtures/regenerate.mjs` writes `*.provisional.json` from our
own engine, which is a bootstrap for a not-yet-recorded fixture and a change
detector only — a verifier sharing the generator's assumptions verifies
nothing. A test pins that no current fixture is riding that path.

## The bounded vacuities

Six model properties turn **no fixture red** when mutated away. They are
recorded here as one honest list rather than left implied by a green
mutation table, because **the pattern matters more than the instances**:
the fixture roster can only ever see what levels 0 and 94 contain, and
those two levels are benign. Each entry names the concrete witness that
would close it.

| property | what a mutation kills | why no fixture sees it | the witness that would |
|---|---|---|---|
| sticky terrain state (STILL OPEN at R1) | 5 hand-derived | levels 0 and 94 have COMPLETE tile coverage (400/400 cells), so the strict-intersect gate can never fail along any route in them | a reachable **hole** cell: 27 levels have holes, 6 have one 4-adjacent to plain floor (99, 101, 28, 83, 102, 110). Nearest is level 83, a 5×5 room reached 0 → 12 → 83; mid-hole the 4-wide probe sits at x ∈ [6,10) while the nearest walkable tile starts at 16 |
| ~~the teleporter latch~~ **CLOSED at R1** | 4 hand-derived | — | ✅ **closed by `r1-walk-1-sword-shield`**: the route walks `10 → 11 → 3` and L11's (32,0) teleporter arrives at (104,136), inside L3's own (96,128) trigger back to L11. The recording shows the game staying in level 3 while the box is still in the volume; without the pre-armed latch it would bounce straight back on the next tick |
| terrain state reset on a swap | 1 hand-derived | both arrival tiles walk at 0.8 either way | any transition whose two sides differ in speed |
| the driver's teleporter policy | 2 hand-derived | the only trigger a committed route approaches is the leg's own exit, which is exempt | a target on the far side of a trigger tile, forcing a detour |
| the executor's hit-throw | nothing | it is a **diagnostic, not a detector** — running it together with the wrong statue rect turns the SAME 5 tests red as the statue mutation alone | nothing; keep it anyway, because the alternative (a silent re-plan) is how a model defect becomes a green run |
| the executor's avoid-volume throw (R0) | nothing | the planner's own policy keeps every current route clear, so the executor never gets a volume to notice | a route whose SMOOTHED segment clips a volume the tile-centre test cleared — which needs a volume placed off-centre in a tile the route must cross |
| `noDamage` on the JS side (R0) | nothing | the engine models no enemy, no projectile and no trap, so there is no site where `Player.hit()` would have been called; the flag is carried for schema symmetry and consumed only by the game | the first fixture whose route is in range of a damage source, i.e. R5 |

The A\* tie-break is in the same family: reversing the neighbour order and
dropping the (ty, tx) tie-break both leave everything green, because level
0's routes have no equal-f tie that survives the smoother. The real
cross-run determinism pin is "the committed fixtures are what the driver
emits today" — tapes recorded from the game in another process on another
day.

Until one of those witnesses lands, the only stratum that can see
stickiness is the synthetic hand-built grids in `playerPhysicsV2.test.js`,
and those share the generator's assumptions. Saying so is the point.

**R1 closed the latch row and left the stickiness row open, deliberately.**
The latch witness cost nothing — it is a leg of the route, and the arrival
that lands on L3's own trigger is one of the four the table names. The
stickiness witness still needs its own tape: L83's hole-adjacent tiles are
Dirt on three rows and the stairs row's neighbours are solid Cliff, so the
obvious mid-hole position lands on an equidistant `nearestToPoint` TIE —
and R1's slice 1 already learned what a tie costs (the game fell in the pit
and the model did not). Left for the rung that has a reason to be in that
room with a speed-differing previous state, rather than forced now.

R1 also added two vacuities of its own, both bounded and both recorded:
**the leg-scoped contact exemption** (a leg that walked off its start volume
and back onto it would not be caught here — the game's own re-fired trigger
is the backstop), and **`extraVolumes` on any leg but L37's return** (the
one priced effect is the only one the route causes, so the machinery is
exercised by exactly one entry).

**⚠ R0 OPENED BOTH DOORS, and the first two rows are now cheap rather than
blocked.** v2 recorded that the stickiness and latch witnesses were shut by
three things at once: the baked-in boot, the class table, and (for level 83)
the Pit/Water/pixelmask contents of the room itself. R0 lifted all three —
`botStart` honours the boot, the census relaxes by role, and `noHazards`
plus `noclip` make the room standable. **Level 83 now builds relaxed and
`hazard-boot-pit` boots straight into it.** What remains is only route
authoring: the hole cell has to be reached with a PREVIOUS state whose speed
differs from the nearest walkable tile's, or the stream cannot tell a sticky
resolver from a non-sticky one (level 83's hole-adjacent tiles are Dirt on
three rows and the stairs row's neighbours are solid Cliff, so the obvious
mid-hole position lands on an equidistant tie). The plan takes these
opportunistically at R1, where the walk crosses far more of the map.

Recorded so a later slice does not re-derive it: at the v2 rung **cross-level
walking from level 0 reached exactly ONE other level, 94**. At R0 the
relaxed walk reaches level 10 in four hops.

## R1: the relaxed full walk, as built

**One driver-planned playthrough of the real recompiled Seedling that
reaches the room of every non-combat item it can reach with no enemy
modelled.** 79 legs, 47 distinct levels, 4 pit falls, 1 pass-through,
14,963 live ticks — recorded from the game and committed as seven fixtures.

### The route is data, and it is committed

`fixtures/r1-route.json` holds the leg list; `r1Walk.js` holds the two
things that are DECISIONS rather than derivations (which rooms in which
order, and where the walk breaks into recordable pieces);
`scripts/procgen/plan-seedling-r1-route.mjs` is how the route was arrived
at, and gates nothing. From the commit on, the ROUTE is the artifact —
exactly as `--record` is how an oracle recording was arrived at.

⚠ **LEVELS ARE NOT NODES.** The search runs over `(level, component)` pairs,
where a component is a 4-connected blob of tiles whose CENTRE the player box
fits at with every R1 obstacle priced. Two levels on the route have their
exits in different components (L65's columns 3 and 7 are pit in every row;
L60/L63 likewise), so a level-graph BFS picks a trigger that arrives in the
wrong half and the walk is stranded with nothing wrong in the code — and
L84's arrival has no walkable NEIGHBOUR to step into. This is the maze bot's
`(region, arrival-exit)` lesson arriving on the real map. The first cut of
the search kept node ids in an edge record whose label ALSO carried a `to`
field, and the spread that merged them overwrote the node with the
destination LEVEL; every later lookup compared `"10:0"` against `10` and
found nothing, which presents as "NO PATH" from a graph that has one.

Item order — a 2-opt tour under two real constraints: **wand before the
Witch** (L12 grants `darksword` under `hasWand`, the one true item→item
dependency, honoured only because L43 is reachable without L12), and **the
fall-only cluster last**. The router also REFUSED the `12 ⇓ 21` shortcut to
the torch on its own (L12's pit sits inside the 14-tile `pull` cluster) and
took three more hops instead.

### Forced contacts: what the game has already put the player inside

A leg starts where the previous leg's exit LANDED, and an arrival is not a
position the planner chose. **Two on this route, and the planner refused
both outright until it learned to say so:**

- **L3's own return trigger.** The walk goes `10 → 11 → 3` and L11's (32,0)
  teleporter arrives at (104,136), inside L3's (96,128) trigger back to L11.
  The game suppresses the re-fire through the latch `arriveIn` already
  pre-arms; A\* just refused its own start tile.
- **L38's arrival `buttonroom`.** `in(L38) = {37}`, and L37's only exit to
  it arrives exactly on top of `buttonroom {tset:4, tag:5, flip:1,
  room:37}` — a room-entry puzzle the level was built around.

So a leg may DECLARE the contacts it starts inside, by key, and the planner
exempts exactly those for that leg. **Undeclared is a throw, and so is
declared-but-absent**: the first is a route that silently changed under a
geometry or pricing edit, the second re-permits something the route no
longer touches. The exemption is LEG-scoped rather than start-tile-scoped,
which is a bounded over-permission recorded rather than hidden — what
catches a leg that walked off its start volume and back onto it is the game
itself, whose re-fired trigger the executor throws on.

### ⚠ The one place this walk changes the game's persistence

The L38 press is unavoidable and it is not decorative. It does
`Game.setPersistence(t=4, false, room=37)`, and `FallRock`'s CONSTRUCTOR
reads `Game.checkPersistence(tag)` — so on the RETURN visit L37's
`fallrock {tset:0, tag:4}` at (288,32) is built already fallen, `type =
"Solid"`, `_active = true`. **Slice 3 priced `fallrock` as an evidenced
INERT precisely because a fresh boot leaves every persistence flag true, and
this route is what makes that premise stop holding** — in one level, for one
rock.

Under `noclip` the solidity is irrelevant. The position write is not:
`FallRock.update` does `if (activate && y >= fallTo) { p = collide("Player",
x, y); if (p) p.y = ... }`, a direct write outside both `noclip` and
`noDamage` — the eighth member of R0 §8.7a's family. So the rock's 16×16
hitbox becomes an `extraVolumes` entry for every leg after the press, the
route is planned AROUND it rather than found to miss it, and a test asserts
the emitted tape's own observations clear the rect. The alternative was to
route around L38 entirely, which costs the wand AND darksword. A persistence
NAMESPACE is R3's job; this rung needs one flag, cited.

⚠⚠ **And the first cut of that pricing was SILENTLY DEAD.** The rect was
written as `{x, y, w, h}`, and `rectsOverlap` reads `right`/`bottom` — so
every comparison was `288 < undefined`, false, always. The planner said
clear, the executor's detector said clear, and the test asserting the walk
never stands in the rock said clear: all three shared the broken rect, so
all three were green *by construction*. **The GAME found it**, 2389 ticks
into a segment — its `y` stopped and reversed where `FallRock.update` writes
`p.y`, while the model's kept falling, and the differential surfaced it as a
grant that never fired. `levelWorld.rect()` is exported now, `assertRect`
throws on anything else, and `synthesizeLegs` checks every `extraVolumes`
entry up front. It is the silent-watcher family in a new costume: a negative
assertion with no positive control beside it.

### The six segments, and why ENDS-MEET is the load-bearing part

The full walk is ~11 minutes of real-GPU replay, over the iteration
threshold, so the roster splits into six segment tapes at ARRIVAL-TICK
boundaries and the headline is kept as the rung-close recording:

| # | tape | ticks | legs | ends at |
|---|---|---|---|---|
| 1 | `r1-walk-1-sword-shield` | 910 | 13 | arrival in L0 |
| 2 | `r1-walk-2-feather-conch` | 3548 | 17 | arrival in L44 |
| 3 | `r1-walk-3-wand-darksword` | 2844 | 11 | arrival in L12 |
| 4 | `r1-walk-4-torch` | 1145 | 11 | arrival in L12 |
| 5 | `r1-walk-5-spear-health` | 4361 | 18 | arrival in L12 |
| 6 | `r1-walk-6-cluster` | 2155 | 14 | arrival in L82 |
| — | `r1-walk-full` | **14963** | 79 | the headline |

⚠ **Every boundary is a level ARRIVAL, deliberately.** An arrival's position
is exactly the constructor half-tile with zero velocity and a fresh terrain
state, which is precisely what a parameterised boot reproduces — so
`boot: {level, x, y}` matches `atBootPosition()` and the chain claim is
EXACT rather than approximate. A boundary mid-level could not be booted into
at all: the `Game` constructor takes ints and adds 8. A segment INHERITS its
items through a single `{level: <boot level>, items: [...]}` entry, which
fires on tick 0 because that is when the boot level is first observed.

**Six tapes that each start wherever they like and each end wherever they
get to are six unrelated walks**, so the chain is asserted in the strongest
available form: the headline tape is the six segment tapes **tick for
tick**, and the segments' tick counts sum to exactly the headline's. Every
weaker phrasing (same level, same position, same items, same component)
follows from that, and a deleted or reordered segment cannot pass. The GAME
side asserts the same four ways over its own drained observations — level,
position, item set and `hitsMax`, the last on its own because `health` ADDS
and is the one a re-grant would silently inflate.

`r1Acceptance.js` holds those assertions as pure functions over what the
game reported, and `r1Acceptance.test.js` mutates each input in turn — an
item dropped, a blocked item leaked, a grant unfired, a level never entered,
a crossing lost, a ceremony fired, a boundary moved, a segment deleted,
`hitsMax` inflated — and asserts the corresponding check goes red. A claim
that only ever runs against a passing twenty-minute replay is a claim nobody
has ever seen fail, and a check that has never failed is indistinguishable
from one that cannot.

### The claim, and the blocked list

**10 item booleans true + `hitsMax == 4` — eleven of the thirteen
non-combat items**: sword, darksword, shield, darkshield, wand, conch,
feather, spear, darksuit, torch, and health's `hitsMax`. Read from
`botStatus`, the game's own report, never from the JS mirror.

**Blocked: `fire`, `ghostsword`, `firewand` — and all three have ONE
cause**, which is what makes the ladder's remaining distance a single
number:

| item | where | what blocks it | rung |
|---|---|---|---|
| `ghostsword` | L106 | L98's **IceTurret**: `attackRange = 128` covers its whole 240×208 entrance room; the arrival is 64 px away and the only door into Dungeon 8 is 80 px. `IceTurretBlast` → `Player.freeze(90)`, outside both `noclip` and `noDamage` | **R5** |
| `firewand` | L109 | past it, L108 is a **darksuit-gated LavaTrap ferry**: 153 lethal pit tiles, no `control` block, four disconnected islands, and the only crossings are three traps spaced *exactly* `chompRange` apart that haul the player over the gaps and release rather than kill when `hasDarkSuit` | **R5** |
| `fire` | L32 | combat-gated by construction: `BobBoss` only exists once L32's `fallrocklarge` falls, and only its third form drops `Fire` | **R5** |
| the ending | L112 → Seed | FinalBoss, the Watcher's Seed spawn, both ending branches | **R6** |

**Every remaining blocker is ENEMY-shaped.** R1 takes the map as far as it
goes without modelling an enemy, R5 takes the rest, R6 takes the ending —
and no rung in between has to invent a crutch it would then have to retire.
⚠ `Bot.noEnemyEffects` was DECLINED on the record rather than deferred by
accident: it buys exactly one item for one AS3 batch, one pipeline run, a
re-run of the flags-off byte-inertness gate, ~14 more levels and ~4k more
ticks on every recording — and R5 has to retire it afterwards.

## R2: solids return, as built

R2 takes the first crutch away: **`noclip` off, the real geometry back.**
Its brief and full as-built are `CC/docs/plans/seedling-bot-r2-opus-kickoff.md`
(§8 the recon, §9 the rulings, §10 as-built, §11 what remains).

**The headline finding.** With solids armed and the ruled crutches,
**6 of R1's 11 items survive on geometry alone**, and every one of
the five seals is a single named entity: L71's `lock@112,160` (darkshield +
darksuit), L48's `karlore@112,272` (conch), L38's `cover@144,112` then
L39's wandlock puzzle (wand), L63's bridge at (2,9) then L65's
`rock@192,96` (health). The user ruled the Activators IN (game mechanics,
not a crutch), `fire` OUT, and pushing to R3 — so **the R2 target claim is
8 items and `hitsMax == 3`**, with conch/wand/health published on the
blocked list beside `fire`/`ghostsword`/`firewand`.

**What shipped and is verified:**

- **Pixelmasks are a model, not a seam.** The seventeen MIT masks (⛔ R5
  makes it EIGHTEEN — see below) are
  committed as `#`/`.` rows in `seedlingDemo/seedlingPixelMasks.js`
  (`--check`-gated), and `maskHitsBox` transcribes both halves of the chain
  that runs: `Pixelmask.collideMask` (NOT `collideHitbox` — `Entity.HITBOX`
  is a plain `Mask`), and SWFRecomp's `bd_hit_test`, which truncates the
  player's box TOWARD ZERO with a C cast while the bounding pre-test does
  not. The `<cliffsides>` layer's third column picks which of five masks,
  which the old code dropped.
  ⚠ This matters for a route, not just for tidiness: **L65's exit to the
  health room sits inside `OpenTreeMask`'s 10×12 doorway**, so a bounding
  rect seals a corridor the game walks. The planner uses the real mask too.
- **The blocking census** covers the 69 tags on the 47 route levels (39
  rects, 6 masks, `rope`, 23 explicitly not-solid). The full census goes
  from 11 levels to 82. The table checks itself against
  `PLAYER_SOLID_TYPES`, which caught that `bombpusher` and `iceturret` are
  **enemies that are Solid**. ⛔ **R5 found a THIRD**: `TentacleBeast`
  overwrites its inherited `"Enemy"` with `"Solid"` at `TentacleBeast.as:46`,
  exactly as `BombPusher.as:31` does — and the mask extractor's docblock had
  skipped `TentacleBeastMask.png` on the opposite reading, so L57 could not
  be built. It is also the first of the eighteen whose two ctor offsets do
  not cancel: the entity is at oel + (24, 24) and `Pixelmask(img, -23, -22)`
  puts the mask back at oel + (1, 2), so the pair that satisfies both
  `entityRect` (`x + dx - originX`) and `maskPlacement` (`x + dx`) is
  `dx/dy = 1/2` with ZERO origins.
- **Activators are modelled** (`activators.js`): a lock opens on tick
  **101** of a held button and a cover on **11** — not 100 and 10, because
  `Image.alpha` clamps and the two classes test their fade on opposite
  sides of the decrement. The restore is guarded by occupancy, which is the
  only reason a crossing is possible at all.
- **Tape version 3** carries `persistence: [{level, tag, note}]` — clears
  only, applied by `botStart` before the first world is built. The AS3
  batch was one build and **the byte-inertness gate passed before anything
  new was recorded**: all 23 frozen fixtures byte-identical, headline claim
  intact.
- **The verify sweep has tiers**: `--tier=fast` (18 tapes, ~4 min) and
  `--tier=full` (the gate). ⛓ R6 slice 0 added two more —
  `--tier=gate` (90 tapes, the per-slice gate) and `--tier=legacy` (the 10
  demoted ones, on demand). **`full` still means EVERYTHING**; the
  pre-push gate was not narrowed. See `fixtures/tiers.js` for the measured
  evidence, and note the one thing that keeps a NAMED list from rotting:
  `LEGACY_TAPES` is the only named set and every other tier is its
  COMPLEMENT over `fixtureNames()`, so a fixture added tomorrow joins the
  gate automatically and the list can only ever fail SAFE. ⚠ **L49 (the
  conch room) is the coverage that leaves the gate** — named in
  `LEGACY_ONLY_LEVELS` and printed by every `--tier=gate` run, because a
  bounded sweep must name what it bounded.

⚠ **A clear does more than despawn.** A rope SHRINKS to one cell rather
than vanishing; a `FallRock` is ARMED by a clear (it is parked off-map
while its flag holds), so a clear list naming one is refused by name; and
`Teleporter.checkDeactivated` reads persistence, so a clear can open a
DOOR. And `lock`/`wandlock` despawn only when `tSet < 0`, where `int("")`
is 0 — so a missing `tset` means group 0, and three route locks plus 13 of
14 wandlocks do NOT despawn.

### The walk: 8 items with the solids back

The claim, from the game's own `botStatus` over a **55-leg / 31-level /
3-fall / 10,136-tick** walk: **sword, shield, feather, darksword, torch,
spear, darkshield, darksuit — 8 of the 13 non-combat items** — with
`hitsMax` still **3**. Six segments, `r2-walk-1-sword-shield` through
`r2-walk-6-darksuit`, and the headline `r2-walk-full` which they are a
PARTITION of, tick for tick.

The route is data (`fixtures/r2-route.json`, authored by
`scripts/procgen/plan-seedling-r2-route.mjs`), the tapes are derived from
it (`fixtures/regenerate-r2-tapes.mjs`), and the claim is a pure function
over the game's reports (`r2Acceptance.js`) with every input mutated and
asserted red in CI.

**The blocked list, each with the ONE entity that seals it:**

| item | seal | rung |
|---|---|---|
| `conch` | L48 `karlore@112,272`, an NPC in a 1-tile corridor; `Karlore.added()` removes it only if `Player.hasFire`, and its tag is −1 so no clear reaches it | R5 |
| `wand` | L38 `cover@144,112` needs `pushableblockfire@80,208` pushed onto `button@80,192`; then L39's three stacked wandlocks need wand shots | R3 |
| `health` | L63's bridge at (2,9) needs spearing; then L65 `rock@192,96` or `pushableblockspear@176,128` | R3 |
| `fire` | combat-gated by construction (BobBoss) | R5 |
| `ghostsword` | L98's IceTurret disc covers its whole entrance room | R5 |
| `firewand` | L108's darksuit-gated LavaTrap ferry | R5 |

⚠ **`hitsMax == 3` is the one claim proved by a NEGATIVE.**
`Player.hitsMaxDef` is 3 and `health` is the only thing that adds to it, so
R1's walk ended at 4 and R2's must end at 3. A run reporting 4 would mean a
grant fired for a room this walk never enters. It is checked separately
from the item booleans, because folded together it would be satisfiable by
a run that collected health and lost a boolean somewhere else.

### The HOLD, and what it costs to believe it

L71's `lock@112,160` is the only way into Dungeon 7 and it opens on nothing
but time on the `button@112,176` below it. The leg vocabulary gained a word
for that:

```js
{ x: 120, y: 184, hold: { ticks: 101, presser: { x: 112, y: 176 } } }
```

The presser is named by its OEL coordinates and resolved through
`world.pressers`, exactly as an `exit` names a teleporter.

**The contract has four parts, and each closes a different vacuity:**

1. **The count is a FLOOR, not a measurement.** A Lock needs 101 continuous
   ticks — but `Button.update` presses on OVERLAP, and the approach to a
   button overlaps it for a few ticks before the controller reaches the full
   stop an arrival requires. So the run reaches the hold with the fade
   already part-way down. Over-stating is safe; under-stating is not.
2. **The executor verifies every tick from the run's own state** — the
   position did not change, the box is still inside the presser, nothing
   crossed a level. A hold that silently ran 99 ticks would otherwise
   present as a collision divergence two thousand ticks later, in another
   level, against a lock nobody was looking at.
3. **Then it verifies the EFFECT, with a positive control beside it.** The
   group must be SHUT when the hold starts and OPEN when it ends — because
   "open afterwards" is satisfied by a lock that was never solid. A second
   hold on the same button is a named failure.
4. **And the game says the same thing, twice.** `l71-button-lock` /
   `l71-lock-shut` prove a hold opens the lock and that walking straight in
   is stopped dead at y = 178.5. `l71-hold-101-shut` / `l71-hold-102-open`
   differ in exactly one field — `tick_count`, 101 against 102 — and the
   game answers them **178.5 against 177.1**. "101" stops being a number
   this repo derived from a float loop and becomes something the oracle
   said.

The acceptance readout asserts both halves from the game's own observation
stream, deriving the hold from the stream rather than reading the driver's
bookkeeping: the longest run of consecutive observations that did not move
and were inside the button, then an observation inside the LOCK rect after
it. A hold under `noclip` is refused outright — that arm models no lock, so
it would emit its ticks, verify nothing, and report success.

### The planner grew three knobs, and each one is a named failure

All three default to R1's behaviour, because the 23 R1 recordings are
frozen milestone artifacts and any change to how a route is chosen
re-records every one of them.

- **`lattice` (R2: 8, default 16).** A tile-centre lattice is SOUND and
  INCOMPLETE, and the incompleteness bites when a collider sits off the
  tile grid. `planttorch@120,152` in level 62 is 16×16, half a tile off in
  both axes, in a corridor two tiles wide: it clips all four surrounding
  tile centres, so the tile lattice reported the shaft to level 64 — and
  with it the SPEAR — unreachable, when 16 px of that corridor is clear.
  This is the recon's own warning (a tile-centre instrument reported seven
  seals at R1 that do not exist) arriving on the committed planner.
- **`nodeMargin` (R2: 2).** The greedy string-pull has a fallback: when no
  smoothed segment is clear it keeps the next A\* node regardless, and that
  node was never clearance-checked. `tree@32,416` in level 12 leaves the box
  half a pixel clear of the trunk. ⚠ It DELETES cells, so it is not a
  "more is safer" number — `planWaypoints` walks a ladder down from it one
  pixel at a time rather than falling straight to zero, because one tight
  destination would otherwise strip the clearance from the whole route.
- **`triggerMargin` (R2: 4), which does NOT descend.** An overshoot into a
  wall is absorbed; an overshoot into a teleporter ends up in another level
  with nothing to recover to. Three R2 legs did exactly that — one aiming
  at level 64's exit and arriving in level 61.

⚠ **The route graph does NOT use `triggerMargin`**, deliberately: an
arrival tile is inside its own trigger, so applying it there would fragment
a component around every door. The driver is stricter than the graph, and
an edge the graph offers that the driver will not walk is a loud throw
during tape synthesis, before anything is recorded.

### `allowGrazes`: when a blocked sweep is not a defect

The executor throws on any hit, because a hit means the geometry stopped a
move the planner certified and a silent re-plan turns a model defect into a
green run. With collision on and an eight-pixel lattice that stopped being
the whole truth: the bang-bang controller OVERSHOOTS a waypoint before
braking back, so it can graze a wall a pixel past its target and then
arrive perfectly. Three different levels produced exactly that.

**So a graze is fatal only if the drive then fails to ARRIVE.** Nothing is
re-planned either way; what changes is whether an absorbed overshoot ends
the walk. Every graze is collected, returned, and counted in the tape's own
description, so a route that grazes seventy times cannot look like one that
grazes none.

⚠ **The alternative cost more than it bought, and the runtime said so.**
R2's first answer was to grow the player box while TESTING a smoothed
segment, which forces waypoints exactly where the geometry is close. It
worked — and cost 30% more ticks and **4.7× the input spans**, after which
the recompiled game could not load the headline tape at all:
`heap_alloc(72671) failed - out of memory`, 2,569 spans, 185 KB. At zero
smoother margin the same walk is 853 spans and 63 KB. **A tape is not free
to the runtime, and span count is the axis that matters.**

### The clear list is DERIVED, and the refusals are published

`persistenceClearsFor(levelRecord)` reads each level's own entities and
returns what it OFFERS and what it REFUSES, with the reason. The route
takes every offered clear for the levels it enters — 25 of the 79 the map
offers — and each entry names the blocker it removes. The refusals for
route levels are written into the route file too: an empty findings list
and a clean pass print the same thing.

⚠ **A clear is a FLAG, not an entity: it reaches everything in the level
carrying that tag.** So `buildLevelWorld` refuses a clear that reaches any
entity with no declared persistence response, and the declared-and-refused
responses are named:

| response | class | why refused |
|---|---|---|
| `arm` | `fallrock`, `fallrocklarge` | parked off-map while the flag holds; a clear BUILDS them fallen, Solid and live |
| `appear` | `moonrockpile` | the mirror image — it exists only while the flag is false, so a clear ADDS a 32×16 Solid |
| `press` | `buttonroom` | a cleared tag boots it ALREADY PRESSED and its whole group starts fading from frame one |

and the classes that are modelled but excluded from a derived list by
policy: every PICKUP (the game's items, not blockers), `spinner` /
`lavaboss` / `shieldboss` (enemies — R5, not a blocker crutch), `moonrock`
(writes persistence across levels) and `finaldoor`. `(114, 0)` is
untouchable by name: `FinalDoor.as:50` reads it as "talked to the Watcher"
from level 113.

### Two constructor values the .oel cannot reach

Both were found by wiring, both were wrong in two ways at once, and both
now resolve through a committed table rather than an `if`.

- **`ShieldLock` forces `tSet = -2`** (`ShieldLock.as:26`; `Game.as:2144-2145`
  never passes a group). Reading `tset` off the attributes put a shieldlock
  in group 0 — so L71's button was "opening" one 176 px away — AND stopped
  it despawning on its own cleared flag, because `int("")` is 0 and 0 is not
  `< 0`. `FORCED_TSET` / `tSetOf`.
- **`MoonrockPile` forces `tag = 0`** (`MoonrockPile.as:23`), and the
  extract's one placement carries no `tag` attribute at all — so reading the
  attribute gave −1, every persistence reader guards on `tag >= 0`, and the
  pile looked inert. It is not: with `tag = 0` its `check()` fires on a fresh
  boot and REMOVES it. Level 2 is the third level of the walk and its
  arrival tile is the pile's, so the route reported the whole map
  unreachable. `FORCED_TAG` / `tagOf`.

### What the walk did NOT need

- **No AS3.** The whole walk half is JavaScript; the `persistence` field
  and the version-3 parse landed in slice 4 and nothing since needed a
  second build.
- **No re-planning around a throw.** The driver still refuses rather than
  recovers. What changed is which events count as failures, and each of
  those changes is a named option with a measured reason.
- **No new relaxation.** `noclip` moved from derived to declared, which is
  the opposite of adding one.

## R3: the crutches come off, as built

R3 takes the two remaining crutches away: **items are COLLECTED, not
granted, and one blocker is OPENED, not cleared.** Its brief and full
as-built are `CC/docs/plans/seedling-bot-r3-opus-kickoff.md` (§8 the recon,
§9 the rulings, §10-11 as-built).

**The claim, from `botStatus` over a 53-leg / 32-level / 12,122-tick walk:
six items REAL-collected with `hitsMax == 3`** — sword, feather, torch,
spear, darkshield, darksuit — with `grants` EMPTY and the persistence
flags that are off equal to exactly *the ten declared exceptions + the one
the touch earned + the six the pickups wrote*. The headline is the SAME MAP
AS R2 with the crutches off, not more items.

### The target shrank twice, and both are findings rather than failures

The brief asked for eleven. Slice 0 read the sources and found three of the
four extras are not R3-shaped at all: `Karlore.added()` despawns on
`Player.hasFire` and not on being talked to; `Wand.update` gates its whole
pickup on `hasAllTotemParts()`; `darksword`'s only source is the Witch, who
needs the wand — so R2's darksword was a grant asserting something the
game's own logic refuses, and it LEFT the claim. That put the target at
seven.

Slice 5 took `shield` as well, and that one is the R2 crutch arriving to be
paid for. **At R2 an item was collected by ENTERING ITS LEVEL** — the grant
fired on the arrival tick — so a leg could touch the doorway and turn
around. R3 has to stand on the pickup, and L20's shield is in the level's
*other* component: the walk arrives from L13 into a 2×4 shaft sealed by
`lock@32,80` (tset 0, so no clear despawns it), whose only presser
`buttonroom@192,16` is adjacent to no walkable component at all — it is
walled in behind `shieldlocknorm@176,16`, which needs `Player.hasShield`.
The other entrance is L19's stairs, and L19 is `Dungeon2_Boss`. **No clear
list on the map unseals it**, checked one at a time over all 72 offered
clears and all of them together.

### ⚠ The clear bill: an instrument said 8, the shipped planner said 10

`recon-seedling-r3.mjs --minimal` computes an IRREDUNDANT set — and
irredundancy is the right question, because a one-out sweep is NOT the
bill: two clears in a doorway wide enough for either each answer "not
required", and then both come off and the door shuts. It answered 8.

The shipped planner answered 10, and the three additions are three
different questions the instrument was not asked:

| clear | who demanded it | why the recon could not see it |
|---|---|---|
| `L30 tag 0` `bosslock@64,32` | the NARROWING | the recon asked at LEVEL granularity, which is what R2's reachability meant |
| `L3 tag 0` `breakablerock@96,112` | the driver's own A* | no path across L3 at any clearance the ladder descends to |
| `L11 tag 0` `chest@32,48` | the CONTROLLER | the bang-bang overshoot clips the chest's avoid volume |

The lesson is not that the instrument was buggy — it answered the question
it was asked. **A reachability graph and a walk are different questions,
and only the second one is the claim.**

### The three verbs, and why a `collect` is not a tighter tolerance

The leg vocabulary now has three mechanics, all named by OEL coordinates
and all verified from the run's own state:

- **`hold`** (R2) — stand on a button for N ticks. The count is a FLOOR;
  what is asserted is the EFFECT, with a shut-before control.
- **`touch`** (R3) — walk into a shield lock holding the right shield. The
  window REFUSES INPUT, so the driver emits no spans inside it and the
  count is the game's, not the author's.
- **`collect`** (R3) — stand on a pickup and page its ceremony through with
  X releases. Three things make it a verb rather than a tolerance:
  1. **The planner has to be kept OUT and the executor let IN.** A pickup
     is an avoid volume, so A* must route around it — exempting it
     leg-wide let the planner cut STRAIGHT THROUGH the feather on the way
     to its own approach cell, the ceremony fired mid-drive, and the
     waypoint was never reached.
  2. **The approach cell needs CLEARANCE.** The controller overshoots
     before braking back, and clipping a pickup starts its ceremony a
     waypoint early — which freezes the player, and `hasArrived` needs them
     STOPPED while a freeze PRESERVES velocity. L64's ghostspear found this
     one third of a pixel into a 12×4 volume.
  3. **A collected pickup must stop being an obstacle.** `run.takenPickups`
     is live state the planner reads, exactly like `openActivators` — the
     tile the walk is standing on when a ceremony ends would otherwise be
     reported unwalkable and every plan from it would fail at its own START.

### The ceremony: the TAPE drives it, and `saw_auto_advance` stays 0

`Bot.autoAdvance` has been compiled in since R0 and had never fired. The
probe inverted the plan: **the bot CONSUMES TAPE TICKS during a dialogue.**
`Game.freezeObjects` is a sticky static with several writers and no
per-frame reset, so it reads TRUE inside `Mobile.mobileUpdate` and FALSE
again at the next frame's dead-frame gate; and `NPC.talk()` reads
`Input.released` from the NPC's own update, outside the frozen block. So a
`primary` span pages the dialogue and `saw_auto_advance` stays **zero**.

⛓⛓ **R6 SLICE 6b NAMED THE LINE THAT LOWERS IT**, which this paragraph had
described as an emergent property of "several writers" for three rungs. It
is one line, and it decides the tick/frame split for the whole ending:

```
  Game.update:  … super.update()  …  if (canInventory()) inventory.update()
                                     else if (inventory) inventory.open = false
```

`canInventory()` is `inventory && !talking && p && p.receiveInput &&
!p.destroy` (`Game.as:1494`) and `Inventory.set open` **is**
`Game.freezeObjects = _open = _o` (`Inventory.as:153`). ⇒ **while
`Game.talking` is true, the ELSE arm clears the freeze at the end of every
frame.** A DIALOGUE frame is therefore raised inside `World.update` and
lowered before the next frame's dead-frame gate reads it, and the tape
ticks. A freeze raised by anything that does NOT set `Game.talking` — a
`SealController`, a `Pickup`'s phase A, a `Seed`'s cover fade — is never
lowered, and those frames are DEAD.

⛔⛔ **AND FOR A *PLACED* NPC, LEAVING THE RADIUS IS NOT A CANCEL.**
`NPC.talk`'s `else` arm is `talked = false; if (talking) talking = false;`
and the `talking` SETTER's `if (!talking)` branch ends with
`doneTalking()`. For the Watcher that override is the `{114,0}` write, so
**walking away mid-dialogue earns the tag exactly as reading it to the end
does**. A control built on "the same tape, but leave before the last page"
clears the flag it exists to withhold, and both arms come back identical.
End the TAPE inside the circle instead. A pickup's ceremony has no radius
and cannot hit this; every placed NPC can.

⛔⛔⛔ **AND R6 SLICE 6c DROVE IT, WHICH MADE THE FINDING SHARPER: THERE IS NO
MID-DIALOGUE WALK TO TAKE.** `NPC.talk()`'s `if (talking)` block raises
`Game.freezeObjects` on its **first line** — above the key test AND above the
radius test — and the NPC updates before the player. So from the dialogue's
SECOND frame onward `Mobile.mobileUpdate` returns early and the player cannot
move at all.

⇒ the out-of-range arm is reachable from exactly ONE frame: the one the
dialogue OPENS on, which is live only because `startTalking()` sits BELOW the
block that raises the freeze. A stance booted ON the circle (distance exactly
`talkRange`, and the test is `<=`) that steps outward there — 0.80 px from
rest, enough and only just — is out of range when the next frame tests it,
and the teardown runs `doneTalking()`. **`{114,0}` is earned in two ticks,
with zero pages read and no key pressed at all.** Both halves are driven in
`watcherL114.test.js`: that boot earns it at tick 2, and the shipped W-talk
stance holds `down` for 200 ticks and never moves once.

⛓ The practical rule: when a mechanism BOTH gates movement and READS
position, enumerate the frames on which both are true before designing any
control around "leave". The window can be one frame wide, or empty.

### ⛔⛔ Two fenceposts an animation's end has, and they compose (R6 slice 6c)

`FinalDoor` is the cleanest case in the game — no `destroy`, no fade, just an
animation and a removal — and the model got BOTH of its ticks wrong in ways
that nearly cancel.

```as3
World.update:   while (e) { if (e.active) e.update();
                            if (e._graphic) e._graphic.update();
                            e = e._updateNext; }
Engine.update:  FP._world.update();  FP._world.updateLists();
```

1. **The `play()` frame IS the animation's first update.** `spr.play("open")`
   runs inside `e.update()` and `e._graphic.update()` follows in the SAME
   pass over the SAME entity — so `animEnd` fires on graphic update N at
   **play tick + (N-1)**, not + N. For the door: update 57, tick +56.
2. **`FP.world.remove(this)` only QUEUES.** The Player sweeps inside
   `world.update()`, which runs BEFORE `updateLists()` — so the body is still
   in the type list for the whole frame its animation ends on, and the first
   free sweep is the NEXT tick. R5 slice 5 found this as the third of
   `ShieldBoss`'s three fenceposts; for a class with no `destroy` and no fade
   it is the WHOLE removal.

⛓⛓ **NEITHER CORRECTION ALONE REPRODUCES THE GAME.** With the naive count and
no queue the model frees one tick early; with the corrected count and no
queue, one tick early; with the naive count and the queue, one tick late.
Only both together are byte-exact — which is what makes them a pair of
findings rather than a tuned constant.

⛓⛓⛓ **AND THE DIAGNOSTIC IS REUSABLE.** The refuting recording diverged at one
observation and stayed diverged, which reads like drifting physics. It was
not: the per-tick **deltas** either side were IDENTICAL (1.55, 1.30, 1.05,
0.80, 1.35) and only the absolute positions differed, by exactly one step.
Velocity evolves whether or not the position is clamped, so matching deltas
plus a constant offset means one extra MOVE and nothing else wrong — a
geometry fencepost, findable by reading one `if`. **Diff the deltas before
you diff the values**; a growing offset is an accumulator, and differing
deltas are a different question entirely.

### ⛔⛔⛔ A cutscene that LOWERS the freeze, and 338 ticks that looked frozen (R6 slice 6d)

The ending's two `Seed` windows both hand the game control for hundreds of
frames, and the two halves cost the tape opposite things. Telling them apart
is one line, four lines below the one it is natural to read.

```as3
Game.update:  …
   else if (cutscene[1]) { p.receiveInput = false; p.v.y = -1; if (p.y <= 64) p.v.y = 0; }
   else if (cutscene[2]) { p.receiveInput = false; p.visible = false; p.active = false; }
   …
   if (canInventory()) inventory.update(); else if (inventory) inventory.open = false;
```

`canInventory()` is `inventory && !talking && p && p.receiveInput &&
!p.destroy` and `Inventory.set open` **is** `Game.freezeObjects = _open = _o`.
So **either cutscene arm LOWERS the freeze at the end of every one of its own
frames**, and every frame of both is a live TAPE TICK.

| span | kind | what holds the player |
|---|---|---|
| `Pickup.specialTimer` (150) | DEAD frames | `freezeObjects`, and nothing lowers it |
| the pickup's NPC dialogue | ticks | `Game.talking` ⇒ the inventory else-arm |
| `Seed.removeSelf`'s cover (200) | DEAD frames | raised before any cutscene flag exists |
| `cutscene[1]`'s scripted walk | ticks | `receiveInput = false` — it still MOVES |
| `cutscene[2]`'s tree (138 + 200) | **ticks** | `active = false` — `Player.update` never runs |

⛓ The rule this generalises to: **"the player cannot move" is at least three
different mechanisms and they bill differently.** `freezeObjects` gates
`Mobile.mobileUpdate` (dead frames); `receiveInput = false` gates
`Player.input()` only (live ticks, friction and sweeps still run);
`active = false` skips the entity's `update()` entirely (live ticks, nothing
runs). A window that prices the wrong one is out by its whole length.

⛓⛓ **AND THE `play()` FENCEPOST INVERTS WHEN THE `play()` IS IN A
CONSTRUCTOR.** The tree's `sprTreeGrow.play("grow")` runs inside the `Seed`
ctor, which `Game.loadlevel` calls — not inside a `World.update` pass — and
`Game.update` gates `super.update()` on `blackCover <= 0`, so nothing advances
during the load fade. The animation's first update is the first LIVE frame of
the rebuilt world and the count starts at **1** there, which is the opposite
of the door's. The fencepost above is about a `play()` called from inside
`update()`; check which one you have.

### ⛔ Three more the ending's own rooms charged for (R6 slice 6d)

- **A dead-frame ledger has to count ceremonies STARTED, not completed.**
  `Pickup.pick_up()` raises the freeze and spends `specialTimer` on CONTACT
  and never asks whether the dialogue after it is dismissed. A tape that ends
  mid-ceremony has paid 150 dead frames and banked no completion — 170 dead
  against a one-load band of [14.6, 23.6]. The two lists are identical for
  every fixture that finishes what it starts, which is why the defect can
  live for six rungs.
- **An `int` PARAMETER truncates before the constructor's half-tile adds it
  back.** `new Seed(p.x - 8, p.y - 8, …)` then `super(_x + Tile.w/2, …)`
  cancels EXACTLY on an integer coordinate and nowhere else, so a spawn
  documented as "at the player" is at `trunc(p.x - 8) + 8`. A 10x14 box around
  a 4x5 player still overlaps, so nothing visible breaks.
- **A talk radius is not a talk gate.** `NPC.keyNeeded` defaults TRUE and only
  `Watcher` assigns it (`!checkPersistence(tag)`), so a Watcher auto-talks on
  proximity and an Oracle does not. And `Bot.autoAdvance` is called only from
  inside the dead-frame gate and returns unless `Game.talking || helpUp` — it
  can ADVANCE a dialogue and never OPEN one. Both facts are needed to stand
  inside `oracle@64,32`'s circle with `cutscene[1]` armed and not end in a
  menu; either alone leaves the trap live.

Three facts only the game knew, from the first collection recording:

1. Contact at observation 23, frozen 24..57 — **34 ticks**, which the model
   predicted from the AS3 before anything was recorded.
2. ⚠ **VELOCITY SURVIVES A FREEZE.** Nothing is reset; not stepping IS the
   whole model, which is why the player drifts on for three ticks after.
3. ⚠ **THE COMPLETING FRAME IS NOT FROZEN.** `World.addUpdate` PREPENDS and
   the temporary NPC is added LAST, so it updates BEFORE the player and
   `talking = false` has already cleared the freeze. This was the model's
   only divergence, and seven recordings now protect it.

⚠ **Press spacing is load-bearing.** `slashTimer` is 20 and a press landing
after the ceremony reaches `useItem(Main.primary)`: one is a swing, two
inside twenty ticks is a **DASH that moves the player**. Every fixture
spaces them eight apart, and the executor asserts none lands after the end.

### ⛔⛔ The Owl room's DRAW SCHEDULE, and three things the instrument taught (R6 slice 6e)

L112 is the first room on the ladder whose GAMEPLAY reads random numbers, so
a window there needs more than `rng.js`'s generator: it needs to know how
many times the game turns the crank on tick N and in what order.
`finalBossRng.js` is that table and `finalBossFight.js` consumes it.
`scripts/procgen/probe-seedling-r6-owl-rng.mjs` writes the known answer by
running real tapes and reading `botStatus.rng.state` — the live uint32 —
then stepping the modelled LFSR from the declared seed until it matches,
which recovers the run's draw count exactly.

The schedule, per tick, with `rng: { seed, split: true }` declared:

| phase | draws | sites, in order |
|---|---|---|
| intro / frozen / a lava self-hit / the `rockfallTime == 0` tick | 0 | the arm returns above every site |
| **coast** (shoved, `\|v\| > moveSpeed`) | **0** | NO arm runs at all |
| barrage, no spawn | 1 | the rock gate |
| barrage, spawn | 4 | gate, x, y, then `RockFall`'s scale |
| walk, no grenade | 1 | the grenade gate |
| walk, grenade | **2** | gate, then `Enemy`'s own ctor draw |
| `endAnim` "dead" | 10 | 5 x (x argument, ctor scale) |
| ANY frame with `shake > 0` | **+2** | the camera jiggle, appended LAST |

Four things that table cost:

- **A CENSUS OF SITES IS NOT A SCHEDULE OF TICKS.** A `Grenade` is an
  `Enemy`, and `Enemies/Enemy.as:30`'s `private const coins:int = 4 +
  Math.random() * 4` is an instance FIELD INITIALIZER — every construction
  pays it. The R6 kickoff's schedule said "1 draw per walk tick" while the
  slice-6a census had already listed the site. The cure is to make the
  schedule DISPATCH through the census: every site is a method, every method
  books to a named site, and a test asserts the two key sets are equal.
  ⛓ `RockFall` extends `Mobile`, not `Enemy`, so a rock costs 3 ctor draws
  and a grenade 2. "One ctor draw per entity" is wrong for both.
- **`Bot.botStart`'s RNG RESET LANDS BEFORE THE LEVEL IS BUILT.** The reset
  sits below `FP.world = new Game(...)` specifically so a model would owe
  nothing for the world build — but `Game`'s constructor does not build the
  level. `loadlevel` is in **`begin()`**, which FlashPunk calls when the
  DEFERRED swap lands, after `botStart` returned. So every seeded tape's
  stream contains its own build. For L112 that is exactly **2** gameplay
  draws (`Enemy.coins` for the one boss, `Orb.randVal` for the one orb, in
  `loadlevel`'s add order) — measured two-sided by a two-tick arm that ends
  before the intro does.
- **`botStatus.rng.state` IS A LIVE READ ON A GAME THAT DOES NOT STOP.**
  `Bot`'s finish is `armed = false; finished = true;` and nothing else, so a
  post-run poll returns the truth plus the poll latency (measured: 0 or 1
  frame, never negative). Against one run per arm this produced a
  NON-MONOTONE offset — impossible between two prefixes of one stream, and
  therefore always the instrument. The probe now runs every arm twice, takes
  the MINIMUM, and records the spread; the test asserts the spread's bound.
- **WHEN A COUNT IS NOISY, READ THE QUANTISED QUANTITY.** The Owl walks a
  0.5303300858899106 px lattice (`moveSpeed` 1, friction 0.25, a 45° leg), so
  `botMobiles`'s position counts his moving ticks EXACTLY and carries no
  drift. It settled the count question and, with it, an edge-timing one the
  count could not: **the intro ends on the `primary` span's `from` tick, not
  its `to`** — measured at `from = 2` and again at `from = 10`. The mechanism
  is not settled (either `Bot` delivers a length-1 span's release inside its
  own tick, or the runtime's `Input.released` is true on the down edge) and
  no committed fixture can tell them apart, because every other release on
  the ladder is inside a dialogue where only the COUNT of releases is
  observable.

Two numbers the same transcription re-derived and a recording has yet to
arbitrate: **one unclamped sword press shoves the Owl 68.25 px over 18
ticks** (not 71.25 — the press tick moves him zero, because the boss updates
before the player), and **the two persistence writes land 109 ticks after the
third lava hit** (not 110 — trap 104 in both directions, and they compose).

### The touch, and the tick the ORACLE moved

`ShieldLock.update` collides at `x - 1`, and with `Player.hasDarkShield` it
snaps `p.y = y - originY + 7`, sets `receiveInput = false`, runs the
ordinary 0.01 `Lock` fade to its 101st tick, then `turnOff()` restores
input and writes `setPersistence(2, false)`.

Three ways it is NOT the button lock:

- **`activate` LATCHES.** `ShieldLock` forces `tSet = -2`, so no
  `activateAll` republishes the flag: walking away does not close it, which
  for `lock@112,160` it does.
- **The window refuses the KEYS, not the tick.** `receiveInput` gates
  `Player.input()` alone, so friction and both sweeps still run.
- **`turnOff()` restores input only `if (p)`.** A player carried out of the
  rect never gets input back. Unreachable at walking speed — friction is
  subtractive and the whole coast is under 2 px, against a 5 px margin —
  but ice (friction 0.025) would clear it easily, and both ice and
  waterfall are in `noHazards` on every tape on this ladder.

⛔ **AND THE ORACLE CORRECTED THE UPDATE ORDER ON THE FIRST RECORDING.**
`Game.loadlevel` adds the Player at `Game.as:2040` and every puzzle entity
in the loop BELOW it, and `World.add` -> `addUpdate` PREPENDS — so **a Lock
updates BEFORE the player**, not after. That changes nothing about the
activator STATE (the same object either way, which is why no R2 recording
could see it: the player is stationary for the whole of `l71-button-lock`)
and everything about the SIDE EFFECT: `p.y` is written at the top of tick
N+1. The model applied it at N; the game said observation 19 is y 264, not
263.

⚠ **And the clear the player earns OUTLIVES the visit.** `Lock.check()` on
a newly constructed `Game` removes any lock whose flag is off, so the
shield lock is GONE on the next entry to L71 — which the route depends on,
because it goes east through the lock to reach darksuit and comes BACK
through the same corridor to L71's pit. `levelRun` banks the tag and cashes
it in the transition path; dropping the memoised world at `turnOff` would
despawn the lock on the very tick the player is standing inside it.

### The pair, one field apart

`l71-shieldlock-open` and `l71-shieldlock-shut` are the SAME TAPE with
`grants` emptied. The game answers y 263 and level 76 against y 264 and
pinned at x 285.95 for all 140 ticks — so the crossing is a claim about the
shield, not about a lock that was never there. The window gets no spans:
the movement span ends at 19 and resumes at 119.

### The ledger is the claim

At rung close the game reports, from its own arrays:

- `grants` **empty** on the headline (a segment may carry one boot-level
  inheritance entry; the headline may not),
- `persistence` — the ten declared exceptions applied,
- `persistence_cleared` — **exactly** those ten, plus `L71 tag 2` which the
  touch earned, plus the six tags the pickups' own `removed()` wrote.

That third line is the one with teeth: `Bot.persistenceClearedAll()` scans
`Main.levelPersistence` rather than echoing the tape, so an exact-set claim
over it is the only thing that distinguishes "the player did this" from
"the tape did". `r3Acceptance.js` holds it as a pure function and
`r3Acceptance.test.js` mutates every input — including removing each
pickup's flag one at a time, which is precisely the "granted, not
collected" failure.

### ⚠ A blind spot in the readout, reported not fixed

`saw_auto_advance` counts on **phase 1** of the cadence, the RELEASE. A
`Help` is dismissed by `Input.pressed`, so its freeze ends on phase 0 and
phase 1 never runs — the counter cannot see a Help being auto-advanced.
The sword's `Help(3)` IS auto-advanced on every run that collects it (about
two extra dead frames is the witness), and `saw_auto_advance` still reports
0. `Bot.as`'s own docblock claims the opposite two lines above the code
that contradicts it. Harmless — the model reproduces the tapes exactly —
but the counter means "no NPC dialogue was auto-advanced", not "no
auto-advance fired". Fixing it is AS3, so it waits for the next batch.

## R4: the hazards come back, as built

R4 arms the floor. Its brief and full as-built are
`CC/docs/plans/seedling-bot-r4-opus-kickoff.md` (§8 the recon, §9 the
rulings, §11 the L65 breach, §13 the mechanics).

**The claim, from `botStatus` over a 41-leg / 25-level / 10,052-tick walk:
FIVE items real-collected — four booleans plus `hitsMax == 4` asserted as a
POSITIVE** — sword, feather, torch, spear and **health** — with `grants`
EMPTY, `saw_auto_advance == 1`, and the persistence flags that are off equal
to exactly *the eight declared exceptions + the two the player EARNED + the
five the pickups wrote*. `noHazards` is `["water", "waterfall"]`, so **lava
and ice are LIVE**.

The rung's subject is health: three rungs called L68 sealed, and it costs
five spear presses across three levels, a boss key, and a lock that opens on
it.

### ⛔ `hitsMax` is the one claim on the ladder whose truth value FLIPS

R1, R2 and R3 all asserted `hitsMax === 3`. That was a NEGATIVE — "the walk
did not enter that room" — proved by absence. R4 asserts 4, and
`HealthPickup.removed()` is the only thing in the game that adds to it, so 4
means exactly one grant of it: 3 says the collection silently failed and 5
says something granted it twice.

⚠ **It is checked ON ITS OWN, never folded into the item booleans**, because
`health` HAS no boolean — `ITEM_PROPERTIES.health` is
`{kind: 'add', property: 'hitsMax'}`. A check that summed the two would be
green for a run that lost `hasSword` and gained health.
`r4Acceptance.test.js` does exactly that mutation and asserts one finding
goes red and the other does not.

### The breach: a push into a pit is a REMOVAL

§8.5 ruled health permanently sealed on one sentence — *"but a push is not a
removal"* — and the direction table around it was right (the game confirmed
it). What that sentence missed is that a block pushed onto a pit **destroys
itself** (`PushableBlockFire.input()`), and that a block pushed out of a
one-tile corridor has left it either way. The sweep that found the seal had
swept SINGLE pushes from ONE component and never asked what the second push
does from the cell the first one opened.

`recon-seedling-pushes.mjs` asked, at pitch 8, 4 and 2, and found three
levels breach with the same shape. The route realizes all three:

| level | the chain | what opens |
|---|---|---|
| **L67** | one push W from (180,116), onto (8,7)'s pit | `bosskey@48,64` — the keyType-4 key |
| **L63** | one push E from (100,100), onto (8,6)'s pit | the L65 door @128,304 |
| **L65** | W from (196,132); N from (164,164) **across the pit at (10,9)**; W from (196,116) **through the Body Wall at (11,7)**, onto (9,7)'s pit | the L68 door — health's own room |

`probe-seedling-l65-breach.mjs` is the oracle: a pair differing only in
whether the three `primary` spans exist, both ending on holds long enough to
PIN against a wall. They track to the pixel for 380 ticks and then separate
by a tile and a half — press arm (166.65, 98.05) through the vacated
corridor, control (194.05, 114.15) at the block's own east face. Both arms
are unit tests against the shipped model.

⚠ **Two mechanics were exercised for the first time on the way**: UP at
reach 2 — the one arm of `spearRect` carrying the asymmetric `+ 1`, which no
recording had ever fired — and reach 2 **through a solid**, which had been
inferred from "the spear has no line-of-sight gate" rather than seen.

### The BossLock: a third way a responder opens

R2 had the BUTTON (a group flag republished every tick) and R3 the TOUCH (a
shield, latched). `BossLock` reads a save-file boolean and a one-pixel row
beneath itself, and shares its arithmetic with neither:

```
var p = FP.world.collideLine("Player", <a one-pixel row beneath me>);
if (p && Player.hasKey(keyType)) activate = true;
if (activate) { if (keyTimer > 0) keyTimer--;
                else { alpha -= 0.05;
                       if (alpha <= 0 && type != "") {
                           type = ""; Game.setPersistence(tag, false); } } }
```

- **It opens on tick 80**, not 101 and not 81. Sixty ticks of `keyTimer` —
  the frame that latches `activate` is also the first decrement — and then
  `alpha -= 0.05` on a bare `Number` with **no `Image.alpha` clamp**, so the
  twentieth subtraction lands on `-3.19e-16`, which is `<= 0`. A model that
  clamped, or that read `1 / 0.05`, answers 81 and 20.
- **`activate` LATCHES, by absence.** `tSet` is forced to -1 by the ctor, so
  no `Button.activateAll` republishes the flag, and nothing else in the
  extract writes it — which makes the `else if (type != normType)` re-close
  arm unreachable after the first touch. `Lock` is the class that really
  does re-close, through `activationStep`'s occupancy-guarded
  `returnToNormal`; reading `BossLock` as a `Lock` is the mistake to avoid.
  ⚠ **The leg holds the stance for the whole window anyway.** A latch is a
  claim about an ABSENCE, and an absence is the one source reading a
  recording cannot confirm — a game that re-closed and a game that latched
  look identical to a walk that never leaves.
- ⚠ **THE STANCE IS A PIXEL, NOT A NODE.** The probe row is at `y = 49`, the
  player box is `[y-2, y+3)`, and the lock's own cell is `[32,48)` — so the
  stance needs `50 <= y <= 51`, and the pitch-8 lattice offers 44 (inside
  the lock) and 52 (below the row). The leg aims at the pin against the
  lock's south face and the WALL is what stops it. A route that aimed at a
  node centre would stand there for eighty ticks and open nothing.

### ⚠ The probe row is an avoid volume, and it is CONDITIONAL

A `BossLock` firing writes `Game.setPersistence(tag, false)` in whatever
level the walk happens to be passing through — a silent ledger entry rather
than a stall — so the row is priced as an avoid volume. Two things about it
are new:

**It is a `line`, not a rect** — the ladder's third volume shape.
`World.collideLine` at precision 1 is `while (x < toX)` with the end-point
check skipped, so the probes are the ten integer points
`oel.x+2 .. oel.x+11` at `oel.y+17`, not the 10×1 rect enclosing them. That
is not a fussy distinction: R3's committed L12 route passes
`bosslock@416,240`'s row at `y = 259.38` with the row at `y = 257`, which a
rect test calls a hit and the game does not.

**And it is the only CONDITIONAL volume on the map.** `BossLock.update`'s
gate is `p && Player.hasKey(keyType)`, so the row is inert to a walk that
does not hold the key — and R1, R2 and R3 hold none. Priced unconditionally
live (the `shieldlock` treatment) it moved three rungs of committed routes.
The shieldlock's own docblock calls a mid-route volume *"a policy the planner
has no vocabulary for"*; at R4 that stopped being true, because `planNow`
threads the run's inventory and key set. **All 21 committed R1/R2/R3 tapes
re-synthesize byte-identically.**

### ⛔ Two rulings the ROUTE overturned

Both were made from true premises, and in both cases what the premises did
not say is what mattered.

**1. `noHazards: ["water"]` is not an R4 state either.** §9 armed waterfall
on two true sentences: `checkDrowning` tests `eff == 1` only, so a waterfall
cannot drown you; and the R3 walk really does stand on one for 71 ticks.
Neither says a waterfall can be **CLIMBED**. `Player.input()`'s last act is

```
if (onWaterfall && (!hasFeather || v.y >= 0)) v.y += 0.8;
```

and the water move speed is below 0.8. The shipped physics, asked directly:
a featherless player entering level 0's band from below and holding UP for
400 ticks reaches **y = 125.98 and stalls**, fourteen pixels short of
clearing it; with the feather, y = 66.73. And **level 0's band is the only
connection between the half the game boots in and the half everything else
is behind** — a directed flood from the boot with climbs forbidden reaches
670 of 782 cells and none of the north doors, and deleting those doors from
the whole-map graph leaves **12 nodes across 11 levels and one item**.

So arming waterfall is circular in the same shape water is, one item along:
water needs the conch needs fire needs BobBoss; waterfall needs the feather,
and under this rung's clear bill the only path to the feather crosses a
waterfall. It retires at the rung that reaches L89 another way — `L90@48,96`
and `L91@16,144` both open into it, both behind openers R5 builds.

`climbsArmedWaterfall` is built and pinned anyway: **the ladder's only
DIRECTED edge rule.** It refuses an upward STEP rather than a cell, because
refusing the cell is what cut the map to twelve nodes — a waterfall is
something a route crosses downward all the time.

**2. The claim is FIVE items, not six: `darkshield` left too.** Armed lava
leaves the map with **two terminal branches, and a walk can only end in
one**:

- `darkshield` (L74) sits inside `{71:0, 72, 73, 74, 75, 80}` — strongly
  connected, entered ONLY through L71's button lock, which a player can walk
  through northward alone (the button is south of it and there is none on
  the far side). R3 left that set two ways and armed lava closes both: the
  pit at (12,13) to L82 sits in L71's component 3, which no reachable
  component touches, and the east door — reachable, since the walk would be
  holding the shield that opens its lock — leads to an L76 ↔ L77 pair that
  stops at L78's lava. **Swept**: every single clear the map offers for
  those eleven levels, one at a time and all at once. None escapes.
- `health` (L68) is terminal for its own reason. The walk enters L63 at
  component 1 and pushes the block east onto (8,6)'s pit, which destroys it
  and merges component 3 in; the return from L65 arrives INTO component 3
  with the block **rebuilt** — a `PushableBlockFire` has no persistence at
  all — and from there the only legal push is WEST, which lands on floor and
  opens nothing.

The rung takes the one it is FOR. Five items with a positive `hitsMax` is a
smaller claim than six and a strictly stronger one than R3's, because every
tile the walk crosses is one the game really has.

### The clear bill: eight, and it moves in BOTH directions

R3 declared ten. R4 declares eight, and the movement is the rung: armed lava
is a different map, so R3's bill is a fact about a level set this walk does
not cross.

```
OFF (3)   L12 tag 7, L12 tag 12    the route no longer threads either corridor
          L71 tag 0                the walk never enters L71 at all
ON  (1)   L68 tag 1                the magicallock sharing a cell with the
                                   bosslock the walk opens by hand
```

⚠ **`L12 tag 12` coming off is worth reading twice.** It is a keyType-4
bosslock, and from L67 onward the walk is CARRYING that key. It is neither
declared nor earned: the route simply has no errand at (32,864), and its
probe row is an avoid volume the planner routes around *precisely because*
the walk holds the key.

⚠⚠ **And the one-out sweep lied three times**, exactly as R3's did. Twice
because it asks a REACHABILITY GRAPH and the claim is a WALK — `L3 tag 0`,
where the driver's own A\* finds no path across L3 at any clearance, and
`L11 tag 0`, where the CONTROLLER's overshoot clips a chest. And once for a
reason of its own: it reported `L68 tag 1` NOT REQUIRED, because the health
approach inside a level the walk itself changed is computed by a helper that
asks *"is there a standable cell beside the pickup"* rather than *"can the
stance walk to it"*. `bosslock@16,32` and `magicallock@16,32` SHARE a cell,
so dropping it opens one of two locks and stands in front of the other. The
planner asks the second question explicitly now; all eight survivors were
then re-swept and every one is required.

### The two EARNED clears, and why one of them is not an errand

`grants` empty is R3's line. R4's ledger adds a second EARNED origin, and
the two are different mechanisms:

- **`{68, 0}`** — `BossLock`'s fade completing, 80 ticks after the key
  stance. An errand.
- **`{65, 2}`** — `lightpole@176,120`, TOGGLED by the third L65 push, which
  nobody aimed at. ⛔ **It is not a choice.** The block sits at tile (10,7)
  (x 176..192) and the pole's press box is x [179,189) over the SAME rows,
  so any rect that reaches the block's column from the east spans the
  pole's, and any rect whose y band meets the block's meets the pole's. A
  sword cannot substitute — the push needs reach 2 through a solid, which
  only the spear has. Ruled MODELLED rather than refused, so the bill gains
  an earned entry instead of a declared one.

⚠ **The pole entry is derived from the FINAL STATE, never from a count of
hits.** `LightPole.hit()` toggles behind a 25-tick `hitsTimer`, so an even
number of presses leaves the flag exactly as it started; an accounting that
counted presses would report a clear the game does not have. There is a test
that presses the same pole twice and asserts the ledger stays empty.

### ⚠ The boss key writes NO persistence, and the ledger says so

`BossKey.removed()` is `Player.hasKeySet(keyType, true)` and it does **not**
call `super.removed()` — so it is the one pickup on the ladder that turns no
flag off. **Six pickups are taken and five flags go off.** That asymmetry is
asserted on its own, because an exact-set claim pins it and a count would
paper over it. Its `text` is set only under `keyType == 0`
(`BossKey.as:24-27`), so L67's keyType-4 key is the ladder's second textless
ceremony: `pick_up()` spawns no NPC, phase A runs, and the pickup resolves
itself after 150 frozen frames with no dialogue at all.

⚠ **A key is NOT inheritable through a boot grant**, deliberately — there is
no channel for `Main.SAVE_FILE.data.hasKey` and adding one would need its own
AS3 side. So the key and the lock it opens must be in the SAME segment, and
`assertRouteWellFormed` refuses a boundary between them.

### The two new leg verbs, and the one that costs no ticks

- **`keylock: {lock: {x, y}}`** — the fifth verb. Four checks in the
  `runSpear` shape: the STANCE (the box really contains one of the row's
  integer probes, asked of the world's own geometry), the KEY (before the
  wait, not after), the POSITIVE CONTROL (the lock is solid now), and the
  EFFECT (`openActivators` has it and `keyOpens` names the flag).
- **`equip: {slot}`** — costs the tape NO TICKS: one write to `Main.primary`
  at the tick the run has reached. It is a leg target rather than a tape
  field because the headline **collects** the spear, so the tick at which the
  slot becomes selectable is a fact SYNTHESIS produces. `equips` is emitted
  as a MEASUREMENT of what the run fired; a declared equip that never fires
  is a named failure.

### Three things the route found that the primitives did not have

**The face nudge.** `sprites()` derives `direction` from VELOCITY, sticky at
rest — so the facing a press captures is the way the player was last MOVING.
The bang-bang controller OVERSHOOTS its waypoint and corrects back, so the
last tick with velocity points the wrong way even when the whole approach was
along the push axis: L67's push arrived at (180.045, 116.519) facing E, one
twentieth of a pixel past the aim point. `runSpear` taps the facing key for
ONE tick, lets friction stop the player where `direction` sticks, and
re-checks the landing position against the geometry. A tap that cannot turn
them is still a named failure.

**`to: null` is a declaration.** Three of the five pushes land on a pit and
destroy the block, which is what turns a push into a removal. The wait for
one is 60 ticks and not 40: 32 of glide, then an eleven-frame fade before
`FP.world.remove` lands.

**A textless ceremony begins and ends inside one `advance`**, so
`inCeremony` is never observed true — and `runCollect`'s approach loop walked
on top of `bosskey@48,64` for its whole 1,500-tick budget before the loop
grew its second exit condition.

**And the final segment must not strip its last leg.** The shared-boundary
rule — segment N ends by ARRIVING in the boundary leg, N+1 boots there and
does its work — is right for every boundary but the last. Three rungs never
saw it because R1, R2 and R3 all ended on an empty tail hop; R4's last leg is
the boss lock and health.

### ⛔ THE BYTE BUDGET, measured

`r4-walk-full` is **1,130 spans / 79.1 KB** against 1,800 / 90 KB — 88% of
the byte ceiling and 63% of the span one. §11.4 priced the rung at ~95 KB
against 90 before the route existed; what closed the gap is the route being
SHORTER than the one that was priced (no L71 cluster, no Dungeon 7 tail), not
the plan being denser. No span diet, no chunk-parse AS3 batch, no
claim-shape change. `frontend/modules/seedlingDemo/fixtures/regenerate-r4-tapes.mjs` prints the measurement for
every tape whether or not it is over, because *how much headroom is left* is
the fact the next rung needs and a silent pass does not carry it.

The six segments PARTITION the headline exactly:
`641 + 1473 + 1964 + 1354 + 1571 + 3049 = 10,052`.

## What R4 hands on, and what still blocks a full walk

The ladder is subtractive, so "what's next" is a list of what still blocks a
full walk rather than a list of features. R4 took the floor back: lava and
ice are the game's, and the only coercions left are **water and waterfall**.

**⚠ THE TWO REMAINING COERCIONS ARE ONE CHAIN, and pricing them separately
is the mistake to avoid.** Every entry below marked ⛓ is on it:

```
BobBoss  →  fire  →  the conch  →  canSwim  →  water uncoerced
                          ↑
                     the feather is behind level 0's waterfall band,
                     so waterfall retires only when L89 is reachable
                     from L90 or L91 instead
```

One combat encounter retires three items and one coercion; nothing below it
retires alone.

### The items, and the ONE thing that seals each

| item | seal | rung |
|---|---|---|
| **darkshield** | ⚠ NOT sealed at source — sealed by the CHOICE armed lava forces. L74 is inside a terminal set whose only exit needs `darksuit`. It and `darksuit` retire together. | R5 |
| **darksuit** | L79 is behind L78's lava, and lava is what `darksuit` itself survives. The classic bootstrap: the R3 walk reached it only because the coercion was on. | R5 |
| **shield** | L20's `shield@112,48` is in the level's other component, behind `lock@32,80` (tset 0, so no clear despawns it) whose only presser is walled in behind a `shieldlocknorm`; the other entrance is L19, which the census cannot build (`shieldboss@80,32`). No clear list on the map unseals it. | R5 |
| **fire** ⛓ | dropped by BobBoss on death — combat-gated by construction, and the root of the chain. | R5 |
| **conch** ⛓ | `Karlore.added()` removes him ONLY on `Player.hasFire`; talking does not despawn him and his tag is -1, so no clear reaches him. | R5 |
| **wand** | `Wand.update` gates the whole pickup on `hasAllTotemParts()` — five totem parts in L39-L42, and L40 alone holds 22 enemies. | R5 |
| **darksword** | `Witch.doneTalking()` requires `Main.hasWand`, and no `darksword` placement exists anywhere in the extract — she is its only source. | R5 |
| **ghostsword** | behind Dungeon 4; and `genericHit`'s ghost arm routes a SLASH through the Spear branch and doubles the rect height from the sprite WIDTH, which `levelRun.applyThrust` refuses by name rather than approximating. | R5 |
| **firewand** | the wand plus fire, so it inherits both seals at once. | R5 |

### The coercions

- **water** ⛓ — `canSwim` IS the conch. And `drownTimer` is never reset
  off-hazard, so the whole-run budget without it is ELEVEN CUMULATIVE ticks
  and then `die()`.
- **waterfall** ⛓ — needs the feather, which is behind the only waterfall
  band on the critical path (see the R4 section). Retires when L89 is
  reachable from `L90@48,96` or `L91@16,144` instead of from L0's north
  door. `climbsArmedWaterfall` is already built and pinned, so the rung that
  gets there has the rule on tick one.

### The mechanics R4 did NOT build

- **A SWING primitive.** R4 presses X and models what the rect contains, but
  every press it makes is a spear THRUST at a declared target. `L3 tag 0`
  (`breakablerock@96,112`) is one `PRESS_ARM_POLICY` entry and one swing at a
  stance away from being earned rather than declared — what it still needs is
  a stance in an enemy-free room, which is R5's combat budget.
- **The BRIDGE, on a route.** `bridges.js`, the `spear: {bridge}` verb and
  the 64 px on-screen policy all ship and are unit-tested against
  `probe-seedling-bridge.mjs`'s measured numbers (press at 25, pin breaks at
  85). **The R4 route does not use one**: L63's bridge at (2,9) joins
  components 1 and 5, and the walk needs neither — the push opens the door
  directly on the way down, and there is no way back. So the bridge mechanic
  has unit witnesses and no live one, which is stated here rather than left
  to be discovered.
- **`darkshield` as a KEY.** R3 collected it to touch L71's shield lock,
  which was the only way to `darksuit`. With the suit off the claim that
  touch has no errand, so R4 opens no shield lock at all — `runTouch` keeps
  its R3 recordings and gains no new ones.

### The debts R4 leaves

- **`saw_auto_advance` is honest for v4 and bug-compatible below it.** The
  counter now counts a Help's ARRIVAL, gated on `tape_version >= 4` so the
  fifty committed v≤3 recordings stayed byte-inert. For a v≤3 tape it still
  means "no NPC dialogue was auto-advanced" rather than "no auto-advance
  fired". Unifying the two means re-recording those fifty.
- **`inventory` is threaded into the planner and `hasDarkSuit` is still
  vacuous.** The lethal-terrain policy gates on the item; R4 holds neither
  the suit nor the conch, so both arms are dead. Witness: R5's first
  suit-holding leg.
- **`die()` is unmodelled**, and the floor policy is what keeps it
  unreachable. `probe-seedling-l65.mjs` measured the signature — an in-place
  respawn at the current world's BOOT tile and ~18 dead frames, with the tape
  still running — so a run that hits it is diagnosable, not silent.
- **Enemies are not in a block's obstacle list on this side.** A
  `PushableBlockFire`'s own solids include `"Enemy"`, and the world carries
  none because they do not stop the PLAYER. Every push whose destination
  holds an enemy SPAWN is flagged by the sweep; a mobile enemy elsewhere is a
  live-probe question. R5 owns it.

## What R2 handed on (HISTORICAL — R2's own list, kept for its findings)

⚠ Superseded by the R4 list above; kept because its four findings are still
live facts about the map. R1 walked the whole reachable map with three
crutches on; **R2 took the first one away — `noclip` off, solids back.**

- **R3 inherits three debts, and R2 made the third urgent.** `bosstotem` prices to
  an evidenced INERT only because R0's grants are property writes, so L43's
  Wand pickup is never removed and `classCount(Wand) <= 0` never fires —
  real collection changes that. And **a Bridge is a Solid** only because R1
  presses no attack key: `bridgeOpeningTimer` is decremented in exactly one
  place, `Player.as:1098`, under `t == "Spear"`. Both classifications are
  true of a rung, not of the game. **R2 found three bridges ON the route** —
  L61 (10,13) and (11,13), and L63 (2,9) — and L63's is what seals the
  health room, so the Bridge debt is no longer theoretical.
- **A new inventory-conditional blocker, the only one of its shape.**
  `Karlore.added()` removes itself iff `Player.hasFire` — so L48's
  one-tile corridor, and the conch behind it, is gated on an item R5 owns.
  Same shape as `ShieldLock`'s conditional volume, opposite sign.
- **`darksword` remains the one true item→item dependency**: the Witch
  (L12) grants it from `doneTalking()` under `hasWand && !hasDarkSword`, so
  at R3 it stops being a grant and becomes a KEY PRESS.
- Also true, and unpleasant to discover later: **49 of level 0's 152
  box-fitting tiles are unreachable from the spawn** — the north field
  behind the building, the east corridor, the west sliver. Any coverage
  claim about "level 0" should say which 103 tiles it means.

## Two transcription lessons worth generalising

**A tag missing from a table while its twin is present.**
`levelWorld.ENTITY_CLASSES` carried `stairsdown` but not `stairsup`. They
are the same class and the same trigger — `Game.as:2167-2168` differ only in
`Stairs`' third argument, and `_up` picks a sprite frame, a sound index and
a render flag, so the `super(...)` call is byte-identical. The extract holds
**280** triggers (teleporter 228, stairsdown 26, stairsup 26), not the 254 a
census had counted, so `buildLevelWorld` threw on 26 levels and a ping-pong
scan missed a fourth pair. Loud rather than silent, so nothing was ever
*wrong* — but the next slice would have hit it immediately. **The guard is a
census WIDER than the fixture levels**: every `teleporter`/`stairs*` tag in
all 116 levels must be a classified trigger, because triggers define the
LEVEL GRAPH, and a missing one there is not a loud throw somewhere useful —
it is an exit that silently does not exist until something tries to stand on
it.

**An offset applied at one level of a constructor chain but not the next.**
`Statue` is the only class in the table that adds an offset on top of NPC's
own constructor: `Statue` passes `(_x + Tile.w, _y - Tile.h/2 + ...)`
(+16, −8) and `NPC` then adds its own (+8, +8). The transcription applied
the first and stopped, putting level 0's statue collider 8 px up and left.
Nothing found it for two slices; the first `thread-the-gap` recording did,
when the game pinned x at **181.17065141119556** against a left edge at 184
the model did not have while the JS strolled through. Two things to carry:
the slice that introduced it noted the statue "sits far from any fixture
route", which was true of the v1 routes — **"unobservable" decays the moment
the driver gets better**; and with the route now planned *around* the
statue, no synthesized fixture touches it, which is why `statue-press`
exists (a planned approach plus a hand-authored 40-tick press into the edge;
the press tile is not even a legal A\* goal, so it could not have been
synthesized). Settled in passing: the statue's `setHitbox` comes from
`render()`, and unlike the Tile type flip that is NOT a first-tick subtlety
— `render` is driven by the Engine independently of `Game.update`'s
`blackCover` gate, so the fade frames have all rendered before tick 0.

## Dead ends, recorded so nobody re-chases them

- **A black canvas means nothing here.** The untouched teleport page also
  reads 0% non-black under headless WebGPU; it is the readback, not the
  game.
- **`A valid external Instance reference no longer exists`**, repeated every
  frame, is just an unconfigured `BridgeGeneric`. It appears in the teleport
  build too and is unrelated to whether the game is ticking.
- **A fixed replay timeout looks exactly like a dead bot.** At ~0.5 fps the
  `blackCover` fade alone outlasts a 60s deadline, which is how the first
  run presented and where most of the diagnosis time went. Deadlines scale
  with tape length.
- **The world clamp is unreachable in level 0.** The original `clamp-left`
  fixture walked far enough left that the game loaded an adjacent level —
  the recording showed `level=94` at tick 61 — so it was silently testing
  room transitions. It was replaced by `shuffle-stop`; the clamp keeps its
  hand-derived unit case. The `level` field in the observation stream is
  what caught this, which is why v1 carries it.
- **Cutscenes are already skipped**, and not by accident: the intro cutscene
  fires only from the `level < 0` branch (`Game.as:765-773`), and the
  cherry-picked teleport boot passes an explicit level 0. The bot reports
  `receive_input`/`saw_input_refused` in `botStatus` rather than stalling,
  so a cutscene that *did* fire would be named rather than silent.
- **`Tree`'s private `solids` list is DEAD CODE** — `Tree extends Entity`
  (not `Mobile`), is `active = false`, and the identifier is used nowhere in
  the file. It is vestigial, not an override.
- **`Moonrock` does not block**, `Torch` and `Orb` never assign a type at
  all, and **a tagged, non-inverted teleporter is DEACTIVATED on a fresh
  boot** (`tag >= 0 && (!checkPersistence(tag) == invert)`: every
  persistence flag is `true`, so `!checkPersistence` is false and
  `invert == false` deactivates it). Counter-intuitive, and a second reason
  fixtures stay off tagged teleporters — level 0's are all `tag = -1`.
- **`getStatePos` (`Player.as:670-678`) is a different function** — no
  intersect gate, returns −1. Do not conflate it with `getState`.
- **Tile constructors call `Math.random()`** for animation offsets. Cosmetic;
  there is no movement RNG at this rung. Do not model it.
- **`nearestToPoint` ties resolve by entity-list order.** If a fixture ever
  lands on an equidistant pair, move the fixture rather than transcribing
  FlashPunk's list order.

## R5 slice 2: combat is a role, and five things the source was misread on

Standing contracts added while the ENEMIES rung's census landed. Full
as-built in the R5 kickoff §11; what a later reader needs is here.

### The `combat` role is OPT-IN, and `buildLevelWorld`'s default is not `ROLES`

`ROLES` is now five (`blocking`, `trigger`, `pickup`, `proximity-hazard`,
`combat`), but the DEFAULT is `PRE_R5_ROLES` — the four. Every fixture R0
through R4 recorded with `noDamage: true`, where the guard is real and the
game honoured it, so a walk that ignores combat is not wrong; defaulting the
role on would throw on four committed route files to satisfy a table.

`ENTITY_TABLE_ROLES` names the four an `ENTITY_CLASSES` entry's own `roles`
field answers for. **`combat` is deliberately not one of them**: the combat
answer lives in `combat.js`'s tables, and putting it in that list would have a
hundred scenery entries silently CLAIM an answer none of them has.

A world built without the role reports `world.combat === null` — never an
empty census, because an empty list reads as "nothing here can hurt you".

### ⛔ `ENTITY_CLASSES`' `dx`/`dy` is NOT an entity's constructed position

It is one only for `collider: 'rect'` entries. A `pixelmask` entry's `dx`/`dy`
is the MASK's top-left (`tentaclebeast` is `1/2` there and `+24/+24` as an
entity), and a `notSolid(...)`/`cheapOnly(...)` entry — **seventeen of the
thirty-two combat tags** — has none at all, because "does it block" never
needed one.

`combat.js` owns `ctor: {dx, dy, src}` per row, transcribed from each class's
own constructor CHAIN — and the offset is the PARENT's for `bulb`,
`lavarunner`, `flyer` (via `Bob`) and `darktrap` (via `SandTrap`). A missing
offset is a THROW; `levelWorld.combatPlacementOf` is the cross-check and
returns null where the two tables answer different questions.

### ⛔ `Enemy.update`'s off-screen return does not freeze the subclass

`Bob.update` is `super.update(); …chase…`, so an off-screen chaser still runs
its chase block and still accumulates velocity toward the player. What the
early return skips is `mobileUpdate` (friction, `moveX`/`moveY`), the terrain
switch, `hitUpdate` and `hitPlayer`. **Off-screen means cannot move and cannot
damage** — which is what a contact-freedom envelope needs — but it is not
"frozen", and the i-frame timer does not run down out there either.

### ⛔ `Game.view()`'s round is a DEAD ZONE, and the camera never settles

`view()` rounds `FP.camera` ITSELF and the next frame's lerp compounds on the
rounded value, so a gap under 5 px gives `gap/10 < 0.5` and never closes. A
level load leaves the camera permanently 2 px from its follow target (the
inventory term is `Inventory.width/2 + Inventory.offset.x/2` = `33 - 35` =
−2), so a standing player's camera is the **loadlevel SNAP**, not the follow
position. `view()` also runs on DEAD FRAMES — only `super.update()` is inside
the `blackCover` gate.

### ⛔ The beam tower's FIRING is animation-clocked, not `Game.time`-clocked

`(sprBeamTower.frame - 1) % 2 == 1` is the damage gate — a Spritemap stepped
in `Spritemap.update` from `World.update`, which `Game.update` runs INSIDE the
`blackCover <= 0` gate. **Dead frames do not advance it**; the cycle is exact
in LIVE ticks (`1 / (10 * speed * 0.0333)` ≈ `3 / speed` ticks per frame,
beaming on every other one). The `Game.worldFrame` call at `:102` is
`y += 0.3 * sin(...)` — a POSITION bob, `+=`, so the tower's y is a running
sum peaking 8.606 px low and returning to zero every 90 ticks.

This is the same correction the R5 recon already made once for `ArrowTrap`
(whose `worldFrame` call is in `render()`). **The genuinely worldFrame-coupled
family is ONE class: `LavaChain`.**

### ⛓ `FP.elapsed` is a CONSTANT for this bot — `Engine.as:162` clamps at 30 fps

`FP.elapsed = min((t - last)/1000, MAX_ELAPSED)` with `MAX_ELAPSED = 0.0333`.
The bot runs at ~24 ticks/s on `--win` and ~0.4 fps on SwiftShader, so both
clamp and every recording this arc has made stepped animations at exactly
0.0333. That is why R3's and R4's press fixtures reconciled bit-exact across a
50x frame-rate difference. ⚠ It is a fact about the REGIME: a browser above
30 fps would step animations differently.

### ⛔⛔ `Music.soundPosition` is NOT clamped, and the swim term IS live

`Player.as:530` adds `0.25 * int(Music.soundPosition("Swim") < 0.1)` to the
move speed — 100 REAL MILLISECONDS against a frame count, through
`SoundChannel.position`, which in a graphics build is the live Web Audio mixer
clock. Measured, not inferred: the same tape at 0.4 fps and at 10.1 fps
**diverges at tick 52**, four ticks after the water edge, with the SLOW run
ahead.

⇒ **Any span in which the player is `inWater` or `inLava` is not reproducible
across frame rates.** It touches none of the frozen fixtures (all coerce
water) and no lava span (`drownTimer` is 0 on every recording). Two runs at
the SAME frame rate cannot see it — they cross the threshold at the same tick
and come back identical.

### The director's bridge boundaries are RE-BOOTS

R4's segments end with keys held, so the player drifts, so `atBootPosition()`
fails, so `botStart` REBUILDS the world at the tape's declared boot args — and
the drift is erased. That is why the six streams are byte-identical, and it is
why the bridge demonstrates the INHERITANCE claim (items and ledger survive
with no grant and no clear list) rather than the stronger "zero re-boots"
one. A window that really continues needs the SAME boot args as the world it
is continuing in, and then `dead_frames` on it is 0.

### ⛓ …and R9 slice 2 made the PAGE a director (the same lineage, one page on)

R5's director drove N windows on ONE page from a Windows Playwright script, and
`seedlingDemo/director.js` was its model — with no imports of its own so a
browser could load it, and nothing in `frontend/` ever importing it. R9 slice 2
is the page doing it: `?tapes=a,b,c` on `watch.html`, both engines, the windows
stepping ONE live run with no reload. The rules are that module's, imported. See
the R9 § below.

### ⚖ R5 slice 2 ruling: ZERO BUILDS IS OVER

The user ruled §6.5 and §6.6 at slice 2's close (kickoff §13). **One AS3 batch
opens, and it is the first thing R5's slice 3 does**: a frame-clocked
`soundPosition` (PIN — it makes the swim term a function of the tick count
instead of the Web Audio clock), `blackCover` decaying per UPDATE (PIN — the
dead-frame count stops varying, so `k` goes to 0), plus `Game.time`,
`hits`/`hitsTimer`/`frozenTimer` readouts in `botStatus` and the
`saw_auto_advance` unification.

⇒ **"The wasm artifact hash at rung close equals R4's" is RETIRED as an
assertable fact.** What replaces it is the R0 gate, which was always the price
of admission and is stronger: **all 57 frozen fixtures byte-inert under the
rebuilt artifact**, re-run before anything else is armed. Every flag stays OFF
BY DEFAULT so the fixtures exercise the vanilla path.

⚠ `k = 2` (R5 §8.8) becomes a HISTORICAL measurement — what the game did
before the pin. The jitter bands it prices collapse once the pin is in, and
the `phase-band` verdict `hazards.js` gives `LavaChain` retires with them.

## R5 slice 3: the AS3 batch, and what a press actually hits

The batch shipped (fork `bot` @ `ba94103`). Everything below is a standing
contract; the rung-local narrative is the kickoff's §14.

### The five changes, and their classifications

| change | class | where |
|---|---|---|
| frame-clocked sound mixer | **PIN** | `Music.pinStep` etc., `Bot.pinSoundClock` |
| `blackCover` decays per UPDATE | **PIN** | `Game.stepBlackCover`, `Bot.pinDeadFrames` |
| `Game.time` in `botStatus` | READOUT | `game_time` |
| `hits` / `hitsTimer` / `frozenTimer` | READOUT | `hits`, `hits_timer`, `frozen_timer` |
| `saw_auto_advance` unification | (R3's open item) | scoped to a v5 tape |

Both pins are OFF BY DEFAULT and are turned on by a **version-5 tape's
`pins: [...]`** — an array of names, the `noHazards` shape, so the next pin
that gets ruled in costs no pipeline run. Value-scoped, not
presence-scoped, like every field before it.

### ⛔ Pinning the sound POSITION alone would not have worked

`Player.as:530` reads `Music.soundPosition("Swim")` and `:531` REPLAYS the
sound once it finishes. Vanilla completion is `SOUND_COMPLETE` off the same
mixer clock, so a position-only pin leaves the RECURRENCE frame-rate
dependent and the swim inexact past `swim.mp3`'s own length. The pin models
the whole `Sfx` channel: play opens at 0, a step advances an open channel,
completion CLOSES AND ZEROES (`onComplete` writes `_position = 0`), and stop
closes with the position KEPT (`stop` writes `_position = _channel.position`).

It is uniform over every sound set rather than scoped to "Swim", because
`playSound`'s index draw advances the runtime's single global `Math.random`
LFSR — leaving the other sets on the wall clock would leave that stream, and
every downstream RNG-derived value, frame-rate dependent.

A zero `Sfx.length` is a NAMED FAULT that disarms the tape
(`Bot.pinFault`), never a fallback: a pinned channel with no length replays
every frame, which is not an execution the vanilla game can produce.
`botStatus.sound_pin` carries the measured frame length so the gate reads
the number rather than trusting it.

### ⛔ A completed, un-replayed Swim channel reads ZERO — so the boost latches

`Sfx.position` is `(_channel ? _channel.position : _position) / 1000` and
`onComplete` sets `_position = 0`. A Swim sound that finished and was NOT
replayed therefore reports position 0, which is `< 0.1`, which is a boost —
indefinitely. `Player.as:531` only replays while `v.length > 0`, so that is
the state a swimmer who stops moving ends up in, and the first stroke after
any pause is boosted because the position is read before the replay. **The
swim boost is not "six ticks per 47" for a stop-start swim.**

### What a sword press actually hits (`combatVerbs.js`)

1. **A press does not hit on its own tick.** `Player.update` calls `slash()`
   at :560 and reaches `input()` → `useItem` → `slashing = true` only at
   :575. First hit test is press + 1.
2. **The hit test then runs EVERY tick.** `slashDelayMax` is 0, so
   `slashDelay` guards nothing; `slashEnd` (the 5-frame animation's
   callback, which takes SIX ticks at `FP.elapsed` 0.0333) drops the flag.
   What stops a second hit on one enemy inside a press is the enemy's
   30-tick i-frame.
3. **The scale is ONE FRAME STALE and is not reset.** `Player.render`
   writes it after `update` and only `if (slashing)`, so `slashEnd` leaves
   the last value in place.
4. **The distance filter is not the rect.** The rect's own corners are
   16.97 px from the player against a 16 px reach, so a body in one overlaps
   the rect and is still not hit. Grass is measured centre-to-CENTRE and
   everything else point-to-BOX — two distances in one `if`.
5. **The LOS test has four exemptions**: `hasGhostSword`, `type == "Solid"`,
   `type == "Rope"`, `is Flyer`.

**The kill cadence is 31, not 21.** 21 is the DASH floor (a second press
inside `slashTimer` knocks the player along their own velocity); 31 is the
enemy i-frame one (`hitsTimerMax` 30). Different facts; the larger wins.
The ±1 (whether the enemy's `hitUpdate` runs before or after the player's
`slash()` on the hit tick is FlashPunk update-list order) is taken on the
conservative side.

**The ghost sword's rect is `width * 2` = 48 tall, from a 7-pixel-high
sprite.** Reading `height` for both arms shrinks the one item whose reach is
its reason to exist by 7x.

### Chasers: three per-class facts a census does not carry

- **The freeze gate differs BY CLASS.** `Bob.update` returns on
  `Game.freezeObjects`; `Jellyfish.update` does not test it. Both stop
  MOVING while frozen (that half is `Mobile.mobileUpdate`), but a frozen
  jellyfish keeps accumulating chase velocity.
- **Death is an ANIMATION and the body is still counted during it.** Both
  override `startDeath` to `play("die")` without setting `destroy`;
  `endAnim` does that on completion — 25 ticks for a bob, 35 for a
  jellyfish. `Game.totalEnemies()` counts entities, so a kill lock does not
  open on the killing blow.
- **The off-screen return does not stop the chase, but the velocity
  CONVERGES on `moveSpeed`.** The subclass block runs after
  `Enemy.update`'s off-screen return, so it accumulates with nothing to
  spend it on — but the impulse is `sign(toV.x - v.x) * moveSpeed`,
  bang-bang TOWARD the target, so the term is zero once it arrives. The
  camera's arrival releases one ordinary step, not a stored-up lurch.

### ⛔ A `Lock` takes 100 TICKS to open after the last kill

`Lock.checkEnemies` sets `activate` when `totalEnemies() == 0`, and then
`activationStep` decays the graphic's alpha by **0.01 per update** until it
reaches 0. Only `turnOff()` writes `type = ""` and
`Game.setPersistence(tag, false)`. So the ledger entry lands 100 ticks after
the fight ends — on top of the death animation the body is still counted
during. A kill window that stopped at the last press leaves the walk
pressing on a lock that was going to open.

### The continuation assert: dead frames are what a re-boot cannot hide

`director.continuationFindings`. A re-boot ERASES the drift that caused it
— `botStart` rebuilds at the tape's boot block and the next stream starts
exactly there, so every position check comes back clean. Dead frames do not
lie: a re-boot pays `blackCover`'s room fade and a continuation that stays
in one room pays none.

Asserted **only for a window that never leaves its room**. A window that
crosses a door pays a fade for the crossing, and separating that from
`botStart`'s needs a per-load constant the director has no business owning
— so such a window is reported UNASSERTED, never passed. A missing
`dead_frames` is a finding too.

---

## R5 slice 4: the chain — a key, a boss, an item that changes a level's build

Slice 4 walks from L29's boss key to `fire` and spends it. Three pairs were
recorded, all green; what follows is what the game corrected.

### ⛔ A `keyType`-1 key opens TWO locks between L29 and BobBoss

L31 is not a corridor. Its `stairsup@160,384` sits in a five-tile POCKET
whose only entrance is `bosslock@192,432` — a second `keyType 1` lock,
persistence tag 0. A flood from the L29 arrival reaches 103 tiles and the
pocket is not among them, so the ledger gains `{31,0}` AND `{30,2}` from one
key. A plan priced at one lock walks into a wall in the middle of L31 with
the key in hand and no verb aimed at it.

### ⛔ L32's pit exit is sealed by a burnable tree

`control@64,0` names `fallthrough = 30`, and both pit tiles it applies to are
covered exactly by `burnabletree@64,0`, a 32x32 `type = "Solid"` whose only
removal path is `hit("Fire")`. The fallen rock seals the stairs and the tree
seals the pit, so **`fire`'s first use on the whole arc is getting out of the
room it was won in.** `BurnableTree.removed()` writes `{32,0}`.

### ⛔ A keylock stance is a graze by construction, and its band is one pixel

`BossLock` walks a one-pixel line beneath itself and asks
`collideLine("Player", …)`. `(lock.x + 8, lock.y + TILE + 2)` is the stance,
and both edges are half a pixel away in opposite directions:

- `+2` **cannot be reached** — `Mobile.moveY` returns as soon as the next
  step would collide, so a drive from below stops at ~226.5 and the planner
  reports a blocked sweep. The stance is still right: a keylock stance IS a
  player pressed against a lock, so `allowGrazes` is the verb, not slack.
- `+3` **misses the probe row** — the drive lands within about half a pixel
  either way, and half a pixel low puts the box top a fifth of a pixel past
  the row. `collideLine` tests INTEGER points, so the lock never latches and
  the walk stands there for its whole window reporting nothing.

### ⛔ The rock's freeze is dead frames; a `BobBossNPC` dialogue's is not

`FallRockLarge` costs 174 frames (60 wait + 24 fall + 90 camera) and
`dead_frames` came back 195 — the boot fade plus exactly those. But a
dialogue is the R3 PHASE-B shape: the tape ticks while `Mobile.mobileUpdate`
refuses to move the player. **And `Bot.autoAdvance` is called from INSIDE the
dead-frame branch and nowhere else**, so a freeze the gate reads as live is a
freeze the bot never dismisses — the tape pages all fourteen pages itself, or
it stalls at the first one forever while reporting clean dead frames.

⛓ Which is what makes the BobBoss pair possible: `primary` is both the talk
key and the sword, and the game keeps them apart — a dialogue holds
`Game.freezeObjects`, which gates `Player.input()`, so a press inside one can
only PAGE and a press outside one can only SWING. One press train, two arms,
and `grants` decides what it does.

### ⛔ `Fire.removed()` writes a flag in a level the player is not in

`BobBoss.death` spawns `new Fire(…, -1)`; `Fire.removed()` calls
`setPersistence(-1, false)` unconditionally (its `check()` guard is
`tag >= 0 && …`); and `levelPersistenceSet(i, j)` writes `i * 30 + j`. From
L32 that is index **959** = `31 * 30 + 29` — **L31's last slot.** An exact-set
ledger has to name it or the walk reports a clear nobody can attribute.

Three more the source says and §2.6.1 does not: form 1's `hitsMax` is
`Enemy`'s default because its switch case sets none (2+3+2 is a MISSING
case); the boss cannot be knocked back at all (`super.hit(0, null, …)` — force
zero AND point null); and `player.hits = 0` is written by the boss on the last
frame of every transition, so only the terminal reading is evidence.

### ⛔ An item must be banked BEFORE the level is built

`Karlore.added()` reads `Player.hasFire` inside `new Game(48, …)`. So:

- a BOOT grant naming L48 is applied afterwards;
- a grant naming L48 on a walk that ENTERS L48 fires on the first observation
  whose level is 48 — also afterwards. ⚠ And `synthesizeLegs` emits the grant
  against the level its run banked the item in, so a two-leg plan produces
  exactly that silently.

Both takes ended with the two arms byte-identical, pinned at 290. The grant
has to name the level the walk boots into. **A boot is not an entry.**

⚠ And when checking a plug like this, the neighbour test is the wrong
question: tile (8,17) beside Karlore is OPEN. What makes the corridor one
tile wide is that (8,18) is solid, so the only way in is a diagonal through
the corner where a 4x5 player box overlaps both. Flood it.

### An encounter script needs a declared exemption, not a relaxation

The differential harness builds its expectation by running the tape through
the JS engine, and a scripted boss is not a mechanic the engine models.
`r5Chain.MODEL_EXEMPT` names, per fixture, the items the GAME earns and
whether it takes input over; the harness checks against `mirror + earned`,
which is HARDER than the unamended check (a run that fought and lost goes
red), and an unexercised exemption is itself a finding.

### ⛓ Water is modelled — and the reason it was not is not the one recorded

Type 1 was out of `MODELLED_TILE_TYPES` for "canSwim is the conch", which was
half of it. `checkDrowning`'s water arm, `WATER_FRICTION` and the speed table
all landed at R4. What was missing is the SOUND TERM: `Player.as:530` adds
`0.25 * int(Music.soundPosition("Swim") < 0.1)` off the Web Audio mixer's
WALL CLOCK. **Water was not untranscribed, it was NOT REPRODUCIBLE.**

`playerPhysicsV2.step` drives `swimBurst` from `swimSoundClock` in the game's
order — step the mixer (every frame, including dead ones), read, then replay
iff `v.length > 0 && !playing` — and REFUSES a wet tick on a tape that does
not pin `"sound"` rather than modelling the term as zero. `pins` is threaded
through `createLevelRun`, `runTape` and `synthesizeLegs`'s `relax`.

Three consequences worth knowing:

1. **Every tile type 0..37 is modelled now**, so `assertModelledTerrain` is a
   bounded vacuity over anything the extract can carry. The guard is kept for
   an out-of-table resolver value.
2. **The planner is unaffected** — R4's `lethal-terrain` policy already
   listed water with a `canSwim` exemption, so an armed tile went from
   refused-as-unmodelled to refused-as-lethal. (`describe()` needed the arm:
   the one diagnostic a planner failure produces read "lethal-terrain
   undefined".)
3. **R4 armed WATERFALL with the term hard-coded to zero.** `inWater` is
   `eff == 1 || eff == 25`, so a waterfall tick reads it too. It got away with
   it because no committed route stands on one — a real bound nobody had
   written down.

## R5 slice 4 steps 4–5: the water arms, and the two knobs ice broke

Kickoff §16 is the as-built. What follows is what a reader of this file
needs before touching water, ice, or a window schedule.

### ⛓ A level's GEOMETRY can depend on the inventory at construction

`Karlore.added()` is `if (Player.hasFire) FP.world.remove(this)`, and
`added()` runs inside `new Game(48, …)`. So `buildLevelWorld` takes an
`inventory` now, `levelWorld.ADDED_TIME_REMOVAL` is the table (one class,
by NAME and by citation), and `levelRun` hands each world the inventory it
holds at the instant it builds it — which is the instant the game
constructs its `Game`.

Three consequences worth keeping:

- **A boot grant lands AFTER `new Game`.** The boot world is built from an
  EMPTY inventory on purpose. *A boot is not an entry* (§15.8).
- **A memo keyed on the level alone LIES.** `new Game` re-runs every
  `added()` on every visit, so a level entered twice with different items
  is built twice and differently. `addedTimeKey` is what the memo compares,
  and it is cashed on the TRANSITION path only — mid-visit is the one time
  the game does NOT rebuild.
- ⛔ **`BobBoss` has Karlore's two lines verbatim and is a NO-OP.**
  `add(new BobBoss(…))` runs the ctor before `add`, so `_world` is null and
  `World.remove` returns immediately. The guard only skips the rest of the
  constructor. Modelling it as a removal would walk the model through a
  room the game still fills.

### ⛓ `nearestToPoint` ties are DECIDED now, not refused

`World.addType` PREPENDS and `nearestToPoint` keeps a candidate only on a
strict `dist < nearDist`, so the entity list is the reverse of the extract
and **a tie is won by the tile that appears LATER in it**. The old model
threw and told you to move the route; L47's own arrival from L46 is a tie
(snow against ice), and a route has no say in where a teleporter drops the
player.

⚠ The 59 committed recordings cannot corroborate this — 21 observations
differ in the assigned `state` and at all 21 the two types share a speed or
are coerced. They are a negative control. `r5-d5-conch` is the witness: it
stands on the tie with ice ARMED.

### ⛔ On ice, `tolerance` is a SEED and the 8-tick coast is 20x short

`DEFAULT_TOLERANCE` is 1.0 because a one-tick tap from rest travels 1.70 px
under ground friction. Ice replaces both terms (`slidingSpeed` 1,
`slidingFriction` 0.025) and the same tap travels ~19.5 px.

⚠ **Raising it is not monotone.** Over the D5 route: 1.0✗ 1.25✓ 1.5✗ 1.75✗
2.0✓ 2.2✓ 2.25✓ 2.4✗ 2.5✓ 3.0✓ 3.1✗ — and the failures land on different
waypoints in different levels. A tolerance decides where the controller
settles, which decides the state the next drive starts from. Pick a working
point, declare it, freeze it.

And `assertWindowEndsAtRest` reads SPANS, not physics: its 8 ticks are a
ground number. A `PICKUP_CEREMONY` freezes the player WITHOUT zeroing `v`,
so the approach's velocity resumes when the dialogue ends. Assert the
modelled terminal velocity is zero; do not trust the static check.

### ⛓ Armed water: the pair is a COUNTER, not a stream

`checkDrowning` does not touch movement until `drowning` latches at the
eleventh cumulative contact tick. So an armed-water pair one field apart in
`grants` produces **byte-identical observations**, and the whole evidence
is `drownTimer` — 0 against 4 for seven contact ticks.

That is why the harness's `drownTimer === 0` check needs a per-tape NAMED
declaration (`r5Swim.DROWN_EXPECTED`), two-sided: a declared arm that
reports 0 is a **RED**, because a drowning control that did not drown has
proved the water was still coerced or that the walk never reached it.

### ⛓ The swim boost LATCHES, and it is invisible to the readout

`Sfx.onComplete` zeroes `_position`, so a sound that finished and was not
replayed reads 0, which is `< 0.1`, which is a boost — indefinitely. And
`Player.as:531` gates the replay on `v.length > 0`, which a stopped swimmer
fails.

⚠ `botStatus.sound_pin` reports a COMPLETED channel as
`{playing:false, frames:0}` — identical to one that never played. **The
latch cannot be asserted from the readout.** Assert it from the MOVEMENT:
a mid-cycle swimming tick steps 0.450 and the first tick after a 90-tick
stop steps 0.700, and 0.250 is `Player.as:530`'s addend.

### ⛓ The crutch schedule, and what a boundary must NAME

`director.crutchScheduleFindings`: `noHazards` shrinks as items are earned,
every retirement must be justified by an item the GAME reports at the
boundary (and the finding NAMES it), every surviving coercion whose item is
already held is a finding, and no coercion may come back. Asked at
BOUNDARIES, because the window that earns an item holds it for its last few
ticks.

⛔ **A continuation window's boot block names where the ROOM was built, not
where the player is.** `atBootPosition()` compares `Main.playerPosition` —
the args the current `Game` was constructed with. A window continuing after
a pit fall names the fallthrough ctor; a boot naming the live position
would RE-BOOT.

⇒ and such a window cannot also be a differential fixture: replayed on a
fresh page it boots somewhere else. Author it inline in the trace, as
`--boundary-witness` does.

### ⛓ An armed waterfall: the refusal is the claim, so it needs an arm

`climbsArmedWaterfall` finally has a live witness, and it took BOTH arms —
"the feather-holder climbed" is equally consistent with a game where
nothing was pushing down. `r5-waterfall-shut` (conch only) reaches the
waterfall's face and STALLS there for 166 observations; `r5-waterfall-climb`
(one field apart) goes 116 px through it.

⚠ `noHazards` is EMPTY on both — the first tapes on the arc with no
coercion at all — because the tiles above and below the waterfall are
WATER, so both arms are swimmers.

⚠⚠ **The swim term is LIVE on a waterfall.** `inWater` is
`eff == 1 || eff == 25`, so a waterfall runs the water speed table AND the
`soundPosition("Swim")` boost. R4's recorded "3.33 px DOWN" for the
featherless arm was measured with that term at zero; under the real term
the same arm goes **24 px UP** before it stalls. The rule survives
(0.45 + 0.25 < 0.8); the number does not.

### ⛔ The feather is a ROUTING problem, and §2.6.3 priced it wrongly

`feather@160,96` is tile (10,6) in L89. East and west are solid; **above
and below are both WATERFALL tiles.** So the pocket is reachable only from
ABOVE, descending — and a directed flood with `canSwim` held and the
waterfall armed says 86 tiles / no feather from the L87 door against 112 /
feather from the L91 door. The upper doors are the ENTRANCE.

And the route to them is not open either: L91 ← L92 ← L87, but L87's L92
door at tile (1,2) is in a different connected component from the L44
arrival the D5 corridor uses (321 tiles with the conch, 149 without,
neither reaching it).

Every number is committed in `r5Swim.FEATHER_BLOCKER` with a test.

⛔⛔ **AND SLICE 5 RETIRED THE CONCLUSION.** The first paragraph survives —
the pocket really is entered only from above. The second is wrong twice
over, and both faults are worth carrying:

1. it was measured on a **tile-centre lattice**, which cannot see the
   half-tiles a `CliffSide` PIXELMASK leaves free;
2. and `plannerObstacleAt`'s third argument is an **INDEX** into
   `level.teleporters` while the test passed the teleporter **OBJECT**, so
   the exemption its own comment claims ("this is not the
   teleporter-volume policy reporting its own avoidance as a wall") never
   fired. It was exactly that.

`probe-seedling-r5-feather` reproduces every committed number with the
instrument that produced it, then disagrees at 8 px and at ONE PIXEL. See
the slice-5 section below.

---

## R5 slice 5: the feather, and the frames a mixer steps on

### ⛔ Neither lattice is the game — run the third arm

16 px cannot see a half-tile. 8 px cannot see a tile CENTRE: its four
probes sit at ±4, and the centre is not one of them. So the two lattices
disagree about L87, and only a flood at **ONE PIXEL** — the granularity
`Mobile.moveX/moveY` actually step — settles it. It is affordable: a
30x20 room is ~18 s.

⚠ And run the coarse arm anyway, as a CONTROL. Reproducing the committed
numbers with the instrument that produced them is what makes the fine
arm's disagreement a measurement rather than a new opinion.

### ⛓ The sixth press arm: `BreakableRock`

`hit(_t)` breaks when `rockType <= _t` and `Player.as:1071-1074` passes
`hasGhostSword ? 1 : 0` — so a PLAIN SWORD breaks every rock except the
`breakablerockghost` family. Three things a route has to know:

- **`hit()` removes nothing.** `endAnim` (the Spritemap completion
  callback, wired in the constructor) is what calls `FP.world.remove`, so
  the rock is Solid for the whole animation — SEVEN ticks, by simulating
  the `while (_timer >= 1)` loop rather than dividing (the closed form
  says six at a true 1/30, one ulp away).
- **`endAnim` writes persistence unconditionally.** The `tag >= 0` guard
  belongs to `check()`, not to it. For a `tag = -1` rock,
  `levelPersistenceSet` writes `level * 30 - 1` — **the previous level's
  tag 29**. `breakableRocks.outOfBandFlagFor` is that arithmetic, checked
  against `Fire.removed()`'s hard-coded {31,29}.
- **It comes back.** `check()` only removes a rock with `tag >= 0`, so a
  `-1` rock is rebuilt by every `new Game`. A break is PER VISIT.

### ⛔⛔ The swim channel is a MIXER, not a `Player` field

Two facts, and a fixture had to swim across a door before either could be
seen:

1. `arriveIn` builds a whole new `Player` — right for `terrain`,
   `direction` and `drownTimer`, and WRONG for the swim channel, because
   `Music`'s pinned channels are STATICS and survive the door.
2. `Bot.update` calls `Music.pinStep()` **above the armed check and above
   the dead-frame gate**, with its own comment: *"a mixer does not stop
   because the tape is between windows or because the room is fading."*

So the channel advances on frames the tape does not count: **20 per room
load** (`blackCover` 1 at −0.05, simulated in doubles — the twentieth
lands at −3.19e-16) and **150 per pickup ceremony**
(`Pickup.specialTimer`).

⚠ Carry it from the STEPPED tick (`next`), not from the pre-step `state`,
or the model lands exactly one frame behind.

⛓ The game confirms both constants by arithmetic: `r5-feather` reports
**231** fade frames = 21 (boot) + 3 × 20 (doors) + 150 (ceremony), and its
first recording — whose ceremony never fired — reported **81**.

### ⛔ A rise in pixels is not a crossing

`r5-feather-climb`'s first claim was `minRise: 32` and the live window rose
**31.70 px**. That is the CAP, not a near miss: the column above the
pocket is two tiles and then a tree. And the number was never the
discriminator — the refusing arm's 24.35 px stall is a DIFFERENT ROOM, so
comparing them compares two geometries. What a refusing arm can never do
is FINISH ABOVE THE ROW IT STALLS IN. Claim the crossing; demote the
distance to a sanity floor.

### ⛔ The totem entrance is a button, not three kills

L38 → L39 lands at tile (9,38); the `wandlock tset -1 tag 8` is at (9,37)
in a one-tile corridor; the three spinners whose deaths open it are thirty
tiles up on the far side of it. Four cells reachable, none of the three.

The opener is `L38 buttonroom@32,48 {tset: 8, flip: 1, room: 39}`:
`ButtonRoom.as:87-93` writes `Game.setPersistence(t, persist, room)` with
`t` the **TSET** and `flip` making a press write FALSE, so the lock is
deleted at BUILD time from the previous room. Behind it is a second gate,
`rope@96,384` (tag 9) — `RopeStart`, still a REFUSED press arm.

    4 cells / 0 spinners   nothing cleared
   56 cells / 0 spinners   {39,8}
  688 cells / 3 spinners   {39,8} + {39,9}

`probe-seedling-r5-totem-entrance` is the measurement.

## R5 slice 5 step 2: the totem entrance, and the gate behind the gate

### ⛓ A `ButtonRoom` write is a MODELLED write now, not a declared clear

`ButtonRoom.set activate` has two arms and the census carried neither:

```
  ButtonRoom.as:87-96
    var persist:Boolean = _active;              // true on a press
    if (flip) persist = !persist;               // -> FALSE
    if (room == -1) ...activate every Activator sharing t...
    else Game.setPersistence(t, persist, room); // ANOTHER LEVEL
    Game.setPersistence(tag, !activate);        // its own tag, here
```

Three things a route has to know, and each was a way to get it wrong:

- **`t` is the TSET, not the tag**, and for L38's `buttonroom@32,48` they
  are different numbers (8 and 4). The write lands on L39 tag **8** — the
  plug — and its own write on L38 tag **4**.
- **`flip` decides the SIGN**, and the source's comment is the authority:
  *"persist = false, then things won't exist"*. A `flip = 0` button writes
  **TRUE**, which is a real `setPersistence` call that puts nothing in
  `persistence_cleared`. `levelRun.roomWrites` records both values and only
  the `false` ones reach `earnedClears`.
- **The cross-room clear is cashed IMMEDIATELY.** `applyEarnedClears`
  defers a flag in the level the player is standing in, because dropping
  that memo mid-visit would despawn an entity the game keeps until the next
  `new Game`. A flag in a level the player is *not* in has no such
  constraint, and holding it back would leave a memoised world the game has
  already invalidated.

⚠ And the L37 → L38 arrival lands ON a second cross-room button
(`buttonroom@144,288 {t 4, tag 5, flip 1, room 37}` — R1 met it first), so
both arms of any L38 pair carry `{37,4}` and `{38,5}`. Declared, not
discovered: an exact-set assertion that omitted it goes red on a correct
walk.

### ⛔⛔ 688 was the room; the errand is the 44 cells above it

`probe-seedling-r5-totem-entrance` measured three rows and stopped one
short. `probe-seedling-r5-totem-shaft` adds the fourth:

```
    4 cells   arrival pocket, plug standing
   56 cells   {39,8} — the L38 button's write
  688 cells   ...and {39,9} — the rope pulled
  732 cells   ...and the three WandLocks open   <- totempart 2, and the L40 door
```

L39 is a shaft. Column 9 is the only route from the room to row 1, and rows
2, 3 and 4 of it are `wandlock {t 3, tag 0}`, `{t 4, tag 1}` and
`{t 5, tag 2}`. Above them are `totempart 2` and the **only** door into
L40–L43 — so the wand, and therefore the Witch's darksword, are behind it.

**They cannot be opened in sequence.** A `Lock` fades at 0.01 per tick
while its group is held and restores the moment the group goes quiet unless
something overlaps the lock itself. The three are vertically adjacent and
each button is five to seven tiles away, so stepping off one to reach the
next closes the first. And each lock-button is *under a cover* whose own
button is elsewhere: the room is six presses, not three.

### ⛔⛔ The holders are blocks, and the weapon is one this arc has never fired

L39 holds exactly three `PushableBlockFire`s for exactly three
lock-buttons. `pressedGroups`' docblock has said since R2 that the game's
`hitables` is `["Player", "Enemy", "Solid"]` and that "a pushed block holds
a button down too — and that is the intended solution to more than one
room". This is that room, three times over.

`PushableBlockFire.moveTypes` is `["Fire", "Pulse"]`. The sword passes
`"Sword"` and the ghostsword `"Spear"`; the one thing that passes `"Fire"`
is **`Player.as:1030` — `genericHit(e, "Fire", fireForce, fireDamage)`**, a
32x32 area around the player driven by `sprFire`'s animation frames.
`PRESS_ARM_POLICY.PushableBlockFire` has said `inert` since R2 and was
RIGHT — *for a sword*. It answers a different question from the one this
route asks.

⇒ Slice 4 earned `fire` and recorded that it "is never SPENT", because
Karlore's plug is removed at `added()` time. **This is where it is spent,
as a weapon, for the first time on the arc**, and it is the price of L40,
the wand and the darksword alike.

### The rope is an ARM, not a clear — and it is not built yet

`rope@96,384 {t 6, tag 9}` is 112 px of wall across the shaft
(`Mobile.solids` contains `"Rope"`), a press needs no weapon type and no
line of sight, and `hit()` **shrinks** the hitbox to one cell rather than
removing the entity — so a declared clear would open a tile the game keeps.
Its `set activate` publishes to group 6, which contains a `FallRock`, so
the R2 "a clear reaching a fallrock is refused by name" rule had to be
checked rather than assumed. It survives on two independent gates: the
rock's tag is **10** and nothing writes it, and its position-writing arm is
`activate && y >= fallTo` against a rock parked at `y = -16`. The `Pulser`
in the same group is not inert — the publication starts a 22 px damage ring
that was quiet before — which is why this is an arm taken at a chosen tick
rather than a clear declared at the boot.

The arm stays `refused` until the slice that can walk through it: shipping
a transcription no fixture exercises is how an unwitnessed model gets
believed.

### Two hygiene items the slice-5 findings earned

- **The `tag = -1` out-of-band writes are a FAMILY**, and it already has a
  third member: `Witch.doneTalking()` spawns `new DarkSword(p.x - 8,
  p.y - 8)` with the tag defaulted. `outOfBandLedger.js` derives the flag
  from the WRITING ENTITY against a registry that refuses an unclassified
  class. ⚠ The three are not the same shape — `Fire.removed()` and
  `BreakableRock.endAnim()` write unconditionally, but `DarkSword.removed()`
  writes only `if (Game.checkPersistence(tag))`, an out-of-band **READ** of
  the very slot it would clear. The item lands regardless; the ledger entry
  does not.
- **The cross-swap statics are audited** (`crossSwapStatics.js`), every
  candidate with its declaration line, every read site, and a construction
  guard that refuses an `inert` verdict with neither a citation nor a
  stated way of knowing there is no reader. Three mechanisms decide most of
  it: `Game`'s constructor calls `end()`, `begin()` calls `loadlevel()`,
  and several "statics" are instance vars. ⛔ **And there are two kinds of
  dead frame**: `blackCover > 0` skips `super.update()` entirely, while
  `Game.freezeObjects` does not — so a ceremony's 150 frames update every
  entity, and the classes with no freeze gate keep moving through them.
  ⛔ `Game.shake` is inert by a NUMBER, not by nature: a landing fallrock
  sets 30 while holding the freeze for `cameraTimerMax` = 90 more frames.
  L43's three fallrocks (step 4) have to re-check that against the L43
  census.

## R5 slice 7: fire has no aim, and three ledgers nobody was keeping

Slice 6 modelled the fire attack and solved L39's shaft in eighteen presses,
with a hand plan and a blind search agreeing on the trajectory. Slice 7 set
out to price that plan in ticks. It does not survive contact with the weapon,
and the four findings below are all things a route in any other room can hit.

### ⛔⛔ A solver whose move takes a TARGET has invented an aim

`Player.fire()` is a 32x32 rect centred on the player and `genericHit` runs
on **everything inside it**, each target `Math.atan2`-directed away from the
stance. The shaft solver's primitive was `pressOutcome(stance, blockKey, …)`
— it took the block being aimed at. Both halves of the "independent"
certificate shared it, so both were wrong the same way: two of the eighteen
presses have a second block in range and shove it, and the plan ends with
**two of three** lock-buttons held.

⚠ **Every one of its presses still "works".** Each moves something, so every
step reports green and only the END STATE is wrong — seventeen presses after
the cause. That is the general shape: when the game's effect is an AREA, a
radius, a splash or a group publish, the model's primitive has to take the
whole world and return **the exact set it changed**, and the leg verb has to
fail on *"you also moved something you did not name"* as loudly as on *"the
thing you named did not move"*.

⛓ **And the correction was an improvement.** Modelled properly, the
collateral is the room's intended solution: park the third block one tile
past its destination and a single press from the middle of the cross moves
**all three** onto all three lock-buttons, each on a pure axis — retiring the
`bothRange` diagonal special case the old plan hung on. The blind search,
re-run without the aim, returns the same eighteen.

### ⛔⛔ `Lock.turnOff()` writes persistence, and `returnToNormal()` writes it back

```
  turnOff():        if (type == normType) { …; Game.setPersistence(tag, false); }
  returnToNormal(): if (type == "")       { …; Game.setPersistence(tag, true);  }
```

`Bot.as`'s `persistence_cleared` is a **live scan** of `Main.levelPersistence`,
so both directions show up in the game's own ledger. No rung before this one
emitted either.

⚠ **Invisible rather than absent.** `l71-button-lock` and its three siblings
open `lock@112,160 {t 0, tag 3}` by holding a button — but their expectations
are `ticks` + `transitions` only, and the verifier's ledger check is
one-directional over touch locks. An exact-set ledger over a walk that opens
a plain Lock is red without this; over a walk that opens **and then closes**
one it is red with only the first half.

⛔ And `Lock`'s `_tag` defaults to `-1` **in the constructor** — a third route
into the out-of-band family after a runtime spawn (`Fire`) and authored map
data (`BreakableRock`). `Lock` and `RopeStart` are its fourth and fifth
members.

### ⛔ A rect with a null `right` never overlaps anything — on the PRODUCING side

`entityRect(cls, x, y)` reads `cls.w`. A node-terminated class (the `rope`
collider, whose width is `_xend - _x + 16` from its last `<node>`) has not got
one, so the press census built `{x, y, h, right: null, bottom}` — and no
overlap test can ever return true for it. The rope arm was therefore dead
**twice**: refused by policy and unreachable by geometry, and either alone
reads as "the audit is clean". The fix is one shared derivation
(`ropeSpanRect`) rather than two call sites that agree by accident.

### ⛔ A `room = -1` ButtonRoom writes its own tag AND latches its group

`ButtonRoom.as`'s `Game.setPersistence(tag, !activate)` sits **outside** the
`if (room == -1) … else …`, so a local-publish button writes its own flag
exactly as a cross-room one does. And the local arm assigns
`activate = persist` directly to every `Activators` sharing `t`, with the
whole setter behind `if (a)` and the author's own comment — *"Can't be reset
to false!!"*. **Walking over it once opens the group permanently**, which is a
third activation shape after the button's per-tick republication and the
touch/key latches.

That is the entire opening mechanic of Dungeon 4's big room, and it reaches a
`BossLock` — so a lock that looks like it needs a key opens without one.
Worth checking per room rather than assuming, in both directions.

## R5 slice 8: a bounded sweep, and the room in front of the room

Two things, and the second is the shape of a whole rung: a sweep that found a
second silent-geometry casualty, and a leg that turned out to be a puzzle.

### ⛔⛔ A `refused` arm is where a malformed rect hides

Slice 7 found the rope's press rect had a null `right`. Slice 8 asked how
many more there were, in two strata — because either alone reads as clean:

1. **the enumerated sites**: every inline `{x, y, right, bottom}` derivation
   that does not go through `levelWorld.rect()`, classified by hand with a
   verdict each. Ten of them.
2. **the live sweep**: build all 116 levels under all five roles and check
   every rect the census carries. 10,175 rects.

Stratum 2 found **eleven** the enumeration could not: the `Watcher`'s press
rect, four `NaN`s, in L12/32/37/**43**/57/69/82/89/94/103/114. Same shape as
the rope — `collider: 'none'`, no top-level box, only a `hazard` sub-object
that is the 48x48 auto-talk circle — and, like the rope, **`refused` by
policy**.

That is the generalisation worth keeping: **a `refused` arm is the one place
a malformed rect can never be caught by a route**, because no route ever
queries it. Policy and geometry cover for each other. Audit with a stratum
that does not care about policy, and make the producer loud: `entityRect`
now throws on a boxless class, `WATCHER_PRESS_BOX` is the transcription, and
`PRESS_BOX_OVERRIDES` is a table because there are two of these now.

⚠ **And the subtlest one was not malformed at all.** `chaseEnvelope`'s
`row.hitbox ?? {w:0,h:0,ox:0,oy:0}` keeps every rect FINITE — so no
`assertRect` could have caught it — by giving a body-less row a **zero-size
body**, after which the clearance is optimistic by half the real body on each
axis. A plausible number is harder to notice than a silent `false`. It is now
`assertEnvelopeBody`, deliberately **outside** its caller: every shipped row
satisfies it, so a test that went through `chaseEnvelope` could only ever
exercise the passing arm.

⚠ **An absence can be a claim, and then it has to be written down.**
`r5Acceptance.L60_LOCK.rect` is `{x, right}` with no `y` — an X BAND, because
the lock spans its corridor and all six uses are scalar comparisons. A sweep
has to tell that apart from a rect somebody half-built, so it carries a
`band:` field and a test asserting both the y-lessness and that
`rectsOverlap` against it answers false.

### ⛔⛔ L38 is two rooms, and the join is a five-link chain

The totem cluster's entrance was priced as three waypoints: boot, button,
door. **L38 is two disjoint components.** L37's door — the cluster's only way
in from outside — lands in the south room (205 lattice cells / 64 tiles);
`buttonroom@32,48` and `teleporter@144,0 -> L39` are both in the north one
(195 / 65), otherwise reached only from L39, which is reached only from here.
The floods share not one tile.

Row 7 is solid across all nineteen columns. The one join cell holds
`cover@144,112 {t 0}` and, **underneath it**, `chest@144,112` —
`type = "Solid"` in its constructor. Opening the cover does not open the
cell; it makes the chest *openable*, because `Chest.update`'s gate is
`!collide("Solid", x, y)`. `Chest.open()` sets `type = ""`, and that is the
passage — an entity state change no persistence flag can express, which is
why links 3, 4 and 5 all add **zero** to the flood.

```
  1  buttonroom@144,128 (9,8)   t2 room -1   self-latch  -> cover@208,224   +6
  2  buttonroom@208,224 (13,14) t2's cover hid it; t1 room -1 self-latch
                                             -> pulser@80,224 armed         +0
  3  the PULSE shoves pushableblockfire (5,13) -> (5,12)                    +0
  4  (5,12) IS button@80,192 {t 0} — a block presses a button
                                             -> cover@144,112 opens         +0
  5  Chest.open() sets type = ""                                    the passage
```

**Nobody can stand on `button@80,192`.** Its only approaches are (5,13), the
block, and (5,14), the pulser — a permanent `type = "Solid"`. The group that
opens the level's one join has exactly one presser and it is not a player.

### ⚠ A two-member capability list gets read as one member

`PushableBlockFire.moveTypes` is `["Fire", "Pulse"]`, and five consecutive
slices read it as *"Fire is the one that matters"* — because the question was
always *which player weapon moves this block*, and only one member answers
that. The other member has a **writer**: `Pulser.hit()` dispatches
`(c as PushableBlockFire).hit(new Point(x, y), "Pulse")` on its own clock,
through the same non-relative arm a fire press takes.

Before concluding a capability is inert, grep for a writer of **each** member,
not a reader. `grep -rn '"Pulse"' src/` finds it in one command.

### ⛓ The `Pulser` — the first world-driven hit on the arc

Every mover this arc had modelled was a player press. `pulser.js` is the
first thing that hits on its own clock, and three of its numbers are places
where the closed form disagrees with the loop:

- **the animation is a gate, and it LOOPS.** `add("pulse", [0,1,2,3,4], 20)`
  takes FlashPunk's default `loop = true`, so `complete` never latches; the
  WRAP calls the Spritemap callback (`endAnim`, which plays `""`) and that is
  what lets `update`'s body run again. Five frames take **eight ticks** at
  `20 * FP.elapsed`, simulated through `Spritemap.update`'s own
  `while (_timer >= 1)`.
- **the pulse runs 23 ticks**, because `(28 - 10) / 0.8 = 22.5` and the
  `>= radiusMax` test is *after* the increment. Divide and floor and you are
  one hit short every cycle.
- **the period is 51, not 52.** The `play("pulse")` tick IS the gate's first
  tick: `World.update` runs `e.update()` and then that same entity's
  `e._graphic.update()` — the relationship `Player.fire()` has with
  `sprites()`.

⚠ `Pulser.hit` fills **one** vector across its three hitable types and
iterates it once — the ordinary shape. `Player.fire()`'s 55 knockbacks are
this code written one indent differently, so the difference is asserted
rather than assumed.

⚠ And a `Pulser` must **not** join `world.activators`. It is `type = "Solid"`
whether its group is published or not, so an "open" one would read as
passable and the geometry would go the unsafe direction. It needs its own
census list and its own step.

## R5 slice 9: the chest, the pickup that walks onto you, and a plan the game refused

### ⛓ A chest is a verb with no button, and its stance band is derived

`Chest.update` opens on a one-pixel `collideLine("Player", …)` beneath the
box, gated on `!collide("Solid", x, y)` — **the CHEST colliding with
whatever shares its cell, not the player**. In L38 that is the cover, so
the four links that open the cover buy the chest's own permission and the
stance band is identical either way.

⛔ **The band is two pixels and the chest is its floor.** The line
arithmetic alone admits five player rows; four of them put the player box
inside a Solid. `chestStanceBand` intersects the two constraints using the
same functions the run uses, so a two-pixel window cannot be transcribed
twice. ⚠ And the line's right inset is `2 * m`, not `m` — 2 px on the left
and four on the right, from a shape that looks symmetric.

### ⛔⛔ The first pickup that walks onto the PLAYER

`levelRun.pickupUnderfoot` tests the player's box against a pickup's STATIC
rect, which has been right for six rungs because every pickup was a thing
the walk stepped onto. `Chest.open()` spawns its `SealPiece` at the
chest's own position, 8–11 px above a player standing in the band: the
static rects never overlap and the ceremony would never fire.

`Pickup`'s attraction is transcribed instead. ⚠ `stopped` is never set
false — the only writer is `if (v.length <= 0) stopped = true` — so the
attraction is live every tick and the piece ACCELERATES; `friction()` runs
above the move; and the contact test runs at the position the tick started
with. Nine live ticks to a stationary player, and it is nine from BOTH
band rows.

⛓ **A `SealController` holds the freeze for 181 ticks, not 120.** Its
fields read "60 fade + 60 wait"; after the wait `waitTime` is 0 and
`alphaStep` is only 60, so the `else if` arm resumes and runs it to 120
before the removal. The whole ceremony is 331 dead frames, and the game
confirmed both halves.

⚠ **`saw_auto_advance` cannot see it.** `autoAdvance`'s gate is
`Game.talking || helpUp`, and a `SealController` is neither — so v5's
stated unit ("a freeze arrival, whatever raised it") and its predicate
disagree for exactly this class.

### ⚠ A load's dead-frame cost is not a constant

`r5-feather` measured a boot at 21 and a door at 20 and those became
`swimSoundClock`'s constants. L38 measures **20 and 19**. `blackCover`'s
countdown and the frame `Bot.update` samples it on are two clocks with a
phase between them.

That nearly produced a false correction: borrowing the other tape's
constants left the seal ceremony two frames short of the model, which
reads exactly like a fencepost. Two throwaway fade probes — a boot alone
and a boot with one door — attributed it instead, and the ceremony came out
at 331 exactly. **When a dead-frame total has to be decomposed, measure the
load in the level you are in.**

### ⛔⛔ A `--record` run that passes says nothing about the model

`verify-seedling-bot-differential --record` writes the game's stream and
then compares the game against it. That is a self-comparison and it passes
by construction. The check that matters is `tapeRunner.test.js`'s fixture
differential — MODEL against recording — and on the shaft tape it says
`tick 852 differs by dy = 1.4` on a tape whose `--record` run reported
every check green.

### ⛔⛔ Three certificates of one plan are one certificate

`SHAFT_PLAN`'s eighteen presses were derived by hand and confirmed by a
blind BFS, and both ran through the same unaimed press model. The game is
the first independent stratum, and it disagrees: the three wandlocks never
open, a flag the plan says is taken back is not, and a `FallRock`'s tag
that nothing on the route was supposed to write is cleared.

⚠ **The positions could not have caught it.** A block's position and a
lock's alpha are invisible to the observation stream — the player walks
the same path whether the room opened behind them or not. That is what an
exact-set LEDGER claim is for, and it is the first time on this arc that
the stream agreed and the ledger did not.

### ⛔ A fire leg needs an `equip`, and three ways that goes wrong quietly

- `useItem(Main.primary)` reads the selected slot and a fresh run's is 0,
  so every press fires a SWORD. The fire verb then runs to completion and
  its effect check reports the target unmoved with a paragraph about rect
  geometry — a diagnosis of the PASS. Check the weapon first.
- `equips` is a version-4 field and optional BY PRESENCE, so a `relax`
  that omits it verifies with the slot selected and emits a tape that never
  selects it. The driver is green and the replay dies hundreds of ticks
  later in another file.
- `earnedClears` cannot see a lock the run never leaves: a banked clear is
  cashed when its level is next BUILT, so a run that opens three locks in
  one room reports an empty ledger. The WRITES are the claim.

## R5 slice 10 — the rock the rope drops

### ⛔⛔ Two gates that share an opener are one gate

`r5Totem.GROUP_6` argued for four slices that a rope's group publication
cannot arm `fallrock@144,624`, from two independent reasons: its tag is 10
and "nothing on this route writes tag 10", and `FallRock.update`'s position
arm is `activate && y >= fallTo` against a rock parked at `y = -16`.

Both sentences are true **about `update()`**. The mechanism is in the
setter:

```
  override set activate(a)  { if (a && !_active) { fall(); _active = a; } }
  fall()                    { Game.setPersistence(tag, false);   // <- HERE
                              trigger = true;
                              Game.freezeObjects = true;
                              waitToFallTimer = 60; }
```

**The publication is not a read of the flag — it is the write of it.** So
"nothing writes tag 10" is false the instant the rope publishes, and the
update-time gate is open because the setter opened it. Having two reasons
made the audit *read* as safe; they were never independent.

⚠ **When an audit clears a class, check the SETTER as well as `update()`.**
An `Activators` subclass can do arbitrary work in `set activate`, and four
of them do.

### ⛓⛓ Pull the rope, drop the rock — it is an idiom, and the atlas says so

Three `RopeStart`s exist in the whole game and **two publish to a
`FallRock`** (L28 `t 1`, L39 `t 6`). A second instance of a "coincidence"
sitting in the data is the cheapest possible refutation of it, and it costs
one query over the atlas.

### ⛓ A freeze costs the tape ZERO ticks and costs the readout everything

`Bot.update`'s gate is `blackCover > 0 || Game.freezeObjects`, so a frozen
frame advances no tick and records no observation. A 197-frame fall is
therefore **invisible to the observation stream**: between the live tick
that pulls the rope and the next live tick, the rock has gone from overhead
to landed. The only instrument that sees it is `dead_frames`.

So a model can resolve such a span in ONE tick — but it must bank the frame
count, because that number is the whole of the evidence.

⚠ **The boundary frames are free only if the player is still.** `fire()`
runs above `super.update()`, so the pull frame's movement is skipped; and
the release frame moves the player with no observation recorded. A route
that pulls a rope *while walking* pays a ghost step in both directions.

### ⛓⛓ The dead-frame budget, and why the census counter could not do it

`saw_auto_advance == 0` was gated on `tape_version < 4`, so every R5 tape
had no census guard at all. Re-arming it is necessary and **not
sufficient**: `Bot.autoAdvance`'s predicate is `Game.talking || helpUp`,
and the two classes that actually freeze this arc — `SealController` and
`FallRock` — are neither. The counter reports 0 through a 197-frame freeze.

The check that works is arithmetic over the readout:

```
  dead_frames  ==  the model's own freezes
                 + each ceremony's freeze
                 + one room-load fade per BUILD   <- a BAND, not a constant
```

A band because `blackCover` decays per RENDER while the gate samples per
UPDATE: 21/20 on one level, 20/19 on another. The refuted shaft tape's
residue was 217 against one load — twenty times the band.

### ⛔⛔ `--record` now runs the model differential itself

`--record` used to write the expectation and `continue` past every
comparison, which is how a recording got read as evidence about a model. It
now runs the model-against-recording diff on the stream it just wrote, as a
named failure for that tape. The ordering cannot be forgotten because it is
no longer an ordering.

### ⛔ The literal in the argument you were not looking at

`FORCED_TSET` documented its own method — "checked every `super(` call" —
and missed `BossLock.as:31`:

```
  super(_x + Tile.w / 2, _y + Tile.h / 2, Game.bossLocks[_t], -1)
```

The group is a hard-wired **-1**; `_t` is the key type, one argument to its
left. `Game.as` passes `o.@keyType` there, so the call site has exactly the
`_t`-shaped argument the sweep was scanning for. Two literals exist in the
whole game and this was the second.

⚠ It had shipped a prediction: that L40's `buttonroom@272,208` opens
`bosslock@480,352` with no key. It cannot — a group -1 lock answers no
publication — and the model had opened a wall the game keeps shut.

### ⚠ A one-tick lag is not automatically the cause of what follows it

The shaft's stream parts at tick 852 by `dy = 1.4`, which is exactly the
model's own movement step there: the game stalled one tick and stayed one
tick behind. It is tempting to blame every later failure on it. Computing
the margins refuted that — every one of the eighteen presses has at least
13 px of slack against `Player.fire()`'s 16 px cut, so a 1.4 px offset
cannot make one miss. **Measure the margin before you attribute the
consequence.**

## R5 slice 12 — solidity is a property of the MOVER

Four things landed and one of them changes how the census is read.

### ⛔⛔ A "not solid" verdict is a claim about ONE mover's `solids` list

`levelWorld.ENTITY_CLASSES` carries one `collider` field per class, and
its docblock said *"'none' — present in the level but does not block the
player"*. That is exactly right, and it is not the only question.

FlashPunk collision is not a property of the thing being hit. Every
`Mobile` carries its own array, and `collideTypes(solids, …)` asks about
that one:

```
Mobile.as:17              solids = ["Solid","Tree","Rock","Rope","ShieldBoss"]
Player.as:377             solids.push("LavaBoss")            ← the PLAYER's
PushableBlock.as:28       solids.push("Enemy", "Player")     ← a BLOCK's
PushableBlockFire.as:31   solids.push("Enemy", "Player")
```

⇒ **a pushable block is the one mover in the game that collides with
enemies.** L39's shaft failed for four slices because a wandering
`Spinner` — a `type: 'Enemy'`, `collider: 'none'`, "damage only" census
row — stood in a block's glide corridor and wedged it. Every instrument
agreed the model was right, because every instrument was asking the
player's question.

Ask it with `blocksMover(type, mover)` (`SOLIDS_BY_MOVER` has the three
lists). And assert **both halves** in one test — this row is `'none'`
AND it blocks a block — so neither reads as a defect in the other.

⛓ **The wedge is permanent.** A blocked block keeps `v` non-zero
forever: `input()` re-derives it from `tile`, `moveY` resets `tile` to
the current cell, and the two chase each other. `hit()`'s first line is
`if (v.length > 0) return`, so no later press can ever move it again.

### How the mechanism was isolated, cheaply

`Bot.as:811` re-boots with `new Game(bootLevel, bootX, bootY)` whenever
the tape's boot block disagrees with where the player is — **so a probe
tape can start inside the room it is about**. The shaft's 2,375-tick
prologue (a rope, a corridor, a 197-frame freeze) became 165 ticks.

Three probe shapes, in order of what each one settles:

1. **the walk-proof** — press, then walk into the cell the push emptied.
   Reproduces the failure and localises it to one press.
2. **the dipstick** — hold the movement key for hundreds of ticks instead
   of walking to a target. A driven walk stops when its INPUT SPAN ends,
   which in a position trace looks exactly like being blocked; holding
   the key turns the player's face into a continuous readout of the
   obstacle. (A player pressed against a 0.5 px/tick mover follows it at
   **1 px every other tick** — the sweep quantum is 1 px and the gap
   opens 0.5 px.)
3. **the time shift** — the same tape, N ticks later, nothing else
   changed. A static solid gives the same answer; anything that moves
   does not. Here the shifted arm came back **byte-exact**, which is
   what proved the blocker was mobile.

⚠ And the diagnostic arms are WITHDRAWN, not committed: a fixture whose
model is wrong is either a permanent red or a silenced one. Their numbers
are banked in `r5Shaft.SPINNER_WEDGE`; `probe-seedling-r5-press-axes
--write-probes` regenerates them.

### `runFire` refuses a glide it cannot certify

The model tracks no enemy POSITION, so it is not entitled to predict a
block's glide in a room with live enemies. `runFire` fails by name, and
the escape hatch is a DECLARATION with evidence
(`fire.enemyRoom: "<what the GAME said>"`) rather than a boolean.

⚠ Its first cut read `run.world?.combat ?? []`. The `combat` role is
opt-in, so on a world built without it that is an empty list and a silent
green **on the one question the check exists to ask**. An absent census
is a refusal now, not a pass.

### The burn: the eighth geometry family

`burnableTree.js`. Three things a reader gets backwards:

- **the tree is SOLID for the whole burn.** `hit()`'s entire body is
  `playSound; burn = true; play("burn")` — it removes nothing. The 2x2
  cell opens **41 ticks** later, when `burnEnd -> die()` fires.
- **the persistence write is in `removed()`, at anim end** — the opposite
  of `FallRock.fall()`, which writes on the trigger frame.
- **`check()` decides whether it is BUILT AT ALL**: `tag >= 0 &&
  !checkPersistence(tag)`, so once the flag is cleared the room is built
  without the tree. A window that boots after the burn must declare the
  flag.

41 is simulated, not divided: `15 * 0.0333` is 0.4995, so twenty frames
are not forty updates. ⚠ Both `burnabletree`s in the extract carry
`tag="0"` — neither is per-visit.

### The crusher: a pursuer, not a hazard

`crusher.js`. `t == -1` means **always armed** (on a `Lock` the same
literal is the kill-lock sentinel). At rest it grid-snaps with
`Math.round`, needs LINE OF SIGHT (`collideLine("Solid")` with a
temporary `type = "BS"` self-swap, so **any** Solid shields it), scans
four 64-px lanes, charges 1 px/tick and **PARKS** where a Solid stops it.
`hit()` runs every armed tick including at rest, damage 1000, to `Enemy`
as well as `Player`.

Two consequences worth carrying:

- ⚠⚠ **`update()` never tests `Game.freezeObjects`.** A pickup's 150
  frozen frames stop MOBILES; a `Crusher` is an `Activators`. So a
  collect near one is a **ceremony-duration survival claim**, not a
  positional one. Read `update()` for the gate before pricing any stance
  a ceremony will freeze the player in.
- ⛓ The four lanes are each the body grown 64 px along ONE axis, so
  every pairwise intersection is **exactly the body** — and standing
  there is a 1000-damage tick. The scan's last-match-wins (there is no
  `break`) is therefore unreachable by a living player, and the charge
  direction is unambiguous everywhere a player can survive.

### The dead-frame band is `mean·N ± c·√N`

A tape's fade residue is a SUM of per-load fades: its centre grows
linearly in the load count and its spread does not. The old linear band
was wrong on both sides — its floor was the smallest observation ever
seen (so a STARVED run went red) and its ceiling grew 5 frames per load,
which on the four full walks was wide enough to admit a 150-frame freeze
the model had MISSED.

⚠ Derive the half-width from the loudest measured run-to-run NOISE, not
from the fitted σ — those describe different things. Cap it at half the
smallest defect you must catch, so "a missing ceremony is always caught"
is a claim rather than a fact about today's roster. And COMMIT the
observations (`fixtures/dead-frame-observations.json`): the numbers the
previous band was designed from lived only in prose and did not
reproduce.

## R5 slice 13 — the billiard, the thread, and the first two ceremonies

### ⛓⛓⛓ One enemy in the game is modellable, and `runRange = 0` is why

Slice 12 found that a `PushableBlock*`'s constructor pushes `"Enemy"` onto
its own solids list, so a wandering `Spinner` can wedge a block mid-glide —
permanently, because a blocked block keeps `v` non-zero and
`PushableBlockFire.hit`'s first line is `if (v.length > 0) return`. The fix
needed the spinner's POSITION, which needed its motion to be predictable.

It is, and almost uniquely so:

```
  runRange = 0        the chase arm's gate is `d <= runRange` against
                      FP.distance ⇒ the nearestToPoint("Player") block is
                      DEAD CODE. The motion is player-INDEPENDENT.
  activeOffScreen     true ⇒ Enemy.update's !onScreen() return never fires.
                      No camera coupling at all.
  friction()          OVERRIDDEN: the floor is `moveSpeed`, not 0. It never
                      stops, and a shove DECAYS BACK to speed 1.
  moveX/moveY         OVERRIDDEN: `v.x = -v.x` and return, instead of stop.
```

⇒ the trajectory is a function of the level's static geometry and the tick
index alone, so it can be simulated forward from tick 0 of a visit with no
route input. That is what makes a press schedule threadable
(`spinner.js`, `run.spinnerForecast`).

### ⛓⛓ A refuted `--record` run leaves a game-side observation behind

`--record` prints the FIRST diverging tick with BOTH streams' values on it.
So slice 12's three withdrawn arms — whose expectation files were deleted —
still carried exact game numbers in the session log:

```
  r5-press-glide    t157   game y = 83.83122648907042
  r5-press-repeat   t143   game y = 90.98122648907042
```

The corrected model landed on both to the full double **before any recording
was spent**. When you withdraw a fixture, bank its divergence numbers: a
refuted run is not only a red.

### ⛔⛔ A corrected driver cannot re-author the tapes its own defect produced

With the spinner modelled, `synthesizeLegs` correctly refuses the press
those diagnostic tapes were built around — so re-synthesising them produces
*different tapes wearing the same names*. Two of the three were recovered
instead, by pure span arithmetic over a tape that IS committed
(`r5-press-delay`), and the arithmetic was checked two ways: both land on
`tick_count`s the GAME measured (from `observation count - 1` in the old
log), and the transform inverts byte-for-byte back to the committed tape.
The third could not be recovered and is named rather than fabricated.

### ⛔ Two alpha fades, same shape, different answers

`alpha -= k` with `alpha <= 0` is an ACCUMULATION, not `1 / k`:

```
  death()          1 -= 0.1  x10  ->  1.39e-16, STILL > 0  ⇒ 11 ticks
  fallAlphaSpeed   1 -= 0.05 x20  -> -3.19e-16,      <= 0  ⇒ 20 ticks
```

A model that divided would be one frame early on every death and right on
every pit fall — wrong in exactly the case its own test would miss.

### ⛓⛓⛓ A frozen player is invulnerable — with one exception in the game

Every damage path reaches the player through `Player.hit`, whose gate is
`hitsTimer <= 0 && hits < hitsMax && !Game.freezeObjects`. That is nineteen
call sites — enemies, projectiles, the pulser's ring, the crusher's 1000 —
and it means **a 150-frame pickup ceremony cannot be interrupted by
damage**.

⛔ The exception is `LavaTrap.as:72`, `attached.die()`: it calls
`Player.die()` directly, bypassing the freeze gate AND `Bot.noDamage` (the
relaxation guards `hit()`'s body, not `die()`). Dungeons 7 and 8 only.

⇒ this corrects slice 12's crusher rule. A `Crusher` MOVES through a
ceremony and cannot HURT through one, so a part-collect near one is a claim
about **one frame** — the first unfrozen tick — plus where 150 px of charge
parks a 32x32 mobile Solid. See `crusher.PLAYER_DAMAGE_PATHS`.

### ⛓ `fire.thread` — the press waits for its corridor

A declaration, not a flag. The corridor is the union of each declared move's
from-cell and to-cell (the block's swept rect); the span is
`[press + firstHitTick, press + lastHitTick + 32]`; the press emits idle
ticks until `run.spinnerForecast` says that window is clear.

⚠ The forecast is a **search heuristic** — it holds the other blocks still,
so it can be a tick of geometry out. What DECIDES is `runFire`'s exact-set
effect check against the real models, so a bad thread costs a refused press
and never a green tape. A forecast used to ASSERT anything would be the
two-cost-models trap.

On the shaft, exactly one of nineteen presses waited: **27 ticks before
press 5**, the press slice 11 measured as the failure. Killing the three
spinners instead would have written {39,3}/{39,4}/{39,6} and turned a
nine-write ledger into a twelve-write one.

### ⛔⛔ Modelling a position creates a bill for everything that acts on it

The shaft's CONTROL arm — the eighteen presses deleted, nothing fighting
anything — came back from the game with **{39,4}** in its ledger, a
spinner's own tag. `Pulser.hit`'s third arm is
`(c as Enemy).hit(force, …, "Pulse")`; the model had the arm named since
slice 9 and had never had an enemy to hand it. Leaving three blocks on their
spawns is leaving three WALLS where the billiard bounces differently.

⇒ deleting eighteen presses changed which enemy lived. A control arm is a
real experiment, not a formality. And the knockback is not cosmetic: force 6
against a friction floor of `moveSpeed` is twenty ticks of a different
trajectory.

### ⛔ A control's resting cell is not a claim about the room

`SHAFT_PAIR.pinnedAt` was a hand prediction of where a pressless walk would
STOP. A control replays the whole input tape into a shut world, so after the
first blocker the remaining spans keep shoving it — the last cell is an
artefact of the last span, and it moved twice in one slice as the tape grew.
Assert what the ROOM decides (a cell never entered, a row never crossed) and
keep the resting cell as reported data.

### ⚠ Compare the right two sets: declared + earned vs earned

The game's `persistence_cleared` is everything the SAVE has cleared —
declared clears included. A plan's ledger is what the route EARNS. Comparing
them as a straight equality makes every declared flag look like a
disagreement.

### ⛓ `relax.roles`, and `collect.aim`

- `synthesizeLegs`' `relax.roles` is how an R5 plan asks for the `combat`
  census by name. It may only WIDEN the base roles; narrowing is refused,
  because a plan that dropped `blocking` would get a walk that consults no
  collider.
- `collect.aim` overrides the point a collect leg walks at, and takes a
  `why`. `totempart@72,40`'s rect straddles a column boundary and the line
  from its only approach cell to its centre runs into a wall — the override
  moves the AIM, not the contact test.

### ⛓⛓ Two of the five ceremonies, counted by the GAME

`hasTotemPart` is not in `Bot.itemReadout`, so a collect is claimed over its
**150 frozen frames** in `dead_frames` rather than over the item:

```
  r5-shaft       367 dead = 197 (the rope's rock) + 150 (part 2) + 20 fade
  r5-l40-part1   170 dead =                          150 (part 1) + 20 fade
```

⛔ And L40's load-bearing negative is that the walk never leaves the level:
every pit there is a ONE-WAY transport into L43, the wand room. A tape that
fell would not fail — it would quietly succeed at something else.
`control@224,432` looks like the trigger and is not one: it is a parameter
block read once at `loadlevel`, and its `@x,@y` is the base of an OFFSET
rather than a place (`r5Totem.L40_FALLTHROUGH`).

### ⛔ Where the burnable trees actually are — and one flood bug worth naming

Every burnable tree in the game, flooded at the planner's 8 px lattice with
every activator open, shut vs burned:

```
  L37  burnabletree@128,192 {tag 1}   1 component, 1869 nodes -> 1889   +20
       a press stance at (120,232) is INSIDE the 32x32 fire rect and in the
       same component ⇒ a real PAIR, with no chain in front of it
  L32  burnabletree@64,0    {tag 0}   1 component,  133      ->  145   +12
       stance (56,40)
  L40  burnabletree@872,784 {tag 0}   16 components, and NO stance inside the
       fire rect is in the largest ⇒ the tree is behind `chest@880,816`
```

⚠ **`world.width` and `world.height` are in TILES, not pixels.** A flood
bounded at `w.width` covers 40 px of a 640 px region and reports 8 free
nodes in a whole overworld level — which reads like a level made of walls
rather than like a bug in the probe. Multiply by `TILE_SIZE`, and sanity-check
a component count against something you already know before believing a
reachability verdict.

## R5 slice 14 — the burn driven, the third ceremony, and four silent drops

### ⛔⛔⛔ An options key that nobody destructures is a silence, not an error

`burnableTree.js` shipped in slice 12 described as *"the eighth geometry
family, wired end to end"*. Nothing had ever burned anything. Driving it
found **four call sites that were handed an option and dropped it**:

```
  playerPhysicsV2.step             burnedTrees, fallenRocks
  botDriverV2.plannerObstacleAt    burnedTrees
  botDriverV2 runSpear face nudge  brokenRocks, pulledRopes, openChests,
                                   burnedTrees
  botDriverV2 runChest join probes burnedTrees
```

`levelRun` had passed `burnedTrees` into `step()` since slice 12 and
`fallenRocks` since slice 10; `collidesSolid` and `plannerBlockerAt` had
accepted both for as long. So **the one mover whose collisions decide where
a route actually goes could not see a burned tree or a dropped rock**, while
every other query could.

⛓ **A green suite could not find it**, because the only producer of
`burnedTrees` was an undriven verb — 1,745 tests passed over the gap for two
slices. What found it was a walk-proof leg grazing the tree **1,999 times**
while the model said the cell was open.

⇒ **when you add a per-visit family, grep for a READER of every member at
every call site.** Not the one the slice needs; all of them.
`liveGeometryOpts(run, extra)` is now the single builder for every mid-leg
geometry probe, because three hand-written literals is how one of them
quietly acquires a different world from the other two.

### ⛔⛔ A flood that justifies a route must run under the ROUTE'S policy

`L37_BURN` was first banked with a flood reporting 96 nodes shut and 584
burned, and the sentence *"the walk starts in a closed room and the tree is
its only exit"*. Both numbers are real; the sentence is not.

```
  flooded as the DRIVE plans (conch held)   2049 -> 2065    +16
  flooded holding nothing                     96 ->  584   +488
```

`plannerObstacleAt`'s lethal-terrain policy defaults to *"the player holds
nothing"*, and the driver's `planNow` passes `run.inventory`. **+16 is the
tree's own 2x2 footprint and nothing else**; a player who can swim goes
round it, and the 96-node "room" is bounded by 26 nodes of water and a
teleporter.

⛔ **And the control arm would have passed anyway.** `r5-l37-burn-control`
really never enters the far tile — because it replays the burn route's
SPANS, not because the room is shut. A control replaying a route planned for
a DIFFERENT world proves nothing about reachability.

⇒ the claim was rewritten to the one that survives every policy: **the walk
enters the tree's own cells and the control enters none of them.** A 32x32
Solid's cells are unenterable while it stands, whatever the router believes
about the water next door. Both floods stay banked, each with its policy in
its name.

### ⛓⛓ The burn arm is two-sided in TIME, not just in set

`fire.burns: [{x, y}]`, beside `rope` and `moves` — OEL coordinates, because
a tree's id is `burnabletree@x,y` and a 32x32 `centerOO()` sprite covers four
tiles, so four different `{tx, ty}` would name the same tree.

What it asks that no other fire arm has to: **was the tree still SOLID ten
ticks after the press?** Taken mid-leg at `FIRE_WINDOW.endTick`, because
that reading is not recoverable from an end state. `hit()`'s whole body is
`playSound; burn = true; play("burn")` and removes nothing; `burnEnd ->
die()` opens the cell 41 ticks later, and `removed()` writes the flag there
too. It is the `FallRock` mistake mirrored — that one writes its flag EARLY,
this one removes its solid LATE — and a model that opened the cell on the
press tick would satisfy every set-valued check in the file.

### ⛓ A gate can be conjunctive in its FLAGS and sequential in its ROUTE

L40's join is `chest@880,816` under `burnabletree@872,784`: +4 / +0 / +40.
§24.5 read the one pixel of shared edge (`816 > 816` is false, so the chest
is openable with the tree standing) and concluded the two links commute.
They commute as flags and not as a walk: **every stance whose fire rect
reaches the tree is inside the chest's own cell**, and that cell is Solid
until the chest opens. An audit that only asks the flags reports the wrong
freedom.

⛔ And the two writes land in **two different lists**: `earnedClears` carries
the burn's `{40,0}` and not the chest's `{40,13}`, because a chest banks
through `pendingEarnedClears` and that is cashed when the level is next
built. A ledger summed from one list drops a link while looking complete.

### ⛔⛔ The freeze gates are a three-way split across the enemy families

Checked at source before any class was trusted to hold still through a
ceremony:

```
  Bob.update          returns on Game.freezeObjects
  BobSoldier.update   returns on Game.freezeObjects
  Spinner             no own guard; Mobile.mobileUpdate parks the MOTION
  Puncher.update      NO freeze test — only Mobile's gate stops it moving;
                      its chase arm keeps re-aiming v, its attack state
                      machine keeps running
  BombPusher.update   NO freeze test at all, and super.update() is the LAST
                      line — shotTime counts down, the Spritemap animates
                      (graphic updates are not gated), and endAnim can
                      FP.world.add(new Bomb(...)) aimed at a frozen player
```

⇒ *"enemies stop during a ceremony"* is true of the bob family and false as
a general rule. *"A frozen player is invulnerable"* still holds — every
damage path but `LavaTrap.attached.die()` goes through the freeze-gated
`Player.hit` — but *"nothing happens"* does not.

### ⛓⛓ The kill ledger: only the spinner family writes

```
  Bob.removed()         EMPTY  (`//if(!fell) dropCoins();`)
  BobSoldier.removed()  EMPTY  (the same commented-out line)
  Spinner.removed()     Game.setPersistence(tag, false), NO test of the cause
```

⇒ clearing a press room of bobs costs the ledger **nothing**; killing a
spinner costs a flag **whatever killed it**, including a hazard the billiard
bounced into on a tick no route chose. So "kill or thread" is decided per
spinner against the ledger prediction, and per bob it is free. Every tape on
this slice asserts `spinnerWrites` is empty — a claim, not an absence.

### ⛔ A slash is an AREA: three rocks came down on two swings

L40's NW cluster: one swing per rock refuses itself on target 2 with
*"breakablerock@176,144 is ALREADY GONE before the press"*. The two east
rocks are vertically adjacent and one slash reaches both. The plan names the
swing and its WHOLE effect, not the rock it was aimed at.

⛔ And the buttonrooms need **101 continuous ticks**, not the 11 a Cover
takes: L38's buttonrooms open Covers, L40's open Locks. The `room = -1`
self-latch keeps the group published after the player steps off — which is
what makes the rest of the leg possible — and does not make the fade
shorter.

### ⚠⚠ A wrong SHAPE returns a clean, plausible "no"

L41's crusher shield was measured wrong twice before it was right, the same
way both times: `collideLineSolid` reads `s.x/s.y/s.right/s.bottom` and a
`world.solids` entry carries its box on `.rect`; `scanCrusher`'s lane test
needs a player BOX and not an `{x, y}`. Both wrong shapes returned *"dir
null, shieldedBy null, matched []"* — a plausible *"the crusher does not see
you"* that a route would have been built on. Assert the POSITIVE arm too, so
a probe that silently saw nothing fails something.

Right, against L41's own solids: with the rocks standing the crusher is
shielded by `breakablerock@224,80`; without them it charges W; and the
SOUTH lane is shielded by the room's own wall either way, **so the bait can
only come from the west.**

### Where the ceremonies stand

Three of five. Parts 2 (the shaft), 1 (a free walk in L40) and 0 (L40's NW
cluster) are collected and counted in the game's own dead frames — 367, 170
and 170. **Parts 3 and 4 are behind the crusher**, and there is no way round
it: flooded from each room's own boot with every activator open and every
rock broken, neither part is in the component (L41 356 nodes, L42 304).
`crusher.js` models the scan, the charge and the park; `levelRun` steps no
crusher, and wiring one is the `burnedTrees` plumbing chain again for a
solid that MOVES.

## R5 slice 15 — the crusher is plumbed, and L41 is solved BY the obstacle

The ninth per-visit geometry family, and the first whose member is a solid
that **moves on its own**. Every family before it moves because the player
moved it — a pushed block, a shrunk rope, a dropped rock, a burnt tree. A
`Crusher` charges the moment it can see you, so its box is a function of the
whole run and of no single event in it.

### The plumbing, and the only check that discharges "wired"

The chain is the one slice 14 named: a roster (`world.crushers`), a
per-visit state family and a step at the game's own slot in the update list
(`Game.loadlevel` adds it at `:2142` and `World.addUpdate` prepends, so it
runs **after every activator and every block and before the player**), and
its live box in `collidesSolid` / `plannerBlockerAt` / `stepV2`.

Slice 14's finding was that a family can be wired everywhere except the
player's own sweep, behind 1,745 green tests, because the only producer of
the option is an undriven verb. The discharge for this one is a driven
assertion pair:

```
  the player stands at (269.99, 79.46) — inside crusher@240,64's own
  constructor body [240,272) x [64,96)

  collidesSolid(box, {})                 -> truthy   (STATIC says Solid)
  collidesSolid(box, {crushers: live})    -> null     (live says clear)
```

A `stepV2` that dropped the key would have used the static answer and
refused the walk, so the player's arrival there **is** the proof. Every
other check — the roster, the option's presence in a destructuring list, the
ledger — is satisfiable over a silence.

### `Crusher` writes no persistence, and that cuts both ways

No `check()`, no `removed()`, no `setPersistence` anywhere in the class. So
every `new Game` rebuilds it at its constructor cell however far the last
visit drove it:

- a botched park is one room-exit from reset;
- and **a window plan may never carry a crusher position across a re-boot** —
  a window boundary inside a bait chain undoes the chain.

### The two-phase doctrine

The eight families before this one are MONOTONE: once a rock is broken the
cell stays open, so a flood taken once stays true for the leg. A crusher is
not, so the planner is not allowed to route against a live one:

| phase | verb | planned against |
|---|---|---|
| 1 | bait / park | `stepCrusher`, tick by tick |
| 2 | route | `plannerBlockerAt`, with `run.crushersParked` asserted |

and **a flood banks with the crusher configuration that produced it**, the
same rule slice 14 learned about the inventory policy.

⚠ **A parked crusher is not a disarmed one.** `update()` re-derives `v` on
every tick it is at rest, so a park is a position and not a state — walking
back into a lane charges it again, from whatever direction now matches.

### The margin is the perpendicular step, not speed

A walking player tops out at **1.2 px/tick** against the crusher's 1.0, so a
straight retreat gains 0.2 px/tick. What saves a bait is that `v` is only
derived inside the `vx === 0 && vy === 0` branch: **a committed charge is
never re-aimed**, so one step out of the lane's minor axis ends it. Measured
— L41's third bait with `down 50` in place of `down 40` is run over 36
times.

### Two overlap conventions, eleven lines apart

`Crusher.update` triggers through `World.collideRect("Player", …)` →
`Entity.collideRect` (`Entity.as:263`), four `>=`/`<=`. The sweep, `hit()`'s
`collideInto` and `levelWorld.rectsOverlap` are `Entity.as:158`/`:336`, four
`>`/`<`. The strict test reports *"it cannot see you"* for a stance the game
charges at, which is the dangerous direction.

⚠ And `scanCrusher` used to take ONE `player` argument for two shapes — the
BOX for the lanes and the ENTITY POINT for the sight line, 2 px apart. Every
caller had to build a chimera. It takes two arguments now and refuses both
malformed shapes by name: the fix for "a caller passed the wrong shape" is a
signature that cannot take it.

### L41 is solved by the obstacle

The room has **two** gates and the player can open neither. `wandlock@240,96`
is the part chamber's only doorway and `cover@112,128` is the only push
stance of the room's one block — and both re-close the tick their button is
released unless something is standing in their own cell. Each needs a SOLID
on a button; there is one block; the block is behind the first gate.

`Button.update` collides `["Player","Enemy","Solid"]` and excludes only a
`Cover`. **A `Crusher` is `type = "Solid"`.** Three baits walk it onto
`button@248,232`, where it holds the cover open permanently — and the first
of those baits is also what clears the doorway:

```
  bait 1  W   (256,80)  -> (64,80)     0 contacts, and the doorway opens
  bait 2  S   (64,80)   -> (64,240)    0 contacts
  bait 3  E   (64,240)  -> (256,240)   0 contacts, ON the button
```

⇒ `hazards.hazardVolume`'s hard-avoid is retired as a RULING with a driven
witness. Not because the damage verdict is wrong — 1000 is `die()` at any
`hitsMax` — but because the volume it forbids is the volume the solution
operates.

⚠ The park creates its own constraint: from `(256,240)` the crusher's west
lane is cols 11–16 of rows 14–15, and a later leg that walks there charges
it off the button.

### A refactor can be the same work and a different program

Factoring the nine-arm "is this solid there right now" filter out of
`collidesSolid` and `plannerBlockerAt` (they each had a copy, and a crusher's
sight line needs a third) was correct and its first cut was a **40%
slowdown**: it returned a `{rect, live}` wrapper, one allocation per solid
per query, on the loop the player's sweep runs for every pixel of every
step. Eleven long fixtures went past the 10 s test timeout and read as
defects.

The second cause was SHAPE. Callers hand these queries a dozen different
option shapes, so eight property reads per solid went megamorphic;
normalising once per query took `r5-l40-join` from 4.2 s to 2.0 s — faster
than the parent commit. **A gate is where "the same work in one place" turns
out not to be the same program.**

### Where the ceremonies stand

Still three of five. L41's room is solved and its first three moves are
driven; its six block pushes, the 101-tick wandlock and the ceremony are
not, and L42 is unstarted.

## R5 slice 16: two verbs that had never been called, and a parked scanner

Three things this slice found are about the DRIVER rather than the game, and
all three are the same shape: a seam that was built, documented, and never
put through the thing it exists for.

### `bait` shipped with no caller, and the first call broke it

`botDriverV2.runBait` landed a slice earlier with three banked L41
choreographies and a docblock about its three controls. Nothing called it —
the choreographies were driven as raw spans through `createLevelRun`, which
is a different code path with no preconditions at all.

Put through `synthesizeLegs`, **two of L41's own three baits cannot satisfy
the verb's precondition.** It demanded the player be inside a detection lane
at the tick the verb starts; for those two **the approach IS the trigger** —
the stance is deliberately outside the lane (standing in it would have the
crusher charging before the leg is ready) and the choreography's first span
is the step that enters it.

```js
bait: {
  crusher:  {x, y},              // the OEL cell — `crusher@x,y`
  approach: [{key, ticks}, …],   // optional: the walk INTO the lane
  spans:    [{key, ticks}, …],   // the escape
  park:     {x, y},              // the ENTITY position it must END at
}
```

The positive control moved from a PREDICTION (`scanCrusher` at the start
says it will commit) to an OBSERVATION (`!run.crushersParked` after the
approach says it did). The pre-flight scan survives as the failure
diagnosis — *shielded by what*, or *in no lane* — and as a precondition only
when `approach` is empty, so a bait written against the old shape verifies
exactly as it did.

⛔ Its record also named its fields `from`/`to`, which are the TICK INDICES
every other verb record carries, so `synthesizeLegs`' `{…, from, to,
...record}` spread overwrote both with `{x, y}` objects.
`crusherFrom`/`crusherTo` now.

⇒ **An undriven verb is a verb whose SHAPE has never been checked against
the thing it exists to express.** That is a different failure from an
untested one, and no amount of unit testing the function finds it.

### `wait` — the first opener the player is not standing on

Every opener the driver could express was one the player HELD: `runHold`
puts the player's box on a presser and counts. L41's `wandlock@240,96` is
held by a `pushableblockfire` parked on `button@176,176` while the player
stands three tiles away.

It cannot be a side effect of the walk, either: `synthesizeLegs` plans each
target against the world as it is when the target is reached, and a shut
`Lock` is a wall — so the walk to the part is refused before the fade it is
waiting on has started.

```js
wait: { ticks: 160, opens: 'wandlock@240,96', why: '…' }   // -> openedAt 76
```

It emits **every declared tick** and measures `openedAt`. Breaking out at
the open would shorten the tape to exactly the number a ±1 lives in — the
same argument `runSpear`'s rock arm makes. Driven, the answer is 76, because
the sixth block press's settle window had already spent 25 of the `Lock`'s
101 continuous ticks.

Refusals, because the one thing a wait must never be is an idle span:
already-open before it starts, still-shut after it ends, an activator the
level does not have, no `opens`, no `why`, no `ticks`.

### `relax.pins` reached the run and not the tape

`synthesizeLegs` had passed `relax.pins` to `createLevelRun` since slice 4 —
the run really was pinned — and `buildTape` stopped at version 4, so `pins`
fell off the end of its destructuring and every synthesized tape came out
UNPINNED however the plan was written. The driver verified one execution and
the tape asked the game for another.

That is the two-consumers failure the `equips` docblock **in the same
function** was written about, one version later, and nothing caught it
because the tree's only pinned tape was hand-authored. Version 5 is version
4 plus the pins, and `synthesizeLegs` now compares the plan's pin list
against the emitted tape's and fails by name.

### A parked crusher is a live scanner, and auditing that is a per-tick job

A `Crusher` re-derives its velocity on every tick it is at rest, so a park
is a POSITION and not a state. A leg that parks one on a button and then
spends 1,300 ticks pushing blocks beside it is making a claim about every
one of those ticks: one stance inside one of its four 64 px lanes charges it
off the button and shuts the room.

`levelRun.crusherScans` answers that question with the run's own solid list
and the run's own two player shapes, and `createTapeStepper` yields it
per tick — so an audit rides `runTape`'s loop instead of driving a second
one.

⛔ The first cut did drive a second one, and it was a **different walk**,
twice over: it built its held-key set as one key per tick (dropping every
diagonal, which `chooseHeld` produces constantly) and never applied the
tape's `equips` (so its presses fired a sword and no block moved). It
reported a clearance of 0.00 px to a lane at a tile the real walk does not
enter. The tell was that it FAILED — an alarm is the only reason a wrong
instrument gets read instead of believed.

⇒ The rule is the one this file already states about `runTape` and
`createTapeStepper`: **one loop, two faces.** A "read-only" replay in a plan
script is the same trap in tooling clothes.

### `runTape` forwarded nothing about the ninth geometry family

The crusher was plumbed through `levelWorld`, `levelRun`, `collidesSolid`,
`plannerBlockerAt` and `stepV2` and stopped one consumer short, so a
fixture-level claim about it was unstateable. `crusherContacts`, `crushers`,
`crushersParked` and `openActivators` are forwarded now — an empty contact
list is a CLAIM (each contact is 1000 damage that `Bot.noDamage` absorbs),
and where the crushers finished is, in L41, the difference between a held
button and a shut room.

## R5 slice 17: a search is a proposer, and the clock is the oracle

Two orderings for one room, three charges apart, and only one of them exists.
Everything here is about the gap between a plan that is geometrically real
and a plan that survives 1 px/tick.

### Price the ROUND TRIP, not the reach

A room whose obstacle is a mover has a cost function that a reachability
flood does not express. L42's is:

```
  arrival  ->  the thing you came for  ->  the way out
```

and its way out is one tile below its way in. An earlier search asked only
"can the corridor be cleared", answered yes in six baits, and parked both
bodies in the return corridor — so the part is collected and the player can
never leave (212 safe nodes, part reachable, exit not).

⇒ **A park that opens the reach and arms a lane across the return is a
FAILED state, not a solution.** Put the exit in the goal test and the wrong
answer refutes itself, with a number.

### The player's graph is the SAFE cells, not the free ones

A parked crusher is a live scanner, so a cell it can see is not a cell the
player may stand in — standing there IS a charge. Make that the search's
adjacency rather than a post-hoc audit and three things fall out for free:

- a bait stance is a cell OUTSIDE the player's component, adjacent to it,
  which is "the approach is the trigger" derived rather than remembered;
- `scanCrusher` decides the direction, so LAST-MATCH-WINS is driven;
- the arrival's 304-cell free flood is a 172-cell safe one, and the
  difference is exactly the room's bait stances.

⛔ And the state needs a HOT variant — an escape that lands in the mover's
next lane, whose only legal move is the bait that crusher is already
committed to. Without it a multi-charge chain is pruned at its first link
and the search reports the room unsolvable, at length.

### Both readings of "what shields the escape" are defensible; drive both

Mid-charge the mover is neither where it was nor where it will be:

```
  pessimistic   it is ABSENT — not a wall, not a shield
  permissive    it is not a wall AND it is a shield (sight taken at its park)
```

In L42 they differ by three charges and the permissive answer is shorter,
symmetric and pretty. Its first escape does not exist: the player must be in
the crusher's own row band to trigger the charge, the climb out is 35 px at
1.2 px/tick, and the body's leading edge is 6 px away at 1.0. Driven, the
player rises 14 px, stops dead against the arriving body and takes 48
contacts — `Crusher.solids` is `["Solid"]`, so the body moves THROUGH the
player and then the player's own sweep refuses to move INTO it.

⇒ An over-approximation a POSITIVE result rides on is a wrong answer with a
confident shape — and a SHORTER answer is the kind a reader wants to believe.
Run both readings, name which one produced a plan, and let the drive decide.

### A beam over a choreography needs a tie-break that flips sign

Scoring candidate input sequences by "how far has the crusher got" fails in
two ways that look nothing alike:

- ⛔ **A committed charge makes every candidate identical.** The score ties
  across the whole beam, the sort keeps an arbitrary N, and all N are
  standing in the path — measured, 252 contacts in one depth. The tie-break
  is the player's own clearance from the 32x32 body, and it has to FLIP
  SIGN with the crusher's state: while something is charging the player wants
  clearance; while everything is parked it wants to be close enough to be
  SEEN, because the next charge is the goal.
- ⛔ **The goals are transient.** A chain's intermediate parks are held for
  one tick before the crusher scans again, so a "goals met" count read off
  the END position reads every achieved goal as unachieved — and the score
  DEGRADES as the chain succeeds. Count them per tick, during the drive.

### An escape that works and an escape that helps are different questions

The last charge of L42's first chain has two escapes. One is a 10 px window
in a single tile. The other is "outrun it down the corridor", which always
works and always finishes the player on the far side of a 32 px body in a
corridor with no second way round. A search that asks only *did the player
survive* finds the second every time.

Constrain the END REGION, not just the end position — and state the bound
when the answer is negative: two beams (8-tick blocks, exhausted; 4-tick
blocks, stopped) with zero contacts and zero throws found nothing, and a
10 px window in a 16 px tile is exactly the size a block search steps over.
**Not found is not impossible**, and a heuristic that says otherwise is
lying about its own resolution.

### An options-object silence can be in the CALLER

The known shape is a callee that never destructures a key it is handed. The
mirror image: `plannerObstacleAt(level, x, y, allowTeleporter, opts)` takes
that argument FOURTH AND POSITIONALLY. Passed inside `opts` it is dropped by
a parameter list that never had it — so every "can the player reach the exit"
query silently asked "…without entering it", the answer was always no, and
the search's goal test could never fire. The room read as unsolvable.

### An ordering can be a dependency even when it was written as a route

`L40_CHAIN`'s eleven links are numbered by the order a WALK MEETS them, which
invites the reading that a link nothing consumes is a cul-de-sac. Asked
properly — flood with the link SHUT and see what is still in reach — L40's
link 4 gates the two buttons that arm the pulser, the pulser is the only
thing that moves the block off the boss-key chamber's approach, and the whole
tail hangs off it. Every OTHER activator in the level open by fiat and the
two buttons are still unreached: that necessity arm is what turns "this link
cannot be opened" into "the chain from this arrival stops here".

## R5 slice 18: a finer step is not a stronger search

### A span's `key` is a held SET, and reading it as one name is a silence

Every verb in `botDriverV2` hands `run.advance` a held set built by the walk
machinery, which produces diagonals routinely. `bait.spans` is the one place
a plan AUTHORS the set by name, and it was built as `new Set([span.key])` —
one string, whatever the string was. That is right for every L41
choreography (`left`, `down`, `null`) and silently fatal for the first one
that needs two axes at once: `applyInput` is four independent
`held.has('up'|'right'|'down'|'left')` tests, so a set holding the single
string `"down+right"` matches none of them and the player STANDS STILL for
every tick of a choreography whose whole point is that it moves. The only
symptom is a crusher that parked somewhere else.

`heldFromKey` splits on `+` and refuses a token that is not in
`tapeFormat.KEY_CODES`, the one canonical table — because an unrecognised
name is loud at the boundary or it is a motionless player three hundred
ticks later. Same shape as the `bait` verb's own first call one slice
earlier: an authored input whose SHAPE was never checked, because nothing
had ever authored one.

### Two overlap conventions in one class are a place to STAND, not just a bug

`laneHitsPlayer` is inclusive on all four edges where every other overlap in
`crusher.js` is strict — eleven lines apart, and slice 15 recorded it as a
hazard for measurement. It is also the only reason L42 is solvable. A
crusher parked at entity `(80,224)` has body `[64,96) x [208,240)` and an
east lane `[64,160] x [208,240]`; a player box with `y == 240` is INSIDE the
lane and OUTSIDE the body. So there is a stance from which the charge can be
triggered and which the charging body passes one pixel above — and the col-6
shaft, the only break in that corridor's floor inside the lane, is where the
player stands to use it.

The band's other edge is set by LAST-MATCH-WINS rather than by the room:
`DIRECTIONS` is E,N,W,S with no `break`, so a stance in both the east and
the south lane is charged at from the south. `box.x` must clear 96, so the
band is entity `x ∈ [99,110]` — twelve pixels, worth `x - 98` ticks of
margin. Deriving it from the two functions rather than quoting the earlier
arithmetic moved its west edge by one pixel.

### A finer step is not a stronger search

The previous slice drove L42's first chain to a park a search chose and
finished the player on the wrong side of the body, bounded its own negative
honestly, and attributed it: *"a ~10 px window in one 16 px tile is exactly
the size a block search steps over."* So the next step was prescribed as a
one-tick search of that single charge.

Measured, with the same beam and the same driver, the arm that finds the
escape is the COARSEST one run — 8-tick blocks, at depth 26 — and the
prescribed one dies. Two of the three arms die for DIFFERENT reasons, which
is why the counts matter more than the verdicts:

| arm | result | at the death |
|---|---|---|
| 8-tick, confined to col 6 | FOUND, 216 ticks | depth 26 |
| 4-tick, not confined | died | 108/108 successors RUN OVER |
| 1-tick, confined | died | 72/72 successors ALREADY SEEN |

The unconfined arm is refused by the ROOM. The 1-tick arm is refused by
ITSELF: every successor is a state the frontier has already expanded, none
is run over or out of bounds — and with an EXACT dedup signature in place of
the rounded one it dies at the same depth for the same reason. **A beam over
a MOVING world may not dedup across depths on the world state alone.** A
crusher one tick from committing and one that committed sixty ticks ago are
the same `(x, y)`, so "wait one more tick" is a move the search cannot
express.

And a block search's reach is `block x depth`: shrinking the block shortens
the horizon and multiplies the ways two candidates look identical. What was
missing was a score that knew where the escape was — a proposer's problem,
not a resolution one. **A search reports a property of the triple (score,
granularity, constraint)**, and naming one of the three is how a negative
gets the wrong cause attached to it.

### Progress is arc length along the ordering, not distance from home

A chain that walks a crusher BACK the way it came makes `|current - home|`
decrease for most of its charges, so a beam scored on it rewards standing
still. The score has to be cumulative distance along the ordering's own
sequence of parks: find the segment the body is currently on, add the
lengths of the segments before it. And the positional hint has to be keyed
on the crusher's phase — once a charge commits, every candidate shares the
crusher and a score made of crusher progress ties across the whole beam, so
a wildcard key for "while the body travels along this row" is what tells the
player where to be while nothing it does can change the crusher.

### A distance hint is not a constraint

The escape from an eastward charge in L42's top room is a single dead-end
tile: the room is two tiles tall, a `Crusher` is 32 px, and the other
crusher's parked body closes the far end. Given that tile as a distance term
in the score, the beam ran the player east ahead of the charge instead of
ducking into it, and died with every one of its 90 successors run over.
Given the same tile as a WALL — the player's box may not pass a column —
the equivalent search one room below found its escape on the first run.

When the escape is one cell and everything else is fatal, the search has to
be forbidden the alternatives rather than scored away from them. A hint
expresses a preference over a continuum; a corridor with one door is not
one.

### The freeze gates are a FOUR-way split

The three recorded shapes were: return on `Game.freezeObjects` (Bob,
BobSoldier), parked by `Mobile` (Spinner), and no freeze test at all
(Puncher, BombPusher). `IceTurret` is a fourth: its `update()` DOES test the
flag and return — and it calls `super.update()` on the line ABOVE that test.
So its shooting is frozen and its motion is not. A dead turret being pushed
across a room keeps gliding through a pickup ceremony's 150 frames.

Read the gate's POSITION relative to the `super` call, not just its
presence.

## R5 slice 19: the wall found what the hint could not, and the round trip closes

### Raise the wall PER STAGE, not over the whole search

Slice 18's lesson was that a single escape tile has to be a constraint and
not a score term. The obvious way to apply it — confine the whole search to
the escape's column — is wrong here, and the reason generalises. L42's
return chain is three charges: the first needs the player inside the
crusher's WEST lane (`box.right >= 112`), the third needs the player inside
the nook's own column (`box.right <= 112`). A confinement that held for the
whole chain would forbid the charge that starts it.

So the wall is keyed the same way the positional hint is — on the crusher's
own position — and reads "while the crusher is anywhere on row 96, the
player's box must lie inside `[96,112]`". With that one term added to a beam
that is otherwise identical (same 8-tick blocks, same width, same
arc-length progress, same prefix), the search that died at depth 43 with
90/90 run over finds the chain at depth 47.

A constraint is a statement about ONE stage of a plan. Writing it as a
property of the search is what makes it look impossible to add.

### Last match wins is a mechanism, not a quirk — twice in one room

`DIRECTIONS` is `E, N, W, S` and the scan loop has no `break`, so a stance
inside two lanes is charged at from whichever matched LAST. Slice 18 found
that this sets the west edge of chain 1's stance band. Slice 19 found it
deciding the whole of chain 3: row 7 at cols 4,5 is free, below the swept
volume, and would be a perfectly good second escape from the eastward charge
— except that a box there is inside the crusher's SOUTH lane as well as its
east one, so presenting the player there charges the crusher the other way
and the chain never happens.

Which means the nook really is the only escape, and the reason is half
geometry and half iteration order. A model that recorded only the geometry
would have called the confinement over-tight.

### The same one-pixel seam, in the other axis

`laneHitsPlayer` is inclusive on all four edges; the swept body's own
overlap is strict. Chain 1 rides that at the southern edge of a horizontal
lane; chain 3 rides it at the northern edge of the same lane one room up. In
the nook the trigger-and-survive band is twelve cells wide and every one of
them has `box.bottom` exactly 80 — the body's own top edge. The beam does
not have to land on that pixel: it can trigger from a tenth of a pixel
inside the volume and rise out of it inside the `box.x - 96` ticks the body
takes to arrive, which is exactly what the found chain does (its resting box
ends 0.08 px clear).

### A multi-charge bait's `dir` is the NET displacement

`runBait` derives the direction it reports from `after - before`, on the
reading that a charge is committed at rest and never re-aimed — true of ONE
charge. A chain is three, and chain 3 goes W 112, N 128, E 128: net
`(+16,-128)`, so the record says `N` while the last charge is `E`. Chains 1
and 2 both report `E` and both happen to end on an E charge, which is why
three drives were needed before the field disagreed with itself.

Nothing consumes the field, so nothing broke. What it costs is a reader —
and the fix in the assertions is to compare PARKS, which are what phase 2
plans against.

### In a pursuit room, the obvious control drives the mechanism

L42 has no flag to withhold: no rock shields its crushers, no lock gates the
room, no item is needed. The natural control is therefore the same tape with
the choreographies emptied and every walk kept. Measured, that arm is inside
a crusher body on 1,127 ticks and moves both crushers — because each walk
was planned from the cell the choreography before it ended in, so the player
starts it somewhere else and the replayed spans carry it into the lanes.

This is §29.7's finding one room along, and in a pursuit it is structural
rather than accidental: 172 of the arrival's 304 free cells are safe, so an
unplanned walk IS a trigger. The recorded control is the tape CUT at the
first bait's stance — a cell that is one step outside all eight lanes, which
is exactly what makes it a stance — and standing still there is a claim
about 1,652 null scans, not an absence.

### Read a park at the last tick in the ROOM, not at the end of the tape

This window ends in L40. `run.crushers` there is the next room's map, so a
check written as "both bodies are still on their parks at the end" compares
two `undefined`s and passes. The audit already walks every tick; the last
one whose level is still 42 is where that question has an answer.

### Use the `--win` channel for anything longer than a few hundred ticks

`verify-seedling-bot-differential.mjs` has two replay channels. The default
drives local headless Chromium on SwiftShader, where the recompiled game
runs at **~0.5 ticks/s** — the constant is measured and stated in the file's
own header. `--win` drives real-GPU Windows Chrome from WSL at **~24 fps**,
a 44× speedup, with identical physics (a deterministic tick loop does not
care what draws it).

Concretely: a 1,920-tick tape is **86 seconds** on `--win` and **~64
minutes** headless — against an 82-minute deadline, i.e. 25% headroom. Any
competing load on the box eats that headroom and the tape times out near the
end, which looks exactly like a dead bot.

Two mis-diagnoses were paid for on the way to relearning this, and both are
worth naming because they are the shapes a slow-oracle failure takes:

- **30 identical `[pageerror] A valid external Instance reference no longer
  exists` lines read as "the instance crashed early."** They are the last
  sixteen seconds of a poll loop that outlived its deadline — the harness
  prints the last 30 page-log lines, so a spinning poll fills the window
  regardless of when it started spinning.
- **A 30-tick fixture passing in 119 s read as "boot-dominated, so the
  harness is healthy."** At 0.5 ticks/s that is 60 s of replay and 60 s of
  boot. Dividing it out is what says a 1,920-tick tape needs an hour.

Read the harness's own measured constants before inferring a mechanism from
its symptoms. Both readings above were available to check in the same file
that produced the symptom.

## R5 slice 20 — the wand room is a trap, and an alive ice turret was never a wall

Two things a reader gets backwards, and both were in the notes for slices.

### L43: collecting the wand seals the only way out

`BossTotem`'s census row said *"escaped south during its 240-tick rumble"*
for four rungs. There is no escape south to time. `Wand.tset` is 0 and the
Wand's `removed()` walks every `Activators` in the world setting
`activate = true` where `n.t == tset` — and L43's **three `fallrock`s are
all tset 0**. One of them, `fallrock@176,384 {tag 3}`, lands on tile
**(11,24)**: the unique open tile of row 24, which is the mouth of the
col-11 shaft `stairsup@176,464` sits at the bottom of.

```
  flood from the wand's own cell, 8 px lattice
    rocks overhead   327 cells   stairs REACHED
    rocks landed     279 cells   stairs GONE
```

The other two seal the side alcoves, which nothing needs, so the seal is one
rock. And it is permanent: `fall()`'s first line is
`Game.setPersistence(tag, false)` and the constructor reads it back, so
every later visit finds the shaft plugged. Since every pit in L40 is a
one-way transport into L43, **after the wand every L40 pit is a one-way trip
into a sealed room.**

North is no better. The freeze the rocks impose runs from the publishing
tick to **A+185**, `fullyActivated` lands at **A+215** and the clamp
(`p.y := 212`, an assignment at the top of `BossTotem.update()` with no
freeze test above it) bites at **A+216** — 31 live ticks against the 160 px
`teleporter@144,64` is away. And before the wake the boss is
`type = "Solid"` across all five arena columns, so north is shut by
collision before the wand and by assignment after it, with no gap between
them. **The room opens on the boss's death and at no other time.**

The full tick table is `r5Totem.L43_BOSS_WAKE.ticks` and
`probe-seedling-r5-l43-boss-wake.mjs` re-derives every number from stepped
loops rather than closed forms.

⚠ One thing the ceremony vocabulary did not have: **the wand pickup is
input-bounded.** `Wand.text` splits on `~` into two segments and `NPC.update`
advances only on `Input.released(Key.X)`, so a tape that presses nothing
sits frozen for ever. Every other R5 ceremony is a fixed 150.

### The tenth per-visit family, and the `if` that was misread

`ENTITY_CLASSES.iceturret` priced the live body as an unconditional 32x32
solid, on the reading that `type = "Solid"` is the else-arm of the
attack-range test. It is the else-arm of
`if (sprIceTurret.currentAnim != "dead")`. So an **alive ice turret blocks
nothing**, a corpse blocks only from the first tick the player's box is off
it, and nothing ever writes the type back — the flip is a latch.

`iceTurret.js` is the family; `liveRectOf`'s turret arm is the only one in
the chain that **never falls through to `s.rect`**, because absent run state
means *not a solid* rather than *still where the level built it*. That makes
`turrets` the one option key in `stepV2` whose absence UNDER-blocks: every
other family's key makes a solid go away, this one makes one appear.

The correction is worth +16 lattice cells in every arm of
`L40_ARRIVAL_BREAK` and changes none of its verdicts — a constant shift in
all four arms cannot move a comparison between them.

### A press is five bumps, so the parity stopped mattering

Slice 19 measured ONE `bump`, found that a standing corpse is a two-cycle
whose phase decides which way a push moves it, and concluded that a fire
press's tick parity was load-bearing and inexpressible.

`FIRE_WINDOW.hitTicks` is `[4,5,6,7,8]` and `Player.genericHit` calls
`IceTurret.bump` before `Enemy.hit` on **every dispatch of every hit tick**.
One press is five bumps on five consecutive ticks, and the turret updates
before the player, so bumps 2..5 re-aim a body that is already moving.
Whichever phase bump 1 lands on, bump 2 lands on the other; the refused
direction travels half a pixel and is back in two ticks. All four cardinal
pushes move a tile from both parities.

⇒ **a verb whose effect is a SEQUENCE cannot be priced from one application
of its primitive.** `fire.bumps` takes a stance and a count, `to` is a tile
(the box straddles a boundary on one half of the cycle, the entity does
not), and the resting position differs by half a pixel between parities —
something an assertion allows for, not something a plan steers.

### And the kill is the blocker

The corpse is built and the bump is driven; the leg cannot run because **no
enemy in this model is killable by any weapon**.
`presses.PRESS_ARM_POLICY.Enemy` is `refused` — *"a death moves
totalEnemies(), which opens tSet == -1 locks"* — and the four modelled
sword/spear arms are `Tile`, `PushableBlockSpear`, `BreakableRock` and
`LightPole`. Fire is not a way round it: `Enemy.hit`'s
`if (hitByFire || t != "Fire")` sends a fire hit to the empty `knockback`
override, which is exactly why the bump could be modelled without a damage
model and why the kill cannot.

## R5 slice 21 — the kill is built, link 4 is repaired, and the blast is the machine

`enemyDamage.js` is the first predictive Enemy arm this model has ever had:
every rung before it either avoided enemies, drove a kill in the GAME and
read the result off the observation stream (R5 slice 3's L60 pair), or
refused the press outright.

### `destroy` is not removal — a body counts for eleven ticks after its animation

`combatVerbs.killWindowTicks` is `1 + deathTicks(tag)` — the hit test's
one-tick lag plus the death ANIMATION, "during which the body is still an
entity `Game.totalEnemies()` counts". That is half the wait.

`Mobile.mobileUpdate()`'s last line is an UNCONDITIONAL `death()`, and
`Mobile.death()` is `alpha -= 0.1; if (alpha <= 0) FP.world.remove(this)`.
`Image.set alpha` CLAMPS to [0,1], so the read-modify-write goes through a
clamp — and ten subtractions of 0.1 from 1 leave `1.3877787807814457e-16`,
which is not `<= 0`. The **eleventh** is the one that removes.

```
  bob         25 anim + 11 fade = 36   against killWindowTicks 26
  jellyfish   35 anim + 11 fade = 46   against 36
```

The L60 kill pair passed anyway, and the reason is worth keeping: its
assertion is the EFFECT read off the game, and `killSchedule`'s SLACK press
bought 31 ticks of margin over an arithmetic that was 11 short. A schedule
that had trusted the arithmetic and dropped the slack would have ended the
walk standing at a shut lock. The thing that saved it was not the thing
that was checked.

`Math.ceil(1 / step)` is the closed form and it is off by one for 0.1,
which is why both fade counts are run as LOOPS — and cross-checked against
`activators.opensOnTick`, a different module's transcription of the same
float question.

### `Enemy.hit`'s gate chain is five deep, and the fourth is in no brief

```
  1  (hitsTimer <= 0 || hitByDarkStuff) && !Game.freezeObjects && canHit
  2  onlyHitBy == "" || onlyHitBy == t        else: justKnock -> knockback
  3  hitByFire || t != "Fire"                 else: knockback, NO i-frame
  4  hits < hitsMax                           else: NOTHING AT ALL
  5  hits >= hitsMax after `hits += d`        -> startDeath(t)
```

Gate 4 is what makes a slack press a true no-op instead of a second death:
a body already at `hitsMax` — mid animation, mid fade — takes no damage, no
knockback and no i-frame refresh.

Gate 1 has a LATCH in it. `hitByDarkStuff` is assigned
`(t == "Shield" || t == "Suit")` on every damaging hit and sits in the gate
as an OR against the i-frame, so one Shield hit makes every subsequent hit
land regardless of cadence until a non-dark hit clears it. No weapon this
rung carries sets it; a cadence rule derived without it is wrong for
exactly the ones that do.

**Damage and i-frames go opposite ways under a freeze.** `Enemy.hit` carries
`!Game.freezeObjects` INSIDE its own gate, so no damage lands during a
ceremony; `hitUpdate` is reached from `Enemy.update`'s tail, which has no
freeze test at all, so the timer keeps running down. Off screen NEITHER
runs — `Enemy.update`'s first line returns above everything.

### The cadence margin is one tick

A landed hit sets `hitsTimer = 30`. The body's `hitUpdate` runs BEFORE the
player each tick, so thirty decrements land on the thirty ticks after and
the gate is open again for the player's update of the thirtieth.
`KILL_PRESS_CADENCE` is 31 and clears it by one; 29 does not, and the
stratum drives all three rather than asserting the constant.

One press is at most ONE landed hit: `slashDelayMax` is 0, so `slash()`'s
hit test runs on every tick the flag is up — five of them — and the i-frame
refuses four. Which is the mirror image of `fire.bumps`, where five
dispatches are five EFFECTS.

### A turret kill does not move `totalEnemies()`, and the lift is per class

`IceTurret.death()` INTERCEPTS the first `destroy`: hitbox to 16x16, "dead"
anim, `destroy` back to false, Enemy/Player pushed onto its own solids. The
entity is never removed and `classCount(IceTurret)` is unchanged, so a
`tset == -1` lock in its room stays shut. It moves only if the CORPSE later
self-destroys — and from a pit that removal is immediate, because the
descent's own twenty-tick fade has already driven the same alpha to zero.

That is why the R4 blanket refusal (`PRESS_ARM_POLICY.Enemy`, "a death
moves totalEnemies(), which opens tSet == -1 locks") lifts for ONE class
rather than for the family. `KILL_ARM_POLICY` is an enumeration over
`combat.js`'s two tables with every refusal carrying its own reason —
`Turret` is refused BY NAME, because the plain one has no `death()`
override and its kill really does move the count.

The machinery still COMPUTES the nil rather than skipping the scan: "there
were no kill locks" and "nobody looked" print the same thing.

### A `Button` is pressed by an `Enemy` as readily as by a `Solid`

`Button.update`'s hitables is `["Player", "Enemy", "Solid"]` and it excludes
only a `Cover`. An `IceTurret` is `type = "Enemy"` while it lives and
`type = "Solid"` once the corpse latches — so it presses on BOTH sides of
the kill, and `levelRun.movingSolidsNow` has to carry every body, not only
the standing corpses. Without that the whole corpse-hold is a model that
says the button never goes down.

### Link 4 is repaired, and the chain stops one link later

`L40_ARRIVAL_BREAK`'s verdict is that the chain from the L40 arrival stops
at `button@480,384 {t 2}` because "no block in the level can reach" it.
Every clause of that is still true — **a corpse is not a block**, and the
kill stance is inside the links-1–3 component, so the walk that opens link 4
does not need link 4.

```
  links 1-3, link 4 SHUT       844 cells   kill stance ⛓   button t2 ⛓
  + the CORPSE on button t2   1052 cells   button t5   ⛓   button t4 ⛔
```

What replaces the old verdict is sharper: `button@816,400 {t 4}` is behind
`wandlock@800,400`, whose only opener is the t5 button, and standing on the
t4 button with that lock shut leaves **8 lattice cells and no way west**.
So link 5 needs a HOLDER while the player crosses, L40 can make exactly ONE
corpse, and it is already spent on link 4 — which is what makes the t5
button reachable at all. One corpse, two holds, strict dependency.

### A ±2 node window at an 8 px lattice is a whole tile

`probe-seedling-r5-l40-link4.mjs` reports the t4 button REACHED in its
link-4 arm. It is not: `touches()` there tests ±2 nodes — 16 px past the
point — so it answers "is the walk within a tile of this" and reads as "the
walk gets here". Three of its rows are REACHED under it for cells the
planner then refuses outright. Right arithmetic, wrong tolerance. A
probe's tolerance is not a free parameter; it is the claim.

### `Bot.noDamage` prices the damage and not the FREEZE

The L40 kill pair was recorded against the real game and DIVERGED at tick
1616 of 1965 — in BOTH arms, at the same tick, by the same 0.8 px, settling
at a permanent 14.15 px y offset. The fixtures were withdrawn rather than
committed.

```
  case "Player":
      (hits[i] as Player).freeze(freezeTime);              // 15 ticks
      (hits[i] as Player).hit(null, 0, new Point(x, y));   // Bot.noDamage
```

`Player.hit`'s WHOLE BODY is behind `if (Bot.noDamage) return`, so the
damage really is free. `freeze()` is the line ABOVE it and is guarded by
nothing — and `Player.input()`'s own gate is `if (!receiveInput ||
frozenTimer > 0 || fallFromCeiling) return`. The recording shows a NINE-TICK
dead stop the model walks straight through.

"Damage taken is priced, not forbidden" is half the rule: nothing prices
the freeze, and a freeze is a displacement. The turret's capability set has
three members — a 32x32 body, contact damage, and a projectile that stops
the player — and the leg was priced against a model that had only the first.

That the CONTROL diverged identically is the proof of cause: the two arms
differ only in the three kill presses, so a divergence byte-identical in
both is a property of the WALK. The pair was authored to isolate the kill
and it isolated something else, which is the pair doing its job.

`attackRange` is 128 and the slash reach is 16, so every stance that can
kill one is 112 px inside the volume the blasts come out of. There is no
approach that is out of range — which is why `runKill` refuses to be
authored without a `blastsUnmodelled` declaration and the plan script
refuses `--write` outright, rather than a re-route.

### The wand's gate reads a save array the tape format cannot reach

`Wand.update`'s whole body is behind `p.y < y + Tile.h &&
Player.hasAllTotemParts() && !p.fallFromCeiling`, and `hasAllTotemParts()`
reads `Main.SAVE_FILE.data.hasTotemPart[]` — a DIFFERENT array from
`levelPersistence`. `Bot`'s boot block honours exactly two kinds of state,
`grants` (Inventory items) and `persistence` (levelPersistence tags), and
there is no third. So a window that BOOTS into L43 has zero totem parts and
the pickup is inert. The `|| !doBossActions` arm is dead — `doBossActions`
is a `private var` initialised true and never assigned.

The only path is the L43 window as the TAIL of a page that has already
collected all five parts in the real game. The terminal wand window is
blocked on the ITINERARY, not on the ceremony.

## R5 slice 22 — the blast is built, and the camera decides where the turret stands

`iceTurretBlast.js` is the **eleventh** per-visit family and the **first
projectile**: three bodies per volley at 6 px/tick from the turret's own
angle, `hitables` `["Player","Tree","Solid","Shield"]`, removed on the
first contact, and a `Player.freeze(15)` that no damage policy touches.

### The recording that refuted it is what proved the fix

Slice 21 recorded both arms of `r5-l40-part5`, they diverged, and the
fixtures were withdrawn. The two `--win` streams were still staged under
`C:\playwright\` — so the acceptance cost **no new recording**: the same
two tapes through the corrected model are byte-identical to the real game
for all 1,966 observations of both arms. A free oracle made *before* the
model that now matches it is a stronger gate than a fresh recording.

Generalisable: **a withdrawn recording is evidence, not waste.** Keep the
stream and the tape that produced it; the next model that claims to explain
the divergence has to land on it exactly.

### The freeze is fourteen, and the divergence tick is not the contact tick

`freezeStep()` is at `Player.as:532`, ABOVE `super.update()`, so the
contact tick's own decrement lands before `input()` reads
`frozenTimer > 0`: **a freeze of 15 refuses FOURTEEN ticks**, the first of
them the contact tick.

The recording's first visible disagreement is 1616; the contact is at
**1614**. `Player.input()`'s direction arms are themselves gated —
`if (v.y > -moveSpeed) v.y -= accel` — so a blocked input on a fast tick
and a live input on a fast tick produce the same number. Two silent ticks,
five of friction decay, then nine of dead stop.

⇒ **a divergence tick is a statement about visibility.** Reading it as the
event is how a cause gets looked for in the wrong place.

### `onScreen` decides where an enemy IS, not only whether it moves

Modelling the projectile was not enough: with `stepIceTurretsNow`'s
declared `onScreen: true` the contact landed 33 ticks late.
`Enemy.update`'s screen gate returns out of `Mobile.mobileUpdate`, and
`IceTurret.input()` **snaps its own y by 8 px** on the first tick it runs.
So the camera decides where the body stands, which decides when the player
crosses its 128 px range, which sets the phase of a 45-tick volley clock:

| | body stands at | range entry |
|---|---|---|
| `onScreen: true` from tick 0 | y 424 | t1526 |
| camera live | y 416 | t1532 |

`camera.js` — transcribed at slice 2 for the contact envelope and consumed
by nothing for twenty slices — runs live in `levelRun` now. It changed no
committed fixture.

### Four more from the source

- **the ctor truncates** — `IceTurretBlast(_x:int, _y:int, _v:Point)`, so
  the off-centre spawn points are truncated toward zero; the velocity is not;
- **`friction()` still runs with `f = 0`** — the `normalize` is an identity
  and the two `< 0.05` zeroing tests are not, so a near-axis shot loses its
  cross component permanently on its first tick;
- **neither the collision test nor the spritemap is freeze-gated** — only
  the move is, so a ceremony does not stop a volley already in the barrel:
  `endAnim` spawns on schedule through frozen frames;
- **there is no off-world bound** — `Mobile` has none and `Enemy`'s is
  commented out. The model prunes only what provably cannot reach anything.

`hitables` is a **third** solids list: a blast stops on a `Tree` (a crusher
does not) and flies through a `Rope`/`ShieldBoss`/`LavaBoss` (the player
does not). `levelWorld.collidesBlast` exists for that.

### A byte-identical-walk pair is impossible in a room with a live shooter

The old control was this tape with the kill spans deleted. Deleting the
kill leaves the turret ALIVE and firing, so the control takes freezes the
drive never sees — and one of them lands on a surviving fire press, where
`Player.input()` returns at its first line and `useItem` is never reached.
**The press is lost.** And a kill-less arm cannot be synthesised at all,
because `runFire`'s bump arm refuses a live turret by name.

⇒ the shooter's volley clock is a function of whether it died, so the
isolating variable stops being isolated at the moment it takes effect. The
pair isolates the **hold** now: same walk, same kill, one `fire.bumps`
press fewer, and a corpse one tile short of the button. The control is a
byte-identical PREFIX of the drive.

Three verbs came out of authoring it: `holdUntilUnfrozen` before every
press, `wait.staysShut` (the shut-before arm's own verb, checked on every
tick rather than at the end), and a `fire.bumps` proximity-hazard exemption
that had been riding on the `kill` target that always preceded it.

### Link 5 has no holder, and the corpse cannot cross

Enumerated over every class L40 holds, against `Button.update`'s hitables
and three properties — TYPE, PLACING, STAYING. Sixteen classes carry a
hitable type; **one** passes all three.

The enemies fail on **staying**, not on type: a Bob *is* an `"Enemy"` and
it *is* lurable, and the lure is the player. Killing one on the cell buys
the death animation plus `Mobile.death()`'s eleven-tick fade — **36 ticks
against a `Lock`'s 101 continuous.** A body that fades is not a holder.

And the open question — can the corpse be bumped the 17½ tiles east? — is
answered by a BFS over the corpse's tile with the activator set a *function*
of that tile, every edge a driven five-bump press: **35 tiles reachable,
east-most column 31, goal at column 48. No.**

⚠ The search's first cut returned one tile, because it asked
`bumpIceTurret` ONCE. A press is five bumps; a single call from a body at a
tile centre targets `round(x/16) ± 1` = `tile` and `tile + 2`, so every
direction decodes to "no move".

### A tolerance is the claim — and it was three errors, not one

Slice 21 fixed the ±2 window in the *copy* and left the original rotting.
Fixing the original found two more the tolerance had hidden:

1. **tolerance** — the code swept `-1..2`, so 32 px, two whole tiles;
2. **volume** — a 16x16 box per entity, when a `button`'s press rect is
   **8x6** and a `bosskey` is **8x8**;
3. **the question** — one predicate for all targets. A `Teleporter`'s own
   cells are refused by `plannerObstacleAt`, so "can the walk stand on it"
   has a guaranteed answer. The kind is derived from the planner's verdict
   now: stand-on where the cells are walkable, stand-beside where not.

Exactly one row moved in the direction that mattered, and it moved to agree
with the probe that had reached the opposite conclusion independently.

---

## R5 slice 23 — the second AS3 batch, and the family behind the wall

The rung's second and last build. Slice 22 hit ONE wall — `Wand.update` is
gated on `Player.hasAllTotemParts()`, which reads `SAVE_FILE.data.hasTotemPart[]`,
and `Bot`'s boot block honoured only `grants` and `persistence` — and wrote
it down as an instance. **It was a family.**

### The audit: thirty fields, a disposition each

`r5Acceptance.SAVE_FILE_AUDIT` diffs every `SAVE_FILE.data` field against
what the boot block can present. Nineteen were already covered (thirteen
item booleans via `grants`; `hitsMax` via `grants: health`, an ADD; `primary`
via `equips`; `levelPersistence` via `persistence`; level and spawn via
`boot`). **Three were unreachable and all three are arrays gameplay reads:**

| field | slots | the gate it opens |
|---|---|---|
| `hasTotemPart` | 5 | `Wand.update` ← `Player.hasAllTotemParts()` |
| `hasKey` | 5 | `BossLock.update` ← `Player.hasKey(keyType)` |
| `hasSealPart` | 16 | `FinalDoor.update` ← `SealController.hasAllSealParts()` |

⛔ **`hasSealPart` is an INT array with IDENTITY SLOTS** — the one way to
build this field wrong and have it read right. `getSealPart(index)` writes
the *identity* into the first slot still holding **-1**, and
`hasAllSealParts()` is `Main.hasSealPart(SEALS - 1) != -1` — *the last slot
being filled*. A boolean reading would satisfy the ending's gate with sixteen
writes of any value at all, and the empty value being -1 rather than 0 is
what makes that silent. So a v6 tape declares the **collection order** and
`botStart` fills slots 0..n-1; `totem_parts` and `keys` are sorted and
`seal_parts` is deliberately not.

Six fields are DOCUMENT-SKIP with a reason each. Two of them (`beam`,
`rockSet`) are one `moonrock` in level 0 whose only lasting effect is a
persistence clear (`{0,2}`) the boot block already reaches — **the
capability exists under another name**. And `firstUse`/`extended` are the
inventory tutorial, which matters because `Inventory.as:178` sets `extended`
as soon as `Player.hasTotemPartNumber() > 0`: **the new boot field flips a
field the audit classified as skip**, and the flip is inert only because
R1's `Inventory.help = false` already exists.

### Tape version 6 — the `save` block

```json
"tape_version": 6,
"save": { "totem_parts": [0,1,2,3,4], "keys": [], "seal_parts": [7, 3] }
```

Applied in `botStart` **before the first world is built** — the persistence
site, for the persistence reason: `BossTotemPart.check()` and
`BossKey.check()` remove themselves when the player already holds their
index, and `check()` runs on a new world's first frame. Value-scoped, not
presence-scoped, like every field before it. Read back two-sidedly from the
GAME as `botStatus.save`.

### `botMobiles()` — a readout that is its own callback

The enemy-state readout the arc has owed since slice 3, shipped as **raw
fields per entity** and as a **separate `ExternalInterface` callback**
rather than a field on `botStatus`.

That is the design and not a detail. `botStatus` is polled to detect the end
of a tape, on the same thread as the loop whose render/update **ratio** the
dead-frame band rides on — so a world walk plus reflection plus a few KB of
JSON on every poll is a determinism risk. **A callback nobody calls is inert
by construction**, which is stronger than a flag defaulting to off.

⛓ The set is `Mobile`, not `Enemy`. `Enemy` is what the wall named, and
picking it would be a guess about which movers a later question is about —
R5's two hardest measurements were about an `IceTurretBlast` and a
`PushableBlock`, and neither is one. Rows carry position, velocity, `type`,
`destroy`, anim/frame/alpha, `onScreen()` and the box, plus a nested `enemy`
object that is `null` for a row that is not one. **`alpha` is in there
because `destroy` is not removal** and the eleven-tick fade is the only
thing that tells a corpse mid-fade from one that is gone.

### `Math.random` is a fixed-seed LFSR — so the camera needs no flag

The batch was asked to EVALUATE a `Game.shake` determinism flag. The answer
is no, and it comes from the runtime's source rather than from an argument:
`SWFModernRuntime/src/avm2/avm2_number.c:430-486` implements `Math.random()`
as a 31-bit XOR-shift LFSR over one global `g_avm2_rng`, seeded from
`MOCK_DATE_TIME` — **a `-D` at build time**, defaulted to `981152406000`.

⇒ a shaking camera cannot make a recording flaky, which is what "determinism
pin" meant; what it costs is knowing the global draw count. And forcing
`Game.shake = 0` would create an execution vanilla cannot produce — a crutch
wearing a pin's name. ⚠ The seed is baked into the artifact: the hash is
what pins it.

### The twelfth family — `BossTotem`, and `collider: 'none'` for 22 slices

`ENTITY_CLASSES.bosstotem` said it does not block. `BossTotem.update` ends
its activation block with `if (activated) { type = "Enemy"; … } else { type
= "Solid"; }`, so an **unwoken boss is a Solid** — `[112,192) x [180,212)`,
exactly L43's arena columns 7..11, the whole width of the room. Nothing had
ever been in the room, so nothing could notice.

It is the ice turret's `liveRectOf` arm run backwards: **absent run state
means SOLID here and NOT-solid there**, and both defaults are load-bearing
in opposite directions.

⛔ It also corrects the slice-20 seal flood, in the direction that makes the
finding stronger: **237 / 189 cells**, not 327 / 279. The 90 nodes are the
arena north of the boss, shut by collision until the wake. The verdict —
stairs reached before the drop, gone after, by one rock — is unchanged in
both readings, and both numbers are kept because the difference IS the wall.

### The wand window, and a fourth control shape

`r5-l43-wand` / `-control` boot into L43 at tile (9,13), take the wand, and
are caught by the boss's clamp.

⚠ **The `boot` block is `new Game(level,x,y)`'s arguments, not the entity
point** — `spawnFromBoot` adds `(Tile.w/2, Tile.h/2)`. Writing the tile
CENTRE spawns a whole tile east and walks straight past a 3 px press rect,
with no error anywhere.

Three findings the plan did not have:

1. **The fade is 99 frozen frames, not 100, and it fires on APPROACH.**
   `Wand.update`'s gate is `p.y < y + Tile.h && hasAllTotemParts() &&
   !fallFromCeiling` — a half-room-wide test on the player's Y alone — and
   `Game.freezeObjects = alpha < 1` is written AFTER the step, so the
   hundredth alpha step leaves the flag false and is a live frame. The
   records' `fadeTicks: 100` is the STEP count; the cost is 99.
2. **The three rocks share ONE 186-frame span.** Dropping them one at a time
   charges 186 + 186 + 188 = 560 for a freeze the game spends 186 on: each
   `fall()` raises the flag and each rock's camera expiry clears it with no
   arbitration, so the EARLIEST wins. Invisible for thirteen slices because
   the only other publisher with a rock behind it (L39's rope) has one.
   **And the boss rides that loop** — its rumble and ramp have no freeze
   test, so 186 of its 216 ticks to the clamp are spent inside one model tick.
3. **The clamp is a FLOOR at y 212 and the wand sits at 232.** A window that
   collected the wand and stood still would report "the clamp holds" having
   tested nothing. The drive spends the 31 live ticks between the freeze
   draining (A+185) and `fullyActivated` (A+215) running north through the
   space the wall occupied, reaches 195.60, and is teleported to 212 on
   A+216 exactly.

**The pair is a fourth control shape and the cleanest on the arc.** Both
arms are the SAME TAPE, one boot field apart: byte-identical for ticks 0..9,
parting at tick 10 — the CONTACT — because one arm's world freezes there and
the other's does not. And they stop at the same number by two mechanisms:
the control is walled at **214.05** (the box's bottom edge 212 plus the
player's 2 px origin) where the drive is **assigned** 212.

⚠⚠ The first cut's control COLLECTED the wand. The model gated the fade on
`hasAllTotemParts()` and not the CONTACT — and `Wand.update` gates both,
because `super.update()` (`Pickup.update`, the only caller of
`collide("Player", …)`) is the ELSE of the alpha ramp *inside the same
`if`*. **A control that does the thing it exists to refute is not a weak
control; it is not a control.**

### `WandLock` is a `Lock` with a different sprite

`Puzzlements/WandLock.as` is nineteen lines: `extends Lock`, an embedded
sprite, a constructor that forwards. **No override of anything.** So the
wand ITEM opens nothing — a WandLock needs its group pressed like any other
Lock. L40 link 5's wall does not dissolve one rung later; it is a standing
finding.

### The pair was refuted twice, and only the control could say why

Both arms recorded. Every *semantic* claim held on the first take —
`hasWand`, five parts presented, four earned clears, 456 dead frames against
21, `saw_auto_advance` 0 — and both streams diverged.

**The control dashed.** Its deltas decayed at exactly −0.25/tick from
**2.20** = the coasting 0.20 plus `knockback(2, new Point(x - v.x, y - v.y))`
(`Player.as:788`). The two arms shared a tape whose `primary` presses meant
two different things in it: dialogue advances on the drive's frozen ticks,
**sword dashes** on the control's live ones.

⇒ **an input whose meaning depends on the world is not a shared treatment.**
"The same tape, one boot field apart" was true of the bytes and false of the
experiment. Fixed with the configuration §14.9 already proved inert — a
**31-tick** press cadence, which clears `slashTimer` so no press can dash in
either arm. *Not* "press at rest": the knockback direction is
`(x - v.x, y - v.y)`, degenerate at `v = 0`, with no driven witness.

⛓ And the drive's own residue had supported a different, plausible story.
**A single-arm diagnosis from a single-arm residue is a hypothesis.**

**Then the drive's residue isolated to one step**: `model[t] == game[t-1]`
for three ticks, then exact re-convergence at rest. **A collapsed frozen
span ends on a frame that is dead to the tape and live to the player** —
`Bot.update` reads `Game.freezeObjects` *above* `super.update()`, so the
frame an entity clears it on records no observation, and that entity
(prepended) updates before the Player, who then moves. The game's first
post-ceremony delta was `+1.65` = the model's `+0.95` and `+0.70` summed.

Re-convergence at rest is why it hid for twenty-two slices, and the fix was
validated against **98 committed recordings, all still byte-exact**.
⚠ The fact was already in `dropRocksTogether`'s own docblock — *for the boss
and not for the player.*

**Then both arms came back byte-identical.** The clamp in the game's own
stream: tick 139 `y=197.05` → tick 140 `y=210.75`, **13.70 px in one tick**
against a walk that moves 1.2. ⛔ It does not land *on* 212 — the boss
updates before the player — and two of this slice's own checks had to learn
that, one by searching for the clamp's value and finding the player settling
onto it eleven ticks late.

## R5: enemies come back, as built (CLOSED 2026-08-07)

R5's brief and full as-built record are
`NewDocs/plans/seedling-bot-r5-opus-kickoff.md` (§§8–37 the slices, §38 the
close — NewDocs is gitignored, so the file exists only on the working
machine; this section is the tracked summary).

**The claim, re-derived at slice 22 and closed at slice 23** (§0's "14/14
over one full playthrough" never ran — the honest statement is the
re-derived one):

- **Six of six ceremonies real-collected on byte-exact pairs** — five totem
  parts plus the WAND, the arc's first `hasWand` earned rather than
  granted, in the cleanest control shape on the arc (the same tape, one
  boot field apart).
- **Conch, feather and boss key 1 real-collected** in their own windows;
  water and waterfall ARMED with driven witnesses on both arms; the first
  boss kill driven (`r5-bobboss-fire`, all three BobBoss forms) — with the
  `fire` PICKUP collected by no tape, a named debt.
- **Every link proved, the chain never run** (`R5_ITINERARY`'s verdict);
  `blockedOn` = the L40 link-5 stop + the parts-3/4 boot-vs-arrival gap.
- Gate at close: fork `bot` @ `a9f84ab`, **98 tapes / 1,411 PASS / 0
  FAIL / zero re-records**; 54 files / 2,065 offline tests. ⚠ The wand
  pair (tapes 99–100) was verified `--only=` after that sweep — **the
  roster had never been swept as one run at 100**, which was R6 slice 0's
  first job by the arc's own gate rule.
  ⛓⛓ **DISCHARGED at R6 slice 0** (2026-08-07): `--tier=full --win` at
  clean HEAD `4e1ffe980` — **100 tapes / 1,443 PASS / 0 FAIL**, ~2h05m,
  zero re-records, and the zero proved by a clean working tree rather than
  claimed (the run carried no `--record`, so nothing under
  `fixtures/expectations/` could move).

**What the rung built**: the director (windowed one-page execution),
twelve per-visit geometry families (through `bossTotem.js`), the combat
census + encounter ladder, `enemyDamage` (the enemy side), the verb set
(`swing`/`kill`/`fire.bumps`/`bait`/`wait`/`holdUntilUnfrozen`/
`wait.staysShut`), the camera LIVE in `levelRun`, four control shapes, and
the second AS3 batch: **tape v6's `save` block** (`hasTotemPart[5]` /
`hasKey[5]` / `hasSealPart[16]` — the last is the ending's own gate) and
**`botMobiles()`**, a separate `ExternalInterface` callback inert by
construction and consumed by nothing yet.

**Standing findings** (source-proved; do not re-derive): L40 link 5 has no
holder and the corpse cannot cross; `WandLock` is a `Lock` with a sprite —
the wand item opens nothing; the wand seals its own exit (seal flood
237/189 with the boss wall standing); the BossTotem wake table is
tick-exact through A+438 and everything after `activationRestTime` drains
is unmodelled (`levelRun` throws at A+335); `noDamage` is NOT retired —
three named parts, the camera part downgraded to a modelling cost because
the recompiled runtime's `Math.random` is a fixed-seed LFSR.

## What R5 hands on, and what still blocks the ending

⚠ **SUPERSEDED for every row R6 touched** — see "What R6 hands on, and what
R7 inherits" at the end of this document. This table is kept as R5's own
statement of what it handed over, not as the live blocked list.

Ruled 2026-08-07 (the R6 kickoff records the rulings): **R6 = bosses + the
ending BOOTED** (via the v6 `save` block), staged — the honest
sixteen-ceremony sweep and the full item chain are **R7's line**.

| item / gate | seal | rung |
|---|---|---|
| **BossTotem** ⛓ | `onlyHitBy = "Wand"`, plain shot damage 0.5 ⇒ TEN shots at `hitsMax` 5; L43 opens on his death (`{43,5}`), exit via `magicallock@144,112` (a plain wand shot opens `lockType 0`) | **R6** |
| **shield** ⛓ | ShieldBoss — first hit always swallowed, the only window is `movedShield`, `(19,0)` written the instant the third hit lands; key 0 sits inside his 48×48 Solid body; the shield also makes the Watcher VISIBLE | **R6** (the R5 W7 ruling, executed at last) |
| **fire** (pickup) | spawned by a driven kill, collected by no tape — R5 window 1's blocker | **R6** |
| **the Owl** ⛓ | `onlyHitBy = "Lava"`, `justKnock` — shove him into the 4×4 central lava pool; his rockfall barrage is real gameplay RNG; death fires `Button.activateAll` → the RockLock → L113 | **R6** |
| **the Watcher + FinalDoor + seed** ⛓ | FinalDoor = all 16 seal parts AND `!checkPersistence(0, 114)` (the Watcher's dialogue exhausted); behind it seed → tree → credits (`menuState 2`). The bloody branch (4 hits on the Watcher) reboots to L1 instead | **R6** (booted) |
| sixteen real seal ceremonies | 2 of 16 chests driven (L38, L40); the tail needs shield, spear, D8's kill-lock, deep overworld | **R7** |
| darksword / darkshield / darksuit / ghostsword / firewand | unchanged from the R4 table — D7/D8 access plus the Witch (wand now HELD, so her gate is open) | **R7** |
| the L40 chain (links 5–11, bosskey 2, both north teleporters) | link 5 has no holder, the corpse cannot cross, and the wand opens no WandLock — a STANDING wall for this machinery | **R7** |
| LightBoss / TentacleBeast / LavaBoss | deferred by name — none gates anything the ending needs; TentacleBeast is the game's first RNG-coupled fight | deferred |
| L93's bridge | a TILE (type 29), not a class: one Spear/GhostSword hit then 59 self-decrementing render frames; `type` mutates in `render()` (one-frame lag); no persistence — re-closes every reload. Unit-witnessed on L63 only | R7 (live witness) |

### ⛓⛓⛓ The Owl, searched — and three things the search paid for (R6 slice 6f)

The fight is `levelRun`'s fifteenth per-visit family and the first whose state
includes a random number generator. `stepOwlNow` runs the rocks, the grenades,
the pods and the boss in `World.update`'s order (rocks first, so a rock that
lands on tick N raises the shake tick N's own `view()` reads; the player LAST,
so every position the boss reads is from the end of the previous tick), and
`owlJiggleNow` spends `view()`'s two draws below the player. Every tick asserts
`owlTickDraws(phase) === the stream's delta` — the schedule and the sites are
two computations of one number.

**The plan search, and its triple.** Press ticks x stances on a polar grid,
each candidate a full replay of the real runner. FORBIDDEN rather than scored
away: a stance overlapping the boss's 12x12 box, `distanceRectPoint > 16`, a
push ray pointing away from the lava centre, any tile with `t in {16, 17}`
(**both are lethal** — the ring around the octagon is a 16 px no-go collar, not
a margin), and the four pod cells. The death is banked too: standing at the
stance and waiting is **dead at tick 555**, three hits inside the first
barrage, at every position and seed tried.

- **THE INTRO-DISMISSING PRESS IS THE FIRST SHOVE.** `FinalBoss.update` lowers
  `Game.freezeObjects` at the TOP of the frame, above the player's own update,
  so `Player.input()` runs that very tick and `Input.pressed(keys[4])` reaches
  `useItem(Main.primary)`. One press, two jobs — and `hitThisSequence` starts
  FALSE, so the first lava hit needs no barrage before it. "At least three full
  pod cycles" is one barrage too many: the window endures **two**.
- **95 ROCKS LAND ACROSS TWO BARRAGES AND NOT ONE TOUCHES AN ORBITING PLAYER.**
  `stepsAhead` is -15 and a rock flies 17 ticks, so a moving player puts ~32
  ticks of their own velocity between the aim point and where they are. The
  vulnerable state is the **STANCE**: the one hit the plan takes is a grenade
  dropped at the Owl's own feet, exploding 51 ticks later while the player
  stands still waiting to press.
- **THE FIVE HIT TESTS ARE CULLED AT THE RECT, NOT THE REACH** — 7 of 15 across
  three presses. `justKnock` sets no `hitsTimer`, so the RECEIVER refuses none
  of them; what stops them is `Player.slash` re-running `collideRectInto` every
  tick against a body the previous test threw 8.75 px. A shoved body is not
  COLLECTED, so it never reaches `FP.distanceRectPoint` and the refusal leaves
  no ledger row: the witness is the COUNT.

**And the first recording refuted the model at tick 23.** Every scalar check
passed — dead frames in a one-load band, `saw_auto_advance` 0, `drownTimer` 0,
the grants, all 14 item properties, `menu`/`cutscene` false — and the stream
diverged: the game knocks the player 1.66 px west in one tick where the model
walks on. ⛔ **`game hits 1 == model hits 1` passed while meaning nothing** —
the model's hit is a grenade at tick 842 and the game's is at ~22. A hit COUNT
is not a witness that you modelled the hit. The tapes stay out of the roster
until the divergence is attributed; a fixture whose model is refuted is either
a permanent red or a silenced one.

Two smaller traps the slice banked:

- **`keysToSpans` drops the key it does not own.** It is the mover's encoder and
  iterates `up`/`right`/`down`/`left` only, so a per-tick set containing
  `primary` comes back with no press in it. Symptom: three shoves in the drive,
  zero in the replay, and a tape whose every tick is the room's intro.
- **A census of SITES still did not discharge a schedule of TICKS**, inside the
  slice that banked that lesson — this time the schedule was right and the
  LOOKUP was short. On the tag tick the boss's own arm is `frozen` (0 draws) and
  the GRAPHIC's `endAnim` books ten, so a tick's site list is
  `phase ++ (deathAnim if the callback fired) ++ jiggle`.

### ⛔⛔⛔ Two off-by-ones that cancelled, and the press that never fired (R6 slice 6g)

The 6f recording diverged at tick 23 and the attribution came off one headless
arm of the plan's own tape. `botStatus.slash` read **`{tests: 0, hits: 0}`**:
the shove the fight opens with never happened in the game at all.

**`FinalBoss.as:88`'s `Input.released(p.keys[6])` means exactly what it says.**
`Bot` dispatches the DOWN edge on a span's `from` and the UP edge on its `to`,
`Input.onKeyUp` is the only writer of FlashPunk's `_release`, and
`Engine.onEnterFrame` calls `Input.update()` at the END of the frame — so the
release is live on `to` and nowhere else. Slice 6e read it as ending on `from`
because the boss's polled position sat one 0.5303 px step further along than a
release on `to` permits. It did — **and the step is the TAPE's, not the
edge's**: `Bot.update` records observation N and disarms at the top of a frame
whose world update then runs anyway, so an **N-tick tape performs N + 1 world
updates** and every poll sees the extra one.

An intro one tick early and a run one frame short agree on both quantities the
6e probe could read — the polled draw count and the polled boss position — and
disagree only on WHICH TICK anything happens. That is the whole shape of the
trap: **when two derived off-by-ones move the same measured quantities the same
way, the fit that "confirms" them confirms their product.** What separated them
was a readout that had nothing to do with either: a hit-test counter.

Consequences worth carrying:

- **The intro-dismissing press is NOT the first shove.** Under the `to` reading
  the freeze is still up when the player updates on `from`, and on `to` the
  edge is a release, so the press is swallowed at both ends. `hitThisSequence`
  still starts false — the first lava hit needs no barrage, but it needs a
  press of its own.
- **A poll offset with a mechanism beats a poll offset with a bound.** The
  two-quantity fit now PREDICTS its offset per arm (1 once the fight has
  started, 0 while the boss is frozen), which is a claim a wrong model has to
  break rather than absorb.
- **The negative control had the answer for a whole slice.** The 2-tick arm
  ends ON `from`; under that reading the tape's extra frame runs the walk arm
  and books a third draw. The game reported two, twice, at both seeds.
- **`Player.knockback` is not `Enemy.knockback`.** It normalizes
  `(x - p.x, y - p.y)` to unit length and then writes each axis only if
  `|component| >= 0.5` (`>` for y). A contact at 26 degrees off horizontal
  moves the player in x alone — which is why the refuting tick looked like a
  1.66 px reversal with almost no vertical component.

### ⛔⛔⛔ One ulp, and the Owl falls (R6 slice 6h)

The 6g recording diverged at tick 71 and the whole barrage was wrong behind it
— not one of the three rocks breaking at tick 74 appeared in both lists, while
the two bosses had parked within 0.12 px of each other. The cause was the last
bit of a square root.

**`Point.length` is `sqrt(x*x + y*y)`, and the model used `Math.hypot`.** The
running system is `SWFRecomp`'s AVM2 core; its `flash.geom.Point` computes
`length` as `sqrt(x * x + y * y)` and `normalize(t)` as
`x *= t / length` (`SWFModernRuntime/src/avm2/avm2_globals.c`), and
`FP.distance` is the game's own `Math.sqrt(dx*dx + dy*dy)`. `Math.hypot`
computes the same real number to better precision and a **different double**,
and `(x / s) * l` is not `x * (l / s)`.

**Why one ulp decided an arm.** `Mobile.friction` is
`v.normalize(Math.max(v.length - f, 0))`, so a coasting body's speed descends
by exactly 0.25 a tick — through **1.0**, which is `moveSpeed`, which is
`FinalBoss.update`'s walk/coast split `v.length <= moveSpeed`. The test lands
ON the boundary once per coast: `Math.hypot` read 1.000000000000000222 and
coasted a fourteenth tick; the runtime's arithmetic reads 0.9999999999999996
and re-aims on the thirteenth.

**And the damage was not positional.** The pod arrival is an ABSORBING state
(`x = pod.x; y = pod.y + 1`), so the lost frame did not delay the arrival at
all — both bosses snap on the same update and the barrage starts on the same
tick. What the lost frame cost is that walk tick's **grenade roll**: one
`Math.random()`, after which the model's draw stream ran one draw behind the
game's for the rest of the fight, and every barrage roll, aim and scale was a
different number.

⇒ **if a model's positions agree and its random consequences do not, hunt a
DRAW, not a pixel.**

Two more things worth carrying:

- **Calibrate a polled arm before comparing two arms.** 6g read the 45-tick
  arm's `hitsTimer` (game 2, model 4) as two lost boss frames. `hitsTimer`
  counts UPDATES, and that arm's poll was two updates late: calibrated, the
  game's boss and the model's are in the same place, before the fix as well as
  after. The "barrage two to three frames late" it named never existed.
- **A refuted recording is a known answer.** The fix was confirmed offline
  against 6g's own refuting census — the parked boss position, all three
  breaking rocks, the in-flight set and the player's position at the poll, six
  quantities, all exact — before a new recording was spent.

W-owl is claimed: `{112,0}` and `{112,1}` are off in the game's own
persistence array, 109 ticks after the kill, and the pair's control keeps both
flags SET with two of the three lava self-hits driven.

## R6: bosses and the ending, as built (CLOSED 2026-08-08)

R6's brief and full as-built record are
`NewDocs/plans/seedling-bot-r6-opus-kickoff.md` (§§8–22 the slices, §23 the
close — NewDocs is gitignored, so the file exists only on the working
machine; this section is the tracked summary).

**The claim, as the live readouts state it.** `r6ExitFindings()` over the
committed roster, quoted rather than paraphrased:

```
OK  {19,0}  (ShieldBoss)                  W-shield: r6-shield-kill / r6-shield-control
OK  {43,5}  (BossTotem)                   W-totem:  r6-totem-kill  / r6-totem-control
OK  {112,0} (FinalBoss — the Owl)         W-owl:    r6-owl-kill    / r6-owl-control
OK  {112,1} (the RockLock his death opens) W-owl:   r6-owl-kill    / r6-owl-control
OK  {113,0} (FinalDoor)                   W-door:   r6-final-door  / r6-final-door-control
OK  {114,0} (the Watcher's dialogue)      W-talk:   r6-watcher-talk/ r6-watcher-control
OK  the boss-kill ledger is complete            6/6 tags earned (over 118 tapes)
OK  every R6 window has both arms in the roster 8/8 — unclaimed: (none)
```

- **Six of six boss-kill tags earned inside driven windows with pairs**, each
  read back from the game's own `persistence_cleared` rather than echoed from
  a tape. Three of them are the ladder's first three boss kills (BossTotem,
  ShieldBoss, the Owl); the Owl's two are CLEARS his own `endAnim` writes 109
  ticks after the kill, and the pair's control leaves both flags SET.
- **Eight of eight windows claimed** — W-totem, W-shield, W-fire, W-owl,
  W-talk, W-door, W-seed, W-blood — every one a tape plus a control, both in
  the roster and both replayed by `tapeRunner.test.js` on every CI run.
- **The credits are a MEASUREMENT, not an argument**: `botStatus.menu_state`
  reads **2** on `r6-seed-credits`. `R6_MENU_WRITERS`'s four-writer
  elimination is kept as the second stratum — the readout says the state is
  the credits, the elimination says the 2 came from the tree.
- **`fire` is real-collected** (R5's named debt): the GAME collects it inside
  `r5-bobboss-fire`, and `r5Chain.MODEL_EXEMPT` makes the differential check
  the game against `mirror + earned`, which is the harder assertion.
- **`bosskey:0` is real-collected** from the vacated ShieldBoss body, with its
  ceremony priced. ⚠ **`hasShield` is NOT** — see the debts below.
- The roster at close is **118 tapes**, of which **89 declare `noDamage`** and
  29 do not. Every count in `r6Acceptance` is derived from `fixtureNames()` at
  call time; R5 closed with two hand-kept counts that had rotted, and nothing
  in this module stores a number.

**The staged ending is exactly as staged as the ruling said.** The claim is
"given this save state, the real game's ending is beatable", and the save
state is inventoriable tape by tape:

| window | booted / GRANTED | earned inside the window |
|---|---|---|
| W-totem | five totem parts in `save.totem_parts`; `noHazards` water/lava/ice/waterfall | the wand ceremony, ten wand shots, `{43,5}`, the arena |
| W-shield | a sword; `noHazards` as above | `{19,0}`, `bosskey:0` off the corpse |
| W-owl | a sword | three lava self-hits, `{112,0}` + `{112,1}` |
| W-talk | nothing at all — a booted stance inside the 24 px circle | `{114,0}` |
| W-door | **all sixteen `save.seal_parts`** + `{114,0}` declared | `{113,0}` |
| W-seed | **conch + feather** | the pickup, two game-initiated reboots, `menu_state 2` |
| W-blood | a sword + `{114,0}` declared | four hits, the bloody seed, the L1 reboot |

⇒ the sixteen seal identities, `{114,0}` where it is a precondition rather
than the point, the conch and the feather are **BOOTED**. Earning them is the
honest chain, which is R7's line and was ruled so at slice 0.

**What the rung built.** The mover (`mover.js` — A\* over quantized
`(x, y, vx, vy)` with the exact stepper as the transition, `planDash` +
`earliestArrivalTable`, certificates emitted as TAPE SPANS so `runTape` is an
independent replay stratum); the wand family (`wandVerb` / `wandShot` /
`magicalLock`); the player damage model + shake/camera (`playerDamage`,
`camera`, the death reboot in `levelRun`); five new per-visit families — the
wand shot, the totem fight, the ShieldBoss, the FinalDoor and the Owl with his
pods — taking `levelRun`'s family counter to **fifteen** (⚠ the docblock
numbering COLLIDES at fourteen, where `bossTotemFight` and `finalDoors` both
claim the ordinal; the names are reliable and the index is not); the ending
machinery (`endingChain`, the seed/reboot chain shared by W-seed and W-blood,
`finalDoorL113`); **the rung's one AS3/runtime batch** — `swfmodern.Rng`
(read/write/reset plus a second cosmetic generator) in `SWFRecomp-CC`, `Rng.as`
and three bundled readouts in the fork, tape **v7**'s `rng` block and `rng.js`
in the model; and the **roster trim** (`fixtures/tiers.js`, `LEGACY_TAPES` the
only named set, every other tier its complement so a new fixture can only fail
safe).

**Standing findings** (source-proved or driven; do not re-derive):

- **The Owl fight is EXACT and the witnessed-not-exact hatch stayed shut.**
  `Game.shake`'s two draws are in `view()`, which `Game.update` calls, so they
  are UPDATE-side; L112 has a gameplay draw consumer and no render-side
  polluter. ⚠ The render-side census is FOUR sites, not three — `Moonrock.render`
  reaches `drawFlares` for 280 draws a frame, and a by-enclosing-function census
  could not see it. L112 holds no moonrock, so the conclusion survived its own
  refutation and now carries its bound.
- **Reproducible is not predictable.** A byte-exact model of an RNG-coupled
  fight needs the LFSR's ABSOLUTE stream position at window start — the whole
  page's history — and no readout carried it. That is the named wall the one
  AS3 batch paid, on the user's own design.
- **`Point.length` is `sqrt(x*x + y*y)` and `normalize` is `x *= t / length`.**
  A model computing the same quantity more accurately diverges from the
  runtime; one ulp decided a walk/coast arm sitting exactly on `moveSpeed`,
  and cost a DRAW rather than a pixel.
- **One press is FIVE hit tests** (`slashDelayMax` is 0), and the RECEIVER's
  gate decides how many land: an i-frame arm leaves a refusal row, a
  knock-only arm culls at the rect and leaves none, so the witness is the
  COUNT.
- **Three ways a player cannot move, three different bills**: a freeze is dead
  frames, `receiveInput = false` still runs physics, `active = false` runs
  nothing. A dialogue frame is a tape TICK; a `SealController`/`Pickup`/cover
  fade frame is DEAD.
- **The walk-away does not exist.** `NPC.talk`'s `if (talking)` block raises
  the freeze above both the key test and the radius test, and leaving the
  radius runs `doneTalking()` anyway — so a "walk out of range" control would
  earn the very flag it exists to withhold.
- **A `play()` frame IS the animation's first update**, and `FP.world.remove`
  only QUEUES — for a class with no `destroy` and no fade the queue is the
  whole removal. Both fenceposts are needed; neither alone reproduces a
  recording.
- **An N-tick tape performs N + 1 world updates** (`Bot.update` records
  observation N and disarms at the top of a frame whose world update runs
  anyway), so every polled arm needs calibrating before two arms are compared.
- **Tag timing is per class**: `{19,0}` PRECEDES the corpse by 23 updates,
  `{43,5}` lands 241 ticks after the kill (240 white-out renders plus one
  `updateLists()`), `{112,0}`/`{112,1}` 109 ticks after it.
- **The shake band never closes**: the round's dead zone freezes it at −4/+5,
  so one hit costs 9 px of camera knowledge for the rest of the visit and
  `onScreen` is three-valued.
- **L112's teleporter landing point (32,208) is inside a solid** — the game's
  teleport does not collision-check its destination.

**The close-out debts, by name** — see the R7 table below for the ones that
are scoped work rather than loose ends:

1. **`saw_auto_advance` unification** — owed since R3, carried through R5's
   §38.4 and still owed. It is the one wanted change that is NOT byte-inert,
   so it waits for a batch that re-records ON PURPOSE; the RNG batch's whole
   gate was zero re-records and bundling it would have destroyed that gate.
   (`R6_AS3_DECISION.stillOwed`, row 1.)
2. **`earnedClears` does not carry a PICKUP's own persistence tag** (the
   shield's `{20,2}`, the wand's) — found at slice 5, named with its blast
   radius, NOT patched, and untouched since.
3. **The `normalizeLive` hot-loop fix** — deferred BY NAME since slice 2,
   where the cost was MEASURED at +9.7 % on the hottest loop (the cause is the
   11th key re-normalised per `collidesSolid` call, and the fix is a net win
   for all eleven). It was deferred to "a slice that can afford the `--win`
   sweep": G2's sweep gates R6's last commit and cannot gate an unwritten
   change, so the debt's TERMS are unchanged — what changed is that the
   sweep's price is now measured at close and R7 can budget it.
4. **The `pressed`/`released` echo on `botStatus`** (`R6_AS3_DECISION.stillOwed`,
   row 2) — ⚠ its stated justification is STALE. The row was written when the
   game appeared to end the Owl's intro on a `primary` span's `from`; slice 6g
   proved that reading was two off-by-ones cancelling and the release is live
   on `to`. The readout is still WANTED — it would have separated the two
   candidate mechanisms in one run instead of a slice — but it is a cheaper
   diagnosis, not an open measurement question.
5. **`hasShield` is real-collected by NO tape.** `r6-shield-kill` ends in L19
   at the boss key; the L20 shield walk is modelled (`shieldL20.test.js`) and
   never driven, and every tape holding a shield is a legacy R1/R2 walk that
   GRANTS it. The `R6_ITEM_LEDGER` row is undischarged and says so.
6. **`botStatus.save` has no differential consumer.** The readout carries
   `totem_parts` / `keys` / `seal_parts` live off the game's own accessors,
   and the sweep consumes fourteen other status fields and not this one — so
   the sixteen booted seals and the driven key collect are asserted from the
   model side and the stream, never from the game's own save array.
7. **`r6ExitFindings` is gated by vitest only.** The differential runs
   `r1`–`r5AcceptanceFindings` and not `r6`'s; the rung's exit criteria are a
   G1 assertion, and the ledger's game-side half is the per-window
   `persistence_cleared` checks.
8. **`buildTape` still cannot emit v6 or v7** (`botDriverV1.js:311` caps its
   version ladder at 5), so every v6/v7 tape on the ladder is hand-authored by
   a plan script.
9. **The 10 s vitest cliff was never raised.** Inherited, reproduces at the
   parent commit, and named at every slice that met it.
10. **Model refusals carried out of the rung**: the BobBoss encounter script
    (`KILL_ARM_POLICY.BobBoss` stays `refused`), the spear's three-hit repeat,
    the FireWand arm, the darksuit retaliation arm (which throws rather than
    being transcribed untested), and `Explosion`'s Enemy arm.
11. **R5's walls, untouched**: L40's link 5 has no holder and the corpse
    cannot cross, `WandLock` is a `Lock` with a sprite, and the wand seals its
    own exit. `noDamage` is NOT retired roster-wide — 89 of 118 tapes declare
    it, and whether the flag can retire rides the honest chain.

## What R6 hands on, and what R7 inherits

⚠ This table SUPERSEDES the R5 one above for every row R6 touched.

| item / gate | what R6 did with it | rung |
|---|---|---|
| **BossTotem** | KILLED — `{43,5}` earned, ten wand shots, the arena opened, the wand-shot exit priced | **DISCHARGED (R6)** |
| **ShieldBoss + key 0** | KILLED — `{19,0}` at the third hit, `bosskey:0` collected off the vacated body | **DISCHARGED (R6)** |
| **fire** (pickup) | real-collected inside `r5-bobboss-fire`; the differential checks `mirror + earned` | **DISCHARGED (R6)** — the encounter SCRIPT stays refused |
| **the Owl** | KILLED by three lava self-hits — `{112,0}` + `{112,1}`, the first RNG-coupled fight on the ladder, modelled to the last bit of a square root | **DISCHARGED (R6)** |
| **the Watcher / FinalDoor / seed** | `{114,0}`, `{113,0}`, both seed branches, and `menu_state 2` — the ladder's first "the game says it was beaten", **conditional on the declared save state** | **DISCHARGED (R6), STAGED** |
| **`hasShield`** | modelled, never driven — no tape reaches L20's `shield@112,48` | **R7** |
| sixteen real seal ceremonies | **BOOTED** in W-door (`save.seal_parts` all sixteen); 2 of 16 chests ever driven (L38, L40) | **R7** |
| the honest item chain — darksword / darkshield / darksuit / ghostsword / firewand | untouched this rung; D7/D8 access plus the Witch (the wand is HELD, so her gate is open) | **R7** |
| the L40 chain (links 5–11, bosskey 2, both north teleporters) | untouched — link 5 has no holder, the corpse cannot cross, the wand opens no `WandLock` | **R7** (a standing wall for this machinery) |
| L93's bridge | still unit-witnessed on L63 only — a TILE (t=29), one Spear/GhostSword hit then 59 self-decrementing render frames, `type` mutating in `render()` | **R7** (live witness) |
| LightBoss / TentacleBeast / LavaBoss | deferred by name, unchanged — none gates anything the ending needs; TentacleBeast is the game's first whirlpool-scale RNG fight | deferred |
| `noDamage` roster-wide retirement | parts 1+2 BUILT (the damage model, shake/camera); 89 of 118 tapes still declare the flag | **R7** — it rides the honest chain |
| `botStatus.save` as a differential stratum | shipped in the fork, consumed by nothing | **R7** |

## R7: the honest playthrough, as built (CLOSED 2026-08-10)

> ⛓ **RETIREMENT NOTE (R9 slice 7, 2026-08-21).** The chain this chapter is
> about — `act2-the-sword` and its `r7-act2-*` tapes — **has been retired** under
> ⚖ ruling 14: the true-start solver chain `r9-campaign` walks the same rooms and
> `r8-solve-1..11` cover nine of the twelve tapes' claims. `r7-act2-5`,
> `r7-act2-6` and `r7-act2-full` remain on the roster because they are the only
> witnesses of families no solver tape carries (the v10 `despawn` channel; the
> ETA transit probe's positive oracle). **Everything below is HISTORY and is left
> exactly as it was measured** — it is the record of what R7 built, not a
> description of the roster today. See the R9 slice 7 section for what moved.

R7's brief and full as-built record are
`NewDocs/plans/seedling-bot-r7-opus-kickoff.md` (§§8–20 the slices, §21 the
close — NewDocs is gitignored, so the file exists only on the working
machine; this section is the tracked summary).

⚖ **The rung's scope was PIVOTED once and its boundary RE-RULED once**, both
by the user, and both are load-bearing on how to read what follows. The pivot
(2026-08-09) replaced R6's "the honest chain, shield-first" with a larger
program: **a full, clean, segmented playthrough from the true initial state**,
with the reachability knowledge translated into Archipelago access rules so
that **AP's own pathfinding produces the collection order**, and a tape
GENERATOR as the eventual deliverable. R7 is that program's **spine**, not its
campaign. The boundary (2026-08-10) then ended the rung at **the sword
earned** rather than at D2 and the shield, with the session long and the
segment tail measured.

**The claim, as the live readouts state it.** The differential over the
rung's own fifteen tapes, quoted rather than paraphrased (`--win`, no
`--record`, clean tree afterwards):

```
PASS  sword@L10 (pickup) is EARNED inside a driven segment
        r7-act2-10: hasSword 0 -> 1, and levelPersistence gains {10,0} in level 10
PASS  chest@L11 (chest) is EARNED inside a driven segment
        r7-act2-11: hasSealPart[] gains a slot 0 -> 1, and levelPersistence
        gains {11,0} in level 11
PASS  chain act2-the-sword: the EARNED set is exactly what the chain declares
        2 earned: chest@L11, sword@L10
SKIP  chain act2-the-sword: the goal ledger stands at 2/41
        pickup 1/12, key 0/5, totempart 0/5, chest 1/16, ending 0/1, encounter 0/2
PASS  chain act2-the-sword: segment 1 boots the TRUE INITIAL STATE and inherits nothing
        boot {level 0, x 80, y 128}, seam none, 0 grants, 0 clears,
        save {keys 0, totem 0, seals 0}
PASS  chain act2-the-sword: the segment tick counts sum to the headline's
        183 + 47 + 245 + 347 + 812 + 355 + 146 + 1090 + 122 + 89 + 87 = 3523
PASS  chain act2-the-sword: THE ENDING STATE — the chain ends where the headline
      ends, field by field, with NO offset declared anywhere — 46 signature rows agree
```

- **Eleven segments, ten seams, every seam GREEN over the whole 46-row
  signature**, with each boundary tick observed twice and agreeing, and each
  segment replayed as the headline's own slice tick for tick.
  `new Game(0, 80, 128)` → L0 → L2 → L3 → L4 → L5 → L6 → L7 → L8 → L9 →
  **L10 (the sword)** → **L11 (the first seal)** → L10.
- **Two rows of the goal ledger are EARNED**, and "earned" is a FLIP measured
  between a segment's own boot block and its own latch, plus the placement's
  own persistence clear — ⛔ **a boot block can DECLARE `hasSword: true`; it
  cannot make the flag flip**, which is the whole difference between this and
  six rungs of staged tapes, and it is asserted by a test that boots the flag
  on both sides and reads UNCLAIMED.
- **The 39 UNCLAIMED rows are REPORTED on a named non-failing line**, never
  green. R7 ends at the sword, so "41/41" is a claim about R8's campaign and
  asserting it here would be a gate that can never pass.
- **The earned set is checked TWO-SIDED**: the chain declares its ledger ids
  and the finding asserts the declared and the measured sets are EQUAL, so a
  segment that picks something up **without saying so** is red too.
- ⛔ **`R7_GOAL_LEDGER` and `r7GoalFindings` shipped at slice 0 and nothing
  built their `earnedBy` argument until slice 6f.** Six slices of honest chain
  went past a ledger stuck at zero, and the machinery that should have said so
  was a function with no caller — **trap 119's own failure mode wearing the
  shape of a finished feature**. The caller is
  `playthroughAcceptance.chainGoalFindings`.
- **The mid-run outcomes are the GAME's, at the block's own end tick**: three
  `phases` blocks' persistence clears (`{5,0}`, `{8,0}`, `{8,1}`) and one
  witnessed enemy REMOVAL (`bob@112,48` at L6), each carrying the probe that
  witnessed it as provenance, each asserted in the segment and again in the
  headline.
- **Nothing in the chain is granted, and nothing is relaxed**: zero grants,
  zero booted clears, collision on, no `noHazards`, `noDamage` absent by
  construction. **`noDamage` therefore retires the way §3.3 said it would —
  by construction on the new chain**, not by a campaign against the flag.

**What the rung built.**

- **The segment and the seam.** A segment boots a declared world and runs to
  a LEVEL-ARRIVAL end (post-fade, calm), carrying at end a LATCHED seam
  readout; a chain is honest because `boot(N+1) == latch(N)` field for field
  over a frozen 46-row `SEAM_SIGNATURE` (save arrays, `cutscene`/`time`/
  `grassCut`, all three RNG states plus `split`, the Music no-repeat state,
  and calm-arrival invariants asserted rather than carried). The checker
  derives its findings from the signature per trap 119, so a field added
  tomorrow cannot go unreported; `segmentBootFromLatch` is the inverse and
  REFUSES by name.
- **Two AS3/runtime batches**, both in fork `bot` (`92254fe`, then
  `7514b96` — the rung's final fork state). Batch 1 was the ONE deliberate
  re-recording batch owed since R3, with the gate INVERTED (every re-record
  attributed by a prediction committed BEFORE the fork moved): the
  `saw_auto_advance` unification, `botStatus.save`'s differential consumer,
  the seam latch, FP LCG hooks, the `pressed`/`released` echo, the stale
  docblock. Batch 2 added the **`Game.begin()`-ENTRY latch** on the user's
  ruling, and its prediction — zero re-records, zero value changes, exactly
  one fixture file — was stated first and met.
- **Tape v8, v9 and v10.** v8 is the full seam boot block. v9 is a mid-run
  persistence clear (`persistence[].at`) and v10 a mid-run enemy REMOVAL
  (`despawn: [{level, id, at}]`) — both **MODEL-ONLY**: the projection handed
  to the game drops them, and `GAME_VISIBLE_DROPS` is now a CLASSIFICATION
  LIST, so **a v11 field fails the pinning test until someone says which side
  of the line it is on**. An entity `id` is a PLACEMENT (`"<type>@<x>,<y>"`),
  never an index, because the atlas is a regenerated artifact.
- **The units walk.** A walk is a sequence of UNITS, each a `leg` (planner-
  authored: inputs recorded, spans DERIVED from A\*, re-derived on `--check`)
  or a `phases` block (hand-authored choreography committed as DATA: spans
  fixed, provenance citing the probe that witnessed them, **outcome asserted
  from the game's own readouts at block end**). Seams are indifferent to which
  kind produced the ticks.
- **Three new leg verbs** — `shove` (the block a weaponless player moves by
  LEANING, which `pushables` had modelled since R4 and nothing could PLAN),
  arrow-bait, and shove-sink — plus the **Arrow×Enemy family**: `Arrow.as`
  lists "Enemy" among its hitables, which is how **the sword is reachable
  with no weapon at all**.
- **Rules v1 and the AP path.** A one-way GENERATED artifact (`--check`
  byte-exact, provenance stamped, the physics model importing nothing back):
  113 regions, 210 sub-regions, 41 locations, 312 one-way connections, 265 AP
  regions, shipped as its own preset `seedling_playthrough`. `Generate.py
  --seed 1` returns a sphere log — **the collection order, directly** — with a
  REFUTATION LOG carried beside the rules as part of the artifact.
- **The L40 recon** (a ruled checkpoint): the honest single-visit route
  EXISTS, and R5's wall was two instrument defects.

**Standing findings** (source-proved or driven; do not re-derive):

- ⛔ **A segment boundary duplicates exactly one level BUILD and one FADE**,
  and `botStart` reseeds BEFORE the build — so a tape's declared RNG is a
  PRE-build quantity and a terminal latch's is POST-build. Measured with zero
  residue (L94: 1,562 gameplay draws, 21 dead frames, four measurements across
  three arms). The cure was the `begin()`-ENTRY latch, and the interim
  offset declaration was **DELETED rather than adjusted** — everything stayed
  green with the stale number in place, which is exactly trap 119's shape.
- ⛔ **THREE generators, three states.** The gameplay LFSR; the cosmetic
  generator, **every draw of which IS a gameplay draw while `Rng.split` is
  off** (3 per Tile at every level build); and FlashPunk's own LCG, seeded
  once per page and read by nothing that matters. A seam carrying two of the
  three is not a seam. ⚠ `Math.random()` in this build is a fixed-seed LFSR,
  so the FP seed is page-DETERMINISTIC — the chain declares it anyway, so its
  reproducibility does not depend on that coincidence.
- ⛔ **A fight does not survive the door; the clear does.** Leaving a room to
  cut a boundary RESPAWNS every enemy in it while the persistence clear stays
  durable ⇒ a fight and the crossing it opens must be ONE segment, and the
  lock the fight removed reaches the model as a v9 `at` clear.
- ⛔ **The model's damage budget is the GAME's minus whatever the live movers
  add.** A route that can afford one hit in the model cannot afford it in a
  room with a chaser: target ZERO. ⚠ And a silent death reads as `hits 0`,
  because the counter reads the NEW Player — the tell is a jump to the boot
  tile with no level change.
- ⛓ **The room kills the mover the model refuses to step.** L6 had no
  crossing at all for the model (both bobs are `mover` class, so `levelRun`
  throws) — and the ROOM removes one of them: water drowns a chaser that
  crosses it, a static trap walls the other off. A mechanism, not an anecdote.
- ⛔ **A planner that re-boots from the LEVEL RECORD forgets every per-visit
  thing a previous group moved.** A shoved block is back at its `.oel` cell as
  far as the next group is concerned; A\* routes through the cell it really
  occupies and the drive shoves it out of its own path. Every group is planned
  against the record its predecessors' shoves EDITED, derived from the
  planner's own output rather than declared. ⚠ Nothing here reaches the tape —
  the game and the replay both move the block live; it is the PLANNER that
  forgets.
- ⛔ **A leg's SETTLE WAIT is dead time the room charges for.** A shove
  releases early by construction and the player then stands still wherever the
  release left them: here that stance overlapped an arrow lane **by two tenths
  of a pixel** and the game charged a hit the model does not price. A stance
  safe to PASS THROUGH is not safe to WAIT IN.
- ⛔ **A cleared body must be gone for BOTH answers.** A cleared tag removed a
  body from the world build and not from the combat census — one body, gone
  for the route and present for the contact test. The predicate is
  `clearedAwayByTag` and both sides call it.
- ⛔ **A rule too PERMISSIVE refuses nothing and is only visible in the
  ORDER.** `lockRuling` called every grouped lock free on a claim about the
  PRESSER's reachability that it never checked, and AP took the Shield at
  sphere 0.4 **through a wall**. Generation was green and `--check` was
  byte-exact. Fixed by a `GROUPED_LOCK_EXCEPTIONS` row keyed to ONE named
  placement, with the bounded sweep that says it is the only such lock.
- ⛔ **A reach search must EXCLUDE ITS OWN MOVER** — a mover left in
  `world.solids` returns 1 cell rather than an error, and R5's L40 refusal was
  exactly that, twice.
- ⛔ **A coordinate meaning *where you came from* read as *where you go***,
  twice in one slice from two different fields: an exit ID encodes the SOURCE
  teleporter's position, and a pit carries an offset. Both printed their own
  refutation on the same screen that "confirmed" the wrong diagnosis.
- ⛔ **An Arrow does 1 damage, not 5** — `Enemy.hit(f, p, d = 1, t)`; the 5 is
  KNOCKBACK FORCE, and the driven trace had refuted the 5 all along.
- ⛔ **A truncated arm must clip every `at`-stamped field, not just
  `tick_count`.** With one hand-authored block per segment the shortcut is
  invisible; with two, the arm cut at the first block's end is handed the
  second block's clear at a tick outside its own window. ⚠ `at === cut` is
  KEPT — that is the instant the arm exists to ask about.

**The close-out debts, by name** — see the R8 table below for the ones that
are scoped work rather than loose ends:

1. **`normalizeLive`'s remaining consumers** — the hot-loop fix landed as its
   own second track at slice 4, and the REMAINING call sites have been owed
   by name for **eight slices**. It is the first stone of M3 (real-time
   planning in the JS build).
2. **The L3 → L11 shortcut, named and not taken.** `teleporter@96,128` in L3
   goes straight to L11, untagged and always live, and it is the route every
   R1–R4 sword walk uses: **five levels instead of eleven**. The honest chain
   took the dungeon because D1's rooms are on the campaign's own path — but
   **the sword itself never required L4–L9**, and a rung pricing a
   fastest-route campaign should start from this line rather than rediscover
   it.
3. **The strict-vs-minimal order question.** Segment scope was ruled at slice
   6 as the MINIMAL VALID DEPENDENCY CHAIN rather than the strict AP total
   order through a sphere, with the deviation recorded in the segment
   metadata. Which of the two the campaign follows is R8's to settle.
4. **`buildTape` still cannot emit v6–v10** (its version ladder caps at 5),
   so every modern tape on the ladder is hand-authored by a plan script.
   Pre-existing since R5, unmoved, and it is the thing M2 has to fix.
5. **Nothing prices an arrow in flight against the player.** The shipped route
   never stands in an armed lane, which is a ROUTE property rather than a
   model one; a future room that must cross one needs the term.
6. **`HOLD1 = 220` / `HOLD2 = 260` have no unit biter and cannot** — the probe
   is their stratum, and the `kill1-short` control (40 ticks, nothing cleared)
   is what makes them numbers rather than habits.
7. **Model refusals carried out of the rung, unchanged**: the BobBoss
   encounter script, the spear's three-hit repeat, the FireWand arm, the
   darksuit retaliation arm, `Explosion`'s Enemy arm — and `KILL_ARM_POLICY`
   stays refused.
8. **Two unreconciled Seedling worlds remain three**: `worlds/seedling/`, the
   atlas presets, and now `seedling_playthrough`. Retiring any of them was
   ruled a later rung's question.
9. **`r7-act2`'s `block-onto-button` arm is recorded-not-used** — it is the
   evidence that the user's L8 first move is right about the game and
   unplannable by this planner, and it lives in the probe rather than in a
   fixture.

⛓ **R6's debts, settled at this close**: debt 1 (`saw_auto_advance`) went in
batch 1; debt 2 (`earnedClears` missing a pickup's own tag) was paid at slice
6 — the sword's `{10,0}` and the shield's `{20,2}` reach `earnedClears`, and
it is what turns "a seal was collected" into "THIS chest was opened"; debt 3
(`normalizeLive`) landed at slice 4 with residue named above; debt 4 (the
`pressed`/`released` echo) and debt 6 (`botStatus.save`'s consumer) went in
batch 1; **debt 9 — the 10 s vitest cliff — is paid HERE**, measured both
sides at the same tree (2,935 passed / 9 timed out, all nine `Test timed out
in 10000ms` with zero assertion failures → **2,944 passed / 0 failed**), and
the raise is to 60 s against a worst observed crossing of 14.75 s. Debt 5
(`hasShield` real-collected by no tape) is **NOT discharged** and moves to
the head of R8. Debts 7, 8, 10 and 11 stand as rows 4 and 7 above and in the
table below.

**The retirement decision: NO DEMOTION, and it is a decision rather than an
omission.** The rung's ruled cadence is evaluate-and-tier per slice; this is
the evaluation, re-derived at close from the committed expectations' own
transition records rather than from the slice's table.

| tape | crutches | levels visited | not in the chain |
|---|---|---|---|
| the chain (11 segments) | **none at all** | 0,2,3,4,5,6,7,8,9,10,11 | — |
| `r4-walk-1-sword` | noDamage, 2 noHazards | 0,2,3,10,11 | none |
| `r3-walk-1-sword` *(already legacy)* | noDamage, 4 noHazards | 0,2,3,10,11 | none |
| `r3-collect-sword` | noDamage, 4 noHazards | 10 | none |
| `grant-sword-room` | noclip, noDamage, 5 noHazards, 1 grant | 0,2,3,10,11 | none |
| `r1-walk-1-sword-shield` | noclip, noDamage, 4 noHazards, 2 grants | 0,2,3,10,11,13,20 | **13, 20** |
| `r2-walk-1-sword-shield` | noDamage, 4 noHazards, 2 grants | 0,2,3,10,11,13,20 | **13, 20** |

- The four strict-subset tapes satisfy the ruled criterion on their face, and
  **none of them is demoted**, for two different reasons.
  `r4-walk-{1..6}` + `r4-walk-full` is an **ENDS-MEET set** — the
  concatenation identity is asserted across all seven — and the chain
  supersedes exactly ONE of its six segments; an arithmetic claim with a hole
  is worse than a redundant tape. `r3-collect-sword` and `grant-sword-room`
  are **mechanism witnesses** (the pickup ceremony; the grant channel itself),
  which the rung's own retirement rule keeps unconditionally.
- `r1-`/`r2-walk-1-sword-shield` are **not superseded at all**: they reach
  L13 and L20, which is the shield, which is R8's.
- ⛓ **What the chain adds that nothing else has**: L4, L5, L6, L7 and L9 are
  reached by **no other fixture in the roster**, and L8 by nothing but four
  contact-pair fixtures that never leave their stance.

⇒ the R4 set goes when R8's campaign covers the rest of it, not before. The
roster stands at **133 tapes** (123 gate, 10 legacy) against R6's 118.

## What R7 hands on, and what R8 inherits

⚠ This table SUPERSEDES the R6 one above for every row R7 touched.

| item / gate | what R7 did with it | rung |
|---|---|---|
| **the segmented playthrough** | BUILT and PROVEN: 46-row `SEAM_SIGNATURE`, the terminal latch, the `begin()`-ENTRY latch, `seamBootFields`/`segmentBootFromLatch`, `requireCalm` branching on `isPlaythroughSegment` — **eleven segments, ten seams, all green, no offset declared anywhere** | **DISCHARGED (R7)** — the machinery; the campaign is R8's |
| **`sword@L10`** | **EARNED** in `r7-act2-10`, `hasSword 0 -> 1` plus `{10,0}`, from the true initial state with nothing granted | **DISCHARGED (R7)** |
| **`chest@L11`** (the first of sixteen seals) | **EARNED** in `r7-act2-11`, a `hasSealPart[]` slot plus `{11,0}` — the identity is RNG at chest OPEN and is not predicted | **DISCHARGED (R7)** |
| the goal ledger's other **39 rows** | REPORTED UNCLAIMED on a named non-failing line, findings DERIVED from the ledger | **R8's campaign** |
| **`saw_auto_advance`** (owed since R3) | unified in batch 1, the whole roster re-recorded ONCE with every change attributed by a prediction committed first | **DISCHARGED (R7)** |
| **`botStatus.save` as a differential stratum** | consumed — `totem_parts` / `keys` / `seal_parts` asserted per tape | **DISCHARGED (R7)** |
| **`earnedClears` missing a pickup's own tag** (R6 debt 2) | PAID — `PICKUP_CLEARS_OWN_TAG` (14 classes) + `PICKUP_WRITES_NO_TAG` (3); it is what makes a chest's own clear the witness | **DISCHARGED (R7)** |
| **the 10 s vitest cliff** (R6 debt 9) | PAID at this close — 60 s, measured both sides, nine timeouts converted with zero assertion failures behind them | **DISCHARGED (R7)** |
| **`hasShield` + the L20 walk** | untouched — no tape real-collects it; L20's near-side is priced and its three gates are BEHIND the shield | **R8, at the head** |
| **D2 / the ShieldBoss / boss key 0, honestly** | moved to R8's head by the user's boundary re-ruling, with the machinery complete | **R8, at the head** |
| **rules v1 + the sphere order** | GENERATED, `--check` byte-exact, its own preset; AP's fill accepts it and returns a sphere log; a REFUTATION LOG rides with the artifact | **DISCHARGED (R7)** — refinement is per-segment and continuous |
| **the L40 chain** (links 5–11, boss key 2, both north teleporters) | ⛔ **the wall is GONE**: the second holder is `pushableblockfire@480,480`, R5's refusal was two instrument defects, and the single-visit route is measured and priced at 2,500–4,000 ticks | **R8** — scheduled, not blocked |
| **`noDamage` roster-wide retirement** | retires BY CONSTRUCTION on the chain (segments declare nothing); the flag disappears as superseded tapes retire | **R8+**, no separate campaign |
| the **noclip legacy walks** | evaluated at close, **NO DEMOTION** — the R4 ENDS-MEET set has a hole the chain does not fill, and two mechanism witnesses stay unconditionally | **R8** re-evaluates when the campaign covers the rest |
| **M3** (the live reactive bot) | named horizon, untouched — ⚖ and **PROMOTED to R8** by the ruling below; `normalizeLive`'s remaining consumers are its first stone | **R8** |
| **M2** (`plan-seedling-segment.mjs --from <AP-path-step>` — a PLANNED driver, **(never written)**) | named horizon, untouched; `buildTape`'s v5 cap is its first obstacle | ⚠ superseded by the M3 promotion — a live bot needs no tape generator |
| **LightBoss / TentacleBeast / LavaBoss** | measured OUT — the exclusion costs nothing, in the strict arm as well as the loose one, against a positive control that does register a loss. L57/L69 have NO EXIT until the boss dies ⇒ never-enter | deferred, now with evidence |
| **L93's bridge, live** | still unit-witnessed on L63 only; it rides the spear or the ghostsword | R8+ |
| **the BobBoss encounter script** | `KILL_ARM_POLICY.BobBoss` still `refused` | R8+ |

⚖ **RULED AFTER THIS SECTION WAS WRITTEN (user, 2026-08-10): R8 IS THE LIVE
SOLVER BOT.** The discussion R7's close was written to feed was held while the
close sweep ran, and it pivoted the ladder: **M3 is promoted to now**, with a
Cloudberry Kingdom–style procedural generator as the horizon. A reactive
sense → plan → act bot plays the JS transcription model LIVE with full state
access; its chosen inputs are recorded as a tape and **the existing wasm
differential replays them, so the differential stays the oracle per segment**.
Segments are verified INDIVIDUALLY from any declared boot state; the honest
chain, the seam signature and the goal ledger built this rung wait UNCHANGED
until full-game coverage exists, and the bot then re-runs along genuine
latches to assemble the real playthrough. ⛔ The hand-authored shield segment
is dead — `hasShield` lands as the first NEW-machinery headline instead — and
`normalizeLive`'s remaining consumers move onto the critical path. The verb
library (`shove`, arrow-bait, hold, press, shove-sink) becomes the live bot's
STRATEGY CATALOG, and the eleven `act2` rooms become its known-answer battery:
the bot must produce tapes this differential accepts.

⇒ read the table above for what R7 BUILT and what each item's seal is; read
this note for the ORDER and METHOD R8 takes to them. Nothing above is
retracted — the pivot changes how the remaining rows get claimed, not what
they are.

## R8 slice 1: the enemy bridge, and a model that was wrong only in the tail

⛓⛓⛓ **`chasers.chaserStep` HAS A CALLER.** Transcribed exactly at R5 slice 3
and imported by nothing but probes for three rungs, it is now
`levelRun.stepChasersNow`, gated per `spinner.MODELLED_ENEMY_CLASSES` entry
with a `Bob` row. Nothing re-derives a line of it — two cost models that must
agree are one cost model.

### The slot is wrong by nine families
`Game.as:2141` adds `bob` **FIRST** of the enemy families and **after** the
Player (`:2115`), and `World.addUpdate` PREPENDS — so a Bob updates AFTER
every other enemy in the room and immediately before the player. The obvious
placement ("one more enemy family, next to the ice turret") is wrong by nine
families; the call sits beside `stepContactsNow` at the bottom of the tick.
Read the add order; never infer a slot from the family.

### ⛔ THE FINDING: a partial model is wrong in the TAIL (trap 157)
Turning the stepper on roster-wide **reddened three committed tapes** —
`r7-act2-4` (tick 282, in L4), `r7-act2-5`, and `r7-act2-full` (a **pit
death** in L4). The transcription was not the defect. **This model's arrows
hit nothing at all**: `stepArrowTrapsNow` calls `stepArrow` with no `bodies`,
so an arrow flies through every body in the game — while the GAME's arrows
KILL L4's and L5's bobs (R7 slice 6c measured hits 0→1→2→3, body gone at
t≈158). The model's bodies survived, kept chasing, and reached a player who
was standing still to bait them.

⇒ **stepping a body whose DEATH the model cannot see is not a partial model,
it is a wrong one**: the position is right for exactly as long as the body
should have existed and wrong for ever afterwards. The roster is therefore
scoped by **LIFETIME, not by class** — `chaserRoomVerdict` refuses any room
holding an arrow trap, BY NAME, naming the missing family (Arrow × Enemy).
L4 and L5 fall back to the pre-bridge pricing verbatim; **L6 is stepped and
byte-exact.**

### The terrain arm was BUILT, not declared around
`assertSteppedChaserLifetime` — written as a guard so the gap could never be
silent — fired on its first run and its message was the measurement: the
stepped `bob@112,48` **stands on WATER in L6 at tick 54**, 66 ticks before
the tape's declared `despawn` at 120. `Enemy.update`'s water/lava arm is
three lines, so it was transcribed: a destroyed body is stopped by three
gates in three different classes, `destroy` and `removed` stay two fenceposts
(trap 87), and the ten-tick `MOBILE_DEATH_FADE` is a LOOP and not a division.
The switch sits **below** the off-screen return, so a body the camera has
lost does not drown either. The PIT is a *schedule*, not an instant, and is
refused by name.

⇒ R7 slice 6e's **trap 152 now has a positive witness inside the run**
(`chaserTerrainDeaths`) rather than only a declaration, and the removal's
kill-lock consequence is COMPUTED, so L6's nil is a measurement.

### Two old laws reaching new places
- **A capability flag lit up two controls.** Adding `Bob` to the roster would
  have narrowed `runFire`'s refusal — whose reason is the BLOCK WEDGE, and
  `pushableCtx().collides` consults SPINNERS only. "The model steps it" and
  "the model would predict its wedge" are different claims; the roster answers
  both (`wedgeVisible`) and the predicate is renamed to the question it really
  asks (`enemiesUnseenByBlockSweep`).
- **`SOLIDS_BY_MOVER.enemy`'s docblock was refuted by the source.** It read
  *"`Enemy` and its subclasses add nothing"*; SEVEN subclasses push their own
  types (`Bob.as:39` among them — which is what makes a static SandTrap a WALL
  to a chaser). The ROW was right for its one consumer and the GENERALISATION
  was not.

### The pair — the game confirmed the transcription digit for digit
`r8-l6-bob-contact` (31 observations, `--win --record --only=`): the model
predicted a contact at **tick 20** with a knockback of `dx=-2.998, dy=0`
(`Player.knockback` gates each axis — trap 117). The game's own stream reads
`t=19 x=110.04999999999998` → `t=20 x=108.40158204016554` →
`t=21 x=107.00316408033109`, **byte-identical**. CONTROL: `jellyfish`, same
module, same transcription depth, no roster row — still throws
`prices it as "mover"` BY NAME.

### The union danger map v1
`dangerMap.js` combines the four hazard APIs that had no combiner: live
arrows + ARMED trap lanes, `hazardVolume` verdict volumes, stepped-enemy
boxes under `chaseEnvelope`'s leash arithmetic, and crusher trigger lanes at
the LIVE centre. It is **a search heuristic, never an oracle**, so it returns
a reason list rather than a bare boolean, and `mover.findEarliestArrival`'s
`forbiddenAt` hook — waiting since R5 — is its first real consumer.

### Still refused
**`KILL_ARM_POLICY.Bob`** stays `refused`. The bridge paid the POSITION half
of that row's own stated reason; a press arm still needs `Enemy.hit`'s five
gates against a chaser, the 25-tick die ANIMATION (during which
`totalEnemies()` still counts the body), and the `classCount` move in a room
that HAS a kill lock — L5, the one room the bridge cannot step.

## R8 slice 2: the solver loop v1, and the world the solve must sense

⛓⛓⛓ **THE POLICY EXISTS AND THE BATTERY IS SOLVED.** `solverBot.js` — the
sense→plan→act loop beside `botDriverV2` (⚖ §6.2): goals in (placements and
exits only — never the hand-authored stances), corridors planned against the
run's OWN live geometry, verbs invoked reactively from the exported catalog,
a decision-trace row per decision, and a `SolverRefusal` naming the obstacle
in census vocabulary at every dead end. The derived battery — act2 segments
1, 2, 3, 7, 9, 10, 11, computed from the chain's own units (no phases, no
mechanic outside collect/chest) — is solved from the committed segments' own
v8 boot blocks and recorded byte-exact: **five rooms tick-IDENTICAL to the
hand-authored segments**, the sword segment +1 tick, the chest segment
exact. Each tape is a one-segment **staged chain** (the first on disk):
calm arrivals latched over all 46 signature rows, `sword@L10`'s flip
measured and REPORTED, NOT CREDITED.

### The full bag, resolved as ruled
`plannerObstacleAt` gained a second entry shape — `liveBag`, branded, from
the new `run.liveGeometryOpts()` (the run's own `liveSolidOpts`, all
fourteen families) — while the legacy 8-of-14 forwarding stays
byte-untouched. Sentinel tests hold both shapes.

### ⛔⛔⛔ THE FINDING: the combat-blind world, refuted by its own recording
`createLevelRun`'s `roles` DEFAULT is `PRE_R5_ROLES` — no combat census —
while `tapeRunner` gives an honest tape the full `ROLES`. The first battery
was solved against the default: **identical in every room without enemies,
and blind in the one with them.** The blind model "crossed" L6 in 174 ticks;
the GAME, driven by those inputs, hit `sandtrap@64,16` at t=20, died TWICE,
and never crossed — and the census-on model reproduces the game's whole
disaster **digit for digit**, both deaths included (the sandtrap contact,
death/reboot and stepped-chaser models all CONFIRMED by a tape none had
been driven through). The withdrawn row is banked as a free oracle
(`NewDocs/plans/r8-slice2-l6-blind-probe/`, with a `--mobiles` body
witness); `solveSegment` now **refuses a combat-blind run by name**; the
corridor danger probe is segment-SAMPLED (waypoint-only probing measured
its own hole on the same room).

### Slice 3's work orders, computed from live state
L4 refuses with `proximity-hazard:button → 'hold', not registered this
slice`; L8 with `pushableblock → 'shove', not registered` — the component
frontier names the entity, the selector names the verb, and registering
executors is adding rows to a proven seam.

## R8 slice 3: the arrow meets a body, and a bounded refusal whose bound went false

⛓⛓⛓ **THE FREE ORACLE WENT GREEN.** `stepArrow`'s `bodies` parameter had
defaulted to `[]` since R7 slice 6b — the absence that scoped slice 1's enemy
bridge by ROOM (trap 157). With the family built and `chaserRoomVerdict`
widened, **all 324 `tapeRunner` cases replay byte-exact, including the three
slice 1 measured RED** (`r7-act2-4`, `r7-act2-5`, `r7-act2-full`). Zero
re-records. The model now kills L4's bob at t=114 (hits 1→2→3 at 47/81/114,
every arrow between them refused by name on i-frames) and L5's three deaths
take `totalEnemies()` to zero and OPEN `lock@48,112`.

### The five hitables, and the removal outside the switch
An arrow stops on ANYTHING it touches — the removal is `if (hits.length > 0)`,
outside `Arrow.update`'s two-armed switch — so cover is a resource. The player
is a STOP and never a bill (`PUZZLEMENT_HAZARDS.arrowtrap` has priced that
damage since R7 slice 6b, and two funnels for one hit is two cost models); the
live `"Enemy"` bodies are two rosters that are not interchangeable (a chaser at
the position this run steps it to, a static census body at its placement); and
cover is a FOURTH mover list, `collidesArrowCover`, whose three members equal
the blast's today by coincidence of two AS3 classes and not by construction.

### Death is three fenceposts, and who killed the body decides the third
`startDeath` plays the "die" Spritemap and does NOT set `destroy`; `endAnim`
does; `Mobile.death`'s eleven-tick fade removes the body after that — and
`totalEnemies()` counts it through all of it. ⛓⛓⛓ `World.update` advances an
entity's GRAPHIC after its own update, in the same iteration, outside the
off-screen return and outside the freeze — and an `Arrow` is added at run time
and PREPENDED, so it updates first. **An arrow's killing hit therefore lands
before the body's own graphic update and the animation gets its first update on
the killing tick; the Player updates LAST, so a press's would not.** One tick,
and it decides when the count moves. ⛔ The FADE, by contrast, is *inside* the
off-screen gate: a corpse the camera has lost stops fading and resumes when the
camera returns.

### The kill-lock consequence: a refusal became a check
Slice 1 threw whenever a removal opened a `tset == -1` lock. L5's whole solve
IS three deaths opening one, so the arm now COMPUTES the consequence and
compares it against the tape's DECLARED v9 clear: a nil is the measurement that
the scan ran, a declared opening passes with the tick banked, an UNDECLARED one
throws by name. The declaration becomes a CHECK on both sides rather than an
input nobody audits — and it immediately found that `r7-act2-5`'s `at: 737` is
the phases block's END, not the clear's own tick, which the model can now
tighten.

### `hold` registered, and its length is an observation
`runHold` gained an optional `until: {why, test}` — one implementation, not an
executor with its own tick loop — so the policy holds `button@16,64` until the
room's own ceiling has REMOVED the body and stops at t=149: the kill plus the
die animation plus the fade, exactly. The hand leg says 200. The frontier then
ADVANCES from the button to `pushableblock@32,64`, which is L4's real door.

### ⛔ A bounded refusal is only as good as somebody re-checking its bound
The first full-config run reddened on slice 1's PIT refusal, whose own words
were *"no room this bridge steps has one"* — and this slice stepped L4, which
has pits. The descent was BUILT rather than the room re-scoped: a schedule that
REPLACES `super.update()` (lerp a tenth of the way to the tile centre, 0.05
fade over 20 ticks), during which the body cannot damage the player at all.

### What is ruled and what is next
The shove DESTINATION, the bait stance, the timing escalation and the combat
policy's decision order were all ⚖ RULED mid-slice (kickoff §11.8a): every
executor's free parameters are DERIVED from the work order's post-condition and
the room's transcribed mechanism data, never chosen by unstated policy; the
ladder is **AVOID → TIME → BAIT → KILL**, each escalation a trace row naming the
cheaper rung it refused. Slice 3b carries the shove executor, bait, timing and
the L4/L5/L6/L8 battery.

## R8 slice 3b: the shove derives its destination, and the ladder climbs

⛓⛓⛓ **TWO ROOMS THAT REFUSED NOW SOLVE, AND BOTH DERIVATIONS LAND ON THE
HAND ANSWER WITHOUT BEING SHOWN IT.** `r8-solve-4` (L4, 253 ticks against the
hand's 347) is `hold` then `shove`; `r8-solve-6` (L6, 294 against 355) is the
ladder climbing AVOID → TIME → BAIT. Both recorded `--win --record --only=`
byte-exact, both one-segment `staged` chains (7 → 9 on disk), both zero hits
and zero deaths, and a fresh non-recording `--win --only=` run passed every
acceptance row — calm arrivals latched over all 46 signature rows. Zero
re-records.

### The shove destination, as ⚖ ruled — and the two neighbours it rejects
`k` = the minimum tiles such that a corridor plans with the block hypothesised
at cell `k`, queried against the run's OWN full bag (never the level record —
trap 153). L4 gives `k=2 → (4,4)`, with `k=1` rejected for NO CORRIDOR (column
2 is walled at every row but (2,4), so a block at (3,4) is still the door) and
`k=3` rejected as the PIT at (5,4). Three of the four DIRECTIONS are rejected
by reachability — a lean is a held key, so the only available directions are
those whose near-side cell the player can stand in. ⛔ Destruction is never a
side effect: a destructive cell ENDS the scan for its direction and is taken
only as the ruling's explicit LAST RESORT, with the irreversibility carried in
the decision (a destroyed block cannot press, be pushed again, or wall a
chaser — `Bob.as:39` pushes "Enemy").

### ⚖ RULED MID-SLICE: what "a valid path exists" quantifies over
L8's corridor needs TWO blocks moved — `pushableblock@112,48` is the east
pocket's only door and `pushableblock@96,112` stands IN column 6, the room's
only way south — so no single-block hypothesis yields a path at any `k`. The
orchestrator ruled that the quantifier ranges over the world where the other
PENDING frontier orders are discharged, with two guards: the hypothesis set is
BOUNDED to obstacles with a selected strategy and NAMED in the trace row, and
a refused downstream order INVALIDATES every shove that leaned on it, forcing
a re-derivation from the block's real position with that order demoted to a
wall. ⛔ The obvious alternative — "the post-condition is the frontier
advancing" — is refuted by L4, where the component grows by exactly one cell
and stops.

### ⛔⛔ Two danger-map findings, both found by DRIVING
1. **An arrow trap was priced TWICE and the static reading won.** The census
   arm walked it unconditionally while the live arm priced ARMED lanes, so a
   DISARMED trap's whole column was forbidden for ever — and in L4 that column
   is the only way north. The hazard row's own `why` had said so all along:
   *"an Activators group gates it, so whether it fires at all is a STATE
   question, not a timing one."* Now a TABLE (`HAZARDS_PRICED_LIVE`) whose
   rows each name the ingredient that prices them instead.
2. **The map had no arm at all for STATIC census bodies.** L6's four sandtraps
   are neither stepped chasers nor placed hazards, so every ingredient called
   that room calm — while slice 2's free oracle records the GAME hitting
   `sandtrap@64,16` at t=20 and killing the player twice. Ingredient (e), with
   the bridged half excluded by the RUN'S OWN VERDICT
   (`run.chaserRoomVerdict`): pricing a stepped body here would double-count a
   live one at the cell it left and forbid a DEAD one's placement for ever —
   trap 157 in the danger map's clothes. Not grown by the chomp radius,
   because the hand answer's row-2 corridor passes 8 px under a body at zero
   hits and the game certified it.

### The ladder, and which body it is really about
AVOID (a static re-plan with the danger rects forbidden) → TIME
(`findEarliestArrival` against the danger timeline, whose bound is NAMED
rather than widened — `MOVER_RANGE` reaches ~48 px, and L6's aim is 193) →
BAIT → KILL (the room's own weapon, never a press: `KILL_ARM_POLICY.Bob` stays
refused). ⛓⛓⛓ **The first danger on the corridor is the WRONG target**: L6's
is `sandtrap@64,16`, a `speed 0` body nothing can bait, while the body that
has to go is `bob@112,48` — which is not on the original corridor at all. The
target is the body whose removal ADMITS a corridor, by hypothesis, the same
shape as push-until-path.

⚖ **"A lane" is the room's own transcribed BODY-kill regions** — armed arrow
lanes ∪ lethal terrain ∪ pits — deliberately not the player's danger set,
because a chaser drowns where a player merely cannot walk. L6's bait stance is
derived from four mechanism conditions (leash, the line crossing a region,
`presserSafety` asked as a WAIT — trap 154, and reachability) and lands on
`L6_BOB_DROWN.endsAt`: row 1, column 3. **Both of the hand block's named
controls fall out as mechanism** — `stay` fails the leash (86 px against
`runRange` 80) and `south` fails the region crossing.

### Two defects of the trace's own shape, found by the ladder
A climb's rungs are decided before a tick is spent, so they share a tick — and
a trace is strictly increasing by contract. The merge rule ("later wins") ate
the SELECTION row and left three identical `walk` rows for a segment that
shoved a block; it is now "a substantive decision outranks `walk` on the same
tick", with rejections UNIONED rather than dropped. And each rung's row now
carries the WHOLE refusal chain, because relying on the merge made the
ruling's own requirement depend on a tick collision. ⛓ Climbs are NUMBERED:
cheapest-first holds WITHIN a climb, and a new obstacle starts a new one at
the bottom.

### What is left, computed rather than mysterious
`r8-solve-5` and `r8-solve-8` are NOT recorded, which is the step-0
prediction's armB — a room that refuses is REPORTED, never recorded. L8 gets
both shoves derived and the first driven, then stops on `sandtrap@96,80`,
whose arrow death §11.4 refuses to compute because its clear is the tape's
DECLARED v9 `at` row. L5's work order was itself a finding: a `lock` and a
KILL-lock are the same census tag and opposite problems, and live state now
refines `hold` → `kill` on `KILL_LOCK_TSET`. What L5 still needs is a two-pass
authoring loop (solve → read the model's own opening tick → declare →
re-solve), because `createLevelRun` takes `persistence` at construction.

## R8 slice 4: the two-pass authoring loop, and the walk the game shot

Full record: `NewDocs/plans/seedling-bot-r8-opus-kickoff.md` §13 (NewDocs is
gitignored, so that file exists only on the working machine; this section is
the tracked summary). Commits `6e9e1ac6c` (step 0, the prediction),
`2b603d6a0` (the loop and the `kill` executor). Fork untouched.

### The loop, built once

`twoPassSolve` breaks the circle `createLevelRun` creates by taking
`persistence` AT CONSTRUCTION: solve with the consequence undeclared, read the
opening tick from whichever oracle the MECHANISM allows, declare it as a v9
`at` row, re-solve. No new tape field — the loop is harness-side.

**Which oracle is a property of the mechanism, not a preference.** `model`
where the run computes the consequence end to end (`chaserKillLockOpens`'s
removal plus `activators.opensOnTick`'s fade — a kill-lock); `game` where
§11.4 refuses it (a static `"Enemy"` body's arrow death), and there the loop
refuses to substitute the model BY NAME, because a model that guessed would be
the second writer of a slot that exists to have one.

**The honesty check is the PREFIX, not the outcome.** A clear at `T` cannot
reach the world before `T`, so the measuring pass and the verifying pass must
press identical keys on every tick below it — otherwise the tick was measured
on a walk the verifying pass did not take. Its disagreement is constructed and
watched to go red by tick.

**"Two-pass" is the minimum, not the count**: L5 takes three (discover,
measure, re-solve) and L8 three. A declaration that does not unblock the walk
that measured it is named at the SECOND occurrence, not at the bound.

### The `kill` executor — `ARROW_KILL_PLAN`'s six phases, driven

Press, clear, bait, dwell, back, hold, as a loop over the bodies the count is
waiting on. The hold OUTLASTS the kill by the responder's own fade, as ONE
`runHold` with a two-claim condition — two calls would snapshot a ceiling
already armed and fail the positive control. The bait derives against the
regions the presser's GROUP arms rather than the live armed set, because the
bait happens with the ceiling OFF; and `presserSafety` is deliberately NOT
applied to a bait stance, because the hand answer's own stance sits inside a
lane and took zero hits with nothing firing.

Measured: the L5 policy kills all three bobs with no weapon — a drowning at
t=101 and two arrow kills at 163 and 323, which are §11.1's own numbers on a
walk the solver derived rather than replayed — and declares `{5,0}` at
`323 + 101 = 424`, 313 ticks below `r7-act2-5`'s committed upper bound (which
is NOT touched).

### ⛔ The game refuted the first walk, and the refutation is the slice

`r8-solve-5`'s 555-tick solve walked east out of `button@48,48` through
`arrowtrap@64,48`'s column with 22 arrows still falling. The GAME knocked the
player back at t≈206 — `hits` 1 against the model's 0, first divergence at
207, 41 dead frames out of band. **The tape was not committed**; it is banked
as a free oracle.

The exclusion that permitted it was reasoned from the mechanism (leaving a
button unpublishes its group on the same tick) and is **right about the next
volley and silent about the last one**. Gated on the column being EMPTY — the
reading the game argued for — the room WALLS, and the deadlock is exact: the
player cannot leave the button while the column is full, and the column cannot
empty while they stand on it.

⛔ **That is not a policy bug. It is a static corridor probe pricing a MOVING
hazard as a whole column for all time.** A lane's honest use is "do not WAIT
here"; a walk needs "will an arrow be at this cell when I am" — a timeline
question the AVOID rung does not ask and the TIME rung cannot reach across a
room. Fenced as a design question rather than improvised around.

### A guard that had been vacuous since the day it was written

`deriveShove`'s off-the-map bound compared TILE indices against
`world.world.width`/`height`, which are PIXELS. No `k` inside any room in the
game could trip it. L8 is where it bit: push-until-path walked column 6 out
through the floor and returned a destination the block cannot reach. With the
map bounded, no non-destructive cell yields a corridor in any direction, so
the ruled LAST RESORT applies and the block sinks at `(5,7)` — the hand
answer's cell, reached by exhaustion rather than by preference.

### Where the rung stands

The battery closes at **2 of 4** (`r8-solve-4`, `r8-solve-6`), with
`r8-solve-5` and `r8-solve-8` REPORTED and their walls named. **D2 and
`hasShield` were not reached**; the D2 recon — L18's spinner press arm (whose
second consequence is measured NIL: both placements carry `tag -1`), L19's
route through the boss's own body to the bosslock, and L20's shield → shieldlock
→ buttonroom → `lock@32,80` chain — is banked in kickoff §13.10.

## R8 slice 5: the eta-aware transit probe, the arrow that could not hurt you, and the battery's 4/4

⚖ The fenced moving-hazard question was ruled (kickoff §13.10a): a corridor is
validated **per cell at that cell's own ETA**, with the ETAs coming from the
controller that will actually drive; a stance keeps the dwell-window union; the
per-tick next-cell check stays live so planning optimism is bounded by the loop.

### The refutation was three defects, and the probe was the last of them

Before a line of the probe was written, the banked recording was replayed
through the unmodified model. What it says:

1. **The player-arrow bill did not exist.** `ARROW_PLAYER_ARM` named
   `PUZZLEMENT_HAZARDS.arrowtrap` as the payer; that is the CENSUS — a roster
   of placements and their damage numbers — and no line of `levelRun` billed
   from it. So an arrow could reach the player, stop dead on them, and cost
   nothing. `Arrow.as:49` calls `Player.hit`, and the game reported `hits: 1`
   where the model reported 0.
2. **A fresh volley moved on its spawn tick.** `Engine.update()` runs
   `world.update()` and calls `updateLists()` *after* it, so an entity added
   during a frame is not in the update list until that frame ends.
3. **The trap fired on a flag one frame stale where the game's is two.** The
   trap updates before the button (both are prepended, arrowtrap added later) —
   that half was already modelled. The other half is that the Player is added
   FIRST and therefore updates LAST, so the button that publishes the group saw
   the player a frame earlier still.

⛓ With all three fixed the model **reproduces the recording it was refuted
by**: the hit at t=207, source `arrow`, knockback dx −4.3951592784836375 with
the y impulse dropped by the strict comparator, and x = **62.35484072151636** —
the game's own digit, reached through `v.normalize(len − 0.25)` and
`Mobile.moveX`'s 1 px sub-steps. And the whole committed roster replayed
byte-exact throughout: **three arrow-family corrections, zero re-records.**

⚠ Scope, stated exactly: the arc's zero-hit CLAIMS rest on the game's own hits
counter inside the recordings, which was always the oracle. What was vacuous is
the MODEL's arrow-damage channel — a `pricedBy` that named a module nobody
billed from.

### The instrument, and the law it produced

`previewWalk` is the driver's own loop with `run.advance` swapped for a pure
stepper bound to the run's own options; `run.arrowForecast()` steps the arrow
subsystem — the **traps** as well as the arrows — along the previewed walk,
because the arrow that hit did not exist when the plan was made. Each sample
pairs the pre-move player box with the post-move arrows, which is the game's own
pairing.

⚖ **An ingredient may be carried forward in time only under AUTONOMY GIVEN THE
WALK.** An arrow's flight does not read the player; a chaser's does, so a
chaser is read live at horizon 0 and priced along the corridor by the per-tick
check. The measurement that forced the rule: growing a chaser envelope over a
whole corridor seals the room — 60 px in every direction over a 120-tick walk —
and L6's ladder escalated for ever in a room already recorded byte-exact.

### The two oracle gates

- **NEGATIVE**: from a plan made at t=198 the probe forbids the refuted walk's
  own cell at tick 206, naming the arrow and predicting it at (68,58) — the
  position the game's knockback arithmetic requires. The same cell asked at the
  plan tick is calm, which is what makes this a defect of the time axis.
- **POSITIVE**: the hand walk leaves its button with the column live and takes
  zero hits; the probe admits that corridor at its own ETAs while the WAIT
  reading refuses it. The deadlock dissolves as arithmetic.

### The battery, 4 of 4, each room's rung named

| tape | room | solver | hand | the rung |
|---|---|---|---|---|
| `r8-solve-4` | L4 | 253 | 347 | `hold` then `shove` (push-until-path, k=2) |
| `r8-solve-5` | L5 | **558** | 812 | `kill` — the ceiling's six phases, under the ETA probe |
| `r8-solve-6` | L6 | 294 | 355 | the ladder: AVOID → TIME → BAIT |
| `r8-solve-8` | L8 | **827** | 1090 | two shoves, the second sinking by exhaustion |

Zero hits and zero deaths everywhere. L5's `{5,0}` is declared at **427**,
model-sourced (the removal at 326 plus the responder's 101-step fade);  L8's two
clears are game-sourced **truncation boundaries measured on both sides** (246
carries the tag, 245 does not; 645 and 644 likewise). The hand tape's own
`at: 737` is not touched.

### A solver chain can now witness its own clears

Registering the two tapes was refused by the witnessed-clear law, which demands
the outcome of a hand-authored `phases` block — and a solver chain has no walk
at all. The law was right and its premise predated the solver. The staged arm
holds a chain's `clears` provenance to the same standard: two-sided set equality
against the tapes, and evidence that is recomputed (a model tick must add up; a
game tick must carry both sides of its boundary). Custody chains keep the
original law verbatim, asserted. The despawn half is pre-agreed, unbuilt — no
staged tape declares one — and proven to fail closed.

### Where the rung stands

The battery is **4 of 4**. **D2 and `hasShield` are slice 6's**, from the recon
banked in kickoff §13.10, with L18's press-arm-against-a-moving-body as its own
paired track.

## R8 slice 6: the shield, the press arm, and a −1 the game confirmed

The rung's boundary target, and the arc's oldest undischarged item. R6 debt 5
has read *"`hasShield` is real-collected by NO tape"* since 2026-08-08 —
`r6-shield-kill` ends in L19 at the boss key, the L20 walk was only ever
MODELLED, and every shield-holding tape is a legacy walk that GRANTS it.

**`r8-solve-20`** — the live solver crosses L20 from the L19 arrival and takes
the shield. 365 ticks, zero hits, recorded `--win --record --only=`: **31 PASS
/ 0 FAIL**, the model reproducing the recording it just made over 366
observations, `hasShield` false → TRUE, the `{20,2}` placement clear earned by
the pickup, the seam latched at a CALM ARRIVAL over all 46 signature rows.

⛔ **REPORTED, NEVER CREDITED** — `r8-d2-shield` is a `staged` chain, and what
a staged boot skips is the REACHING. The flip is still measured; the credit
stays the custody chains' claim.

⚠ **`save.rockSet` is NOT witnessed by it.** `Shield.removed()` sets
`Moonrock.beam`; the MOONROCK consumes it and writes `rockSet`, and the
moonrock is in L0. A walk that never leaves D2 cannot reach it.

### The route's own shape was the first finding

The recon read as "L20's three gates stand between the walk and the shield".
They do not: `shield@112,48` is in the middle chamber and the L19 arrival
reaches it with no gate at all. What `shieldlocknorm` → `buttonroom` →
`lock@32,80` open is the way OUT, west, to L13. The gates are a SHORTCUT the
room grants, not the errand it is for — which is why `touch` did not get its
room this slice: the segment that takes the shield never meets the lock.

### The press arm against a body that moves on its own

`KILL_ARM_POLICY.Spinner` `refused` → `modelled`, with the driven pair
(`r8-l18-spinner-press`, 25 PASS / 0 FAIL). All 332 committed tapes replay
byte-exact with the arm on, zero re-records — and that was a real fork: the
exposure was measured first by driving the roster, and two committed tapes
really do land presses on a spinner (`r5-press-glide`, `r5-press-repeat`), one
and two landings each, no kills.

What the conversion needed, and none of it was the transcription:

- **the FIFTH non-constant press rect**, and the first that is never where the
  level built it — four bodies before it move because the walk did something;
  a spinner is a billiard. Without a press-box override `entityRect` refused
  it by name, so the census could not have seen it at all.
- **one press is one hit, and a THIRD mechanism culls the five tests**: the
  i-frame refuses (a row), the Owl's recession refuses (a row), and a spinner
  drifts out of the RECT — which leaves no row at all.
- **both consequences computed** — the first `modelled` kill arm whose
  kill-lock scan is NOT a nil (the second death opens L18's `lock@144,112`).

### ⛔ A −1 tag is not a no-op, and an out-of-band write is never a permission

Both L18 placements carry `tag="-1"`, and the recon had banked that as a nil
second consequence. `Main.levelPersistenceSet` indexes `level*30 + tag` with
no bounds check, so a kill there writes **{17,29}** — the previous level's
last slot — and `Spinner.check()`'s `tag >= 0` guard is exactly why
`doActions` survives to let it through. The GAME's own recorded
`persistence_cleared` carries it.

⛔ And the first cut banked it as an earned CLEAR, which the next level build
refused by name: *"the tape clears tag(s) 29, which no entity in this level
reads"* — which an out-of-band slot is by construction. A −1 write is a
LEDGER ENTRY and never a PERMISSION.

### The hammer is a refusal, not a bill

`Spinner.update` swings a `collideLine("Player", …)` whose phase is
`(Game.time % 45)/45·2π`, and `Game.time` counts DEAD FRAMES — a per-load
variable the model does not carry. So the angle is not predictable and the
honest quantity is the UNION over all 45 phases: a 13 px disc, forbidden at
plan time by the danger map's new ingredient and refused at the tick by
`assertPlayerClearOfHammers`. ⛓ The census scan had been pricing spinners at
their PLACEMENT — forbidding a cell nothing is in while calling the cell the
body is in calm.

### Where the rung stands

`hasShield` is **DISCHARGED**. L18 and L19 are not crossed: L18 needs a stance
derivation (a ~4 px annulus where the sword reaches and the hammer does not),
L19 needs the ShieldBoss fight as a derived press schedule plus a `keylock`
executor. `touch` is still the unregistered control and its room is L20's
westward crossing.

## R8 slice 7: the first boss fight a policy drove, and a disc that made its own problem

D2's last two rooms, as the machinery's **first multi-segment staged chain**:

```
r8-d2        1,645 ticks   the headline — both rooms in ONE run
r8-d2-19       864 ticks   the Shieldspire: the fight, the boss key, the bosslock
r8-d2-20       781 ticks   the shield, and the way OUT westward to L13
             82 PASS / 0 FAIL · ZERO hits · ZERO deaths · ZERO re-records
```

Four firsts. **A boss fought by a policy** — R6 killed the same ShieldBoss from
a hand-authored one-key window; this one derives the stance, reads the press
window off the run's own ledger and presses three times. **`touch` has its
room** — the trap-62 control since slice 2 is registered, and *replaced* rather
than deleted (`solid:wandlock → wand` is the new selected-and-unregistered
row). **A staged chain with two segments**, so the cut, the ends-meet
arithmetic, the stream slices and an internal seam are exercised for the first
time on a solver chain. And **the loop closes**: the chain ends in L13, D2's own
front door.

### The fight is arithmetic, not choreography

`hitPlayer` counts 120 *consecutive* band ticks and opens `movedShield`, the one
animation `ShieldBoss.hit` forwards through. `slashDelayMax` is ZERO, so a press
is five hit tests on five ticks — the press tick is therefore the **earliest T
whose whole dispatch train lands inside the window**, i.e. `windowFrom − 1`.
Driven: stabs at 218/343/467, windows [222,237]/[347,362]/[471,486], presses at
221/346/470, landings at 223/347/471. The first press spends its first dispatch
on the arming swallow and lands on its second; `hitsTimer = 30` refuses the four
behind each one. Zero hits is a claim about the *stab*: every landing calls
`sit()`, aborting before the damaging frames.

The stance is one held key doing four jobs — from a lattice cell under the band
the slash rect *ends* on the body's bottom edge and overlaps nothing, so the
verb derives the cell and then holds `up`, which pins the player into the band,
into reach, and facing the right way.

### Two rulings, as built

A lock on the frontier resolves through the **mechanism graph** to its tSet
group's openers, never by its own id — L20's `lock@32,80` is opened by
`buttonroom@192,16`, four tiles away and behind another gate. And a **stance**
reachable only once another pending strategy-selected obstacle is discharged is
a legal derivation target, with the hypothesis bounded to registered strategies
and named in the trace. ⛔ Discharging a lock opens the *solid* and leaves the
*volume*: an open `shieldlocknorm` becomes a proximity hazard, which A\* refuses
just as firmly, so a hypothesis must exempt what it discharges.

### ⛔ Two findings about instruments, and the second is the user's

**A ctx snapshot may freeze STATE, but never a ONE-TICK TRANSIENT.**
`spinnerForecast` reused one collision context across its whole horizon,
freezing `beforeTypeFlip` — the flag that reads the world before any tile is
solid. A forecast taken on a level's first tick predicted every body's
trajectory *in a room with no walls*: divergence at tick 51, bodies 750 px
outside a twelve-tile room by 1,200. Its consumer is the eta-aware danger arm,
so on exactly the tick a solver plans its first corridor, the map called the
cell a body was in calm.

**A conservative ingredient can manufacture a policy problem.** A `Spinner`'s
hammer is a rotating line; the model did not carry `Game.time`, so the shipped
ingredient forbade the union over all 45 phases — a 13 px disc. Under it, L18
had one clear cell (behind the lock the fight opens) and zero attack stances, so
the room looked like it needed a moving, dodging policy, and one was designed
and built. The user said the hammer is predictable. It is: `time += timeRate`
runs once per `Game.update()` below the dead-frame gate, `timeRate`'s only other
writer is the opening cutscene, and the boot value already rides in the save
seam — so the clock is deterministic given the walk. Re-censused against the
exact **line**: 16 clear cells and **three static attack stances**. The policy
problem was an artifact of the approximation.

⇒ **L18 is REPORTED, not recorded.** The strike schedule is built and driven and
stops in the room's south-west corner; what it wants next is not a better policy
but a better instrument — a `Game.time` accumulator, `hammerLine` promoted from
a bound to a contact, and a driven pair proving a predicted-safe stand takes
zero hits while a predicted-unsafe one takes the hit at the predicted tick.

## R8 slice 8: the hammer-accurate model, and the honest L18

Slice 7 reported L18 and named five pieces it wanted. All five landed, and the
room that had refused a policy is a recording:

```
r8-solve-18   573 ticks   noDamage RETIRED, the GAME's own hits: 0
                          both spinners killed by PRESS, {18,0} declared at 385,
                          the exit crossed to L19, 574 observations byte-exact,
                          46 seam rows latched, the clock exact at 9200
```

⛔ **Zero spinner contacts on either arm** — neither `Enemy.hitPlayer`'s 7×7
body at force 3 nor `Spinner.update`'s 13 px `collideLine` at force 4, both of
which this tape is now billed for. `r8-l18-spinner-press` stays exactly where it
is as the conservative era's mechanism witness: it declares `noDamage` and this
one does not.

### `Game.time` becomes a MODELLED quantity, and ten committed latches agree

`Game.as:846`'s `time += timeRate` sits BELOW the `blackCover` gate and outside
it, so the quantity is the boot value plus **every** `Game.update()` — live,
frozen, ceremony and room-fade alike, all of which the run already counted
separately. `gameClock.js` folds them into one span ledger and
`SEAM_BOOT_SPEC`'s `time` row flips to `modelled: true`.

⛓ **The free oracle was on disk already.** Every chain segment declares its
successor's `save.time` from a latch the GAME took: **ten pairs, ten exact
agreements**, including both ceremony segments — where the sword's extra `Help`
frame is the difference between `r7-act2-10`'s 151 and `r8-d2-19`'s 150, and was
measurable on the roster before this file existed (`r3-collect-sword` is 171
dead frames against 170 for every other `r3-collect-*`). ⛓⛓ And a SECOND oracle
was already on the wire: `botStatus.game_time` had been a readout since R5 slice
3 with **no consumer** — trap 119 — and the differential now asserts the
terminal latch against the model's clock on every tape.

⛔ **The flag is true only where the count is exact.** No `pins: ["dead_frames"]`
⇒ a load's fade is a RENDER count (18..21) and the clock is `null`; a
`cutscene[0]` boot ⇒ `timeRate` decays and the clock is `null`. Every consumer
refuses by name rather than billing a guessed phase.

### The hammer is a CONTACT, and it is the SECOND bill

The game bills: `Spinner.as:70-76` calls `player.hit(this, 4, new Point(x, y))`
and `Player.hit`'s own `d` default is 1 — the 4 is the FORCE. So force 4,
damage 1, through the run's one `applyPlayerHit` funnel. ⛔ **And it is the
second bill, not the only one**: `Enemy.update` runs `hitUpdate(); hitPlayer();`
on the line above, so a spinner damages through its 7×7 BODY at force 3 and
through its 13 px LINE at force 4, in that order, in one frame. Narrowing the
refusal to the line alone would have opened a hole exactly the size of the thing
the disc covered. `hammerHitsPlayer` uses `crusher.collideLineSolid` — the ONE
transcription of `World.collideLine`, `int` cast and endpoint-skip included.

### The census, re-run against the LINE — and the disc's own arm as the control

Same room, same 60 walkable cells, same 600-tick horizon, one instrument:

| priced by | clear for the whole horizon | ...AND getting 3 separated presses |
|---|---|---|
| the 13 px disc | **1** — and it is behind the kill-lock | **0** |
| the exact line ∪ body | **11** | **3** — (8,1), (6,3), (2,5) |

⚠ The counts are PHASE-DEPENDENT (the body moves while the hammer turns), so
the assertion is a strict inequality plus the one invariant — that a static
striking stance EXISTS, which the disc arm says it does not. ⛓ And
`clearOfHammersAt` is the ONE predicate the whole strike schedule asks, so
upgrading it upgraded `deriveStrike`, `deriveRefuge`, `trainIsSafeHere`,
`stepToward` and `safeStep` together and could not leave two of them
disagreeing. `deriveRefuge` FILTERS on the line and SCORES on the disc: safety
is the mechanism, margin is a preference.

### The driven pair is ONE INTEGER apart

Same room, same boot, same 324 ticks of the same input. The only difference is
the declared `save.time`, which on this roster reaches exactly one mechanism:

| | `save.time` | model | GAME |
|---|---|---|---|
| `r8-hammer-arm` | 4800 | 15 ticks inside the disc, 7.75 px past its reach, ZERO contacts | **`hits: 0`** |
| `r8-hammer-control` | 4837 | a HAMMER contact at tick 247, `Game.time` 5104, phase 19/45, angle 152° | **`hits: 1`**, reproduced byte-exact over 325 observations |

⛔ **And the game refuted the first version of it.** A pure 254-tick stand came
back `hits: 1` against a model predicting 0 — *on the ARM*. Localised rather
than patched: the model's own next prediction was a BODY contact two ticks past
the tape's last observation, and the differential reads `hits` from `botStatus`
AFTER the disarm while the page keeps running. The game's own `hits_timer` dated
it there. ⇒ **a zero-hit tape has to END CLEAR, not merely run clean**; the walk
north is that, and it RAISED the arm's disc exposure from ten ticks to fifteen
rather than lowering it.

### ⛔ Three defects the accurate ingredient uncovered

1. **The scan's bound became the wall.** `deriveStrike` truncates at 40
   candidates in TICK order. Under the disc those forty spanned hundreds of
   ticks; under the line most of the room is safe most of the time, so all forty
   landed at `i = 2..5` — every one a cell the controller needs forty-plus ticks
   to reach — and the scan rejected itself. **The conservative ingredient had
   been HIDING a defect in the bound.** Candidates are pre-filtered by an
   admissible-ETA floor before the truncation now.
2. **The kill lock had no writer.** Slice 7 said the spinner arm *"leaves the
   opening itself to `stepActivators`' own kill-lock arm"*. There is no such
   arm — `active = a.t >= 0 && …` makes a `tset == -1` lock unreachable by
   construction, as it must be, because no button answers one. Driven, the solve
   killed both bodies and sat out the lock's whole 101-tick fade waiting for a
   mechanism nobody built: **a ledger that PREDICTS an opening printed exactly
   like one that PERFORMS it.** ⛔ And the throw is scheduled for where the CLEAR
   lands, not where the removal does — `r8-l18-spinner-press` kills its second
   spinner on its last tick, so its clear lands 101 frames after the tape
   disarms, and a throw at the removal would have refused a committed tape for a
   divergence that cannot exist inside it.
3. **And the game found the third.** The first recording came back refuted at
   tick 36, 2 px in x, with the other 476 observations exact. The schedule
   pressed at 33 and again at 35 — and `slashTimer` is 20, so the sword's own
   *"double tap to dash"* makes the second press a **DASH THAT MOVES THE
   PLAYER**. The gate was the RECEIVER's `hitsTimer`, which is the right
   question one tick too early: a press's tests run over `T+1 … T+5`, so the
   body's timer is still 0 when the loop re-aims. The arm honours
   `KILL_PRESS_CADENCE` now — the floor `killSchedule` has refused a smaller
   value than since R5 and which this arm never consulted. Six presses instead
   of twelve.

## R8: the live solver bot, as built (CLOSED 2026-08-11)

R8's brief and full as-built record are
`NewDocs/plans/seedling-bot-r8-opus-kickoff.md` (§§0–7 the brief, §§8–17 the ten
as-builts (slices 0–8, with a 3b), §18 the close — NewDocs is gitignored, so the file exists only on
the working machine; this section is the tracked summary).

⚖ **The rung's scope was PIVOTED before it began** (user, 2026-08-10, recorded
at the tail of "What R7 hands on" above): the M1→M2→M3 ladder's ordering is
superseded, **M3 is promoted to now**, and the end goal is a Cloudberry
Kingdom–style procedural level generator for Seedling — add an obstacle, re-run
the solver, check the level still completes. R8 is that program's **player**,
not its generator. The boundary (`hasShield` earned by the new machinery) was
ruled at the outset and hit at slice 6; slices 7 and 8 were re-rulings that
extended the rung rather than re-scoping it.

**What the rung is.** A reactive sense → plan → act policy (`solverBot.js`)
drives the JS model through its existing single-tick seam `run.advance(held)`,
identifies the obstacle when no corridor exists, selects a strategy from the
verb library, derives every free parameter from the room's own transcribed
mechanism data, and emits per-tick keys into the EXISTING emission and
verification tail — spans, a tape on disk, `--record --only=`, the byte-exact
wasm differential. **Twenty tapes**, every one recorded through the game and
byte-exact, **zero re-records of any committed artifact across all ten as-builts**.

**The claim, as the live readouts state it** (a `--win` differential over the
rung's own twenty tapes, no `--record`, clean tree afterwards — quoted rather
than paraphrased):

```
ALL CHECKS PASSED                       534 PASS / 0 FAIL over 20 tapes
PASS  r8-solve-18: the game's own `hits` matches the damage model — game: 0, model: 0
PASS  r8-solve-18: the game's own latched `save.time` is the model's clock
        game 9200, model 9200
PASS  r8-hammer-control: the game's own `hits` matches the damage model — game: 1,
        model: 1 (1 landed hit(s), 0 death(s))
PASS  r8-d2: every ShieldBoss the run KILLED wrote its persistence flag
        shieldboss@80,32 -> 19:0 off at tick 471 (destroy 494, removed 506)
PASS  r8-d2-20: the game refused input where the model says it must
        shieldlocknorm@176,16 for 100 tick(s) modelled
PASS  chain r8-d2: the segment tick counts sum to the headline's — 864 + 781 = 1645
PASS  chain r8-d2: ⛓ THE SEAM r8-d2-19 -> r8-d2-20 is GREEN over the whole
        signature — 46 signature rows compared
SKIP  chain r8-d2-shield: ⛓ the EARNED set is exactly what the chain declares
        EARNED but not declared: shield@L20 — ⚠ REPORTED, NOT CREDITED: a staged
        boot can DECLARE a flag but cannot have EARNED it, because it skips the
        reaching. Earning stays the custody chains' claim.
```

- **The battery is 4/4 and the leg-only rooms are 7/7.** The bot re-solves every
  room the hand pipeline solved — eleven `act2` segments' worth of rooms — from
  staged boots, each tape byte-exact, each faster than the hand answer where the
  hand answer used a margin (L4 253 against 347, L5 558 against 812, L6 294
  against 355, L8 827 against 1090). ⛔ The hand-authored stances, waypoints and
  hold ticks were never handed to the solver; goals are PLACEMENTS and EXITS.
- **`hasShield` is EARNED inside a driven solver segment** — R6 debt 5, the
  arc's oldest undischarged item, closed at slice 6: `hasShield false -> TRUE`
  plus the `{20,2}` placement clear, in `r8-solve-20`, 365 ticks, zero hits.
- **D2 is crossed end to end** as the machinery's first MULTI-SEGMENT staged
  chain (`r8-d2`, 1,645 ticks; `r8-d2-19` the fight and the bosslock, `r8-d2-20`
  the shield and the way out) — and it ends in **L13**, D2's own front door.
- **A boss is fought by a POLICY**, not a hand-authored window: the stance
  derived under `shieldBossBandRect`, the press ticks read off the run's own
  `shieldBossStabs` ledger (`windowFrom − 1`, because `slashDelayMax` is zero),
  three presses for three hits, `hits: 0` over 1,646 observations.
- **L18 is honest**: `r8-solve-18`, `noDamage` retired, both spinners killed by
  press under an accurate hammer.
- **Every refusal conversion is a PAIR.** `Bob` stepped (`r8-l6-bob-contact` —
  the game confirmed `chaserStep`'s arithmetic digit for digit, three rungs
  after it was transcribed) with `jellyfish` still throwing by name;
  `KILL_ARM_POLICY.Spinner` `refused` → `modelled` (`r8-l18-spinner-press`) with
  `Jellyfish` as the replacement control; `touch` registered with `wandlock`
  as the replacement control. ⛔ **`KILL_ARM_POLICY.Bob` stays `refused`** — no
  room drove a press against a chaser, and a refusal retired without a driven
  witness is worth nothing.

**What the rung built.**

- **`solverBot.js`** — the policy: goal list (`reach-exit`,
  `collect-placement`), A\* corridor over the run's own branded fourteen-family
  bag, obstacle identification at the COMPONENT FRONTIER, `OBSTACLE_STRATEGIES`
  → `STRATEGY_EXECUTORS`, event-driven re-planning. ⛔ A strategy may be
  SELECTED and not REGISTERED, and the refusal then names it — which turns the
  next slice's charge into computed work orders rather than a hunt.
- **The escalation ladder** — AVOID → TIME → BAIT → KILL, cheapest first,
  `ESCALATION_LADDER` exported so the checker reads the RUNNING order. Climbs
  are NUMBERED: a new obstacle starts a new climb at the bottom, because a
  policy that remembered "I escalated last time" would skip the cheap rung for
  the rest of the segment.
- **The enemy bridge** — `chasers.chaserStep` has a caller at last
  (`stepChasersNow`), gated per `MODELLED_ENEMY_CLASSES` row; `contactPricing`
  reclassified `mover` → `stepped` with `pricedBy` as the load-bearing field
  (priced in its own step ⇒ the census scan must SKIP; unwired ⇒ it must THROW);
  and the **Arrow × Enemy family**, which is what made the bridge correct rather
  than wrong-in-the-tail.
- **The union danger map** — `dangerAt(run, tick, box, {mode})` over SIX
  ingredients (live arrows + armed lanes, placed hazards, stepped enemies,
  crushers, static census bodies, spinner hammers), returning a REASON LIST and
  never a bare boolean. `HAZARDS_PRICED_LIVE` names, per family, the ingredient
  that prices it instead of the census.
- **The ETA-aware transit probe** — `dangerDuringTransit` vs
  `dangerWhileWaiting`, two named questions that must not share a name;
  `run.previewStepper()` (the controller's own physics) and
  `run.arrowForecast()` (the arrow SUBSYSTEM, traps included) predict along the
  previewed walk. `TRANSIT_INGREDIENTS` is the coupling partition and the law is
  **autonomy given the walk**.
- **`gameClock.js`** — `Game.time` as a modelled accumulator over every
  `Game.update()`, dead frames included, checked against ten committed latches
  and against `botStatus.game_time` on every tape.
- **The staged chain kind** — `CHAIN_KINDS` as a POLICY TABLE, not two `if`
  statements: `staged` skips the custody base case and the goal-ledger CREDIT,
  keeps its internal seams, the witnessed-clear/despawn laws and the
  calm-arrival requirement, and takes `minSegments: 1`. Both custody chains are
  asserted BYTE-UNCHANGED — the test asserts neither entry declares a `kind` at
  all, because `chainKind(c) === 'custody'` would pass just as well if someone
  had typed it in.
- **The staged witnessed-clear arm** — `clears: [{level, tag, at, source,
  evidence}]` on the chain row, two-sided set equality against the tapes, and
  the EVIDENCE checkable rather than a comment: `source: 'model'` must add up
  (`removedAt + fade === at`), `source: 'game'` carries **both sides** of the
  truncation boundary (`carriesAt === at`, `absentAt === at − 1`).
- **The two-pass authoring loop** (`twoPassSolve.js`) — solve with the
  consequence undeclared → read its tick from whichever oracle the MECHANISM
  allows → declare → re-solve. ⛓ The honesty check is the PREFIX, not the
  outcome: a clear at `T` cannot reach the world before `T`, so both passes must
  press identical keys below it.
- **The decision trace** (`decisionTrace.js`) — a SIDECAR, asserted never to
  become a tape field; every row's `keys` are exactly what `heldKeysAt` says the
  tape held on that tick, with the disagreement CONSTRUCTED and watched to go
  red; trap 142's silent-death query graduated from the probes into it.

**Standing findings** (source-proved or driven; do not re-derive):

- ⛔ **Stepping a body whose DEATH the model cannot see is not a partial model,
  it is a WRONG one** — the position is right for exactly as long as the body
  should have existed and wrong for ever afterwards. The roster is scoped by
  LIFETIME, not by class.
- ⛔ **A bounded refusal is only as good as somebody re-checking its bound, and
  the only reliable re-checker is the assertion itself** — paid three times this
  rung (the pit descent, the static-body arm, the `KILL_SIDE_WRITES` −1 arm).
- ⛔ **A hazard whose lethality is STATE and whose geometry is STATIC will be
  priced twice, and the static reading wins** — a disarmed trap's whole column
  was forbidden for ever, in the room whose only way north it is.
- ⛔ **A corridor probe evaluated at ONE INSTANT cannot price a hazard that
  moves, and both wrong answers are silent.** The cure is not a conservative
  layer; it is the layer that was missing.
- ⛔ **An ingredient may be carried forward in time ONLY if it is AUTONOMOUS
  GIVEN THE WALK** — player-coupled ingredients read live at horizon 0. Growing
  a coupled envelope over a long horizon SEALS ROOMS, and a wrong "closed"
  seals the map.
- ⛔ **A conservative ingredient can MANUFACTURE a policy problem** — and hide
  defects in the bounds around itself. The 13 px hammer disc made L18 look like
  it needed a moving dodging policy; the exact line gives it three static attack
  stances.
- ⛔ **A ctx snapshot may freeze STATE, but never a ONE-TICK TRANSIENT** — a
  forecast taken on a level's first tick ran its whole horizon in a room with no
  walls, and its consumer was the ingredient built to keep the policy safe.
- ⛔ **A −1 write is a LEDGER ENTRY, never a PERMISSION.** A `setPersistence(-1)`
  in L18 lands on `{17,29}`, the previous level's last slot; the game's own
  readout confirmed it. The guard that would have made the write conditional is
  the same test that makes it unconditional.
- ⛔ **A terminal readout bills frames the tape never drove** — the differential
  reads `hits` after the disarm while the page keeps running, so a zero-hit tape
  must END CLEAR, not merely run clean.
- ⛔ **A receiver-only gate cannot see the PRESSER's cooldown** — gating a press
  loop on the body's `hitsTimer` is the right question one tick too early, and
  the second press became a DASH that moved the player 2 px.
- ⛔ **A committed artifact can stop being what its PRODUCER derives, silently.**
  The differential replays the ARTIFACT — a fixed input list — so it cannot see
  that the artifact is no longer a walk its producer would author. Two claims,
  two instruments.
- ⛔ **A coverage check placed one function downstream of the roster it polices
  checks the wrong roster** — and the caller had been two families short for two
  rungs behind 6,783 green tests.
- ⛔ **A solver's world is an argument with a default, and the default was tuned
  for somebody else** — a combat-blind run "crossed" L6 in 174 zero-hit ticks
  while the game took seven contacts and died twice.
- ⛓ **A placement inside a solid is an OBSTACLE, not a stance problem**, and
  **the frontier must prefer doors to walls**: an obstacle with no selected and
  registered strategy is a WALL for that choice.
- ⛓ **A lock on the frontier resolves through the MECHANISM GRAPH, never by its
  own id** — and discharging a lock in a hypothesis opens the SOLID and leaves
  the VOLUME, which A\* refuses just as firmly.

**The close-out debts, by name.**

1. **`r8-d2` did not grow to three segments.** L18 solves and its latch is what
   segment 2 would boot from, but PREPENDING it re-authors `r8-d2-19`'s boot
   block and therefore re-records three committed artifacts. ⚖ **RULED (user,
   2026-08-11): no re-record licence — the splice is R9's first act**, done once
   with the campaign's own licence.
2. **`r8-solve-4`'s drift** — 255 ticks derived against the committed 253, from
   slice 5's three arrow-family fixes moving L4's arrow kill 114 → 116. The tape
   and its recording are untouched and byte-exact; what changed is what the
   producer would author. REPORTED, not re-derived, for the same reason as 1.
3. **The despawn provenance channel** — pre-agreed
   (`despawns: [{level, id, at, source, evidence}]`, same two-sided equality)
   and UNBUILT, because no staged tape declares a despawn and a channel with no
   caller is the very law being honoured. Proven to fail CLOSED: a staged chain
   whose tape declares a despawn is refused by name today.
4. **`plannerObstacleAt`'s legacy 8-of-14 forwarding** — untouched since slice
   0. The solver's own `liveBag` entry forwards all fourteen; the legacy shape
   is byte-preserved because forwarding the six re-routes the planner. The drop
   is a MEASUREMENT with a total partition and a test that derives which
   families survive by driving the function with fourteen sentinels.
5. **L14 / L15 / L16 are uncrossed**, so D2 is not reachable from L13 by a
   contiguous chain — the only path is L13→L14→L15→L16→L18.
6. **`KILL_ARM_POLICY.Bob` stays `refused`**, and with it the chaser press
   arm's 25-tick die ANIMATION and the who-killed-it fencepost's press side (a
   bounded vacuity with its bound re-stated rather than inherited).
7. **The goal ledger still stands at 2/41**, all of it R7's custody chain's.
   Everything R8 earned — the shield, the boss key, three L20 flags, `{18,0}` —
   is on STAGED chains, and a staged boot can DECLARE a flag but cannot EARN
   one, because what it skips is the REACHING.
8. **The dash is avoided, not modelled** — `KILL_PRESS_CADENCE` keeps every
   press outside `slashTimer`, so no walk on the roster produces one.
9. **Carried unchanged from R7**: `buildTape`'s v5 cap; the L3→L11 shortcut,
   named and not taken; the strict-vs-minimal order question; three
   unreconciled Seedling worlds; the model refusals (BobBoss, the spear's
   three-hit repeat, the FireWand arm, the darksuit retaliation arm,
   `Explosion`'s Enemy arm); `GROUPED_LOCK_EXCEPTIONS` as a hand row.

**The retirement decision: NO DEMOTION**, and it is a decision rather than an
omission — re-derived at close from the committed expectations' own
`transitions` rather than from any slice's table.

| the R8 additions | crutches | boot | levels visited |
|---|---|---|---|
| `r8-solve-1` | **none** | the TRUE INITIAL STATE `0@80,128` | 0, 2 |
| `r8-solve-{2,3,4,5,6,7,8,9,10,11}` | **none** | a declared v8 seam block | one room + its exit |
| `r8-solve-18`, `r8-solve-20`, `r8-d2`, `r8-d2-19`, `r8-d2-20` | **none** | a declared v8 seam block | 18/19, 19/20, 13/19/20 |
| `r8-hammer-arm`, `r8-hammer-control` | **none** | a declared v8 seam block | 16, 18 |
| `r8-l18-spinner-press` | **`noDamage`** | a declared v8 seam block | 18 |
| `r8-l6-bob-contact` | **none** | a chosen stance (a v3 contact pair) | 6 |

- **Nineteen of the twenty carry no crutch of any kind**, and the twentieth
  (`r8-l18-spinner-press`) is kept deliberately: it is the conservative era's
  mechanism witness, and `r8-solve-18` is what makes the contrast a measurement.
- ⛔ **A staged segment supersedes NOTHING, and that is the load-bearing half of
  this evaluation.** Eighteen of the twenty boot a declared seam block. On the
  crutch-and-levels criterion alone, fifty-two roster tapes read as superseded
  by an R8 tape — which is the criterion being asked a question it cannot
  answer: what a staged boot skips is the REACHING, so a one-room staged segment
  cannot retire a walk that arrived under its own power. The two exceptions are
  checked rather than assumed: `r8-solve-1` boots the true initial state and
  walks L0→L2, which is `r7-act2-1`'s own room and supersedes nothing
  `r7-act2-1` did not; `r8-l6-bob-contact` is a 30-tick contact pair.
- ⛓ **What R8 adds that nothing else has**: **L18 is reached by no other
  fixture in the roster**, and L16 by nothing but `r8-hammer-arm`'s exit tick.
- The R4 ENDS-MEET set and the two mechanism witnesses R7 kept are kept for
  R7's own reasons, unchanged: an arithmetic claim with a hole is worse than a
  redundant tape, and mechanism-witness pairs are kept unconditionally.

⇒ the roster stands at **153 tapes** against R7's 133.

## What R8 hands on, and what R9 inherits

⚠ This table SUPERSEDES the R7 one above for every row R8 touched.

| item / gate | what R8 did with it | rung |
|---|---|---|
| **M3 — the live reactive bot** | **BUILT**: `solverBot.js`, the ladder, the danger map, the ETA probe, the trace — twenty tapes, all byte-exact through the game, zero re-records over ten as-builts | **DISCHARGED (R8)** |
| **`hasShield` + the L20 walk** (R6 debt 5, the arc's oldest) | **EARNED** in `r8-solve-20`, `false -> TRUE` plus `{20,2}`, inside a driven solver segment — reported-not-credited on a staged chain, with `save.rockSet` named as the witness a D2 walk cannot reach (the moonrock is in L0) | **DISCHARGED (R8)** |
| **D2 / the ShieldBoss / boss key 0, honestly** | **CROSSED** — `r8-d2`, two segments, one internal seam, the fight derived by the policy, ending in L13 | **DISCHARGED (R8)** |
| **the act2 known-answer battery** | **11/11 rooms re-solved** by the bot from staged boots (7 leg-only at slice 2, 4 mechanic rooms at slices 3b and 5), every tape byte-exact | **DISCHARGED (R8)** |
| **`normalizeLive`'s remaining consumers** (R6 debt 3's residue, owed eight slices) | **PAID** at slice 0 — 21 sites converted, every consumer entry asserting the brand against `LIVE_GEOMETRY_KEYS`, two refusals named with the source's own reason | **DISCHARGED (R8)** |
| **`chasers.js` / `hazards.js` / `encounters.js` orphaned from the driver** | `chaserStep` has a caller and the game confirmed its arithmetic digit for digit; `hazardVolume` and `chaseEnvelope` are danger-map ingredients | **DISCHARGED (R8)** |
| **nothing prices an arrow in flight against the player** (R7 debt 5) | **PAID** at slice 5 — the model bills the player for an arrow through `applyPlayerHit`; every zero-hit claim in a room with a ceiling is now a real claim on that channel | **DISCHARGED (R8)** |
| **`KILL_ARM_POLICY.Spinner`** | `refused` → `modelled`, paired, with the hammer as a CONTACT that bills | **DISCHARGED (R8)** |
| **`KILL_ARM_POLICY.Bob`** | still `refused` — arrows and water were the mechanisms every room needed; nothing drove a PRESS against a chaser | **R9+** |
| **the three-segment `r8-d2`** | L18 solves and its latch is segment 2's boot; prepending it re-records three committed artifacts. ⚖ **RULED (user, 2026-08-11): R9's FIRST ACT**, with the campaign's own licence. ⛓⛓⛓ **DONE at R9 slice 3**: `r8-solve-18` PROMOTED (not duplicated) as segment 0, both latches MEASURED, `cuts [573, 1437]` / `endsAt 2218`, both internal seams green over all 46 rows, the R8 gate 534 → **541 / 0 / 67** | **DISCHARGED (R9 slice 3)** |
| **`r8-solve-4`'s drift** (255 derived vs 253 committed) | REPORTED twice, never re-derived; the tape replays byte-exact and the producer's `--check` is the instrument that sees it. ⛓⛓⛓ **PAID at R9 slice 3** under the same licence: 253 → **255**, and the battery `--check` goes `1fedb0ab…` exit 1 → **`67bcde75489419e5331187b8ebf140a7` exit 0**. The root cause is fixed too — no `--record --only=r8-solve-4` recipe existed anywhere in the repo, which is why the one instrument that could pay it never ran | **DISCHARGED (R9 slice 3)** |
| **the goal ledger's other 39 rows** | UNCHANGED at 2/41 — everything R8 earned is on staged chains, which report and never credit | **R9's campaign** |
| **ASSEMBLY** — solver segments re-run along genuine latches into the honest chain | untouched by design (the pivot's own sequencing); the machinery is complete and the multi-segment staged chain proves the seam works on solver output | **R9+**, on coverage |
| **the wasm differential's sunset** | still the per-segment oracle, as ruled — and it EARNED that four times this rung (the blind L6 solve, L5's refuted walk, the hammer arm's first version, L18's dash). What R8 exercised through it: 20 new tapes; the chaser bridge; Arrow × Enemy; the arrow-vs-player bill; the spawn-tick deferral and the two-frame arming lag; the spinner press arm and the hammer contact; `Game.time`. What it has NOT exercised: any room in D3–D8, the ending, L14–L17, the trap bosses, any press against a chaser | **R9+**, and the graduation claim stays BOUNDED |
| **the despawn provenance channel** | pre-agreed, unbuilt, proven to fail CLOSED | **R9+**, when a staged tape declares one |
| **`plannerObstacleAt`'s legacy 8-of-14 forwarding** | measured, partitioned, byte-preserved; the solver's own entry forwards fourteen | **R9+**, needs a re-record licence |
| **L14 / L15 / L16** | uncrossed — ⚖ ruled out of scope at slice 7; they are the campaign's rooms to cross when D2 is played from the real chain | **R9's campaign** |
| **`touch` / `wand`** | `touch` REGISTERED with L20's westward crossing as its driven witness; `solid:wandlock → wand` is the replacement selected-and-unregistered control, and L40's fourteen wandlocks are real obstacles with a real verb | **R9+** |
| **the design AI / procedural generator** (the pivot's horizon) | untouched by design — it needs the solver first, and the solver now exists and has crossed every mechanic room the hand pipeline solved | **R9+**, the horizon |
| **the L40 chain** (links 5–11, boss key 2) | untouched; still scheduled, still priced at 2,500–4,000 ticks | **R9+** |
| **the TIME rung is attempted against danger it can never dodge** | ⛔ **NOT R8's finding — added 2026-08-14 from the procgen determinism slice.** `arrowDanger`'s ARMED-LANE arm takes `horizon` and never reads it, so `forbiddenByDanger` returns true at every tick a search can ask about. TIME then spends up to its whole 40,000-expansion budget looking for a timing window the model has already declared cannot exist (**measured: 12,267 ms on one dash; 73,851 ms at a 200,000 cap**). See §"The TIME rung's applicability" below | **R9**, when the ladder is open |
| **NESTED OPENERS — a solver capability that landed OUTSIDE a rung** | ⛔ **NOT R8's; added 2026-08-17 by PROCGEN ELEMENTS arc 3 slice S1**, under the user's own authorisation. `solverBot` gained three things a rung would normally own: a stance derivation may return a **PREREQUISITE** and `walkTo` raises it as an order (`stancePrerequisite`, `NESTED_OPENER_DEPTH = 2` — the two-deep opener chain ⚖ ruling 22's gadget needs); **guard (iii)** on `stanceHypothesis`, which refuses to hypothesise an activator nothing can discharge DURABLY (an opener whose only order is a non-latching `hold` shuts the moment the walker leaves — 797 driven ticks → 0); and a **dwell-only `weigh`** for a gadget that arrives already solved. ⛓ **No tape was recorded for any of it and none moved**: the `--win --only=<the 20>` sweep is 534/0/67 ALL CHECKS PASSED, because the capability fires only where a stance was UNREACHABLE and a prerequisite exists — which no passing tape ever needed. Gated by vitest and by `procgenSeedlingElementsCertify.test.js`. R9 INHERITS IT, and with it two named residues: the trace MERGE eats a stance walk's corridor entirely (changing it re-records committed traces), and the opener-chain counter is per GOAL, so a room with two independent two-deep chains refuses at the second. As-built: arc-3 kickoff §11 | **R9 inherits (built outside a rung)** |
| **the ladder has no rung for a SWITCH-ARMED trap** | ⚖ **User, 2026-08-14: *"we shouldn't be searching for a path through arrows. Arrows move too fast to dodge. The only way through is to deactivate the switch that activates the arrows, either by stepping off the switch or moving the block off the switch."*** `AVOID → TIME → BAIT → KILL` has no member for it: BAIT lures a LIVE BODY (the measured room's live roster was `[empty]`), KILL kills one. A trap armed by a switch is neither | **R9**, a new rung |
| **`TIME_RUNG.reach` and `TIME_RUNG.maxExpansions` disagree, measured** | `reach: 48` is taken from `MOVER_RANGE`'s last row and the rung's refusal text cites it — but that table is ASSERTED at `maxExpansions: 60000` and production grants **40,000**. 48 px at dwell 4 costs **42,253** expansions on open ground. ⇒ **production cannot reach its own declared reach** | **R9**, with the ladder |
| **`crusherDanger` may freeze the crusher** — UNVERIFIED | it takes no `horizon` and reads `run.crushers` LIVE positions, while the search asks about future ticks without advancing the run. If that reading is right, TIME cannot time a crusher either, and may plan through a cell the crusher moves into. ⚠ **Flagged as a question, not a finding** — nobody has checked whether something downstream compensates | **R9**, check before trusting TIME |
| **`buildTape`'s v5 cap** | untouched — every v6–v10 tape is still assembled by a plan script | **R9+** |
| **rules v1 + the sphere order** | untouched; the sphere order is what a campaign slice would walk | **R9's campaign** |
| **LightBoss / TentacleBeast / LavaBoss** | still measured OUT | deferred |

### The TIME rung's applicability — notes for R9, not acted on

⚠ **Added 2026-08-14 from the procgen determinism slice; nothing here was
changed in the code.** It surfaced while measuring `TIME_RUNG.maxExpansions`
for a possible tuning, and it says the tuning is the wrong question.

**1. The model already knows arrows are not dodgeable, and the rung does not
ask.** `dangerMap.arrowDanger(run, box, horizon)` takes a horizon and its
armed-trap arm never reads it — by design, and its docblock says so: *"an ARMED
trap is a column that may fire at any moment, so its lane is dangerous for ANY
horizon at all — including zero."* TIME's `forbiddenAt` is exactly
`dangerAt(run, tick, box).danger`, so an armed lane is forbidden at **every tick
the search can ask about**. There is no window to find.

⚖ **The user confirmed this is the game's own truth (2026-08-14): arrows move
too fast to dodge; the only way through is to deactivate the switch — step off
it, or push the block off it.**

**2. Sorting the arms by whether they take a horizon gives an exact, cheap
predicate**, readable from the signatures with no new modelling:

| arm | horizon | timing-dodgeable |
|---|---|---|
| live arrows (swept), chasers, spinners (`spinnerForecast`) | used | ✅ yes |
| **armed arrow lanes** | **ignored** | ⛔ never |
| `hazardDanger`, `staticEnemyDanger` | no parameter | ⛔ never |
| `crusherDanger` | no parameter, live positions | ⛔ **unverified — see the table row** |

⇒ if every source blocking a corridor is time-invariant, **no timing solution
can exist** and the rung is searching for something ruled out in advance.

⛔ **BUT DO NOT SIMPLY SKIP TIME ON THAT PREDICATE WITHOUT DECIDING THIS
FIRST.** TIME is not only a timing tool: it searches at 0.25 px where AVOID
works in whole tiles, and the measured AVOID refusal in that room was a
GOAL-TILE technicality (*"the planner works in whole tiles, so both ends of a
route must be tiles the player box fits"*), not a blocked corridor. So against
time-invariant danger TIME degenerates from *"wait for the window"* to
*"squeeze through sub-tile"* — which may occasionally be worth something. What
is certain is that it should not cost 40,000 expansions to attempt.

**3. What was measured, so R9 does not re-measure it.** Quiet box, 8 cores,
node 18:

- **The dash that motivated all of this is vacuous**, not merely expensive:
  seed 13, an `arrowLane` obstacle, **40,000 expansions / 12,267 ms**. Raising
  the cap to 200,000 as a probe: **still refused, 73,851 ms.** Confirming that
  a hopeless search bills you in proportion to the cap — **the cap only ever
  charges you on the negatives.**
- `MOVER_RANGE`'s five capability rows cost **1,250 / 338 / 37,614 / 56,579 /
  42,253** expansions (8, 16, 24, 35, 48 px). ⚠ Cost is **not monotone in
  distance** — dwell dominates, so 24 px at dwell 2 costs more than 48 px at
  dwell 4, and the 24 px row sits at **94 % of the production cap**: a latent
  tripwire that any heuristic or tie-break change would flip.
- ⚠ **The evidence base for the rung's real behaviour is two dashes.** Across
  326 procgen solves the search ran **twice** — one success at **646**
  expansions, one failure at the cap — and the failure is the vacuous class
  above. **Do not size any constant off this.** Real examples want the R8
  battery, where spinners live and spinners are what TIME exists for.

**4. Constant triage, since three values look like one and are not.**
`mover.DEFAULT_LIMITS.maxExpansions: 200000` is a **library fallback no
production caller reaches** (`solverBot.js:5125` is the only production caller
of `planDash` and always passes `limits`). `MOVER_RANGE`'s **60,000** is not a
bound at all — it is the **experimental condition** a capability measurement was
taken under. `TIME_RUNG.maxExpansions: 40000` is the only real production bound.

⇒ **`reach` and `maxExpansions` are two guards on the same doomed-search
problem** — the cheap a-priori one and the a-posteriori one — so they cannot be
tuned independently. Today they disagree, which is the worst case: the rung
admits a search its own budget then kills.

**5. The budget question R9 should actually ask.** A TIME failure is not fatal;
the ladder escalates. So the cap means *"how long may we look for a timing
solution before trying a different strategy?"* — a **budget allocation across
four rungs**, not a search parameter. Both errors are behavioural: too high and
the bot spends seconds proving TIME cannot dodge when BAIT would answer in
milliseconds; **too low and the bot kills a monster it could have walked past**,
which changes the character of the certified solution. ⛓ That matters beyond
the solver: this bot is the ORACLE for generated levels, so an under-budgeted
TIME certifies levels against a more violent player than necessary — the
Cloudberry lesson (*restricted player AI shapes level character*) arriving
through the back door.

---

## The editor arc — `watch.html` becomes the lab page (TOOLING; CLOSED 2026-08-12)

Interleaved between R8 and R9 by the user's ruling. It built no game
behaviour and no claim: it grew the replay viewer into the window an editor
will eventually live behind.

**Ten slices, in two rounds.** The **V1 SCOPE** (slices 1–4) closed
2026-08-11 with the page, its overlays, manual mode and the CLI export. ⚖ The
user then ruled more editor work BEFORE the campaign, and the **V2 ROUND**
(slices 5–10) closed 2026-08-12: the v9 fold and the despawn check, the
modeled-but-not-displayed audit and its layers, the route-only coverage
survey, the two engine fixes and the arrow-lanes layer, the world-state /
crusher / solver-danger layers, and finally the L6-return timeout diagnosis
with the `solid:chest` obstacle rule.

⚖ **What came next is the procgen PROOF-OF-CONCEPT arc** (user, 2026-08-12)
— the Cloudberry Kingdom algorithm's first draft, built in this page, limited
to pre-shield features across two biomes. **It CLOSED 2026-08-12; its section
is at the end of this page.** **R9, the campaign, follows it**;
its route is ruled to be the SPHERE ORDER's (the survey's own finding, below)
and its budget is the survey's mechanism-family table.

**The V2 round in one line each** (each slice's detail is a section below):

| slice | what it did |
|---|---|
| **5** | the fold derives its own version (six boots that had refused for a whole arc now fold to v9); the despawn DROP becomes a drop **and a check**; the default boot becomes the TRUE GAME START; a sword/shield boot form — **and the SOLVE button that had never read its own textarea** |
| **6** | the **modeled-but-not-displayed AUDIT** (145 public getters against what the renderer draws, swept over all 153 tapes) and the three shape layers it justified — enemy hitboxes, the hammer LINE at its exact angle, the attack rect. ⛔ Its finding: a hammer contact lives in TWO SAMPLES, body at `t` and clock+box at `t-1` |
| **7** | the **ROUTE-ONLY coverage survey** — the walk from the true start to the shield derived from AP's own rules, then solved step by step. 21/29. REPORT ONLY, zero engine or page files touched |
| **8** | the two engine defects the audit had left reported — the **owl-pod gate** and the **`arrowLane` retype** (eleven spellings, two adapters, equivalence per site before converging) — plus the arrow-lanes layer and the hitboxes `why` |
| **9** | the **world-state**, **crusher** and **solver-danger** layers (roster 12 → 15). ⛔ Its headline is a MISS: two sibling browser rows had been RED for a whole slice behind an exit-0 skip |
| **10** | the **L6-return timeout diagnosed** (one search, not a loop) and **chests become clearable obstacles** — the V2 close |

### What the page is now

`frontend/modules/seedlingDemo/watch.html`, served from the repo root, with
FOUR SOURCES converging on one replay spine (the fourth arrived with the
procgen PoC arc — see that arc's section below):

- **REPLAY** — a committed tape (`?tape=`), as before.
- **SOLVE** — a level, a tape v8 staging block and goals in the solver's own
  vocabulary → `solveSegment` runs IN THE PAGE → the result is scrubbed by
  the same stepper the verifier uses. Solve-then-scrub, ⚖ ruled.
- **MANUAL** — the same starting conditions, driven by keyboard on the
  page's own pacer; STOP folds the session with the ONE fold
  (`buildStagedTape`) and CHECKS that the fold replays frame-for-frame
  before showing it. A hand drive is a PRODUCER, beside `solveSegment` and
  the drivers — not a second replay loop.
- **GENERATE** (`?source=generate&seed=N&biome=`) — the Cloudberry loop runs
  IN THE PAGE: empty bordered room → add one template → re-solve → keep it
  if the room still completes. STEP places one; RUN-ALL runs to target or
  saturation. A generated level is a PRODUCER too, and its walk goes through
  the same stepper everything else does.

Over all three: **fifteen independently toggleable overlay layers**, every
position SAMPLED per tick through `createTapeStepper`'s `onTick` hook and
never re-simulated. Four are CUMULATIVE paths (player · enemies · pushables ·
arrows, OFF by default ⚖), four are event MARKERS (action =
attack-key edges · damage · events · volumes), and SEVEN are THIS-TICK
SHAPES: **enemy body hitboxes** (`spinnerRect` / `chaserBoxAt`), the
**spinner hammer LINE** at its exact current angle (`hammerLine` fed by the
run's modelled `Game.time`, drawn white-hot when the engine's own
`hammerHitsPlayer` says it reaches the player), the **attack rect** on the
tick it fired (`run.presses[].rect`), the **armed arrow traps' LANES**
(slice 8), and slice 9's three: the **WORLD STATE** — what the run has
CHANGED over the build-time base — the **CRUSHER** bodies and their trigger
lanes, and the **DANGER the SOLVER was told** (⚖ default OFF).

⛔ **A LANE IS NOT AN ARROW PATH, and the two layers are deliberately kept
apart.** `arrows` is the sampled FLIGHTS: cumulative, one dot per arrow per
tick, the only layer OFF by default. `lanes` is the trap's own GEOMETRY — the
column its volleys sweep, drawn while the trap is ARMED, a few outlines on the
tick you are looking at. A room can show lanes and no arrows (armed, not yet
fired) or arrows and no lanes (the volley still in flight after the presser
was released), and reading either as the other misreads the room. ⛔ Every one of
those geometries is the ENGINE'S OWN exported function — a viewer that
retyped `(Game.time % 45) / 45 · 2π` would be a second cost model of a
rotating line. ⚠ A shape layer is the cursor's tick only: the union of a
hammer over ticks is the 13 px disc ⚖ ruled the wrong picture at R8, and a
box per body per tick fills the room. Also a generated
legend; a **decision-trace pane** (an in-page solve's own rows, or the
committed tape's `fixtures/traces/<name>.trace.json` sidecar through the
producer's validator) with highlight-by-cursor and click-to-seek; and
**tape I/O** — the current tape in a textarea, with Download, paste-Load and
Upload, all through `parseTape`.

Everything is reachable from URL parameters: `?tape= ?side= ?speed=
?source= ?level= ?boot= ?goals= ?solve= ?name= ?layers= ?tick= ?shot=`,
plus the GENERATE arm's own `?seed= ?biome= ?count= ?tries= ?k= ?anchortries=
?tickbudget= ?run= ?gen= ?families= ?templates=`.

⚠ Two corrections to that list, both recorded where they happened rather than
silently applied: `?budgetms=` is **GONE** (2026-08-14 — no budget in this
pipeline is denominated in milliseconds any more; a stale bookmark warns in the
console and is ignored), and `?anchortries=` arrived with the anchor search.
⛓ `?families=` and `?templates=` are **verb 1 (RESTRICT)**: either one names
the sub-roster a run may draw from, ABSENT means the whole roster, and having
BOTH refuses by name — they are two spellings of one setting and do not
compose. The page's catalogue (the biome's templates grouped by family, with
the biome's EXCLUSIONS greyed beside them carrying their measured causes) is
where those ticks live.

⛓⛓ **A LAYER THAT CAN DRAW NOTHING CARRIES A `why`** — six of the fifteen do
(`hitboxes`, `hammer`, `lanes`, `worldstate`, `crushers`, `danger`), and slice
9 landed its three in the pair shape FROM THE OUTSET. The rule is worth stating
once: *an empty layer means two things, so the page says which, in the
ENGINE's own words, with the population count beside it.* A `hitboxes` layer
drawing nothing is a room with no enemies, a COMBAT-BLIND run, a roster
`chaserRoomVerdict` REFUSED (its refusal text carried through verbatim), or a
room whose bodies are all dead by this tick — four different facts that drew
one identical picture until slice 8. `__editorOverlays.census` carries the
count the sentence rests on, so no reader has to take it on trust.

### The two engine defects the arc found and fixed (slice 8)

Both were MEASURED by slice 6's modeled-but-not-displayed audit, left
REPORTED, and closed in one slice — each predicted BYTE-INERT before the run
and proven so by the full offline differential plus a byte-unchanged
`solve-seedling-r8-battery --check`.

- **`run.owlPods` reported four pods in every room of every tape.**
  `owlStateFor` level-filtered the boss list and not the pod list, so it
  mapped `FinalBoss.podPositions` unconditionally — **153 tapes out of 153**,
  the highest hit-rate in the audit's sweep. The gate matches the GAME: the
  `.oel` places a `Pod`, so a room with neither a `finalboss` nor a placed pod
  has none. It had never bitten because every reader stands inside the Owl's
  own room; the cost was owed to the next one, and a pod overlay would have
  painted his arena furniture into every room in the game at plausible
  coordinates.
- **The `arrowLane` placement→lane adapter had no owner**, so every caller
  retyped it inline. The audit counted five sites; there were **six** — one in
  `solverBot`'s L5 drain-phase bound that nobody had counted, missed because
  it is line-wrapped — plus a **second, five-copy lane→rect derivation** the
  audit had not separated from the first. All eleven spellings now converge on
  `arrowTrap.arrowLaneForPlacement` and `arrowTrap.arrowLaneRect`, which is
  what let the arrow-lanes layer exist at all: with only half the hoist, the
  page would have written the seventh spelling itself.
  ⛓ **The equivalence was asserted PER SITE, BEFORE the convergence** — the
  eleven normalise to one spelling and 55 behavioural comparisons found zero
  mismatches — because a refactor that makes two things AGREE is a behaviour
  change wearing a refactor's name (slice 1's two run constructions disagreed
  about `despawn`, and the naive unification would have changed a solve).
  ⛔ The level HEIGHT stayed a parameter: the five rect sites agreed on the
  arithmetic but NOT on where the height came from, so hoisting the lookup
  too would have unified two expressions nobody could prove equal.

### Slice 9 — the drawn world stops lying, and the bot's own danger

Slice 6's audit priced what the separately-built, never-advanced world COSTS:
a rock broken at tick 50 is still drawn as a wall at tick 300, a chest opened
is still drawn shut. Measured across all 153 committed tapes —
`openActivators` 23 · `openChests` 7 · `turrets` 8 · `brokenRocks` 2 ·
`burnedTrees` 2 · `pulledRopes` 2. The **`worldstate`** layer marks it.

⛔ **IT MARKS, IT DOES NOT REPAINT** (⚖ the charter's own condition). A layer
that erased the stale wall would leave exactly the picture a fresh build
gives, and a reader could no longer tell a CORRECTED picture from one that
never needed correcting. So the base box stays and the mark says what is no
longer true about it, in three verbs the GAME distinguishes: **GONE** (a
broken rock, a burnt tree, an opened chest, a held-open lock leave the solid
list entirely), **SWAPPED** (a pulled rope is `setHitbox(16, 16, 8, 8)` — 112 px
of wall becomes 16 px of wall, and marking it gone would open a tile the game
KEEPS), and **NOT SOLID** — the ice turret's inverted polarity, where the
32x32 body the level builds is an `Enemy` and not a wall at all until it dies
and the player steps off the corpse. That last mark is true from tick 0,
before the run has changed anything: the base picture is simply wrong there.

⛓ **The `crushers` layer is the R5-slice-16 forward's FIRST READER.**
`frames[].crushers` and `frames[].crusherScans` have ridden on every frame
since R5 and were drawn by nobody — trap 119's family in the hot loop. The
body is where the RUN left it (a crusher charges at a player it can SEE, so
the constructor cell is wrong from the first tick a bait commits), the four
trigger lanes are `crusher.detectionRects`' own — **not**
`dangerMap.crusherVolumesAt`, because `crusherScans[].matched` is a list of
`dir` names and only `detectionRects` produces rects those names key into —
and a SHIELDED crusher says so by name rather than reporting "sees nothing":
`scanCrusher` returns before it walks a single lane when the sight line is
blocked, which has nothing to do with where the player is standing.

⚖ **The `danger` layer draws what the SOLVER RECORDED, and nothing else.**
Slice 6 refused danger-map verdicts as an eleventh peer of the layers that
show what happened, on the standing law that *a viewer is a window, not a
third opinion*; ⚖ item 9 supersedes that refusal for exactly one shape, under
four conditions that ARE the ruling: the data is the reason lists
`solveSegment` was HANDED (recorded additively at the two sites that had
already asked the union — no new `dangerAt` call exists), the layer is
labelled the bot's HEURISTIC in its own ink, it defaults **OFF**, and on a
REPLAY or MANUAL source it reports *"no solver ran — no danger data"* BY NAME
rather than recomputing. A page-side re-ask would be the refused thing wearing
the new layer's name.

⛔⛓ **AND THE PURPLE IS A REFUSAL'S COLOUR.** Measured over 30 solves of 9
committed staging blocks: **every** danger query a SUCCESSFUL segment records
comes back CLEAR, with an empty reason list. That is a theorem, not an
accident — `refuseDanger` THROWS when the union answers danger, so a segment
that reaches its goal cannot have had a dangerous gate. The non-empty case
lives only on refusals, which is where the next slice should look for it.

⛔ **The page never writes `fixtures/tapes/` or `fixtures/traces/`.** That
roster is disk-derived, so a saved experiment would silently join the
differential. Solved and hand-driven tapes live in the box, in a download,
and in your hands.

### The CLI export — the same page, headless

    node scripts/procgen/export-seedling-view.mjs --out=view.png \
        --tape=<repo-relative json> --tick=last --layers=player,enemies,arrows
    node scripts/procgen/export-seedling-view.mjs --out=solve.png --trace \
        --boot=<repo-relative json> --level=4 --goals=exit:64,16 --solve=1
    node scripts/procgen/export-seedling-view.mjs --out=gen.png --trace \
        --generated=<a generate-seedling-level payload> --tick=last

Built FOR AGENT USE (⚖ user): an agent can Read a PNG. It starts its own
static server on a free port, loads the page with the caller's parameters
plus `?shot=1`, waits on `body[data-shot-ready="1"]`, and screenshots the
canvas (`--trace` widens it to the toggles, legend, HUD and trace pane).

⛔ **ONE RENDERER**: the CLI adds a server and a PNG. It draws nothing, and
every view selection is the page's existing URL vocabulary.
⛔ **A NAMED REFUSAL EXITS NON-ZERO AND WRITES NOTHING** — a lethal terrain,
water under an unpinned `sound`, a fold-time refusal — with the page's own
message on stderr. Exit codes: 0 written · 1 usage · 2 the page refused ·
3 never reached readiness · 4 written, but the page logged errors. A blank
or partial frame with exit 0 is the defect that rule exists for.

⚖ **Exit 4 keeps its file** (ruled 2026-08-12): a real frame plus a non-zero
exit is the honest pair when the page logged errors — the picture is
evidence, and the code is what stops a caller reading a throwing page as a
clean one. 2 and 3 write nothing because what they would write is a refused
or unfinished view.

### The three laws the page still runs under

They are in `watchViewer.js`'s docblock, verbatim, and every slice was
checked against them:

1. **TOOLING ONLY** — the page makes no claims, gates nothing, and nothing
   that DOES make a claim may depend on it.
2. **RAW TRUTH** — no interpolation, no smoothing, no elided dead frames; a
   refusal is surfaced with the run's own message and its tick, and a ledger
   row that cannot be placed is REPORTED rather than dropped or invented.
3. **NO PRIVATE TICK LOOP** — one loop (`createTapeStepper` / `run.advance`),
   one fold (`buildStagedTape`), one run construction (`createRunForStaging`,
   the runner's own), one renderer.

### The v2 round (⚖ user, 2026-08-12) — what slice 5 changed

Three of the v1 bounds below were LIFTED by the user's promotion, and the
section marks each in place rather than rewriting history.

- **The fold derives its own version.** `buildStagedTape` carries a staging
  block's `persistence[].at` rows and stamps `requiredTapeVersion` (floor 8),
  so the six boots that refused for a whole arc now fold to v9 and replay.
  The v10 `despawn` guard STAYS, with a new reason: a fold has no witness to
  offer, and every row it emits is a fact about the run it just folded.
  ⛔ What replaces the old refusal is the **bound**: `at` must lie in
  `[0, tick_count]` and a fold's tick_count is the RUN'S, so a block whose
  clear is declared past the walk's own end is refused by name at assembly.
- **The despawn drop is now a drop AND a check.** `solveStaging` still never
  hands a declared despawn to the run — the witness belongs to the hand walk
  — but since R8 slice 1 the model computes chaser terrain deaths itself, so
  `tapeRunner.checkSolveDespawns(declaredBlock, drivenRun)` asserts the drop
  was safe: an UNBRIDGED family (or a room `chaserRoomVerdict` refuses to
  step) is the R7-era blindness intact and REFUSES BY NAME; a bridged one is
  checked by id, and by tick against the witness band.
  ⛔⛔ **`at` IS THE PHASES BLOCK'S END TICK, NOT THE REMOVAL'S** — the format
  says so and `witnessedDespawnFindings` enforces the arithmetic. So the
  comparison is `computed <= declared`, and that is a definition rather than
  a tolerance. ⚖ **RULED 2026-08-12: the band STANDS and no removal-tick
  field is added** — `at` is the witnessing arm's ASK tick and the removal
  tick was never recorded by anyone, so a field whose only consumer would be
  upgrading one check from `<=` to `==` is a ledger with no caller. If the
  removal tick is ever recorded it arrives as EVIDENCE on the despawn
  PROVENANCE side, not as a change to what committed v10 tapes claim. Measured on the driven case: `r7-act2-6` declares
  `bob@112,48` by tick **120** and the model removes it at **55**, by water,
  on the hand walk AND on a fresh solve. The game's own `--mobiles` reading
  of that walk is t~62, which the ten-tick `Mobile.death` fade brackets
  exactly. ⚠ A walk that never causes the removal REPORTS it and does not
  refuse — that is what the drop exists for.
- **The default boot is the TRUE GAME START.** With no `?boot=`, the page
  fetches `act2-the-sword`'s own segment-1 tape and takes its boot block
  through the same `stagingFromJson` a pasted block takes. The literal it
  replaced (`{level: 0, x: 16, y: 16}`, no pins, no rng) was honest and was
  still a state the game never has.
- **Boot form v1**: sword and shield checkboxes above the raw editor, two-way
  bound to the SAME parsed block — ticking edits the block and re-serialises,
  typing re-derives the boxes, and a block that will not parse DISABLES them
  with the parser's message. ⚠ The flags live at `seam.items.hasSword`, not
  in the v6 `save` block; `save.hasSword` is the GAME's property path
  (`SEAM_BOOT_SPEC[].field`), which is the other of the two key spaces.
- ⛔ **And the defect the form found: the SOLVE button never read its own
  textarea.** `runSolve` printed a block into the "starting conditions"
  editor and solved its closure copy, so every edit made there since slice 1
  was silently discarded. It re-reads at press time now, and the census the
  default goals come from is rebuilt from that same block.

Slice 5's browser row is `scripts/procgen/check-seedling-editor-boot.mjs`.

### ⛔ NAMED LIMITS (v1 bounds, each with a written cause)

- ~~**Six committed boots refuse at fold time.**~~ ⚖ **LIFTED by slice 5**
  (see the v2 round above). `buildStagedTape` used to write a fixed
  `tape_version: 8` header and refuse a staging block carrying a v9
  `persistence[].at` (`r7-act2-5/8/full`, `r8-solve-5/8/18`) or a v10
  `despawn` (`r7-act2-6`). The six v9 boots fold; the v10 guard remains, for
  a different reason, and no committed boot reaches it (the solve side empties
  the list before the assembly sees it).
- **No live "watch the bot think" mode.** Deferred on a measurement and then
  dropped on it: an in-page solve of the acceptance segment takes **135–154
  ms** (node, same code, same machine: 283 ms — chromium is faster). A live
  decision stream would be showing a search that has already finished. Bound
  named: one room, one goal, three decision rows; a 10× segment is ~1.5 s.
- **Starting conditions are JSON-FIRST** — a raw v8 staging block with presets
  harvested from the committed tapes' own boots. ⚖ Slice 5 added the optional
  polish for TWO fields (sword, shield); everything else is still the editor,
  which is what ⚖ §1.7 meant by JSON-first.
- **Not a GL panel.** No `__BUNDLED_MODULES__` entry, no substrate
  registration; it is a standalone static page. Panel integration is a later
  decision with its own checklist.

Each of these is a v1 bound, not a verdict: the editor work ⚖ ruled for after
this arc is where any of them may be taken up.
- **The browser rows other than the CLI still SKIP without a dev server**
  (`check-seedling-editor-{solve,overlays,manual}.mjs`). That politeness once
  hid a page that could not load AT ALL for two rungs, so
  `probe-seedling-watch-page.mjs` now takes `--strict` (fail, named, instead
  of exit-0 skip) and the CLI — which brings its own server — is the arc's
  non-skipping browser gate.

### The ROUTE-ONLY solver coverage survey (editor arc slice 7)

`scripts/procgen/survey-seedling-route.mjs` — the v2 round's last slice, and
the first thing on this arc that USES the editor rather than growing it.
⛔ **REPORT ONLY**: it records nothing, writes nothing under `fixtures/`, and
moved no committed artifact.

It derives the walk from the TRUE GAME START to COLLECTING THE SHIELD, then
solves every step of it. The route is derived, never read off the chains,
from three sources intersected: **AP's own 251-region access graph** (the
authority on which door is open when), the **committed atlas's level edges**
(each carrying the exit's OEL coordinates and the arrival's
`playerx`/`playery`), and the **sphere order** (which fixes the three route
pickups). Three BFS legs, each run with exactly the items the earlier legs
earned:

    0.1 sword@L10       L0→L2→L3→L4→L5→L6→L7→L8→L9→L10    every room FORCED
    1.2 boss key 0@L19  L10→L11→L3→L2→L0→L13→L14→L15→L16→L18→L19
    2.1 shield@L20      L19→L20                           every room FORCED

⛓ **Leg 1 reproduces the R7 honest chain's crossings exactly** — two
derivations, one answer. Leg 2 admits ONE alternative (16 rooms vs 11,
avoiding L11). ⛔ **The D2 entry, asked of the rules rather than inferred:**
L13 *does* have a direct `stairsdown@96,32` to L20, and AP's rule for the
door out of the chamber it lands in requires **Progressive Shield** — the
shield is behind itself from that side. L14/L15/L16→L18→L19 is forced, which
is ⚖ §16.3 ruling 1's route re-derived from another source.

**21 of 29 steps solved when the survey was written** — **22 after slice 10's
chest row**. D2's last three rooms re-solve tick for tick (L18 573, L19 864);
what stands between the solver and the shield is the walk BACK from the sword
to D2's door. The refusal→mechanism-family table is the campaign's budget
input, and the two findings worth carrying off the arc are:

- ⛔ **The route-only bound is itself a refusal cause.** L11's only corridor
  is one tile wide and `chest@32,48` stands in it. Route-only REFUSES;
  adding the campaign's own next pickup (`Level 011 - Chest`, AP sphere 0.2)
  SOLVES it in 119 ticks. ⇒ R9's route must be the SPHERE ORDER's, not the
  crossing graph's. ⚖ **Slice 10 closed the OTHER half of this**: the chest
  is now a clearable obstacle too, so the room solves in the same 119 ticks
  from the crossing goal alone — but the ROUTE ruling stands on its own
  reasoning, which is about what a campaign is FOR, not about what the solver
  can get past.
- ⛔ **`solveStaging` drops `despawn` and carries `persistence[].at`**, and
  those are the same sentence about a flag instead of a body. Measured on L8:
  inherited, the solve plans around the HAND walk's clear ticks and says
  nothing; stripped, it refuses by name for a GAME-sourced tick. R8's own
  scripts strip it BY HAND, in prose, outside the seam. Invisible wherever
  the model can compute the clear itself (L5: 558 ticks either way).
  ⚠ Reported, not fixed — ⚖ §14.5 measured that removing the rows is not
  inert.

⚠ **An empty overlay layer means two different things.** The `hammer` layer
carries a `why` (⚖ the clock caution); `hitboxes` does not, and L16 draws
**zero** bodies while its census holds **nine** — the room's chaser roster is
refused. L14 next door draws 6 of 6. ⚖ **RULED to slice 8** (2026-08-12),
beside that slice's arrow-lanes layer work: it is the named-absence law
unenforced on one layer.

~~⚖ **And the `solid:chest` row is DEFERRED TO R9**~~, on the survey's own
reasoning: under the sphere-order route that chest is a GOAL before it is
ever an obstacle, and a strategy-table row changes solver behaviour — so the
edit belongs where its consequences are watched, not in a slice whose battery
must stay byte-unchanged.
⚖ **SUPERSEDED by the user, 2026-08-12** (kickoff §12d item 11): the row
lands in **slice 10** instead, under R9-grade care rather than R9's calendar
— a prediction stated first, `solve-seedling-r8-battery --check` byte-compared,
the full offline differential, and a whole-file survey re-run showing exactly
the predicted flip. The deferral's premise turned out to be answerable rather
than merely arguable: the battery proved the change moves nothing, and the
survey proved it moves the one row it was for. See slice 10 below.

### Slice 10 — the timeout diagnosed, and the chest stops being a wall

**⛔ The L6-return TIMEOUT is ONE SEARCH, not a loop.** The survey's single
timing-out step (A14: the return crossing of L6, where the same room solves
OUTBOUND in 294 ticks) was hypothesised to be a re-plan/escalation loop. It is
not. Measured with a Proxy over the run — the only window a SYNCHRONOUS
runaway has, since no timer fires and no signal is handled inside one
`solveSegment` call — **100% of thousands of stack samples sit in a single
`climbLadder → planDash → findEarliestArrival → forbiddenByDanger → dangerAt`
chain**, with `advance()` frozen at 192 ticks, ONE pass, ONE climb, ONE
`planDash` call, for over a billion property reads.

The cause, named: the ladder's **TIME** rung finds the aim inside its 48 px
reach and runs a `planDash`; the search is correctly bounded at
`TIME_RUNG.maxExpansions = 40000`, and in THIS room each expansion asks the
hazard union up to **64 times** (16 key sets × dwell 4), so the budget is
~2.5 million `dangerAt` calls over two static sandtraps, the armed arrow lanes
and the water. **The bound is expressed in EXPANSIONS and the survey's is in
SECONDS**, and here they disagree by orders of magnitude.

⛓ **And the outbound/return asymmetry is in the committed trace.**
`r8-solve-6`'s own TIME-rung refusal reads *"the aim is 193 px away and
`mover.MOVER_RANGE` measures this search reaching 48 px as an UPPER BOUND"* —
outbound the rung refuses by ARITHMETIC and never searches at all. The whole
difference between half a second and no answer is which side of a 48 px
comparison the aim falls on at one instant.

⚖ **The fix is NOT taken, and the reason is a measurement.** Across every
committed trace the TIME rung appears **3 times and all 3 refuse by that
arithmetic — no committed derivation has ever executed a `planDash` search**,
so `TIME_RUNG.maxExpansions` is a free parameter over the whole roster and a
change to it would be byte-inert BY CONSTRUCTION. It is still not taken
because **nothing in the record says what the cap should be**: `MOVER_RANGE`
records the smallest DWELL per distance, not the expansions it used, and no
committed dash has ever succeeded. Picking a number here would be the generous
bound this codebase refuses everywhere else. The TIMEOUT verdict stands with
the cause beside it, and the change is a priced line item for later.

**⚖ Chests are clearable obstacles** (user, superseding the R9 deferral above).
`OBSTACLE_STRATEGIES` gains `solid:chest` → the **already-registered** chest
verb: a chest already had a row as a `proximity-hazard`, which is the shape it
wears when a GOAL names its placement; standing in a corridor it wears the
other one, because `Chest` is a `Solid` only until `open()` flips its type.
⛔ **The binding proof is a differential, not "it solves now":** L11 solved
from one `reach-exit` goal and L11 solved from `collect-placement` then
`reach-exit` produce **the same walk, key set for key set** — 119 ticks, the
same `openedAt 6` / `collectedAt 16` verb record, the same `chestOpens` and
`sealCollections`. The row does not invent a second way to open a chest; it
reaches the one that was already there, and the only difference is the
DECISION each trace records.

**⛓⛓ The danger record now rides on the refusal.** `SolverRefusal` carries
`dangerQueries`, and the page's refusal branch reports **three different
answers** — `n` (the bot was told things), `0` (the recorder ran and it asked
nothing), `null` (no record at all: the throw was not a `SolverRefusal`).
⛔ That sharpens slice 9's finding rather than confirming it: swept over all
39 route-step solves — 23 solved, 6 refused, 4 engine-side — **not one
recorded query came back dangerous, on either outcome**. Every route refusal
is *no corridor* or *ladder exhausted*; none is a danger-gate throw. So the
non-empty case lives only on a refusal raised BY the danger gate, and no room
on the route raises one. The dangerous row's shape is pinned synthetically and
said to be.

### ⛔ WHAT THE V2 ROUND LEAVES OWED (each a bound with a written cause)

The v1 bounds above still stand where they were not lifted. These are the
v2 round's own, and every one of them is a NAMED absence rather than an
oversight:

- **`levelWorld.liveRectOf` is not exported**, and it is the game's authority
  on *"is this solid still there, and where"* over THIRTEEN families. It is a
  closure inside `buildLevelWorld`. The world-state layer therefore carries a
  five-row JOIN table page-side — which run set names which solid key — and
  PROVES it with an engine differential rather than trusting it: every GONE
  mark is put back to `world.collidesSolid` with the run's own
  `liveGeometryOpts()`. ⚠ That differential's bound is stated because it is
  not uniform: `collidesSolid` is FIRST-HIT, so for a rope inside a wall tile
  the assertion is only *the engine does not report THIS ENTITY at its build
  box*. **The hoist is OWED** — it is `arrowTrap.arrowLaneForPlacement`'s
  shape one family-table over, and slice 8 measured what that kind of hoist
  is worth.
- **`solveStaging` drops `despawn` and CARRIES `persistence[].at`** — the same
  sentence about a flag instead of a body (slice 7's finding, above). Reported,
  not fixed: ⚖ removing the rows was measured NOT inert. It belongs to the
  PROVENANCE discussion, with the witness-band ruling beside it.
- **The v10 `despawn` fold guard stays**, with its own standing reason: a fold
  has no witness to offer, and a solver tape owes declarations only for
  mechanisms the model cannot compute. No committed boot reaches it.
- **NEEDS-GAME-ORACLE rooms are not a solver gap.** L8's two sandtraps have
  arrow deaths the model refuses to compute by name; only the `--win`
  truncation channel — a RECORDING channel — answers, exactly as it did for
  `r8-solve-8`.
- **The bait-stance lattice's danger queries are unrecorded**, deliberately:
  `deriveBaitStance` asks the union over a 17×17 lattice of HYPOTHETICAL
  stances, which is a SEARCH rather than positions the walk held. Recording
  them would bury the handful the walk acted on under hundreds it discarded.
- **The sibling browser rows still SKIP without a dev server.** ⛔ That
  politeness is now a MEASURED cost, not a theoretical one: two of them
  (`-manual`, `-export`) were RED for a whole slice and nobody saw it,
  because slice 8's "replace, don't relax" sweep was keyed on the toggle
  COUNT and those two spell the roster as a bare `11` and as a list of ten
  layer NAMES. ⇒ *a sweep like that must be keyed on the ROSTER, not on the
  number*; both rows are now built FROM `watchOverlays`' own roster. The rule
  that follows is short: **before believing any skip-capable row is green,
  RUN IT.**

### Where the arc's own findings live

The full record is the arc kickoff `NewDocs/plans/seedling-editor-opus-kickoff.md`
(⚠ `NewDocs/` is deliberately gitignored — working machine only): §8 SOURCE=
SOLVE and the four transitive `node:fs` imports that had made the page
unloadable in a browser since R7 slice 1; §9 the overlays, and the engine
change that turned out not to be needed; §10 manual mode, the tape I/O, and
the `earnedClears` tick added at each feeder's write funnel so the overlay
could place clear markers at all; §11 the CLI export and the v1 close; §12
the user's V2 SCOPE and §13 slice 5 (the v9 fold, the despawn drop→check,
the true-start default boot, the boot form — and the SOLVE button that had
never read its own textarea); §14 slice 6 (the modeled-but-not-displayed
audit, the three shape layers, and the hammer contact that lives in TWO
samples); §15 slice 7 (the route survey above, its 29-row table, its seven
refusals verbatim and the twenty PNGs each one was read from); §16 slice 8
(the two engine fixes above, the retype nobody had counted, the arrow-lanes
layer and the hitboxes `why` channel — and the `get drawn()` accessor whose
SHAPE fell behind its producer's, which every module test passed over because
no node test reaches a DOM-side copier); §17 slice 9 (the world-state, crusher
and solver-danger layers, the `liveRectOf` join proven by an engine
differential, and the two sibling browser rows that had been RED for a whole
slice behind an exit-0 skip); §18 slice 10 (the timeout's named cause with its
stack rows, the chest differential, and the V2 close).

## The procgen PoC arc — the Cloudberry loop, in the editor (CLOSED 2026-08-12)

> ⚠ **HISTORICAL (2026-08-18)** — this § describes the generator as it stood at the PoC arc's close. Its PALETTE
> is no longer the shipped one (the `arrow-lane` family was retired by ⚖ design ruling 9 in arc 3 slice 1, and all
> three door TEMPLATES — `wall-gap-block`, `wall-gap-lock-weigh`, `wall-gap-spinner-killlock` — retired in arc 3
> slice 4c into pass-1 ELEMENTS), and pass 1 no longer exists only as "the room". The current shape is
> § *The procgen ELEMENTS design* below. ⛔ Kept unrewritten: its measurements are the record of what was true.

⚖ Ruled by the user after the editor arc and BEFORE R9: a **proof of concept
of the Cloudberry Kingdom algorithm** (source: the interview in
`NewDocs/plans/procedural-platformer/`), built in `watch.html`, limited to the
features from before collecting the shield, across **two biomes** (pre-sword
and post-sword). Not the full generator — a first draft, honestly bounded.

**The loop, and it is Cloudberry INVERTED.** Cloudberry's design AI CONSTRUCTS
the path (blocks ARE the level, so DFS is essential). A Seedling room is the
opposite topology: the empty bordered room is trivially solvable and obstacles
CONSTRAIN an existing floor. So:

1. Empty bordered single-screen room + start + goal pickup. **Solve once — it
   must pass.** That is the loop's control, and its failure is a throw rather
   than a verdict, because every later refusal is attributable to a placed
   template precisely because this one passed.
2. Draw a candidate TEMPLATE from the biome's palette (seeded PRNG).
3. Place it **atomically with its clearer** (⚖ the templates ruling: a button
   comes WITH its lock, a spinner WITH its kill-lock) and **re-solve from
   scratch from the biome's boot**.
4. SOLVED → keep. REFUSED / TIMEOUT / BUDGET-EXHAUSTED → revert, and record the
   verdict CLASS with the refusal's VERBATIM text.
5. Stop at the obstacle target, or after K consecutive rejects — **SATURATED,
   reported as such, never silent**.

⛔ **THE SOLVER BOT IS THE ORACLE FOR GENERATED LEVELS.** The game is the only
oracle for the MODEL; a generated level has no wasm counterpart, so the JS
engine plus the solver adjudicates it — bounded by the survey's proven
envelope. Two different sentences, kept straight throughout.

⛔ **AND DEPTH-1 KEEP-OR-REVERT IS NOT A SHORTCUT.** Atomic placement removes
the need for cooperative multi-step placement, which is what removes the DFS
Cloudberry needs. Real search becomes interesting with the full goal queue,
which v1 does not have (collect-placement is its only goal).

### The palette, and what it EXCLUDES by measurement

> ⚠ **HISTORICAL (2026-08-18)** — the roster named here is the PoC arc's. Today the pass-2 roster is **23/23
> instantiations over three DECORATION families** (wall · water · pit, all `site:'chamber'`) and the two biome
> palettes differ only in `items`; the `avoidable arrow lane`, `shove`, `weigh` and `kill` families all left, the
> last three becoming pass-1 elements. See *Arc 3, slice 1* and *Arc 3, slice 4c* below.

Six families / nine templates in the **pre-sword** biome — wall · water · pit ·
avoidable arrow lane · `shove` (a pushable in a wall gap) · `weigh` (a block
shoved ONTO a button, which holds the lock the player walks through) — and the
**post-sword** biome is that roster plus a **kill** family:
`wall-gap-spinner-killlock-*`, a wall whose one gap holds a `tset:-1` kill lock
and whose spinner stands beyond it. **That family is the arc's only
sword-gated one**, and it is sword-gated by the game's own mechanism:
`weaponForPress` returns null with no sword slot, so a swordless press is a
silent no-op.

⛓ **The palette's contract is what makes the loop honest**: nothing whose clear
only the GAME can date. Breakable rocks, Bob press-kill, sandtrap arrow-kill
rooms, free-roaming bobs and everything post-shield are EXCLUDED, each row
carrying its own measured refusal text. ⚖ Chests are a SOLVER CAPABILITY and
never a palette family (the user's ruling: the point was that the solver knows
it can clear a chest by collecting it).

### The three findings worth carrying off the arc

- **⛔⛔ A CONSERVATIVE INGREDIENT ARRIVED THREE TIMES, and the count is the
  lesson.** A "measured density ceiling of eight obstacles" that was a defect in
  the stance derivation, not a property of the room. A `weigh` selection gate
  right about the mechanism and wrong as a selection rule. And the largest: for
  four slices **every generated solve priced a spinner as a 13 px union over 45
  hammer phases**, because the generated boot declared no `save.time` and
  `spinnerDanger` therefore never computed the exact hammer line. Declaring the
  clock took a 32-cell sweep from 26 THREW / 2 SOLVED to 7 / 21. ⚠ The refusal
  text had NAMED ITS OWN CAUSE (*"not countable on this tape"*) in twenty-six
  rows across three slices. **A conservative ingredient that reports its own
  condition is still only read by someone who asks.**
- **⛓⛓ THE EVIDENCE STANDARD WAS RE-CUT TWICE, and the final one is
  DISCHARGE-EXISTENCE.** A kept obstacle looks identical whether or not anybody
  had to get past it, so keep-counts prove nothing; a NEAR/FAR label computed
  from the template in isolation proves nothing either, because in a room
  already holding five obstacles the route detours. The standard that survives:
  **a `{strategy}` RECORD in the FINAL solve**, naming the template's own body.
  An obstacle nobody walked into cannot produce one.
- **⛔ A DECLARED BOUND CAN EXCLUDE A GENERATED ID**, twice in one arc.
  `persistence[].level` is bounded to the real game's 0..115 while `boot.level`
  is not — so a generated level (900) can be BOOTED by a tape and never
  DECLARED ABOUT by one. And `seam.time` is `exclusiveMin` at 0 because the
  game's own getter applies a stored 0 as `dayLength / 2`. Both are bounds
  written for the real game's value space excluding the value a generator would
  naturally pick.

### What it produced

Ten certified levels — five per biome, from recorded seeds — each regenerating
byte-identically in two processes AND in the browser, each loadable in the
editor and watchable through the whole spine, each exported as a PNG, and each
shipping a **requirements report**.

⚖ **THE REQUIREMENTS REPORT'S LAW is the user's own, from the bounce and runner
substrates where impossibility-proving by exhaustive search was the failure
mode.** Re-solve with items removed **at the SAME per-solve budget**; "solves
with X, refuses without X" records X as required; the claim is **SOLVER-RELATIVE
AND BOUNDED BY CONSTRUCTION** and every row says so; **"rule not established"
is a first-class verdict**; and **no budget escalation exists anywhere in the
design**. The three sword-gated levels report *requires Progressive Sword*; the
two controls report *rule not established* — and, because both arms solve at
the identical tick count, *INERT*: the sword changed nothing about the walk.

⚠ **The three REQUIRED rows are GRADED, because their without-arms failed three
different ways** — a solver refusal (STRONG), a budget exhaustion
(BOUND-DEPENDENT), and an engine `PhysicsV2Error` (WEAK — that is the approach
drive stepping where it must not, which is not a claim about the level at all).
Printing one verdict over three facts would be a report agreeing with itself.

### The page's fourth SOURCE, and the CLI that reads it

    watch.html?source=generate&seed=3&biome=post-sword&count=6
    node scripts/procgen/generate-seedling-level.mjs --seed=3 --biome=post-sword
    node scripts/procgen/batch-seedling-acceptance.mjs --out-dir=… --census=24

STEP places one template and re-solves; RUN-ALL runs to target or saturation,
updating after EVERY placement. ⛔ **STEP is "obstacleTarget = k, re-run"**,
which is sound because a run to k is a run to k+1 truncated — asserted over both
biomes rather than argued — and costs O(N²) solves, which the page prints before
you press. The payoff: the page's step-k level IS the CLI's `--count=k` output,
byte for byte, with no page-side reconstruction in between.

⛔ **ONE RENDERER SURVIVED IT.** `--generated=<payload>` serves a payload the
CLI generated and hands the page `?gen=`; the page REGENERATES from the
payload's own seed and COMPARES. So the picture is of what the browser
generated, the payload says what node generated, and the export is a
cross-runtime determinism check rather than a picture of a file.

⛔ **AND THE PAGE STILL NEVER WRITES `fixtures/`.** A generated level lives in
the save box, in the Download button and in your hands.

### What it hands to R9

The kill arms (bob and sandtrap) with a measured work order — and the finding
that made it one: `derivePressKill` builds its live-body map from
`run.spinnerBodies` alone, so **`KILL_ARM_POLICY.Spinner` is the only row the
table can ever serve** and the other twenty-odd are dead data in every room.
Widening that source is the first edit either arm needs, and **L40 is the first
measurement they owe** (the only committed room where a dozen bobs and live
spinners share a roster). Beside them: the approach-drive `PhysicsV2Error`
question, now measured at four separate moments; two format bounds; and a
structured-field residue worth taking the next time `solverBot` is open anyway.

### Where the procgen arc's own findings live

The full record is `NewDocs/plans/seedling-procgen-poc-kickoff.md` (⚠ `NewDocs/`
is deliberately gitignored — working machine only): §1 the user's settled
rulings, §3 the design, §7 the exit criteria; then one as-built per slice —
§8 the level model and seam proof, §9 the generator core and pre-sword palette
(and the two rulings that do not compose), §10 the collect-path solver fix
(three defects in one function, only the first in scope), §11 block-on-button
and the `weigh` verb, §12 the post-sword biome and the shove-FAR diagnosis,
§13 the kill-lock scratch persistence layer, §14 the kill-arm recon that routed
both arms to R9, §15 the countable clock and the first sword-gated promotion,
§16 the GENERATE arm with the acceptance batch and the requirements report,
**§17 the consolidated residue R9 inherits**, and **§18 the exit criteria
answered one by one with their evidence**.

---

## The switch arc — the page stops reloading itself (TOOLING; user-directed, 2026-08-12)

> ⚠ **HISTORICAL for the GENERATOR (2026-08-18)** — the arc's own subject (the page's teardown, its overlays and
> the ceremony text) is current; the TEMPLATES several of its findings are stated about are not. The three door
> templates retired in arc 3 slice 4c and their group/tag defects are now the ELEMENT bindings' to get right —
> see § *The procgen ELEMENTS design* → *Arc 3, slices 3, 4a, 4b*.

A user-directed follow-on to the editor and PoC arcs, in four slices. It built
no game behaviour and no claim. The ask was one sentence — *keep the level data
loaded when switching between the four modes* — and the answer turned out to be
a lifetime problem rather than a persistence one.

**Why the page reloaded in the first place.** Every way of leaving an arm
NAVIGATED: the SOURCE selector, the tape picker and the boot presets all
assigned `window.location.search`. `populatePicker`'s own docblock stated the
trade — reloading "keeps both sides on one code path instead of giving the JS
side a teardown nobody tests". A document teardown stops every rAF chain, drops
every listener and forgets every closure, for free. It also throws away
everything you typed, which is the whole complaint.

**⛔ The blocker was narrower than it read.** "Every tape needs a fresh page"
is about the WASM side — `botReset` forgets the tape, not the world — and an
iframe pointed at `about:blank` gives it a fresh document without reloading the
parent. Everything else was JS-side, and the mechanism already existed in
miniature: `replayGeneration` was added at editor slice 3 because a MANUAL fold
supersedes a replay in place.

| slice | what it did |
|---|---|
| **1** | `watchLifetime` — one lifetime per arm mount, retired by the next: `on` (listeners that die with it), `guard` (self-scheduling loops that stop and SAY they stopped), `report` (a retired arm's message kept rather than painted over the live one), `onRetire`. Landed while the selector still navigated |
| **2** | the SOURCE selector switches IN PLACE — `replaceState` for the URL, chrome cleared between arms, and `stagingForMount`: a box already holding a block BEATS `?boot=` |
| **3** | ONE boot panel shared by SOLVE and MANUAL; `armPrelude`, `loadAtlas`, `mountBootPanel`, `PANELS`, and the CSS each panel had copied |
| **4** | the GENERATE bridge — hand the generated record to SOLVE or MANUAL in memory, with the model's own goal, the composite level source and the scratch fork |

### The teardown the reload was doing

Enumerated by wiring it, not by inspection. Each of these was harmless while
leaving an arm meant leaving the document:

- **`manualFrame` had no supersession check of any kind.** It re-arms from its
  own tail; retired, it would step the session for the life of the tab under
  whichever arm came next.
- **MANUAL's keydown/keyup/blur are on WINDOW** and `preventDefault` the bound
  keys. A retired MANUAL would eat arrow keys — and the page's scrolling with
  them — under SOLVE and GENERATE. Nothing throws: the keyboard is haunted.
- **The boot form's `input` listener ACCUMULATES.** An arm mounted twice
  re-derives the checkboxes twice per keystroke. Nothing breaks; it just does
  the work N times.
- **GENERATE's RUN-ALL driver** yields a frame per step and spends seconds per
  iteration, so a switch lands mid-run.
- **The wasm poll chains** run to a 180 s fuse and would time out under another
  arm, painting a wasm refusal over its readout.
- **`mountBootForm` appended** into a div holding a static label, so a second
  mount gave the arm a second row of sword checkboxes.

### ⛓ The traps this arc adds

**A leak witness that is a SNAPSHOT cannot see the leak, because leaks are what
happen next.** Hit TWICE, one level apart. The holder pushed `state()` at
retirement, so a retired arm's `stopped` list was always empty — a guarded
loop's one blocked tick is the frame that was ALREADY SCHEDULED, and lands
after the snapshot. Then `window.__editorLifetime` was ASSIGNED on publish, for
exactly the same reason, and the browser row came back with an empty list for a
loop it had just watched stop. Both are getters now. ⚖ The
readout-assigned-from-a-getter family, in the very instrument built to report
leaks.

**A settle condition the previous state already satisfies is not a wait.** The
switch row waited for the arriving arm by watching its boot box — which is full
the instant the switch begins, BECAUSE KEEPING IT FULL IS THE FEATURE. The wait
returned immediately and the row asserted against the outgoing arm's page,
reporting a missing note the page wrote a moment later. `window.__editorArm`
(set only when a mount COMPLETES, and cleared by the chrome reset) is the
honest thing to wait on.

**A structural check that cannot fail against the code it was written for is a
check of nothing.** The row asserting no bare `addEventListener` in
`watchViewer.js` first matched `/(?<![\w.])addEventListener\(/`, whose negative
lookbehind excludes a leading dot — so it skipped `window.addEventListener(`,
which is every call it existed to catch. It went green against all five live
listeners.

**A conditional keyed on "am I holding one" when the question is "is THIS the
one".** The scratch-persistence fork was first keyed on
`Boolean(heldGeneratedLevel)`. Hand a generated room to SOLVE, then paste a
COMMITTED tape, and that tape's v9 `at` row would compete with the model for
the slot its own tape already declares. `isHeldLevel(level)` asks the question
actually being asked.

**Two true sentences, and the weaker one is the wrong one.** A handed-over
generated level IS "a block the box was already holding", so the kept-block
note applies to it — and says the block is your edits when it is the
generator's output. Provenance notes need an ORDER, not just a set.

### What the page does now

- The SOURCE selector rewrites the URL with `replaceState` and swaps the arm in
  place. Every view is still a link; what survives is the DOCUMENT.
- SOLVE and MANUAL share ONE boot panel. **A box holding a parseable block
  beats `?boot=`, and the panel SAYS so** — a view showing edits the link does
  not carry must not look like a view of the link. Unparseable text is KEPT and
  reported with the parser's own message, never overwritten. Presets and the
  tape picker still navigate, which is what lets them win.
- `#bootLevel` is a READOUT (`readonly`). It was written by both arms and read
  by neither: SOLVE let you type a level into it and nothing consumed the
  number, while MANUAL marked the same field `disabled`.
- GENERATE hands its record to SOLVE or MANUAL **in memory**, with the model's
  own goal in `?goals=` (the receiving arm's census-derived defaults are NOT
  the list the generator certified against), a composite level source
  (generated record for its level, atlas for everything else) and the scratch
  fork. THIS TAB holds it; a reload loses it; the link describes the
  GENERATION, not the room — and the note says all three.
- `window.__editorLifetime` reports the live arm, the retired ones, the loops
  each stopped and the listeners each dropped.

### Group A — the user's follow-on batch (2026-08-12)

Six more items, in three commits, all in the arm-mount and panel code the arc
had just refactored:

- **⛔ The drawn level IS the page's level.** The bridge armed itself on its
  two BUTTONS, so the obvious route — GENERATE → MANUAL with the SOURCE
  SELECTOR — found an empty box, fell back to `?boot=` and dropped you at the
  true game start in level 0. Handing over is now a consequence of DRAWING.
  ⚠ Stated price: a hand-typed block is replaced the moment GENERATE draws.
- **Every arm draws its level on mount** (`previewLevel`) — SOLVE drew nothing
  without `?solve=1` and MANUAL nothing until START. Same construction the
  arms press into; one draw, no loop.
- **The level stepper** (`◀ ▶` + a `#bootLevel` that WRITES the block) walks
  the ATLAS'S OWN level list, not `level ± 1`.
- **⛓ The boot position has THREE outcomes and three sentences.** Measured: 42
  of 116 levels have a committed boot in the tape roster, so two thirds of the
  stepper's destinations have no position the game ever used. Committed boot ·
  a cell THIS PAGE CHOSE (nearest walkable non-pit where `playerBoxAt` clears
  the solids — a convenience nothing may rest on) · a stale one it could not
  replace. Three degrees of trust must not read alike.
- **The goal pre-fill is `defaultGoalsFromCensus`** — the page's own law, not a
  second policy (see the trap below).
- **The trace pane scrolls itself**, and **`?side=` became a picker** whose
  round trip is where the iframe `about:blank` teardown becomes observable.

⛓ **TRAP: a convenience that quietly overrules a refusal.** The goal pre-fill's
first cut took "the first usable option" always — which overruled the one case
`defaultGoalsFromCensus` exists for, a level with two live exits, where the
page refuses because a solve toward the wrong one prints a tick count that
looks like an answer. `check-seedling-editor-boot.mjs` went red on level 4 and
that is what caught it. The second cut fired only on a census with exactly ONE
option of any kind — honouring the law but almost never firing, since level 0
has eight and seven are pickups nobody is ambiguous about. ⇒ **ask the function
that already knows.** The pre-fill and the press now agree by construction.

⛓ **TRAP: a pixel witness that counts the wrong thing.** The row asserting the
canvas is drawn counted pixels differing from the renderer's background
`#101014` — and an untouched canvas is transparent BLACK, differing in all
three channels, so a canvas never drawn on scored **102400/102400** and passed
the check written to catch exactly that. Alpha separates them; the colour count
keeps a flat fill from passing as a room. *A measurement that cannot come out
any other way is not a measurement.*

⚠ **A machine-dependent claim is not a claim.** The engine picker's row asserts
the SWITCH (arm named for its engine, old one retired, URL moved) and says
nothing about whether the wasm build is present. ⛓ 2026-08-19 that build
ships in a submodule rather than being machine-local, which makes the row's
silence a *design* choice rather than a necessity — it still asserts only the
switch, so a clone without `--recurse-submodules` cannot redden it. And it waits on the LIFETIME, not `__editorArm`: that marker
means "the mount function returned", and `runWasm` does not return until the
tape starts, which needs one real click by design.

### The acceptance

`scripts/procgen/check-seedling-editor-switch.mjs` — 51 claims, brings its own
server, cannot skip. ⛔ **Its leak claims are BEHAVIOURAL, never the page's own
account alone**: a lifetime that never registered a listener and one whose
listeners leaked both report the same number. The witness is `preventDefault` —
a driving MANUAL cancels a synthetic ArrowRight and a retired one does not —
and **BOTH readings are taken**, because the "after" alone passes just as well
when the listener was never registered.

Standing gates unchanged: the 10 existing editor rows, 3656 `seedlingDemo`
tests, and `solve-seedling-r8-battery.mjs --check` byte-identical
(`1fedb0ab35b7cd74accecf0345bdc893`, 28 PASS, exit 1 — the two standing drift
rows).

### Group B — the renderer, the overlays and the ceremony text (2026-08-12)

Five more items, in two commits, in the code Group A deliberately left alone —
the renderer, the overlay roster and the engine's read surfaces. **Two of the
five turned out to be about a picture the page was drawing CORRECTLY and
explaining to nobody**, which is the finding worth carrying off the batch.

- **⛓ The sword you can never see — and the swing window was already right.**
  The first question was whether a swing's active window is DERIVABLE or would
  have to be assumed. It is derivable, and the layer was already drawing all of
  it: `Player.slash`'s `slashDelayMax` is **0**, so the hit test runs on every
  tick `slashing` is up, and the run pushes a press row for each.
  ⛔ **MEASURED across the committed tapes** (`r5-l60-kill`, `r6-shield-kill`,
  `r6-owl-kill`, `r5-l40-part0`, `r4-walk-full`):

  | weapon | rows in `run.presses` per press | `fired` ticks |
  |---|---|---|
  | sword | **5** (`presses.SLASH_HIT_TICKS`) | T+1 … T+5, consecutive |
  | spear | 1 | T+1 |

  Five ticks is **83 ms** at the pacer's speed 1. *That* is the blink — so the
  fix is an afterimage and it is a **DISPLAY CHOICE**, which is why it rides in
  its own readout channel (`drawn.attacksHeld`), its own desaturated
  outline-only ink, its own legend row with the words in it, and its own knob
  (`?attackhold=`, default 15, 0 = raw). `drawn.attacks` is byte-unchanged and
  still means *the tick the run collided a rect*.
  ⚠ The spear's real T+1/T+3/T+5 window is a **named model bound**
  (`presses.SPEAR_HIT_TICKS_UNMODELLED`), carried in the readout so one rect
  where the game tests three times is an absence with a written cause.

- **⚖ Which box is the player's real hitbox.** The page drew two overlapping
  boxes one pixel apart and told nobody which was which. ⚖ The user kept both
  and ruled that the fix was to SAY:
  - **white, filled — `playerBoxAt(x, y)`.** THE hitbox. The engine's own
    `HITBOX` origin/width/height, the box the physics collides solids with, the
    box `dangerAt` is queried with, the box `hammerHitsPlayer` is handed. If a
    question was "did that touch the player", this rect answered it.
  - **yellow, outline — `terrainProbeRect(x, y)`.** NOT a collision volume and
    never consulted as one. The same box shifted DOWN by `checkOffsetY` (= 1),
    which `Player.getState()` (`Player.as:660`) compares the nearest tile
    against to decide the terrain type. ⚠ The one-pixel overlap **is the
    point**: it is why a player can be collision-clear of a pit and reading
    `pit`.

- **⛔ A pushed block is still drawn at its starting position — true for seven
  slices.** The world-state roster excused the family in writing: *"`pushables`
  is drawn already (its own path layer since slice 2)"*. It is not the same
  picture. That layer is **one dot at the block's centre per tick**; the 16x16
  GREY BOX a reader sees is the BASE world's, built once per level and never
  advanced. So the two readings together said *"the block is here now"* and
  *"the block is ALSO still there"*, and only one was true. Pushables are now a
  world-state family **in their own arm**, because the join is a **rect
  comparison** and not set membership — every block is in `run.pushables` from
  tick 0 whether or not anything touched it. The glide is drawn, not snapped
  (0.5 px/tick, off the 16 px grid), and the engine differential asks
  `collidesSolid` in **both** directions: the wall IS at the drawn rect, and —
  once the block clears its spawn cell — is NOT at the base.

- **⛓ A pushable and a breakable rock are not one colour.** Every entity solid
  was `#55506a` — 1219 of them across 116 levels, so the two things a room's
  puzzle is usually made of looked like each other and like a dresser.
  Coloured by the **run's own join** (`pushableId`, `rockId`, …) — the same
  field `liveRectOf` switches on — never by tag, which would split one family
  across seven names (`lock`/`cover`/`wandlock`/`bosslock`/`shieldlock`/
  `rocklock`/`grasslock`) and merge two (`breakablerock` +
  `breakablerockghost`). ⛔ **MEASURED FIRST: no solid in the atlas carries two
  id fields** — activatorId 70 · rockId 24 · pushableId 19 · chestId 16 ·
  treeId 6 · magicalLockId 6 · bridgeId 5 · pulserId 4 · crusherId 4 · ropeId 3
  · turretId 2 · shieldBossId 1 · bossId 1 · finalDoorId 1, **zero
  multi-keyed** — so "first field that matches" is a total function and not a
  precedence rule that happens to work. The other **1057** carry none, keep the
  grey, and the legend NAMES them as scenery.

- **⛔ The ceremony text — a display half and an advance half, with different
  answers.**

  **The display needed a read surface that did not exist.** The model has had
  the whole dialogue since R3 (`dialogue.beginDialogue` — pages, current page,
  character count, frame cadence) and `levelRun` exposed a **boolean**
  (`inCeremony`). That is everything a fixture author needs and nothing a
  WATCHER needs. `run.ceremonyNow` is the surface — additive, read-only, and in
  **`get watchers()`'s own field names**, because a Watcher's placed-NPC
  dialogue is the same state and has been reported field for field since R6
  slice 6c. It **copies**: `stepDialogue` mutates in place, so a getter that
  handed the object back would make every collected sample point at one object
  and the page would draw the final page at every scrub position. It rides on
  `sampleMovers`, so ONE derivation feeds the box while DRIVING and while
  SCRUBBING a replay.

  **The advance was already written, once, somewhere unreachable.**
  `botDriverV2.runCollect` has driven ceremonies since R3 with a `PRESS_GAP`-
  spaced press/release cadence — inside a `while (…) { run.advance(…) }` loop,
  which a page driven by a keyboard pacer cannot call. Retyping it would have
  been a second cadence agreeing until somebody changed `PRESS_GAP`; this arc
  has refused that shape three times (§8.6, §9.3, slice 8's `arrowLane`). ⇒
  `ceremonyCadenceStep` is **hoisted**, `runCollect` uses it, and the committed
  tapes are byte-identical across the extraction.

  ⚖ Auto-advance is **ON by default** (the user's own suggestion) and is a
  **switch**, because it makes the page dispatch keys the driver did not press
  — and those keys are **RECORDED**. That is the honest outcome and exactly why
  turning it off must be possible; the fold round-trips them.

  ⚠ **Four named absences, and the third is the one that matters.** A boss key
  or a totem part has `text: ''`, so `Pickup.pick_up()` spawns no NPC and the
  ceremony freezes the screen for 150 frames with **nothing to press**. That
  looks exactly like a hang, so it gets the box and a sentence saying so.

#### ⛓ The traps this batch adds

⛓ **A "diagnostic overlay" nobody labelled is a second hitbox.** Two of the
five items were not defects in what the page DREW — the swing was already five
ticks, the two player boxes were already the right two boxes. They were defects
in what the page SAID, and they cost a user's time either way. *A picture with
no legend row is not a picture of anything.*

⛓ **A layer that "already covers" a family may be answering a different
question.** The pushables path layer really does draw the block's position
every tick — as a **dot**, in the trail vocabulary — and the roster's own note
took that as covering the family for seven slices. The reader's eye is on the
16x16 grey box, which is a different reading, from a different source, that
nothing was correcting. ⇒ when a roster excuses a family, check what the
excusing layer actually PUTS ON SCREEN, not what it is named.

⛓ **A knob mounted in a roster's container becomes a member of the roster.**
MEASURED: the attack-hold field was first added to `#layers`, which three
acceptance rows enumerate as one input per `OVERLAY_LAYERS` row. It reported
the roster as **16 against a roster of 15** and reddened `world`, `lanes` and
`shapes` simultaneously, each complaining *"FIFTEEN now — 16"*. It lives in
`#viewknobs` now and the **container is a contract** the checks assert. *The
`?layers=` roster is addressed by DOM position as well as by name.*

⛓ **A differential with a missing key vacuously passes.** The world-state
engine differential looks up `hit[FAMILY_KEY[family]]` — and `hit[undefined]`
is `undefined ?? null`, i.e. **exactly what "the engine agrees the solid is
gone" looks like**. Adding a family to the layer without adding it to that
table does not fail the differential, it silently stops asking. The table entry
landed with the family.

⛓ **An observation that does not overlap the event sees the aftermath.** The
browser row for the ceremony text first released the key after 700 ms and
started polling afterwards: page ONE had been and gone, so the row saw a *paged*
ceremony and could not see it *type*. The poll now runs while the key is down —
which also made the claim stronger, since holding a DIRECTION through the whole
ceremony proves the cadence **replaces** the driver's keys rather than merging
with them.

#### The acceptance

New claims in the existing rows, never a relaxed one:

- `check-seedling-editor-shapes.mjs` — the **partition** (at a tick past the
  swing the raw channel is empty and the held one is not, and no press row is
  ever in both), the off switch (`?attackhold=0` restores the raw picture and
  *nothing else changed*, asserted), and the legend wording.
- `check-seedling-editor-world.mjs` — the pushed block (three blocks counted
  from tick 0, ONE marked, at the measured tick, gliding 0.5 px/tick), the
  object-solid palette, and the two player boxes named by function.
- `check-seedling-editor-manual.mjs` — a real-key drive onto the sword that
  reads both of `Pickups/Sword.as`' pages off the page, with the fold still
  round-tripping the X releases the page dispatched.
- `watchOverlays.test.js` / `watchManual.test.js` — 18 new, including the
  **control arm** the auto-advance claim needs: the same hands-off drive with
  the switch OFF is still in the ceremony after the budget the other arm
  finished inside.

Standing gates: **3674** `seedlingDemo` tests, all **11** browser rows green,
and `solve-seedling-r8-battery.mjs --check` byte-identical
(`1fedb0ab35b7cd74accecf0345bdc893`).

### The start position comes from the level's ENTRANCES (2026-08-13)

⚖ The user's item, immediately after Group B: *"instead of guessing the
player's start position in each level, it read[s] the start position from
entrances to that level, if possible. There should also be a way to select
between entrances when there are more than one, and also a way to select
specific coordinates."*

**⛔ THE GAME ALREADY ANSWERED THIS AND NOBODY WAS ASKING.** `Teleporter`
carries `to` (the destination LEVEL) and `playerx`/`playery`, and
`Game.as:2040` builds `new Player(playerx, playery)` in the destination — the
very ctor args `levelRun`'s transition arm passes and `playerPhysicsV2.arriveIn`
replays. So:

> **an ENTRANCE to level N is a teleporter, in any level, whose `to` is N**,
> and its start position is that teleporter's own `playerx`/`playery`.

`watchEntrances.js` indexes them. ⛔ **MEASURED BEFORE IT WAS BUILT**, over all
116 levels:

| fact | value |
|---|---|
| teleporters in the atlas | **280** (1 deactivated, 52 stairs) |
| with an integer `to` inside 0..115 | **280** — the builder throws otherwise |
| rooms with ≥1 entrance | **112 of 116** |
| rooms with none | **58, 69, 81, 84** |
| entrance-count distribution | 26 rooms with 1 · 51 with 2 · tail to L12's **14** |
| whole-atlas scan, `roles: ['trigger']` | **93 ms** |

That last number is why the index is built **eagerly, once per panel mount**:
an entrance to L10 lives in L9 and L11, so a lazy per-level answer would walk
the whole atlas anyway and then do it again on the next miss.

**The ladder is now committed boot → ENTRANCE → the page's chooser → stale**,
and the chooser is reached only by those four rooms. ⚠ **The committed boot
still wins where it exists, and that is a decision.** MEASURED: of the 42
committed boots, **21 sit exactly on an entrance and 21 do not** —
`r3-collect-shield` boots at (112,72) in L20, mid-room, to isolate one
mechanism. Both are positions the game used, they answer different questions,
and the SELECTOR offers every entrance regardless, so the default hides
nothing.

The controls are two, because it is two questions. `#bootStart` says **where
the number came from** (the degree of trust, one row per answer, each with its
own sentence); `#bootX`/`#bootY` are **the coordinates themselves**, always
editable. ⚠ `CUSTOM` is an ATTRIBUTION, not a place: typing in the fields
switches to it, because a selector still reading *"ENTRANCE from L11"* over
numbers somebody had since edited would be the page asserting a provenance
that is no longer true.

#### ⛔⛔ The half tile, and the defect it had already caused

A staging block's `boot.x`/`boot.y` are the **`Game` CONSTRUCTOR'S ARGS**; the
Player ctor re-centres onto the tile (`Player.as:357`), so the player is
observed at `boot + 8`. MEASURED on `r3-collect-sword`: boot `(48,80)`, first
observation `(56,88)`.

⛓ **`chooseSpawn` — Group A's convenience — was on the wrong side of that
offset.** It validates a tile CENTRE (`playerBoxAt(cx, cy)` clears the solids)
and then wrote that centre into the field the engine offsets **again**, so the
player landed half a tile down and to the right of the cell that had been
checked. MEASURED over a twelve-level sample: **five of the twelve spawned
INSIDE A SOLID** — L58, L84, L70, L90, L110 — which is the precise failure the
function exists to prevent. It returns the tile CORNER now, and its distance
metric no longer compares a centre against a ctor arg.

⇒ **A validated coordinate written into a field somebody else offsets has not
been validated.** The general form of trap 171's family: the instrument was
sound and was pointed at the wrong quantity.

#### ⛓ The second defect, found by the browser row

A number input fires `change` on **BLUR** as well as on commit. So the
sequence *"type a level, then click the entrance picker"* delivered a second
`change`, re-ran `setLevel` for the level **already in force**, and silently
reinstated the head of the ladder — the picked entrance reverted from `48,32`
to `48,80` between one read and the next, with the selector flipping itself
back to `committed`.

⇒ **the level field changes ROOMS; the start controls change POSITION.**
`setLevel` now returns early when the level has not actually changed. *A
control that quietly does two jobs will do the wrong one on a spurious event.*

#### The acceptance

- `watchEntrances.test.js` — 9 rows, and the load-bearing one is the engine
  differential: **for all 280 entrances, BOOTING at one lands the player at
  exactly the position `arriveIn` gives for that teleporter.** If the half tile
  were dropped, or the arrival used where the ctor args belong, all 280 would
  be 8 px out. The pinned counts (112/116, the four rooms, 280, the 52 stairs,
  the 1 deactivated) are what the page's own sentences claim, so a drift in the
  atlas fails here rather than turning the UI into a confident lie.
- `check-seedling-editor-boot.mjs` — a new section over L10 (two entrances,
  one of them stairs, plus a committed boot on the L9 one): the picker
  populates, picking rewrites the block, the fields follow, typing rewrites and
  **re-attributes**, a fraction is refused by name and snaps back, a re-commit
  of the same level leaves the choice alone, and L58 names its absence and
  falls through to a chooser whose cell the player box **actually fits in at
  the observed point**.
- `check-seedling-editor-switch.mjs` — the provenance claim gained the fourth
  outcome and the listener count went 6 → 9. ⛔ Both REPLACED, never relaxed
  (trap 62): a bounded `>= 6` would pass on a listener that stopped being
  registered as happily as on one that leaked.

⛓ **TRAP: a claim written as `probe ? probe.ok : true` cannot fail where the
probe is missing.** The spawn-fits row's first cut called an
`window.__editorSpawnProbe` that did not exist and passed on the fallback arm —
green on exactly the machine where the measurement did not happen. The probe is
real now (`window.__editorSpawn`, published by `previewLevel` from the RUN's
own state so it cannot re-derive the offset it is checking) and its **existence
is asserted separately** from its verdict.

Standing gates: **3683** `seedlingDemo` tests, all **11** browser rows green,
battery hash `1fedb0ab35b7cd74accecf0345bdc893`.

#### The opening frame, and the stamp that ended an ambiguity (2026-08-13)

⚖ Two follow-up reports, and **only one of them was a defect I could find** —
which is itself the finding.

**⛔ "When the page first loads, it doesn't display the level." REPRODUCED.**
Group A's item 9 was *every arm draws its level on mount*, and SOLVE, MANUAL,
GENERATE and REPLAY-with-a-tape all do — measured at 102400/102400 opaque
pixels each. A bare `watch.html` is REPLAY with **no `?tape=`**, which reported
the missing parameter and RETURNED before drawing: measured at **0/102400**.
The one arm that did not draw was the page's own default entry point. It now
draws `trueStartStaging` — the same block `stagingForMount` hands the other
arms when nothing else is named, so no level is picked here and no tape is
invented — and ⚠ **the refusal survives and is reported first**, because a
drawing that replaced it would be a page pretending to have loaded something.

**⚠ "In manual mode it's still not displaying the level on first load." NOT
REPRODUCED — and the negative was MEASURED.** MANUAL was checked bare, with
`?boot=`, `?tape=`, `?side=`, `?speed=`, `?layers=`, after a reload, via the
SOURCE selector, and at five window sizes from 1920x1080 to 1280x600. It drew
in all of them, from the first 300 ms sample, fully above the fold every time.

⛓ **THE TRAP THAT LEFT: a question the page could not answer about itself.**
Is the fix wrong, or is the browser running an older copy? The dev server is a
plain `python -m http.server` — `Last-Modified` and **no `Cache-Control`** — so
a browser may serve the module from cache without revalidating, indefinitely,
and nothing on the page distinguished that from a defect. Every report about
behaviour was ambiguous and neither side could tell.

⇒ the page **stamps which copy of itself is running**, from the browser's own
resource-timing entry, in **three** states — and the third is the one a
two-state reading gets wrong:

| reading | meaning |
|---|---|
| `transferSize === 0` | taken from cache **without asking** — the only state that can be stale |
| `0 < transferSize < decodedBodySize` | **revalidated (304)** — cached AND current |
| `transferSize >= decodedBodySize` | downloaded in full |

⛔ MEASURED against this very server: a warm load reports **300 bytes**, which
is neither a download (the module is ~250 KB) nor a silent cache hit — it is a
304. A two-state reading called that *"fetched from the network"*, which is
false, and would have called it *"cached/stale"* just as wrongly. All three
branches were exercised; the first needed a server that **actually sends
`Cache-Control`**, because Playwright's `route.fulfill` re-times the resource
and never produces a true hit.

⚠ It REPORTS and never acts — a page that silently re-fetched itself would make
the same ambiguity unobservable from the other side — and the loud message says
what it **measured**, not why: which header let the browser cache it is not
something this reading asked, and blaming the server would be a second claim
with no measurement under it.

⛓ **The general lesson: a tool whose job is showing you the truth needs one
reading about ITSELF.** Without it, "your fix does not work" and "your fix
never reached me" are the same sentence.

### Every generated switch opened every generated door (2026-08-13)

> ⚠ **HISTORICAL (2026-08-18)** — `wall-gap-lock-weigh-h`/`-v` no longer exist (arc 3 slice 4c). The FIX's rule
> survived them and is now the elements' law: a placement's groups come from `placementGroupId` at its own anchor
> cells, two per guard placement, and a collision THROWS. See *Arc 3, slice 3* below.

⚖ The user's report, in their words: *"when the generator generates two
different pairs of switches and switch-opened doors, both of the switches open
both of the doors. Each switch should only affect its own door."*

**It was a property of the PALETTE, not of the placement loop, so no seed
avoided it.** `wall-gap-lock-weigh-h`/`-v` each hardcoded `tset: '0'` on their
lock AND their button. `levelWorld.tSetOf` is `intAttr(attrs, 'tset', 0)`, and a
press publishes to every `Activators` sharing that number — so two placements
of one template put all four entities in group 0.

⛓ MEASURED FIRST, on `--seed=1 --count=4`, the DEFAULT seed:

```
lock@80,48 {tset:'0'}  button@96,32 {tset:'0'}
lock@80,80 {tset:'0'}  button@96,64 {tset:'0'}
```

⛔ **AND IT WAS WRONG ON THE SOLVE SIDE TOO** — the half a play-test would
miss. `solverBot.refineStrategy` binds a lock's openers with
`pressers.filter((p) => p.t === row.t)`, so each lock saw BOTH buttons. The
solver was already asking the group question correctly; only the palette was
answering it wrongly.

#### The fix: a DECLARED slot in a still-frozen table

The obvious shape — templates become factories of their placement — dissolves
every invariant this file has: `assertPalette` walks static footprints at load,
`POST_SWORD_TEMPLATES` is a superset BY CONSTRUCTION, and each row's
measurements are attached to a row a reader can see. So the table stays frozen
and the slot is declared IN it: both entities carry `PLACEMENT_GROUP`, the
template declares `groups: 1`, and `procgenSeedling.place` — the ONE writer
that turns template entities into level entities — resolves it.

⚖ **THE ALLOCATOR IS THE ANCHOR, AND THAT IS A DECLARATION, NOT A DETAIL.**
`levelGenerator` calls `place` on EVERY candidate including rejected ones
(:330, above the `keep` at :380), so a counter would make a kept placement's
group a function of the REJECTION HISTORY — still deterministic, but a
different function of the seed, and one that moves when a bound or a verdict
changes. Allocating at keep-time instead would break ⚖ §1.2's atomic placement.
Deriving it from the anchor cell keeps `place` PURE and gives the stronger
property: **a placement's group depends on where it landed and on nothing
else.** `placementGroupId(at, height) = tx * height + ty + 1`.

⛔ The `+ 1` is a hard requirement: the engine's group vocabulary is signed and
the negatives are claimed (`FORCED_TSET` −1/−2, and `t < 0` is *lock-despawn*),
while **0 is claimed too** — it is what `intAttr` returns for a MISSING `tset`,
i.e. the group every unmarked activator is already in. ⚠ There is no upper
bound to respect: the group is matched by EQUALITY, never used as an index
(`if (v[i] != this && v[i].t == t)`), so the atlas's habit of small integers is
a fact about hand-built rooms and not a ceiling.

#### The measurement, seeds 1–24 at target 6

| | before | after |
|---|---|---|
| seeds keeping ≥1 weigh template | 18 | **18** (identical) |
| seeds keeping ≥2 | 3 (1, 14, 19) | 2 (14, 19) |
| **seeds with a SHARED group** | **3 — all of them** | **0** |
| aborts | 0 | 0 |

Seed 14, after: `lock@96,80 t=62 / button@80,96 t=62` and
`lock@128,80 t=82 / button@112,96 t=82` — two pairs, two groups, one opener
each. ⇒ the palette did NOT lose the ability to place two pairs.

⛓ **Seed 1 now keeps ONE weigh template instead of two, and that is the fix
working.** The second placement is REVERTED (`BUDGET_EXHAUSTED`, *"no corridor
… to a stance that can collect torchpickup"*): with a shared group the first
pair's parked block held the second lock open from the moment it was placed, so
the loop was keeping a door that was never a door. Made independent, that
candidate does not solve, and the loop rejects it.

#### ⛔ The suite could not see this defect, and the reason generalises

The full 3683-test suite passed UNCHANGED on the fix — nothing had to be
re-recorded, because nothing had ever asserted the group ACROSS placements. The
test that existed was

```js
expect(button.t).toBe(lock.t);   // one placement
```

which is true of a shared literal and a private group alike. It passed on every
commit of the arc while the defect was live.

⇒ **A RELATIVE CLAIM ABOUT ONE INSTANCE CANNOT SEE A COLLISION BETWEEN TWO.**
The new test places the template twice and asks the pairing the way the SOLVER
asks it — each lock has exactly one presser — and it is mutation-checked:
resolving the slot to `'0'` fails it and the other 42 palette tests still pass.

Three invariants now run at module load, each forbidding a shape that would
look fixed and behave broken: no HALF-CONVERTED row (lock on the slot, button
on a literal — which is *worse* than the bug: the door never opens at all), no
SOLO group, and a group-bearing template must WRITE its own `(0,0)` so the
anchor is consumed and the ids stay injective.

#### ⚖ What this slice did NOT fix, with the evidence

**`tag: '0'` on both weigh locks is a SECOND collision, and it is with the
GOAL.** `tag` is the PERSISTENCE flag, not the broadcast group. A plain `Lock`
that fades open writes `Game.setPersistence(tag, false)` (`activators.js`, the
transcription of `turnOff()`'s third line), and `SEEDLING_DEFAULTS.goalTag` is
also `'0'` — the exact collision `KILL_LOCK_TEMPLATES` discharges by
construction with its `tag: '1'`, under its own stated law: *a clear is a FLAG,
so a lock on the goal's own tag removes the GOAL.*

⛔ NOT FIXED HERE, and NOT because it was judged harmless: the right value is
not a literal either (`'1'` is the kill-lock's, so two placements would collide
there instead), so it wants this same per-placement treatment on a field whose
blast radius — the goal, 4b's scratch layer, `botDriverV1`'s v9 `at`
declarations — has not been measured. The slot mechanism is field-agnostic and
will serve `tag` unchanged when that measurement exists.

⚠ Also measured and RULED OUT as part of this: the arrow trap's `tset: '0'`
(palette:256) does NOT widen the collision. `arrowtrap` never enters the group
census — the only two push sites are `pressers.push` and `activators.push`, and
it feeds `arrowTraps` instead — so its `tset` is a faithful transcription of the
atlas attr that the model never reads.

#### Gates

`npx vitest run frontend/modules/seedlingDemo/` **3692/3692** (3683 + 9 new);
all **11** `check-seedling-editor-*.mjs` PASS, `generate` included; the R8
battery `--check` still hashes to `1fedb0ab35b7cd74accecf0345bdc893` (28 PASS,
exit 1, the two standing `r8-solve-4` drift rows) — a palette change has no
reach into committed tapes, which is what that row was there to say.

### Every generated lock wrote the GOAL's persistence flag (2026-08-13)

⚖ The residue the switch/door fix named and did not take (`2a407a817`), closed
here as the external-level-sets plan's **Phase 6**
(`CC/docs/plans/seedling-external-level-sets.md`).

`tag` is the SAVE-FILE flag, not the broadcast group, and the weigh templates
carried `tag: '0'` — which is `SEEDLING_DEFAULTS.goalTag`. At source:

- `Lock.turnOff()` (`Puzzlements/Lock.as:90-96`) is
  `if (type == normType) { … Game.setPersistence(tag, false); }` with **no
  `tag >= 0` guard**, and `returnToNormal()` writes the same slot back **TRUE**.
  ⇒ a lock writes its tag on every open AND every close.
- `TorchPickup.check()` is
  `if (tag >= 0 && !checkPersistence(tag)) { doActions = false; remove(this) }`.

⇒ **every parked and unparked block was toggling the goal's own existence
flag**, and a cleared tag 0 removes the goal *and* makes collecting it grant
nothing. This is the collision `KILL_LOCK_TEMPLATES` discharges by construction
with its `tag: '1'`, under its own stated law — *a clear is a FLAG, so a lock on
the goal's own tag removes the GOAL* — and the weigh rows were breaking it.

⛓ MEASURED, post-sword palette, seeds 1–24 at target 6: **12 of 24 levels had a
shared tag, every one of them the goal's.** Seed 10 was the worst —
`torchpickup@32,112` sharing tag 0 with locks at (96,80), (64,80) and (128,80).
After: `t0 torchpickup · t1 · t2 · t3`, and **0 of 24 share**.

⚠ WHY IT WAS LATENT: `check()` runs at BUILD and a generated level is solved in
ONE visit, so the goal is built before any lock opens. `pendingEarnedClears` is
banked and cashed *in the transition path* — a one-screen level never
transitions. It bites on a rebuild or a re-entry.

⛔ **`tag: '-1'` IS NOT THE FIX — it is a different bug.** With no guard on the
write, `setPersistence(-1, …)` resolves through `i * 30 + j` to
`(level - 1) * 30 + 29`, **the previous level's last slot** — the out-of-band
family `outOfBandLedger` exists to model.

#### The allocator is the RECORD, because the anchor cannot serve a tag

`placementGroupId` is `tx * height + ty + 1` and reaches ~89 in a 10x10 room; a
tag is bounded by `Game.tagsPerLevel = 30`. ⚠ And overflow does not error — the
game indexes one flat array as `level * 30 + tag` with no bounds check, so a tag
of 30 writes the NEXT LEVEL'S first slot. **A modulo would have been worse than
useless**: it would collide two placements silently, which is the defect.

⇒ `placementTagId(record, reserved)` = the lowest non-negative integer below
`TAGS_PER_LEVEL` that no entity in the record already uses. Same three
properties as the group's allocator, by a different route: `place` stays
**PURE**; a rejected candidate never enters the record so **no rejection history
leaks**; and the ids come out **contiguous and small**, which is what a 30-slot
budget needs. The used set is read with the engine's own `tagOf` (a missing
attribute is −1; `FORCED_TAG` decides four classes outright) rather than by
re-reading `attrs.tag`.

Exhaustion **refuses by name**. The ceiling is real, not theoretical: the
vanilla game's busiest room (`Dungeon4/2.oel`) uses 23 distinct tags of 30.

⚠ The kill-lock pair KEEPS its literal `tag: '1'`, measured rather than
overlooked: its tag IS read (`Lock.check()` despawns only when `tSet < 0`), so
two placements would collide — but the post-sword sweep keeps a kill template in
ONE seed of 24 and **never two**, so it is LATENT. Changing it would move the
discharge-existence records for no measured gain. A test pins the state of
affairs so the day a second one can be kept, someone must come back.

#### ⛔⛔ A FINDING THAT IS NOT THIS SLICE'S: THE GENERATOR IS NOT DETERMINISTIC UNDER LOAD

Chasing an abort that appeared in one sweep and not another, **seed 20 was run
five times on IDENTICAL code: 3 produced a six-obstacle level, 2 threw
`GenerationAborted(PhysicsV2Error)`** — as machine load climbed past 10.

The mechanism is `procgenOracle`'s own budget, and it is not the abort itself:

```js
if (ms > b.wallClockMs) { return { verdict: BUDGET_EXHAUSTED, budgetKind: 'wall-clock', … } }
```

**A solve that SUCCEEDED is converted to a rejection when it takes more than
5000 ms of wall clock** (`procgenOracle:503`; the same test at :454 for the
thrown arm). So under load a keep flips to a revert, a different template lands
at the next step, and the run reaches a different candidate — one of which
throws. The abort is downstream of a wall-clock-dependent trajectory.

⇒ ⚖ **"same seed, same level" holds only while no solve straddles the 5000 ms
budget.** `wallClockMs: 5000` is flagged in its own docblock as *"a CHOSEN
ceiling, not a measured limit"*, and this is the cost of that choice. It is
PRE-EXISTING and nothing here caused it, but it bears on how every number in
this arc was taken:

- abort COUNTS ("1 of 72", "6 of 72", and this slice's own before/after) are
  machine-dependent and should be re-read as approximate;
- the byte-equality gates (`watchGenerate.test.js`, `check-seedling-editor-generate`)
  compare two runs that could each straddle the budget;
- ⛓ the structural claims are NOT affected: *12 of 24 levels shared a tag → 0*
  is a property of the palette, not of the timing.

⛔ NOT FIXED, because the cure is a design decision rather than a defect repair:
a tick-bounded budget would be deterministic and would change what the loop
accepts; raising the ceiling only moves the straddle. ⚖ Recorded for the user.

##### ⛓⛓ RESOLVED 2026-08-14 — and three of the paragraphs above are now WRONG

The user took the design decision (*"make procgen deterministic, by making it
tick based, not wall clock based"*) and **`wallClockMs` is gone from
`DEFAULT_BUDGET` entirely.** `assertBudget` refuses a budget still carrying the
field rather than ignoring it. The section above is kept as the record of how
the defect was found; ⚠ **read the following before acting on any of it:**

- **The seed-20 repro no longer reproduces**, and not only because of the fix —
  it did not reproduce *before* the fix either. Five pre-fix runs of `--seeds=20`
  were byte-identical at load 55; seed 20's slowest solve on a quiet box is
  **217 ms**, nowhere near the 5,000 ms budget. Whatever made it straddle in
  August is gone from the current tree. ⇒ this is the "measured limitations
  EXPIRE" trap in its own habitat: **the repro in a finding ages faster than the
  finding.** The seed that did reproduce, at load ~100 on 8 cores, is **9**.
- **The failure was worse than "one of which throws".** Pre-fix, `--seeds=9`
  failed 5 runs of 5 with the SKELETON solve — the loop's own control arm,
  solvable by construction — taking 5,810–8,334 ms, being reclassified, and
  `levelGenerator`'s skeleton guard then reporting *"a defect in the room
  builder"*. That is `LevelGeneratorError`, not `GenerationAborted`, so it also
  escaped the exporter's abort handling and crashed the process outright.
- **"A tick-bounded budget would change what the loop accepts" was the natural
  reading and it was wrong.** Measured over 326 solves / 40 seeds: nothing
  replaced the clock, because nothing needed to. Max *total* ticks was **800**,
  against a ~5,360 tick analogue of the old provenance; `maxTicksPerTarget` was
  already binding (4 of the sweep's 5 `BUDGET_EXHAUSTED` verdicts). What changed
  is only that a solve which SUCCEEDS is now kept.

⚠ The bullets above about this arc's OWN numbers still stand as written: abort
counts taken before 2026-08-14 remain machine-dependent and approximate, and the
structural claims remain unaffected. Full measurement set:
[`CC/docs/plans/procgen-deterministic-budget.md`](../../../../CC/docs/plans/procgen-deterministic-budget.md).

#### Gates

`npx vitest run frontend/modules/seedlingDemo/` **3701/3701** (3692 + 9 new,
mutation-checked: resolving the tag slot to `'0'` fails the privacy test and the
other 52 pass); all **11** `check-seedling-editor-*.mjs` PASS; the R8 battery
`--check` still hashes to `1fedb0ab35b7cd74accecf0345bdc893`.

#### ⚠ Two BOUNDS on the two allocators, from Phase 1's entity audit (2026-08-13)

The external-level-sets Phase 1 audit (plan §8, `a11813f53`) read 151 entity
classes by name and turned up two facts that bound the allocators shipped
above. **Neither is a live defect** — the palette places only `arrowtrap`,
`button`, `lock`, `pushableblock` and `spinner` (checked), so neither class can
appear in a generated level today. Both are recorded because the allocator that
meets them would be silently wrong.

1. ⛔ **`tset` AND `tag` ARE ONE NAMESPACE ACROSS ROOMS.**
   `Puzzlements/ButtonRoom.as:93` is `Game.setPersistence(t, persist, room)` —
   it passes its **`tset`** as the **TAG** in the target room, with the author's
   own comment on the line. ⇒ `placementGroupId`'s ids, which reach ~89 in a
   10x10 room, are only safe while nothing carries them into a persistence
   index, where the ceiling is 30 and overflow writes the next level's row. A
   `buttonroom` in the palette would need the group allocator bounded by
   `TAGS_PER_LEVEL`, not merely positive.
2. ⛔ **`FinalBoss` CONSUMES `tag` AND `tag + 1`** (`Enemies/FinalBoss.as:222`,
   `Game.setPersistence(tag+1, false)`). `placementTagId` hands out the lowest
   FREE slot and reserves exactly one, so it would give a FinalBoss a tag whose
   neighbour is already somebody's. A template placing one needs `tags: 2` —
   which `assertTagSlot` currently REFUSES by name, so it would arrive as a
   failing assertion rather than as a corrupted flag. That refusal is the
   correct behaviour and is why the count is checked rather than assumed.

⚠ And a denominator correction to §"Occupancy" above: the tag census was taken
over **all 120 `.oel` files in the tree, but only 116 are `[Embed]`ed** into
`Game.levels` — four are not part of the game. The busiest-room figure is
unaffected (`Dungeon4/2.oel` is embedded; 23 distinct tags, max 24), but the
"120" framing was four files wide.

#### ⚠ `FinalBoss`'s `tag+1` is DELIBERATELY somebody else's (2026-08-13)

The bound recorded just above says `placementTagId` "would give a FinalBoss a
tag whose neighbour is already somebody's." That is right about the
**generator** and it is worth keeping. It is easy to read as something stronger
that is **wrong about authored data**, so: the pairing is a FEATURE, not a
collision.

Measured while freezing the external-level-set schema (plan
`seedling-external-level-sets.md` §9.3). `End/Boss.oel` — the only room in the
game with a `<finalboss>` — is:

```xml
<finalboss x="64" y="96" tag="0"/>
<rocklock x="112" y="16" tset="0" tag="1"/>
```

`FinalBoss.endAnim()` clears `tag` **and** `tag+1` (`FinalBoss.as:222`), and
`tag+1` is the rocklock. **Killing the boss is what opens the lock.** Room 112
carries exactly tags `[0, 1]`.

⇒ a validator rule of the obvious shape — *"`tag+1` must be free"* — **refuses
vanilla**, which is the level-set loader's whole anti-rot property failing on
its first day. The rule that survives is:

- **error** if `tag + 1 >= TAGS_PER_LEVEL`, because that writes the NEXT room's
  persistence row;
- **warning** if nothing in the room carries `tag + 1`, because then the boss's
  second clear controls nothing.

The generator-side statement is untouched: an allocator that hands `tag+1` to an
*unrelated* entity is still wrong, and `assertTagSlot` refusing `tags: 2` by
name is still the correct arrival. What changed is only that a `tag`/`tag+1`
pair in a hand-authored room is not evidence of a defect.

⛓ **The general lesson, which is not about Seedling.** This was caught because
the vanilla 116 are a committed fixture that the schema must satisfy. A rule
written from the source citation alone would have shipped; building the real
data as a test case is what falsified it. See also §9.3 of that plan.

---

## The GENERATE-mode UI arc — the catalogue, parameterized templates, and the directed attempt (TOOLING; CLOSED 2026-08-15)

> ⚠ **MIXED (2026-08-18)** — *The URL parameters, whole and current*, *arc 3, slice 5b*, *⚖ What a URL is FOR* and
> *The standing laws* are kept CURRENT and were last updated by arc 3 slices 5a/5b. ⛓ *The URL parameters* is a
> POINTER since PROCGEN DOCS P3a: its table is GENERATED and lives on the reference page. Everything else in this § is
> the arc's own close and describes a roster and a keep-policy that have since changed: the three door templates
> retired (arc 3 slice 4c), `PREFER_DISCHARGE` is OFF on Seedling and the `<d|s>` URL letter is gone. Current
> shape: § *The procgen ELEMENTS design*.

⚖ Ruled by the user on 2026-08-14, after the procgen PoC arc and BEFORE the
constructive mode: `watch.html`'s GENERATE arm grows from *"run the loop over
the whole palette"* into **a catalogue of generatable things** — *"a list of
things that can be generated, and have a way to set any relevant parameters, and
have a button to make the generator attempt to generate that specific thing"* —
and the palette migrates from frozen tile arrangements to **parameterized
templates**: *"a collection of functions that each generate a coherent set of
features for the map, instead of a collection of predefined arrangements of
tiles."* Six slices, one mechanism family each.

### What the arm is now

- **A palette template is a FUNCTION.**
  `{name, family, params: [{key, domain, default, why}], instantiate(rng, overrides)}`,
  built by ONE constructor (`procgenPalette.defineTemplate`). `instantiate`
  returns a **CONCRETE ROW** — exactly the old frozen-row shape — stamped with
  `params` (the VALUES) and `instance` (the derived label,
  `wall-segment(ori=v,len=4)`). ⛔ The concrete row is the OUTPUT contract:
  `anchorsFor`, `legalAt`, `place`, the oracle, the pin union and both sentinel
  slots consume one and never learn the migration happened. Wave 1 =
  orientation, wall length, pool/pit w×h, plain-door gap; **86 instantiations
  are walked through `assertPalette` at module load.** ⚠ `params` means the
  SCHEMA ARRAY on a base and the VALUES OBJECT on an instance, and both shapes
  are asserted.
- **The loop searches for an anchor.** `model.anchorsFor(record, template, rng,
  limit)` replaced `anchorFor`: ONE shuffle whatever the limit is, so the
  default of 1 is byte-inert BY CONSTRUCTION. Every anchor tested is a trace row
  (`anchorTry` / `anchorsOffered`), and the pane labels them `6.1a2`.
- **VERB 1 — RESTRICT.** `procgenPalette.restrictPalette(palette, {axis,
  names})` returns a palette of the SAME SHAPE, so verb 1 is an ARGUMENT and the
  loop core is untouched. The catalogue view is DATA (`catalogueRows`), grouped
  by family, and the EXCLUDED rows are IN it — greyed, with `cause` + `measured`
  + `wouldNeed` VERBATIM and no input on them.
- **VERB 2 — THE DIRECTED ATTEMPT.** `levelGenerator.directedAttempt` places ONE
  named template on the record ON SCREEN. ⚖ The user's ruling: *verb 2 PREFERS
  DISCHARGE; the free loop keeps FIRST-SOLVED.* ⛔ ONE walk (`walkAnchors`) with
  a `keepPolicy`; `generateLevel` passes NONE, so the free ladder is byte-inert
  by construction and measured 48/48. The readout says WHICH KIND of keep it
  was, and `KEPT_KIND` has THREE members — `discharged` / `solved-only` /
  `solved-no-verb` — because a wall has no verb to fall short of.
- **CLICK-TO-ANCHOR.** ⚖ Ruling 6: *manual editing splits at the TILE boundary.*
  AT… on a catalogue row arms a canvas click, and the clicked TILE becomes the
  explicit anchor of ONE directed attempt at that cell. ⛔ NOT tile editing — the
  unit is still the template. `seedlingModel.refusalAt` adjudicates the cell
  BEFORE any solve, and `legalAt` is DERIVED from it so the loop's boolean and
  the page's sentence are one adjudication.
- **The level is LADDER + DIRECTIVES**, and the URL says so.

### The URL parameters, whole and current

⛔ **THIS § IS A POINTER NOW.** The table it held was checked field by field
against `readGenerateParams` at the arc's close, and the same list sat in
`watch.html`'s own header docblock — three copies of one fact, kept in step by
hand, which is the shape PROCGEN DOCS P3a exists to end.

⛓⛓⛓ **THE TABLE THAT WAS HERE IS GENERATED NOW** (PROCGEN DOCS · P3a,
2026-08-18). It listed every parameter, its default and its delete-at-default
by hand, checked field by field against `readGenerateParams` — which is exactly
the shape a reader cannot trust a week later. It lives at

> **<https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html#section-url>**
> · locally `http://localhost:8000/frontend/modules/procgenDocs/reference.html`

— one block per parameter, with a row per PAGE, generated from
[`procgenCore/urlParams.js`](../../../../frontend/modules/procgenCore/urlParams.js)
and the two pages' own readers and writers by
[`scripts/procgen/generate-procgen-reference.mjs`](../../../../scripts/procgen/generate-procgen-reference.mjs).
⛔ **Do not re-type it here.** Every value there is the code's own answer: a
DEFAULT is what the reader returns on an empty search, *absent is the default*
is what the writer emits sitting at its defaults, and a RETIRED parameter's
refusal is the refusal RUN and caught. The gate is
`node scripts/procgen/generate-procgen-reference.mjs --check` — regenerate = no
diff — so the table cannot drift from the code the way this one could.

⛓⛓⛓ **THE PHASE LADDER AND THE OVERLAYS ARE *NOT* URL PARAMETERS** (arc 3,
slice 5a). `#genPhase` (the generation phase on screen), `#genLayer` (the
`off → sites → elements → areas → all` overlay) and the per-phase FACT
selection are **VIEW settings**: they re-DRAW, they never regenerate, they do
not touch the ladder, and none of them is written to the bar — a phase index in
a link would name a picture rather than a run, and a run is what a link is for.

`generate-seedling-level.mjs` carries the same set as flags
(`--anchor-tries=`, `--families=`, `--templates=`, `--directed=`), parsed by the
SAME functions, so the two runtimes cannot disagree about what a construction is.

### arc 3, slice 5b — the DEMO CATALOGUE, and the four intermediate results

⚖ The user's requirement of 2026-08-17 (generation review §4 item 6):
*"interactive DEMONSTRATIONS of every demonstrable feature — URL + how to run +
what is happening"*. It is a TRACKED data module —
`frontend/modules/procgenDocs/demos.js`, rendered at
[**the catalogue page**](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html)
and pointed at by [docs/json/developer/procgen/demos.md](./demos.md) — with one
entry per feature of BOTH lab pages, each carrying its page, the URL the page's
own writer spells, the CLI command from a REPRODUCE block, which PHASE to step
to, which FACT LINES to tick, which overlay layer, and the ONE claim it asserts.
⛔ Every link in it is LOADED by `scripts/procgen/check-procgen-demos.mjs`,
which IMPORTS the same module, and every claim asserted off the page's readout,
so a catalogue entry cannot rot quietly — and the row loads the catalogue PAGE
too, so a rendering bug is a catalogue failure rather than something a reader
discovers.

⛓ The same slice made four of §16.5's five uncarried intermediate results
PAINTABLE: the door law's two floods (the START side and the GOAL side with the
door walled, on the `composite` row where the law is actually asked of the
committed placement), the LEVEL-n floods and the goal's VESTIBULE on
`realisation` — which now writes a row even when it REFUSES, because the flood
that disagreed is exactly the picture the refusal is about — the ON-CONNECTOR
candidate FUNNEL (offered ⊇ reached-the-law ⊇ passed-it, carried out of the
construct's own calls and never re-derived), and the CERTIFICATION solve's
ROUTE, whose gaps are counted and named rather than bridged.

### ⚖ What a URL is FOR (the URL diet — constructive-mode slice 12, 2026-08-15)

⚖ **RULED by the user**: a URL names **the launch parameters a person types**,
and nothing else. That list is `source · seed · biome · count/tries/k/anchortries
· families|templates · skeleton;params · tickbudget` (the maze adds
`width/height/expansions`) `· gen`. ⛓ **Arc 3, slice 5a added
`elements · areas · require` to the SEEDLING list too** — they are launch
parameters by the same test (a person types them, and the run is what they
name), and the page now READS all three rather than copying them forward.

The **PAYLOAD is the construction**: `directives` + `edits`, in that order,
replayed by `?gen=` and by the host's `procgenLab:load` on **both** lab pages.
So the identity of a level that was directed or edited is a FILE, and the page
says so where it states the identity — *"⚠ the URL is NOT a reproduction of this
construction — it names the LADDER alone; the PAYLOAD is"*.

- ⛔ `?directed=` **REFUSES BY NAME** on both pages (it does not silently open
  the ladder — that would be a link that means something other than it says),
  and the refusal carries the way in.
- ⛔ The one writer **never emits it** and DELETES a stale one, so what a page
  writes is always what it can read.
- ⛓ **`--directed=` STAYS on the CLI.** A flag is a different surface: it is how
  a script or a browser row LAUNCHES a directed run in node, and it is what
  produces the payloads `?gen=` replays. One grammar, three channels — the CLI
  flag, the ATTEMPT/AT… buttons, and `payload.directives` — with the address bar
  simply no longer among them.
- ⛓ Nothing about the directive GRAMMAR, the directive OBJECT, `directiveSeed`'s
  index-as-salt, or the payload shape changed. A payload's `directives` array
  order IS the index, so no recorded construction was re-indexed.

### The standing laws

- ⛔ **ONE WRITER.** `watchGenerate.writeGenerateParams` is the only thing that
  writes a generate parameter, called from `show()` alone, and it is the inverse
  of `readGenerateParams`. **Every new control lands WITH its parameter in it.**
- ⛔ **THE WRITER REFUSES WHAT THE READER WOULD REFUSE.** A non-integer, an
  unknown family, a directive missing a parameter value, an explicit anchor
  beside a bound above 1 — each refuses on the way OUT as well as IN. A URL this
  page cannot reload must not be writable.
- ⛔ **ONE RECONSTRUCTION.** `procgenPalette.instantiateKept` rebuilds an
  instance from `{template, params}` for BOTH pin unions and passes NO rng, so a
  dropped parameter REFUSES instead of silently becoming the default. Inside the
  loop the concrete rows are RETAINED at keep time (`keptRows`) rather than
  rebuilt — `levelGenerator.js` imports nothing.
- ⛔ **ONE DISCHARGE TEST.** `procgenPalette`'s `CLEARER_STRATEGY` / `verbOf` /
  `dischargesVerb`, which the batch, both sweeps and the page all ask.
- ⛔ **ONE ADJUDICATION OF LEGALITY.** `seedlingModel.refusalAt`; `legalAt` and
  `isFree` are derived from it. ⛓ **The rule ORDER is now footprint ∪ clearance
  → CARVE → SEAL → DOOR** (arc 3 slice 2): `laneClear` left with `arrow-lane`
  and `doorClear` was replaced by the one flood-based DOOR LAW. The order stays
  load-bearing for the same reason it always was — the footprint walk is what
  rejects the border ring, and every rule after it assumes an in-bounds
  record — plus one new one: the SEAL check's answer IS the door law's open
  half, so the law runs one flood rather than two.
- ⛔ **THE PAGE NEVER WRITES `fixtures/`.** A generated or directed level lives
  in the tab, the save box and the Download button.
- ⛔ **RAW TRUTH.** Refusals ride VERBATIM; the four attempt outcomes are never
  blurred; SATURATED says so; a `?gen=` divergence is reported, never smoothed.
- ⚠ **A ladder RESETS when its identity changes** — a new seed, a new biome, or
  any directive (the prefix property does not cross one) — and the page says so
  BEFORE the press.

### The three findings worth carrying off the arc

1. **A ROUND-TRIP FIXED POINT TESTS SELF-CONSISTENCY, NEVER CORRECTNESS.** A
   writer mutated to emit each parameter's declared DEFAULT round-tripped
   perfectly: write → read → write agrees with itself for ever when the error is
   CONSTANT. The same check caught a writer defect one slice earlier only
   because THAT one was POSITIONAL (a `delete`-then-`set` moved the parameter in
   the string). ⇒ keep the fixed point for DRIFT, but never let it be the only
   gate on a VALUE — pair it with an INDEPENDENTLY produced answer.
2. **A SEARCH BUYS WHAT ITS STOPPING RULE ASKS FOR, WHICH MAY NOT BE WHAT YOU
   WANTED.** The anchor search recovers KEEPS (`ori=v` 11→12 of 12 seeds at
   N=2) and leaves DISCHARGES flat (1→2, unchanged out to every legal anchor),
   because **the first legal anchor SOLVES at 23 of 24 (value, seed) rows** —
   a first-SOLVE stop never walks to the discharging one. Placeability, not
   informativeness.
3. **MEASURE WHAT THE SUBJECT ADMITS BEFORE SIZING A KNOB.** The directed walk's
   bound was estimated at *"~12–90 solves"*; measured, the room offers a door
   template **at most 7** legal anchors when empty and **at most 4** once three
   obstacles are placed (a third of rows: ZERO), because the template declares
   its slide path as `clearance`. ⇒ the ROOM bounded the walk, not the bound.
   And the sharper half: on a mid-ladder record NOT ONE of 36 rows had
   `firstSolved < firstDischarged`, so the shipped prefer-discharge preference
   is observably **vacuous on a filled room** — recorded with its measurement,
   ⚖ left as shipped by the user's ruling.

### What it hands on

- **The constructive mode** (all-WALL start, carve, a new `reach-tile` goal) is
  the next arc, paired with rule-directed generation. This arc's two
  don't-preclude obligations are discharged for the payload — a
  `DEFAULT_SKELETON` block rides on every state and `agreementWithPayload`
  compares it with a both-sides default — and were open for the URL. ⛓ Both are
  now closed by the constructive arc's slice 5 (below): `?skeleton=` landed in
  the ONE reader and the ONE writer together, and the block's spelling moved
  from `empty-bordered` to `empty`.
- **Wave 2** — the weigh/kill door LANE offsets, each owing its own re-sweep.
- **Free tile / object editing** — its own arc; this one stopped at the TEMPLATE
  boundary on purpose.
- ⛔ **The CHAIN** (a bent block-push path) stays SOLVER-GATED and unbuilt: the
  seam can EXPRESS it, the oracle cannot CERTIFY it.
- **Multi-screen rooms** stay a named horizon item.

### Where the arc's own findings live

The full record is `NewDocs/plans/seedling-generate-ui-kickoff.md` (⚠ `NewDocs/`
is deliberately gitignored — working machine only): §1 the user's settled
rulings, §3 the design, §7 the exit criteria; then one as-built per slice — §8
the URL round trip, §9 the parameterized-template seam and wave 1, §10 the pin
union / the anchor search / the kill-lock tag blast radius, §11 the catalogue
and verb 1, §12 verb 2 the directed attempt, and **§13 slice 6 (click-to-anchor)
together with the ARC CLOSE — §13.2 the exit criteria answered one by one, and
§13.3 the consolidated residue the next arcs inherit.**

---

## The constructive-mode arc — the loop core moves out, and the maze becomes its second substrate (⛓ CLOSED 2026-08-16 @ `244e6df0a`; opened 2026-08-15)

> ⚠ **HISTORICAL for the GENERATOR (2026-08-18)** — the arc's own subject (the loop core in `procgenCore/`, the
> maze as its second substrate, `?skeleton=`, free editing, the URL diet) is current and load-bearing. Its
> statements about what Seedling's pass 2 KEEPS are not: they were measured before ⚖ design ruling 24 made area
> pass 1's job, before the door law, and before the door templates retired. Read the per-slice banners below and
> then § *The procgen ELEMENTS design*.

**⛓ CLOSED 2026-08-16.** Nine slices shipped (`067746b9a`..`244e6df0a`, shared
submodule @ `917e4de`): the shared maze algorithms · the loop core in
`procgenCore/` with the maze as its second binding · the maze lab page ·
both lab pages hosted in the frontend (`procgenLabPanel`) · the carved
skeleton kinds (`?skeleton=<kind>[;k=v]`, the maze biome names) · the yield
table + the connectivity pre-check at every kind · chambers + kind params ·
Seedling free editing · the URL diet (`?directed=` gone; the payload is the
construction). ⚖ Seedling's pass 2 under the two-pass system (corridor
doors, `reach-cell`, Seedling rule-directed) is the PROCGEN ELEMENTS
programme's (queue §5g) by ruling. Residue and the exit criteria answered:
kickoff §18 (working machine).

The generator gains its **second mode** (a true two-pass Cloudberry: start from a
room of WALL, carve a path to the goal, then run the existing keep-or-revert loop
over the carved skeleton) and its **second substrate** (the maze,
`frontend/modules/mazeRoom/`, whose exact BFS oracle makes it the place every
mode-level decision is designed and tested first). Design record:
`NewDocs/plans/seedling-constructive-mode-kickoff.md` (⚠ `NewDocs/` is
gitignored — working machine only); queue entry
`CC/docs/plans/fable-to-opus-handoff-2026-07.md` §5f.

**Slice 1** moved the pure wall backends and the tile vocabulary into the shared
submodule — see `maze.md`, "Where the backends live, and the grid contract".

**Slice 2 moved the loop core.** `levelGenerator.js` no longer lives under
`seedlingDemo/`: the loop, its bounds, its cost model and its verdict vocabulary
are now `frontend/modules/procgenCore/`, beside the template contract
(`defineTemplate` and the parameter draw) and `ProcgenRng` (whose bit-mixing
source is injected — Seedling passes the game's own `SeedlingRng`, the maze
passes `shared/rng.js`'s mulberry32). This spends the PoC arc's §1.7 provision
verbatim: *when a second substrate exists and can argue about the interface, the
core moves and the bindings stay.* **The Seedling bindings did not move and
neither did any Seedling level** — the move was gated on the R8 battery
(`1fedb0ab…`, exit 1), the acceptance batch's ten per-level payload md5s, the
generated-set round trip, the 126-check browser row and the whole `seedlingDemo`
vitest, all byte-identical across it. The one thing the maze forced was a
shared `VERDICT`: two oracles must return the same word, and the maze may not
import `seedlingDemo/procgenOracle.js`, so the three classes are declared in
`procgenCore/levelGenerator.js` (the file that compares against them) and
re-exported from `procgenOracle.js` under the name every Seedling reader
already uses. The maze half is in `maze.md`, "The maze as the second substrate
on the procgen loop".

**Slice 3 gave the maze a lab page**, and in doing so moved out of
`seedlingDemo/` everything about `watch.html` that was never Seedling: the URL
grammar (`procgenCore/urlParams.js` — the bounds, the roster's both-present /
empty refusals and its scoped delete, the `run`+`count` step encoding, the whole
`?directed=` grammar and its two salted streams), the pane vocabulary
(`procgenCore/labView.js` — `generationRows`, `describeKeptKind`, the two cost
models, `tileAtPoint`), the roster machinery (`procgenCore/paletteRoster.js` —
`normalizeRoster` / `restrictPalette` / `catalogueRows`, which slice 2 had
recorded as staying on a line that stopped being true the moment a second page
existed) and the page lifetime (`procgenCore/pageLifetime.js`). Every one is
re-exported under the path Seedling callers already use, and every Seedling
artifact was byte-identical across the lift. What stayed and why is in each
moved file's docblock. The maze half — the page, its three modes, the
`drawWorld` extraction and its `view` contract — is in `maze.md`, "The maze lab
page".

**Slice 4 put both lab pages inside the frontend.** A new `procgenLabPanel`
Golden Layout panel mounts each substrate's page in an iframe and talks to it
over the existing `iframeAdapter` bridge in the `procgenLab:` vocabulary, which
lives **once** in `procgenCore/labProtocol.js`; the in-page halves
(`mazeRoom/mazeLabBridge.js`, `seedlingDemo/watchBridge.js`) are dynamically
imported and only under `?iframeId=`, so a standalone load fetches neither.
watch.html gained ONE readout for it — `window.__watch`, a projection of the
four `__editorX` objects the page already writes, plus an `identity` field on
`__editorGenerate` carrying `describeState`'s own string. ⚠ **watch.html has no
level-payload upload box**: `?gen=` is the only reconstruction path a generated
payload has ever had (the textareas are for TAPES and for boot BLOCKS), so a
host `load` hands the payload object to `runGenerate` where the fetch would have
produced it and the whole `?gen=` comparison runs unchanged. Panel README:
`frontend/modules/procgenLabPanel/README.md`.

### Slice 5 — the CARVED SKELETON KINDS, and `?skeleton=`

> ⚠ **HISTORICAL in one respect (2026-08-18)** — the kinds and the `?skeleton=<kind>[;k=v]` grammar are current,
> but Seedling's five carved TREE kinds now DEFAULT to `chambers = 1` (⚖ user, 2026-08-17; arc 3 slice 4b), so an
> old `?skeleton=winding` link builds a different room and the page writes `winding;chambers=1`. The "0 kept over
> 24 attempts" numbers here are bare-kind numbers and were the argument FOR that default.

**The second mode's first half is live in both substrates.** ⚖ Ruling 2 —
*"reuse the maze algorithms, and keep the naming consistent"* — is now literal:
the constructive skeleton kinds ARE the maze biome names, from ONE table in
`procgenCore/skeletonKinds.js` that `mazeRoomBiomeLibrary.js` re-exports. (The
table had to MOVE rather than be re-exported from a neutral file, because
`seedlingDemo/` may not import `mazeRoom/` and a re-export still imports what it
re-exports.) The kinds, what each carves, and the new `winding` are in
`maze.md`, "Biomes and wall backends".

**What the Seedling binding does with a kind.** `seedlingModel({seed, skeleton:
{kind}})` builds a plain `gridTiles.js` grid the size of the room, hands it to
the kind's backend and post-processors under the model's own `roomRng`, and
paints the resulting floor cells back as `ground` over an
`emptyLevel({floor:'wall'})` — ⚖ ruling 1's *"a map filled with walls"* as a
starting state rather than a paint order. Three facts about that grid are
load-bearing:

- **The ring is handed in already walled.** The tree backends would wall it
  themselves, but `recursive_division` starts from the all-floor grid and only
  ADDS walls — on a bare grid it would return a room whose border is floor, and
  `emptyLevel`'s own docblock says why that is not a room. Checked on the way
  out, not assumed.
- **The lattice is 4×4 cells at odd coordinates on a 10×10 room**, so the tree
  kinds never use column 8 or row 8 — 7×7 effective. A goal drawn into that
  strip is not stranded: `connectFixedTiles` L-carves it to the nearest cell.
- **`repairConnectivity` is not called from the binding** for any kind: the tree
  backends are connected by construction and `recursive_division` calls it
  inside its own `run`. The honest net for a skeleton that does not solve is the
  LOOP's — `generateLevel` refuses to start, by name, with the oracle's text.

**⛓ THE DRAW ORDER IS THE IDENTITY.** The goal cell is the room stream's FIRST
draw and the carve's draws come after it, in both bindings — so *the goal of
seed s under kind K is the goal of seed s under `empty`*, and the constructive
kinds do not expire the empty-room seed→level pairs. The carve itself runs ONCE,
at model construction, so `skeleton()` is a pure accessor: a carve per call
would hand out a different room each time from one seed.

**⛔ At the default kind nothing carves.** `empty` is not "the `empty` backend";
it is the open bordered room this binding has always built, and both bindings
short-circuit it. So the byte-identity promise is a code path that never
executes rather than a comparison that happens to pass — measured anyway: seeds
1..40 × both palettes at the default bounds are byte-identical, the R8 battery
is `1fedb0ab…` unchanged, and the generated-set round trip is unchanged.

**The rename, and what it cost.** `DEFAULT_SKELETON.kind` was `empty-bordered`
here and `open-room` on the maze lab page; both are now `empty` — the maze
biome table's own name for the open room, and ⚖ ruling 2 says there is one
vocabulary. The Seedling room keeps its wall ring; the ring is a fact about
`emptyLevel`, not about the kind. ⚠ An OLD payload spelling `empty-bordered`
now DIVERGES BY NAME in `agreementWithPayload` — that is the check working, not
a shim to write. Measured cost, whole: two constants, two test assertions, one
docs line, and the ten per-level payload md5s the acceptance batch prints (the
`skeleton` field is in the payload; the LEVELS, the kept lists, the tick counts
and every requirements verdict are unchanged — proved by diffing a payload with
the kind string normalised away). Nothing else in the repo carried either
spelling.

**The URL.** `?skeleton=<kind>` lives in the ONE reader and the ONE writer
(`procgenCore/urlParams.js`), for both pages. Absent means `empty`; the writer
DELETES the parameter at the default rather than writing it (and rewrites in
place, so a kind change does not move the parameter to the end of the bar — the
delete-then-set trap `?families=` paid for once). A kind this binding cannot run
refuses at READ time with the list it does offer; an unknown kind refuses with
the whole vocabulary; a `;`-separated parameter clause refuses too, because no
kind takes parameters yet and truncating one to its head would build a room the
link does not describe. Both generate forms carry a **skeleton selector** —
`classic` and `corridor` are listed DISABLED with their reason rather than
hidden — and changing it RESETS the ladder to the skeleton and says so, because
the room a ladder is built in is part of the level's identity exactly as the
seed is. Both CLIs take `--skeleton=`.

**What it measures.** `scripts/procgen/census-skeleton-kinds.mjs` (seeds 1..24,
both bindings): **every kind solves at every seed — 0 refused at step 0.** The
number worth carrying is the FLOOR fraction, which is what pass 2 has to work
with: 100% at `empty`, ~70% at `rooms`, ~50% at the tree kinds, **25% at
`winding`** on Seedling. ⛔ That is NOT the yield table — pass 2 never runs
there. Pass 2 over a carved corridor is Probe 2's measurement and it is now
reproducible end to end: `generate-seedling-level.mjs --seed=3 --count=1
--skeleton=winding` SATURATES with 0 kept over 24 attempts, while the same call
on the maze keeps doors and reverts walls. That asymmetry is slice 6's subject.

### Slice 6 — the YIELD TABLE, and the CONNECTIVITY PRE-CHECK

> ⚠ **HISTORICAL (2026-08-18)** — the yield table and the pre-check are current; the RULE ORDER and the door
> families this § names are not. `laneClear` left with `arrow-lane` (arc 3 slice 1) and `doorClear` was replaced
> by ONE flood-based DOOR LAW (arc 3 slice 2); the order is now footprint/clearance → CARVE → SEAL → DOOR. The
> cost headline ("every expensive Seedling solve is an `arrow-lane` REVERT, 77.8 s") is the measurement that
> retired the template — it no longer describes a shipped roster.

**The instrument first.** `scripts/procgen/sweep-yield-table.mjs` is the arc's
one yield instrument, for both substrates
(`--substrate=maze|seedling`), driving the BINDINGS in process. Axes: every kind
the binding offers × room size (maze `11x11,7x7,5x5,4x4` — §9.6's ladder, because
the 11×11 default reverts nothing and a table on it alone would call the palette
fine about a room too big to test it; Seedling's room is fixed at one screen, so
its second axis is the kind's FLOOR FRACTION, printed as a column) × seeds. Per
cell it records the stop reason, the per-TEMPLATE outcome tally, the REVERT
reasons verbatim, the solve count, and wall time. ⛔ **The wall-clock columns are
EVIDENCE and decide nothing**; the one clock that acts is the sweep's own
per-cell budget, which is enforced by running **each cell in its own child
process** (a Seedling solve is synchronous and uninterruptible, so an in-process
budget would report a cell's cost only after paying it in full) and is printed in
the header and in the denominator line. A cell that throws is classified by NAME
at the harness level — never by widening the oracle's catch.

**The lever.** A model-side legality rule in `refusalAt` on BOTH bindings, over
ONE flood (`procgenCore/gridFlood.js`): *a candidate whose TERRAIN writes
disconnect the start from the goal is refused BY NAME, before any solve.*
Seedling floods over `ground` only — `wall`, `water` and `pit` all block, because
water lands in `world.lethalTerrainTiles` and pit in `world.pitTiles` and a route
crosses neither; the maze floods over `TILE_FLOOR`. It sits AFTER the
footprint/clearance walk (which is what rejects an off-room cell; a flood handed
writes outside the room would read past the rectangle — trap 255's shape) and
BEFORE `laneClear`/`doorClear`. `legalAt` stays DERIVED, so `anchorsFor` simply
stops offering sealing cells and the loop reports NO_ANCHOR; a clicked or
`?directed=`-named cell gets `ILLEGAL_PLACEMENT` with the sentence, on the page.

⛔ **SOUNDNESS BOUND: FULL-TILE TERRAIN ONLY.** Entities are ignored — a door, a
key, a pushable block, an arrow trap are the ORACLE's question, because whether
a door is passable depends on the key and that is a fact about the SEARCH. So the
rule is NECESSARY and never sufficient: sealed ⇒ certainly unsolvable ⇒ refuse;
not sealed ⇒ nothing claimed. On the maze this is measured against a COMPLETE
oracle — every candidate the rule refuses, the exact BFS also refuses.

⚖ **SLICE 6 SHIPPED IT KIND-SCOPED; SLICE 6b DROPPED THE SCOPE.** Slice 6 kept
it off at `empty` (§6.2's named default) because that is the kind every committed
seed→level pair is generated at, and measured the price of widening: **22 of the
80 `empty` pairs** (seeds 1..40 × both palettes, at the DEFAULT bounds — target
6). The user ruled on 2026-08-15, in the PROCGEN ELEMENTS design session, that it
should be widened to every kind; GENERATE-UI ruling 5 licenses exactly that
expiry. Slice 6b executed it, re-recorded the pairs and re-measured every gate
subject that moved.

⛔ **An open room seals only from ACCUMULATED terrain, never from a skeleton** —
the longest wave-1 row is `wall-segment(len=5)` against an 8×8 interior, so no
single candidate spans it. That is why slice 6's *"the `empty` room never
seals"* fixture stayed green against its own scope mutant, why the pair cost is
**count-dependent** (8 of 80 at count 3, 22 of 80 at target 6), and why the
fixture for the rule at `empty` is an accumulated record rather than a skeleton.

**BEFORE → AFTER, seeds 1..8 at count 3 / tries 4 / k 3 / anchortries 1:**

| | maze (9 kinds × 4 sizes × 8 seeds = 288 cells) | Seedling (7 kinds × 8 seeds = 56 cells) |
|---|---|---|
| sealing REVERTs on carved kinds | `wall-segment` **438 → 8** | **64 → 0** |
| total oracle solves | **1519 → 1079** (−29%) | **297 → 235** (−21%) |
| KEPT | 669 → **672** | 154 → **156** |
| cells completed | 288 → 288 | **55 → 56** |

The residue is the soundness bound doing its job: the maze's 8 surviving
`wall-segment` reverts are rooms a wall made unsolvable through an ITEM (a key
cut off from the player behind a door), which a terrain flood cannot see and must
not guess at.

**⚠⚠ THE COST HEADLINE DID NOT MOVE, AND THAT IS THE SLICE'S REAL FINDING.**
Probe 2 attributed the carved room's cost to sealing candidates. It is not: at
these bounds every expensive Seedling solve is an **`arrow-lane`** REVERT — 77.8 s
on `bushy` seed 5, 9.5 s and 8.9 s on `winding` seed 6 — refused with *"the
combat ladder is E…"*, and an arrow lane writes **no terrain at all**. The
pre-check removed 64 sealing solves and a fifth of all solves, and the mean
per-cell generation time fell 15–25% per kind, but the MAX single solve is
unchanged because it was never a sealing candidate. The expensive-refusal problem
on a corridor is an ENTITY-template problem.

**Two things the design did not predict, both improvements:**

- **A run that used to ABORT now completes.** `winding` seed 5's `water-pool` at
  (1,2) drowned the walk (`PhysicsV2Error`, the §15.5 approach-drive family) and
  killed the whole run. That candidate was a sealing one, so it is now refused
  before any solve and the cell finishes.
- **A saturated run now reaches its target.** `bushy` seed 7 went SATURATED with
  1 kept over 23 attempts → TARGET_REACHED with 3 kept over 11. Removing sealing
  anchors from the offered list leaves room inside the same `triesPerStep` budget
  for anchors that keep. Maze saturation fell 99 → 97 cells the same way. ⚠ It
  still does not make Seedling corridors yield doors: `wall-gap-block` and
  `wall-gap-lock-weigh` remain NO_ANCHOR at every carved kind (they span the
  interior), which is slices 7/8's subject.

### Slice 6b — the pre-check WIDENED to every kind, and what the pairs cost

⚖ The user's 2026-08-15 ruling, executed. The kind scope is gone from BOTH
bindings; the soundness argument is unchanged and now global (it never mentioned
the skeleton — a sealed room is unsolvable however its walls got there).

**Predicted, then measured** (`dump-seedling-kind-pairs.mjs`, `empty`, seeds
1..40 × both palettes):

| artifact | before | after |
|---|---|---|
| `empty` pairs at **count 3** (the instrument's default) | `2bfa6626…` | **8 of 80 rows move** — pre-sword 5/17/36, post-sword 3/5/14/15/31 |
| `empty` pairs at **target 6** (the DEFAULT bounds — what slice 6 measured) | `c79d05f0…` | **22 of 80 rows move**, exactly as predicted |
| CARVED pairs (6 kinds × 12 seeds × 2 palettes) | `ab77943c…` | **byte-identical** — those kinds already ran the rule |
| all NINE maze per-kind CLI roll-ups | §13.7's nine | **all nine unchanged**, `empty` included |
| `dump-maze-byteidentity` cell rows | `63779705…` | **byte-identical** (that instrument runs the maze BIOMES, not the procgen loop) |
| R8 battery `--check` | `1fedb0ab…`, exit 1 | **unchanged**, exit 1 |
| `batch-seedling-acceptance` | `fdb500f4…` | **`aaab86d2…`** — 8 of its 10 levels moved, all still accepted, all three CARRIERS still keep a `kill` template and still report *requires Progressive Sword* (STRONG) |

⛓ **THE PAIR COST IS COUNT-DEPENDENT, and that reconciles two numbers.** Slice 6
measured 22 of 80 at the default bounds; slice 7's permanent instrument defaults
to `--count=3`, where only 8 move. Both were re-measured here from a pristine
worktree at `01b5a1efc`. More steps ⇒ more accumulated terrain ⇒ more cells at
which one more candidate closes the last route.

⚠⚠ **THE ONE COST NOBODY PREDICTED: TWO RUNS THAT USED TO FINISH NOW ABORT.**
Slice 6 recorded the opposite on the carved kinds (a sealing `water-pool` refused
before the walk drowned in it, so a run that aborted now completed). At `empty`
the arrow points the other way: `post-sword` seed **31** (count 3 and 6) and seed
**20** (count 6 only) now die with `GenerationAborted` — the §15.5 approach-drive
family — because a different anchor is drawn once the sealing ones stop being
offered. Aborts over the 80 `empty` pairs: **2 → 3** at count 3, **2 → 4** at
target 6, and none was removed. ⛔ Recorded, not acted on: the acceptance batch's
skipped-seed table already treats an aborting seed as visible-and-not-chosen, and
neither seed is a batch member.

### Slice 7 — CHAMBERS, and the KIND PARAMETERS

> ⚠ **HISTORICAL (2026-08-18)** — the `chambers`/`minRoom`/`prune` knobs are current. The statements that **doors
> do NOT arrive with chambers** and that `wall-gap-block`/`wall-gap-lock-weigh` stay **0 KEPT on every carved
> kind** were TRUE of the templates and are the measurements that retired them: doors arrive now as pass-1
> ELEMENTS (guard certified 32/34, block pocket 36/36, kill gate 6/28 post-sword). "0 KEPT is slice 8's subject"
> was answered by arc 3 slices 3 / S1 / 4a / 4c instead — see § *The procgen ELEMENTS design*.

The carve side gains its first **knobs**, declared per kind on the table in
`procgenCore/skeletonKinds.js` in the SAME `[{key, domain, default, why}]` schema
a parameterized template uses, checked by the SAME
`templateContract.assertParamSchema`, and enumerated by the SAME
`enumerateValues`. Full table and spelling in `maze.md` § *Kind parameters*.

**`chambers`** is the new one and the reason for the slice: a carved room is
CORRIDOR, and every AREA template in either palette (a pool, a pit patch, a
lane) has nowhere to anchor until something widens it. It is a post-processor in
the SUBMODULE (`shared/procgen/mazeAlgorithms/postProcessors.js`) that draws `k`
centres from the floor cells and stamps a 3×3 open square on each, CLAMPED to a
`margin` the caller passes. ⛔ It is **monotone** — it only turns wall into floor
— so connectivity is preserved by construction and it needs no repair; and
`margin` is the CALLER's fact, not a default: Seedling passes 1 because its
border ring must stay wall (its binding *refuses* a carve that opens one — so a
`chambers` that ignored the margin would throw, not merely look wrong), the maze
passes 0 because it has no ring.

⛔ **A knob at its default is BYTE-INERT, not merely equivalent.** A
post-processor knob is appended to the run only when its value is off the
default, so at `chambers=0` nothing is called, no draw is spent, and every
committed seed→level pair of every kind survives the day the knob was declared.
The draw order stays the identity: goal → backend → the table's own
post-processors → the value-added ones in DECLARATION order, `chambers` last
everywhere (asserted at load).

⚠ **`prune` is a boolean because that is what the subject admits** (⚖ trap 254:
measure what the subject admits before sizing a knob). The brief sized it
{0, 1..4}; measured over 5 kinds × 5 seeds × both substrate geometries,
`pruneDeadEnds` runs to a fixed point and thresholds 1, 2, 3, 4, 5 and 9999 give
the byte-identical residue in all 50 cells. It is declared on `bushy` and `loopy`
only — `branchy;prune=1` is byte-identical to `winding` on seeds 1..8 (a second
spelling of a kind that already has a name), and on `open` full braid leaves
nothing to prune (a measured no-op).

**What it measures.** The slice-6 yield table re-run at the same frozen bounds
says what area does for the EXISTING palette, which is what the pass-2 planning
session asked for. Headline, per ITEM rather than per run (seeds 1..8, count 3 /
tries 4 / k 3 / anchortries 1 — the same frozen bounds as slice 6):

- **Seedling `winding` → `;chambers=2`**: floor 23% → 32%, saturated cells
  **4 of 8 → 1 of 8**, kept **12 → 22**; `water-pool` 5 KEPT / 16 NO_ANCHOR →
  **9 / 5**, `wall-segment` 3 / 20 → **6 / 10**, `pit-patch` 2 / 10 → 2 / 3.
- **Seedling `branchy` → `;chambers=2`**: floor 50% → 63%, `wall-segment`
  11 KEPT / 1 REVERTED / 3 NO_ANCHOR → **12 / 0 / 0**, and the two `arrow-lane`
  REVERTs disappear.
- **Maze `winding` 11×11 → `;chambers=1`**: `wall-segment` 1 KEPT / 35 NO_ANCHOR
  → **13 / 3**, saturated 1 of 8 → **0**. At 7×7, 2 / 36 → 10 / 6 at `chambers=2`
  and saturation 4 of 8 → 1 of 8.
- **`rooms;minRoom`** moves floor the way the knob says (68% → 59% at 2, → 76% at
  4 on Seedling) and nothing else of consequence.

⛔ **Doors do NOT arrive with it.** `wall-gap-block` and `wall-gap-lock-weigh`
stay **0 KEPT** on every carved Seedling kind at every chamber count — they span
the interior — so a wider room does not make a corridor door legal. That is
slice 8's subject and ⚖ ruling 11's, not this arc's.

⚠ **And the COST headline still did not move** (⚖ trap 275 — attribute per ITEM,
not per run): the whole Seedling sweep produced **23 REVERTs, 21 of them
`arrow-lane`** and the other 2 the same combat-stance refusal, and the one
expensive cell (`winding` seed 6: 15.3 s / 7.7 s max solve) is the SAME cell at
every chamber count (18.3 s at k=1, 16.8 s at k=2). Chambers buys yield, not
time. ⚖ `arrow-lane` is leaving the generator by the ELEMENTS design's ruling,
so those rows are recorded as *template leaving* rather than acted on.

### Slice 11 — FREE TILE / OBJECT EDITING on watch.html

⚖ Ruling 8 (*"a tool for the user to edit individual tiles and other features of
the levels"*) reaches the Seedling page. The maze lab page has had it since
slice 3; this is the same two LAWS with a different mechanism, and the mechanism
is a **closed set of four recorded ops** in `seedlingDemo/watchEdit.js`:

| op | what it writes | addressed by |
|---|---|---|
| `paint {tx, ty, terrain}` | any of the four `TERRAIN`s, **the border ring included** | the cell |
| `place {tx, ty, type, attrs}` | an entity at the cell's OEL corner, attrs **literal** | the cell |
| `attrs {tx, ty, attrs}` | REPLACES the cell's last entity's attribute set | the cell |
| `remove {tx, ty}` | deletes the cell's last entity | the cell |

⛔ **Nothing here adjudicates legality.** Paint a wall ring to ground, wall the
only corridor, place a body no template ever places — they all apply. *Free
means free; certification is the guard.* `model.refusalAt` (slice 6/6b's
connectivity pre-check) is a rule about TEMPLATE ANCHORS and a hand paint
bypasses it by design; the ORACLE is what refuses, in its own words.

⛓ **Ops address CELLS, never list indices** (the brief offered `entityIndex`).
The edit list is IDENTITY and it travels in a payload a person reads; an index
is a coordinate into a list nobody can see, whose value depends on how many
bodies the templates before it happened to place. When a cell holds more than
one body the rule is **the last one** — the one drawn on top, and the one a
click means.

⛓ **A click that CHANGED NOTHING is not an edit** (trap 263, which the maze page
paid for once). Painting ground onto ground is a legal op that moves no bytes,
so `editState` compares the RECORD and returns the same state object; the count,
the certification and the identity line are all unmoved, and the page says so.

**LAW (a) — IDENTITY.** An edited level is *the ladder to step k, then the
directed attempts, then the manual edits*. The payload gains `edits: [...]`
(empty on every state, like `directives`) and `certified`; ⛔ **the URL writer
never learns about edits** (⚖ ruling 9) — the bar after an edit is CHARACTER FOR
CHARACTER the bar before it — and `describeState` says so out loud: *"…, then 3
manual edit(s) · ⚠ the URL is NOT a reproduction after edits — the PAYLOAD is."*
There is ONE reconstruction, `watchEdit.applyEdits`, and the page's UNDO, the
`?gen=`/`procgenLab:load` replay, `generateWithDirectives({edits})` and the tests
all go through it — so an edited level round-trips **byte-identically across node
and the browser**, which is the cross-runtime determinism claim surviving
editing. ⛓ UNDO is that fold over a shorter list, not an inverse and not a stack.

⚠ **The maze does the opposite here and the difference is forced.**
`mazeLab.agreementWithPayload` REFUSES to reproduce an edited payload and sends
the reader to its LOAD box (`deserializeMazeLevel` takes a level as it stands).
`watch.html` has no such box and never had one — `?gen=` has always meant
REGENERATE-AND-COMPARE — so reconstruction is the only way an edited Seedling
level can come back at all, and it buys the stronger claim in exchange.

⚠ **And the `?gen=` path replays the payload's EDITS but not its DIRECTIVES.**
Not an oversight: a directive IS expressible in a URL (`?directed=`), so the bar
owns it; an edit is expressible in NO URL, by ruling, so the payload is its only
channel.

**LAW (b) — CERTIFICATION.** Editing never bypasses the oracle. Any edit sets
the page UNCERTIFIED and **no draw solves an edited record** — the room is drawn
as a still frame through `previewLevel` (the page's one draw-without-a-run), so
there is something for SOLVE to mean. SOLVE runs `displaySolve` — the loop's own
`seedlingOracle` over the current record, with the KEPT TEMPLATES' pin union (a
hand-placed body has no template and therefore no pin, said out loud) — and
reports SOLVED / REFUSED / BUDGET_EXHAUSTED verbatim. `certified` is a real
tri-state for the first time: `true`, `false` (the oracle said no), `null`
(nobody has asked). ⛓ An ENGINE THROW — a hand-placed entity `buildLevelWorld`
has never transcribed — is caught **at the page**, bounded twice (the class
`LevelWorldError`, and only when the record carries edits), and shown as
UNCERTIFIED with the engine's own name and message. ⛔ The oracle's catch is
untouched (traps 171/173): an unedited record that throws still takes the arm
down, loudly.

**The ordering rule, v1.** `directives` and `edits` are two flat lists, which
mean exactly one construction only because **edits come AFTER all directives**.
A directed ATTEMPT on an edited level is refused by name (on the page before the
press, and structurally in `applyDirective`); STEP / RUN-ALL / CLEAR reset to the
skeleton and say that the edits are gone. ⛔ The alternative — ONE ordered
`history` list replacing both arrays — was NOT taken: a directive's index is its
anchor stream's salt (`directiveSeed`), so re-indexing inside a mixed history is
a determinism change and not a rename.

**The tool UI** is one section beside the catalogue: tool (off / PAINT / PLACE /
ATTRS / REMOVE) + a terrain picker + a free type field with the offered roster as
a `<datalist>` + a literal attrs box + UNDO + SOLVE. ⛔ **Still ONE canvas click
listener**: the template arm and the edit tool are two KINDS of one `armed`
variable with one writer, Escape clears either, and the tool `<select>` is a VIEW
of it. The one asymmetry: an edit tool STAYS armed across clicks (it is a brush)
where AT… does not (it spends a solve). The offered entity roster is the five
types `procgenPalette` actually places — `pushableblock`, `button`, `lock`,
`spinner`, `arrowtrap` — every one a body the generator already builds, solves
and certifies in this room; the goal class is deliberately absent.

Gates: `scripts/procgen/check-seedling-editor-edit.mjs` (59 checks, own server,
no skip condition) plus one new claim on `check-procgen-lab-hosting.mjs` — a
paint in the Seedling frame arriving on the host bus as
`procgenLab:stateChanged.edits === 1`, which is the whole chain the hard-wired
`edits: 0` in `watchSummary.js` was standing in for since slice 4.

### Slice 12 — THE URL DIET (`?directed=` leaves the URL)

⚖ The user's ruling and its consequences are written up under *What a URL is FOR*
above. What CHANGED in code: `procgenCore/urlParams.js` gained
`refuseDirectedParam` / `dropDirectedParam` and lost `writeDirectedParam`; both
readers refuse the key FIRST (before any other parameter is adjudicated, so an
old link's first answer is the one that helps); both writers dropped their
`directives` argument; and the `?gen=` / `procgenLab:load` path on BOTH pages now
replays `payload.directives` (in order, at the same indices) before the edits.
⇒ slice 11's recorded asymmetry — *"`?gen=` replays a payload's EDITS but not its
DIRECTIVES"* — is closed.

⚠ **The maze still refuses to reproduce an EDITED payload**, and the reason is no
longer the channel: a maze edit is recorded as a DESCRIPTION (cell + palette
TYPE) while `MazeRoomEditor` reads `selectedItemId`/`selectedObstacleId`, which
the record does not carry — a fold would place a different body at the right
cell. Its LOAD box takes the level as it stands. Making maze edits replayable
means giving them an OP shape like Seedling's four.

⛓ The maze's `certified` became the TRI-STATE Seedling landed in slice 11 —
`null` = *nobody has asked* (a fresh skeleton, an edit, an undo, a load),
`true`/`false` = the ORACLE's own answer, with `false` reachable in exactly one
place (`certify` on a REFUSED verdict). One spelling across the substrates, which
is what `procgenCore/labProtocol.assertStateChanged` has documented all along.

## The procgen ELEMENTS design — pass 1 = elements + connectors, an intra-level area graph, pass 2 site-typed (DESIGNED 2026-08-15; **ARCS 1, 2 AND 3 ARE CLOSED** — arcs 1–2 on the maze, see [`maze.md`](./maze.md); **arc 3 = Seedling, CLOSED 2026-08-18 over fourteen slices**, and *⛓⛓⛓ ARC 3 IS CLOSED* at the end of this § is its summary; arc 4 = THE CHAIN, ⛔ ask-first; arc 5 = shortcuts / density / arenas)

⇒ ⛓ **AND THE ROOM THIS DESIGN GENERATES NOW REACHES THE REAL GAME.** [▶ LOAD IN WASM](#-load-in-wasm--what-this-page-holds-run-in-the-real-recompiled-game-tooling--user-2026-08-19) at the end of this document is the button: a certified room mounts in the recompiled Seedling as a one-room level SET and its certification solve replays into it, with an END-STATE verdict AND a PER-TICK differential beside the JS one. ⛔ Read that §'s *the two limits it names* before quoting an `agrees`.

⇒ **Orientation** for a reader arriving here cold: [Architecture](./architecture.md#level-generation-two-passes-over-one-loop-core) § *Level generation: two passes over one loop core* is the half-page version; [the demo catalogue](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html) has a link for every piece of this that can be shown in a browser (14 entries; the data is `frontend/modules/procgenDocs/demos.js`, all of it loaded by `scripts/procgen/check-procgen-demos.mjs`, which imports the same module — [`demos.md`](./demos.md) is the pointer); and the working machine — the design doc, the four arc kickoffs and every slice's as-built — is under `NewDocs/plans/` (gitignored), with arc 3's gate-by-gate close and its whole residue list in `procgen-elements-arc3-kickoff.md` §18.

The Fable planning session that constructive-mode ruling 11 called for
("updating the level generation to make proper use of the new two pass
system might require some big changes"). It re-read the Cloudberry Kingdom
interview and MetaZelda (`~/CC/metazelda`, BSD-3) with the user and settled a
DESIGN spanning several arcs — the design doc and the arc-1 kickoff live in
`NewDocs/plans/procgen-elements-design.md` and `…-arc1-kickoff.md` (working
machine); the queue entry is `CC/docs/plans/fable-to-opus-handoff-2026-07.md`
§5g. What it settled, so a reader of this file is not surprised later:

- **Pass 1 is ELEMENTS + CONNECTORS**, the interview's own algorithm: a
  constructor builds a feature WITH the geometry it needs (a block, the switch
  it is pushed onto, the push path, the turning space — in ONE step; the
  first is a REVERSE-PULL single-block gadget, solvable by construction), each
  add checked for feasibility; the maze algorithms are the CONNECTORS between
  elements, not the whole of pass 1. Above it a small **area graph** — a JS
  re-implementation of MetaZelda's lock-and-key logic in `procgenCore/` (key
  levels, locked edges that are CUTS, keys by intensity, `graphify`'s
  one-symbol rule for loops incl. the post-solve entrance↔exit shortcut).
  **Pass 2 stays the keep-or-revert loop**, SITE-TYPED (main path / bend /
  branch / chamber), with **door = cut** as the one legality law and templates
  allowed to CARVE (bounded, dead-end, no-shortcut).
- **Maze first at every step**; its oracle grows to BFS over block state (no
  strategy ladder). Seedling follows within its proven envelope: straight
  pushes today, **bent pushes = the CHAIN (named, still ask-first)**, trap
  families as R9+ implements them.
- ⚖ **`arrow-lane` is OUT of the generator entirely** (a pre-sword-puzzle
  element only) — it was also the whole cost story on carved rooms (§13 of
  the constructive kickoff: every expensive solve was an `arrow-lane` REVERT).
  Its removal, the pre-check widened to every kind, and the Seedling retrofit
  are arc 3.
- Design for POST-SWORD; enemies are obstacles ± kill gate; a "plain obstacle"
  is anything the solver has a RELIABLE strategy for (measured, not listed);
  solver work (ticks, strategies, expansions — never wall clock) becomes a set
  of DIALS beside density; item-gated shortcuts (water/swim, waterfall) are a
  `graphify` edge whose lock is an item-passable tile.
- Arcs: 1 area graph (maze; absorbs the held constructive slice 10-maze) →
  2 reverse-pull gadget (maze) → 3 Seedling → 4 CHAIN → 5 shortcuts / density
  / arenas.

### Arc 3, slice 1 — `arrow-lane` OUT, and pass 2 learns SITES (2026-08-16)

The first slice that changes Seedling generation output, so this section is
where the tracked record starts.

- ⚖ **`arrow-lane` IS GONE FROM THE GENERATOR** (design ruling 9). The base row
  left `PRE_SWORD_TEMPLATES` (and post-sword with it), `procgenSeedling`'s
  `laneClear` rule left with its only caller, and the `lane: 'avoidable'` word
  left the concrete-row vocabulary. The row is RECORDED in
  `procgenPalette.EXCLUDED_TEMPLATES` with its cause, its measurement and a
  refusal text captured before the removal — the first row there excluded by a
  RULING rather than by a mechanism the oracle could not adjudicate.
  ⛓ **AND IT WAS THE WHOLE COST STORY**: on the Seedling yield table (7 kinds ×
  seeds 1-8, target 3) the worst single solve fell **70,784 ms → 850 ms (83x)**
  and total generation wall time **116.4 s → 32.8 s**, because every expensive
  solve on a carved room was an arrow-lane REVERT walking the combat ladder
  against a live volley. Every Seedling seed→level pair moved; the acceptance
  batch, the carved-kind pairs and the generated set were re-recorded.
- ⛓ **PASS 2 IS SITE-TYPED.** `procgenCore/sites.js` derives, once per model
  and from the SKELETON, six classes over the ground the start can reach:
  `main` (one shortest start→goal path, from `gridFlood.shortestPath` — new,
  same flood family), `bend` (a main cell whose in/out directions differ),
  `branch` (a straight dead-end stub off the main path: mouth, direction,
  length, cells), `tip` (any dead end), `chamber` (the maximal 4-connected
  blobs of cells belonging to an all-ground 2x2 square — arc 1's maze rule,
  one rule over two terrains) and `corridor` (the rest).
- A template row declares ONE `site:` class. Default `'any'` = the whole
  interior, which is the list `anchorsFor` has always shuffled, so every row
  that declares nothing is byte-inert. ⛔ **A site is a PROPOSAL DISTRIBUTION,
  never a legality rule**: `refusalAt` is unchanged, so a DIRECTED placement
  outside a template's class stays legal.
- The three AREA templates (`wall-segment`, `water-pool`, `pit-patch`) declare
  `'chamber'`, with **no fallback** — ⚖ the user's ruling. ⛓ **The census is
  what the ruling was taken on**: a Seedling 10x10 room carved by a bare tree
  kind has **no all-ground 2x2 square at all on 10 of 12 seeds**, so on
  `branchy`/`bushy`/`loopy`/`open`/`winding` those rows are honestly NO_ANCHOR
  and the yield there goes to ≈0. ⚖ **THINGS THAT NEED AREA ARE PLACED FIRST**:
  a fallback to "anywhere" would re-create the open-room assumption this arc
  exists to remove. **A bare tree kind is a CORRIDOR-ONLY skeleton, and area is
  pass 1's to provide** — `chambers=k`, `rooms`, and later the elements
  themselves; the yield table publishes that arm beside the bare one. The open
  room is unaffected: its one chamber IS its interior, in the same order.
- `scripts/procgen/census-seedling-sites.mjs` is the permanent site census
  (kinds × knobs × seeds; counts only, no solve). Headline numbers later
  slices size against: main-path length 2..22 (mean 7-10), corridor cells
  7..35, branch stubs rare and short (0-5 per seed, lengths 1..7; `winding`,
  `open` and `empty` have none at any of 12 seeds).
- ⚠ **A derivation that spends no DRAW can still spend TIME.** Deriving the
  sites eagerly at model construction made `seedlingModel` 72x more expensive
  (0.039 ms → 2.819 ms) because `procgenLevel.terrainAt` is a linear scan of
  the tiles layer, and it slowed the whole vitest suite. `deriveSites` now
  reads the caller's predicate exactly once per cell (asserted by a test) and
  `model.sites` is a memoized getter, so a model nobody asks pays nothing.

### Arc 3, slice 2 — A DOOR IS A CUT, and a template may CARVE (2026-08-16)

- ⛓⛓⛓ **`doorClear` IS GONE; ONE FLOOD-BASED LAW ADJUDICATES EVERY DOOR** (⚖
  design ruling 17: *a non-cut is decoration*). A row that declares `door` also
  declares `doorCells` (the gap cell(s) holding the clearer, which write no
  wall) and `clearer` (the cells that must be reachable from the start; EMPTY
  for `wall-gap-block`, whose block stands IN the door cell). It is legal iff
  **(1) CUT** — with its terrain painted AND the door cells treated as wall the
  goal is unreachable from the start — and **(2) START-SIDE** — with the door
  cells walled, every clearer cell IS reachable from the start.
  ⛔ The law runs ONE flood: clause 1's other half (*with the door cells
  walkable the goal is reachable*) IS the seal pre-check's own answer, and the
  seal check is the rule asked immediately before.
- **All three door families declare `door` now.** `wall-gap-block` and
  `wall-gap-lock-weigh` gain it, and the cost of that is measured rather than
  asserted: on `empty` at target 3, **34 of 80 seed→level pairs moved, and all
  34 are explained** — the control build's own trace holds a decoration door
  (a wall with the goal on the START's side) in every one, **33 of them KEPT**.
  The generator was shipping walls the walk simply went round.
- ⛓ **THE SPAN LAW IS RE-DERIVED, NOT OVERTURNED.** GENERATE-UI ruling 3 said
  *a shorter wall is decoration*; this says *a non-cut is decoration*, and on
  the open room they select the same anchors — measured over 40 seeds × 20 door
  instantiations with **zero disagreements** against the retired predicate, so
  the law is UNIFIED across kinds rather than kinds-scoped.
- ⛓ **TEMPLATES MAY CARVE.** A footprint cell a row writes as `ground` is
  adjudicated by *untouched SKELETON terrain* — `terrainAt(record) ===
  terrainAt(base)`, compared against the model's own frozen skeleton rather
  than a second `skeletonMask` — and the carved cells must form ONE 4-connected
  blob with EXACTLY ONE walkable neighbour (a DEAD END), with the start→goal
  path no shorter after than before. ⛔ The dead-end clause is the load-bearing
  one: a tunnel joining two arms of a corridor can leave the path length
  unchanged, so the no-shortcut clause cannot see it.
- ⛓⛓ **THE KILL LOCK REACHES A CORRIDOR — the first door family that ever
  has.** Its wall is a measured `span` domain of **{1, 8}**: 8 is today's
  full-interior geometry byte for byte, and at **1** there is no wall at all —
  the lock cell IS the door, the player fights from the corridor cell before
  it, and the spinner stands in a ONE-CELL NUB the template CARVES. Sized by
  two measurements, not chosen: the new permanent
  `scripts/procgen/census-seedling-doors.mjs` says **`empty` cuts at span 8 and
  at no shorter span (384 anchors vs 0) while every bare tree kind cuts at span
  1 and not at span 8**; the per-value sweep then says span 1 DISCHARGES `kill`
  on eight carved kinds (39 discharges) and span 8 on `empty` (31), with spans
  2..7 producing six between them. **`winding` now keeps a door.**
- ⛔ **A ONE-VALUE DOMAIN IS A CONSTANT.** `wall-gap-block` and
  `wall-gap-lock-weigh` keep `INTERIOR_SPAN` as a constant and declare no
  `span`: their measured domain is one value, and a one-value `rng.pick` still
  spends a draw and would move every level for nothing.
- ⚠ **THE PRICE, PUBLISHED**: half the kill family's `empty` draws now pick
  span 1, which never cuts an open room, so they are NO_ANCHOR by construction.
  A room-aware span is an ELEMENT question (slice 3), not a template one.
- ⚠ **AND A SOLVER DEFECT MEASURED A FOURTH TIME.** Span 1 exposes the
  `levelRun: the swing … collideLine("Solid")` throw at far more anchors, but
  the run-abort rate does NOT rise (post-sword seeds 1..72 at target 6:
  **10 aborts before, 9 after**) and the class is present in both builds. The
  oracle's catch is deliberately not widened.
- New instruments, all permanent: `census-seedling-doors.mjs`,
  `attribute-seedling-door-cut.mjs` (names the movers, and `--accumulate=`
  finds the clause-2 refusals a bare-skeleton scan cannot see),
  `--kinds=` on `sweep-seedling-wave1-domains.mjs`, and `--palette=` on
  `sweep-yield-table.mjs` — without that last one the acceptance gate *"the
  door families on carved kinds"* was unprintable for the post-sword-only
  kill family.

### Arc 3, slice 2c — the kill lock gets its ✕, and the hammer refusals name the LINE (2026-08-16)

Two user-reported fixes, page + text only; ⛔ no solver behaviour moved (the R8
battery md5 is unchanged and the acceptance batch is byte-identical against a
control run in the same tree). ⛓⛓ **THE ✕: the two clears reach the page through
different records, and only one of them is a record.** A lock whose GROUP is
pressed stands in the run's world and its id joins `run.openActivators`, so the
world-state layer strikes it through; a KILL LOCK (`tset -1`) is opened by the
spinner's death through the 4b scratch layer, `levelRun.applyClearNow` rebuilds
the room and `Lock.check()` does not build the lock at all — so it leaves every
set that layer reads and `changeCounts.placed` drops to 0. Fixed in the ONE
place the marker is decided: `watchOverlays.worldChangesAt` is also handed the
world the renderer is PAINTING and marks every markable solid in it that the
run's world no longer builds (same `effect: 'gone'` glyph, no renderer fork).
⛓⛓ **THE SENTENCES**: three hammer-safety refusals said *"the 13 px hammer
disc"* — the 45-phase union, which is only `clearOfHammersAt`'s `at === null`
fallback — and now say which test actually ran, ASKED per refusal rather than
hard-coded, so a `time: null` tape still reads "union over all 45 phases".
⛔ `SolverBotError` gained `code`, the three `fail()` sites stamp
`HAMMER_SAFETY` and `procgenOracle.isHammerSafetyRefusal` is a FIELD READ —
the residue its own docblock named, discharged by the day arriving, because a
classifier grepping the English would have turned every one of those refusals
into a run abort on the commit that fixed the English.

### Arc 3, slice 2d — the spinner forecast is MEMOISED, and the strike bound is a NAMED refusal (2026-08-17)

⛓⛓ **THE MEMO IS BYTE-INERT AND THE COST IT REMOVES IS NARROWER THAN THE
PROFILE PROMISED.** `levelRun.spinnerForecast` now keeps ONE forecast per tick
(keyed on the spinner state BY IDENTITY, `level`, `world`, `firstTickInWorld`
and `ticksCompleted`; nulled as `advance`'s first statement — sound because
`advance` is the run object's ONLY mutating member), extended on demand and
sliced for shorter asks, because probe 2b found `deriveStrike` →
`dangerDuringTransit` re-simulating the bodies per danger query. Every md5, the
R8 tape sweep and all 125 per-anchor outcomes are IDENTICAL; the probe falls
724.9 s → 561.7 s (1.29x, THREW class 2.16x) — but **five of the seven >20 s
solves do not move at all and the arc's 21m47s item is unchanged**, because
§9b.2 had profiled one anchor and that anchor is the one that improved 2.97x.
Re-profiled, what dominates now is `previewWalk` → `playerPhysicsV2.step`
(85.9% / 56.8% self) with `stepSpinner` at 0.6% — **that is R9's next line**.

⛓⛓ **AND THE KILL FAMILY'S SECOND UNCAUGHT ABORT CLASS IS NOW A REVERT.**
`execKillByPress`'s bound-exhaustion `fail()` — the schedule ran its whole
`SPINNER.hitsMax * (strikeHorizon + HOLD_SLACK)` tick bound and the body
outlived it — stamps `code: STRIKE_BOUND_EXHAUSTED` plus the bound, and
`procgenOracle` classifies it `VERDICT.BUDGET_EXHAUSTED` with
`budgetKind: 'strike-schedule bound (2010 driven ticks)'`. ⛔ A NAMED widening
in 2c's own mechanism and never a catch-all: `e.code` is `null` on every other
`SolverBotError`, which still aborts. Measured on probe 2b's own worst item
(`winding` post-sword seed 1): `THREW GenerationAborted` → **`SATURATED`**, the
candidate reverting instead of killing the run.

### Arc 3, slice 3 — the Seedling ELEMENT binding, and it is UNCERTIFIED BY NAME (2026-08-17)

⛓⛓⛓ **THE GADGET IS BUILT, PLACED AND MEASURED — AND THE SOLVER CANNOT CERTIFY
IT, WHICH IS THE SLICE'S FINDING RATHER THAN A GAP IN THE WORK.** ⚖ Design
ruling 22's shape is *block on `Button`(A) HOLDS `Lock`(A) open → the player
reaches the `ButtonRoom`(B) FLAG → pressing it PERMANENTLY opens the level's
`Lock`(B)s → collect*. Measured on a hand-drawn 10x10 room BEFORE the binding was
written, and the chain does not run:

- the frontier names `lock`(B) correctly, `refineStrategy` correctly KEEPS `hold`
  (the presser is a LATCHING `buttonroom` — `activators.localPublish`), and
  `deriveHoldStance` then refuses BY NAME: *"no REACHABLE stance inside
  buttonroom@… A hold that cannot be stood on is not a strategy for this
  obstacle."*
- **the gate is the gadget's OWN BLOCK, not `lock`(A)** — ablation, one entity at
  a time: with `lock`(A) removed the refusal is the IDENTICAL sentence; with the
  BLOCK removed the room SOLVES. `solverBot.stanceHypothesis` hypothesises every
  unopened ACTIVATOR discharged, but a `pushableblock` is a Solid no hypothesis
  removes and no SUB-ORDER shoves — and the reverse-pull geometry puts the block
  in the entry lane BY CONSTRUCTION, so no draw of the element avoids it.
- where the hypothesis DOES apply the optimism is worse than a refusal: the walk
  sets off for a stance behind a lock nothing opens and grinds on it for the whole
  400-tick per-target budget.
- ⛓ **AND THE FLAG'S VERB IS `hold`, NOT `touch`** (a correction to the design's
  own realisation table): `resolveTouchStrategy` keys on
  `activators.TOUCH_RESPONDERS`, which is `shieldlock`/`shieldlocknorm`.

⇒ ⚖ **THE USER RULED: build it UNCERTIFIED.** `generateSeedlingLevel` runs the
certification solve itself (so the loop's step-0 THROW becomes a graded refusal
with the solve's own words), records `certified: false` + `gap:
'the-solver-does-not-chain (S1: nested openers)'`, and regenerates with the
element DROPPED — the same draws spent, the composite not committed — so
`--elements=guard` yields a real level and the geometry the census measured is
carried across the drop. The yield table publishes **PLACED, CERTIFIED and
guarded as three columns**, with `CERTIFIED = 0` and the refusal sentence beside
it. ⛔ Nothing solves around it: no template trick, no solver line, no widened
catch. The solver slice **S1 "nested openers"** is AUTHORISED and follows; its
work order (three gaps, the arm that shows each, the function each stops in, and
the record its certification must produce) is arc-3 kickoff §10.3, and
`seedlingDemo/procgenSeedlingElementsCertify.test.js` holds the six-arm fixture
LIVE so S1 FLIPS it green rather than rediscovering the problem.

**What landed, for a reader of this file:**

- `seedlingDemo/procgenSeedlingElements.js` — the binding: the snug site list, the
  composite (the carve's answer inside the reserved rectangle DISCARDED, the ring
  written WALL except the entry mouth, the exit mouth SEALED, the mouth joined by
  the shortest tunnel that never enters the rectangle or the border ring), the
  `demand` check, the guard-is-a-cut flood, the FLAG-LOCK rule, the mapping, and
  the lifted claim's reader. ⛔ It imports the SAME element the maze binds
  (`procgenCore/elements/reversePullBlock.js`); there is no Seedling-private
  gadget.
- **THE MAPPING**: `tiles` floor/wall → `ground`/`wall` over the whole site ·
  blocks → `pushableblock` · buttons → `button {tset: A}` · `door_A` → `lock
  {tset: A, tag}` · the FLAG → `buttonroom {tset: B, tag, flip:'0', room:'-1'}` ·
  the FLAG'S LOCK → `lock {tset: B, tag}` on a main-path CUT. **Two groups from
  one placement**: A is the BUTTON cell's `placementGroupId`, B is the BUTTONROOM
  cell's — asserted distinct, and a collision THROWS (it would let the guard's
  button open the flag's locks). **Three tags of the 30** per element.
- **THE FLAG-LOCK RULE**, exactly: the last cell of one canonical shortest
  start→goal path, walking back from the GOAL, that is not the start/goal, not
  inside the element, **not 4-adjacent to the goal**, DISCONNECTS the goal when
  walled, and leaves the ENTRY MOUTH start-side. Otherwise the element is REFUSED
  `no-cut-for-the-flag-lock` and never placed as decoration. ⛔ The 4-adjacency
  clause is a MEASUREMENT: a lock on the goal's doorstep breaks the COLLECT
  ceremony's approach sweep (*"A pickup is not solid, so the planner and the
  geometry disagree about the approach"*), which is a refusal with nothing to do
  with the gadget. ⚖ Slice 4's area binding takes over WHICH cell.
- **THE SITE MARGIN IS MEASURED AND IT IS NOT THE MAZE'S.**
  `procgenMaze.SITE_MARGIN = 4` offers **ZERO candidate sites in 20 of 30 (kind,
  len) cells** on a 10x10 room — every `len` 3 and 4, every kind, all 12 seeds —
  because the reserved rectangle cannot then avoid both the start and the goal.
  `SITE_MARGIN_STRAIGHT = 2` is the gadget's own extent at `turns = 0` and puts a
  len-2 gadget on `MIN_SITE` (4x4) exactly. ⛔ No bound widened, the room did not
  grow (⚖ arc-3 ruling 7).
- **THE CENSUS** (`scripts/procgen/census-seedling-elements.mjs`, NEW, permanent;
  10 kinds × 12 seeds × `len ∈ {2,3,4}`, geometry only, no solve): **29 of 360
  cells PLACE**, at `len` 2 and 3 and **never at `len` 4**. Refusals by name:
  `no-cut-for-the-flag-lock` 85 · `no-site-fits-this-room` 80 ·
  `the-entry-mouth-is-the-rooms-border-ring` 70 ·
  `the-reserved-rectangle-seals-the-room` 42 · `the-entry-port-cannot-be-joined`
  40 · `WALK_NOT_FOUND` 10 · `the-tunnel-shortens-the-way-to-the-goal` 4. ⇒ ⚖
  ruling 7 is answered *"something fits, thinly"*, so the multi-screen horizon
  item is NOT raised; the levers are upstream and already named (`chambers=k` as
  a non-zero default; a `chamber`-shaped element placed first).
- ⛓ **`no-cut-for-the-flag-lock` IS THE BIGGEST REFUSAL, AND IT IS SLICE 2's DOOR
  CENSUS FROM THE OTHER SIDE**: on `empty` a span-1 door cuts NOTHING (0 CUT
  anchors at spans 1..7 against 384 at span 8), so a one-cell lock is a CORRIDOR
  mechanism. ⛓ And yet the open room still places 2 of 12 at `len` 2 — the
  element's own reserved rectangle turns it into a corridor room, so the gadget
  MANUFACTURES the cut its flag's lock needs.
- **THE ELEMENT'S CELLS ARE FENCED OFF FROM PASS 2 BY NAME**, in BOTH legality
  rules: `freeRefusal` alone would let a wall segment land in the push lane (it is
  untouched `ground`), and `carveCellRefusal` alone would let a pocket be CARVED
  out of the ring (in `base` the ring IS wall). At `--elements=none` the set is
  empty and the check returns on its first line.
- ⛔ **`turns > 0` REFUSES BY NAME** (`the-chain-is-arc-4`, ⚖ arc-3 ruling 1) and
  the refusal spends NO draw, because `turns` is forced to `0` as an OVERRIDE
  rather than drawn and then rejected. One element, two bindings, two admissible
  domains.
- ⛔ **BYTE-INERT AT THE DEFAULT `--elements=none`**, and the gate is a COUNTING
  SPY rather than a tile comparison: `model.roomDraws` is unchanged there and
  strictly greater whenever a gadget is asked for, placed or refused. The battery,
  the acceptance batch, the maze dump, the `empty` pairs and the generated set are
  all byte-identical.

### Arc 3, slice S1 — NESTED OPENERS: the solver certifies the guard (2026-08-17)

Slice 3 shipped the element binding UNCERTIFIED and published `guarded = 0` as
the honest measurement of the arc's dependency. S1 is the ⚖ user-authorised
SOLVER slice that closes it. **The same placement now certifies**:
`--elements='guard;len=2'` on `winding` seed 7 prints `CERTIFIED: true — SOLVED`
with records `['weigh','hold','collect']` and the lifted claim **true**. As-built:
`NewDocs/plans/procgen-elements-arc3-kickoff.md` §11.

- **A STANCE DERIVATION MAY RETURN A PREREQUISITE.** `deriveHoldStance` could
  ask *does a corridor reach this stance* and *does one reach it under the
  hypothesis*; the third question is **is it reachable once ONE obstacle has been
  REALLY discharged by an order somebody executes first?** Two arms, in this
  order: the MECHANISM (an activator whose own verb is a `weigh`, probed with its
  block parked on the presser) then the GEOMETRY (a `pushableblock`, probed
  through `deriveShove`). ⛔ Mechanism first is load-bearing — in ⚖ ruling 22's
  gadget the block in the lane IS the lock's opener material, so a geometry-first
  policy buys a corridor by spending the mechanism.
- **ONE CONSUMER, NO SECOND FRONTIER.** `walkTo`'s plan application is the one
  place a stance becomes a walk, so the prerequisite's order REPLACES that
  round's plan and the loop `continue`s — the original obstacle is re-identified
  and re-derived against the world the prerequisite changed. The bound is
  `NESTED_OPENER_DEPTH = 2`, counted from the frontier and tracked per GOAL.
- **GUARD (iii): NO OPTIMISM WITHOUT A DISCHARGE THAT OUTLIVES THE WALKER.** An
  activator whose verb is `weigh` and whose weigh no block can serve is a WALL
  for `stanceHypothesis`, because the only order left for it is a `hold` on a
  republishing `Button` that shuts the moment the walker leaves to use it. ⛔ The
  arc-3 kickoff's own §10.3 attributed that budget burn to a MISSING order; the
  trace shows the order raised on tick 0, and what is missing is its durability.
  Measured: 797 driven ticks → **0**, median 430 ms → 180 ms.
- **THE DWELL ARM.** A gadget can arrive already solved; `resolveWeighStrategy`
  now resolves a pre-parked block to `runDwell` alone — the weigh minus its
  shove, with no stance at all — and the record carries `parked` so the lifted
  claim can still read which block is on which button.
- **THE CERTIFICATION FOUND TWO DEFECTS IN THE READER SLICE 3 SHIPPED UNEXERCISED**
  (a row's `path` is string-pulled WAYPOINTS, and its corridor starts where the
  player STANDS, not at waypoint 0), and turned the certification's `gap` field
  from a constant into a classification computed from the solve's own structured
  fields.
- **NOTHING COMMITTED MOVED.** R8 `--win --only=<the 20 tapes>`: **534 PASS /
  0 FAIL / 67 SKIP, ALL CHECKS PASSED**. battery / maze / batch / `empty` pairs
  md5s byte-identical; the arc's 2.8-hour carved-pairs bound is
  `ab227401a875fdb3d9555b423e039aa6`, the same value as before the slice, with no
  movers to name; and the yield table's `none` arms reproduce the previous
  slice's cell for cell — the capability fires only where a stance was
  UNREACHABLE and a prerequisite exists, which nothing that already worked ever
  needed.

### Arc 3, slice 4a — the room-aware DOOR ELEMENTS: a KILL GATE and a BLOCK POCKET (2026-08-17)

Two new elements, both through the ELEMENT contract's **second phase**, both
certified by the existing solver (⛔ no solver line changed). The as-built with
every table is arc-3 kickoff §12.

- ⛓⛓⛓ **A DOOR'S GEOMETRY IS THE ROOM'S, AND `span` WAS A PROXY FOR IT.**
  Neither new element declares a single parameter. The three door TEMPLATES they
  supersede carried `span`/`ori`/`gap` because a pass-2 template writes a
  RELATIVE footprint at an anchor somebody else offers and cannot know the room
  — and slice 2 measured what that cost (`span`'s domain is `{1, 8}`, two values
  for two rooms, and half the kill family's `empty` draws became NO_ANCHOR by
  construction). An element constructed AFTER the carve **GROWS** its wall until
  the wall meets the room: 0 cells on a corridor, 7 on the open 10×10 room, a
  chamber's walls in a chamber.
- **ONE CONTRACT, TWO PHASES.** `defineElement` gains `phase`, default
  `pre-carve` — today's law, unchanged byte for byte. An `on-connector` element
  is constructed after the carve, is handed the room's interior plus a READ-ONLY
  `room` probe (`floorAt`, `mainPath`, `isCut`, `connectedWith`, and the
  BINDING's own `doorLaw`), and writes SPARSELY: its tiles may be EMPTY, its
  entities may not; an entity may stand on a cell the SKELETON floored; it has
  NO ports and `area: null` — *a door does not MAKE an area, it CUTS one*.
- **ONE DOOR LAW, TWO CALLERS.** `doorLawRefusal` and `carveLawRefusal` moved to
  module scope in `procgenSeedling.js`; a template resolves offsets against an
  anchor and an element hands absolute cells, and `askOpenHalf` names which
  caller has already paid for clause 1's other half (a template gets it from
  `sealRefusal`; an element is constructed, not offered, so it asks).
- **THE CENSUS** (10 kinds × 12 seeds, geometry only, seconds): kill gate
  **61/120**, block pocket **62/120**, both on ALL TEN kinds. ⛓ The real
  denominator is **8 of 12** — seeds 8 and 11 put the goal ADJACENT to the start
  and 5 and 6 within 2 of it on EVERY kind, because the goal is the room
  stream's FIRST draw and precedes the carve.
- **THE YIELD TABLE** (eight arms, both palettes; the four `none`/`guard`
  controls reproduce slice S1's cell for cell): the **block pocket certifies on
  every placement it gets — 36 of 36, in both biomes, lifted claim TRUE on every
  one**, and it is the first element in the arc that never fails a certification
  solve. The **kill gate certifies 6 of 28 post-sword**, and all 22 refusals are
  the one PRE-EXISTING class (`kill:` finding no strike stance beside the
  spinner — the corridor kill lock's own cost story, R9's).
- ⚠ **AND THE KILL GATE'S THROW CLASS NOW REACHES THE HARNESS.** As a TEMPLATE
  the spinner is a pass-2 candidate and the pre-existing `swing … collideLine`
  abort takes one generation; as an ELEMENT it is in the SKELETON, so the throw
  takes the CERTIFICATION solve and the cell dies. Same class, one layer in.
- ⛓ **A DROPPED `on-connector` ELEMENT LEAVES THE LEVEL BYTE-IDENTICAL TO
  `--elements=none`** — its single draw is the LAST of the room stream and pass
  2 runs on a separate one. That is the OPPOSITE of the pre-carve rule (*a
  refused element spends its draws and moves the room*), and both are true of
  their own phase.
- **THE `+` LIST** (`guard;len=2|3|4+killgate+blockpocket+chamber;w=2;h=3` — as of
  R9 slice 1; it read `guard;len=2+killgate+blockpocket` when this § was written)
  is a CHOICE, not a
  conjunction — ONE BLOCK PER LEVEL forbids the other reading — and one
  `rng.pick` over its members is the only draw it spends. `none` is a legal
  member.
- **THE ITEM GATE**: `ELEMENT_TABLE.killgate.needs = ['hasSword']`, refused at
  the seam for FREE. A pre-sword kill gate can never certify, and spending 32
  certification solves to learn what the boot flags already say would make the
  yield table measure the boot rather than the gate. It is `require:`-shaped and
  slice 4b generalises it.
- ⛔⛔ **THE DOOR-TEMPLATE RETIREMENT IS PREPARED AND MEASURED AND NOT
  EXECUTED.** ⚖ The user ruled all three retire together; the coupling — that
  retiring them while elements are OPT-IN leaves the DEFAULT generator with no
  doors at all — is with the user. Measured on a temporary build that was
  restored: the retired roster is THREE templates (`wall-segment`,
  `water-pool`, `pit-patch`), both biomes become the same roster, and `none`
  keeps MORE obstacles (107) that are ALL decoration — zero `shove`, `weigh` or
  `kill` in the whole table. With a default spec on, **27 certified doors in 72
  cells pre-sword and 21 post-sword**, at a MAX single solve of 5.6 s against
  the shipped 29.8 s. Nothing was removed from the palette.

### Arc 3, slice 4c — THE CLEANUP: the three door TEMPLATES retire, the default is a biome ELEMENT SPEC, and the goal is a pass-1 decision (2026-08-17)

⚖ The user ruled three changes together (the generation review §3/§4), and ⚖ the
orchestrator ruled they land as ONE commit — *"commit each step" is a rule against
unreviewable diffs, not against a step whose green depends on the next.* The
as-built with every table is arc-3 kickoff **§13**.

- ⛓⛓⛓ **THE GOAL IS DRAWN ≥ 3 CELLS FROM THE START, AND IT IS A PROOF RATHER
  THAN A MARGIN.** `GOAL_MIN_FROM_START = 3`: the same ONE `pick`, still the room
  stream's FIRST draw, still before the carve — only the candidate list narrows
  (63 → 58). At Manhattan `m` the shortest path is ≥ `m+1` cells, so `m ≥ 3`
  gives `start,p1,p2,goal` and `manhattan(p1,goal) ≥ 2` ⇒ **a door element is
  never refused for the goal's position alone.** Slice 4a had measured 4 of 12
  seeds refusing every door element on every kind; after the rule `no-cut-cell`
  (20) and `goal-too-close` (19) are GONE from the whole 10-kind × 12-seed
  census, killgate places 61 → **90** of 120 and blockpocket 62 → **76**.
  ⚠ THE PRICE IS A FINDING, NOT A LEVER: the `guard`'s census falls 29 → 21,
  because a more central goal leaves fewer 4×4/5×5 AXIS-ALIGNED rectangles
  avoiding both endpoints (`no-site-fits-this-room` 80 → 130). Arc 5's
  room-aware SITE PICK is what recovers it.
- ⛔ **THE THREE DOOR TEMPLATES ARE GONE**, each an exclusion row carrying the
  measurement that retired it. `KILL_LOCK_TEMPLATES` is EMPTY (the array kept for
  arc 5's arena), seven constants lost their last caller, and `doorGeometry`
  STAYS because the door census must measure a door the pipeline can produce.
  ⇒ **41/45 instantiations → 23/23, three DECORATION families, and the two
  palettes now differ ONLY in `items`.** The biome IS the boot plus the elements'
  `needs`. ⚠ A future biome-specific TEMPLATE must declare `needs` the way an
  element does — one mechanism — rather than re-growing a second array.
- ⛓ **AND THE DEFAULT GENERATOR HAS DOORS AGAIN, WHICH IS WHAT MADE THE
  RETIREMENT SAFE.** `procgenSeedling.defaultElementsFor(items)` — ONE place, the
  SEAM, because the model has no items — as of R9 slice 1
  `guard;len=2|3|4+blockpocket+chamber;w=2;h=3` pre-sword and
  `guard;len=2|3|4+killgate+blockpocket+chamber;w=2;h=3` post-sword (it read
  `guard;len=2+blockpocket` / `+killgate` when this § was written), a `+` list
  meaning ONE of these drawn. The CLI, the sweep and the page follow by passing `undefined`;
  `--elements=none` stays selectable and stays inert relative to ITSELF (not to
  the pre-4c default — the goal draw moved in the same commit).
- **`PREFER_DISCHARGE` RETIRED ON SEEDLING.** The `<d|s>` policy letter left the
  URL grammar and an old link REFUSES by name with the corrected spelling. Two
  independent reasons: S1 measured the `solved-only` class empty, and no template
  either roster still holds has a VERB to discharge. `KEEP_POLICY` stays in
  `levelGenerator.js` for the MAZE.
- ⛔⛔ **ONE ABORT THE DEFAULT INTRODUCES, PUBLISHED RATHER THAN SMOOTHED**:
  post-sword seed 38 at target 6 aborts with a `PhysicsV2Error` (the player
  DROWNED) escaping the oracle — 1 of 160 (biome, seed) cells, against 0 of 160
  at `--elements=none` and 0 over seeds 41..120. `--elements=killgate` ALONE at
  that seed does NOT abort; the default does because a `+` list spends one extra
  draw and lands a different room. ⇒ the pre-existing armed-hazard class, not the
  element's. ⚖ Ruled: ship the default, name it in R9's engine residue, widen no
  catch.
- ⛓ **THE SUITE CAME BACK FASTER THAN IT LEFT**: 555 s → **431.6 s** (131 files,
  4760 tests), and `procgenPalette.test.js` 21.7 s → 13.3 s. In the intermediate
  state (goal moved, templates not yet retired) that one file took **43 minutes**
  from two rows the retirement deletes — the third independent argument for the
  one-commit ruling.
- ⛔ **ZERO COMMITTED R8 TAPES MOVED** (534 / 0 / 67, identical), the battery and
  the maze byte-identity are byte-identical, and the four non-GENERATE browser
  rows are unchanged — the retirement stayed inside the GENERATE arm.
- ⛓⛓⛓ **THE CARVED-PAIRS DUMP WENT 9,151 s → 224 s (40×)**, which is 2b/2d's
  cost story closing: the 24 attempts per cell that used to run the planner to
  its dash cap before refusing are now NO_ANCHOR-cheap. ⛔ CONTROLLED, because a
  40× collapse is either a finding or a broken run — a worktree at the previous
  commit, both trees on the same scoped axes, row for row: **the EMPTY kept sets
  on bare corridor kinds are NOT new.** They are slice 1's site vocabulary
  (`wall-segment`/`water-pool`/`pit-patch` are `site:'chamber'` and a
  corridor-only skeleton has no chamber), and the door families were the only
  `site:'any'` rows that could anchor there. ⚠ The reader's sentence: **on the
  bare tree kinds the default level is the skeleton + one certified ELEMENT + no
  pass-2 decoration — pass 2 has no AREA to decorate** (⚖ ruling 24: area is pass
  1's). The remedy is a design residue — a non-zero default `chambers=k` for the
  carved kinds — and NOT slice 4c's to make.

### Arc 3, slice 4b — the Seedling AREA BINDING, and the carved kinds get a `chambers` DEFAULT (2026-08-17)

The as-built is arc-3 kickoff §14. What a reader of this file needs:

- **ONE AREA PARTITION, TWO SUBSTRATES.** `procgenCore/areaPartition.js` now
  holds the rule arc 1 wrote inside `mazeRoom/procgenMaze.js` — *a cell is WIDE
  iff it belongs to at least one all-floor 2×2 square; an AREA is a maximal
  4-connected blob of WIDE cells; every other floor cell is a CORRIDOR cell, an
  EDGE* — together with the level-n flood. `partitionMazeAreas` and
  `verifyAreaLevels` keep their names and are ADAPTERS supplying the maze's
  terrain and obstacle readings. `procgenCore/sites.js`'s `chamber` class calls
  the same blob primitive instead of its own copy. ⛔ The maze is byte-identical
  across the move (its dump md5, its nine per-kind CLI md5s, 35 unit rows and
  `check-maze-lab`), and an offline differential compared the two partitions
  field for field over 240 cells with 0 diffs.
- **`--areas=<keys>[;graphify=;goalShortcut=]` ON SEEDLING**, through arc 1's ONE
  codec, on `seedlingModel`/`seedlingSeam`/`generateSeedlingLevel`, the CLI
  (exit 6 on a refused or uncertified graph, the level still printed), the
  sweep and the census. **At `keys: 0` the module is not called at all** — a
  counting spy, not a comparison.
- **THE REALISATION IS ARC 1's LAW**: for every area at key level L ≥ 1, a
  `lock {tset: K{L-1}}` on EVERY BOUNDARY CELL, area-side; the flag is a
  `buttonroom {tset: K, flip:'0', room:'-1'}` at a drawn interior cell of the
  area that holds the symbol. ⛓ **This is what 4c's `wall-does-not-seal` was
  waiting for** — a room with two routes is not cut by one line, and a lock on
  every way in is more than one line.
- **THE GOAL'S VESTIBULE** — a Seedling rule the maze does not need. A corridor
  goal (10–11 of 12 seeds on a bare tree kind) gets a SYNTHETIC one-cell area
  whose only boundary cell IS the goal, and a lock there breaks the COLLECT
  ceremony's approach sweep (trap 348). So the binding DECLARES a ball of radius
  2 around the goal as its area, putting the locks at distance exactly 2.
  `GOAL_MIN_FROM_START = 3` is what guarantees the ball has a frontier. A REAL
  area whose boundary reaches the doorstep REFUSES BY NAME
  (`a-lock-on-the-goals-doorstep`) — never a skipped cell, which would be a hole
  in the cut.
- **THE GUARD'S `buttonroom` IS THE FLAG.** When the graph gives a symbol to the
  element's declared area (`binds=item`, the default) the binding ADOPTS the
  gadget's existing flag — its cell, its group and its tag — and its slice-3
  placeholder lock MOVES from one main-path cut cell to every boundary cell.
  ⛓ Measured: the placeholder's cell is IN the boundary set on **10 of 10**
  cells where both ran, and by construction rather than luck — a 1-cell cut on
  the main path IS a boundary cell of the area it seals.
- **THE TAG RULE, FROM THE ENGINE**: a lock needs *a* tag (`tagOf` answers -1
  for a missing one and `Lock.turnOff()` writes it unconditionally, so an
  untagged lock clears the PREVIOUS level's last slot), and all the locks of ONE
  group may SHARE one (`ButtonRoom`'s local publish LATCHES the group, so they
  transition once, together). ⇒ **two tags per key** — the flag's and the
  group's — plus the guard's three; worst case 8 of `TAGS_PER_LEVEL`'s 30.
- **ACCEPTANCE, PUBLISHED NOT TUNED**: `--areas=1` runs on 0–4 of 12 seeds per
  kind on a 10×10 room, and the dominant refusal is
  `no-area-at-that-key-level-can-hold-its-key` — the entrance and the goal have
  already taken two of the 2–4 areas such a room offers. ⛔ Not a bound to
  widen (⚖ arc-3 ruling 7: the room does not grow); the lever is area, which is
  pass 1's.
- ⚖ **AND SEEDLING'S FIVE CARVED TREE KINDS NOW DEFAULT TO `chambers = 1`**
  (`winding`, `branchy`, `bushy`, `loopy`, `open`; ⚖ user, 2026-08-17) — the
  remedy 4c named for *"pass 2 has no AREA to decorate"*. Measured on the yield
  table before it was picked: kept over the five kinds **4 → 102** (pre-sword)
  and **4 → 105** (post-sword) of 120, against `chambers=2`'s 113 and 103, so
  the smaller k recovers 90% and 102% and is the one that ships. ⛔ The knob is
  the SEEDLING BINDING's (`SEEDLING_PARAM_DEFAULTS`), not `CHAMBERS_PARAM`'s,
  which is shared by reference with the maze. `seedlingSkeletonSpec` is the one
  resolver every Seedling caller passes through, and it runs BEFORE
  normalisation because `winding` and `winding;chambers=0` normalize to the same
  object — the two streams a default has to keep apart. ⚠ **An old
  `?skeleton=winding` link now builds a different room**, and the identity line
  prints the EFFECTIVE spec (`winding;chambers=1`).

### Arc 3, slice 4d — RULE-DIRECTED: `--require=hasSword`, and the kill gate DEMANDS its body's region (2026-08-17)

The slice that lets a caller ask for a property of the WHOLE RUN and be told, by
name, when the room cannot give it — and the slice that found out how often the
generator's own furniture was answering the question for it.

- **`--require=hasSword` NAMES AN ITEM; THE ELEMENT IS DERIVED.** The directive
  looks up the heads whose `ELEMENT_TABLE.needs` include the item (today exactly
  `killgate`), FORCES that head when nobody said `--elements=`, and grades the
  result with the requirements differential run on the FINAL level. A directive
  that cannot be met is a REFUSED RUN with one of seven named reasons and **exit
  6**, with the level still printed. ⛔ A second sword-gated element is a row in
  the table and nothing else — there is no `if (item === 'hasSword')` anywhere.
  ⚠ A directive MOVES THE ROOM at the same seed: the biome default is a `+` list
  that spends a `pick` and a forced head spends none.
- **THE REQUIREMENTS DIFFERENTIAL LEFT THE SCRIPT.** `requirementsFor` moved
  verbatim from `scripts/procgen/batch-seedling-acceptance.mjs` into
  `frontend/modules/seedlingDemo/procgenRequirements.js`; the batch is a caller,
  and its stdout md5 (`ab540ac4…`, unchanged) is both the proof it was a MOVE and
  now a live gate on the lifted code. Grades: STRONG / BOUND-DEPENDENT / WEAK /
  INERT / NOT-ESTABLISHED. **SHORTENS is named and NOT computed** — nothing in
  the pipeline can produce one, and a grade nothing can reach is not a grade.
- ⛓⛓⛓ **THE KILL GATE'S SPINNER WAS DROWNING, AND IT WAS MEASURED BEFORE IT WAS
  FIXED.** Over 224 (kind, arm, seed) cells, ten kill gates placed and certified
  and every one had its lock cleared — **eight by `sword` and TWO by `water`**: a
  gate whose enemy fell in a pool pass 2 painted opens for a reason the level did
  not pose. The predictor was exact (lethal terrain inside the body's own stepped
  path ⟺ `cause:'water'`, 2 for 2 both ways). The gate now declares a **demand**:
  the connected region its body can reach must stay `floor`, and the walls that
  keep it there must stay `wall` (pass 2 may carve). Afterwards: **17 of 17
  `sword`, 0 `water`**.
  ⚠ The body is a DIAGONAL BILLIARD (`SPINNER.heading = -PI/4`), not an
  axis-runner, so the demand is a REGION of 7–26 cells rather than a lane of 2–4.
- ⛔ **AND SEVEN `GenerationAborted` CELLS BECAME REAL LEVELS** (7 of 224 → 0),
  because every abort in the corpus was a lethal pool landing in the same region.
  **The armed-hazard class is NOT fixed** — no `playerPhysicsV2`, `solverBot` or
  oracle line changed; the demand moves which cell meets it. Control: 0 aborts in
  312 non-kill-gate cells.
- **TWO NEW MEASUREMENT INSTRUMENTS, both permanent, both asserting nothing.**
  `find-seedling-seeds.mjs --where='certified,cause=sword,grade=STRONG,kept>=5,
  families>=3,noabort'` searches a seed range by a NAMED vocabulary (an unknown
  property is a usage error, exit 2) and prints each hit with the command that
  reproduces it. `census-seedling-enemies.mjs` puts each of 23 engine-buildable
  enemy classes alone in a room and reports what the solver does.
- ⛔ **THE DEMO SEARCH'S OWN GATE FAILED AND THE NUMBER IS PUBLISHED**: 1 hit in
  40, not the ≥ 3 predicted. `families>=3` is the clause that cuts it (4 → 1).
  The demo row that exists — seed **30** — is the seed the demand rescued: before
  it, that level's lock cleared by `water` and its directive graded WEAK.
- ⛓ **AND THE ENEMY CENSUS'S FIRST ROOM MEASURED THE ROOM.** A body at the centre
  of a 6×6 chamber is walked AROUND: 20 of 23 classes solved at the empty room's
  own tick count. A second arm (a 1-wide corridor the route must cross) is where
  the question is really asked — 20 of 23 REFUSE there. **The one row where a
  `kill` fires is the kill gate's own geometry**, and the same spinner with NO
  lock refuses while one in an open chamber throws (*"live spinners AND a
  DIALOGUED ceremony"*). The kill LOCK is what makes killing the body the goal.

⛔ Byte identities: the battery, the maze, the nine per-kind maze CLI md5s, the
acceptance batch and every committed R8 tape are UNCHANGED (534 / 0 / 67). Three
dump rows moved and each is a post-sword level that held a certified kill gate —
`empty` seeds 29 and 38, `winding` seed 9. Full record in the arc-3 kickoff §15.


### Arc 3, slices 5a and 5b — the PAGE: the three parameters, the LEDGER, the step-through, the overlays, and the DEMO CATALOGUE (2026-08-18)

The two slices that made the arc's work *visible*. As-builts: arc-3 kickoff §16
and §17. Their page-facing halves are recorded above, with the parameters they
added, in *The URL parameters, whole and current* and *arc 3, slice 5b — the DEMO
CATALOGUE, and the four intermediate results*; what a reader of **this** § needs:

- **`?elements=` / `?areas=` / `?require=` REACH THE MODEL** (5a), each through
  the ONE reader/writer in `procgenCore/urlParams.js`, value-claimed page against
  node. ⛔ **ABSENT ≠ `none` on Seedling** — absent is *nobody said* and reaches
  the biome default, so the writer SPELLS `none`. ⛓ Two `procgenCore` defects the
  rows found: `readRequire` **and** `writeRequireParam` were validating against
  the MAZE's area-graph vocabulary, so `?require=hasSword` refused by name; both
  now take a `grammar` (*a codec argument added for one channel is a defect in
  every channel that did not get it*).
- **THE GENERATION LEDGER** (5a), `model.ledger` in
  `seedlingDemo/procgenLedger.js`: one row per phase, appended **by** the phase,
  each carrying its own sentence, its tiles/entities delta, its draw span and its
  refusal by name. ⛔ BYTE-INERT on three separate claims — a counting SPY over
  336 pairs / 0 moved, zero payload mentions, every committed identity unchanged.
  Its cost was measured against its OWN control in ONE process (a cross-tree ratio
  measures the machine, and said 0.94×): **1.078×** at 5a, and after 5b's floods
  a RANGE rather than a point — median **1.048× → 1.129×**, worst observed
  **1.190×** against the 1.25× gate, n = 5 on both builds.
- **THE PHASE LADDER** (5a): phase *k* is everything up to and including ledger
  row *k*, rebuilt from the row DELTAS by `foldLedger` and handed to the EXISTING
  renderer. ⛔ Nothing is re-run and the renderer is not changed. At the last
  pass-1 row the label hands over to the existing pass-2 STEP.
- ⚖⚖ **THE USER'S RULING OF 2026-08-18 IS THE SHAPE OF THE WHOLE THING**:
  *"only display the visual representation when the corresponding TEXT
  DESCRIPTION is selected"*. So every intermediate result is a uniform
  **PAINTABLE** (`{id, label, kind, cells, pick, hue}`) in its ledger row's
  `data`, ONE generic painter draws them, and the phase readout's fact LINES are
  the control. Three cumulative sibling overlays (`seedlingDemo/watchGenOverlay.js`,
  an `afterDraw` callback — `makeRenderer.draw` and `OVERLAY_LAYERS` untouched), a
  legend, ZERO `fillText`, and a DROPPED element draws nothing.
- ⛓⛓⛓ **AND THAT RULING IS WHY 5b COST NO PAGE CODE AT ALL.** 5b carried four
  more intermediate results — the door law's two floods, the level-*n* floods and
  the goal's vestibule, the on-connector candidate funnel, the certification
  solve's route — and `watchViewer.js`/`watchGenOverlay.js` were **not touched**:
  they reached the screen as selectable lines because the painter is generic.
  That is the measurable return on the ruling.
- **THE DEMO CATALOGUE** (5b) — TRACKED, **13 entries** over both lab pages,
  each with its page, the URL the page's own writer spells, the CLI command,
  which phase to step to, which fact lines to tick, which overlay layer, how to
  run it, what is happening, and the ONE claim it asserts.
  `scripts/procgen/check-procgen-demos.mjs` loads every URL in it — **54 claims
  / 0 fail** at the arc's close — so an entry cannot rot quietly. ⛓ 2026-08-18
  (PROCGEN DOCS P1) it became a DATA module —
  `frontend/modules/procgenDocs/demos.js` — with two readers: [the catalogue page](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html)
  and the row, which IMPORTS it rather than parsing markdown — **94 claims / 0
  fail**. [`demos.md`](./demos.md) is now the pointer at both.
- **THE GLOSSARY** — ⛓ 2026-08-18 (PROCGEN DOCS **P2**), ⚖ the user: *"demos.md
  and the demo pages are dense with technical jargon — a new document that
  defines each of the technical terms … covering ALL of procgen, not just the
  Seedling substrate"*. The same shape one module over:
  `frontend/modules/procgenDocs/glossary.js` — **149 terms over 8 areas**, each
  with a plain-language sentence FIRST and the concrete rule (with its number
  and its refusal's own name) second — rendered at
  [**the glossary page**](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/glossary.html)
  and read by four more places: every catalogue entry's `terms:` line, both lab
  pages' header links and section tooltips, and the row, which now stands at
  **108 claims / 0 fail** locally AND against the deployed site. ⛔ The term
  list is a CHOICE from a MEASURED candidate set —
  `scripts/procgen/harvest-procgen-terms.mjs`, **6261 candidates**, of which 315
  touch a page a reader actually opens — and the ones NOT defined are published
  with their reason rather than left silent. ⛔ The lab pages gained a link and
  `title=` tooltips and **nothing else**: all six of their browser rows are the
  number they were (199 / 81 / 61 / 50 / 122 / 57).
- **THE REFERENCE** — ⛓ 2026-08-18 (PROCGEN DOCS **P3a**), and it is the first
  of the three that is **GENERATED rather than authored**. ⚖ The same ruling:
  the docs that are DATA IN DISGUISE become pages that *"interact with the
  scripts directly"*. The two hand-kept URL tables (this file's § *The URL
  parameters, whole and current* and [maze.md](./maze.md)'s § *The URL grammar*)
  are now POINTERS at
  [**the reference page**](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html),
  which renders three modules that
  [`scripts/procgen/generate-procgen-reference.mjs`](../../../../scripts/procgen/generate-procgen-reference.mjs)
  writes out of the code itself: **33 URL parameters** over the two pages (3
  retired, 4 codecs), the whole **generation catalogue** (3 biomes · 8 template
  rows · 12 excluded · 3 element heads · 18 skeleton kinds, with the codec's
  defaults AND the binding's effective ones side by side), and the **refusal
  vocabulary** — **101 names** over 10 sources, 27 of them from a list constant
  and 74 literal-scanned. ⛔ **The rule is `--check` = regenerate-no-diff**, the
  same shape as a recorded md5, and the generator NEVER edits the code it reads:
  where a hand-kept list and the code disagree the page prints the code's answer
  and NAMES the disagreement — which is how P3a found that
  `the-tunnel-shortens-the-way-to-the-goal` fires in
  `procgenSeedlingElements.js` and is missing from `SEEDLING_ELEMENT_REFUSALS`,
  so a census keyed on that constant cannot count it. The row is
  `scripts/procgen/check-procgen-reference.mjs` — **19 claims / 0 fail** — and
  the lab pages gained a third header link and **nothing else**.
- **THREE MORE GENERATED TABLES** — ⛓ 2026-08-18 (PROCGEN DOCS **P3b**), and
  the new thing is *where they live*: two of them belong in files people read
  ON GITHUB, so a `.md` can now carry a **GENERATED REGION** between two
  markers — its prose is untouched, only the region is written, and `--check`
  gates the region exactly as it gates a module. The three are the
  **substrate-registry capability matrix** (8 entries × 60 fields, grouped by
  `substrate-registry.md`'s own `###` headings — the rows are
  `Object.keys(entry)`, so a field a substrate grows appears without an edit;
  the hand-written annotations the code does NOT carry stay in a labelled
  table outside the region), the **instruments index** (one row per
  `scripts/procgen/*.mjs` — **221** of them, with the one-liner from each
  file's own docblock, the flags it reads out of `argv`, whether it drives a
  browser, and which document cites it) and the **documentation index**
  (README's whole table: 17 documents in a declared reading order + the 3
  pages, each described by its OWN first paragraph). ⛔ Six generated tables,
  three markdown regions, **470 rows on the page**, row **20 / 0** local and
  **18 / 0** on Pages. ⛓ 13 findings joined the page: 8 registry fields the
  reference documents nowhere, a script with no docblock, four citations that
  point at no file in `scripts/procgen/` — and the matrix contradicted the
  prose above it, which said the driver-facing adapter hooks were bounce's
  alone when runner carries **15 of the 18**. ⛓ Comparing README's hand
  descriptions against each document's own opening also gave four documents a
  better first paragraph (`architecture.md`, `substrate-registry.md` — which
  still said SEVEN registered entries — `jta.md`, and this file, whose H1 was
  eight rungs stale).
- ⛓⛓⛓ **AND THEN THE FINDINGS WERE FIXED** — 2026-08-19 (PROCGEN DOCS **P5**),
  ⚖ the user: *"first, let's fix the issues we discovered so far"*. The three
  generated tables between them PRINTED **19** disagreements between a
  hand-kept list, a document and the code, and every one is now fixed **in the
  thing it was about**: the page's finding count is **19 → 0**, and `#findings`
  says so in words rather than rendering an empty section. What moved:
  `SEEDLING_ELEMENT_REFUSALS` names the refusal it was missing and its docblock
  says out loud that it is a CENSUS KEY for the element PATH (three of its names
  fire one module over); `areaGraph.REASONS` is EXPORTED and
  `procgenSeedling.js`, `procgenMaze.js` and `elementSpec.js` each grew the
  census key they never had; **`urlParams.js`'s 26 unnamed refusals have
  NAMES** — `fail(code, message)` at every site, `URL_PARAM_REFUSALS` as the
  list, and every message byte-identical; six registry fields, four bare script
  citations and one missing docblock are documented; and the glossary's ceiling
  moved 140 → 149 for the seven URL parameters whose term cell rendered BLANK.
  ⛓ The durable half is the GATES, not the edits:
  `procgenCore/refusalCensus.test.js` asks every census key to cover the literal
  scan of its own source — using the generator's PATTERNS but never its OUTPUT,
  because a table agreeing with itself proves nothing. ⛔ NOT fixed and NAMED:
  `procgenOracle.budgetKindFor` composes its answer into a sentence, and
  `budgetKind` reaches the trace whose sha is a determinism payload, so naming
  it would re-record a committed artifact.

- ⛓⛓⛓ **AND THEN THE NARRATIVE DOCUMENTS WENT ON PAGES TOO** — 2026-08-19
  (PROCGEN DOCS **P4**), ⚖ the user. Until now only the three GENERATED pages
  were readable on the site; the seventeen `.md` files that hold the actual
  record — this one included — were readable only on GitHub. Now
  [**the documents page**](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/docs.html)
  renders every one of them, with GitHub's heading anchors, a nav in README's
  declared reading order, a contents off the render, and **every relative link
  resolving somewhere a reader can click**: a sibling `.md` stays in the viewer,
  a `frontend/**.html` goes to the live page, everything else in the repo goes
  to a GitHub blob. ⛔ Nothing is pre-rendered and no document is copied into
  `frontend/`: the page FETCHES the tracked file, and the deploy stages the
  directory into the artifact — so **the file in this directory stays the one
  and only source**. `?doc=` is allow-listed by the generated index and refuses
  anything else by name.
  ⛓ The measurements that made it honest: the corpus is **211 links** (144
  sibling · 32 repo, all of which exist · 22 http · 13 same-doc · 0 pages) and
  the census found **two dead fragments**, both plain typos and both dead on
  GitHub too — now fixed. The anchor rule lives in `ghSlug.js` and is still
  pinned by six links nobody in these slices wrote. ⚖ GitHub's `-N` duplicate
  suffix is REACHED here (8 collisions, all in this file) but **nothing tracked
  links to one**, so it ships documented and unpinned, and a test says so.
  ⛓ The defect worth carrying off: `marked` reads a heading's TEXT CONTENT and
  the source reader read the SOURCE, and over 600 headings they disagreed
  **once** — a heading in this file containing `[maze.md](./maze.md)`, where
  GitHub keeps only the link text. Two readers now agree 600/600 and the render
  re-checks them, refusing by name rather than shipping anchors nothing points
  at. `check-procgen-docs.mjs` is the gate: **128 claims off the DOM**, green
  locally and on the deployed site. This file renders in **171ms**.

#### The ledger's phases and paintables, as of the arc's close

⛔ This supersedes arc-3 kickoff §16.5's table, which was written before 5b and
is one row short: **a REFUSING realisation now writes a row** (three exits — the
doorstep refusal, the door-law refusal and the level-flood mismatch — each
carrying the refusal by name, and the mismatch carrying the level flood that
disagreed). Sizes are for a 10×10 room.

| phase | paintables (`id`, typical size) |
|---|---|
| `goal` | `goal-candidates` (58 on the open room; pick = the goal) |
| `element-head` | *(none — a head draw has no cells)* |
| `pre-carve` | `site-candidates` (3 at `len=2`; pick = the site taken) · `site-picked` (16 = 4×4) |
| `carve` | *(none — the carve's result IS the row's tiles delta)* |
| `on-connector` | `main-path` (10) · `door-cell` (1, pick) · `clearer` (0–1) · `demand-region` (15 on the kill gate) · **5b:** `door-candidates-offered` (8) ⊇ `door-candidates-tried` (7) ⊇ `door-candidates-legal` (6) |
| `composite` (pre-carve) | `tunnel` (0–6) · `reserved-rect` (36 = 6×6) · `flag-and-lock` (2, pick = the flag) · **5b:** `flag-lock-flood-start` / `flag-lock-flood-goal` · `carve-mouth` |
| `composite` (on-connector) | `owned` (9) · `pocket` (0–1) · `demand-region` (15) · **5b:** `door-flood-start` (16) · `door-flood-goal` (40) |
| `partition` | one `area-<id>` per area, 1–40 cells (outline when SYNTHETIC) |
| `graph` | *(none — the graph is over AREAS, not cells)* |
| `realisation` | `area-locks` (7 on the accepting subject) · `area-flags` (1) · **5b:** `goal-vestibule` (7) · one `level-<n>-reach` per key level (19 / 42) · on the doorstep refusal, `goal-doorstep` with the offending lock as the pick |
| `certification` | **5b:** `certification-route` (10, drawn ONLY when the solve HELD) |
| `area-certification` | *(none)* |

⛔ **THE FLOODS ARE ON THE PHASE THAT ASKS THE LAW OF THE COMMITTED PLACEMENT**,
which is `composite`, not the `on-connector` row that runs before the pick — the
ledger is what settled that. ⛔ **The route's GAPS are counted and named, never
bridged**: the trace merge lets a substantive decision outrank a `walk` on a
shared tick, so a stance walk's corridor is missing and the route jumps; a
straight line between two ends the solver never walked would be the picture
inventing a route (R9's, under an attributed licence). ⛔ **One paintable is
computed rather than carried and the code says so**: the guard's
`flag-lock-flood-*`, because `flagLockCellFor` adjudicates with an early-exit
`connected` that builds no set. ⛔ **The fifth intermediate result is
deliberately NOT here**: pass-2's per-anchor refusals stay `out.trace`, and the
ledger does not duplicate the pass-2 half.

### ⛓⛓⛓ ARC 3 IS CLOSED (2026-08-18)

Fourteen slices — 1 · 2 · 2b · 2c · 2d · 3 · S1 · 4a · 4c · 4b · 4d · 5a · 5b ·
5c — over `4e0ac0690`..`main`. §7's eight acceptance gates are answered one by
one in arc-3 kickoff **§18**, which also carries the arc's whole RESIDUE in one
deduplicated list (for R9, for arc 4, for arc 5 and for the user). ⚠ NewDocs is
gitignored; this § is the tracked record.

**What the Seedling generator IS now**, in one paragraph. Pass 1 draws the GOAL
at Manhattan ≥ 3 from the start, then an ELEMENT head from the biome default
spec (`guard;len=2|3|4+blockpocket+chamber;w=2;h=3`, `+killgate` post-sword — a
`+` list is a CHOICE, and `len=2|3|4` is a SUBSET the guard draws ONE value from), builds any `pre-carve` element, runs THE CARVE (the five carved tree
kinds defaulting to `chambers = 1`), builds any `on-connector` element against a
read-only room probe, optionally partitions the room into AREAS and realises an
area GRAPH (locks on every boundary cell, the goal in a radius-2 vestibule),
composites, and CERTIFIES the result with the substrate's own solver — a failure
is a graded refusal by name and the element is DROPPED, never shipped
uncertified. Pass 2 is the same keep-or-revert loop it always was, now
site-typed, with a door = CUT law and bounded carving, over a roster that is
**23/23 instantiations across three DECORATION families**. The whole
construction is recorded in a byte-inert LEDGER the lab page steps through, and
every demonstrable piece of it has an entry in [the demo catalogue](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html) (its data in `frontend/modules/procgenDocs/demos.js`, pointed at by [`demos.md`](./demos.md)).

**The numbers that define it** (each stated where it was measured, above):
guard certified **32/34** · block pocket **36/36** · kill gate **6/28**
post-sword, and **17/17** of its certified clears caused by `sword` after the
demand (2 of 10 were `water` before) · killgate census **90/120**, block pocket
**76/120**, guard **21/360** · pass-2 roster **41/45 → 23/23** · `chambers=1`
kept **4 → 102** (pre) / **4 → 105** (post) of 120 · `--areas=1` accepts on
**0–4 of 12** seeds per kind, tag budget **2 per key**, worst case 8 of 30 ·
door law vs the retired span predicate, **0 disagreements** over 40 seeds × 20
instantiations · the maze's own symbols **148 cuts / 148** · ledger cost median
**1.048× → 1.129×**, worst **1.190×** · demo catalogue **13 entries, 54/0**.

**What did NOT move, at every slice**: the R8 battery md5
(`1fedb0ab35b7cd74accecf0345bdc893`, exit 1), the maze byte-identity dump, and
every committed R8 tape (`534 PASS / 0 FAIL / 67 SKIP`, zero moved) — at every
code-touching slice of the arc, the SOLVER slice S1 included. ⛔ The oracle's catch was never
widened; every named widening is one class with its own code
(`HAMMER_SAFETY`, `STRIKE_BOUND_EXHAUSTED`).

**What is NOT fixed, and is named rather than smoothed**: the DROWN /
armed-hazard engine class (`drownTimer` never resets off-hazard and the planner
treats an armed hazard as forbidden floor) — the kill gate's demand took 7
aborts to 0 by moving which cell meets it, not by fixing it, and 1 abort in 160
survives under the shipped default · the kill gate's 22 refusals, one
pre-existing solver class, so **6/28 is the number to beat** · the trace MERGE
eating a stance walk's corridor · the maze's pass-2 `door-key`, still not
cut-checked. All of them, with their §§, are in arc-3 kickoff §18's residue list.

**Next**: ⛔ **arc 4 is THE CHAIN — a bent push path on Seedling — and it stays
ASK-FIRST** (⚖ design ruling 17 / arc-3 ruling 1). `turns > 0` refuses
`the-chain-is-arc-4` by name today and spends no draw, which is the seam it will
land in. **Arc 5** is shortcuts / density / arenas, and it already owns four
named items: the room-aware SITE PICK (which is what recovers the guard's
29 → 21), ELEMENTS-as-area / density / arenas (the area COUNT on a 10×10 room is
the ceiling on everything the area graph can accept), the differential's
SHORTENS grade, and an EXACT (stepped) demand for a moving body.

### Arc 5, slice 1 — THE ROOM CONTRACT: a configurable size (≤ 60×60) and the sparse SHELL format (2026-08-19)

⚖ The user's arc-5 rulings 1 and 2 changed what the Seedling generator may
EMIT, so the tracked record says so here rather than waiting for the arc's
close. ⛔ Both channels are OPT-IN and every default is byte-identical: the
committed battery, the maze byte-identity dump, the acceptance batch, the
`empty` and carved pair dumps and the generated set are unmoved, which is the
claim, not a hope.

**The size.** `?width=`/`?height=` on the watch page and `--width=`/`--height=`
on `generate-seedling-level.mjs` reach `seedlingModel` through the `defaults`
argument it has always taken. The DEFAULT stays **10×10** — one screen, and the
room every committed artifact was recorded in — and each axis is refused BY NAME
outside `[3..60]`, never clamped. **60 is a measurement of the shipped game**:
over the 116 levels of `flashPanel/atlases/seedling-map.json` the widest is
40×60 and the tallest 60×58. ⚠ A size is a CONSTANT INPUT and not a draw, so a
NAMED `width=10` builds the identical room to an omitted one, cell for cell —
the opposite of an element parameter, where NAMING it spends no draw and
omitting it spends one. `--sizes=` is a Seedling axis on `sweep-yield-table.mjs`
and `census-seedling-sites.mjs` now; a number measured at 10×10 is not a number
about 20×20.

**The fill.** `?fill=shell` / `--fill=shell` writes the floor, the wall cells
8-adjacent to it, and **nothing beyond** — vanilla's own sparse form (27 of the
116 vanilla levels are sparse, down to 20 % filled). ⛔ **NULL IS NOT WALL**:
`levelWorld` builds its solids only from the entries a record HAS
(`levelWorld.js:4041`) and the real recompiled game does the same, so an absent
cell has no collision in either runtime. Hence **THE CLOSURE LAW** — *no floor
cell may be 4-adjacent to an absent cell* — asked of every shell record and
refused by name, and a pass-2 CARVE next to an absent cell refused for the same
reason (a carve is the only pass-2 write that can open a room onto nothing).
⛓ The room is generated **DENSE and STRIPPED at the end of a pass**, never
mid-pipeline: the carve's frozen `base`, the seal flood, the element's demand
and the certification solve all keep reading the dense room, and every
`must:'wall'` cell of an element's demand is ASSERTED to survive the strip
rather than argued to.

**What the strip buys, measured.** It drops wall cells nothing in the room can
reach, so the answer depends entirely on how much solid wall the carve left:
**0 %** on an open bordered room (every ring cell touches the interior),
~38–50 % of the record's bytes on a 10×10–20×20 `winding` room and **82 %** on a
40×40 one, and ~0–4 % on `rooms`/`bushy`, whose interiors are mostly floor. The
strip is 8-adjacent and therefore CONSERVATIVE: an axis-aligned box that
overlaps a floor cell's diagonal neighbour also overlaps both cells they share
an edge with, and those are kept under either rule — so the diagonal walls are
kept because multi-solid collision resolution is `levelWorld`'s claim to make,
not this format's.

### Arc 5, slice 2 — THE ORIENTED SITE PICK, and an EXACT DEMAND MEASURED AND REFUSED (2026-08-19)

**The site pick.** A `pre-carve` element used to be offered a SQUARE: the
Seedling binding sized it `len + SITE_MARGIN_STRAIGHT` on both axes because
that is the longest extent a straight reverse-pull gadget has. Across the pull
axis the gadget never needed more than `EXIT_RUN + 1 = 4`. ⇒ the ELEMENT now
declares its own **snug footprint per orientation** — an optional
`footprint(values) → [{w, h, orient}]` on the element contract — and
`seedlingElementSiteCandidates` enumerates every orientation, row-major, with
the draw still ONE `pick` over a longer list. A len-4 gadget is offered `6x4`
AND `4x6` where it used to be offered `6x6` alone.

**What it recovered, same census, same command** (`census-seedling-elements
.mjs`, 10 kinds × 12 seeds × len 2/3/4 = 360 cells, 10×10):

| | before | after |
|---|---|---|
| DRAWN `PLACED` | 21 of 360 | **62 of 360** |
| `no-site-fits-this-room` | **130** of 360 | **0** |
| placements at `len = 4` | 0 on every kind | 22 |
| orientation drawn | — | `wide` 29 · `tall` 23 · `square` 10 |

⛓ Arc-3 §18.2 C1 asked for exactly this and predicted "recovers most of" the
29 → 21 the goal draw cost. It recovers all of it and doubles it. The `len = 2`
rows are UNMOVED, cell for cell, because at `len = 2` the snug footprint IS the
4×4 square the binding already sized — which is the control that says the whole
recovery is the orientation and nothing else. The census gained a `--sizes=`
axis with it: PLACED is 62 / 71 / 78 / 128 at 10×10 / 12×12 / 15×15 / 20×20.

⛔ **AND NO COMMITTED ARTIFACT MOVED — ⚖ ruling 6's ONE re-record is NOT
SPENT.** `defaultElementsFor` pins the biome default's guard at `len = 2`, so
no default run draws a footprint that differs from the square. The battery, the
maze byte-identity dump, the acceptance batch, both `empty` pair dumps and the
145 carved rows are byte-identical. ⚠ An earlier form of the change carried the
orientation LABEL inside the site object, which rides `summary.elements.placed[]
.site` and `certification.geometry[].site` into every payload holding a guard:
the batch's seed-12 row moved, and a field-by-field diff of that payload found
**two added keys and not one moved cell**. The label lives beside the site on
the model instead. A payload-shape mover and a behaviour mover are the same md5
(trap 375); only the row diff tells them apart.

**The exact demand — §18.2 C4, MEASURED AND REFUTED.** C4 asked to replace the
kill gate's `bodyRegion` flood with the body's own STEPPED path, priced at "one
false positive in ten". Three measurements closed it the other way:

1. **The stepped set is a function of a TICK BOUND, and the bound is the
   solver's.** The 400 it was measured at is `DEFAULT_BUDGET.maxTicksPerTarget`
   — how long the SOLVER may spend on one target. Stepped longer, the set grows
   into the flood and reaches it *exactly*: `empty` seed 29 is 25 / 37 / 40 / 40
   cells at 400 / 800 / 1600 / 3200 against a 40-cell region. On all 7 corpus
   gates the difference is 0 by tick 3200, and the stepper never leaves the
   flood at any bound. ⇒ the flood is not an over-approximation of where the
   body goes; it is the LIMIT of it.
2. **So the published "24 % over-forbidding" is a bound artefact** — those are
   cells the body reaches after tick 400, not cells it never reaches.
3. **And relaxing costs levels.** A build that switched turned 3 rows of the
   410-row committed corpus from levels into `GenerationAborted`: pass 2
   painted a `water-pool` in a cell only the flood forbade and the PLAYER
   DROWNED walking the kill. ⛓ The SAME build with the bound at 4000 reproduces
   every committed row byte for byte — which is what says the BOUND, not the
   switch, is the mover.

### Arc 5, slice 3 — ELEMENTS-AS-AREA: the `chamber` element, and C11's law (2026-08-20)

**The element that is SPACE.** Slice 1 measured the hole rather than argued it:
a bare TREE kind accepts `--areas=2` on **0 of 264** cells at 10×10, 15×15,
20×20 *and* 30×30 alike, refusing throughout with
`no-area-at-that-key-level-can-hold-its-key`. A bigger tree room grows
CORRIDOR, not areas — `winding`'s corridor sites go 10 → 51 from 10×10 to
20×20 while its chamber count stays 1. What a tree kind lacks is a PLACE.
`procgenCore/elements/openChamber.js` is one: a `pre-carve` element whose whole
geometry is an open `w × h` floor blob DECLARED as an `area`, with a mouth a
connector can attach to and **nothing else** — no block, no button, no door, no
symbol, no tag, no `binds`, no `needs`. Two geometry draws, always (the mouth's
side and its offset; the exit port is the mirror and spends none).

⛔ **NO SECOND PARTITION MECHANISM.** The blob reaches
`partitionAreas({declared})` through the very line the guard's area reaches it
by; `areaPartition.js`, `areaGraph.js` and `sites.js` are untouched. What the
BINDING learned is that an element may be space: `compositeSeedlingElement`'s
flag/door/lock clauses are the GUARD's half and are skipped for a placement
that declares no obstacle, the entity mapping returns the EMPTY realisation and
spends none of the 30 persistence tags, and the "adopt the element's flag" test
now asks whether the element HAS one. Every check about the ROOM still runs.

**What it buys, per kind at named sizes** (12 seeds × 2 biomes = 24 per cell,
`--areas=1`; the biome default is 0/24 on every bare tree kind at 10×10):

| 10×10 | winding | branchy | bushy | loopy | open |
|---|---|---|---|---|---|
| biome default | 0 | 0 | 0 | 0 | 0 |
| `chamber` (drawn) | 0 | 2 | 0 | 0 | 2 |
| `chamber;w=2;h=3` | **4** | **8** | **2** | **4** | **4** |

⇒ all five bare tree kinds rise above zero — **with a NAMED spec, and only 2 of
5 with the drawn one**, because the `w`/`h` domain runs to 6 and a 6×6
chamber's reserved rectangle is the whole interior of a 10×10 room. A pinned
(or drawn-over-its-whole-domain) default hides a real improvement. `keys=2` is
unmoved: one chamber is ONE area.

**C11, ruled and shipped with its test.** *A dropped area-bearing element takes
its declared area with it — the partition re-runs without it and the graph
re-adjudicates; a refusal there is the level's honest grade, by name.* It holds
by construction (`declaredAreas` derives from `elements.ran`, and the drop
rebuilds the model), so what shipped is the ROWS: the dropped partition is
compared against an INDEPENDENT flood of the dropped room's live floor, `E0`
appears in no area, adjacency or lock, and the graph refuses by name. Not
vacuous — over the five tree kinds × 12 seeds at 20×20, **44 of 44 runs that
accept with the chamber refuse without it**, every one with
`no-area-at-that-key-level-can-hold-its-key`. And a real generated level
reaches it: `winding` seed 5 at 20×20 fails its certification
(`the-goal-approach-is-blocked`), drops the chamber, and ships as the graded
refusal.

**Cost and certification, against the biome default** (yield table, 120 cells
each): the chamber PLACES 70/120 and certifies 68 of those (the default:
60/120, 53); `--areas=1` acceptance goes **4/120 → 45/120**, every accepted
graph also certifies, and the sweep costs **+33% wall clock**. Nothing threw,
timed out or was harness-failed in either arm.

⛔ **`chamber` IS OPT-IN ONLY** — it joins no biome default this arc, and every
committed identity is byte-identical.

### Arc 5, slice 4 — ARENAS: `bodies = n` priced before it was offered, and the four-mouth contract (2026-08-20)

**The chamber weaponised.** `procgenCore/elements/arena.js` is the open
chamber's own blob — the same footprint rule, the same declared
`area`, the same four mouths, built by the same two IMPORTED functions — with
`bodies` spinners standing in it and a KILL LOCK the BINDING puts on a cut of
the room's main path, opened by the game's own `totalEnemies() == 0`. The
import list is the proof it is not a fork, and a unit row asserts the two
elements' tiles, area and eight ports are equal object-for-object at the same
seed.

⛔ **THE LOCK IS NOT ON THE BLOB'S MOUTH**, which is where the brief put it: the
binding walls the site's ring and opens exactly ONE mouth, so a lock standing in
it seals the bodies away from the player, `totalEnemies() == 0` never becomes
true, and the gate never opens. It goes where the guard's own `Lock`(B) goes, by
the same function — the main-path cut nearest the goal that leaves the element's
entry mouth on the START's side. One function, two callers, each naming its own
lock (`no-cut-for-the-kill-lock` beside `no-cut-for-the-flag-lock`).

**`bodies = n` — COST FIRST (⚖ ruling 9), and the domain is what the cost said.**
In the arena's own hand-drawn room (a corridor with a `tset:-1` lock in a cut
and a 5×5 blob hanging off the mouth), holding everything but the count fixed:

| bodies | outcome | ticks | ms |
|---|---|---|---|
| 0 (control) | SOLVED | 129 | 34 |
| **1** | SOLVED | 462 | 600 |
| **2** | SOLVED | 602 | 1060 |
| **3** | ⛔ REFUSED | — | 2188 |

⇒ the domain ships as **{1, 2}**. At production scale (64 yield-table cells per
arm) two bodies cost LESS wall clock than one (363 s vs 508 s) with fewer aborts
— a refusal is cheaper than a solve. ⛓ And the certification column across those
two arms is NOT attributable to the count: a `pre-carve` element is constructed
BEFORE the carve, so one extra `pick` per body re-rolls every draw the carve
makes (measured: same goal on 32 of 32, same site on 32 of 32, **different carve
on 8 of 32**). *A parameter that changes an element's draw count re-rolls
everything drawn after it, so a two-arm sweep over it is not a paired
comparison.*

**A10 reproduced, and the body class is the census's choice rather than the
design's.** The same fixture with the lock REMOVED, per class, 23 classes read
from the engine's own table: `spinner` **THROWS** *"level 900 holds live spinners
AND a DIALOGUED ceremony (torch) is running"*, and 20 of the other 22 SOLVE at
the empty room's own 129 ticks — a body in a side room nobody must enter is not
an obstacle at all. WITH the lock, `spinner` is the ONLY class that solves:
a `tset:-1` lock needs a body the solver can kill, and `KILL_ARM_POLICY` calls
exactly one class `modelled`. ⇒ no class is an OBSTACLE without a lock — the 20
lock-less solves are the empty room's own solve, tick for tick — so the
plain-chaser arm is named for R9 with its refusal text rather than forced.

**The four-mouth contract** (slice 3's named carry). A blob element declares ONE
MOUTH PER SIDE — the drawn one first, the other three derived from it — and the
BINDING takes the first whose cell is not the room's border ring. Still two
draws; still *refuse rather than redraw*. `the-entry-mouth-is-the-rooms-border-ring`
goes **28 → 0** at 10×10 and 7 → 0 at 15×15, `the-entry-port-cannot-be-joined` is
UNMOVED at 35 and 28, and a chamber PLACES on 37 of 84 cells at 10×10 where it
placed on 14. ⛓ It is a STRICT EXTENSION, measured: over 252 (kind, size, seed)
cells, 35 rows change and **every one of them was a refusal before** — all 107
previously-placed levels are byte-identical.

**The arena's own ceiling, published rather than tuned.** 49–70% of its refusals
are `no-cut-for-the-kill-lock` — the room's main path offers no single-cell cut
that is not the goal's doorstep — because unlike the KILL GATE its lock does not
GROW a wall to make one. Of the placements that survive, 2 of 20 certify, and 11
of 13 certification failures are the solver's press arm (*"the kill work order
has no weapon"*) failing to find a strike opportunity inside a small blob. Both
are named for a later slice; nothing here tunes a solver.

⛓⛓⛓ **AND ONE SHIPPED TO THE REAL GAME AND AGREED PER TICK** (⚖ ruling 5's
per-family row, HEADLESS, via slice 3's `--elements=`-parameterised arm):
`branchy` seed 11 at 15×15 — the shortest of the three certified candidates over
6 kinds × 16 seeds × {12×12, 15×15} — **`agrees per tick (516 observations)`** in
1698 s, with the sentence's own count checked against two independent accounts of
the same run and the 900→0 remap witnessed at every observation. The room that
went to the game had `heldAtDoor: true`: one of that arena's own bodies cleared
its kill lock before the crossing.

⛔ **`arena` IS OPT-IN ONLY** — it joins no biome default, and every committed
identity is byte-identical. ⚠ One behaviour DID change: it carries
`needs: ['hasSword']`, so `--require=hasSword` now forces the `+` list
`killgate+arena` instead of a bare `killgate`, and a list spends one `pick` where
a bare head spends none.

### Arc 5, slice 5 — SHORTENS COMPUTED AT LAST: the shortcut law, the grade REACHED on the maze, and the Seedling venue REFUTED (2026-08-20)

**The fifth grade stopped being a promise.** Arc 3 NAMED `SHORTENS` — *both arms
solve, fewer ticks WITH the item* (design §4.5) — and deliberately did not
compute it, on trap 355's rule that *a grade nothing can reach is not a grade*:
nothing in the pipeline granted a shortcut. This slice computed it, reached it
on generated levels, and the arithmetic lives in ONE place for both substrates
(`procgenCore/differentialGrade.js`) because SHORTENS arrived on both venues on
the same day, which is exactly when a second spelling of *which arm is cheaper*
would have got in. Seedling's `procgenRequirements.gradeOf` hands it TICKS; the
maze's `mazeCostRecords` hands it BFS PLAN LENGTH.

**THE SHORTCUT LAW, SPELLED ONCE, BESIDE THE DOOR LAW AND NOT INSTEAD OF IT.**
`gridFlood.shortcutLawRefusal` is arc-3 §9's door law with clause 1's quantifier
FLIPPED, in the same argument shape so neither law can be handed a picture of the
room the other never saw. Four clauses: the open half, **still connected**
(walled, the goal REMAINS reachable — else it is a DOOR and the cut law is its
rule), **strictly shorter** (else the lock is decoration with a key in front of
it), and start-side. ⛔ It costs `shortestPath` TWICE where the door law costs
one early-exit `connected`, and that is the price the fifth grade charges.

**⛓⛓⛓ THE MAZE REACHES IT.** `areas=<n>;shortcut=1` (default **0**, so every
committed `--areas=` payload and all nine per-kind CLI md5s are byte-identical)
puts a `door_SC` on a cell that is not a cut and a `key_SC` where the player can
reach it without using the door. Four generated levels witness the grade:

| command (`generate-maze-level.mjs --skeleton=rooms --areas='1;shortcut=1'`) | with the key | without | grade |
|---|---|---|---|
| `--seed=8 --width=11 --height=11` | **37** | **39** | **SHORTENS** |
| `--seed=2 --width=15 --height=15` | 43 | 45 | **SHORTENS** |
| `--seed=1 --width=20 --height=20` | 57 | 59 | **SHORTENS** |
| `--seed=10 --width=20 --height=20` | 67 | 69 | **SHORTENS** |

⛓ **And the NEGATIVE rows are real levels too, which is better than a mutant.**
Seed 9 at 11×11 places a shortcut the TERRAIN law accepts (geometry 4 open, 26
walled) whose BFS without-arm cannot solve at all — the route to the OTHER key
runs through it — and the grade says **STRONG**: *a cut graded STRONG never
SHORTENS*, witnessed. `gridFlood`'s standing blindness is that ENTITIES ARE NOT
TERRAIN, so a cell the law calls a cycle edge can be a cut of the OBSTACLE graph,
and the GRADE is what catches it. Seed 1 saves two steps of geometry and **zero
of plan** (20 either way) and grades INERT.

⛔ **A SHORTCUT LOCKED BY AN EXISTING `K{n}` IS UNGRADEABLE, AND THAT IS A
RESULT.** ⚖ Design ruling 16 spells the post-solve shortcut as an edge *locked by
K_goal*; on this substrate `door_K{n-1}` also sits on every boundary cell of
every area at level `n` and the goal is at the highest level, so removing
`key_K{n}` seals the goal and the symbol grades STRONG. The same argument kills
every symbol on the solution path — which is all of them. The only symbol whose
differential can SEE a shortcut is one whose ONLY doors are the shortcut's.

⛓⛓ **THE `graphify` ARM IS EMPTY ON EVERY MEASURED ROOM.** The brief's letter is
*a door on a recorded graphify edge*, and those edges name CORRIDOR COMPONENTS —
one-wide by the partition's own definition, so walling one cuts its corridor.
Over `rooms` × {11, 15, 20} × seeds 1..8 at `graphify=1` the recorded edges
offered 14, 8 and 27 cells and **every one failed the law**. What places is any
free floor cell the law accepts, and `via` records which arm. ⛔ It cannot
trivialise anything: this is not an extra EDGE, it is an extra OBSTACLE on a cell
that already exists, and a clause of its own proves it takes NO cell off the
level-n flood.

**⛔⛔⛔ AND THE SEEDLING VENUE IS REFUTED, ON THREE MEASUREMENTS.** The element
(`procgenCore/elements/shortcut.js`) is complete — the kill gate with one law
swapped — and is **NOT registered as an `elementSpec` head**, because a
registered `--elements=shortcut` would ABORT a real generation with an engine
THROW rather than refuse by name. Each probe is a loop room whose short arc
carries the blocker and whose long arc is clear:

| blocker | measured | why |
|---|---|---|
| `breakablerock` | **both arms 244 ticks** (empty room: 129) | the solver DERIVES no break — a rock press is named by OEL coordinate in a hand-written leg, and `refineStrategy`'s verbs are `shove`/`weigh`/`kill`. To this solver the rock is a WALL, sword or no sword |
| kill lock, long arc past the body | **both arms REFUSED** | *"the combat ladder is EXHAUSTED … the corridor passes through danger"* |
| kill lock, long arc clear | **both arms THREW** at tick 215 | ⚖ §11.8a's ladder prefers AVOID over KILL, so the walk goes round and reaches the goal with the spinner ALIVE — `assertDialogueFreeSpinnerRoom`, A10 for the fourth time |

⇒ **a spinner nobody is FORCED to kill cannot ship, and a shortcut is by
definition a level where nobody is forced.** The chain closes: the differential's
only Seedling candidate is `hasSword`, the only solver verb `hasSword` gates is
`kill`, and an optional kill throws at the ceremony. It is slice 4's *"the kill
LOCK is load-bearing"* read one turn further — the arena is solvable for exactly
the reason the shortcut is not. The head is ONE LINE on the day R9 lands a
derived break verb, a ladder that will pay a cheap kill, or a non-dialogued goal
class. ⛓ Because it is unregistered, `--require=hasSword` is **UNMOVED** at
`killgate+arena` and no directive subject was re-scanned.

> ⛔⛔⛔ **R9 SLICE 4 LANDED THE DERIVED BREAK VERB, AND THE GRADE DID NOT
> MOVE — there is a FOURTH wall, and it is structural.** Re-measured with
> `break` registered and driving route step 12:
> `probe-seedling-shortcut-grade.mjs` returns **244 / 244** on the two shortcut
> arms and **129** on the control, to the tick. **A verb is selected only from a
> `planError`** — the frontier walk that names an obstacle runs inside
> `solveSegment`'s plan-failure handler — and a shortcut is BY DEFINITION a cell
> whose walling leaves the goal reachable, so the planner never refuses and no
> verb is ever selected. ⇒ on Seedling an item-gated obstacle grades **STRONG
> when it CUTS** (the same probe's fourth arm: 157t with the sword, REFUSED
> without) and **INERT when it does not**, with nothing in between. SHORTENS
> needs a solver ROUTE PREFERENCE that spends a verb to shorten a walk it could
> already make — which MOVES TAPES, so it is a ⚖ ask. The head therefore
> STAYS OUT (trap 462, sharper), and the REACHABLE Seedling head is a **ROCK
> LOCK** — a `breakablerock` on a main-path CUT, `needs:['hasSword']`, no live
> body and therefore no A10. See the R9 § below.

**`PREFER_DISCHARGE` RETIRED ON THE MAZE, AT A MEASURED ZERO** (⚖ arc-5 ruling 4).
`census-maze-keeps.mjs` swept the policy's OWN subjects — the maze's directed
attempts, 9 kinds × seeds 1..6 × steps {0, 2} × all 18 enumerated instantiations
of both v1 templates — and counted the `solved-only` class at **0 of 1944**, zero
STRUCTURALLY: the v1 palette declares no verb on either template, so
`walkAnchors` reads the discharge as `NO_VERB` and never as `solved-only`. Every
maze directive now runs under `first-solved`, an old spec asking for the retired
policy REFUSES by name, and `keptKind` stays on the record as `null` — which is
what that policy has always meant.

⛔⛔ **And the md5-identity proof does NOT gate that retirement, which is worth
knowing before the next one.** Forcing the class non-empty (324 of 324) leaves
all nine per-kind CLI md5s and the maze dump byte-identical, because
`KEEP_POLICY` is reachable only through the lab page's `applyDirective` and no
committed identity runs a directive. The md5s say *the generator did not move*;
what gates the retirement is the census, two re-pinned unit rows, and the maze
lab's browser row.

### Arc 5, slice 6a — THE DEFAULT ROOM GETS A DIFFERENT CONTRAPTION: the guard's size is DRAWN, and every room can be given a chamber (2026-08-20)

**What a level generated at the default now contains.** Ask the generator for a
Seedling level without saying what should be in it, and until this slice it drew
one of two or three things: a guard gadget *at one fixed size*, a block pocket,
and — after the sword — a kill gate. It now draws from one more, and the guard is
no longer stuck at one size:

```
pre-sword    guard+blockpocket+chamber;w=2;h=3
post-sword   guard+killgate+blockpocket+chamber;w=2;h=3
```

> ⚖ The user's ruling, 2026-08-20: the arc's **ONE** planned re-record executes
> BOTH changes together — the guard's `len` pin comes off, and `chamber` joins
> the list. **`arena` was NOT ruled in and is NOT in.**

**Why the pin came off, in one number.** The guard was pinned at `len = 2`
because that was the size an earlier slice had certified. Arc 5 then taught the
placer to fit a gadget's real shape into a room rather than a square, which
tripled how often a *longer* guard fits — and the pinned default was the one
value that gain could not reach. Measured on the pinned 10×10 room, 120 rooms per
size: a `len = 2` guard reaches a room 7 times and 5 of those survive their
solve; drawing the size instead reaches a room **15** times with 12 surviving.
**Twice as many default rooms get a contraption in them**, and the pinned
default had been hiding that the whole time.

⛔ **And two of the five sizes never fit at all, which is published rather than
hidden.** A `len = 5` or `len = 6` lane needs a strip the default room does not
have, so it places nothing on any skeleton — its entry mouth ends up on the
room's border ring, or the port cannot be joined. About two draws in five
therefore end with the level shipping *element-less*, through the ordinary
refusal path. That is the price of drawing, it is inside the "15 of 120" above,
and the way to spend those draws better — letting a spec name a SUBSET of a
parameter's domain — is a mechanism nobody has designed.

**Why the chamber names its size where the guard draws its own.** A chamber is an
open floor blob declared as an AREA, so a room whose skeleton offers no chamber
at all has somewhere a key can live. Its width and height also run to 6 — and a
6×6 blob reserves the *entire interior* of the default room, so a bare chamber in
this list would refuse five times in six. It therefore goes in as
`chamber;w=2;h=3`, and that pair is measured rather than assumed: against
`w=2;h=2` it places slightly less often and converts **more** of its placements
into an accepted area graph (28 of 120 against 24), at a higher certification
rate and a marginally lower cost. ⛓ So the two heads differ on purpose — the
guard's sizes fit the default room and are drawn, the chamber's do not and are
named.

**What a chamber in the default buys, and what it costs.** Bare tree skeletons —
`winding`, `branchy`, `bushy`, `loopy`, `open` — grow corridor, not rooms, so
asking one for a key-and-lock area used to fail almost always. With a chamber in
the list, `--areas=1` acceptance rises from 4 rooms in 120 to 45, and every
accepted graph also certifies. It costs about a third more generation time.
⚠ One thing it does NOT buy: a `keys=2` level. One chamber is ONE area.

**THE DEFAULT IS A PIN, AND A PIN NOW HAS A ROW.** Three deliberately broken
builds — a bare chamber, the old `len` pin put back, and `arena` slipped into the
post-sword list — showed that **nothing in the repository asserted what the
default contains**. The only thing that reddened was the generated documentation
going stale, which one regeneration silences, plus a handful of seed-pinned rows
a re-pinning pass would have quietly updated. A head could have been added to
either biome and every gate would have gone green while every recorded artifact
moved underneath it. There is now a row that pins both spec strings literally —
the spelling, the ORDER, and which parameters are named rather than drawn.

**What moved, and what did not.** Everything recorded at the default moved and
nothing else did: the acceptance batch (19 of its 106 rows), the two `empty` pair
dumps (40 of 81 each), the carved pairs (105 of 145), the area census, the
exported six-room set and the generated catalogue. Byte-identical, and predicted
so before the change was made: the bot battery, every maze identity, the guard
census (it *names* a size, so it reads the other stream), the enemy census, and
the three levels generated with `--elements=killgate` spelled out. ⛓ **Saying a
size out loud has always been a different run from leaving it unsaid, and this is
the slice where that law paid for itself** — it is what let the deciding
measurements be taken before anything was landed, and re-taken afterwards
unchanged.

**On real hardware.** The ship row passes 58 claims with three per-tick verdicts
— and the interesting one is the GENERATE plan, whose level is generated AT the
default this slice changed: it reproduces its earlier numbers exactly (360 ticks,
361 observations), because the list's single pick happened to land on the same
head. The multi-screen shell room's tape did grow (154 → 197 ticks), and the
page's own identity line now says why: it drew the chamber, and the chamber
refused.

### Arc 5, slice 6b — DENSITY IS ONE DECLARED BLOCK, and the catalogue pays the arc's demo debt (2026-08-20)

**The problem the block solves.** By the end of this arc a generated room had six
independent settings deciding how big it is and how much is in it — which
skeleton carves it, how many chambers that skeleton is asked for, its width and
height, whether it is written densely or as a shell, which element the biome
default's `+` list drew, and how many obstacles pass 2 was asked for. All six
were *readable*, scattered over three lines of the identity, two lines of the CLI
report and a URL. None of them were readable **together**, which is the one thing
a dial needs.

There is now one line, on both lab pages and (opt-in) on both CLIs:

```
density: kind=winding · chambers=2 · size=20x12 · fill=shell · element=chamber;w=2;h=3 · target=1
```

⛓ **ONE FUNCTION** — `procgenCore/densityBlock.js` — spells it for all four
readouts, and a browser row asserts the page's line against a CLI CHILD
PROCESS's, character for character, on two subjects. A second spelling could not
survive that row: a deliberately broken build in which the page read the element
`+` LIST where the CLI read the head the list RESOLVED to reddened it
immediately, on exactly two claims and nothing else.

**It READS. It does not compute, and it stores nothing.** The size is the
RECORD's own room, the fill is the DECLARED word, and the element is the
RESOLVED head. ⛔ The fill clause is the one worth spelling out, because the
obvious shortcut is wrong: `fill=shell` on an OPEN room with no element strips
**0%** — every wall of the border ring touches floor, so the record is
byte-for-byte the dense room — and a block that inferred the word from the
written-cell count would print `dense` about a run generated `shell`. That room
is the browser row's SECOND subject, and it is there because the first one could
not tell the two builds apart: with the mutant in place the 20×12 shell room
still agreed and only the open room went red.

⛓ And the block adds **no payload field**. The arc's one planned re-record was
spent by slice 6a on the biome default itself, so the line is spelled at PRINT
time out of fields the record already carries. For the same reason `--density` on
either CLI is OPT-IN: those two reports' checksums are fifteen of this arc's
published byte-inertia identities, and a line printed unconditionally would have
re-recorded all fifteen for a projection.

**What each position of the dial buys, measured.** A new instrument,
`census-seedling-density.mjs`, sweeps kinds × two sizes × two fills × two element
arms and prints the BLOCK beside the four numbers it moved. Over 96 cells:

| size | fill | elements | written | ground | kept/target | element placed |
|---|---|---|---|---|---|---|
| 10x10 | dense | default | 100 of 100 (100%) | 26.7 | 3.8/6 | 10/12 |
| 10x10 | dense | none | 100 of 100 (100%) | 28.8 | 4.1/6 | 0/12 |
| 10x10 | shell | default | 84.7 of 100 (85%) | 26.7 | 3.8/6 | 10/12 |
| 10x10 | shell | none | 83 of 100 (83%) | 28.8 | 4.1/6 | 0/12 |
| 20x20 | dense | default | 400 of 400 (100%) | 174.8 | 5.6/6 | 9/12 |
| 20x20 | dense | none | 400 of 400 (100%) | 174.6 | 5.3/6 | 0/12 |
| 20x20 | shell | default | 338.3 of 400 (85%) | 174.8 | 5.6/6 | 9/12 |
| 20x20 | shell | none | 327.7 of 400 (82%) | 174.6 | 5.3/6 | 0/12 |

⛓ **SIZE is the lever that matters.** Going from the pinned 10×10 to 20×20 takes
a room from 26.7 standable cells to 174.8 — six and a half times the space — and
the ladder starts *reaching* its target (5.6 of 6 obstacles kept, against 3.8).
`fill=shell` buys 15–18% of the record's cells and changes NOTHING else, which is
what it was designed to do: it is a serialization saving, not a level change. An
element costs about two standable cells on the small room and none on the big
one.

⛔ **AND THE BLOCK CAUGHT THE CENSUS'S OWN FIRST BUILD.** That build passed
`width`/`height` keys `generateSeedlingLevel` does not take, so every cell of the
size axis ran at 10×10 while the harness labelled half of them `20x20` — and the
only thing that said so was the density block, which reads the RECORD while the
column read the ASK. The disagreement is a named refusal in the instrument now.

**The catalogue pays five slices' debt.** Every slice of this arc from 1 onward
closed with the same residue line — *no demo-catalogue row names this* — because
the close owns the docs pass. Six entries went in (13 → **19** loadable entries):
the room contract (a 12×10 multi-screen room, 79 of 120 cells written), the
oriented site pick (a `len=4` guard in a room that had no square for it),
`chamber` beside the SAME room without it (`--areas=1` CERTIFIES against
`no-area-at-that-key-level-can-hold-its-key`), `arena` with two bodies, the maze
SHORTENS witness with the two routes it compares, and the density block itself on
the default's new shape. The glossary gained `density-block` (156 → 157 terms).

⛔ **Three catalogue defects were found by running it, and all three are older
than this slice.** Two entries had ROTTED — the area-graph entry's seed stopped
producing an accepted graph (which also removed the `realisation` ledger row its
prose tells you to step to), and the sword-gated entry's grade went `null` when
slice 4 made `--require=hasSword` force a two-member list. Both were re-picked by
their own published scans. And **six entries carried a `--count=0` command that
THREW** (`obstacleTarget` must be positive), from the catalogue's first day —
because the row loads an entry's URL and asserts its claim but has never run its
CLI line. The commands are `--count=1` now and the file says why.

**The hosting row had been crashing for two arcs.**
`check-procgen-lab-hosting.mjs` builds a DIRECTED payload to send through the
panel bus, and its directive spec was a typed literal naming a door template that
arc 3 slice 4c retired and a keep-policy letter that left the grammar in the same
slice. It did not rot quietly — it CRASHED BY NAME before its first check — and
nothing noticed, because no per-slice gate list names that row. The spec is now
SPELLED BY THE PALETTE (the first two templates it offers, each parameter at the
first value of its own declared domain), so a retired name cannot appear in it
again; if the palette ever offers fewer than two templates the row throws its own
named error rather than claiming about a one-directive replay.

### ⛓⛓⛓ ARC 5 IS CLOSED (2026-08-20)

Eight slices — 0 · 1 · 2 · 3 · 4 · 5 · 6a · 6b. §7's nine acceptance gates are
answered one by one in arc-5 kickoff **§15**, which also carries the arc's whole
RESIDUE in one deduplicated list (for R9, for arc 4, for future arcs, for the
user, and code-only). ⚠ NewDocs is gitignored; this § is the tracked record.

**What the Seedling generator IS now**, against what arc 3 closed with. The ROOM
is no longer one small box: width and height are separate knobs up to the vanilla
maximum **60×60** (the default stays a PINNED 10×10), and a record may be a SHAPE
— floor plus a proven-closed wall SHELL plus nothing at all beyond, vanilla's own
sparse form — under a CLOSURE LAW that refuses by name if any floor cell ends up
4-adjacent to an absent one. Elements are placed by their own DECLARED oriented
footprint rather than the square that bounds them. An element may BE space: the
`chamber` head opens a floor blob and declares it an AREA through the same line
the guard's area already used, so a corridor-only skeleton can hold a
lock-and-key graph. A fight can have space and more than one body in it (the
`arena`, `bodies ∈ {1,2}`). The differential can compute its fifth grade,
SHORTENS, and REACHES it on real generated maze levels. And density is ONE
declared block, printed by one function in four places and measured by its own
census.

**The numbers that define it.** Guard census **21 → 62 of 360** and
`no-site-fits-this-room` **130 → 0** · `--areas=1` on bare tree kinds **0/24 →
4·8·2·4·4 of 24** with a named chamber, and **4 → 45 of 120** with one in the
biome default · the four-mouth contract took the chamber's ring refusal **28 → 0**
at 10×10 and its placements **14 → 37 of 84**, a STRICT EXTENSION (35 rows
change, all of them former refusals; 107 placed levels byte-identical) · the
drawn `len` doubles the default room's contraption rate (**7/120 placed, 5
certified → 15/120, 12**) · `bodies` priced before it was offered (1 → 462
ticks/600 ms, 2 → 602/1060, **3 REFUSED**) · SHORTENS reached on **four**
generated maze levels (37/39, 43/45, 57/59, 67/69) with three real negatives ·
the `shell` strip **0%** on an open room, **15–18%** of the record on a carved
one · the wasm ship row **12 → 58 claims**, three per-tick verdicts, `agrees per
tick` at 256 · 361 · 198 observations · demo catalogue **13 → 19** entries,
glossary **149 → 157** terms.

**What did NOT move.** The R8 battery md5
(`1fedb0ab35b7cd74accecf0345bdc893`, exit 1) and the maze byte-identity dump are
unchanged at every slice of the arc. Slices 0, 1, 2, 3, 4 and 6b are byte-inert
on every default — every new channel is opt-in, and an omitted knob is the same
stream it always was. **Exactly one slice moved a committed artifact**: 6a's
ruled re-record, whose mover set was written down BEFORE the change and matched
EXACTLY — zero movers outside the prediction and zero predicted non-movers that
moved.

**What is NOT fixed, and is named rather than smoothed.** The arena's kill lock
cannot GROW a wall the way the kill gate's can, so 49–70% of its refusals are
`no-cut-for-the-kill-lock` and it is in no biome default · **SHORTENS is REFUTED
on Seedling**, on three measurements (the breakable rock is invisible to the
solver on 244 of 244 probes, the combat ladder is EXHAUSTED in a corridor, and
the ladder prefers AVOID over KILL so the shortcut throws at tick 215) — the
module ships complete and unit-tested but is deliberately NOT a catalogue head ·
`len` 5 and 6 place nothing at the pinned room, so about two guard draws in five
end element-less, and the mechanism that would fix it — letting a spec name a
SUBSET of a parameter's domain — is designed by nobody · `keys=2` is unmoved at
0 of 264, because one chamber is ONE area and a `+` list is a CHOICE · the kill
gate's **6/28** is still R9's number. All of them, with their §§, are in arc-5
kickoff §15's residue list.

**Next**: ⛔ **arc 4 is THE CHAIN and it stays ASK-FIRST.** The user's standing
items are the per-spec parameter DOMAIN, removing `KEEP_POLICY`/`KEPT_KIND` from
the loop core now that both substrates have retired them, whether `arena` joins
the biome default once its lock can grow a wall, and arc 3's own A3/A5 pair.

## ▶ LOAD IN WASM — what this page holds, run in the REAL recompiled game (TOOLING; ⚖ user, 2026-08-19)

`watch.html` has always been able to run a **committed tape** in the real
SWFRecomp-recompiled Seedling: `?side=wasm` iframes the build and drives it
through `__swfBridge.game`. What it could never do is run **what the page is
holding right now** — a solve it just produced, a room it just generated, a
starting state you just typed. This § is that button.

> ⚖ The user's rulings, 2026-08-19: a **SEPARATE BUTTON**, not the SIDE
> selector; **end-state agreement now**, the per-tick differential in the page
> is the NEXT slice; **a one-room set per ship**; recording FROM the wasm and an
> "original game by default" build are deferred.
>
> ⛓ **The per-tick differential LANDED** (the next slice, same day). Everything
> below about the end-state verdict still holds — it still runs, and it runs
> FIRST — but it is no longer the only answer the page gives. See
> *The PER-TICK verdict* below.

### What it is

One button — **▶ load in wasm** — beside the SOURCE selector, up in SOLVE,
MANUAL and GENERATE and hidden in REPLAY (where the ENGINE selector already
ships the tape, and two controls for one act would be two answers). What each
arm sends:

| arm | what is shipped | the expectation |
|---|---|---|
| **SOLVE** | the solve's own tape (`solved.tape` — the fold `buildStagedTape` already made) | the last frame of the scrub you are looking at |
| **MANUAL** | the starting-conditions block as a **ZERO-INPUT** tape (`tick_count: 0`, `inputs: []`) | **none** — after it finishes, the keyboard drives the real game (⚖ user-measured) |
| **GENERATE** | the room as a **ONE-ROOM LEVEL SET** (`buildLevelSet`, chunked, mounted, read back) plus the certification tape rebooted into room 0 | the JS model's end state, with its level remapped 900 → 0 |

⛔ **There is no `?`-parameter that ships.** A URL that shipped automatically
would have to press ▶ Start, and the frame's own law is that the parent may
never do that — the WebGPU renderer and the AudioContext consume the user
activation, and a parent-side click latches `started` and hides the button
without ever supplying one. So it is a **gesture**: press ▶ load in wasm, then
press ▶ Start inside the frame.

### The stage machine

One mechanism (`seedlingDemo/watchWasm.js`, `shipToWasm`), and the REPLAY arm
is now a caller of it. Every stage is a **named state** the readout prints and
`__watch.wasm` carries; every refusal is a **named reason**, never a stopped
readout:

```
probe    the build is SERVED (HEAD)          ⇒ wasm-build-missing
runtime  __runtimeReady in the frame          ⇒ runtime-never-ready
start    the USER pressed ▶ Start             ⇒ start-never-pressed
levels   (a level set only) botLoadLevels per chunk, then botLevelSet READ
         BACK and diffed field by field       ⇒ set-readback-disagrees (<field>)
tape     botLoadTape returned 'ok'            ⇒ botLoadTape:<what it said>
running  botStart returned 'ok'               ⇒ botStart:<what it said>
finished botStatus.finished
drain    botDrain, read ONCE — the game's WHOLE observation stream
verdict  the END-STATE comparison, and then the PER-TICK differential
```

⛓ **`botDrain` is a BUFFERED stream, not a sample**, so reading it once after
`finished` yields every observation of the run and both sides are complete —
there is no wall-clock join. ⛔ That is why the per-tick verdict reads the drain
and **not** the 250 ms `botStatus` poll beside it: at ~18.6 ticks/s on a real
GPU that poll sees roughly one tick in four, and a "per-tick" record built from
it would be a subsample reported as a stream. Reading the drain twice is not an
option either — the verb drains.

⛓ **The readback is the proof a set MOUNTED** rather than merely arrived —
Phase 3b's manifest gate caught `new Array(45)` that way, a defect no tape and
no unit test could see because both were reading the same wrong object.

⛓ **A ship is always a fresh iframe.** The wasm cannot rewind (`botReset`
forgets the tape, not the world), so a second ship on a page that already ran
one would start from wherever the first stopped and report it as data.

### ⛔ What the END-STATE verdict MEANS — and what it does NOT

`end state: agrees` says **the real game ended where the JS model ended**:
same level, position within the tolerance, and an item set that is a superset
of what the model held. It is printed with its bound attached, always:

> *end state only — two runs can meet on the last frame having disagreed on
> every tick between*

⛔ **It is NOT a certification.** It compares ONE frame — a route that took a
different path to the same door is invisible to it. That is what the per-tick
verdict below is for.

The other three answers are answers, not absences:

- `disagrees (level 3≠0; x Δ4 > 0; missing hasSword)` — the comparison ran and
  the two ends differ, with every difference named;
- `no expectation (manual)` — nothing was driven in JS, so there is nothing to
  agree with. ⛔ Reported as an absence rather than as agreement;
- `not finished (<the refusal's own reason>)` — the ship stopped, and the
  sentence says where.

### ⛓⛓⛓ The PER-TICK verdict — and the two limits it names

After `finished`, the page drains the game's whole observation stream and diffs
it against the JS model's stream for the SAME tape, through the SAME comparator
the node differential uses — `tapeFormat.diffObservationStreams`, imported, never
re-spelled. ⛓ **The model's stream is not a second walk**: it is the `finished`
block of the walk the page already made for its overlays, which is literally
what `runTapeToStream` returns, and `watchOverlays.test.js` pins that equality
rather than asserting it in a comment. ⛓ **The game's stream is the drain plus
the derived transitions** — `Bot.as` hardcodes `transitions: []`, so the entries
are derived from the ticks by `tapeFormat.gameStreamFromDrain`, the one spelling
the node differential now calls too. Without that derivation, every tape with a
level change diverges spuriously at the crossing.

The headline is one of five, and each is an answer:

- `agrees per tick (N observations)`;
- `diverges — tick 143 differs: expected (x=88, y=130, level=0), got (x=90, …)
  [dx=2, dy=0] (model 256 observation(s), game 256)` — the comparator's own
  sentence, verbatim, at the FIRST divergence;
- `no per-tick comparison (<the arm's reason>) — N observation(s) drained from
  the game` — MANUAL's zero-input tape has no run to reproduce;
- `end-state only (no drain on this build)` — the labelled fallback for an
  older artifact without the verb;
- `verdict-internally-inconsistent — …` — see below.

⛔ **The end-state check runs FIRST, and it always runs.** A per-tick `agrees`
printed beside an end state that disagrees **about the same frame** would be a
defect in the comparison — `botStatus` and `botDrain` disagreeing with each
other — not a finding about the run, so it prints
`verdict-internally-inconsistent` and never `agrees`. Both lines stay on screen,
because that is what the refusal is a refusal *about*.

⚖ **An items-only disagreement is NOT an inconsistency.** An observation is
`{t, x, y, level}` and carries no items, so `missing hasSword` beside a per-tick
agreement is the end-state check answering a question the per-tick one never
asked. Which verdict answered which question is the whole point of printing
both: the per-tick line owns position and level over the whole run, the
end-state line owns the item set at the last frame.

⛔ **The scope rides with it, and it names TWO limits:**

> *per tick against the JS MODEL of this same tape, not against a recorded
> expectation; and both sides share this repo's tape and observation code, so a
> defect in what they SHARE is invisible here*

The second is trap 389 and it is not a formality: the tape both runtimes execute
and the vocabulary both streams are read in are this repo's, so a bug in what
they share agrees with itself. The instrument that compares the game against
**recorded** oracles is still `verify-seedling-bot-differential.mjs`.

⚠ **There is no count of how many divergences follow the first**, deliberately.
Producing one needs either a second equality predicate — a detector with its own
copy of the production comparison, which tests itself — or a regex over
`diffObservationStreams`' prose to recover the tick index. That function returns
a sentence, not a structure. The first divergence verbatim, both stream lengths,
and the end-state leg beside it are what actually answer *one tick, or
everything*.

⛓ **`?side=wasm&tape=<committed>` gets the per-tick verdict too**, and it is the
cheapest witness there is: a committed tape's stream is KNOWN, so a divergence
there is attributable without generating or solving anything. It is published on
`__watch.wasm` rather than painted over that arm's own readout, which the live
browser rows assert on.

### The tolerance is **0 px**, and it is a measurement

Five committed tapes replayed through the JS model (`tapeRunner.runTape`) and
through `seedling_bot_ap_p4b` on real-GPU Windows Chrome (`intel / gen-9`),
comparing the model's last observation against `botStatus` at `finished`:

| tape | ticks | level | x | y | Δ |
|---|---|---|---|---|---|
| `friction-stop` | 30 | 0 | 100.50000000000001 | 136 | 0 / 0 |
| `collide-up-rock` | 45 | 0 | 88 | 130.05 | 0 / 0 |
| `r3-collect-shield` | 54 | 20 | 120 | 59.500000000000014 | 0 / 0, `[hasShield]` both sides |
| `r7-act2-2` | 47 | 3 (a TRANSITION) | 72 | 24 | 0 / 0 |
| `cross-level-leg` | 257 | 0 | 24 | 136 | 0 / 0 |

⇒ **max |Δx| = max |Δy| = 0**, floats included. ⛔ So the tolerance is 0, which
is the measurement and not a round figure: a number chosen above what was
measured would be a bound nothing can reach, and would pass a real divergence
in silence. A sixth tape showing a non-zero delta is a **finding to publish**,
not a reason to widen this.

### Which arm can see what

| row | machine | the furthest it can honestly get |
|---|---|---|
| `check-seedling-editor-switch.mjs` | headless | the BUTTON — present, hidden in REPLAY, disabled-with-a-reason before a solve, enabled after |
| `check-seedling-wasm-pages.mjs` | headless (any root, incl. Pages) | `probe`→`runtime`→(a real ▶ Start)→`levels` + readback, `tape`, `running`; and MANUAL's zero-input tape all the way to `finished` |
| `check-seedling-wasm-ship.mjs` | **real-GPU Windows Chrome** (`py.exe`) | `finished`, the `drain`, and BOTH **VERDICTS** |

⚠ The split is not tidiness. WSL's own chromium is SwiftShader at ~0.5 ticks/s,
so a 255-tick solve is eight minutes of software rasterising and any deadline
over it is a race against machine load rather than a fact.

## R9 — the solver rung, opened from the generator's side (OPEN; 2026-08-20)

⚖ The user's order: **form controls first**, then **the quick fixes**, then a
**SEQUENCE of playback tapes on the watch page** as a *continuation of the game
state*, `KEEP_POLICY` removal when convenient, then oracle and solver features
**as the vanilla playthrough needs them**. The splice stays R9's first solver
act (R8's close, option A).

### Slice 0 — FORM CONTROLS (`b89448ad8`)

Six URL-only parameters gained controls on the Seedling generate page, the
element control gained a THIRD state (`(biome default)` ≡ `undefined`, which
`seedlingSeam` reads as *apply `defaultElementsFor`*), and the mapping lives in
`watchGenerate.js` as a pair of inverses rather than inside the view.
`check-seedling-editor-generate.mjs` 208 → **222**.

### Slice 1 — the quick fixes (`0d09e2ad3` … `9bbc847fb`)

**⛓⛓⛓ THE PER-SPEC PARAMETER DOMAIN.** A parameter had two spellings and the
difference between them was a DRAW. There is now a third:

```
guard              OMITTED — ONE rng.pick over the whole declared domain
guard;len=2|3|4    SUBSET  — ONE rng.pick over those members, AS WRITTEN
guard;len=4        PIN     — the value, and NO draw at all
```

The SHAPE is `templateContract`'s (`{pick:[…]}`, where the draw is spent) and the
SPELLING is `elementSpec`'s. Order is kept as written (the draw is a `pick` over
that array); a ONE-member subset **is** the pin; the whole domain spelled as a
subset is a NAMED spelling and not the bare parameter (`namedParams` reports them
differently, and that difference is what a reader is reading); a member outside
the domain, a repeat, and a subset on the binding knob `binds` each refuse BY
NAME. `|` and not `,`, because `,` is taken twice outside this codec.

**THE BIOME DEFAULT ADOPTED IT** (⚖ ruling 9 — the rung's ONE generator
re-record): `guard;len=2|3|4+blockpocket+chamber;w=2;h=3` pre-sword,
`+killgate` post-sword. Arc 5 measured the guard reaching a room **10 times in
600** default draws with `len` 5 and 6 placing NOTHING at 10×10. Measured after,
over 15 kinds × 40 seeds × both biomes at `keys: 1`:

| | guard drew | PLACED | graded-drop share |
|---|---|---|---|
| pre-sword | 225 | 10 → **24** | 95.6 % → **89.3 %** |
| post-sword | 165 | 10 → **15** | 93.9 % → **90.9 %** |

⛓ And the placed-`len` histogram says why: BEFORE `{2: 10}` on both biomes —
3, 4, 5, 6 placed nothing anywhere in 1200 cells. AFTER `{2:10, 3:4, 4:10}` pre
and `{2:10, 3:4, 4:1}` post. The `len=2` count is unchanged; the whole gain is
draws that used to land on 5 and 6 landing on 3 and 4.

⛔ `nextIndex(n)` spends ONE `next()` whatever `n` is, so no draw COUNT moved
anywhere — only the value the guard's `len` lands on, and only where the list
drew `guard`. In the three pairs dumps **every differing row is guard-headed and
no non-guard row moved** (46 of 46). The re-pin tail is ONE unit row; the browser
tail is **ZERO over 746 claims**, which is the same finding arc-5 6a's mutant (b)
made: a change in the default's DISTRIBUTION is invisible to every behavioural
gate in the tree, and that is why the literal default pin exists.

**A3 — a kill refusal names the arm it actually tried.** `derivePressKill`
accumulated its own refusal sentences and discarded them at every `return null`,
so a room that refused in the PRESS arm reported *"level N has NO arrow trap"* —
true, alone, and about the arm nobody asked for. It returns `{first, plans,
rejected}` on every arm now and both fallthroughs report both arms, the press
arm's first. ⚠ `solverBot.js:5830` is NOT the same defect: that is the walker's
rung 4, which never calls `derivePressKill`, so its `weapon.why` is the only arm
it tried.

⛔⛔ **AND A REFUSAL STRING IS RECORDED IN PAYLOADS.** A3 moved no tape — the
battery `--check` is byte-identical at `1fedb0ab…` and `r8-solve-18`'s trace is
byte-identical by its own producer — and still moved FOUR identity artifacts, one
`reasonText` line each: the acceptance batch (1 of 106 rows), `killgate` levels
seeds 2 and 9 (1 row each; **seed 5 is the control and did not move**, because its
refusal is not a kill refusal) and the post-sword default level. The rooms are
byte-identical. ⇒ *"no tape moved"* answers only half the question; the other half
is **"who RECORDS this string?"**

**THE E BUCKET.** The demo catalogue's `cli:` line is `{command, exit[, skip]}`
and `check-procgen-demos.mjs` RUNS it — 162 → **181 claims**. The first run found
what an unrun field hides: `refused-directive`'s command ended `; echo $?`, so the
shell exited 0 while the entry's own prose said 6. `publishShip` projects `note`,
so the ship row reads the remap structurally instead of regexing the painted
verdict. The shortest certification tape over certified DEFAULT levels is **73
ticks** (`empty`, seeds 26/28; `winding` 88, `branchy` 123, `rooms` 125), so
nothing ≤ ~60 exists and the headless REPLAY arm keeps `friction-stop.json`.

**A PRESS-TIME REFUSAL FAILS BY NAME.** `check-seedling-editor-generate.mjs` used
to die of an uncaught `TimeoutError` after its whole 300-second budget when the
page refused a form at a press; `waitOrRefusal` now reports it as a named failure
quoting `#status`. Measured by mutant: **14 named FAILs** where slice 0's mutant
(c) got one timeout and 17 silent passes.

### Slice 2 — A SEQUENCE OF TAPES, AS A CONTINUATION (`f5e030afc` … `3d6cfd7a6`)

⚖ The user's own sentence: *"I want the second tape to continue from the game
state at the end of the first tape. I don't want it to reload a fresh page. And
I want it to work like this for both JS playback and wasm playback."*

`?tapes=a,b,c` beside `?tape=`, an ordered add-to-queue control beside the
picker, and a chain HEADLINE that expands to its segments through a browser-safe
constant checked in node against `PLAYTHROUGH_CHAINS`. Both engines.

**⛓⛓⛓ THE CLAIM.** `?tapes=r8-d2` → `[r8-d2-19, r8-d2-20]` on ONE live run
produces the headline `r8-d2` replayed alone **tick for tick** — 1646
observations, first differing tick −1 — and ends equal. `r8-d2` has always been
the two segments' inputs driven by one MODEL run, checked since by arithmetic
(`chainFindings`' sum and stream slices, 864 + 781 = 1645). No run had ever
played both windows as one.

**THE ADMISSION RULE, AND THE ONE IT REPLACES.** The brief said a later window
declaring `persistence`/`grants` is refused by name — `windowsFrom`'s rule.
Measured on the slice's own subject: `r8-d2-20` declares SIX clears, which are
exactly `r8-d2-19`'s four DECLARED plus the two it EARNS. Its `rng`, `save` and
`seam` are latches of the same world. Under that wording the subject is refused
and the ruling is unreachable (trap 470 — two settled rulings may not compose).
⚖ Ruled: **a later window's declared staging is admitted iff it MATCHES the live
state; a mismatch is REFUSED BY NAME, never silently rebuilt.** `persistence`
must equal the live cleared set exactly — a superset clears a flag the world
never earned, a subset takes back one it did, and `botStart` resets every tag
first, so both are rebuilds in disguise.

Two tiers, because the live world does not exist until window k has played:
**tier 1** at queue time (names resolve, no later-window grants, ends-at-rest
REPORTED with the keys named) and **tier 2** before window k+1's first tick —
the game's own test, `boot.level == the live level` and `boot.x/y` == the
CONSTRUCTION args (`Bot.as:1722-1725`, `atBootPosition` `:1817`), then latch
equality. The live state is `botSeam()` → `segmentBootFromLatch` on the wasm
side and, on the JS side, `run.worldCtor` plus **window 1's declared persistence
∪ every `run.earnedClears` since**. A row the JS side cannot answer for (`rng`,
`seam`) is UNASSERTED **by name**, never passed.

**⛔ ENDS-AT-REST IS REPORTED, NOT REFUSED**, and the subject measured that too:
`r8-d2-19`'s last span is `{down 803..864}`, held through `tick_count`, and the
walk is right — the headline holds `down` from 803 to 891 across the same
instant. The rule is a WASM-side authoring rule (FlashPunk's `Input` is a static
nothing clears); the JS model recomputes `heldKeysAt` every tick. So the row
NAMES THE KEYS, which is the list the wasm boundary has to release.

**⛔⛔ AND THE STREAM CLAIM CANNOT SEE A RE-STAGE.** A build whose resume face
silently re-staged reproduced the headline **byte for byte** — first differing
tick −1. `r8-d2`'s cut is a level ARRIVAL, so the world was freshly constructed
on that tick and the player is on the spawn AT REST, which is exactly what
`r8-d2-20`'s boot block reconstructs; and since R1 every chain in the roster has
been cut at an arrival. ⇒ what gates it is that it is the SAME RUN: window 2's
`finished` carries window 1's transition too, `earnedClears` is five rows, and
`ticksCompleted` is 1645. Both a unit row and a browser claim ask that directly.

**THE WASM SIDE.** `shipToWasm` takes `windows`; `freshFrame()` and the human
▶ Start happen ONCE. Per window k+1 on the SAME frame: release the keys window k
left held (the driver's own `keyup`s at the driver's own targets; `moved at
boundary` measured either way), read the latch, ADMIT, `botLoadTape` →
`botStart` → poll `finished` → a SECOND `botDrain` → the per-window verdict →
`continuationFindings`. Each drain is its own buffer starting at tick 0, so the
concatenation offsets by the running sum of `tick_count` and drops each window's
duplicated first observation. `WASM_STAGES` gains `tape k/N`, `running k/N`,
`finished k/N`, `drain k/N` and `boundary k/N`; one window is byte-identical to
the old list. ⛔ The never-press-Start law is untouched — it is about the SWF's
Start, once per page.

**⛓ A FINDING ABOUT THE ROSTER, MEASURED BY A MUTANT.** `act2-the-sword`
continues for FOUR boundaries and stops at `r7-act2-5`. With tier 2 disabled it
steps and throws at tick 1067: *"the removal of bob@48,80 … OPENS 1 kill lock(s)
in level 5 [{5,0}] … and the tape DECLARES no clear for them."* ⇒ `{5,0}` is a
kill lock **that segment's own walk opens**, carried as a boot `persistence`
entry because `levelRun` refuses to compute one itself. So a segment's declared
persistence carries TWO different things — a LATCH of its predecessor's state,
which must match, and a FORWARD DECLARATION of a clear its own walk will earn,
which must not — and latch equality cannot tell them apart. The refusal is still
correct (as a window it would enter L5 with the lock already open), so
`act2-the-sword` is not continuable past window 4 AS RECORDED. Next work order:
re-record without the forward declaration through the v9 timed `at` channel, or
a tape field that marks one.

`check-seedling-editor-sequence.mjs` — 20 claims. The Windows ship row gains a
fourth arm. ZERO tapes, traces or expectations moved.

### Slice 3 — ⛓⛓⛓ THE SPLICE + THE DRIFT: the rung's ONE attributed solver licence, spent once (`604c354c0` … )

⚖ R8's close ruled option A (user, 2026-08-11): `r8-d2` stays two segments and
the three-segment splice is **R9's first solver act**, together with
`r8-solve-4`'s drift, under **ONE licence**, *"the prediction committed BEFORE
the licence is used."* Both close-out debts are DISCHARGED here.

**THE PREDICTION CAME FIRST, AND IT WAS A COMMITMENT, NOT A SUMMARY.** Before
any solve and before any recording, at a pristine worktree at the slice's base
commit: the files that would move, the tick counts, `cuts`/`endsAt`, the battery
md5 change and the R8 gate's new count were written down. Twelve of the fifteen
numbers landed exactly, including the two the prediction explicitly refused to
derive; the three misses are all about **what an instrument can see**, and they
are the interesting part.

**`r8-solve-18` IS PROMOTED, NOT DUPLICATED.** The honest L18 already existed as
a recorded, byte-exact artifact (R8 slice 8). An `r8-d2-18` would have been a
second tape with the same boot, the same goal list and the same walk; editing
its `description` so it *said* "segment 0" would have spent a re-record licence
on a word. What changed is its RELATION, and a relation lives in
`PLAYTHROUGH_CHAINS`. ⇒ the licence covered **four** names, not five, and the
L18 producer's `--check` staying green on the finished tree is the proof that
nothing of it moved.

```
r8-d2         2,218 ticks   the headline — all THREE rooms in ONE run (v8 -> v9)
r8-solve-18     573 ticks   the honest L18, PROMOTED     cuts [573, 1437]
r8-d2-19        864 ticks   the Shieldspire              endsAt 2218
r8-d2-20        781 ticks   the shield, and the way OUT westward to L13
```

**⛓⛓⛓ THE FREE ORACLE PREDICTED THE GAME, AND THE GAME AGREED.**
`gameClock.test.js` derives its seam sweep **from `PLAYTHROUGH_CHAINS`**, so
adding a segment created a row that computed an answer one commit before a
browser ran:

```
r8-solve-18 -> r8-d2-19: 8586 + 573 ticks + 40 dead  ⇒ MODEL SAYS 9179
                         the committed successor declares 8586   (−593)
r8-d2-19    -> r8-d2-20: 8586 + 864 ticks + 190 dead ⇒ 9620 == 9620   ← the control
```

The −593 **is** the dishonesty the splice removes. R8 declared `r8-d2-19`'s boot
at the same `save.time` as L18's own boot, because both were staged from
`r7-act2-11`'s latch — read as a claim, that says L18 took no time at all. The
Windows latch run returned **9179**. ⇒ *derive the roster of a claim from the
structure it is a claim about*: a hand-listed sweep would have been silently
short by one row, and the number would have arrived with the recording instead
of ahead of it.

**THE BOOTS THAT MOVED**, measured by `botSeam()` → `segmentBootFromLatch`:

| | `rng.seed` | `save.time` | `persistence` |
|---|---|---|---|
| `r8-d2-19` | 418414780 → 58227647 | 8586 → **9179** | + `{17,29}` + `{18,0}` |
| `r8-d2-20` | 1761417076 → 1823918582 | 9620 → **10213** | + `{17,29}` + `{18,0}` |

⛓ `{17,29}` is the **out-of-band write** §13.10's refutation transcribed two
rungs ago: L18's spinners carry `tag = -1`, and `setPersistence(tag, o, _l)`
sends a negative tag to `Main.level` — so crossing L18 honestly writes a flag in
L17. The chain's own R8 docblock said the honest route *"arrives here having
written both"*; it is measured now rather than asserted.

**⛔⛔ FOUR PREDICTED MOVERS DID NOT MOVE.** `r8-d2-19` and `r8-d2-20` changed
in their **boot block only** — `inputs` byte-identical, `tick_count` unchanged
at 864 and 781 — so their traces (a record of DECISIONS) and their expectations
(a record of the PLAYER's positions, deterministic from the same inputs) came
out byte-identical. Twelve files were predicted; eight moved. The strong half of
that is the SOLVER's: it planned L19 and L20 against a genuinely different boot
state — different gameplay stream, different `fp` stream, a clock 593 ticks on,
two extra persistence rows — and chose the same two walks.

**THE DRIFT, PAID.** `r8-solve-4` re-derived from the 255-tick walk (`solver
255 | hand 347 | −92`) and recorded in the same session. The producer writes all
nine of its rows on every run and **eight came out byte-inert**, proved by
`git status --porcelain` after the write.

```
solve-seedling-r8-battery.mjs --check 2>/dev/null | md5sum
  1fedb0ab35b7cd74accecf0345bdc893  exit 1   (the two ⛔ DRIFT rows)
  67bcde75489419e5331187b8ebf140a7  exit 0   ← the new standing value
```

⛓ R8 lesson 3 — *the producer's own `--check` runs at every close* — now has a
green to hold. And the reason the drift survived three reports is fixed at the
source: **no `--record --only=r8-solve-4` command existed anywhere in the
repo**, so the one instrument that could pay it had no recipe. Both slice-3b
rows have one now, in the producer's docblock.

**THE R8 TAPE GATE: 534 / 0 / 67 → `541 / 0 / 67`**, and the 541 was derived row
by row before the run — +4 per-segment rows for the new segment (stream slice,
calm arrival, seam, boundary tick) and +3 `stagedClearFindings` rows for the
`{18,0}@385` provenance the chain now carries. ZERO unlicensed moves, proved by
`git status --porcelain` after a non-recording gate. Both internal seams are
GREEN over the whole 46-row signature, all three stream slices are tick-for-tick,
and the ending state is equal.

**⛔⛔ AND THE MUTANTS SAID SOMETHING WORTH KEEPING: THE SEAM IS NOT A REDUNDANT
CHECK ON THE STREAM — IT IS THE ONLY INSTRUMENT THAT CAN SEE A DISHONEST BOOT.**
Mutant (b) put R8's declared state back into `r8-d2-19` and ran it through the
real game: **114 PASS / 2 FAIL**, and both FAILs are seam rows (7 of 92 signature
rows). Every stream and arithmetic claim stayed green — the three slices tick
for tick, both boundary ticks, all three calm arrivals, the ends-meet sum, and
the ending-state equality over all 46 rows. The mechanism: **a tape's `inputs`
decide the walk and the boot decides only the state around it**, so a segment
booted 593 ticks and one RNG stream away from where it claims to be walks the
identical path. (Bounded honestly: the mutant reverted only segment 1, so both
ENDS of the chain stayed on the new clock. What it establishes is that *one
dishonest boot in the middle of a chain is invisible to every stream claim*.)

⛓ Mutant (a) — the headline assembled by CONCATENATING the three segment files
instead of ONE model run — is **INERT, and provably**: the concatenation and the
one-run walk press the same keys on all 2,218 ticks, and each span of the
headline's `inputs` is byte-identical to its segment's. Named as a REACH finding
rather than answered by widening a claim: the chain claims cannot distinguish
*one run, cut* from *three runs, glued* — and they do not need to, because the
thing that would make gluing wrong is exactly what the seam refuses. The
inertness is DOWNSTREAM of the seam being green.

⛓ One red was a NEW CLAIM rather than a stale pin: `R8_D2_SHIELD.pressExposure`
re-derives its set by DRIVING the roster (trap 89), and it refused by name —
*"Undeclared and reaching: r8-d2"*. True: the splice put L18 inside the
headline, so the headline's press arm now reaches and kills two spinners.
Declared in `reachingAdded`, the one-row-per-slice list that exists so a
prediction is never edited after its measurement.

⛓ Slice 2's continuation claim grew with the chain and is derived from it:
`[r8-solve-18, r8-d2-19, r8-d2-20]` on ONE run IS the headline `r8-d2`, tick for
tick — window list and offsets read from `chainSpans`, so the next segment costs
that file nothing.

⛓ The generator identity is UNMOVED and was proved cheaply, as the prediction
promised: acceptance batch `8ad7bda2ae4b470122334f71b4e92651` at the pristine
worktree and again on the finished tree (a same-tree control), and zero
generator paths in the slice's whole diff.

**⛓⛓⛓ AND THE ANNOUNCED WINDOWS SESSION FOUND TWO MORE THINGS, BOTH BY PUTTING
A THIRD WINDOW IN FRONT OF `r8-d2`.** Ship gate 77 / 0 → **83 / 0, ALL PASS**,
five arms.

**1. THE SHIP PATH NEVER PROJECTED.** `gameVisibleTape` is the one
classification of what a game-facing channel may hand to `botLoadTape`
(`GAME_VISIBLE_DROPS`: the v9 `at`, v10's `despawn` — statements about what the
GAME does on its own, never instructions to it). The differential has projected
since R7 slice 6d; `watchWasm.shipToWasm` did not, and it was invisible because
every tape it had ever shipped was v8 or below. The splice put a v9 tape into a
sequence and the real GPU said, at `tape 1/3`:

```
botLoadTape: error:tape_version must be 1, 2, 3, 4, 5, 6, 7 or 8, got 9
```

Fixed at the call and BYTE-INERT for everything that shipped before it — a v8
tape projects to itself, measured — with a unit row that mutant-reds when the
projection is removed, because the arm that would otherwise catch it costs a
GPU and fifteen minutes.

**2. ⛔⛔⛔ A LATCH IS NOT A LIVE STATE FROM WINDOW 3 ON**, and the mechanism is
`SEAM_PREBUILD_FIELDS` doing exactly its job. `rng.gameplay` and `fp.seed` are
PRE-BUILD rows: a segment declares the stream position `botStart` will apply
ABOVE its own build (R7 slice 2b — the fix that deleted the seam-build-cost
bridge). On a FRESH PAGE that is exact, because `botStart` writes the value and
then BUILDS the boot level, spending its draws. A continuation deliberately
does NOT rebuild (`Bot.as:1722-1725` — that is what makes it a continuation),
so those draws are never spent:

```
r8-d2-20 declares rng  {seed 1823918582, fp 1752443622}
the live game after [r8-solve-18, r8-d2-19] holds
                       {seed  954659063, fp 2069965047}
                                         ^ = r8-d2-19's OWN boot fp — L19 was
                                           never rebuilt, so nothing spent it
```

⇒ **every latch on the roster was measured after a fresh-page replay of its own
segment**, so from window 3 on a continuation runs behind it by exactly that
window's boot-level build. Slice 2 could not see it: N was 2 and window 1 is
always a fresh boot, so window 2's declared latch was the only one asked.

⛔ The refusal is CORRECT and is not papered over (⚖ slice 2's ruling: a
mismatch is refused BY NAME, never silently rebuilt) — applying 1823918582
would MOVE the world. And it cannot be fixed by re-recording: **a boot that
matched a continuation would stop reproducing the differential's fresh-page
replay**, which is the gate the whole roster rests on. The two are different
measurements of "the state at the cut" and a tape can carry one. ⇒ a ⚖ ask.

So the ship gate keeps the full-strength claim on the pair that IS continuable
(`?tapes=r8-d2-19,r8-d2-20` — per-window `agrees per tick` 865 / 782, the whole
concatenation 1646, window 2's dead frames 170 to the frame, end state L13
Δ0/Δ0) and ADDS an arm that ASSERTS the refusal — which also proves the FIRST
boundary of a three-window sequence IS crossed on one game, L18 then L19 with
no rebuild between them.

**⛔ ONE MORE, AND ONLY THE ADMISSION COULD ASK IT: TWO LEDGERS, TWO MEANINGS.**
L18's Spinners carry `tag = "-1"`, so crossing it writes `{17,29}` out of band.
`levelRun` REPORTS that write and deliberately keeps it out of `earnedClears`,
which is *what the next BUILD may be handed* and which refuses a clear no
entity reads. But a tape's `persistence` is read out of the GAME's array, which
does carry it — so the watch page's live set, built from `earnedClears` alone,
was short exactly that row and the admission refused the next window BY NAME
for a flag the game really did write. A true sentence about the wrong ledger.
The differential cannot see this: it compares positions, and the seam compares
the game's latch against a boot the game itself produced. `?tapes=r8-d2` is
**20 / 0** on three windows once the reported out-of-band writes are folded in.

⛓ The live Pages row after the deploy: **20 / 0, ALL PASS**
(`check-seedling-wasm-pages.mjs --root=https://peerinfinity.github.io/Archipelago-CC`)
— the ship path's projection is live, and the row that would have caught its
absence is the one that had never been handed a v9 tape.

### Slice 4 — THE DERIVED `break` VERB, and the FOURTH WALL it uncovered

**⛓⛓⛓ THE VERB.** `OBSTACLE_STRATEGIES` gained two rows and
`STRATEGY_EXECUTORS` gained one executor:

```
'solid:breakablerock':      'break'
'solid:breakablerockghost': 'break'      break: execBreak
```

⛔ TWO TAGS, ONE VERB — `shieldlock`/`shieldlocknorm`'s lesson (R8 slice 7) one
family over. `Game.as:2158` builds the ghost family with `rockType = 1` and
everything else with the default 0, so the two census tags are ONE AS3 class
differing in the field that decides which weapon breaks it. A table that knew
only the plain tag would answer *"No strategy row exists"* for a room whose fact
is an INVENTORY.

The engine has modelled the swing since R5 slice 5 (`levelRun`'s `BreakableRock`
arm — `rockBreaksUnder`, `hitRock`, the persistence write; `presses
.PRESS_ARM_POLICY.BreakableRock` is `modelled`). What did not exist was a SOLVER
row: a rock press was named by OEL COORDINATE in `botDriverV2`'s hand-written
spear arm, so to the live solver a rock was stone. The executor derives its own
stance instead — a rock is STATIC, so a strike stance is a reachable cell plus a
facing, with no forecast to consult and no `previewWalk` per opportunity.

**⛔ TWO GUARDS, BOTH NAMING AN ITEM RATHER THAN A BUDGET.** `weaponForPress`
null ⇒ the press is a SILENT no-op (`procgenRequirements`' own sentence), so the
verb refuses BY NAME instead of swinging at nothing; `rockBreaksUnder(rockType,
inventory)` false ⇒ the swing LANDS and does nothing, and the refusal names the
GHOST SWORD as the next work order. Both raise a `SolverRefusal` and not a
`SolverBotError`, because `procgenOracle.solve` re-throws the latter and an
item-gated verb that THREW would grade **WEAK** where the honest grade is
**STRONG**. (⚠ `execKeylock` and `execTouch` still `fail()` on their own
`held:false` arms — named as residue, not changed under this slice's licence.)

**⛓ AND THE STANCE IS THE BOOT CELL.** Route step 12's L3 rock is the door out
of a one-cell arrival island — Stone on three sides, WATER on the fourth — so
every cell a lattice ring sweep can swing from is on the FAR side of it. The
derivation therefore asks the LIVE position first and returns `stance: null`
when it already reaches: a `walkTo` to where the walk already is is a corridor
request for a zero-length corridor, and the frontier's planner is entitled to
refuse one.

**⛓⛓⛓ THE ROUTE SURVEY: 22 → 23 of 29, and EXACTLY ONE ROW MOVED.** Step 12
(L3 out of L11) REFUSED → **SOLVED, 226 ticks, 2 decisions**. Against a baseline
captured at a pristine `801fe0dfa` worktree the other 28 rows are identical in
verdict *and in tick count*, row for row. The six that remain are the six that
remained before: L8 ORACLE · L14 CAMERA BAND · L15 `shove` VERB-APPLY · L16 Bob
BRIDGE+KILL_ARM · A14 L6 TIMEOUT · A16 L4 `shove` VERB-APPLY. ⇒ **THE NEXT WORK
ORDER ON THE ROUTE IS L14's CAMERA BAND** (R8 lesson 2), whose refusal names its
own cure: *"move the stance away from the screen edge, or wait the shake out."*

**THE TAPE — `r9-solve-3`, 226 ticks**, authored by
`scripts/procgen/solve-seedling-r9-l3.mjs` and recorded ONCE with `--only=` on
the announced real-GPU Windows session: **227 observations, and the model
reproduces the recording it just made**; `save.time` 8853 game == model; ONE
`primary` edge, i.e. one swing; zero hits, zero deaths. Its boot is the survey's
own `staged` policy — `r7-act2-11`'s committed v8 block re-pointed at L3's
arrival from L11, read out of the ATLAS, with the committed TIMED clears
stripped — so its claim is *"L3 is solvable from this declared state"*, not
*"the campaign reaches it"*. ⚖ Ruling 11's true-start chain is what will
re-record it from a measured latch.

**⛔⛔⛔ THE GENERATOR HALF IS A REFUTATION, AND IT IS THE SLICE'S REAL FINDING.**
Arc 5 §13.6 left `shortcut` out of `elementSpec.ELEMENT_TABLE` behind three
walls and predicted the head was *"ONE LINE on the day any ONE of them moves: a
derived break verb, a combat ladder that prefers a cheap kill to a long detour,
or a non-dialogued goal class."* Wall 1 has moved. The grade did not.
`scripts/procgen/probe-seedling-shortcut-grade.mjs` — arc 5's scratch probe
rebuilt as a committed instrument — with the verb registered:

| room | verdict | ticks | verbs the trace drove |
|---|---|---|---|
| SHORTCUT rock, WITH sword | SOLVED | 244 | walk, collect |
| SHORTCUT rock, WITHOUT sword | SOLVED | 244 | walk, collect |
| control — short arc OPEN | SOLVED | 129 | walk, collect |
| CUT rock, WITH sword | SOLVED | 157 | **break**, walk, collect |
| CUT rock, WITHOUT sword | REFUSED | — | (none) |

⇒ the SHORTCUT room grades **INERT** and the CUT room grades **STRONG**, both
read off `differentialGrade` itself.

> **THE FOURTH WALL. A verb is selected ONLY from a `planError` — the frontier
> walk that names an obstacle runs inside `solveSegment`'s plan-failure handler.
> A shortcut is BY DEFINITION a cell whose walling leaves the goal reachable, so
> the planner never refuses, no obstacle is ever raised, and no verb is ever
> selected. On Seedling an item-gated obstacle grades STRONG when it CUTS and
> INERT when it does not, and NOTHING IN BETWEEN.**

SHORTENS therefore needs a solver ROUTE PREFERENCE that spends a registered verb
to shorten a walk it could already make — a change that re-plans every committed
room holding a clearable obstacle beside an open way round, i.e. one that MOVES
TAPES. ⚖ An ask, not a slice's to take. ⚠ The MAZE reaches the grade in the same
machinery because its solver is a BFS over an edge graph where an item-locked
edge is simply *passable when the item is held* — there is no refusal to hang a
verb off, and none is needed. The fifth grade is not unreachable in general; it
is unreachable through a REFUSAL-DRIVEN frontier.

⇒ **`shortcut` STAYS OUT of `ELEMENT_TABLE`** (trap 462, now for a sharper
reason), the four re-pins trap 457 predicted do NOT land, and `--require=hasSword`
is UNMOVED at `killgate+arena`. **The reachable head is row 14's ROCK LOCK** —
the CUT arm above is its evidence: a `breakablerock` on a main-path cut,
`needs:['hasSword']`, no live body and therefore no A10, and a without-arm that
refuses BY NAME on the item rather than on a budget. It is named here for the
generator slice that builds it.

**⛔⛔ AND A DEFECT IN A SHARED HELPER, MEASURED AND DELIBERATELY NOT FIXED.**
`presses.js` and `playerPhysicsV2.js` both transcribe `Player.direction` as
**RIGHT 0 · UP 1 · LEFT 2 · DOWN 3**. `solverBot.FACING_KEYS` is
`{0:right, 1:down, 2:left, 3:up}` and `facingToward` returns `dy >= 0 ? 1 : 3` —
the vertical pair is SWAPPED. The pair is self-consistent as a *key* map
(`FACING_KEYS[facingToward(...)]` really does walk toward the target) and wrong
as a *direction*: `slashRectToward` feeds the same integer to `slashRect`, so
for a target directly above or below the rect is computed on the opposite side.
Measured at the origin:

```
target BELOW  facingToward -> 1   slashRect(...,1) is the UP rect    NO overlap
target ABOVE  facingToward -> 3   slashRect(...,3) is the DOWN rect  NO overlap
```

⇒ `deriveStrike`'s candidate filter and `execKillByPress`'s live reach test can
NEVER accept a vertical strike cell. It is a CONSERVATIVE defect — it refuses
opportunities, it never presses the wrong way — which is why three rungs of
committed tapes are green over it: every press they contain is horizontal, where
the two conventions agree. **Repairing it would hand the kill arm a class of
cells it has never had, and a nearer vertical cell would be chosen ahead of the
horizontal one every committed kill uses — i.e. it MOVES TAPES.** ⇒ pinned as a
finding in `breakVerb.test.js` (rows that go RED the day it is fixed, and are
rewritten as the repair's own rows then), worked around by a correctly-numbered
local helper, carried as a ⚖ ask.

⛓ The live Pages row after this slice's deploy: **20 / 0, ALL PASS**
(`check-seedling-wasm-pages.mjs --root=https://peerinfinity.github.io/Archipelago-CC`)
— unmoved at slice 3's number, and worth running even though no ship path moved,
because the roster the site's picker enumerates GREW by one tape.

### Slice 5 — THE CONTINUATION MADE HONEST: (d), the TIMED-ROW rule, and the true-start census

**⛓⛓⛓ (d) — THE rng STRIP HAPPENS AFTER THE ADMISSION.** ⚖ Ruling 12 (user,
2026-08-20) and ruling 14 (2026-08-21). `watchWasm.continuationTape` composes
`gameVisibleTape` and then zeroes `rng.seed` / `rng.cosmetic` / `rng.fp` on the
copy `botLoadTape` receives, for **k > 0 only**. `continuationAdmission` is
untouched — the declared stream position is still asserted, pre-vs-pre, against
the live world's `beginEntry` reading at every boundary. It is simply no longer
APPLIED to a game that is already running.

The mechanism is slice 3's own finding (trap 492) read from the other end:
`Bot.botStart` applies a stream position whenever it is non-zero
(`Bot.as:1772`, `:1782`) and does so WITHOUT rebuilding (`:1722-1725`). On
window 2 of `?tapes=r8-d2` that write rewound the live stream by exactly L19's
build, and `boundary 2/3` refused. Nothing about the DECLARATION was wrong; the
page was handing the game a fact about a fresh page.

**⛔ `split` IS KEPT, AND IT IS NOT SYMMETRY.** `Rng.split` is a STATIC assigned
UNCONDITIONALLY on every `botStart` (`Bot.as:1771`), so zeroing it would not be
a no-op the way the three seeds are — it re-routes the cosmetic stream. A later
window that declares a DIFFERENT `split` from window 1's is refused at TIER 1,
in the picker, before a frame exists. ⛓ **The rule has a LIVE witness rather
than only a mutant** (trap 475): of the 154 tapes on the roster, 110 carry no
`rng` block at all and **two — `r6-owl-control`, `r6-owl-kill` — really declare
`split: true`**. (The brief's "every tape declares `split: false`" was measured
FALSE first; absent is read as false, because `botLoadTape` defaults the field.)

The page says what it did: **`rngStripped`** per window carries the triple that
was DECLARED, ASSERTED and NOT APPLIED, as a FIELD (trap 269) — `null` for
window 1, because a fresh boot applies everything and must.

**⛓⛓⛓ THE TIMED-ROW ADMISSION RULE.** ⚖ Ruling 14, refining slice 2's
*"admitted iff it MATCHES"*: **a segment's declared persistence carries TWO
different things, and the roster already marks which is which.**

| kind | what it says | on a continuation |
|---|---|---|
| a LATCH row (untimed) | the world this window INHERITS | must MATCH, both ways |
| a FORWARD declaration (a v9 TIMED row, `at`) | a clear this window's OWN WALK earns | must NOT be held yet |

Latch equality cannot tell them apart, which is why slice 2 refused
`r7-act2-5` for declaring `{5,0}` — exactly what it has to declare — and
concluded the hand chain was *"not continuable past window 4 AS RECORDED"*.
**No new tape field was needed.** Measured over all 154 tapes, seven carry
timed rows and not one of them is a latch. ⇒ a timed row is excluded from latch
equality, REFUSED BY NAME if the live world already holds it (*"the lock is
open before the walk that opens it"*), REPORTED per boundary, and routed
differently on the two sides:

- **wasm** — `continuationTape` WITHHOLDS it. `gameVisibleTape` drops `at` and
  KEEPS the row, which on a fresh page reproduces the recorded state and on a
  continuation hands the clear AT BOOT — a ledger rebuild. The live game earns
  it on its own tick.
- **JS** — the model CANNOT compute it (`levelRun` refuses to compute a
  kill-lock clear itself: *two writers of one persistence slot*), so the
  resumed run RECEIVES it, REBASED by the window's offset, through one new
  face: **`levelRun.addTimedClears`**. It refuses a row the world already holds
  and a duplicate of one still pending. `createRunForStaging` is untouched and
  there is no data path to the face — only a caller, in code, can pass rows.

**⛔⛔ AND THE JS HALF NEEDED A THIRD LEDGER NOBODY HAD ASKED FOR.**
`earnedClears` does not hold a row applied through `applyTimedClears` — that
ledger answers *what the next BUILD of a level may be handed*, and the model
computes no kill-lock clear at all. But the GAME's persistence ARRAY holds it
the moment the tick numbered `at` begins, and that array is what the successor
tape's `persistence` block was read out of. So the live envelope was short
exactly those rows and boundary 5 would have refused on `{5,0}`: **a true
sentence about the wrong ledger, for the second time in two slices** (the
splice's out-of-band fold was the first). `levelRun` gains
`appliedTimedClears`, the envelope folds it in, and window 1's own timed rows
are excluded from the boot fold until their tick.

**⛓⛓⛓ THE RESULT, HEADLESS:** `?tapes=act2-the-sword&side=js` steps **ALL
ELEVEN WINDOWS with TEN BOUNDARIES ADMITTED**, and `act2-the-sword` is
byte-untouched. Slice 2's named work order — *"a re-record without the forward
declaration"* — was the wrong one; the fix was an ADMISSION RULE. ⛓ A free
cross-check nobody wrote for it: the rebased ticks the chain produces —
`{5,0}@1559`, `{8,0}@2515`, `{8,1}@3067` — are EXACTLY what the headline
`r7-act2-full` declares, a tape recorded long before any of this existed.

`jsLiveEnvelope` MOVED from `watchViewer.js` to `director.js` (the admission's
home) and is re-exported: `watchViewer.js` touches `window` at module scope and
cannot be imported in node, and the census has to ask the page's OWN question
rather than a re-spelling of it (trap 383).

**⛓⛓⛓ THE CAMPAIGN CENSUS — `census-seedling-campaign.mjs`.** ⚖ Rulings 11 and
14. It walks the sphere-ordered solver roster, asks
`director.continuationAdmission` PAIRWISE (window k from its OWN declaration,
so a break at pair 4 does not blind the census to pairs 5..11), and publishes a
FIX LIST with the number each re-record must produce.

```
 1→2  2→3  3→4        CONTINUE            7→8, 9→10  CONTINUE pairwise
 4→5  NEEDS RE-RECORD  seam.time 5609 vs declared 5701  (Δ+92)
 5→6  NEEDS RE-RECORD  seam.time 6279 vs declared 6533  (Δ+254)
 6→7  NEEDS RE-RECORD  seam.time 6847 vs declared 6908  (Δ+61)
 8→9  NEEDS RE-RECORD  seam.time 7921 vs declared 8184  (Δ+263)
10→11 NEEDS RE-RECORD  seam.time 8587 vs declared 8586  (Δ−1)
11→r9-solve-3  ⛔ REFUSED on LEVEL and CTOR — ends L10 (48,32), boots L3 (96,128)
 tail: r8-solve-18 → r8-d2-19 → r8-d2-20 CONTINUES throughout (2218 ticks, end L13)
```

**⛔⛔ AND THE BIGGEST ROW IS NOT A RE-RECORD AT ALL.** `r8-solve-11` is the
BATTERY's segment 11: its goal is the CHEST at L11 and it exits BACK to L10, in
87 ticks. The ROUTE's step 11 is `reach-exit(teleporter@32,0 → L3)`, which the
survey already SOLVES at **119 ticks**. ⇒ the true-start chain is missing a
segment nobody has recorded, the solver can produce it today, and **the gap
count is FOUR, not three** (step 11's route leg · steps 13/14/15 at 47 / 237 /
74 t). The chain's honest stop is unchanged: **L14's camera band**.

⚠ The survey's `KNOWN_ANSWERS` map is what hid it — it points step 11 at
`r8-solve-11` as *"the known-answer tape a row's tick count can be compared
against"*, which is agreement information about a BOOT and never a claim that
the committed tape satisfies the route's GOAL. Nothing said otherwise; nothing
had asked.

**⛔ EVERY COUNT NAMES ITS BOUND.** The JS tier leaves `rng` and `seam`
UNASSERTED BY NAME at every boundary. And **no tape declares `save.time`** —
the game clock is `seam.time` — so on this tier the drift is caught only by the
free `gameClock` ORACLE and is an oracle row, never a refusal. The census says
so per row. ⚠ The oracle is fed a **STAGED** walk's dead frames, never the
continuation's: a staged walk pays the boot fade (`LOAD_FADE_FRAMES` = 20) and
the declared latch it is compared against was measured after a fresh-page
replay that paid the same fade, so an oracle fed the continuation's would
report every boundary of `act2-the-sword` — measured exact in all ten — as
short by exactly that fade.

**⚖ RULING 13's ROCK-EXPOSURE REPORT, ANSWERED: NO CHAIN ROOM MOVES.**

| walk | room | rocks | answer |
|---|---|---|---|
| `r8-solve-3` (step 3, L3 out) | L3 | 2 | PRE-SWORD — no claim is makeable |
| `r9-solve-3` (step 12, L3 return) | L3 | 2 | **REQUIRED, NOT A SHORTCUT** — the rock CUTS the room, so the break is a cost the walk already spends (15 tiles vs a refusal) |
| survey step 13 (L2) | L2 | **0** | THE AXIS REACHES NOTHING HERE (trap 475), named |
| survey step 14 (L0) | L0 | 3 | **21 tiles either way** |

⇒ the chain re-record goes AHEAD and shortening follows under its own licence.
The probe is SCRATCH and reuses the planner's own per-visit `brokenRocks`
family, so the shipped planner is byte-untouched; both arms treat every
teleporter volume as already-contacted, identically, so the two lengths differ
only in the rocks.

**⛓ THE GATE MOVES.** `check-seedling-editor-sequence` 20 / 0 → **21 / 0**, and
claim 9's pin moves from *"stopped at r7-act2-5 after 5 window(s)"* to *"11
window(s) stepped; 10 boundary(ies) admitted"* — the old answer kept in the
comment as the mutant's value. The ship gate goes **83 / 0 → 91 / 0** over its
five arms, every count DERIVED from the chain and the tapes rather than typed
(trap 495).
⛔ **This slice moves NO tape, trace, expectation or generator default.**

**⛔⛔⛔ AND THE MEASUREMENT REFUTED THE PREDICTION — (d) MOVED THE REFUSAL, IT
DID NOT REMOVE IT.** The seal said the three-window `?tapes=r8-d2` would admit
at both boundaries. On the real GPU it admits at `boundary 1/3` and refuses at
`boundary 2/3` — **but not on `rng`**. `rng` is not among the findings at all,
which is exactly what (d) was built to achieve. The ONE remaining refusal is
`seam`, and `time` is the only row of it that differs:

```
?tapes=r8-d2          r8-d2-20     declared 10213   live 10192   Δ 21
?tapes=act2-the-sword r7-act2-3    declared  5069   live  5048   Δ 21
?tapes=<solver 1..11> r8-solve-3   declared  5069   live  5048   Δ 21
```

⛓⛓⛓ **THREE INDEPENDENT CHAINS, ONE NUMBER: 21 = `LOAD_FADE_FRAMES` (20) +
`BOOT_PRESWAP_FRAMES` (1)** — the room fade a fresh page pays on `botStart`
plus the one frame a boot spends in the outgoing world. Every declared latch on
the roster was measured after a FRESH-PAGE replay of its own segment; a
continuation pays neither. In each case the boundary BEFORE it admits, because
window 1 IS a fresh boot and pays exactly what the declaration was measured
with; every boundary after the first is a continuation and is 21 behind.

⇒ this is a fact about the **tape format**, not about the page: one declared
reading cannot be both a fresh page's boot state and a continuation's arrival
state. **⚖ Ruling 12's option (a) — a SECOND declared stream position, the
POST-build reading beside the PRE-build one — is REVIVED BY MEASUREMENT** and
is NOT built here (ruling 14: only a measured residual mismatch revives it).
The CHAIN arm therefore keeps its refusal and asserts the measurement: `rng`
ABSENT from the findings and `seam` PRESENT, both ways round; `time` the only
differing seam row; and the residual DERIVED from the two constants. The
boundary record now publishes `live.blocks` as DATA, because that number
existed only inside a refusal SENTENCE and a gate asserting it would have had
to regex prose for a value (trap 269).

⚠ **AND THE WASM TIER'S SUBJECT IS THE JS-ADMITTED PREFIX.** `watch.html` runs
the JS walk FIRST — it is what produces each window's model stream — so a queue
the JS tier refuses never reaches the ship: `?tapes=<all twelve>` stops at
*"window 11 (`r9-solve-3`) cannot continue window 10"* and `__watch.wasm` never
reaches `runtime`. The census prints the prefix, with the reason (trap 486 — an
instrument that cannot fire).

### Slice 6 — ⛓⛓⛓ THE TRUE-START SOLVER CHAIN: fifteen rooms, every boot a MEASURED latch, and the clock on a continuation

⚖ **Ruling 11 (user, 2026-08-20)**: *"As we work our way through Seedling, I'll
want to construct a sequence of tapes to play back our solutions from the
beginning of the game … And I'll want the tapes to be recorded from the solver,
not constructed manually."* ⚖ **Ruling 15 (user, 2026-08-21)**: the clock rides
the continuation treatment in the other direction.

#### (d′) — the one field a continuation is handed MORE of

Slice 5 measured what (d) left behind: at every boundary after the first,
`declared − live = 21` on three independent chains, with every other seam row
EQUAL. The mechanism is `Bot.as:1703` — `if (seamTime != 0) Main.time =
seamTime` runs on a continuation too, and `botStart` then does NOT rebuild, so
the walk begins without the fade its recording was made behind.

⇒ `watchWasm.continuationTape` hands `botLoadTape` a copy declaring
**`seam.time + BOOT_COST_FRAMES`** — after the plain-equality admission, never
before — and publishes `clockBumped: {declared, applied, bootCost}` as a FIELD.
`BOOT_COST_FRAMES` is `LOAD_FADE_FRAMES` + `BOOT_PRESWAP_FRAMES`, imported and
summed once. A zero or absent `seam.time` stays zero.

**MEASURED on the real GPU**: `?tapes=r8-d2` now admits at BOTH boundaries with
a **ZERO residual** and every seam row equal, all three windows agree per tick
(574 / 865 / 782), the whole concatenation is 2219, the dead-frame shares are
[41, 170, 170] — window 1 reading one MORE than the model because a fresh boot
spends its pre-swap frame in the outgoing world — and the end state is L13,
Δ0/Δ0. The chain reached its end for the first time.

⛔⛔ **AND THE RULING'S SECOND HALF WAS REFUTED BY MEASUREMENT.** It asks for the
same bump on the JS side. Taken at the pristine baseline before a line moved:
the model's resumed clock is ALREADY `declared + 21` at every boundary (9200 vs
9179; 10234 vs 10213), because a sequence is ONE `levelRun` and `enterWorld`
spends the fade at the door crossing that ENDS the previous window. A second
bump would put the model 21 AHEAD of the game (d′) had just corrected. What was
built instead is the PIN, in `gameClock.test.js`, deriving its roster from
`PLAYTHROUGH_CHAINS` — and it NAMES what it cannot measure: a CUSTODY chain's
segment 1 is the true initial boot, which declares no `seam`, so its clock is
`null` at every boundary.

#### The chain

`r9-campaign` — **fifteen segments**, custody, from `new Game(0,80,128)` with an
empty save to the L14 arrival, **3470 ticks**:

```
 1 r8-solve-1   L0  → L2   183     9 r8-solve-9   L9  → L10  122
 2 r8-solve-2   L2  → L3    47    10 r8-solve-10  L10 → L11   90   (the SWORD)
 3 r8-solve-3   L3  → L4   245    11 r9-solve-11  L11 → L3   119   (the CHEST)
 4 r8-solve-4   L4  → L5   255    12 r9-solve-3   L3  → L2   226   (the `break` room)
 5 r8-solve-5   L5  → L6   558    13 r9-solve-2   L2  → L0    47
 6 r8-solve-6   L6  → L7   294    14 r9-solve-0   L0  → L13  237
 7 r8-solve-7   L7  → L8   146    15 r9-solve-13  L13 → L14   74
 8 r8-solve-8   L8  → L9   827         STOP: route step 16 — L14's camera band
```

Segments 1–4 are PROMOTED (their boots already ARE their predecessors' latches);
5–10 and 12 are re-booted from measured latches; 11, 13, 14, 15 are new. The
segment list is the only declaration in the producer — every coordinate under it
is read out of the atlas, and no stance, waypoint or hold tick is handed to the
solver.

**⛓⛓⛓ EVERY RE-BOOTED SEGMENT MOVED IN ITS BOOT BLOCK ONLY** — `inputs`
byte-identical, `tick_count` unmoved, expectations unmoved — and for six of the
seven the only seam row that moved is `time`, with `rng.seed` UNCHANGED. The
reason was predictable and was predicted: the only model-visible field that
moves is the clock, and `clock.now()` reaches only the spinner hammer, of which
these twelve rooms have NONE.

**⛓ THE FREE ORACLE ASSERTED THE WHOLE CLOCK COLUMN** and the chain COMPOUNDS,
which a pairwise census cannot see: 5609 · **6187** · **6501** · **6667** ·
**7514** · **7656** · 7917 · 8387 · 8633 · 8700 · 8957. Five of those differ
from the census's pairwise numbers because once segment 5 moves, everything
downstream of it moves too.

#### What the page does with it

`?tapes=r9-campaign` steps all fifteen windows on ONE game state, admits all
fourteen boundaries, and produces the headline's **3471 observations tick for
tick** — with the rebased forward rows `5:0@1157 · 8:0@1974 · 8:1@2373` equal to
the headline's own declared v9 rows. Two derivations, one answer.

**THE GOAL LEDGER CREDITS FROM SOLVER TAPES FOR THE FIRST TIME**: `sword@L10`
and `chest@L11`, measured as NOT-HELD → HELD between each segment's own boot and
its own latch. The ledger line reads **2/41**.

#### Three findings the chain measured and nothing before it could

1. **`jsLiveEnvelope` was short the BANKED writes.** A chest open runs
   `Game.setPersistence(tag, false)` and this model banks the consequence for
   the next build; the GAME's flag array holds it at once, and that array is
   what a successor's `persistence` was read out of. Boundary 11 refused
   `r9-solve-3` for declaring `{11,0}`. ⇒ `levelRun.bankedClears`, the fifth
   ledger — trap 493 for the third slice running. No chain before this one had
   a window AFTER a chest open.
2. **The clear-evidence arm dispatched on the KIND, and the kind was a proxy for
   the AUTHORING METHOD.** `custody` meant hand-planned with `phases`; `staged`
   meant solver-authored with `clears`. A custody chain that is solver-authored
   breaks the coincidence, so the dispatch is on the CARRIER the chain declares.
   And segment uniqueness is now PER KIND, which is what its own message always
   said.
3. **A third clear source, `transported`**, because the second cannot be faked: a
   headline declares the same clear at a different tick from the segment that
   owns it, and no 1974-tick truncation was ever driven. The row names the tape,
   the measured tick and the offset, and must add up.

#### The numbers

Solver-roster gate **754 PASS / 0 FAIL / 68 SKIP** over 26 tapes (successor to
the R8 tape gate's 541/0/67 over 20), porcelain under `fixtures/` EMPTY after
it. Ship gate **91 → 105 / 0**. Sequence gate **21 → 26 / 0**. Demos **21 → 22**
(the `?tapes=` row). vitest **6759 → 6800** over 182. Roster **154 → 159**.
Battery `--check` `67bcde75…` → **`6d667b170723c2e0644eb8971a8c7dbe`**, exit 0
both sides — the ownership handover, one producer per tape.

### Slice 7 — ⛓⛓⛓ THE FIRST COVERAGE-DERIVED RETIREMENT: the hand chain retires, and NINE of its twelve tapes are covered

⚖ **Ruling 14's first execution.** The hand chain `act2-the-sword` — eleven
rooms walked by hand at R7, the rung's original custody chain — is **out of
`PLAYTHROUGH_CHAINS`, out of `PAGE_CHAINS`, out of the page's picker and out of
the sequence gate's pin**. `r9-campaign` is the custody chain now.

#### Which tapes are covered, and which are not

Ruling 14 retires a hand tape *the moment a solver tape covers its claim*, and
its second clause says a tape whose family nothing else witnesses **stays,
named**. Both halves fired.

**NINE ARE COVERED** — `r7-act2-1, -2, -3, -4, -7, -8, -9, -10, -11`, each by
its `r8-solve-N` twin walking the same room from the same boot. Rooms 1, 2, 3,
7, 9 and 11 the solver walks in the SAME tick count (183 / 47 / 245 / 146 / 122
/ 87); rooms 4, 8 and 10 it walks differently (347→255, 1090→827, 89→90).

**THREE STAY, AND THIS IS THE RECORD OF WHY:**

| tape | the family nothing else witnesses |
|---|---|
| `r7-act2-6` | the **v10 `despawn` declaration** — `bob@112,48` drowned at tick 120, witnessed by a truncated-arm probe |
| `r7-act2-full` | the roster's **other** v10 despawn |
| `r7-act2-5` | the ETA transit probe's POSITIVE oracle (*"the hand walk never enters an armed lane"*), the `tset -1` hold→kill refinement, and the `twoPassSolve` ETA bound |

Measured over all 159 tapes: `tape_version {1:11, 2:12, 3:38, 4:22, 5:20, 6:6,
7:10, 8:31, 9:7, 10:2}`, and the tapes declaring a despawn are **`r7-act2-6` and
`r7-act2-full`, nobody else**. `r8-solve-6` is v8 and declares nothing. **A
solver walk has no `phases` block and no witnessed removal by construction**, so
no solver tape can ever take those claims over.

#### The choreography record, which is now HISTORY rather than code

`solve-seedling-r8-battery.mjs` used to DERIVE, from the hand chain's own
`walk.units`, which of its rooms were hand-choreographed. That derivation
retired with the route it read. The answer it gave, preserved here:

| segment | verdict | why |
|---|---|---|
| 1, 2, 3, 7, 9, 10, 11 | BATTERY — legs only | (10 also `collect`, 11 also `chest`) |
| 4 | EXCLUDED | mechanic `hold`, mechanic `shove` |
| 5 | EXCLUDED | 1 `phases` block |
| 6 | EXCLUDED | 1 `phases` block |
| 8 | EXCLUDED | 2 `phases` blocks, mechanic `shove` |

⇒ derived battery `[1, 2, 3, 7, 9, 10, 11]`, seven rooms. The split survives in
the producer as a DECLARATION with this table as its provenance — keeping the
old `check()` rows against it would have compared a constant to a transcription
of itself.

#### ⚖ Ruling 17 — minimize hardcoding — and the measurement that made it easy

The user, mid-slice: *"I want to minimize hardcoding in general."* The first
build had kept the hand route as a 300-line constant and baked four boot blocks.
Both were refused, and the measurement is what settled it:

> **The hand route's eleven goal lists and the atlas derivation the campaign
> producer already used are IDENTICAL, coordinate for coordinate — 11 of 11.**

So there is no route constant. `scripts/procgen/seedling-atlas-goals.mjs` holds
the one derivation (a room's pickup by ENTITY TYPE, a crossing by the game's own
`attrs.to`), and the battery, the tail and the campaign producer share it. **No
boot block is baked either**: rows 1–4 and 11 read their own twins (byte-equal
over all eleven boot-block fields, measured), the rest read the campaign's
re-recorded latches. The only literals left are the HAND TICK COUNTS, because
nothing on disk records how long the hand walk was and reading them off the twin
would turn `solver vs hand` into `solver == hand` by construction.

⛓ And reading the campaign's latches instead of R7's turned out to be
**byte-inert**: rows 6/7/9/10 solve to identical tick counts either way. The
difference is `seam` — the clock — and L0–L14 hold no spinners.

#### The decayed bound, and the gate that outlives it

`r8-battery-4` declared `endsAt: 253` over a 255-tick tape: slice 3 re-recorded
that tape and moved the tape, not the constant, and nothing compared the two for
four slices. Fixed — and gated. Measured across the roster before the gate was
written, `endsAt === sum(segment tick counts)` held for **all fifteen chains**
and failed for exactly this one, so it is an invariant rather than a rule fitted
to a defect. It runs in the acceptance sweep AND in vitest, because the sweep's
only roster-wide runner needs a GPU.

#### The numbers

Sequence gate **26 → 24 / 0** (the act2 pin retires; claim 9 is a paragraph
saying so, not an absence). vitest **6802 → 6794** over 182 files — the −9 is
exactly the nine `act2-the-sword` seams leaving the seam sweep (24 → 15), the
+1 is the new `endsAt` row. Survey **23/29, every tick unmoved** after being
re-pointed at the solver chain. Instruments **234 → 235**. Roster **159**,
unmoved — the deletion of the nine is slice 7b's, on a clean baseline. Battery
`--check` `6d667b17…` → **`75adf82610fa7ea21f6822590a3b0330`**, exit 0, and the
diff is exactly the three rows that would otherwise have become fixed points;
tail `--check` → **`9a6a31925cb5204eee4cb0ad66febed6`**, two lines, the stripped
clears are the solver's now. `solve-seedling-r8-d2-chain`, `-l18`,
`solve-seedling-r9-l3` and `-r9-campaign` are byte-identical to baseline.

⛓ **`scripts/procgen/identity-block.sh` is committed.** Ruling 8 published its
byte-inertia set as VALUES and every slice rebuilt the commands in a scratchpad
that was then discarded; three rows could no longer be reproduced at all. The
commands live in the repo now, with the published values beside them and the
three unreproducible rows marked.

### R9 slice 7b: the deletion, four gates that would have gone silent-green, and the campaign chain's first real-GPU refusal

Slice 7 measured the retirement and stopped. Slice 7b executes it, on a clean
baseline, and the irreversible half turned out to be the least interesting thing
in the slice.

#### The nine are gone; the three stay

**Roster 159 → 150.** Eighteen files left in one commit — `r7-act2-1, -2, -3,
-4, -7, -8, -9, -10, -11`, each tape and each expectation — plus the regenerated
`fixtures/tapes/index.json`. There were **no `fixtures/traces/` rows** for any of
them: every trace sidecar on the roster is the solver's, so the deletion is 18
files and not the 27 the work list implied. `r7-act2-5`, `r7-act2-6` and
`r7-act2-full` were not touched; their bytes are recorded before and after.

The retirement is a **guarded constant, not a typed list**.
`R8_ENEMY_BRIDGE.retiredTapes` sits beside `exposedTapes` — which is not edited,
because it is R8's PREDICTION and deleting a row from it would rewrite what was
predicted — and the assertion checks the subtraction against the DIRECTORY three
ways. A retired name that comes back reds by name; a retirement row with no
prediction behind it reds by name; a name on neither list that is exposed on disk
reds by name. All three measured by mutant.

⛓ **The producers did not move, and that is the headline.** All six
`--check` outputs are byte-identical to slice 7's close (battery
`75adf82610fa7ea21f6822590a3b0330`, tail `9a6a31925cb5204eee4cb0ad66febed6`),
and the whole identity block reproduces row for row. Slice 7 re-pointed every
staged boot off the hand tapes onto their solver twins; this deletion proves it
by removal.

#### Four acceptance gates would have gone silent-green

The deletion mutant — the nine removed with no reader paid — is the enumeration,
and it found something a grep could not. Four of the eight local browser gates
open with

```js
const alive = await fetch(`${HOST}/${TAPES}/<a hand tape>.json`).then((r) => r.ok);
if (!alive) { console.log('SKIP: no dev server …'); process.exit(0); }
```

so a tape that is **gone** is indistinguishable from a server nobody started.
`check-seedling-editor-boot`, `-refusal`, `-solve` and `-world` each printed SKIP
and **exited 0**. Four acceptance rows would have become permanently passing
no-ops the moment their subject retired, and nothing on any checklist tells SKIP
from PASS.

Every probe now fetches `fixtures/tapes/index.json` — the generated manifest,
whose absence really does mean "no server". Measured on the mutant: a missing
boot now exits 1 naming the path.

The same mutant found **two readers no work list named** — a staged-boot
comparison in `r8Acceptance.test.js` and a combat-census refusal in
`solverBot.test.js`, each reading a hand tape straight off disk — and **two gates
that had been red for slices** because nothing runs them: `-boot` asserted a page
title that moved when the true-start default did, and `-solve` pinned
`COMMITTED_TICKS = 253` against a tape R9 slice 3 had re-recorded to 255, so it
asserted a gap that no longer existed and went red *on a repair*. Both paid; the
second by reading the count off the tape instead of typing it beside the
derivation.

#### The survey stops printing a file it never opened

`survey-seedling-route.mjs --table` reported provenance by NAME without reading
the tape, so a retired fixture produced a complete-looking deliverable naming a
file that was not on disk — and exited 0. The full run, meanwhile, reddened ten
steps to `CRASHED — unclassified`, every child dying on the same `ENOENT`, with
the cause named nowhere.

One guard fixes both. Every boot source is proved to exist at load, in every
mode, and a dead one refuses with exit 2 naming the file and every step that
wanted it. The list is derived from the route rather than typed. The classifier
gains a `MISSING-FIXTURE` family as a second line of defence. On a healthy tree
the survey is byte-inert: 29 rows, verdict, tick count, boot source and family
all identical, headline 23/29.

#### The campaign chain plays on the real GPU, and stops at boundary 5/15

The whole true-start chain had never been played by the GAME. `?tapes=r9-campaign
&side=wasm` — 15 windows, 3470 ticks — was named as the obvious next Windows row
twice and never run. It ran.

**Five windows played and every one is clean.** Boundaries 0–4 admitted, the
player did not drift at any of them, each continuation was handed
`seam.time + 21`, and the drains are each tape's own `tick_count + 1`:
184 · 48 · 246 · 256 · 559. Window 5 set aside its own forward declaration
`5:0@427` by name.

**Window 6 was refused at the boundary, before anything played:**

> `r8-solve-6`: the declared `rng` is not the live world's — tape
> `{seed: 514746467, split: false, cosmetic: 0, fp: 341033166}` vs live
> `{seed: 1196897329, split: false, cosmetic: 0, fp: 341033166}`.

`r8-solve-6` declares **byte-identically the same `rng` as `r7-act2-6`**, the
retired hand tape it was staged from. Swept over all ten pairs: every
`r8-solve-1..10` still carries the hand chain's stream position, while their
`seam.time` values *were* re-recorded (5609 vs 5701, 6187 vs 6533, 6501 vs 6908,
6667 vs 7074, 7514 vs 8184, 7656 vs 8326). The boot blocks moved and the `rng`
did not.

That is also why it refuses at five and not at one. The solver's walks are
tick-identical to the hand's through L3, so the live stream is still where the
hand chain left it at every boundary up to 4. L4 is 255 ticks against 347 and L5
is 558 against 812 — L5 is the arrow bait, where kills draw — so the live stream
parts from the declaration inside window 5, and the first boundary that can see
it is 5/15. The `fp` is equal on both sides; only the seed differs. Two worlds at
the same position in different streams.

⛔ **No JS row could have found this.** The page's own sequence gate plays all
fifteen windows in chromium and reports *"14 boundaries; nothing refused"*,
because the model does not simulate the game's rng stream at all — it compares
declaration against declaration. Only the game holds a live seed that can
contradict one.

The arm asserts the refusal rather than a green it cannot earn — the shape slice
3 gave the chain arm and slice 6 inverted when `(d′)` closed it, run the other
way. It will invert again when the chain continues. The cure is a re-record of
five tapes' `rng` from the campaign's own live latch, which moves tapes and is
therefore an ask, not a slice's to take. How many boundaries lie behind the first
refusal is unmeasured.

#### A refusal used to cost the whole deadline

The first campaign run sat on a dead page for its full derived deadline and would
have reported a `TimeoutError` — a sentence about the clock, with the page's own
refusal, up within seconds, nowhere in it. A human watching the screen knew what
had happened twenty-five minutes before the harness would have.

Two changes, both general. The Windows driver now **flushes its record after
every step** rather than once at the end, so a killed run leaves everything it
gathered — the diagnostic that finally caught this refusal had the stage list,
the refusal and all fifteen window records in memory and no file on disk. And a
step may name an **abort expression**: both chain arms and the sequence arm stop
waiting when `__watch.wasm.refusal` goes non-null, skip the later waits, still
run their reads, and report `aborted` as a third outcome beside completed and
crashed. The same refusal now arrives in seconds, as data, naming the tape and
both seeds.

#### Gates

Identity block identical row for row. Six producers byte-identical. Reference
MATCH, 235 instruments. Survey 23/29 with every row unchanged. Sequence 24/0.
Demos all passed. vitest 182 files / 6767 — the −27 from 6794 is
`tapeIndexManifest` (one row per tape, −9) and `tapeRunner` (two rows per tape,
−18), no file gained or lost. The eight local browser gates **262 / 0 / 0 SKIP**,
up from 260/2. On Windows Chrome: the ship gate **131 / 0** including the new
campaign arm's 26 rows; the pages gate **20 / 0**, its picker reporting
`150 option(s), roster: manifest`; and the solver-roster differential
**768 / 0 / 67** — `+14` on slice 7's own `endsAt` invariant, one row per chain
over the fourteen chains that remain, and `−1` skip because the chain slice 7
retired is no longer there to skip. Zero failures: no solver tape moved.

### R9 slice 8: the TICK-0 LATCH — a second declared state, one build and one fade after the first

A segment tape has always declared its boot state **PRE-BUILD**: `botStart`
applies `rng` and `seam.time` *above* the deferred build (`Bot.as:1689`). A
FRESH page then spends that declaration — it builds the boot level, which takes
draws, and pays the load fade, which takes frames — and only then does the
walk's first tick happen. A CONTINUATION pays neither cost, because `botStart`
does not rebuild (`Bot.as:1722-1725`).

So for three slices the page had been correcting for a state nobody had
measured. R9 slice 5 ZEROED the declaration so the write became a no-op; slice 6
BUMPED the clock by a derived constant. Slice 8 measures the thing both were
standing in for: **where a fresh page actually stood at tick 0**.

#### The zero-tick tape, and why it is exactly the tick-0 reading

The measurement needs no new game code. A tape with `inputs: []` and
`tick_count: 0` is driven through the ordinary Windows replay driver, and the
fork's own control flow makes its terminal latch the tick-0 state:

1. the armed update gate returns early while `blackCover > 0 ||
   Game.freezeObjects`, counting dead frames and **not** advancing `tick` — so
   the whole boot fade is spent *before* tick 0;
2. on the first LIVE frame the tick-0 observation is recorded;
3. `tick >= tickCount` is true immediately at `tick_count: 0`, firing
   `latchSeam` — which runs "AFTER the final observation … and BEFORE this
   frame's `super.update()`".

The driver reads `botSeam` only once the run reports finished, which is that
same disarm. Measured over all twenty segments: every latch is at `latch.tick`
**0**.

#### What the field is, and what it is not

`tick0: { rng: {seed, split, cosmetic, fp}, seam: {time} }`, tape version
**11**, stamped only on tapes that carry it — every v1..v10 fixture round-trips
byte-identically past the bump.

The schema is not a parallel list. `SEAM_PREBUILD_FIELDS` is exactly
`["save.time", "rng.gameplay", "rng.cosmetic", "fp.seed"]` — the signature rows
read at `Game.begin()` ENTRY rather than at the terminal disarm, which is
precisely the set that *can* differ between the declaration and tick 0. Those
four land in two channels, three in `rng` and one in `seam`, and that is the
block's shape. Because `r7Acceptance` imports `tapeFormat` and not the other
way round, the format validates the halves by REUSE (`parseRng`;
`SEAM_BOOT_SPEC`'s own `time` row) and the correspondence is pinned by a unit
row in `r7Acceptance.test.js`, which can see both sides.

The field is **game-invisible**: `gameVisibleTape` drops it and still stamps 8,
so the fork sees the tape it always saw. It is **JS-staging-invisible** too:
`stagingFromTape`'s allowlist deliberately excludes it, because a field reaching
`createRunForStaging` would be a rebuild knob wearing a latch's name.

#### Which tapes carry it — twenty, derived

Every segment of every multi-segment chain in `PLAYTHROUGH_CHAINS`, read out
rather than typed: `toy-west-pair` (2), `r8-d2` (3), `r9-campaign` (15). Index 0
is included even though a first window is never a continuation, so the
missing-field refusal needs no special case. `derive-seedling-tick0.mjs` writes
only that set and refuses any name outside it.

The write is surgical. An earlier attempt re-emitted the tapes through
`serializeTape` and reformatted all twenty — it indents with two spaces where
the committed tapes use four, and it drops `"note": ""` — which parsed, replayed,
and would have passed a "does it still load" check while rewriting files it was
supposed to leave alone. The instrument now edits the committed text, and the
identity `JSON.stringify(JSON.parse(t), null, 4) + "\n" === t` is *measured*
over all twenty pristine tapes before anything is written. Across all twenty
diffs the only changed lines are `tape_version`, `despawn: []` (mandatory from
v10 up, and `[]` is what these tapes always meant) and the `tick0` block.

#### The clock result

Every one of the eighteen segments that declares a `seam.time` reads its tick-0
clock at exactly `declared + 21` — `LOAD_FADE_FRAMES` (20) plus
`BOOT_PRESWAP_FRAMES` (1). Render-coupled rooms included, so **render coupling
moves the stream and never the clock**. Slice 6's constant is now a CHECK the
game passes rather than a number the page adds.

The two true starts read **4820** with no declared term, because `botStart`
writes `Main.time` only when the declaration is non-zero — a true start inherits
the page's own boot clock.

The readings are reproducible: three tapes driven twice with `--no-cache` — a
true start, a render-clean room and a render-coupled one — came back
byte-identical in every field.

#### What the page does now

On a continuation the page WRITES the measured tick-0 `rng` and `seam.time`,
through `botStart`'s existing writes. `split` is still taken from the
declaration, because `Rng.split` is assigned unconditionally and is a property
of the whole sequence rather than of a boundary. The readout field
`tick0Applied` replaces `rngStripped` and `clockBumped` and carries both
readings plus `obeysBootCost`.

A continuation window whose tape lacks the field is refused **by name, with the
derivation command**, in the picker and again at the boundary. Serving it under
the old zeroing is the silent-wrong-answer shape: it plays, disagrees with its
own recording from its first tick, and surfaces as somebody else's `rng`
refusal several boundaries later.

The admission's `rng` row is **posture-gated**. `rng.gameplay` is a
`level-qualified-equality` row: comparable only where the boot room's render
path takes no draws. Where it does, the two sides are a render count apart and a
render count is ±2-banded, so the row is reported NOT COMPARABLE with its sites
instead of refusing on a frame budget. The gate is fail-closed — no posture
means assert — and the excused row is still reported, because a boundary nobody
can assert is a fact about the chain.

Of the seventeen boundaries in the three chains, fifteen are render-clean; the
two that are not are `r7-ends-meet-2` (L94) and `r9-solve-0` (L0), both the
waterfall spray.

#### The prediction missed, and the miss is the proof

The campaign arm was flipped from asserting a refusal to asserting the chain
running end to end, and run. **It still refuses at `boundary 5/15`**, on the
same two seeds as before: live `1196897329` against a declared `514746467`.

And the write demonstrably works — windows 2..5 were each written their
committed tick-0 block field for field, every clock obeying `declared + 21`,
boundaries 1..4 admitted, and all five windows agree per tick with their own
model.

That is what makes it a proof rather than a repeat. Because window 5 provably
*began* at its own fresh-page tick-0 state and walked its own inputs to a
per-tick agreement, the live world's position at boundary 5 **is**
`r8-solve-5`'s fresh-page exit — by construction, not by argument. So the
declaration simply is not that number, and `r8-solve-6`'s `rng` is
byte-identical to `r7-act2-6`'s, the retired hand tape it was staged from. The
earlier slice could infer that the stream position was never re-recorded; this
one can prove it, precisely because the tick-0 write is what makes the live walk
the fresh-page walk.

The posture census cleared the obvious suspect before any browser started: L6 is
render-clean, so there are no fade draws to carry and the row is correctly
asserted.

Off the committed blocks, at boundaries 6, 7 and 9 the successor's declared seed
equals the predecessor's tick-0 seed, so those admit if their walks spend no
gameplay draws; at boundary 8 they differ, so 8 is the next boundary that can
fail. Boundaries 6..9 remain unmeasured behind the first refusal.

#### Two defects found on the way, both older than this slice

`plan-seedling-r7-ends-meet.mjs --check` was already red on all three of its
tapes and then crashed, measured at a pristine baseline before anything was
touched. It stamped `tape_version: TAPE_VERSION` — the one emitter that read the
constant whose own docblock says nothing that emits a tape may read it, so every
version bump since v8 re-versioned its output — and its loop walked every chain
and died on the first one a solver authored. Both paid; it runs clean now. It is
on no checklist, which is why nobody noticed.

And a node-only import broke the watch page. The posture helper reached
`rngPostureOf` through `r6Acceptance`, which imports the node-only fixtures
module, so `node:fs` landed in the browser bundle. The way it failed is the
lesson: the sequence gate reported a 180-second timeout, not a module error — a
page that fails to *load* reads exactly like a slow one, and the modules import
fine under node. The pure posture code moved to a browser-safe module with a
re-export, and a module-graph sweep now proves no node-only module is reachable
from `watchWasm.js`.

#### Gates

Identity block identical row for row; the six producers green with four md5s
moved on purpose and two unmoved as the control; reference MATCH at 236
instruments; survey 23/29; sequence gate 24/0; the eight local browser gates
262/0/0; vitest 182 files / 6777. On Windows Chrome: ship gate **142 / 0**
(up from 131, the new tick-0 rows), pages gate **20 / 0** with the picker at
150, and the solver-roster differential **768 / 0 / 67** — unmoved to the row
across twenty-six fresh-page replays, which is the measurement that the field is
invisible to the game.
