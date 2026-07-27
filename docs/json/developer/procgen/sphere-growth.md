# Sphere-Driven Growth

Sphere growth is the primary procgen driver: instead of growing a world and then discovering its progression structure, it **plans the progression first** — which items belong to which sphere — and then grows a world guaranteed to realise that plan. The plan doubles as a verification oracle, so every generated world ships with a proof that its progression matches the intent.

"Sphere" follows Archipelago's spoiler-log convention (1-indexed): sphere-s items sit at locations that become reachable exactly when all items from spheres < s are collectable.

Code: `frontend/modules/procgenPipeline/spherePlanner.js` (the plan), `procgenPipelineEngine.js` §"Sphere-driven growth driver" (`buildSphereTree` / `growSpheres`), `sphereConfigHooks.js` (config assembly), `sphereSteps.js` (the stepped runner).

## The sphere plan (`spherePlanner.js`)

`planSpheres` is a pure function: item pool + parameters → an item→sphere assignment. Deliberately, the plan fixes **item→sphere only** — region counts per wave, filler counts, locations-per-region, and topology are grower parameters, not plan content. Item identifiers are opaque to the planner (AP item names for bounce, itemLib ids for maze); substrates map at their own boundary.

Sizing and placement knobs:

- `sphereCount` or `itemsPerSphere` (exactly one) — how many spheres.
- `pins` — pin all instances of an item to a sphere.
- `exclusiveSpheres` — a sphere containing *exactly* the named items, closed to distribution (e.g. bounce's entry sphere holding a single arrow).
- `victoryItem` — convenience pin of all instances to the final sphere.
- `gateableItems` — the constraint that makes plans realisable: spheres 1..N−1 are the world's *gate vocabulary*, so when the gate-owning substrates are restricted (a bounce-only run can only gate on its six ability items), every sphere 1..N−1 must carry at least one gateable item. The planner enforces this and fails loudly when the pool can't support it. Final-sphere items never gate anything.

**The plan is the oracle.** The same assignment that drives growth is the expected sphere log: after compilation, a fixpoint sweep over the emitted `rules.json` (`computeItemSpheres`) must reproduce the plan exactly (`compareSpheresToPlan`), and so must the Python sphere log for the canonical seed. The CLI's compile step exits non-zero on a mismatch.

## The stratification rule and the sphere tree

`buildSphereTree` is pure bookkeeping: given the plan, it decides **every region up front** — wave, items, entry gate, parent, side, substrate — before any geometry exists. The invariant that makes the plan an exact oracle is the **stratification rule**: wave 0 hosts sphere-1 items behind no gates; wave k regions attach behind entry gates containing at least one sphere-k item. Fillers carry no items. Because the whole tree is decided first, every region is built once with all of its exits known — nothing is stubbed and later walled off.

Gate composition is single-item per gate (v1). Host selection respects substrate gate compatibility through registry hooks: `gateableItems` limits a substrate's gate vocabulary, and `canHostExitGates(existingGates, newGate)` lets a substrate veto structurally unrealisable combinations (bounce's arrowless-exit rules). Gates are handed to substrates as term arrays `[{ item, count }]`; bounce realises non-ability (and count > 1) terms as authored bridge-evaluated locks rather than geometry, so **any item can gate any substrate's exits** — foreign items included, which is what makes mixed-substrate sphere worlds work.

## Realisation (`growSpheres`)

