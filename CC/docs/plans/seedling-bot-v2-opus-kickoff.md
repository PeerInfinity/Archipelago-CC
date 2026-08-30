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

### ⚠ A tape's `boot.x`/`boot.y` are NOT honored by the game

Found during slice 0 and not recorded anywhere before. `Bot.as` assigns
`bootLevel = int(t.boot.level)` and **never reads it**, and ignores
`boot.x`/`boot.y` entirely. The spawn is baked into the SWF at
`Main.as:51` — `new Game(0, 80, 128)`. So **every tape must declare
`{level: 0, x: 80, y: 128}`** to match the build.

This is a live trap, not a curiosity: a tape declaring anything else is
silently honored by the JS side and silently ignored by the game, and the
differential blames physics. That is precisely the asymmetric
interpretation the tape format exists to make impossible, so it deserves a
loud check — either `parseTape` validating `boot` against a declared build
spawn, or the harness refusing a tape whose boot does not match. Cheap,
and it belongs with the other "no silent defaults" rules.

It also constrains §3.4: `botDriverV2`'s cross-level legs **cannot boot
into an arbitrary level** to test a route. They must walk there from level
0, or the build needs a parameterised boot — which is an AS3 edit, and
therefore something to BATCH with any other AS3 change rather than pay the
~10-minute pipeline for alone.

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

## 9. Slice 2 — AS BUILT (2026-07-30)

`playerPhysicsV2.js` + `playerPhysicsV2.test.js` (23 hand-derived cases),
`levelSource.js` (node-only), plus small extensions to `playerPhysicsV1.js`,
`levelWorld.js` and `tapeRunner.js`. **`collide-up-rock` reconciles
EXACTLY** — same doubles, float noise included — and the v1 five are
byte-identical to their own recordings.

### The seam shapes that slices 3 and 4 inherit

- **One sweep loop, not two.** `sweepAxis(pos, rel, collideAt)` in
  `playerPhysicsV1.js` carries the AS3's per-step test verbatim, and
  `moveAxis` is that loop with the probe omitted. `step()` gained
  `opts.collides(x, y) -> blocker|null` and nothing else — which is why
  the regression net held. It also now returns `hitX`/`hitY` (this tick's
  sweep results, not carried state), because §3.4's "hit a wall en route to
  a waypoint → THROW" needs to tell a completed move from a cut-short one.
