# Sphere-Driven Growth

Sphere growth is the primary procgen driver: instead of growing a world and then discovering its progression structure, it **plans the progression first** — which items belong to which sphere — and then grows a world guaranteed to realise that plan. The plan doubles as a verification oracle, so every generated world ships with a proof that its progression matches the intent.

"Sphere" follows Archipelago's spoiler-log convention (1-indexed): sphere-s items sit at locations that become reachable exactly when all items from spheres < s are collectable.

Code: `frontend/modules/procgenPipeline/spherePlanner.js` (the plan), `procgenPipelineEngine.js` (the "Sphere-driven growth driver" section: `buildSphereTree` / `growSpheres`), `sphereConfigHooks.js` (config assembly), `sphereSteps.js` (the stepped runner).

## The sphere plan (`spherePlanner.js`)

`planSpheres` is a pure function: item pool + parameters → an item→sphere assignment. The plan fixes **item→sphere only** — region counts per wave, filler counts, locations-per-region, and topology are grower parameters, not plan content. Item identifiers are opaque to the planner (AP item names for bounce, itemLib ids for maze); substrates map at their own boundary.

Sizing and placement knobs:

- `sphereCount` or `itemsPerSphere` (exactly one) — how many spheres.
- `pins` — pin all instances of an item to a sphere.
- `exclusiveSpheres` — a sphere containing *exactly* the named items, closed to distribution (e.g. bounce's entry sphere holding a single arrow).
- `victoryItem` — convenience pin of all instances to the final sphere.
- `gateableItems` — the constraint that makes plans realisable: spheres 1..N−1 are the world's *gate vocabulary*, so when the gate-owning substrates are restricted (a bounce-only run can only gate on its six ability items), every sphere 1..N−1 must carry at least one gateable item. The planner enforces this and fails loudly when the pool can't support it. Final-sphere items never gate anything.

**The plan is the oracle.** The same assignment that drives growth is the expected sphere log: after compilation, a fixpoint sweep over the emitted `rules.json` (`computeItemSpheres`) must reproduce the plan exactly (`compareSpheresToPlan`), and so must the Python sphere log for the canonical seed. The CLI's compile step exits non-zero on a mismatch.

## The stratification rule and the sphere tree

`buildSphereTree` is pure bookkeeping: given the plan, it decides **every region up front** — wave, items, entry gate, parent, side, substrate — before any geometry exists. The invariant that makes the plan an exact oracle is the **stratification rule**: wave 0 hosts sphere-1 items behind no gates; wave k regions attach behind entry gates containing at least one sphere-k item. Fillers carry no items. Because the whole tree is decided first, every region is built once with all of its exits known — nothing is stubbed and later walled off.

Each gate holds a single item. Host selection respects substrate gate compatibility through registry hooks: `gateableItems` limits a substrate's gate vocabulary, and `canHostExitGates(existingGates, newGate)` lets a substrate veto structurally unrealisable combinations (bounce's arrowless-exit rules). Gates are handed to substrates as term arrays `[{ item, count }]`; bounce realises non-ability (and count > 1) terms as authored bridge-evaluated locks rather than geometry, so **any item can gate any substrate's exits** — foreign items included, which is what makes mixed-substrate sphere worlds work.

## Realisation (`growSpheres`)

