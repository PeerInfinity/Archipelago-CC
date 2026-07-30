# Region atlas Phase 8 — real-game bot, Stage v2 (Opus kickoff): collision + pathing

Written 2026-07-30 (Fable design session). Parent plan:
`CC/docs/plans/region-atlas-plan.md` §Phase 8. Predecessor:
`CC/docs/plans/seedling-bot-v1-opus-kickoff.md` (v1 SHIPPED 2026-07-30).
**Read `docs/json/developer/procgen/seedling-bot.md` FIRST** — the as-built
v1 system: tape contract, the two bookkeeping contracts (record-then-act;
dead frames), the five source traps, the dead ends. Memory topic:
`project_tilemap_region_arcs.md`.

Recon-verified against: Archipelago-CC main @ `7c21625e5`, seedling fork
`~/CC/seedling` branch `bot` @ `25aaa43` (checked out during recon; the
long-lived checkout normally sits on `stage1-teleport-build`). **Recon-first
still applies — v1's recon was thorough and the running game still corrected
it twice. Re-verify any anchor you build code on.**

## 0. Mission in one paragraph

Re-arm the collision that v1's noclip skips, give the JS engine the real
level geometry and the real room-transition mechanics, and upgrade the bot
driver from straight-line to obstacle-aware pathing — all verified the v1
way: the same tape through the JS transcription and the real recompiled
game, streams compared EXACTLY. One structural inversion from v1: **the
oracle for v2 is already built.** `Bot.as` reads `noclip` from the tape
header and demonstrably survives a room transition (the discarded
`clamp-left` recording carried `level=94` observations), so v2 expects
**zero AS3 edits** — record real collision runs on day one and transcribe
toward them, instead of building provisional expectations first.

## 1. Settled rulings — do NOT re-litigate

Taken 2026-07-30 (this design session, user), on the three questions queue
§5c posed plus one the recon surfaced:

1. **Geometry: the JS side consumes the committed Phase-2 extract
   directly** — `frontend/modules/flashPanel/atlases/seedling-map.json`
   (975 KB, all 116 levels, tile placements + entities verbatim, exact
   `--check` regen gate) — plus the verbatim AS3 tables already in
   `frontend/modules/flashPanel/seedlingSemantics.js`
   (`TILE_COLUMN_TO_TYPE`, `TILE_TYPE_ENTITY_TYPES` = `Tile.types`).
   NO new committed artifact, NO new regen chain; the existing `--check` +
   census guard already gate the data. seedlingDemo gains a new
   transcription layer (`levelWorld.js`, §3.1) over that data.
   ⛔ Do NOT reuse the analyzer's abstraction layer
   (`CELL_KINDS`/`buildSeedlingRegionGrid`) — that is the region-verifier's
   altitude, and reusing it would couple the physics to its assumptions
   (4-connectivity, tile-granular cliffsides, pits-as-sinks). Reuse stops
   at the verbatim source tables. Bonus property, worth stating in the
   docs: the oracle differential now live-tests the same tables the
   Phase-5a analyzer trusts.
   (Parse-at-test-time from `~/CC/seedling` was rejected: the checkout is
   machine-local, so the CI vitest differential would SKIP forever.)
2. **Transitions are modeled FULLY, and the observation stream's
   `transitions` field carries the minimal symmetric record:**
   `[{ "t": <int>, "from_level": <int>, "to_level": <int> }]`, where `t`
   is the first observation tick whose `level` is the new level. Both
   consumers derive entries from their own run (the AS3 bot from observed
   `Main.level` changes, the JS engine from its own world swap), so the
   differential diffs them element-wise and EXACTLY. Arrival position is
   already the per-tick record at `t` — not duplicated. Teleporter
   identity is EXCLUDED: the AS3 bot cannot observe which teleporter fired
   without an AS3 patch, and an asymmetrically-known field cannot be
   differentially checked. Tapes may span levels.