- **The level is INJECTED, never loaded.** The caller passes
  `levelSource(level) -> record`; `levelSource.js` is the node-only half
  (`atlasLevelSource()`), and `levelSourceFromAtlas(atlas)` is the
  browser-usable one. A record source rather than a prebuilt world for two
  reasons that are both slice-3 reasons: the runner must build worlds for
  levels nobody named at call time (a teleporter's `to`), and
  `buildLevelWorld`'s loud throws should fire when a run walks INTO a level
  rather than eagerly for all 116. `tapeRunner` memoises what it builds.
- **`opts.levelSource` selects the engine.** Without it, the v1 engine
  (stub terrain, no collision) and a `noclip:false` tape is refused. With
  it, the v2 engine with the sweep's collision test on or off exactly as
  the tape says. The v1 five are run BOTH ways by `tapeRunner.test.js`.
- **The transition seam is in `playerPhysicsV2.step`,** at the top of the
  tick, testing the position the previous tick left — which is where the
  real trigger fires from. Slice 3 replaces the throw with the swap in one
  place. It is deliberately blunt: it fires on ANY overlap including the
  one the game suppresses (arriving ON a teleporter pre-latches it), which
  can only over-throw.

### The pending split no longer keys on `tape.noclip`

`tapeRunner.test.js` now pins `PENDING = ['transition-west-return']` by
name and by REASON (it throws `TransitionNotModelledError`), because
`collide-up-rock` is `noclip:false` and modelled. Slice 3 empties the list
and the guard beside it goes red rather than the block passing vacuously.

### Things the running code said that the brief did not

- **Level 0's spawn tile is BRICK (t = 3), not Ground.** Tileset column 4.
  The observation stream cannot tell — brick and ground both walk at 0.8 —
  so it is asserted on the resolver's own answer. A reminder that "the
  streams match" is a weaker claim than it reads.
- **The first-tick type flip is modelled, via `beforeTypeFlip`** on
  `levelWorld.collidesSolid` / `nearestWalkableTile` (and a new
  `objectSolids` list). Only TILES are late: every object class assigns its
  type in its CONSTRUCTOR, `CliffSide` included, so the pixelmask seam is
  armed on tick 1 too and `collide-up-rock`'s BreakableRock blocker is
  unaffected. It is genuinely unobservable today — a fresh Player moves
  ≤ 0.8 px, and every SOLID tile type carries the plain 0.8 walk speed, so
  a first-tick state of 9 and one of 0 pick identical physics — which is
  exactly why it needed a synthetic unit case rather than a fixture.
- **`Rectangle.intersects` confirmed at the source that matters**:
  `SWFModernRuntime/src/avm2/avm2_text.c:8029` is positive-area only
  (`ax < bx+bw && ax+aw > bx && ...`) behind an isEmpty guard on both
  rects — the same comparison as FlashPunk's `Entity.collide`, so
  `rectsOverlap` legitimately serves both the sweep and the terrain gate.
- **Three MOVE_SPEEDS comment labels were wrong** (§2.3 named two): 17 is
  Lava, 25 is Waterfall, **30 is Ghost Tile Step** (it read "stairs
  (dark)"). Values were always right, which is why nothing caught it.

### What the fixtures cannot check, and what covers it

The non-sticky-resolver mutation turns **no fixture red** — no v1 or v2
route leaves level 0's tiled area, so the gate never fails along one and
the recordings genuinely cannot see the difference. That is the case for
the synthetic hand-built grids in `playerPhysicsV2.test.js`: a full tile
grid covers every position, so the properties that only appear at a HOLE
(sticky fallback, strict-touch) need a level with rows deliberately
missing. Level 0 can only ever say "the two agree here".

**The vacuity is a property of levels 0 and 94, not of the model — and it
is not permanent.** Both have COMPLETE tile coverage (400/400 cells), so
the intersect gate can never fail along any route in them. A hole cell has
no tile, therefore no *solid* tile, so it is walkable unless an entity
covers it — which makes a reachable hole an oracle-visible witness for
stickiness. Surveying the extract:

- **27 of 116 levels have holes** in their `tiles` layer (distinct from
  `tiles_outside_level`, which is overpaint the extractor already drops).
- **6 have a hole 4-adjacent to plain walkable floor**, i.e. steppable:
  99, 101, 28, 83, 102, 110.
- The nearest is **level 83 `OverWorld_fallhole`**, a 5x5 room whose
  entire left and right columns are holes, reached **level 0 -> 12 -> 83
  through two `tag=-1` teleporters** (level 0's (304,176) exit, then level
  12's (32,848)). Standing mid-hole puts the player's 4-wide sample rect
  at x in [6,10) while the nearest walkable tile's rect starts at 16 — no
  intersection, so `state` must fall back to the sticky value. That is the
  differential the current roster cannot produce.

Two things stand between that and a fixture, both already known:
1. **The boot is baked in** (§7's `boot.x`/`boot.y` finding), so the
   oracle can only reach level 83 by WALKING there — which is slice 4 at
   the earliest, and level 12's interior is unexamined (its exit sits at
   y=848, so it is a tall level and the walk may cross terrain v2 will not
   model). The alternative is a parameterised boot, which is an AS3 edit
   and therefore something to BATCH per §6 rather than pay for alone.
2. `buildLevelWorld(83)` would **throw today** on its `control` and
   `lightalpha` entities — the census seam doing its job, and a reminder
   that a new fixture level costs a class-table pass.

So: record the gap as bounded, not accepted. Until one of those lands the
synthetic grids are the only stratum that can see stickiness, and they
share the generator's assumptions — which is worth saying out loud rather
than letting the mutation table imply the property is covered.

Mutation checks, each run, each confirmed to bite:

| mutation | goes red |
|---|---|
| zero velocity on collision | `collide-up-rock` exact match + 2 hand-derived |
| non-sticky resolver | 5 hand-derived (NO fixture — see above) |
| Y-before-X sweep order | the probe-schedule case |
| non-strict intersect | 3, across levelWorld and the resolver |
| `checkOffsetY` dropped | 2 |
| first-tick flip ignored | the pass-through-a-solid-tile case |
| `nearestWalkableTile` over ALL tiles | 4 |
| transition seam removed | the teleporter throw + the pending fixture |

### Gates at slice 2 close

- vitest **3969/3969** (was 3929; +40).
- `verify-seedling-bot-differential.mjs --win` green across all **7**
  fixtures at ~25 fps, live driver task included. No recording rewritten —
  slice 2 changes no expectation, only the engine that has to hit them.

## 10. Slice 3 — AS BUILT (2026-07-30)

Room transitions modelled. **`transition-west-return` reconciles EXACTLY** —
all 151 observations plus both `transitions` records — so every committed
fixture now carries the ordinary exact-match assertion and the `PENDING`
list is gone. `collide-up-rock` and the v1 five stayed byte-identical
(`collide-up-rock` was re-recorded and came back with no diff at all).

Touched: `playerPhysicsV2.js` (the swap), `tapeRunner.js` (the loop that
applies it), `tapeFormat.js` (the contract, the derivation, the differ),
`verify-seedling-bot-differential.mjs` (the game's side), and the three
test files. No AS3 edit, as §2.6 predicted.

### The decision the brief left open: DERIVE AT RECORD TIME

`botDrain` hardcodes `transitions: []`, so the game's side is derived from
the tick stream (§1 ruling 2 makes that a pure function). The open question
was whether to derive at COMPARE time and leave the committed expectations
carrying `[]`, or at RECORD time so the file says it outright. **Record
time**, for one reason that turned out to be visible in the diff: the
re-record added twelve readable lines to `transition-west-return.json` and
nothing else, so the fixture's central claim — *it crosses at 61 and comes
back at 109* — is now reviewable in `git diff` instead of being conjured on
both sides of every comparison. The cost was one `--record --only=` run
(~16 s for the long tape, ~9 s for the short one).

Two structural rules hold it up, and both are load-bearing:
- the derivation lives ONCE, in `tapeFormat.deriveTransitions`, and the
  harness applies it on BOTH paths (record and compare) — the live game
  still reports `[]`, so compare mode would go red otherwise;
- the JS engine derives its side from its OWN world swap, never from the
  level field. If both sides read the level field the transitions diff
  degenerates into diffing the tick stream against itself.
- The harness also CHECKS that `botDrain`'s own field is still empty. A
  future AS3 build that starts reporting transitions is then a named
  failure to reconcile, not something the derivation silently overwrites.

`tapeFormat` also grew the element schema and an element-wise exact diff
(v1 validated array-only and compared LENGTH). A count-only comparison
passes a run that crossed the right number of times in the wrong places —
which is exactly the mutation the new differ was checked against.

### The tick order, as it went in

Transcribed in `tapeFormat.js`'s docblock (a contract both consumers share,
not an implementation detail). Nothing here needed re-deriving — the
slice-0 recording had already settled it — and the code came out in three
pieces: `updateTeleporters` (before the movement), `playerPhysicsV1.step`
(the movement, in the OLD level), `arriveIn` + the runner's loop (the
end-of-tick swap). The swap is split across the module and the runner
because building the destination world needs the injected level source;
the SEMANTICS (arrival `+8`, zeroed velocity, fresh terrain state,
pre-armed latch) are all in `arriveIn` and unit-testable without a runner.

Two things worth writing down because the code reads oddly without them:
- **The `beforeTypeFlip` tick is per WORLD, not per run.** The tick after
  an arrival is the destination world's first live tick, for exactly the
  reason tape tick 0 is the boot world's: `blackCover` frames update
  nothing, so the Tiles have still not run their own first `update()`.
- **`Teleporter.update` never sets `playerTouching`.** Only `check()` does
  (`Teleporter.as:58-65`), and `Game.update` runs `check()` on every entity
  on a new `Game`'s first frame ABOVE the `blackCover` gate
  (`Game.as:803-812`), so the latch is armed before any live tick. Firing
  therefore does not latch — harmless, because that world is discarded
  moments later, and transcribed rather than tidied.

### Two new loud seams, one live and one defensive

- **Two teleporters firing on one tick THROWS.** `FP.world =` only records
  a `_goto`, so the winner is whichever updates LAST — FlashPunk's prepend
  order, which this module deliberately does not transcribe. Not
  theoretical: level 0's own west pair sits at (0,128) and (0,144), and a
  player whose y is in **(141, 146)** has their 5-tall box in both volumes
  at once, with different arrivals (296,168) vs (296,184). The recorded
  tape walks the row at y = 136 and misses it by five pixels.
- **A teleporter targeting its own level THROWS.** The game side derives
  transitions from the level field, so a same-level teleport is invisible
  there; modelling it would put an entry in the JS stream the oracle could
  never report. Defensive only — a scan of the extract finds **0 of 280**
  teleporters self-targeting.

### ⚠ The latch mutation does NOT turn the round trip red

The brief (§3.5.4, §3.6) expected `transition-west-return` to pin "latch
behavior in both directions". **It cannot, and the slice-0 recording
already said so**: neither arrival lands on a trigger, which is why the
round trip is two crossings rather than a bounce. Dropping the latch
entirely turns **four hand-derived cases** red and **no fixture**. This is
the same shape as slice 2's non-sticky vacuity and is recorded the same
way rather than left implied by a mutation table.

The bound is real but not permanent, and the witnesses are concrete. A scan
of all 280 triggers in the extract finds **four arrivals that land ON a
trigger** — genuine ping-pong pairs where the latch is the only thing
between the game and an infinite loop:

| from | arrives | on |
|---|---|---|
| L11 (32,0) → L3 | (104,136) | L3 (96,128) → 11 |
| L97 (32,16) → L37 | (584,152) | L37 (576,144) → 97 |
| L88 (192,0) → L87 | (440,312) | L87 (432,304) → 88 |
| L107 (0,48) → L102 | (232,104) | L102 (224,96) → 107 |

All `tag = -1`. None is reachable from level 0 in one hop (level 0 exits to
1, 12, 94, 89, 86, 13, 2), and the boot is baked into the SWF (§7), so an
oracle-backed latch fixture needs cross-level WALKING — slice 4 at the
earliest — or the parameterised boot that §6 says to batch. Same gate as
the level-83 stickiness witness, and it should be taken through the same
door.

### Mutation checks, each run, each confirmed

| mutation | goes red |
|---|---|
| transition `t` = tick instead of tick+1 | `transition-west-return` exact match + 1 |
| velocity survives the swap | `transition-west-return` exact match |
| arrival without the half-tile ctor offset | the fixture + 1 hand-derived |
| **drop the teleporter latch** | **4 hand-derived — NO fixture (see above)** |
| sticky terrain state survives the swap | 1 hand-derived only |
| SKIP the old level's doomed last step | 1 hand-derived only — *negative control* |
| wrong `t` in a stream (differ leg) | the element-wise diff case |

The last two are the interesting ones. The doomed-step mutation is the
brief's own claim — "the v2 engine may model that step or skip it: the
stream cannot tell" — put to the test, and the fixtures agree: only the
transcription's own unit case notices. Modelling it is kept because the
game runs it. The terrain-reset row is the same kind of finding: both
arrival tiles walk at 0.8 either way.

### Gates at slice 3 close

- vitest **3987/3987** (was 3969; +18).
- `verify-seedling-bot-differential.mjs --win` green across all **7**
  fixtures at ~25 fps, live driver task included. One expectation
  rewritten, by `--record --only=collide-up-rock,transition-west-return`:
  `collide-up-rock` came back byte-identical and `transition-west-return`
  gained only its two `transitions` records.


## 11. Correction to §10's trigger scan: it was 4, not 3 — and `stairsup`
was missing from the class table (2026-07-30)

Slice 3's ping-pong scan covered **254** triggers. The extract has **280**:
`teleporter` 228, `stairsdown` 26, **`stairsup` 26**. The scan — and, more
importantly, `levelWorld.ENTITY_CLASSES` — had `stairsdown` but not
`stairsup`.

**They are the same class and the same trigger.** `Game.as:2167-2168`
differ only in `Stairs`' third argument:

```as3
stairsup   -> new Stairs(x, y, TRUE,  flip, to, px, py, sign)
stairsdown -> new Stairs(x, y, FALSE, flip, to, px, py, sign)
```

and `_up` only picks a sprite frame, a sound index and a render flag
(`Stairs.as:18-34`). The `super(...)` call is byte-identical, so the
trigger volume, the forced `show`/`tag = -1` and the collision geometry
are too.

Consequences, both now fixed:
- `buildLevelWorld` **threw** on any of the 26 levels holding one. Loud
  rather than silent, so nothing was ever wrong — but slice 4 walks the
  level graph and would have hit it immediately.
- The ping-pong census missed a fourth pair: **L97 (32,16) → L37, arriving
  (584,152) onto L37's trigger at (576,144) bound back to L97.** §10's
  table is corrected above.

The guard is a **wider census than the rest of the table**: every
`teleporter`/`stairs*` tag in ALL 116 levels must be a classified trigger,
not merely those in the fixture levels. Triggers are the exception because
they define the LEVEL GRAPH — and a missing tag there is not a loud throw
somewhere useful, it is an exit that silently does not exist until
something tries to stand on it. Removing `stairsup` again turns 3 tests
red; narrowing `isStairs` back to `=== 'stairsdown'` turns 1.

vitest **3990/3990** (was 3987).

## 12. Slice 4 — AS BUILT (2026-07-30)

`botDriverV2.js` + `botDriverV2.test.js`, `levelRun.js` + `levelRun.test.js`,
a `plannerBlockerAt` face on `levelWorld`, the `BUILD_SPAWN` check in
`tapeFormat`, and four new fixtures — `wall-slide`, `thread-the-gap`,
`cross-level-leg`, `statue-press` — **all oracle-recorded and all exact**.
The v1 five, `collide-up-rock` and `transition-west-return` stayed
byte-identical; no existing expectation was rewritten.

### ⚠ The oracle corrected the geometry AGAIN, and this time by pathing

`Statue` is the ONLY class in the table that adds an offset **on top of
NPC's own constructor**:

```as3
Statue  super(_x + Tile.w, _y - Tile.h/2 + Tile.h*int(_t==0), ...)  // (+16, -8)
NPC     super(_x + Tile.w/2, _y + Tile.h/2, _g)                     // ( +8, +8)
```

Slice 1 applied the first and stopped, putting level 0's statue collider
**8 px up and left**. The first `thread-the-gap` recording is what found
it: the game pinned x at **181.17065141119556** against a left edge at 184
that the model did not have, and walked no further, while the JS strolled
through. `IntroCharacter`, `AdnanCharacter`, `Rekcahdam` and `Watcher` all
pass `_x`/`_y` straight through, so NPC's half-tile is their whole offset
and their entries were right — this is a one-class fix, checked as one.

Two things worth carrying forward:
- **Slice 1's own note said the statue "sits far from any fixture route".**
  It was true of the v1 routes. A pathing fixture goes where the geometry
  says it may, so "unobservable" decays the moment the driver gets better.
- With the route now planned AROUND the statue, no synthesized fixture
  touches it — a driver whose job is to never hit a wall cannot press one.
  **`statue-press` exists for that**: a driver-planned approach to tile
  (10,11) plus a hand-authored 40-tick RIGHT into the edge. Tile (11,11) is
  not even a legal A\* goal, so the press could not have been synthesized.
- Also settled in passing: the statue's `setHitbox` comes from `render()`,
  and unlike the Tile type flip that is NOT a first-tick subtlety —
  `render` is driven by the Engine independently of `Game.update`'s
  `blackCover` gate, so the ~18 fade frames have all rendered before tick 0.

### ⚠ The brief's smoothing test was checking a curve the player never walks

§3.4 says "smooth greedily while the straight SEGMENT stays clear". Doing
exactly that put a fixture in the lake. The braking rule is **per axis**,
and both axes accelerate by the same `accel` under vector friction, so
while both are held they advance at the SAME rate: the player leaves a
waypoint at **45 degrees** and only straightens out once the shorter axis
arrives. For a shallow leg — dx 128, dy 16 — that is most of the level.
From (104,184) toward (232,200) the straight line is at y = 185 by x = 112
and the player is at y = **192**, over the Water at tile (7,12), where
`assertModelledTerrain` fires.

`controllerPathClear` models the two legs actually traversed (45-degree
leg, then axis leg). Still approximate in two bounded ways — the X-first
intra-tick corner, and up to one accel quantum of overshoot at a waypoint,
which the 6 px between a tile centre and its edges absorbs — and the
executor's throw is what makes approximation safe.

### The seam has two faces, and only one may be quiet

`collidesSolid` throws on a pixelmask deliberately. A planner cannot use
it: routing around an obstacle by catching the exception that says you
already hit it is not routing around it, and one stray probe aborts the
search. `plannerBlockerAt` is the same geometry with the throw taken off —
and **strictly wider**, because it also reports **unmodelled terrain**,
which blocks nothing at all in the game (water is walkable geometry) but
ends a v2 run. A planner asking only about solids routes straight into the
lake. A fourth kind, **live teleporter volumes**, is planning POLICY and
lives in the driver, not the geometry: an in-level route that clipped a
trigger would silently end up in another level — the accident that ate
v1's original `clamp-left` fixture.

### `levelRun.js`, and why the factoring was not tidiness

The driver's copy of a world swap is what **synthesizes the tape the
differential then runs through the runner's copy**. Two copies would be
wrong together and the tape would still reconcile against the game — a
verifier sharing the generator's assumptions, one level up. So the swap
(arrival offset, zeroed velocity, reset terrain, pre-armed latch, the
destination world's own `beforeTypeFlip` tick) has one implementation and
two callers. RECORD-THEN-ACT stayed in `tapeRunner`: it is a rule about
where the AS3 hook sits, not about the engine.

### §7's asymmetry trap is retired

`parseTape` now checks `boot` against `BUILD_SPAWN` ({0, 80, 128}).
`tapeRunner.test.js`'s old "carries the boot level" case booted into level
7 to prove propagation; it now asserts the REFUSAL, and propagation is
covered far better by `transition-west-return`, which crosses for real.

### §3.5.5 terrain-speed: DROPPED, with the reason

Cliff Stairs (t=10) exists in levels 12, 28, 37, 83, 87, 88, 90, 92, 93,
99; Ghost Tile Step (t=30) in 61–67. **Neither appears in level 0 or 94**,
and level 94 is the ONLY one of level 0's seven neighbours (1, 2, 12, 13,
86, 89, 94) that `buildLevelWorld` can build — every other one throws on an
entity class the table does not carry. So there is no dry stairs tile a v2
tape can reach, and the brief's own instruction applies: drop it, do not
force a fixture through water.

### ⚠ No AS3 build — and the reason is NOT the pipeline cost

The brief asked this to be decided early. It was, on evidence:

**A parameterised boot would not unblock either bounded witness.** All six
of §9's hole-adjacent candidate levels (99, 101, 28, 83, 102, 110) fail
`buildLevelWorld`, and level 83 — §9's named target — additionally holds a
**Pit (t=6), Water (t=1) and nine cliffside pixelmasks in a 5x5 room**, so
its hole is unreachable at the v2 rung however the player arrives. All four
of §10's ping-pong levels are equally unbuildable. **The blocker is the
class table and the v2 terrain scope, not the boot**, and §9's "walk there
or parameterise the boot" framing named two doors that are both shut for
the same third reason. Nothing else wanted an AS3 edit, so §6's "decide
only inside a batch that is already paying" left nothing paying. The loud
boot check §7 asked for landed anyway — it is JS-side and costs nothing.

Recorded so a later slice does not re-derive it: **cross-level walking from
level 0 reaches exactly ONE other level, 94.** Any rung that wants more
starts by transcribing entity classes, not by rebuilding the SWF.

### Bounds this slice adds, recorded rather than implied

- **The teleporter policy turns no fixture red** (2 hand-derived only). The
  only trigger a committed route approaches is the exit, which is exempt.
  The witness: a target on the far side of a trigger tile, forcing a detour.
- **The executor's hit-throw is a DIAGNOSTIC, not a detector.** Removing it
  turns nothing red, and running it together with the wrong statue rect
  turns the SAME 5 tests red as the statue mutation alone — the geometry
  error is already caught by the recordings and by the tape-reproduction
  test. It buys a better message, not more detection. Keep it anyway: the
  alternative, a silent re-plan, is how a model defect becomes a green run.
- **The A\* tie-break is defensive.** Reversing the neighbour order AND
  dropping the (ty, tx) tie-break both leave everything green: level 0's
  routes have no equal-f tie that survives the smoother. The real cross-run
  determinism pin is "the committed fixtures are what the driver emits
  today" — a tape recorded from the game in another process on another day.

### One property worth stealing for later rungs

For a **synthesized** fixture, "the driver still emits this tape" converts
any geometry error into a red, because the PLAN depends on the geometry.
That is a strictly stronger net than a replay-only fixture, and it is how
the statue mutation gets caught even along a route that avoids the statue.

### Also true, and unpleasant to discover later

**49 of level 0's 152 box-fitting tiles are unreachable from the spawn** —
the north field behind the building, the east corridor, the west sliver.
Any coverage claim about "level 0" should say which 103 tiles it means.

### Gates at slice 4 close

- vitest **4050/4050** (was 3990; +60).
- `verify-seedling-bot-differential.mjs --win` green across all **11**
  fixtures at ~25 fps, plus the swapped live driver task: the brief's
  thread-the-gap + cross-level task, **517 ticks planned at run time**,
  both targets reached in two levels and the crossing at the tick the
  driver named — all asserted from the game's own drained observations.
- Four expectations written (`--record --only=`), none rewritten. The two
  driver fixtures were recorded twice: once before the statue correction,
  which is how it was found, and once after the re-plan.


## 13. The real gate for v3+ is the CLASS TABLE, and it is big (2026-07-30)

Slice 4 retired the parameterised-boot recommendation for the right
reason: a boot that could start anywhere unblocks nothing, because
`buildLevelWorld` throws on unclassified entities in every level worth
going to. Verified independently — of level 0's eight exits, **only level
94 builds**; all six §9 hole-adjacent levels and all four §10 ping-pong
destinations throw.

Sizing what widening it would actually cost, since "add the missing
classes" is the sentence that will otherwise get written into a plan
unpriced:

- **3 of 116 levels build today.**
- **115 distinct unclassified entity tags** across the extract.
- The distribution has a very long tail. `lightalpha` alone blocks 98
  levels, but classifying it takes you from 3 levels to **6**:

  | classify top N tags | levels that build |
  |---|---|
  | 1 (`lightalpha`) | 6 / 116 |
  | 3 | 10 / 116 |
  | 5 | 12 / 116 |
  | 10 | 16 / 116 |
  | 20 | 27 / 116 |
  | 40 | 44 / 116 |

So there is no cheap prefix. Most of the 115 are enemies, pickups,
puzzle furniture and presentation — i.e. the same mass the v1 port-scope
note put at "Enemies (30+ classes), bosses, NPCs, presentation" — and
classifying them is not a table-filling exercise so much as the v3/v4/v5
rungs arriving one class at a time. That is the honest shape: **the ladder
above v2 is gated on entity semantics, not on the boot, not on pathing,
and not on the toolchain.**

Two consequences worth carrying into any v3 planning:
- Pricing a rung by "which levels does it need" is now a one-line query
  against `ENTITY_CLASSES`, and should be done BEFORE the rung is scoped.
- The census guard's altitude was chosen correctly. Classifying only what
  fixture levels contain is what has kept 115 tags from being guessed at,
  and every one of those throws is a rung boundary made visible rather
  than a silent non-collider.

## 14. Slice 5 — AS BUILT (2026-07-30): the rung is closed

Documentation only; no behaviour changed and no expectation moved.

- **`docs/json/developer/procgen/seedling-bot.md` is now the v1+v2 doc**,
  and it is the thing to read first for this arc. Its stale header ("v1
  scope: collision disabled, movement only, one level"; "all five fixtures
  match") is gone. It carries the transitions contract (the settled tick
  order plus the record-time derivation and its three load-bearing rules),
  the resolver's four properties, the level-injection seam, the six loud
  throws with the reason each is a throw rather than a fallback, the
  45°-then-axis controller, the bounded vacuities as one table, and the
  class-table sizing as the "what's next".
- Plan-doc Phase 8 checkboxes: **v2 ticked**, v3 annotated with its real
  gate. Queue §5c carries the same close-out. Memory topic updated.
- **The two transcription lessons are written up as lessons, not
  incidents** — a tag missing from a table while its twin is present
  (`stairsup`; the guard is a census wider than the fixture levels), and an
  offset applied at one level of a constructor chain but not the next
  (`Statue`; found only because a route finally went near it).
- Fixed in passing: this file had **two sections numbered §12**. The
  class-table section is now §13, and every pointer at it was updated.

Gate: vitest **4050/4050** unchanged; the procgen README still links the
doc (its one-line description now names collision, transitions and
pathing).
