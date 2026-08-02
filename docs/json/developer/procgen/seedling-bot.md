# The Seedling Real-Game Bot (v1 + v2 + R0 + R1)

How we drive the **real recompiled Seedling** with a scripted input tape and
check a JavaScript model of its physics against what the game actually did.

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

SKIPs (exit 0) when the wasm artifact is absent, like every other seedling
verifier — CI has no wasm and stays green.

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
→ copy into `frontend/modules/flashPanel/wasm/`, which is gitignored).
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

- **Pixelmasks are a model, not a seam.** The seventeen MIT masks are
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
  **enemies that are Solid**.
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
  `--tier=full` (the gate).

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
claim-shape change. `regenerate-r4-tapes.mjs` prints the measurement for
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

## What R2 handed on (historical — R2's own list)

The ladder is subtractive, so "what's next" is a list of what still blocks a
full walk rather than a list of features. R1 walked the whole reachable map
with three crutches on; **R2 takes the first one away — `noclip` off, solids
back.**

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