3. **Pixelmask colliders (Building, TreeLarge, SnowHill, TentacleBeast,
   OpenTree, Statue) are a loud-throw seam, not modeled.** Any sweep step
   whose candidate test overlaps a pixelmask entity's bounding rect THROWS
   a named error ("unmodeled pixelmask collider"). Fixtures route around
   them; a tape that strays dies loudly instead of silently diverging.
   Phase 5a already proved neither rectangle approximation is safe (the
   sprite rect swallows the building's own doorway). Masks are MIT and
   extractable in a later rung if one is ever needed.
4. **Pathing: in-level A\* + explicit cross-level legs.** botDriverV2 plans
   A\* over walkable tiles within a level and executes waypoints with the
   v1 bang-bang controller through the REAL `step()` (planner and engine
   share the engine — the walkTo-divergence lesson). A driver task may
   chain per-level legs where the CALLER names the teleporter to take.
   Full auto cross-level routing is deferred until a rung needs it (the
   v3+ beatability walks); the maze bot's `(region, arrival-exit)` routing
   lessons come into scope then, not now.

**Queue Q3 (`Mobile.solids`) — CONFIRMED from source, stays as ruled
2026-07-29, with two sharpenings:**
- The player's effective list is base + `"LavaBoss"`, pushed
  **unconditionally in the constructor** (`Player.as:355-359` — not a
  boss-fight branch). Transcribe it verbatim (code shaped like the AS3);
  it is inert outside Dungeon 7 because no `LavaBoss`-typed entity exists
  elsewhere.
- **`Tree`'s private `solids` list is DEAD CODE**: `Tree extends Entity`
  (not `Mobile`), is `active = false`, and the identifier is used nowhere
  in the file (`Scenery/Tree.as:14-26`). It is vestigial, not an override.
- Every other override in the tree is enemy/projectile/scenery-side —
  still a v5 concern. (Exhaustive table in the recon record, §2.6.)

## 2. Verified recon facts + anchors

All seedling paths relative to `~/CC/seedling` (branch `bot` @ `25aaa43`).
Verified 2026-07-30 by two recon sweeps plus direct spot-checks of every
load-bearing line below.

### 2.1 Room transitions — there is NO edge logic

**The headline correction to the queue's framing: nothing checks bounds.**
"Walking off the left edge" of level 0 is walking into two authored
trigger entities (`assets/levels/OverWorld.oel:491-492`):

```xml
<teleporter x="0" y="128" to="94" playerx="288" playery="160" .../>
<teleporter x="0" y="144" to="94" playerx="288" playery="176" .../>
```

Mechanics (`src/Teleporter.as`):
- **Trigger** = AABB overlap: `collide("Player", x, y)` against a
  `setHitbox(16, 16, 0, 0)` volume (`Teleporter.as:36, :87`). Fires
  `FP.world = new Game(to, playerPos.x, playerPos.y)` (`:90`).
- **Anti-ping-pong latch**: `playerTouching` is armed by `check()` on the
  first frame of a new Game (`Teleporter.as:58-65`, driven by
  `Game.as:803-812`) — arriving ON a teleporter pre-latches it; it cannot
  re-fire until the player steps off (`:94-97` clears the latch).
- **`deactivated`** = `tag >= 0 && (!Game.checkPersistence(tag) == invert)`
  (`Teleporter.as:76-79`). Every level-0 teleporter has `tag="-1"` →
  never deactivated. (Tagged teleporters exist elsewhere; v2 fixtures
  should stay off them.)
- **Update order**: `World.addUpdate` PREPENDS (`net/flashpunk/World.as:
  937-947`), and `loadlevel` adds the Player (`Game.as:2040`) before the
  teleporters (`Game.as:2169`) — so per tick, teleporters update BEFORE
  the player. The trigger therefore sees the overlap produced by the
  PREVIOUS tick's player movement.
- **The world swap is deferred to end-of-tick** (`Engine.checkWorld`,
  known from v1) — the old world, player included, still runs the whole
  tick on which the trigger fired.
- **Arrival**: `new Game(to, playerx, playery)` → `add(player = new
  Player(playerPosition.x, playerPosition.y))` (`Game.as:2040`) → the
  Player ctor adds the half-tile offset (`Player.as:357`), so **actual
  arrival = `(playerx + 8, playery + 8)`**, both ints (the ctor takes
  `int`). **Velocity is reset** (fresh Player). **Held keys PERSIST**:
  FlashPunk `Input` is static, its listeners live on `FP.stage`, and no
  teleport path calls `Input.clear()` (only menu/mute/restart do:
  `Game.as:755, 796, 1208...`). A held span in the tape simply continues
  across the swap.
- **Dead frames**: the new Game resets `blackCover = 1` (~20 fade frames,
  `Game.as:518-519, 813-816`) — already not counted by either consumer
  (the v1 dead-frames contract needs NO change). `freezeObjects` is NOT
  touched by a teleport.
- **Saves**: the Game ctor writes level/spawn into `shrumsave`
  (`Game.as:620-624`) — inert in the recompiled runtime (no persistence,
  v1 §2.2 finding stands).
- **`Stairs` extends `Teleporter`** (`Stairs.as:11`) — the two level-0
  `stairsdown` objects use the identical path.
- **`Game.as:2034-2037`'s `<player>` spawn override is dead EVERYWHERE**:
  no `.oel` in the repo contains a `<player>` element (grep across all
  120 files). Retire v1's "a later level may" caveat.

Level 0's complete exit table (all from `OverWorld.oel`): teleporter
(80,96)→1; teleporter (304,176)→12; teleporters (0,128)/(0,144)→94;
teleporter (240,0)→89; teleporter (160,272)→86; stairsdown (32,192)→13;
stairsdown (256,272)→2. Return pair in level 94 (`OverWorld/treelarge.oel:
443-444`) arrives at raw (16,128)/(16,144) → entity (24,136)/(24,144+8) —
clear of the level-0 teleporters' hitboxes, so the latch never engages on
a round trip in either direction.

**The world clamp stays transcribed but is a background fact**: it runs at
the tail of `Player.update` (`Player.as:560-561`) and only matters on edge
rows/columns with no teleporter. It is not "in competition" with
transitions — the trigger volume sits inside the playable band and fires
off the clamped position of the previous tick.

### 2.2 Collision — the model the sweeps test against

- **Solid geometry is ENTITIES, not a grid.** FlashPunk's `Grid`/`Tilemap`
  masks have zero call sites. `loadlevel` creates **one `Tile` entity per
  16×16 cell** from the `.oel` `<tiles>` layer via a 45-arm switch on the
  tileset column (`Game.as:1902-2007`); a parallel `tiles` vector
  (`:1893-1901`) is only an index — collision never uses it.
- **`Tile` placement**: ctor is `super(_x + w/2, _y + h/2)` with
  `setHitbox(w, h, w/2, h/2)` (`Scenery/Tile.as:101-110`) — the entity
  POSITION is the cell CENTER, the hitbox covers exactly the oel cell.
  (This matters for `nearestToPoint`, §2.3.)
- **Solidity is a deferred type flip**: every Tile is constructed
  `type = "Tile"`, and its FIRST update sets `type = types[t]` then
  `active = false` (`Tile.as:117-122`). `Tile.types` (`Tile.as:24-27`)
  marks t ∈ {2, 9, 11, 14, 15, 19, 20, 23, 24, 27, 34, 35, 36} `"Solid"`;
  everything else stays walkable `"Tile"` — including Water(1), Pit(6),
  Lava(17). `seedlingSemantics.js` already carries this table verbatim
  (`TILE_TYPE_ENTITY_TYPES`).
  - ⚠ **First-tick ordering nuance**: the flip happens in each Tile's
    first UPDATE, and with prepend ordering the Player (added later)
    updates before the Tiles do — so on the very first live tick of a
    world the tiles may still be typed `"Tile"` when the player's sweep
    runs. At spawn (v=0 on tick 1, ≤0.8 px of motion) this is almost
    certainly unobservable, but transcribe the real order and let the
    oracle arbitrate — do not "fix" it in JS.
- **The sweep** (base `Mobile.as:86-118`; the Player's live overrides at
  `Player.as:1687-1743` add the noclip hook + a dead shield branch):
  1-px steps, `collideTypes(solids, x + d, y)` per step, X fully resolved
  before Y. **On a hit: the loop RETURNS and the caller DISCARDS the
  entity (`Mobile.as:39-40`). Position stays at the last free step;
  velocity is NOT zeroed** — it persists and decays only through
  `friction()`. Pressing into a wall is a stable, oracle-observable state
  (position pinned, the limit cycle still running in `v`).
  - ✅ **Refuted recon claim, recorded so nobody re-chases it**: the loop
    guard `for (var i:int = 0; i < Math.abs(_xrel); i++)` DOES execute
    for sub-pixel `_xrel` (0 < 0.8 is true) — one iteration of
    `d = min(1, |rel|) * sign`. v1's bit-exact friction tails already
    proved sub-pixel motion works; a first-pass recon sweep claimed
    otherwise and is wrong.
- **What the player collides against** (§1 Q3): `["Solid", "Tree",
  "Rock", "Rope", "ShieldBoss", "LavaBoss"]`. Type strings resolve via
  `collideTypes` → per-type entity lists (`Entity.as:203-211`); the sweep
  only consumes null/non-null, so list iteration order is irrelevant to
  movement.
- **Non-tile solids in/near level 0** (entity → type, hitbox from each
  class file — transcribe each you need, verify the ctor offsets):
  - `Tree` → `"Tree"`, `super(_x + 16, _y + 16)` + `setHitbox(32, 32, 16,
    16)` (`Tree.as:20-24`) — **a 2×2-tile footprint** anchored one cell
    up-left of nothing: it covers `[oel_x, oel_x+32) × [oel_y, oel_y+32)`.
    25 trees in level 0; they are what walls most of the left edge.
  - `Rock` → `"Solid"` (`Scenery/Rock.as:16`); `Pole`, `BrickPole`,
    `Torch`, `Statue2`, `BrickWell` etc. — each class declares its own
    hitbox/type; transcribe the ones present in fixture levels and record
    the table in a unit test.
  - `CliffSide` → `"Solid"` plain Entity (`Scenery/CliffSide.as:11,33`),
    built from the `<cliffsides>` layer (`Game.as:2009-2015`). Level 0
    has no such layer; 16 other levels do.
  - `BreakableRock`/`Moonrock` — check their types; with no items in v2
    they are permanent solids either way.
  - `Building`/`building1` → Pixelmask (`Building.as:22-23`) — the §1
    ruling 3 loud-throw seam. Level 0 has both, near the start.
  - Cave-mouth tiles spawn a synthetic 1-px `"Solid"` cap in `check()`
    (`Tile.as:526-533`) — dynamic geometry; no cave tiles in level 0
    (columns present: 0,1,2,4,5,6,11,32). Transcribe when a fixture
    level has them; until then the terrain resolver's throw-on-unknown
    covers it.
  - Bridge tiles toggle `type` inside `render()` (`Tile.as:348-361`) — a
    v4 concern; no bridge tiles in level 0.

### 2.3 Terrain typing — v1's pure seam must become a stateful transcription

`getState()` (`Player.as:656-668`, called once per frame at `:508`):

```as3
var tile:Tile = FP.world.nearestToPoint("Tile", x, y + checkOffsetY) as Tile;
if (tile && (new Rectangle(tile.x-tile.originX, ...)).intersects(playerRect))
    state = tile.t;
```

Three properties the v1 seam (`terrainStateAt(x, y) → t`, pure) cannot
express, so **v2 changes the seam to a transcribed resolver over the
level world**:
1. **Nearest-by-CENTER**: `nearestToPoint` with default
   `useHitboxes=false` measures squared distance to entity x/y
   (`World.as:640-668`) — i.e. to tile CENTERS (§2.2 placement).
2. **Candidates are WALKABLE tiles only**: solid tiles flipped their type
   to `"Solid"` and left the `"Tile"` list, so `state` can never become a
   wall type — and near a wall the nearest `"Tile"` may be a surprisingly
   distant cell.
3. **STICKY**: `state` is assigned only when the nearest tile's rect
   intersects the player's rect (at `(x, y + checkOffsetY)`,
   `checkOffsetY = 1`); otherwise the PREVIOUS state persists.
   ⚠ Flash `Rectangle.intersects` is strict — touching edges with zero
   overlap area do NOT intersect. Transcribe exactly.

