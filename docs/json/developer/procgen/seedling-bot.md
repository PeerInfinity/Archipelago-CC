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
| The differential harness | `scripts/procgen/check-seedling-bot-differential.mjs` |
| Real-GPU browser driver | `scripts/procgen/seedling-bot-replay-win.py` |
| The in-game bot (tape interpreter, flags, grants, readout) | the `seedling` fork, branch `bot`, `src/Bot.as` |
| The five one-line flag guards | the `seedling` fork, branch `bot`, `src/Player.as` |
| Build script + pipeline recipe | `build_bot.sh` in the seedling bot build directory (outside this repo) |

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
ANSWER.** `check-seedling-bot-differential.mjs` runs the same tape through
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
node scripts/procgen/check-seedling-bot-differential.mjs --win

# 3. re-record after a deliberate physics or fixture change
node scripts/procgen/check-seedling-bot-differential.mjs --record --win \
    --only=collide-up-rock,transition-west-return
```

SKIPs (exit 0) when the wasm build is absent, like every other seedling
verifier. ⛓ 2026-08-19: "absent" now means *the submodule is not checked
out* — the builds ship in `PeerInfinity/seedling-wasm` at
`frontend/modules/flashPanel/wasm/`, and CI does check them out
(`.github/workflows/seedling-wasm.yml`).

⛓ **The build it runs against is the manifest's `default` — `seedling_bot_ap_p4e`
since R9 slice DEF (⚖ user, 2026-09-27; licence: the CI full tier on p4e, run
36350758799, 154 tapes 3745/0/46), `seedling_bot_ap_p4d` before it from EDITOR
INTEGRATION slice P2.** p4d was the only bot build from the p4b/p4c
retirement (SEEDLING HEADLESS WEBGPU slice R2, 2026-09-12, ⚖ user: *"I think it
just needs to behave correctly with the new build"*) until P4E pinned p4e
beside it; since DEF p4d stays pinned as the `hold`/`tag` CONTROL
(`SEEDLING_PAGE=seedling_bot_ap_p4d` drives it). Its first move,
onto `seedling_bot_ap_p4b`, was itself a measurement. It defaulted to
`seedling_bot_ap` — the R8 bot build
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

⛓⛓ **H2 (2026-09-12): TWO CHANNELS, AND HEADLESS IS THE DEFAULT.** Every Seedling
gate that drove Windows Chrome now runs headless by default and takes `--win`
for the real-GPU run — the gate's own Python driver, run by the repo venv's
python (`scripts/procgen/seedlingDriver.js`, Playwright pinned in
`scripts/procgen/requirements-headless.txt`), so both channels observe through
ONE protocol. Headless means **logic-only** (`HEADLESS_LOGIC_ONLY_ARGS`: the
device is lost on purpose, ~26–30 ticks/s, no pixels), PROVED on every run by the
runtime's `__swfGpu.lost` (`scripts/procgen/seedlingChannel.js`; a live device
or an absent readout is a refusal by name) — except the two gates whose claims
assert zero pageerrors (`check-seedling-wasm-pages`, `check-seedling-wasm-ship`),
which keep the pixels set because the device-lost message IS the logic-only
channel's signature. `headlessChromium.test.js` derives that split from the gates'
text. The roster calls such a gate `dual` (`gateRoster.js`) and CI runs it on
ubuntu-latest, where the same two channels were measured (runner probe, run
34724984639). The 150-tape full tier runs in CI only by `workflow_dispatch:`
(`.github/workflows/seedling-full-tier.yml`); its standing row is
`roster: --tier=full` (`roster: --win --tier=full` until H2), the channel recorded
on each part. `--win` remains the channel for real-GPU pixel questions.

⛓⛓ **H3 (2026-09-13): THE TIER IN CI IS SHARDED — plan → shard matrix → merge.**
Dispatch it from the Actions tab (*Seedling full tier (manual)*) or
`gh workflow run seedling-full-tier.yml -f tier=full -f shards=10`; both inputs
default to those values, and `workflow_dispatch:` stays the only trigger
(`seedlingFullTierWorkflow.test.js`).
- **plan** runs `check-seedling-bot-differential.mjs --tier=<t> --shard-plan=<n>
  --json` (no browser, no lock, no wasm). The differential prices each tape with
  `fullTierEstimate.js`'s constants (8 s + 57 s × ticks/1000) and packs its own
  roster longest-first into exactly `n` shards (`fullTierShards.js`), so the `n`
  most expensive tapes land in `n` different shards; the three full walks sit in
  shards 1–3 at n = 10. The shard job's timeout is derived from the dearest
  shard's price. `--shard-plan=<n>` without `--json` prints the same partition on
  the box.
- **shard** (one job per shard, fail-fast off) runs `--tier=<t> --shard=i/n`,
  asserts the `CHANNEL: headless logic-only` line, and uploads its checkpoint as
  `tier-shard-<i>`. A shard prints its tapes first and DEFERS the cross-tape
  acceptance findings and the live bot-driver task to the merge.
- **merge** concatenates every shard's checkpoint and runs `--tier=<t> --resume`.
  Every tape must be reused — the fingerprint hashes the wasm's BYTES since H3,
  not its mtime, which `actions/checkout` sets per job — so the merge replays
  nothing and runs only the deferred checks; it goes red unless it prints
  `RESUME: reusing <all> tape(s)` and `RESUME: 0 tape(s) to replay`, and it names
  any shard that banked no checkpoint instead of replaying it. The one verdict
  line is the merge's; `tier-merged` keeps the merged checkpoint and every log.

The first sharded run (34734861224 @ `2715a0c86c`) took ≈ 12 min end to end
against the single job's 1h38m, read ALL CHECKS PASSED 3635/0/46 with 150 of 150
tapes reused, and matched the unsharded run's check lines as a set. **The row is
quoted from the merge** under ruling C, by hand from the box
(`record-standing-value.mjs --key='roster: --tier=full' --category=… --quote=…
--measured-at=<run SHA> --channel=headless --covered-by=<run id, SHA, shard
count>`), one call per category — CI never commits the row.

⛓ **F1 (2026-09-13): where to drive a tier, priced both ways.**
- `check-seedling-full-tier-owed.mjs` prints each debt's cure as two commands —
  the CI dispatch (`gh workflow run seedling-full-tier.yml -f tier=<category>
  -f shards=10 --repo <origin>`) and the box drive (no `--win`) — and every
  estimate as `box ≈ X · CI single ≈ Y · CI sharded(n=10) ≈ Z`. The CI prices
  come from `fullTierEstimate.CI_TIER_CALIBRATION`: the runner fit
  3.69 s × tapes + 40.4 s × ticks/1000 (run 34729518557's checkpoint) and the
  sharded run's components (run 34734861224's job timestamps). Its docblock
  names the commands that re-derive both.
- The fingerprint now also hashes `seedlingDemo/fixtures/*.js` (name and bytes,
  under a `fixtures/` prefix), because the tier and roster definitions live
  there. Every checkpoint banked before F1 was invalidated once.
- The differential's standing value is the composite row, and the gate says so:
  `@standing-row roster: --tier=full: …` (`gateRoster.js`). `standing-values`
  therefore derives no `gate: seedling-bot-differential` row. Before F1 an
  unselected `--write` created that row, and its command — the default arm, the
  whole tier — ran on the box. The per-push `smoke:` face is unchanged.

⛓⛓ **H1 (2026-09-11): the ~0.5 frames/sec above was a LOST WEBGPU DEVICE, not
SwiftShader's raster cost.** With `--use-angle=swiftshader` alone, the headless
compositor runs on ANGLE-SwiftShader GL, which has no shared-image backing for
the WebGPU swapchain, so Chromium loses the device at the page's first canvas
present. The pinned Seedling runtime then parks every other frame for
1000 × `emscripten_sleep(1)` ≈ 4.4 s, waiting for a work-done callback that never
comes (root-caused by SWFRecomp-CC's `swfrecomp-cc-d8`; the runtime itself is
fixed at SWFRecomp-CC `b0a6a487b`, not yet in a seedling-wasm build here). Two
more flags keep the device alive: `--enable-features=Vulkan
--use-vulkan=swiftshader`. They live in ONE place,
`scripts/procgen/headlessChromium.js` (`HEADLESS_WEBGPU_ARGS`), which every
headless Seedling launch imports; its docblock says what each flag is for and
why the features must be ONE `--enable-features=` switch (Chromium keeps only
the last, and a second one on the same line was deleting Vulkan). Measured on
this box, pinned p4d, Chromium 1194:

| headless flags | device | rate |
|---|---|---|
| the old five | lost at submit #2 | 0.40 frames/s |
| `HEADLESS_WEBGPU_ARGS` | alive, 0 pageerrors | 25–28 frames/s on the boot screen; a whole 1,556-tick map-walk tape (11 loads) in 110 s, the L40 tape `r5-l40-join` in 121 s — both FASTER than its last `--win` run (168 s / 164 s) |

⚠ The canvas stays BLACK headless on the pinned builds (a 283-layer bitmap
array is over SwiftShader's 256-layer limit); no gate reads the wasm canvas's
pixels, so the tick rate is what the flags buy. And a heavy room's LOAD is one
frame of CPU work, 10–14 s headless (L12, L40) — the differential's deadline
carries a per-load allowance for it.

⚖ **`--win` STAYS THE DEFAULT** until the user rules whether a headless tier may
discharge the `--win` rows; H1's as-built
(§7 of the arc's untracked planning record) records whether the
headless full tier reproduces the Windows one.

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

⛓ **AND THE BOOT IS PER-ARM SINCE EDITOR INTEGRATION P1-e.**
`seedling-level-set-win.py` used to hardcode the GAME page's boot —
`__runtimeReady`, click `#btn-start`, wait for `game.botStatus`. None of those
three exist in the top document of the APP page (`frontend/index.html`), where
the game lives in an iframe the flash panel mounts. So an arm may declare
`"boot": {"kind": "app", "ready_js": …}` beside the default
`{"kind": "wasm-page"}`, and three dumb verbs came with it: `click`,
`frame_click` and `wait_js`. ⛔ **`frame_click` is not a convenience.** The
user activation the parent document holds does NOT travel into a child frame,
and the wasm page spends it on WebGPU and the AudioContext — so ▶ has to be
clicked *inside* the frame, and it is a STEP rather than part of the boot
because when it happens is the caller's business. The extension is additive
and defaulted; every existing caller is byte-identical, and
`check-seedling-ap-placement.mjs --win`'s own M1/M1b arms are the control that
says so.

## Rebuilding the game after an AS3 change

`build_bot.sh` (in the seedling bot build directory, outside this repo) builds the SWF; its header documents
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

⛓ **M1 (2026-08-28) added `seedling_bot_ap_p4d`, BESIDE p4c and NOT the
default; EDITOR INTEGRATION slice P2 (2026-08-30, ⚖ user) made it THE
default** — the watch page, `check-seedling-wasm-pages`' `BUILD` literal and
every `SEEDLING_PAGE` default across 46 tracked files, on the licence of the
150-tape byte-inert sweep (149 tapes, 3,607 rows, 0 FAIL on p4d, `--win`). p4c
stayed pinned as the `apitem` CONTROL until SEEDLING HEADLESS WEBGPU slice R2
retired it and p4b on 2026-09-12 (⚖ user), each absent-capability branch proved
dead on p4d by a mutant first — see `flashPanel/README.md`. It is the
first build to carry anything the host reads beyond the
vanilla item flags: `Pickups/APItem.as`, `Game.pendingExit`/`pendingCheck` and
the `keyMask`/`totemCount` getters (`flash.md` has the design). Two ordering
facts are worth carrying forward, because both are enforced by gates rather
than by care:

- **A CONTROL BUILD COMES FIRST.** mxmlc is not reproducible and
  SWFModernRuntime moves independently, so an edited build's behavioural move
  has nowhere to be attributed unless the same toolchain, run at UNCHANGED
  source with `FRESH=1`, has been through the same rows first. The control is
  installed as a throwaway directory and never committed.
- **The tracked REFERENCE and the gitlink bump are ONE commit.**
  `check-seedling-wasm-pins.mjs` demands four-way agreement, so a tracked file
  naming a build the submodule does not yet carry reds it — and a build nothing
  names is UNREFERENCED and cleared for retirement. ⚠ And the reference has to
  be in one of the gate's four SPELLINGS: `join(REPO, 'frontend', 'modules',
  'flashPanel', 'wasm', NAME)` with the name in its own `const` matches NONE of
  them, which was measured here — the gate read the file and reported the build
  unreferenced. Written as one literal path it is spelling 1.

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
  frame, ~~is just an unconfigured `BridgeGeneric`. It appears in the teleport
  build too and is unrelated to whether the game is ticking.~~ ⛔ **Corrected
  2026-09-11 (H1): it IS the WebGPU device-lost message** — Chromium 1194's
  text for the loss (Chromium 145 says "Device was destroyed."), one unhandled
  work-done rejection per frame. It appears in every build because every build
  lost its device the same way, and it is exactly WHY headless ran at ~0.5 fps
  (see *Always pass `--win`*). With `HEADLESS_WEBGPU_ARGS` it does not appear at
  all. ⛔ Never key a check on that text — detect a live device by behaviour
  (`__swfPerf`'s frame wall, or `device.lost` still pending).
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

⛔⛔ **AND `"pending"` IS THE SUCCESS ANSWER FOR EVERY CHUNK BUT THE LAST.**
`Bot.botLoadLevels`' own contract is three-valued — `"pending"` (accepted, more
are owed, nothing is mounted), `"ok"` (this chunk COMPLETED the delivery and the
set is mounted) and `"error:…"` (refused by name, and the whole staged delivery
is dropped). `watchWasm.js:1169-1170` is `if (said !== 'ok') throw`, so it
refuses the FIRST chunk of any delivery of more than one, with the message
`botLoadLevels: pending`. It has never bitten because every set that page ships
is ONE chunk; the vanilla 116 is **nine**, and the editor-integration H7/H8
slice drove the first multi-chunk delivery anyone has run.
`probe-seedling-level-set-transport.mjs` had it right all along — it asserts
only that the LAST answer is `ok`. ⇒ a sender must expect `pending` up to the
final chunk, and an early `ok` is itself a refusal: it says the receiver mounted
a set the sender had not finished sending. ⛓ **FIXED in M1** —
`watchWasm.js` now computes `last ? 'ok' : 'pending'` per chunk and refuses
either way round. The row that guards it is a SOURCE scan with its own
non-vacuity mutant, for the reason the "parent never presses ▶ Start" law above
it is: `shipToWasm` needs `fetch` and a live game frame, so there is no node
moment at which the loop can be driven. ⚠ Comments are stripped before the scan
— the fix's own docblock quotes the line it replaced, and the first run reported
a false finding about the code.

⚠ **AND CONSECUTIVE BOOTS ON ONE PAGE ARE NOT INDEPENDENT OBSERVATIONS.**
`botStart` reuses the world unless the next tape's boot names other
construction args (`Bot.as:1722-1725`). Measured while building the placement
arm: four subject rooms booted in turn on one page, and rooms 2 and 4 read the
PREVIOUS room's roster — complete, well-formed, plausible and wrong, down to the
`bosskey` position. One page, one boot, one claim.

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
**recorded** oracles is still `check-seedling-bot-differential.mjs`.

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

⛓ **H1 (2026-09-11): that ~0.5 ticks/s was a lost WebGPU device, not
rasterising.** With `HEADLESS_WEBGPU_ARGS` (`scripts/procgen/headlessChromium.js`)
the headless rows run the game at 25–28 frames/s on this box — a 259-tick
generated ship reached its per-tick verdict inside a 22.5 s headless gate
(`check-seedling-wasm-element.mjs`), and the whole `check-seedling-wasm-pages.mjs`
row took 33.7 s (was 184.8 s). The table above is unchanged on purpose: giving the
headless rows the `finished`/VERDICT reach is H2, after the user's ⚖. ⛓ H2
(2026-09-12) gave `check-seedling-wasm-ship.mjs` a headless default (pixels set,
263/0 on this box) — see *Always pass `--win`* for the two channels.
