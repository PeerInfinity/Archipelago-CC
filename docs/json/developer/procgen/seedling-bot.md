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