Speed selection (verified against `Player.as:73-89, 517-537`): the
`moveSpeeds` table's non-default entries are **1 Water = 0.45, 10 Cliff
Stairs = 0.4, 17 Lava = 0.45, 25 Waterfall = 0.225 (dMSwater/2), 30 Ghost
Tile Step = 0.4**; all others 0.8. Then the override chain: ice (t=22) →
`moveSpeed = 1, f = 0.025`; water/lava (`inWater = t∈{1,25}`, `inLava =
t==17`) → `f = WATER_FRICTION` **plus a stroke burst `+0.25 *
int(Music.soundPosition("Swim") < 0.1)`** — physics coupled to SOUND
state. That coupling, plus the pit-fall trigger (t=6 → `receiveInput =
false`) and drown/item machinery, is exactly why:
- **v2's supported state set** = default-speed grounds + stairs (10) +
  ghost step (30). The resolver THROWS a named error on water(1), pit(6),
  lava(17), ice(22), waterfall(25), bridge(29) — item-gated and
  special-mechanics terrain is v3+, and a fixture that strays dies loudly
  (the v1 seam doctrine, now with teeth).
- ⚠ **Two comment mislabels in `playerPhysicsV1.js` to fix in passing**
  (values are correct, labels wrong): index 17 is Lava (0.45 — the
  comment says "deep water"), index 25 is Waterfall (0.225 — the comment
  says "lava"). The hand-derived test pins the VALUES, so this is
  comment-only.