The tree is realised in wave order on a Grid, using the same machinery as the other drivers: cell adjacency where possible, teleporters where not, back-exits, `stitchGrid` to resolve exit targets, and `wallOffUnusedExits` at the end. Maze regions realise their gates via `placeFromRules` (the requirement-targeted placement path); zone-based substrates must expose `generateZoneForSpecs` (bounce's requirement-targeted zone generation — see [Bounce Substrate](./bounce.md#sphere-growth-integration)).

## The three-phase split and the rng discipline

For the stepped pipeline, the tree build splits into three composable phases surfaced by the panel as ②a/②b/②c. The split is byte-identity-preserving *because of how the seeded rng is consumed*:

- **②a Allocate** (`allocateSphereTree`) — draws the filler-wave assignments up front (the only rng this phase consumes) and computes the deterministic region count per wave (`ceil(items / maxItemsPerRegion)`, min 1).
- **②b Topology** — the interleaved per-region loop: substrate pick, host/gate wiring, side assignment. Region N's host pick depends on regions 1..N−1's consumed sides and child gates, so substrate and wiring cannot be separated without reordering the shared rng stream — they stay fused.
- **②c Items** — pure round-robin, consumes no rng.

`buildSphereTree` recomposes the three on one threaded rng, so the unedited stepped pipeline reproduces the single-pass output exactly. This is the concrete instance of the byte-identity contract described in [Architecture](./architecture.md#the-stepped-pipeline); the step-boundary rng snapshot rules live in `sphereSteps.js`'s header. Per-sphere batching (`spheresPerBatch`) turns the ②a→③ middle into a per-batch loop; the default (one batch covering every wave) is byte-identical to monolithic `growSpheres`, while smaller batches grow sphere-major and diverge by design.

## Pre-built content: region libraries and region atlases

Two kinds of content source can fill sphere slots with regions that already exist instead of generating one:

- **`library:<id>`** — a region-library pack of interchangeable synthetic regions. Its document rides on `growthParams.substrateConfig['library:<id>'].libraryDoc`; each gate is overlaid as an `access_rule` on the entry's exits (logic-looser-than-physics). See [region-library-f6-plan.md](../../../../CC/docs/plans/region-library-f6-plan.md).
- **`atlas:<game>`** — a *region atlas* pool: pieces of a **real game's map**, projected into the maze substrate. Its document rides on `growthParams.substrateConfig['<game>'].atlasDoc` — keyed by the game, not the source id, because that is the install seam the atlas arc fixed. Built by `scripts/procgen/region-atlas-pool.mjs`; see [region-atlas-plan.md](../../../../CC/docs/plans/region-atlas-plan.md) Phase 6.

An atlas entry differs from a library entry in ways that are all consequences of it being a *specific place*:

- It is placed **at most once** per world (two copies of the starting house would duplicate its location identity), and the placed region takes the **map's own name**.
- Its access rules are **authored**, carried in with the entry, and the driver's gate is **AND-composed** onto them rather than replacing them — overwriting would hand the player a route the real game charges for.
- Surplus exits are **pruned** (a real region has more ways out than a cell has sides) and the arrival is retargeted to the projection's own entrance tile, because the grid-mirror tile is very likely a wall.
- It offers exactly the locations the map was marked with, and they keep their in-game names.
- **v1 fence: an atlas region hosts no children.** Its exits are gated by the map's own rules, and the planner assigns child gates before the entry is fit-selected, so it cannot know whether an ungated exit will be available — declining keeps the stratification invariant exact.

### The sorter

`sphereAtlasSorter.js` is the ruled primary route. Rather than gating a placed region with a synthetic gate drawn from the plan, it reads the region's **intrinsic entry requirement** (the cheapest way in, priced by the atlas's own rows), **schedules** each required item into a strictly earlier sphere, and places the region in the wave that sphere gates. The gate is then both the real game's requirement and a proper sphere-*k* gate, so the sphere log oracle stays exact. It **mutates the plan** — and the plan is the oracle, so the caller must verify against the same object.

A requirement the gate vocabulary cannot carry (a disjunction, a count) is **declined with a reason**, never encoded wrong: three of the ten Seedling sub-regions sit behind "Progressive Sword OR Ghost Spear". Sorted atlas nodes carry no items — a real map offers exactly the locations it was marked with, which the item round-robin knows nothing about.

The fallback (`--atlas-placement quota`) keeps the older behaviour: the grower draws atlas regions like any substrate and gates them synthetically.

## Config assembly (`sphereConfigHooks.js`)

The panel and both headless CLIs build a sphere-growth config the same way: merge every active substrate's `defaultProcgenParams`, `prepareSphereGrowth`, and `buildRegionParams` registry hooks. Active substrates are those with a positive quota plus the start substrate. Centralising this keeps the drivers substrate-agnostic and stops the CLIs drifting from the panel — there is one assembly path.

## Editing and round-tripping grown worlds

A compiled sphere-growth `rules.json` carries enough structure in `procgen_metadata` (`sphere_tree`, `sphere_plan`) to rebuild a stepped-pipeline envelope from it (`rebuildEnvelopeFromRulesJson`), which is what enables re-growing and appending spheres to an existing world. Consumers that edit such a file must preserve those keys untouched — the APWorld Editor clones the full document rather than rebuilding from known fields for exactly this reason (`frontend/modules/apworldEditor/rulesUtils.js`).

## CLI

- `scripts/procgen/dump-sphere-growth.js` — plan, grow, compile, verify the oracle, dump to disk. `--atlas <pool.json>` installs a region-atlas pool (with `--quota atlas:<game>=N`); `--atlas-placement sorter|quota` chooses the route.
- `scripts/procgen/sphere-step.js` — the per-step driver (`plan → allocate → topology → items → regions → compile`), byte-identical to the dump script when unedited.

See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).

## Related documentation

- [Architecture](./architecture.md) — the drivers and the stepped pipeline
- [Substrate Registry Reference](./substrate-registry.md) — the gate-compatibility and param hooks
- [Bounce Substrate](./bounce.md) — requirement-targeted zone generation and gated braids
