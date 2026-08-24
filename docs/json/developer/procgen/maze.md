# Maze Substrate

The maze substrate (`frontend/modules/mazeRoom/`, substrate id `maze`) renders regions as grid-of-tiles maze rooms: the player walks tile by tile, picks up items by stepping onto location tiles, and leaves through exit tiles on the perimeter. It is the most fully-featured substrate — the only one supporting every loop-queue action type and saved custom queues — and its tile-grid engine doubles as the shared implementation the text-adventure substrate builds on (`shared/procgen/adapterPrimitives.js`).

The module splits cleanly: `mazeRoomEngine.js` is headless (no DOM, no eventBus), `mazeRoomUI.js` is the panel, `mazeRoomLibrary.js` is the registry entry, and `index.js` wires registration and re-exports the engine surface.

## The engine (`mazeRoomEngine.js`)

A world is a `width × height` grid of floor/wall tiles (an `Int8Array`), an entrance, and a `Map` of exits (`exit_id → { x, y, side, exitName, targetRegion, … }` — multi-exit by construction). Movement inputs are `N`/`S`/`E`/`W`; a `WAIT` pseudo-input exists at the playback level (it advances the turn without calling the engine's `step`, and path planners emit it for deliberate waiting). Feasibility questions ("can the player reach every exit?") go through the shared simulator core's `reach`/`makeBfsSolver` — the maze was the first consumer of that interface ([Playback and Debugging Tools](./playback-and-debugging.md#the-shared-simulator-core-frontendmodulessharedsimulatorcorejs)).

Region generation composes: resolve the biome → run its wall backend → apply its post-processors → check feasibility → place obstacles, items, and logic gates to satisfy the region's access rules → extract paths-and-obstacles for verification. Placement is guaranteed: when no reachable floor tile is free for a location, the region grows and placement retries rather than silently dropping the location.

## Biomes and wall backends

A **biome** is a named bundle of (backend, params, post-processors); a **backend** is one wall-generation strategy, registered by id in the shared `mazeAlgorithms/registry.js` (kept in `shared/procgen/` so a future grid-based substrate could reuse it). Per-region biome selection lives in `preset_sidecars[player][region].biome`; unspecified regions fall back to `classic`.

**The table now lives in `procgenCore/skeletonKinds.js`, and `mazeRoomBiomeLibrary.js` re-exports it.** The constructive-mode arc's slice 5 made these names one vocabulary across **both** substrates — the biome names ARE the constructive **skeleton kinds**, the room a generated level starts from (see below, and `seedling-bot.md` § *The constructive-mode arc*). `seedlingDemo/` may not import `mazeRoom/`, so the shared half had to move to a neutral file; every maze caller keeps its import path and `resolveBiome` is the same function. ⛔ Two defaults live there and must not be collapsed: `DEFAULT_BIOME_ID` (`classic`) is what an unconfigured AP **region** generates; `DEFAULT_SKELETON_KIND` (`empty`) is what the constructive **loop** starts from.

| Biome | Backend | Character |
|---|---|---|
| `empty` | `empty` | No walls — showcases the topology layer |
| `classic` (default) | `random_walls` | Uniform random wall proposals with a feasibility check |
| `corridor` | `corridor_only` | Shortest path entrance→exits; everything else wall |
| `branchy` | `recursive_backtracker` (newest picker) | Long winding corridors, deep dead ends |
| `bushy` | `recursive_backtracker` (random picker) | Prim's-like, shorter branches |
| `loopy` | `kruskals` + `braid(p: 0.5)` | Perfect maze with some loops braided in |
| `open` | `kruskals` + `braid(p: 1.0)` | Every dead end removed |
| `rooms` | `recursive_division` (minRoom 3 — a **knob**, see below) | Chambers connected by single-tile gaps |
| `winding` | `recursive_backtracker` (newest) + `pruneDeadEnds` | **One winding corridor** entrance→goal, wall everywhere else |

`winding` was added by the constructive arc and is Cloudberry's pass 1: a perfect maze with every dead end filled back in, so what survives is exactly the unique entrance→exit path (asserted against an independently computed BFS in `skeletonKinds.test.js`). ⛔ It is **not** a rename of `corridor` — that is the BFS *shortest* path and needs the simulator; this is the spanning tree's own route, which wanders. ⚠ Its `threshold: 9999` is not a tuned depth: `pruneDeadEnds` re-lists its dead ends inside a `while (changed)` loop, so it runs to a fixed point and 1, 2 and 9999 give the same residue (measured). The number states the intent.

Adding a biome that uses an existing backend is a one-line change to the table in `skeletonKinds.js`; adding a backend is a new file under `shared/procgen/mazeAlgorithms/` (portable) or `mazeRoom/mazeAlgorithms/` (simulator-bound) plus an entry there. Post-processors (`braid`, `pruneDeadEnds`, `chambers`) are looked up the same way.

### Kind parameters (constructive-mode slice 7)

A kind may declare **knobs**, in the same `[{key, domain, default, why}]` schema a parameterized template uses and checked by the same `templateContract.assertParamSchema`. They are spelled on the URL as `?skeleton=<kind>;<key>=<value>;…`, on both CLIs as `--skeleton='rooms;minRoom=2'` (quote it — `;` is the shell's), and in the sweep's `--kinds=`; one parser, `skeletonKinds.parseSkeleton`.

| knob | kinds | domain | default | what it does |
|---|---|---|---|---|
| `minRoom` | `rooms` | 2, 3, 4 | 3 | the smallest chamber `recursive_division` will cut — reaches the **backend** |
| `prune` | `bushy`, `loopy` | 0, 1 | 0 | fill every dead end back in |
| `chambers` | every carved kind (`branchy` `bushy` `loopy` `open` `rooms` `winding`) | 0..3 | 0 | stamp *k* open 3×3 squares onto the finished carve |

⛔ **A knob at its default is byte-inert, not merely equivalent.** A post-processor knob is *appended only when its value is off the default*, so at `chambers=0` nothing runs, no draw is spent, and every committed seed→level pair survives the day the knob was declared. `minRoom`'s default is the literal the table always passed.

⛓ **The draw order is the identity**: goal cell → backend → the table's own post-processors → the value-added ones in **declaration** order, with `chambers` declared last everywhere (asserted at load). A chamber stamped before a prune would be pruned back out.

⚠ **`prune` is a boolean because that is what the subject admits.** `pruneDeadEnds` runs to a fixed point, so thresholds 1, 2, 3, 4, 5 and 9999 give the byte-identical residue — measured over 5 kinds × 5 seeds × both substrate geometries. It is declared on `bushy` and `loopy` only: `branchy;prune=1` is byte-identical to `winding` on seeds 1..8 (a second spelling of an existing kind), and on `open` full braid leaves nothing to prune (a measured no-op).

⛔ **`chambers` is monotone** — it only turns wall into floor — so connectivity is preserved by construction and it needs no repair. Its `margin` is the **caller's**: Seedling passes 1 (its border ring must stay wall and its binding refuses a carve that opens it), the maze passes 0.

**Which kinds a binding offers is declared, not derived.** `classic` and `corridor` name simulator-bound backends, so the table marks them `needs:` and a grid-only binding (Seedling) refuses them **by name** with its own offer list. Deriving the answer from the registry — *"is the backend registered?"* — would have made it depend on who imported what.

**Where the backends live, and the grid contract.** The backends are split across two directories by what they need. `recursive_backtracker`, `kruskals` and `recursive_division` sit in `shared/procgen/mazeAlgorithms/` beside the registry, `cellGrid.js`, `postProcessors.js` and `gridTiles.js`, because they touch a world only through the **grid contract** written down in `gridTiles.js` — `{width, height, tiles: Int8Array (row-major, index = y*width + x), entrance: {x,y}, exits: iterable of {x,y} via values()}` plus `TILE_FLOOR`/`TILE_WALL`/`getTile`/`setTile` and an `rng.next()` in [0,1). No inventory, no obstacles, no simulator. That makes them usable as carvers by any grid substrate, which is what the registry's "room for a future grid-based substrate" note always promised. `corridor_only` and `random_walls` stay in `mazeRoom/mazeAlgorithms/` because they run the maze simulator (`createState`/`apply`/`bfsSolver`/`reach`) to check feasibility, and `empty` stays with them. `mazeRoomEngine.js` imports the five `gridTiles.js` definitions and re-exports them under the same names, so maze-side callers import them from wherever they always did. `mazeAlgorithms/index.js` still performs all six registrations, and its import order is the order `listBackends()` returns.

## The maze as the second substrate on the procgen loop

`procgenMaze.js` binds the maze to the substrate-agnostic generator loop in
`frontend/modules/procgenCore/` — the same loop that generates Seedling levels,
not a maze-local copy of it. It supplies the loop's three injections. The
**model** builds the skeleton (the plain open room `createWorld` already gives:
all floor, entrance at (0,0), one exit at a goal cell drawn from the room stream
*before* anything else, so a carver dropped in later as a `skeleton()` kind
cannot move the goal), offers anchors by one seeded shuffle of the *whole* grid
and taking the first legal cells, adjudicates a named cell once in `refusalAt`
(with `legalAt` derived from it), and `place`s a template's tiles, obstacles and
items together into a **clone** — the maze world is mutable and the loop's
revert is "keep the old record", so a `place` that wrote in place would leave
rejected candidates standing. The **oracle** is `reach` + the maze `bfsSolver`
against "the player stands on the goal tile", and it certifies by **replaying
the returned plan through `step`** rather than trusting the solver's own `ok`;
`BUDGET_EXHAUSTED` is a real class because `makeBfsSolver` has a real node cap
(`options.budget`), though the default 20,000 never binds on a room whose whole
state space is 242 states. The **palette v1** is two parameterized templates:
`wall-segment` (ori × len, paints `TILE_WALL`) and `door-key` (a `door_red` at
the anchor and its `key_red` at a parameterized offset, placed atomically, so
no world ever holds a door whose key was never placed).

⛔ What palette v1 is **not** yet: it does not check that a door is a **cut
vertex** — `placeGateAndKey` does that, and generalising it is a later slice. A
door the walk can simply walk around is a kept candidate that happens to be
decoration, which the arc's yield table measures rather than assumes.

⚠ **Updated 2026-08-18 (procgen ELEMENTS arcs 1–3).** Two halves of that
paragraph have moved and one has not:

- **Pushable blocks and hazards ARRIVED** — arc 2 gave the engine
  `blocks`/`buttons`/`buttonLib` and the BFS a `(player, blocks, inventory)`
  state, and arc 2's element realises the reverse-pull gadget on the maze. See
  *Blocks, buttons and the flag switch* and *The first element* below.
- **The CUT-VERTEX rule EXISTS, and on the maze it is the AREA GRAPH's rather
  than the palette's**: every symbol the graph realises is a lock on every
  boundary cell of an area at key level ≥ 1, which is a cut **by construction
  and measured — 148 symbols, 148 cuts, 0 non-cuts** (§ *The area graph*).
- ⛔ **`door-key` ITSELF IS STILL NOT CUT-CHECKED, and that is a live residue.**
  The one flood-based **door law** (*with the door cells walled the goal is
  unreachable from the start, and every clearer cell is still reachable*) was
  built for Seedling in arc 3 slice 2 and is substrate-neutral, but nothing
  binds it on the maze's pass-2 palette. So a `door-key` the walk goes round is
  still a kept candidate that happens to be decoration. The two candidate fixes
  — bind `doorLawRefusal` here, or retire `door-key` in favour of `--areas=` —
  are named in the generation review (2026-08-17, §3 row 7) and neither is
  measured. See [Seedling Real-Game Bot](./seedling-bot.md) § *The procgen
  ELEMENTS design* → *Arc 3, slice 2* for the law as built.

### The connectivity pre-check (constructive-mode slice 6)

`refusalAt` carries one more rule, shared with the Seedling binding through ONE
flood in `procgenCore/gridFlood.js`: **a candidate whose TILE writes disconnect
the entrance from the goal is refused BY NAME, before any solve.** It runs after
the footprint/clearance walk (which is what rejects an off-grid cell) and, since
`legalAt` is derived from `refusalAt`, `anchorsFor` simply stops offering sealing
cells — so the loop reports NO_ANCHOR where it used to spend a solve and REVERT.
A directive naming a cell explicitly gets `ILLEGAL_PLACEMENT` with the sentence,
which the lab page's trace pane prints.

⛔ **It reads TILES only, and a `door-key` can therefore never be sealed by it.**
Whether a door is passable depends on the key, which is a fact about the SEARCH
and not about the grid — and §12.10's asymmetry is exactly what that protects: on
a corridor the maze KEEPS every door and REVERTS every wall.

⚖ **IT RUNS AT EVERY KIND, `empty` INCLUDED (slice 6b, 2026-08-15).** Slice 6
shipped it kind-scoped — off at `empty`, so the committed open-room pairs could
not move — and measured what widening would cost. The user ruled in the PROCGEN
ELEMENTS design session that it should be widened; GENERATE-UI ruling 5 licenses
the pair expiry. ⛓ **No committed maze pair moved, and that was predicted**: a
single `wall-segment` can seal an open room only at **3×3** (scanned 2×2 through
11×11 over seeds 1..40 — the sole width where one template spans the room), the
default room is 11×11, and all nine per-kind CLI roll-ups came back
byte-identical across the change, `empty`'s `86cc744e…` included. 3×3 is
therefore the unit fixture's subject and the lab row's (`check-maze-lab` claim
10b) — the only size at which the rule is observable on an open room at all.

⚠ **It did cost the SMALL-ROOM revert fixture its subject, and that is the one
place the widening bit.** `procgenMaze.test.js`'s *"a small room at a high target
REVERTS"* ran at 5×5 seed 4, where every revert was a SEALING one — now refused
before any solve, so the row's `reverted.length > 0` fell to 0. Re-picked by a
documented scan (sizes 4×4..7×7 × seeds 1..12 × targets 8/12/16 for a cell with
both a REVERT and a NO_ANCHOR; 21 qualify) to **seed 8 at 5×5, target 12** —
replaced, never relaxed. The reverts that survive anywhere are the soundness
bound doing its job: the oracle refusing through an ITEM, which a terrain flood
cannot see.

Measured over 9 kinds × 4 sizes × 8 seeds (`sweep-yield-table.mjs`, count 3 /
tries 4): `wall-segment` REVERTs **438 → 8**, total oracle solves **1519 →
1079**, KEPT 669 → **672**, saturated cells 99 → 97. The 8 surviving reverts are
the soundness bound doing its job — a wall that cuts a KEY off from the player
makes the room unsolvable through an ITEM, which a terrain flood cannot see.

`scripts/procgen/generate-maze-level.mjs` is the CLI twin of
`generate-seedling-level.mjs`: a seed and the bounds in, the level, the full
generation trace and the summary out as JSON, with stdout as the determinism
channel and `--verify` spawning two fresh child processes to prove the payload
is byte-identical across them.

## The area graph

Above the carve sits an optional **lock-and-key layer**: the carved room is
partitioned into AREAS, `procgenCore/areaGraph.js` (the JS re-implementation of
MetaZelda's logic) grows a tree over them in KEY LEVELS, and the binding
realises each level as `door_K` obstacles and `key_K` items on the grid. It is
off by default and it is the MAZE's only — Seedling gets it in a later arc.

**The knob** is one string through one codec (`procgenCore/areaSpec.js`,
`parseAreaSpec` / `formatAreaSpec` / `normalizeAreaSpec`), spoken by the CLI
(`--areas=`) and the sweep alike:

```
<keys>[;key=value]…        0 · 1 · 2;graphify=0.5;goalShortcut=0
```

`keys` is the key-count TARGET (domain 0–3); `graphify` is MetaZelda's
extra-edge probability (default 0.2); `goalShortcut` admits the post-solve
entrance↔exit shortcut (default on). **At `keys: 0` — the default — nothing
here runs at all**: no partition is computed, the module is not called, no draw
is spent, and every seed→level pair the maze had before is byte-identical.

**What an area is.** A cell is WIDE iff it belongs to at least one all-floor
2×2 square; an AREA is a maximal 4-connected blob of wide cells; every other
floor cell is a CORRIDOR cell, i.e. an EDGE. A one-cell area is grown on the
entrance and on the goal when they do not fall inside a chamber, and floor the
entrance cannot reach is not partitioned at all (`recursive_division` repairs
target reachability, not every cell, so a carved room can hold pockets nothing
can walk to).

Measured over every kind and knob at 11×11: `empty` is exactly **one** area at
every seed (so the module is never called on the open room); an un-chambered
corridor carve has **zero** real chambers — a 1-wide maze has no 2×2 square
anywhere — and `rooms` yields **3–8**. So the area graph is a `rooms`/`chambers`
feature in practice, and it refuses by name elsewhere.

**How a lock reaches the grid.** *The lock is a property of the AREA, not of the
edge*: for every area at key level L ≥ 1, `door_K{L-1}` is placed on **every
boundary cell** of that area (a cell of the area touching a floor cell outside
it). On a tree edge that is exactly the edge's own symbol at the child's mouth;
it additionally covers junction corridors that touch three areas and the cycles
the tree did not take, which a per-edge door would simply be walked around.
Nothing is carved and nothing is walled to make this true. `key_K{n}` is drawn
into a non-boundary cell of the area the module assigned the symbol to, and
per-instance `obstacleLib`/`itemLib` entries (`door_K0 → key_K0`) are added to
the world and carried in the payload — without them `isObstacleCleared` treats
the id as unknown and the door opens for everybody.

**It is verified, not assumed.** For each key level `n`, with every door above
level `n` treated as wall, `gridFlood.reachableFrom` from the entrance must
equal exactly the areas of level ≤ `n` plus the corridor components touching
them. A mismatch, an unplaceable key, a graph the bounds refuse, a partition
with one area, or an entrance and goal in the same area are all **graded
refusals** naming the reason — never a throw — and the carved room is left
exactly as the carve left it. When the layer does run, the loop's own skeleton
solve then certifies the room *with* its doors and keys before any pass-2
template is drawn.

**Solver-work records.** When the layer runs, `summary.elements` carries per
symbol the BFS plan length and nodes expanded with and without the element, the
key→door plan length, and the differential that proves the cut (remove the key,
keep the doors, and the goal is unreachable); `summary.kept[].cost` carries the
before/after plan length of each kept pass-2 template. These are records only —
nothing decides on them, and none of them is a wall-clock number.

**Requiring a symbol (`require: [K…]`).** A run can be DIRECTED: `--require=K0`
on the CLI, `?require=K0,K1` on the lab page, `--require=` on the sweep. The
directive says *the run must place these symbols as locks the goal is beyond*,
and its proof is the differential above — for every asked symbol, removing
`key_K` from the finished level must leave the goal unreachable (`isCut`). A met
symbol is graded **STRONG**; on this substrate that is the only grade reachable,
because the BFS differential is a proof rather than an estimate, so the graded
half of the certification scale is exercised here in its trivial case. Measured:
over `rooms`/`rooms;minRoom=2` at 11×11 and 15×15, keys 1–2, seeds 1..24, **all
148 placed symbols are cuts** — the goal sits at the highest key level and a
door guards every boundary cell of every area at its level, so removing any key
seals the goal by construction.

An unmet directive is a **REFUSED RUN**, never a retry and never a widened
bound. Five reasons, each named: the run is at `areas=0`; the symbol is beyond
the key count the spec declares (`?require=K1` with `?areas=1`); the area graph
itself refused (its reason is carried verbatim); a declared symbol nobody
measured; and a symbol whose key ablation still solves. The CLI exits **6** and
`summary.require` carries `{asked, met: [{symbol, grade, planWith,
planWithoutKey}], refused}`; a run without a directive carries no field at all.

## Blocks, buttons and the flag switch

The engine's state is `(player, blocks, inventory)`. A move into a cell holding
a **block** pushes it one cell along the same delta; the cell beyond must be
floor, block-free and free of an **un-cleared** obstacle, asked with the same
effective inventory the player's own move is asked with. A block does not open
doors.

`world.blocks` is a `Map(posKey → true)` of **initial** positions — the live
ones are `state.blocks`, a sorted array of posKeys that is **absent** when the
world has no blocks, so `mazeVisitedKey` is byte-identical on every world that
predates the mechanism.

A **button** (`world.buttons`, with `world.buttonLib` naming what each one
`holds`) is a walkable cell. It is pressed when a block sits on it **or when the
player stands on it** — the game's own rule — and pressing derives a token
(`sw_A0`) that is added to the effective inventory for that step and **never
stored**. That is what makes it a HOLD: step off and the door shuts.

> ⚠ Clearance reads the stance **before** the move, so a player standing on a
> button can step into an orthogonally **adjacent** door on their own press.
> A guard's door is therefore kept at least two cells from its button.

A **flag** (`flag_K0`) is an ordinary item whose library entry carries
`kind: 'flag'`. It is a LATCH: picked up on arrival and permanent, because every
item pickup already is. Nothing in `step` branches on `kind` — the declaration
is for layer 1 and the renderer.

⚠ In region play a flag is an Archipelago **location**, like a key. Buttons are
deliberately *not* in `world.items` for exactly that reason: they would invent a
phantom AP check on every level that has one.

`serializeMazeLevel` emits `blocks`, `buttons` and `buttonLib` — and **omits
each when empty**, so a level with no gadget serializes exactly as it did before
any of this existed.

## The first element

An **element** (`procgenCore/elements.js`) is a template that exists **before**
the carve: it is constructed in absolute coordinates inside a rectangle the
binding offers, writes its own floor *and* wall, declares the **ports** a
connector may attach to, the cells outside itself it needs kept (`demand`), and
the **area** it is.

⚠ **Updated 2026-08-18 — that description is the `pre-carve` PHASE, which is now
one of two.** Arc 3 slice 4a gave `defineElement` a `phase` field, default
`pre-carve` (the paragraph above, unchanged byte for byte). An **`on-connector`**
element is constructed *after* the carve, is handed a read-only `room` probe
(`floorAt`, `mainPath`, `isCut`, `connectedWith` and the binding's own
`doorLaw`), and **writes SPARSELY**: its `tiles` may be empty, an entity may
stand on a cell the skeleton already floored, it declares **no ports** and
`area: null` — *a door does not MAKE an area, it CUTS one*. Both phases ship on
Seedling (the kill gate and the block pocket); the maze binds only `pre-carve`
today. See [Seedling Real-Game Bot](./seedling-bot.md) § *The procgen ELEMENTS
design* → *Arc 3, slice 4a*. The first one is the **reverse-pull block gadget**
(`procgenCore/elements/reversePullBlock.js`): a block put on its button and
pulled backwards `len` steps with `turns` direction changes, carving the block's
cells, every stance cell, a corner cell at each turn and a bypass cell round the
button. Reversed, that walk is a legal push sequence, so it is solvable by
construction — and the BFS certifies it anyway.

### The spec

```
--elements=<name>[;key=value]…      none · guard · guard;len=4;turns=2;binds=any
```

One codec (`procgenCore/elementSpec.js`), the same trio as `areaSpec` and the
skeleton kinds. `none` is the default and means the machinery **does not run**:
no site is drawn, nothing is constructed, no draw is spent, and every maze md5 is
unchanged by a code path that never executes.

`len` and `turns` are the element's own domains, read off the element rather than
restated. A parameter the spec **names** is an override that spends no draw; one
it omits is drawn. That is why a value at its default is still spelled out here,
unlike in `areaSpec`: the absence is the difference between a drawn parameter and
a given one.

`binds` is the binding's own knob. At `item` (default) the gadget's area is the
**only** one that may hold a key symbol, so the gadget guards whatever the graph
places; at `any` it competes with every other area and guards a symbol in about
one accepted run in seven.

### How it goes in

The draw order, which is the level's identity:

1. the goal cell — unchanged, the room stream's first draw
2. `instantiate` — the element's parameters, in schema order
3. the **site** — one `pick` over the snug rectangles (`w, h = len + 4`) whose
   one-cell ring is on the grid and holds neither the entrance nor the goal
4. `construct(site)` — the gadget's geometry, from the same stream
5. the carve — the same backend with the same parameters, at a moved position
6. the composite — no draws
7. the area block — partition, graph, realisation, as before

The carve runs over the whole grid exactly as it always has; its answer **inside
the reserved rectangle is discarded** and the element's tiles are written over
it. The ring is written as wall except the one cell the entry port faces, and the
connector then joins that mouth with the shortest tunnel to floor the entrance
already reaches — never entering the reserved rectangle. The **exit mouth is
sealed**: with it open the player walks round the outside of the site and the
door stops being a cut on about 30% of levels.

Everything is then checked on the way out, and every failure is a **graded
refusal** that leaves the carved room intact: `no-site-fits-this-room` ·
`the-entry-port-cannot-be-joined` · `the-elements-demand-is-not-met` ·
`the-reserved-rectangle-seals-the-room` · `the-guard-is-not-a-cut-of-the-level`
· the element's own `TURNS_EXCEED_LEN` / `SITE_TOO_SMALL` / `WALK_NOT_FOUND`.

### The guard

The gadget's area is fed to the partition as a **declared** area (`E0`,
`kind: 'element'`) — a one-wide push lane contains no all-floor 2×2 square, so
the blob rule would never find it. The symbol the graph gives that area is
realised as `flag_K{n}` (`kind: 'flag'`) on the cell one step **beyond**
`door_A0`, given rather than drawn: a drawn cell of the gadget's own area is as
likely to land in front of its guard as behind it. The doors of that symbol are
then cleared by the flag rather than by a key.

> `flag` realisation is scoped to the **guarded** symbol. Making it the general
> default would rename `key_K0` in every `--areas=` payload the area arc shipped.

For the level-n terrain flood, `door_A0` belongs to the key level of the flag it
guards. The guard's own cut is not that flood's claim: it is checked separately
with the door treated as wall, and finally by the skeleton solve over block
state, whose claim is **a block was on the button at the instant the player first
entered the door cell** — not how many pushes the plan spent.

### What it costs

Per placed gadget, on `summary.elements[]` beside the area symbols' rows:
`pushes`, `planLength` and `nodes` from the **plan**, `len`/`turns`/`cells` from
the geometry, plus `tunnel` (how far the connector had to dig) and
`carveOverwrote` (how many of the element's cells the carve had written
differently — the witness that the registration decided anything).

A record of a placed element is `{params, site, drawsAtConstruct}` plus the
level's seed: advance a fresh stream by `drawsAtConstruct`, instantiate with every
parameter as an override, construct on the recorded site. `{params}` alone is not
a record — the site pick draws between `instantiate` and `construct`.

### On the lab page

`?elements=` reaches the model like every other spec (see *The URL grammar*), and
the page draws the gadget with a **second sibling overlay**,
`mazeElementOverlay.drawElementOverlay(ctx, model.elements, {tilePx, layer,
blocks})` — called after `drawWorld` and after the area overlay, for the same
reason that one is a sibling and one more that is this layer's own: **the block
moves.** `world.blocks` is the level's initial layout and `state.blocks` is where
the blocks are mid-solve, and a renderer whose contract is *"draw this world"*
has nowhere honest to put the second. `drawWorld`'s seven captured op-log
fixtures are untouched and the element overlay brings its own.

What it draws, per placed gadget: the **site** outlined; the **tunnel** — the
cells the connector dug to reach the entry port — filled and dashed in its own
hue, because it can be 28 cells long and a reader would otherwise take a straight
corridor for an artefact of the maze backend; the **block** as a square, the
**button** as a ring that FILLS while something stands on it, the guard **door**
bordered and the **flag** as a pennant; and a stub per **port**, green in and
orange out. Nothing is labelled per cell — the ids are named once each in the
legend under the canvas, with what the gadget guards and what it cost. A REFUSED
element prints the binding's own reason where the gadget would be and still shows
the carved level. ⚠ Most 11×11 seeds refuse and that is the honest state;
`guard;len=2;turns=1` at 15×15 is the friendliest demo (≈57% placed).

**SOLVE steps through the plan.** `mazeLab.planFrames(state, solved)` replays the
oracle's plan through the engine's own `step` and returns one frame per position,
each carrying the player's cell and `state.blocks` verbatim; `⏮ / ◀ STEP /
STEP ▶ / ▶ PLAY` walk them and the overlay is handed the frame's block layout, so
the block visibly moves onto its button and the button fills. The readout
publishes the same array the overlay was handed (one function answers *"which
layout is on screen"*), and the page names how many DISTINCT layouts the whole
plan visits — one means the walk pushes nothing.

The **edit palette** gains **block / button / flag**. Each writes the library
entry without which the mechanism is inert — a button with no `buttonLib` entry
holds nothing, a door with no `obstacleLib` entry opens for everybody — and the
ids come from the binding's own allocator (`procgenCore/elements.guardIdsFor` /
`flagIdFor`), never a private scheme, so a hand-built gadget and a generated one
are the same thing. Placing a button also REGISTERS its `door_A{n}` entry so the
obstacle brush can put that door where the builder wants it; ⚠ put it at least
**two** cells from the button, or the player presses it themselves and walks
straight through.

## The maze lab page (`frontend/modules/mazeRoom/lab.html`)

A **standalone static page** — no frontend, no GL panel, no eventBus — that
generates, edits and solves maze levels from URL parameters alone. It is the
maze's counterpart of `seedlingDemo/watch.html`, and what the two have in
common now lives in `frontend/modules/procgenCore/`
(`urlParams.js`, `labView.js`, `paletteRoster.js`, `pageLifetime.js`) rather
than being written twice.

```
python3 -m http.server 8000        # from the repo root
http://localhost:8000/frontend/modules/mazeRoom/lab.html?seed=3&count=4&run=1
```

Its headless half is `mazeLab.js` (URL reader/writer, the three modes' logic,
the payload); its DOM arm is `mazeLabView.js`; its unit tests are
`mazeLab.test.js`.

The room's edits are also available as an **`editCore` adapter** — `mazeRoom/mazeEditAdapter.js` says the maze in the six words the edit core asks for (`architecture.md` § "The edit core"), which is what gives the maze a base+ops identity, grouped strokes, rectangle copy/paste and flood fill. It is a wrapper: the ops are `EDIT_OPS`, the application path is `applyEditOp`, and `equal` is `procgenMaze.worldsEqual` (the comparison `applyEdit` already made, extracted rather than re-spelled).

⚠ Two bounds it ships with, both pinned by tests: a pasted `setButton` carries its RESOLVED index and the engine does not refuse a duplicate, so a copied gadget gives two cells the same door; and the entrance is a singleton, so a paste carrying it MOVES it.

### The three modes

A `?source=` selector switches between them **in place** — no reload — and each
switch starts a new page lifetime (`procgenCore/pageLifetime.js`) so the arm
being left drops its listeners.

| mode | what it does |
|---|---|
| `generate` (default) | the loop, in the page. STEP places one template and re-solves; RUN-ALL runs to the target or to SATURATION. The generation pane shows every attempt with its outcome word (`KEPT` / `REVERTED` / `NO_ANCHOR` / `ILLEGAL_PLACEMENT`) and the oracle's **verbatim** refusal. A catalogue lists what the palette can generate, by family; unticking a family RESTRICTS the roster the run may draw from, and ATTEMPT on a row runs one directed attempt for that template. |
| `edit` | `mazeRoomEditor.js`'s palette — floor / wall / entrance / item / obstacle / **block / button / flag** / erase — applied to the clicked tile. Every edit lands on a **clone**, so UNDO is a pop of a world stack and the level the page says it generated is never rewritten underneath it. |
| `solve` | `mazeOracle` on the world now on screen, with the plan drawn over the room: SOLVED / REFUSED / BUDGET_EXHAUSTED, reason verbatim. |

A step-*k* level **is** `generate-maze-level.mjs --seed=S --count=k`, byte for
byte, because it is the same call — the browser row asserts that across the two
runtimes.

### Identity and certification

The URL carries a **run somebody could type**; it does not carry manual edits.
An edited level's identity is the **payload** (`?gen=` / the save box /
download-upload), and the page says so the moment there are edits:

```
seed 3 · maze-v1 · 11x11 · step 4, then 2 manual edit(s)  ·  palette: maze-v1 …
UNCERTIFIED — nothing has solved the world now on screen  ·
⚠ the URL is NOT a reproduction after edits — the PAYLOAD is
```

**Editing never bypasses the oracle.** Any edit that *changes the world* drops
the certification, and the readout says UNCERTIFIED until SOLVE puts a verdict
back. An edit the editor refused, or one that changed nothing (`Tile (3,3)
already floor.`), is not an edit: `applyEdit` compares the serialised worlds
rather than trusting the editor's own descriptor. A loaded payload is
uncertified whatever the file claimed — this page's certification is its own
oracle's answer or nothing.

### The URL grammar

Shared with `watch.html` through `procgenCore/urlParams.js`:
`?source=` `?seed=` `?biome=` `?count=` `?tries=` `?k=` `?anchortries=`
`?families=` / `?templates=` `?run=1` `?gen=`.

⚖ **THE URL DIET (constructive-mode slice 12, 2026-08-15).** `?directed=` is no
longer a URL parameter on either page and **refuses by name**, with the way in in
the sentence. A URL names the LAUNCH parameters a person types; a directive list
is a CONSTRUCTION, and the PAYLOAD carries it — `?gen=` and the host's
`procgenLab:load` replay `payload.directives` (in order, at the same indices, so
`directiveSeed`'s index-as-salt is untouched) and then `payload.edits`. The
GRAMMAR is unchanged and still spoken by `generate-seedling-level.mjs
--directed=` and by every payload's `instance` labels; only the address bar
dropped out. ⛓ `certified` is the TRI-STATE Seedling uses: `null` = *nobody has
asked*, `true`/`false` = the oracle's own answer, with `false` reachable only
from a REFUSED SOLVE.

⛓⛓ **AN EDIT IS AN OP (elements arc 2, slice 4), so an EDITED payload REPRODUCES
too.** Slice 12 had to refuse one: an edit was recorded as a DESCRIPTION (cell +
palette type) while `MazeRoomEditor` read `selectedItemId`/`selectedObstacleId`,
which the record did not carry, so a fold would have placed *a different body at
the right cell*. The record is now a closed op —
`{op:'setTile'|'setEntrance'|'setItem'|'setObstacle'|'setBlock'|'setButton'|
'setFlag'|'clearEntity', x, y, id?, index?, tile?}` — with every allocated index
RESOLVED into it, exactly as a recorded directive carries its drawn parameters.
`?gen=` and `procgenLab:load` now replay **ladder → directives → edits**, all
three through the same functions a press uses (`applyDirective`,
`mazeRoomEditor.applyEditOp`). ⚠ A payload whose edits predate the op shape
still refuses, by name, and points at the LOAD box — which takes any level as it
stands.

⛓⛓⛓ **THE PER-PARAMETER TABLE IS GENERATED NOW** (PROCGEN DOCS · P3a,
2026-08-18) — every parameter of BOTH lab pages, one block each, with this
page's own reader and writer named, the default this page's reader answers on an
empty search, and whether the writer WRITES or DELETES it at that default:

> **<https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html#section-url>**

⛔ **Do not re-type it here.** It is generated from `procgenCore/urlParams.js`
and `mazeLab.readLabParams`/`writeLabParams` by
[`scripts/procgen/generate-procgen-reference.mjs`](../../../../scripts/procgen/generate-procgen-reference.mjs)
and gated by `--check` (regenerate = no diff). What stays HERE is the ARGUMENT —
why each maze-only parameter exists at all:

- **`?width=` / `?height=`** — the ROOM. The v1 palette on the default 11×11
  room reverts **nothing** over seeds 1–12; reverts appear at 5×5/target 12 and
  saturation at 4×4. Without this the REVERTED and SATURATED panes are
  unreachable and a reader would conclude the palette refuses nothing. Try
  `?width=5&height=5&count=12&run=1`.
- **`?expansions=`** — the BFS **node cap**, and ⛔ never spelled `?tickbudget=`:
  Seedling's budget is denominated in solver *ticks* and these are two different
  quantities, so one word for both would be the two-spellings failure at its
  most expensive. The default never binds on a v1 level — the state space is
  `cells × 2^items` = 242 — so `?expansions=1` is how `BUDGET_EXHAUSTED` is
  reached on purpose.

`?biome=` selects the **palette** (`maze-v1` today), not a wall backend. The
maze's own biome vocabulary is `?skeleton=`; spelling it `?biome=` would have
been the real collision.

**`?skeleton=<kind>`** — the room the loop starts from, shared with `watch.html`
through `urlParams.readSkeleton`/`writeSkeletonParam`. The maze offers every
kind (it owns the simulator-bound backends); Seedling refuses `classic` and
`corridor` by name. Absent means `empty` — the open room — and the writer
**deletes** the parameter at the default rather than writing it, the same rule
the whole roster follows. An unknown kind refuses with the whole vocabulary; a
`;`-separated clause carries the kind's **parameters** (slice 7 — see *Kind
parameters* above): `?skeleton=rooms;minRoom=2;chambers=1`, keys in declaration
order, and a value **at** its default is not written at all. An undeclared key
and an out-of-domain value each refuse by name, with what the kind declares. The
generate form carries a **skeleton selector** plus one control per declared knob
(mounted from the catalogue's own schema, re-mounted at defaults on a kind
change), and changing either RESETS the ladder to the skeleton and says so — the
room a ladder is built in is part of the level's identity, exactly as the seed
is. Try `?seed=3&count=3&skeleton=winding&run=1` and
`?seed=3&count=0&skeleton=winding;chambers=2`.

**`?areas=<keys>[;k=v]` and `?require=K0,K1`** — the area graph and the
rule-directed directive, one reader and one writer each in `urlParams.js`,
parsed by the one `areaSpec` codec the CLIs already speak. Absent means
`{keys: 0}` / no directive, and both writers DELETE at that value and rewrite in
place. `?require=` is its own parameter rather than a `?directed=` verb because
it constrains the AREA GRAPH — built once with the model, before pass 2 exists —
and is a property of the whole run, not of an attempt. Try
`?seed=1&width=15&height=15&skeleton=rooms&areas=1&require=K0&count=2&run=1`,
and `?areas=1&require=K1` for the refusal.

**`?elements=<name>[;k=v]`** — the element, one reader and one writer in
`urlParams.js`, parsed by the one `elementSpec` codec both CLIs and the sweep
already speak. Absent means `none`: no site is drawn, nothing is constructed and
no draw is spent, so a link without it produces byte-for-byte the level this
page produced before elements existed. The writer DELETES at `none` and rewrites
in place. ⚠ **Unlike every other spec on this page it KEEPS a parameter the
caller named even at its default value**, and that absence is load-bearing: a
NAMED parameter is an override that spends no draw and an OMITTED one is DRAWN,
so `guard` and `guard;len=3` are different runs even when `len` resolves to 3.
The form therefore offers *any (draw it)* beside each declared value. Try
`?seed=2&width=15&height=15&skeleton=rooms&areas=1&elements=guard;len=2;turns=1&count=2&run=1`.

### `drawWorld`'s `view` contract

The panel's canvas draw was extracted to `mazeRoomRender.js` so the panel and
the page paint one picture: `drawWorld(ctx, world, view)`. **`view` is the whole
input** — every `this.*` the panel's `_drawWorld` used to read is now a named,
required field, and `assertView` refuses a missing one by name rather than
defaulting it (a default for `isTileVisible` is "everything is visible", which
is a picture chosen by the renderer under a caller's name).

| field | meaning; `null` means |
|---|---|
| `tilePx` | tile side in canvas pixels — not defaulted; the caller sizes the canvas |
| `playerPos` | `{x,y}` \| `null` = draw no player |
| `inventory` | `Set` — decides whether a door reads cleared, and (outside playback) whether an item is still on the floor |
| `isPlayback` | playback tracks pickups per LOCATION, dev flow by inventory — the flag chooses, it does not merge |
| `checkedLocations` | `Set` — playback's per-location pickup truth |
| `ruleEvaluator` | `(rule) => boolean` \| `null` = the library's local subset evaluator |
| `fogEnabled` | boolean |
| `isTileVisible` | `(x,y) => boolean`, consulted only when `fogEnabled` |
| `seenTiles` | `Set` of `"x,y"` \| `null` = the fog blackout covers everything |
| `isExitVisible` | `(exit) => boolean` — discovery filter (playback only) |
| `isLocationVisible` | `(name) => boolean` — discovery filter (playback only) |
| `isConsumableCollected` | `(x,y) => boolean` \| `null` = nothing tracks them. The panel closes its region id into this; the page has no regions |

`plainView({tilePx})` is every filter off — what a page wants for a world it
just generated. The extraction's gate is `mazeRoomRender.test.js`: the unit
runner is `environment: 'node'` with no jsdom and no `canvas` package, so
nothing can rasterise, and the gate compares an **ordered draw-op log** (every
call and every property assignment, hashed) through a recorder that *throws* on
any member it does not model. The log records every state mutation as well as
the geometry, so equal logs ⇒ equal pixels — a stricter gate than a pixel hash.
Seven fixtures were captured from `_drawWorld` before the extraction and pasted.

### The browser row

```
node scripts/procgen/check-maze-lab.mjs
node scripts/procgen/check-maze-lab.mjs --host=http://localhost:8000
```

It brings its own static server on a free port (`serveRepoRoot`) and **has no
skip condition** — the rows that skipped when no dev server was up once hid a
page that could not load at all for two rungs. It asserts the import graph has
zero `node:`/bare specifiers, the page loads with zero console errors, the
browser reproduces node's level and trace byte for byte, STEP advances one rung
and the *pane* shows the outcome word, RESTRICT reaches the loop, the directed
attempt reports a named outcome with its keep-kind sentence, a click on a cell
the row computes itself paints that cell and the identity line says
"1 manual edit(s)" + UNCERTIFIED, SOLVE re-certifies while a sealed entrance
comes back REFUSED with the oracle's own text, the payload round-trips through
the save box, and the URL is a fixed point *whose literal values are asserted
against numbers the row states* (a fixed point tests self-consistency, never
correctness).

### Hosted in the frontend

The page also opens **inside the frontend**, in a `procgenLabPanel` Golden
Layout panel, and is byte-for-byte the same document either way. The panel
mounts

```
./modules/mazeRoom/lab.html?iframeId=procgenLab-maze-1&hostOrigin=<host origin>
```

and talks to it over the existing `iframeAdapter` bridge in the `procgenLab:`
vocabulary — `load` / `navigate` / `requestState` in, `ready` /
`stateChanged` / `levelChanged` / `selectTile` out. **The vocabulary lives once**,
in `frontend/modules/procgenCore/labProtocol.js` (event names, payload shapes
as frozen field lists, one `assert*` per event); the panel and its README are
`frontend/modules/procgenLabPanel/`.

The in-page half is `mazeLabBridge.js`, **dynamically imported and only when
`?iframeId=` is present** — a standalone load never fetches it, which
`check-procgen-lab-hosting.mjs` measures on the network. `window.__mazeLab`
gained one field for it: `loaded`, true when the state came from a payload
rather than out of the loop.

⚠ A canvas click publishes `procgenLab:selectTile` in **every** arm, not only
in EDIT: the event means *"the reader pointed at this cell"*, and the page's
own edit behaviour is unchanged.

### The area-graph overlay

`?areas=` and `?require=` ride the page's one reader/writer like every other
parameter (absent is the default, the writer deletes at it and rewrites in
place), and the page draws the graph **over** the grid with
`mazeAreaOverlay.drawAreaOverlay(ctx, model.areas, {tilePx, layer})` — a
SIBLING of `drawWorld`, called after it exactly as the plan and hover overlays
are, because a graph is a fact about the MODEL and the panel (the renderer's
other caller) has no model at all. `drawWorld`'s captured op-log fixtures are
therefore untouched, and the overlay brings its own.

The **layers** are cumulative and the `LAYER ▶` button steps through them:
`off` → `partition` (each area shaded by its own hue; the synthetic
entrance/goal areas outlined dashed rather than filled, because they are not
chambers) → `locks` (the shading switches to the key-level ramp, every door cell
gets a border, graphify edges are dashed between area centroids) → `keys` (key
cells ringed, the solution path drawn through the centroids) → `all`. The layer
is a VIEW setting: it re-draws, it never resets the ladder, and it is not in the
URL. Changing the spec or the directive DOES reset the ladder, on the same terms
a skeleton change does — the graph is built with the model.

Nothing is labelled per cell (door counts reach 50 on a 15×15 sweep cell); the
symbols are named once each in the **legend** below the canvas, with the door
count, the areas they lock and where the key is. A refused GRAPH prints the
module's own reason where the level would be and still shows its carved level —
that level is what the run produced, it simply has no locks. A refused
DIRECTIVE shows **no level and no payload**: the run did not produce what was
asked for. ⚠ At 11×11 with two keys most seeds refuse, and that is the honest
state rather than something to tune away.

### What is not here yet

- ~~**the yield table and the connectivity pre-check**~~ — both LANDED
  (constructive-mode slices 6/6b; the pre-check is in `refusalAt`, see *The
  connectivity pre-check* above, and `scripts/procgen/sweep-yield-table.mjs` is
  the instrument every procgen arc measures with).
- **the cut-vertex rule ON `door-key`** — still open, and the only item of the
  three that is. The door LAW exists (arc 3 slice 2, Seedling, substrate-neutral)
  and the AREA GRAPH's own locks are cuts by construction (148/148), but nothing
  asks the law of the maze's pass-2 `door-key`, so one the walk can walk around
  is a KEPT candidate that happens to be decoration today. Named as residue in
  the generation review (2026-08-17, §3 row 7) and unmeasured.
- ~~**kind parameters**~~ — landed in slice 7; see *Kind parameters* above.

## The action queue (`mazeRoomQueue.js`)

A tile-level action queue with a Cavernous-2-style icon-row UI in the panel. Three verbs: `move` (N/E/S/W — block pushes ride the same verb via a content module's `onMove` hook), `wait` (one tick, spacebar), and `locationCheck` (explicit check at the current tile — used by saved/replayed queues and loops-delegation expansion; direct keypresses rarely emit it because checks fire as a side effect of stepping onto a location tile). Execution is synchronous, and the queue is what backs the maze's `customQueues: true` loop-mode capability.

The per-tile verbs make the maze the reference **fine-grained** substrate under the loop-recording capture contract: its visit recorder (in `mazeRoomUI.js`) captures the whole visit as one interleaved stream — `move`/`wait` inputs *and* the queue-grade `locationCheck`s — stashes it for loops to pull (`takeLastRecording`), and replays it via `replayActions`, crossing the recorded departure exit itself after the interior drains. Loops projects the coarse subset of that stream into the block's queued interior. See [Loop Recording and Block Modes](./loop-recording.md).

**Loop delegation and the Bot radio (M6).** The maze is the **delegation** solver — the odd one out among the solver substrates. On a `manaEnabled` region it declares `sharing.mana.loopActionDelegation`, and a **Bot**-mode block hands the current action to the panel (`loops:substrateActionBegan`), which walks it tile-by-tile through the visualizer, charges per tile natively (`_loopsDrivenAction`), and reports `loops:substrateActionCompleted`. This is a genuinely different driver from the `walkTo` path the other solver substrates use: the maze *has* a `walkTo` on its controller, but it drives the **visualizer** (a separate position tracker), while delegation drives the charging panel engine. M6 unified the *trigger* (the Bot radio, `regionSolver(region) → 'delegation'` here) and kept both drivers. Before M6, delegation fired from a pre-dispatch tick for any non-Manual block, which silently shadowed Record and Playback on these regions; that latent bug is gone by construction now that only a Bot block initiates. **Bot × Instant is deferred for the maze**: the controller's `instant()` drives the visualizer, but a delegated walk is tracked through that same visualizer's per-tick change stream (step buffer, per-tile charging, stuck detection), so collapsing its ticks touches the two-position-tracker split — `regionBotHonorsInstant` is false for the maze, and the checkbox is withheld. Not impossible; out of scope for M6.

## Content modules (hazards)

Content modules add gameplay content to a region without touching core substrate code. The registry (`shared/procgen/contentModules/registry.js`) sits alongside the wall-backend registry and shares its shape; a module declares any subset of the hook contract:

- **Build time:** `generate(world, opts, rng)` (called after wall layout and placement), `serialize(world)` / `deserialize(sidecar, world)` for the per-region sidecar payload, `procgenSettingsSchema` for auto-generated authoring controls.
- **Runtime:** `tickRuntime` (advance one turn), `validateMove` (veto a proposed move — multiple modules' vetoes are conjunctive), `onMove` (side effects after an allowed move), `render` (canvas overlay between the substrate render and the player sprite), `resetOnEntry` (region content is fresh on every entry).

The maze's registry entry exposes `applyContentModules`, which the pipeline engine calls after the base region build; substrates that don't declare it skip the pass.

The one shipped content module is **hazards** — patrolling dangers that cycle along generated paths. It is split into three pure pieces: `hazardPathGen.js` (geometry only — the tile sequence a hazard cycles along), `hazardRuntime.js` (cycle position, facing, move-validity checks), and `hazardRender.js` (overlay drawing). Pathfinding is hazard-aware and wait-aware: the autopather can plan routes that deliberately wait out a hazard's cycle.

## The autopather (`mazeAutopather.js`)

BFS pathfinding over maze worlds, used by the playback controller, the queue, and exploration UI. Target kinds: a specific tile, an exit, a location, or `closestUnexplored` (the nearest walkable un-seen tile, given `opts.seenTiles` — walking onto it clears fog around the new position, priming the next leg). Returns `{ steps, length }` including both endpoints, or `null` when unreachable. Walkability is inventory-aware when an inventory is provided (tiles holding obstacles the inventory can't clear block) and geometry-only otherwise, which is the mode procgen-time callers use.

## Panel and runtime

The panel (`mazeRoomUI.js`, component `mazeRoomPanel`) subscribes to `maze:loadRegion`. A load event that arrives before the panel mounts is buffered (`pendingLoadRegion` in `index.js`) and drained by the panel constructor — one of the standard init-race catch-ups. On load the module self-activates its panel unless the loops panel has "Keep this panel focused" set while its queue is driving.

Around the core panel:

- The **playthrough visualizer** (`mazeRoomVisualizer.js`) auto-walks the region with its own simulated state — see [Playback and Debugging Tools](./playback-and-debugging.md#per-substrate-visualizers).
- The **editor** (`mazeRoomEditor.js`) edits a loaded region in place with a tile palette: floor/wall, the entrance, items (with AP-canonical location names), obstacles, and — since elements arc 2 — a pushable **block**, a **button** (with its `buttonLib` entry and its matching `door_A{n}` registration) and a **flag** (an item declared `kind:'flag'`). Every brush produces a closed **op** (`applyEditOp`), which is what makes an edit list replayable. Exit placement and logic-gate editing are not part of its palette.
- The **game-data inspector** is a separate read-only module/panel (`frontend/modules/mazeGameDataPanel/`).

## A real game's map as maze regions

Besides generating worlds, the maze substrate can be handed one: the region
atlas's **maze projection** (`procgenPipeline/regionAtlasMazeProjection.js`,
plan `CC/docs/plans/region-atlas-plan.md` Phase 5b, preset
`seedling_atlas_maze`) compiles a marked real-game region into one maze world
per AP sub-region. The sub-region's own zero-item-reachable cells are floor and
everything else is wall, a crossing between sub-regions is an exit tile carrying
a `clear_set_type: 'rule'` obstacle with the atlas's access rule, and a location
is an item overlay with its AP location name. Nothing in mazeRoom knows about
it — the projection speaks the ordinary sidecar shape, which is the point.

Two payload facts are load-bearing for **any** hand-built or projected maze
sidecar, not just that one:

| | |
|---|---|
| **`exit_id` IS `exitName`** | Every generated maze sidecar holds this (`{exit_id: 'exit_1', exitName: 'exit_1'}`) and it is not cosmetic. `createWorld` keys `world.exits` on `exit_id`, the panel publishes `user:regionMove` with `exitName`, and `procgenPlayer.handleRegionMove` resolves the arrival by asking the SOURCE world for `exits.get(exitName)` and reading its `targetExitId`. Key them apart and that lookup misses **silently**: `targetExitId` is never read and every arrival falls back to `world.entrance` instead of the crossing the player walked through. (The flash family differs — its `deserializeWorld` keys on `exitName ?? exit_id` and its glue resolves an arrival against `exits[].exit_id`.) |
| **Semantics live in the overlays** | The tile grid is binary (floor/wall). Anything conditional is an obstacle, an item, a consumable or a mana tile on top of a floor tile — never a new tile value. |

## Registry entry

The maze entry implements the full procedural build-time contract (`generateRegionCore`, `placeFromItems`, `placeFromRules`, `extractPathsAndObstacles`, `serializeWorld`, plus `applyContentModules`) and the full loop-mode surface (`regionMove`/`locationCheck`/`explore` queue actions, manual play, custom queues, `record`/`playback`/`instant`, and the `takeLastRecording` recorder hook). Field-by-field detail: [Substrate Registry Reference](./substrate-registry.md).

## Related documentation

- [Architecture](./architecture.md)
- [Substrate Registry Reference](./substrate-registry.md)
- [Loop Recording and Block Modes](./loop-recording.md)
- [Playback and Debugging Tools](./playback-and-debugging.md)