### 2.4 The geometry data, concretely

- `frontend/modules/flashPanel/atlases/seedling-map.json` — level records
  are `{level, class, path, width, height (tiles), layers: [{name, set,
  tiles: [[x, y, tx, ty], ...]}], entities: [{type, x, y, attrs?}],
  tiles_outside_level?}`. Tile x/y in TILES, `tx` a PIXEL offset into the
  tileset strip (`tx/16` = column); entity x/y raw pixels with all attrs
  verbatim (teleporter `to`/`playerx`/`playery`/`tag` included). Level 0
  at lines ~148-658: 20×20, full 400-placement coverage, tileset columns
  {0,1,2,4,5,6,11,32} = ground(×2)/water/brick/dirt/dungeon/cliff/
  waterfall — **cliff (t=9) is level 0's only solid TERRAIN**.
- `seedlingSemantics.js` reuse surface: `TILE_COLUMN_TO_TYPE` (the 45-arm
  switch as data), `TILE_TYPE_NAMES`, `TILE_TYPE_ENTITY_TYPES`
  (= `Tile.types`), `SOLID_ENTITY_TYPES`. Its census guard
  (`seedlingSemantics.test.js:94-150`) already forces every column and
  entity tag in the committed extract to be classified — drift protection
  v2 inherits for free.
  - ⚠ The grass distinction (column 0 → `new Tile(..., 0, false)`, column
    1 → grass default; `Game.as:1912-1915`) is cosmetic — both are t=0.
- The extract's regen gate (`extract-seedling-map.mjs --check`) needs the
  machine-local checkout and is not CI-runnable; the in-repo half is
  `seedlingOgmo.test.js`. Unchanged by v2.

### 2.5 The JS module today (what v2 touches)

- `playerPhysicsV1.js` — movers carry the loop shape with the
  `collideTypes` call skipped; v2 re-arms it behind a collision query.
  `MOVE_SPEEDS` complete (38 entries); friction still constant-selected
  (`f = DEFAULT_FRICTION` with a "v2+" comment) — v2 keeps it constant
  for the supported state set (ice/water frictions stay out with their
  states).
- `tapeRunner.js` — emits `transitions: []` always; `tapeFormat.js`
  validates `transitions` as array-only and **diffs LENGTH only**
  (`tapeFormat.js:349-352`). v2 upgrades: element schema per §1 ruling 2,
  element-wise exact diff, dense-`t` validation unchanged.
- `botDriverV1.js` — straight-line bang-bang, simulate-don't-solve,
  arrival = full stop within 1.0 px, throws past 400 ticks/target. v2
  extends rather than replaces (§3.4).
- v1 fixtures (5 tapes + oracle recordings) are untouched and must stay
  green — they are the regression net for the refactor.

### 2.6 The AS3 side — expected ZERO edits

`Bot.as` @ `25aaa43` already: reads `noclip` per tape, gates ticks on
`blackCover <= 0 && !freezeObjects` (dead frames uncounted across
transitions), records `{t, x, y, level}` re-resolved per frame (the
discarded `clamp-left` recording continued past the level-94 swap), and
surfaces `saw_input_refused`. A `noclip: false` tape exercises the game's
REAL collision with no new build.