The tree is realised in wave order on a Grid, using the same machinery as the other drivers: cell adjacency where possible, teleporters where not, back-exits, `stitchGrid` to resolve exit targets, and `wallOffUnusedExits` at the end. Maze regions realise their gates via `placeFromRules` (the requirement-targeted placement path); zone-based substrates must expose `generateZoneForSpecs` (bounce's requirement-targeted zone generation — see [Bounce Substrate](./bounce.md#sphere-growth-integration)).

## The three-phase split and the rng discipline

For the stepped pipeline, the tree build splits into three composable phases surfaced by the panel as ②a/②b/②c. The split is byte-identity-preserving *because of how the seeded rng is consumed*:

- **②a Allocate** (`allocateSphereTree`) — draws the filler-wave assignments up front (the only rng this phase consumes) and computes the deterministic region count per wave (`ceil(items / maxItemsPerRegion)`, min 1).
- **②b Topology** — the interleaved per-region loop: substrate pick, host/gate wiring, side assignment. Region N's host pick depends on regions 1..N−1's consumed sides and child gates, so substrate and wiring cannot be separated without reordering the shared rng stream — they stay fused.
- **②c Items** — pure round-robin, consumes no rng.

`buildSphereTree` recomposes the three on one threaded rng, so the unedited stepped pipeline reproduces the single-pass output exactly. This is one instance of the [byte-identity contract](./stepped-pipeline.md#the-byte-identity-contract); the rng snapshot rules at step boundaries and per-sphere batching are described in [Sphere mode](./stepped-pipeline.md#sphere-mode--six-steps).

## Pre-built content: region libraries and region atlases

Two kinds of content source can fill sphere slots with regions that already exist instead of generating one:

- **`library:<id>`** — a region-library pack of interchangeable synthetic regions. Its document rides on `growthParams.substrateConfig['library:<id>'].libraryDoc`; each gate is overlaid as an `access_rule` on the entry's exits (logic-looser-than-physics). See [region-library-f6-plan.md](../../../../CC/docs/plans/region-library-f6-plan.md).
- **`atlas:<game>`** — a *region atlas* pool: pieces of a **real game's map**, projected into the maze substrate. Its document rides on `growthParams.substrateConfig['<game>'].atlasDoc` (keyed by the game, not the source id). Built by `scripts/procgen/region-atlas-pool.mjs`; see [region-atlas-plan.md](../../../../CC/docs/plans/region-atlas-plan.md) Phase 6.

An atlas entry differs from a library entry in ways that are all consequences of it being a *specific place*:

- It is placed **at most once** per world (two copies of the starting house would duplicate its location identity), and the placed region takes the **map's own name**.
- Its access rules are **authored**, carried in with the entry, and the driver's gate is **AND-composed** onto them rather than replacing them — overwriting would hand the player a route the real game charges for.
- Surplus exits are **pruned** (a real region has more ways out than a cell has sides) and the arrival is retargeted to the projection's own entrance tile, because the grid-mirror tile is very likely a wall.
- It offers exactly the locations the map was marked with, and they keep their in-game names.
- **An atlas region hosts no children.** Its exits are gated by the map's own rules, and the planner assigns child gates before the entry is fit-selected, so it cannot know whether an ungated exit will be available — declining keeps the stratification invariant exact.

### The sorter

`sphereAtlasSorter.js` is the default route. Rather than gating a placed region with a synthetic gate drawn from the plan, it reads the region's **intrinsic entry requirement** (the cheapest way in, priced by the atlas's own rows), **schedules** each required item into a strictly earlier sphere, and places the region in the wave that sphere gates. The gate is then both the real game's requirement and a proper sphere-*k* gate, so the sphere log oracle stays exact. It **mutates the plan** — and the plan is the oracle, so the caller must verify against the same object.

A requirement the gate vocabulary cannot carry (a disjunction such as "Progressive Sword OR Ghost Spear", or a count) is **declined with a reason**, never encoded wrong. Sorted atlas nodes carry no items — a real map offers exactly the locations it was marked with, which the item round-robin knows nothing about.

With `--atlas-placement quota` the grower instead draws atlas regions like any substrate and gates them synthetically.

### Seedling as a leaf or a host (`flash_seedling`)

A quota of `flash_seedling` places a room of the real Seedling map, played in the Seedling wasm. It is a substrate quota, not an `atlas:` pool: the entry's own `generateZoneForSpecs` realises it. How the room is hosted and played is in [Flash Substrate](./flash.md); the sphere-growth rules are:

- **Gates are enforced by the host.** A Seedling door opens for anyone, so the host checks the door's rule (from the state manager's static data) and bounces a player who does not meet it back to the door's return spawn. This lets the room host children.
- **Hosting children is on by default.** `canHostExitGates` accepts another gate while the installed atlas has a room with a free door for it; `exitGateVeto` applies it; `backPortalGated` gates the door back to the parent on the entry gate, as for a maze room. Both read `regionParams.seedlingAtlas.hostChildren` (the config key `seedlingAtlasHostChildren`, default true). Set it false to make the room a leaf: no children, and the entry gate stays on the parent's exit.
- **Each real room is placed at most once per generation**, because it is a specific place. `prepareSphereGrowth` clears the placed set at the start of each generation. (Sphere growth does not consult `zoneCount`; that is the spiral's quota check.)
- **The tightest fit wins.** At realisation a node gets the unplaced room with the fewest locations, then fewest doors, then earliest declaration, so a filler node does not take the only room with a chest. A node that needs more doors or locations than any unplaced room has is refused with a message naming the knobs to change.
- **The atlas sorter does not place these rooms**: it needs authored door rules, and the starter Seedling atlas has none.

Committed example states in `frontend/modules/procgenPipeline/presetDefs.js`: `SEEDLING_SPHERE_ROOM_STATE` (a leaf, `seedlingAtlasHostChildren: false`) and `SEEDLING_ATLAS_HOST_STATE` (a host). `scripts/procgen/check-seedling-sphere-room-play.mjs` and `check-seedling-atlas-host-play.mjs` play them to completion.

### Seedling as a leaf, generated (`flash_seedling_gen`)

A quota of `flash_seedling_gen` places a room that the Seedling generator builds to the node's spec. Generation, re-rolls and room growth are covered in [Flash Substrate](./flash.md); the sphere-growth rules are:

- **Hosting children is on by default**, with the host enforcing each gate on a generated door as for a real room. `exitGateVeto` accepts any child gate and `backPortalGated` gates the door back to the parent. Both read `regionParams.seedlingGen.hostChildren` (config key `seedlingGenHostChildren`, default true); false makes it a leaf.
- **There is no at-most-once rule**: every node gets a new room.
- **The door back to the parent is added by the engine after the room is built**, so it is seated at serialisation. A room that cannot seat it without sealing an approach is re-rolled, and grows if the re-roll budget runs out.

Committed example states: `SEEDLING_GENERATED_LEAF_STATE` (a leaf holding `victory`) and `SEEDLING_GENERATED_HOST_STATE` (a generated start room hosting a maze child), played by `scripts/procgen/check-seedling-generated-leaf-play.mjs` and `check-seedling-generated-host-play.mjs`.

## Config assembly (`sphereConfigHooks.js`)

The panel and both headless CLIs build a sphere-growth config the same way: merge every active substrate's `defaultProcgenParams`, `prepareSphereGrowth`, and `buildRegionParams` registry hooks. Active substrates are those with a positive quota plus the start substrate. Having one assembly path keeps the drivers substrate-agnostic and the CLIs in step with the panel.

## Editing and round-tripping grown worlds

A compiled sphere-growth `rules.json` carries enough structure in its slot's `procgen_metadata[p]` (`sphere_tree`, `sphere_plan`) to rebuild a stepped-pipeline envelope from it (`rebuildEnvelopeFromRulesJson`), which is what enables re-growing and appending spheres to an existing world. Consumers that edit such a file must preserve those keys untouched — the APWorld Editor clones the full document rather than rebuilding from known fields for exactly this reason (`frontend/modules/apworldEditor/rulesUtils.js`).

## CLI

- `scripts/procgen/dump-sphere-growth.js` — plan, grow, compile, verify the oracle, dump to disk. `--atlas <pool.json>` installs a region-atlas pool (with `--quota atlas:<game>=N`); `--atlas-placement sorter|quota` chooses the route.
- `scripts/procgen/sphere-step.js` — the per-step driver (`plan → allocate → topology → items → regions → compile`), byte-identical to the dump script when unedited.

See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).

## Related documentation

- [Architecture](./architecture.md) — the drivers and the stepped pipeline
- [Substrate Registry Reference](./substrate-registry.md) — the gate-compatibility and param hooks
- [Bounce Substrate](./bounce.md) — requirement-targeted zone generation and gated braids