**Verify this before writing much JS** (slice 0, cheap): replay one
`noclip: false` tape with `--win` and confirm (a) observations continue
across a transition, (b) the tick counter's dead-frame gate behaves, (c)
the player stops at a wall. If anything needs an AS3 change after all,
BATCH it — the ~10-minute pipeline cost rule stands. The enemy-override
census (§1 Q3 table, exhaustive): Player+LavaBoss; Bob/Jellyfish/Drill/
RayShot/WandShot +Enemy; Puncher/IceTurret/PushableBlock(Fire) +Enemy,
+Player; LavaRunner +LavaBoss+Enemy; Flyer/LightBoss/Arrow/Bomb/LavaBall/
TurretSpit/BossTotemShot/LightBossShot/IceTurretBlast/RockFall emptied;
Stick `["Solid"]`; Crusher a private copy. All v5 material.

## 3. Design, concretely

### 3.1 `levelWorld.js` — the level as the game builds it

A transcription of the `loadlevel` subset v2 needs, over a level record
from the committed extract:

- Build the Tile entity list (position = cell center, 16×16 hitbox,
  `t` via `TILE_COLUMN_TO_TYPE`, walkable-vs-solid via
  `TILE_TYPE_ENTITY_TYPES`), the cliffsides list, and the object-entity
  list from a transcribed **per-class table** `{type, hitbox: {w, h,
  originX, originY}, ctorOffset}` for the classes fixture levels contain
  (Tree's 2×2 footprint is the canary case; pixelmask classes get
  `pixelmask: true` and feed the throw seam).
- Teleporters (+ Stairs) with `to`/`playerx`/`playery`/`tag` and the
  16×16 trigger volume.
- Queries the physics needs: `collidesSolid(playerRect, solidsList)` (the
  sweep's candidate test), `nearestWalkableTile(x, y)` (center-distance,
  walkable only), `teleporterHit(playerRect)` (with latch state held by
  the runner, not here).
- Loud by default: unknown entity type in a loaded level → throw naming
  it (the census guard makes this near-impossible to hit silently);
  pixelmask overlap → throw; unsupported terrain state → throw (§2.3).

### 3.2 `playerPhysicsV2` — re-arm the sweeps

Extend (not fork) the v1 step: the movers' per-step test becomes
`noclip ? null : collidesSolid(...)` — the exact shape the AS3 carries.
On hit: stop that axis' loop, keep position, do NOT zero velocity. The
terrain resolver replaces the pure seam with the transcribed `getState`
(sticky, nearest-center, intersect-gated, `checkOffsetY = 1`); `state`
lives in the runner's per-tick state. v1 tapes (all `noclip: true`, stub
terrain) must produce byte-identical streams — the regression pin.

### 3.3 Transitions in the tick loop

Mirror the real order within a tick: (1) teleporter triggers test the
CURRENT position (= last tick's result) and latch semantics; (2) if one
fired, the player still runs this tick's full movement in the old level;
(3) end-of-tick: swap — new level world, position `(playerx + 8,
playery + 8)`, velocity zeroed, terrain state re-initialized, held keys
carried forward, latch pre-armed for any teleporter the arrival overlaps;
(4) dead frames are NOT modeled (both sides skip them by contract — the
fade length varies run to run and must never enter the stream); (5) the
next observation records the new level, and a `{t, from_level, to_level}`
entry is appended. The exact tick alignment (whether the last old-level
observation shows the post-trigger movement tick) is the kind of off-by-
one the oracle settles — reconcile against a recorded transition tape
BEFORE freezing the JS order, and document the settled order in
`tapeFormat.js`.

### 3.4 `botDriverV2` — pathing

- **Plan**: A\* over walkable tiles of the current level (walkable = no
  solid-entity overlap for the 4×5 player box at the tile's center — the
  box is smaller than a tile, so tile-granular planning with the real box
  checked per waypoint is safe). Waypoints = tile centers; smooth
  greedily (skip a waypoint while the straight segment stays clear).
- **Execute**: the v1 bang-bang controller per waypoint, driving the REAL
  `step()` with collision on. If the simulated run hits a wall en route
  to a waypoint, that is a planner bug — THROW, never re-plan silently
  (silent re-planning is how divergence hides).
- **Cross-level legs**: a task is `[{level, targets: [...], exit?:
  {x, y}}]` — walk the targets, then walk INTO the named teleporter tile;
  the modeled transition carries the run into the next leg, which asserts
  it arrived in `leg.level`. The caller names the teleporter; the driver
  never searches the teleporter graph (§1 ruling 4).
- Arrival criterion, tolerance, and the 400-tick throw carry over from v1.

### 3.5 Fixture roster (implementer refines; these witness the new physics)

All in level 0 / level 94 unless noted, all routed clear of buildings and
special terrain:
1. **wall-press** — walk into a cliff or tree and HOLD: pins the stop
   position, the not-zeroed velocity (limit cycle continues in `v` while
   x pins), and sub-pixel approach.
2. **wall-slide** — diagonal into a wall: X-before-Y resolution order
   visible (one axis pins, the other keeps moving).
3. **thread-the-gap** — a driver-synthesized path between obstacles (the
   pathing witness; also the G2 live task).
4. **transition-round-trip** — level 0 → 94 → 0 through the west
   teleporters: pins the transitions records, arrival positions, latch
   behavior in both directions, and held-keys-across-swap.
5. **terrain-speed** — if a dry stairs/ghost-step tile is reachable in a
   modeled level, one tape crossing it (pins the resolver's sticky state
   + the 0.4 speed against the oracle). If none is reachable without
   special terrain, drop it and say so — do not force a fixture through
   water.
Keep the v1 five untouched beside these.

### 3.6 Harness + gates

Machinery unchanged (`verify-seedling-bot-differential.mjs --win`,
`--record`, fresh page per tape, deadlines scaled by tape length, SKIP
without artifact). Additions:
- **G1 (CI, vitest)**: every tape's JS stream == its committed oracle
  recording exactly, NOW INCLUDING element-wise `transitions`; v1
  fixtures byte-identical to their existing recordings; the hand-derived
  second stratum grows cases for: the sweep stop position, sticky
  getState (nearest-center + intersect gate), the teleporter latch, the
  arrival `+8` offset, Tree's footprint, the walkable/solid census of
  level 0 row-by-row against `Tile.types`.
- **G2 (local)**: live replay of all fixtures (old + new) matches; the
  live driver task is the thread-the-gap + cross-level task, asserted
  from the GAME's drained observations.
- **Mutation checks (run once, record in the commit message)**: zero
  velocity on collision → wall-press red; drop the teleporter latch →
  round-trip red (arrival re-fires); Y-before-X sweep order → wall-slide
  red; pure (non-sticky) terrain resolver → terrain-speed red (or the
  hand-derived case if the fixture was dropped); rect-approximate a
  pixelmask → the loud-throw fires (positive control of the seam).
- **Quantitative pins**: observation counts per tape AND transition
  counts per tape.

## 4. Slices (commit each separately to main; JS-first)

0. **Oracle-first probe** (cheap, no code): hand-author one
   `noclip: false` tape + one transition tape, `--record --win` them
   against the EXISTING `seedling_bot_ap` build, commit the recordings as
   the reconciliation targets. Confirms the zero-AS3-edit expectation
   before anything is built on it.
1. **`levelWorld.js`** + the entity-class table + unit tests (census,
   footprints, teleporter table vs the extract).
2. **`playerPhysicsV2`**: collision re-armed + the stateful terrain
   resolver; v1 fixtures byte-identical; reconcile the slice-0 collision
   recording to exact.
3. **Transitions**: tick-loop ordering + `transitions` records +
   format/differ upgrade; reconcile the slice-0 transition recording.
4. **`botDriverV2`** pathing + cross-level legs; the new fixture roster
   recorded and exact; verify-script G2 task swapped to the pathing task.
5. **Docs + memory**: `seedling-bot.md` v2 section (the transitions
   contract + the resolver semantics + the pixelmask seam),
   plan-doc Phase 8 checkboxes, queue §5c, memory topic. Move this
   kickoff NewDocs → `CC/docs/plans/` when implementation starts.

Baselines at kickoff (2026-07-30, re-measure fresh): vitest 3876/3876;
the rest per v1 close (slow tier 364, `--batch=fast` 61 — v2 adds no legs
to either unless a roster change says otherwise).

## 5. Discipline + traps (v1's all stand; new ones)

- All of v1's: `--win` always; fresh page per tape; deadlines scale;
  record-then-act off-by-one; dead frames uncounted; no callback returns
  `""`; batch AS3 edits; `FRESH=1`; `DEMO_SWF`; never `git add -A` with
  background jobs; concurrent-session atomic commits.
- **Do not let the JS "clean up" the game**: the first-tick type-flip
  ordering (§2.2), the sticky state, the discarded collision return, the
  strict `Rectangle.intersects` — transcribe them all verbatim and let
  the oracle arbitrate. Every v1 divergence came from a description that
  was tidier than the code.
- The extract is tile-space for tiles and PIXEL-space for entities;
  `levelWorld` must not mix them (the `[x, y, tx, ty]` rows are tiles,
  entity x/y are pixels — `seedlingOgmo.js` doc block).
- Tile ctors call `Math.random()` (animation offsets) — cosmetic, no
  movement RNG; do not model.
- `nearestToPoint` ties (equidistant tiles) resolve by entity-list order
  — if a fixture ever lands on a tie, prefer moving the fixture over
  transcribing FlashPunk's list order.
- Fixtures must stay off: buildings (pixelmask throw), water/waterfall
  tiles (sound-coupled physics, v3), pits, tagged teleporters, the
  `introchar` NPC's talk range (dialogue is `Input.released`-armed; v1
  never pressed X and v2 shouldn't either).
- `getStatePos` (`Player.as:670-678`) exists but is a different function
  (no intersect gate, returns -1); do not conflate it with `getState`.

## 6. Open implementation questions (ask the user only if blocking)

- Slice-0 outcome: if `Bot.as` DOES need an edit (e.g. the dead-frame
  gate misbehaves across `noclip: false` transitions), the batch should
  also consider whether `botStatus` should surface the collision entity
  type for debugging — decide only inside a batch that is already paying
  the pipeline.
- Whether level 94 needs any entity-class transcriptions beyond level
  0's set (check its object census before slice 1 sizing).
- The terrain-speed fixture's reachability (§3.5.5) — a stairs tile may
  require a dungeon level; loading one more level record is cheap, but
  check its entity census first.

---

## 7. Slice 0 — AS BUILT (2026-07-30)

Done and committed. Two tapes hand-authored, recorded `--record --win`
against the EXISTING `seedling_bot_ap` build, and committed as the
reconciliation targets. Everything below is now *observed*, not predicted;
the assertions live in `tapeRunner.test.js` §"v2 slice 0: what the
collision + transition recordings pin" so a later slice cannot quietly
drift off them.

### The verdict on zero AS3 edits: HOLDS, with one caveat

`Bot.as` needed no change. A `noclip:false` tape ran real collision, and
the dead-frame gate carried the tick counter cleanly through two world
swaps (`dead_frames=56` = 18 boot + ~19 + ~19). No `saw_input_refused`.

⚠ **The caveat, load-bearing for slice 3:** `botDrain` returns
`transitions: []` *unconditionally* — the game does not hand the field
over, and re-recording will never populate it. This does **not** force an
AS3 edit, because §1 ruling 2 defines an entry as "the first observation
tick whose `level` is the new level", which is a **pure function of the
tick stream**. So the harness derives the game's side from the ticks it
already drains. Two consequences to carry into slice 3:
- Put that derivation in **one** place (`tapeFormat.js`), used by both
  sides, or the two implementations drift.
- Keep the JS engine deriving ITS side from its **own world swap**, per the
  ruling. If both sides derive from the level field, the transitions diff
  degenerates into diffing the tick stream against itself and checks
  nothing the tick comparison did not already check.

### `collide-up-rock` (45 ticks) — hold UP into BreakableRock(80,112)

Chosen over a solid tile (level 0's only solid terrain is cliff wedged
between waterfall, which is v3) and over a pole (this one sits directly
above spawn, so x must stay 88 and any drift is a defect). tag=4, but
`Main.as` fills `levelPersistence` with `true` on a fresh boot, so it is
always present.

- Approach shows the v1 limit cycle exactly: −0.8, −1.35, −1.1, −0.85, −1.4.
- **Stops at y = 130.5** — mid-pixel. The sweep's `d = min(1,|rel|)*sign`
  step leaves the rest position wherever the fractional approach ended;
  anything that resolves collision to a tile edge or an integer is wrong
  here by half a pixel.
- **The not-zeroed velocity is directly observable, and cheaply.** UP
  releases at tick 40; the player holds 130.5 through tick 43 and then
  creeps −0.45 to **130.05** at tick 44. The retained into-wall velocity
  decays only through `friction()`, and the moment `|v.y| ≤ 0.5` the step
  fits and the player slips. Four ticks × `DEFAULT_FRICTION` 0.25 takes
  ~1.45 → 0.45. An engine that zeroed `v` on contact holds 130.5 forever.
  → §3.6's "zero velocity on collision → wall-press red" mutation check is
  satisfied by this fixture alone; no diagonal needed for it.

### `transition-west-return` (150 ticks) — level 0 → 94 → 0

- **Crossings at t=61 (0→94) and t=109 (94→0).** Exactly two: the latch
  never engaged in either direction, as §2.1 predicted from the arrival
  positions clearing the return triggers' hitboxes.
- **Arrival is exactly `(playerx+8, playery+8)`**: (296,168) and (24,136).
- **The arriving Player is fresh** — first post-arrival tick moves one
  accel quantum (295.2, then 24.8), i.e. the limit cycle restarts from
  v=0. (Assert absolute positions, not deltas: subtracting two ~300
  doubles reintroduces float noise the recorded values do not have.)
- **Held keys survive the swap.** LEFT spans [0,72), the crossing is at 61,
  and the fresh player keeps moving left in level 94. No `Input.clear()`.
- ✅ **§3.3's tick-alignment off-by-one is SETTLED, and it is simpler than
  feared.** The last level-0 observation is t=60 at x=17.70000000000001 —
  the first position overlapping the trigger — and t=61 is *already* the
  arrival. The trigger fires on tick 61 from tick 60's position, the old
  player still completes tick 61's movement in the old level, the swap
  lands at end-of-tick, and the ~19 `blackCover` frames that follow are
  dead frames. So **the old player's last doomed step is never observed
  and never feeds the new player** (arrival comes from the teleporter's
  oel attrs). The v2 engine may model that step or skip it — the stream
  cannot tell. There is no intermediate observation to get wrong.

### Harness changes made in passing

- **`--only=a,b`** on `verify-seedling-bot-differential.mjs`. Recording a
  new fixture otherwise rewrites every already-oracle-recorded expectation
  on the way past, and `--record` does not compare before it writes — so a
  genuine drift in a v1 fixture would be silently baked into the
  regression net instead of reported. A misspelled name is a named
  failure, not a silent empty sweep.
- A **missing expectation** is now a named FAIL for that one tape instead
  of an exception that aborts the sweep and leaves every later tape
  unreported.
- `tapeRunner.test.js` splits the roster by `tape.noclip`: modelled tapes
  keep the exact-match assertion, collision tapes assert only that they
  are oracle-backed and that the v1 engine still refuses them. The split
  is pinned by name so deleting the v2 tapes cannot make the block pass
  vacuously, and it retires itself at slices 2–3.

### Gates at slice 0 close

- vitest **3890/3890** (was 3876; +14).
- `verify-seedling-bot-differential.mjs --win` green across all **7**
  fixtures; the v1 five still match their original recordings bit for bit.

## 8. Slice 1 — AS BUILT (2026-07-30)

`frontend/modules/seedlingDemo/levelWorld.js` + `levelWorld.test.js` (39
cases, 9 mutations verified to bite). Dependency-free and browser-usable:
it takes a level RECORD, not a file path, exactly as the other core
modules take plain tapes. Reuse stopped where ruling 1 said it should —
`TILE_COLUMN_TO_TYPE`, `TILE_TYPE_ENTITY_TYPES`, `TILE_TYPE_NAMES`,
`SOLID_ENTITY_TYPES` and nothing from the analyzer's abstraction layer.

Level 0: 400 tiles (397 walkable, 3 solid), 74 solids, 2 pixelmasks, 8
teleporters. Level 94: 400 tiles (338 walkable), 88 solids, 10 pixelmasks,
2 teleporters. Every count reconciles against a hand census of the extract.

### ⚠ Correction to §2.2: CliffSide is a PIXELMASK, not a plain Solid

The brief called it "a `"Solid"` plain Entity". It *is* `type = "Solid"` —
but its collider is a **Pixelmask** (one of five 16×16 masks chosen by the
tileset column, `Scenery/CliffSide.as:15-34`) and it **never calls
`setHitbox`**, so its Hitbox is 0×0. A model that read the type and used
the hitbox would give every cliffside a **zero-size rect and collide with
none of them** — silent, and exactly wrong. It belongs in the pixelmask
loud-throw seam. Level 0 has no cliffsides layer; **level 94 has 9**, so
this is live for the fixture roster, not theoretical. 16 levels have the
layer.

### Other things the source said that the brief did not

- **NPCs are SOLID.** `NPC extends Mobile` and sets `type = "Solid"` with a
  hitbox from the *sprite's frame size*, centred (`NPCs/NPC.as:48-59`).
  Level 0's `introchar` and level 94's `adnanchar`/`rekcahdam` all block
  the player; nothing about the tag suggests it. `Watcher` overrides to
  type `"Watcher"` and does NOT block.
- **`Statue` sets its hitbox from `render()`, not the constructor**
  (`Statue.as:34-45`), and its ctor y offset is `_y - Tile.h/2 +
  Tile.h*int(_t==0)` — for the `statue2` tag `_t` is 1, so the second term
  is zero and the net offset is **−8, not +8**. Reading it as "the usual
  half-tile" is wrong by 16 px.
- **`Rekcahdam` truncates its half-width origin**: `setHitbox(9, 10, 4.5,
  5)` with `int` params gives originX **4**.
- **`Moonrock` does not block.** It is constructed `type = ""` at
  `y = -1000` and only drops in and becomes `"Solid"` once
  `Game.moonrockSet` — a static that is false on a fresh boot. `Torch` and
  `Orb` never assign `type` at all.
- **A tagged, non-inverted teleporter is DEACTIVATED on a fresh boot.**
  `tag >= 0 && (!checkPersistence(tag) == invert)`: with every persistence
  flag `true`, `!checkPersistence` is false, so `invert == false` makes it
  deactivated. Counter-intuitive, and a second reason fixtures must stay
  off tagged teleporters. Level 0's are all `tag = -1`.
- **`TreeLarge`'s ctor offset and mask offset cancel** — entity at
  `(x+80, y+96)`, mask offset `(-80,-96)` — so the mask lands on the raw
  oel coordinates. Dropping either half moves it by most of its own size.
- **Bridge (t=29) fails at BUILD time, not from the resolver.** Its
  `Tile.types` entry is `"Unused"` because it rewrites its own entity type
  from an opening timer inside `render()`, so it cannot even be sorted
  into the walkable or solid list. The merely special terrains (water,
  pit, lava, ice, waterfall) load fine and throw only if the player
  actually stands on one.
- The extract has **already applied `loadlevel`'s out-of-bounds guard**
  and records the count in `tiles_outside_level` (5 for level 0; 506
  across 51 levels). `levelWorld` must not re-filter, and must not
  un-filter.

### Decisions worth keeping

- `collidesSolid` throws on a pixelmask overlap **unconditionally**, even
  when a rect solid would also have blocked. The bounding rect already
  over-approximates the mask, so this can only over-throw — and an
  over-throw is a loud "move the fixture" while an under-throw is a
  divergence nobody sees.
- The query methods close over their lists rather than reading `this`, so
  `const { collidesSolid } = world` cannot silently break.
- `MODELLED_TILE_TYPES` is pinned as the **complement** of the six
  excluded types, so the list cannot drift in either direction.

### The tests earn their keep

Beyond census and footprints, the suite cross-checks the geometry against
the **slice-0 oracle recordings**: the BreakableRock rect makes y=130.5
free and y=129.5 blocked (the recorded stop, to half a pixel); the west
trigger fires at exactly the recorded x=17.70000000000001 and not one tick
earlier; each recorded arrival is the trigger's own `(playerx+8,
playery+8)`; neither arrival re-arms a trigger; and **every recorded
position of both fixtures is replayed through `collidesSolid`** to prove
the routes are clear of the pixelmask seam and never overlap a solid. That
last one is the fixtures' central claim checked rather than asserted in
prose.

Gates: vitest **3929/3929** (was 3890). No live-game leg — slice 1 adds no
physics, so the differential is unchanged.
