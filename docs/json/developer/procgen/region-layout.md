# Region Layout

The Region Map's shared layout gives every world's display regions an integer cell in one unbounded, signed frame, with the start region at exactly (0, 0). It is deterministic and uses no rng. It takes stored `grid_cell`s when the world has them, otherwise a substrate hook's graph, otherwise the rules' own regions and exits. Code: `frontend/modules/procgenCore/regionLayout.js` (the layout and the groups) and `frontend/modules/procgenCore/regionLayoutResolve.js` (the resolution order and the generic adapter).

## The coordinate contract

- A position is `{ gx, gy }`, an integer cell. Coordinates are **signed and start-relative**: the start is exactly (0, 0) and nothing is min-shifted. Screen y points down, so +gy is below.
- Why: a region keeps its coordinates when something unrelated is added. A min-shift would move every cell whenever the minimum moved. A saved camera, a "centre on start" control, test assertions and before/after screenshots stay meaningful across layouts.
- Only a consumer that indexes arrays or pixels normalises. `procgenCore/setMapLayout.js` `canonicalLayout` returns the signed cells too (the start room is (0, 0)); its `frameOf` and `layoutCensus` subtract the minimum themselves, so the set editors draw exactly what they drew under the old min-shift (`scripts/dev/set-map-frame-dump.mjs` dumps both and they are byte-identical).
- Stored `grid_cell`s (generated presets) stay non-negative data. The resolver subtracts the start region's cell.

## `layoutRegions({ nodes, start, links })`

This is the set map's canonical layout (Seedling editor E3), keyed by id instead of room index:

- BFS from the start. Directed links are tried first, outbound before inbound.
- A directed link places its target one cell that way. For `CONSISTENT_RINGS` (4) rings it stays in that direction's quarter-plane.
- Otherwise the target takes the nearest free cell in a fixed ring order.
- A node no link reaches starts a new component at `(maxX + 2, minY)`.

`links` are `{ from, to, dir? }`, where `dir` is `N`/`E`/`S`/`W` or null. The function returns `Map<id, { gx, gy }>` in `nodes` order.

**Order is input.** There is no rng and no internal sort. The `nodes` array order decides the BFS tie-breaks and which unreached node starts the next component: the lowest position in `nodes`, as `canonicalLayout` used the lowest index. `links` order matters the same way. A string sort inside would put `"10"` before `"2"` and break the wrapper. Callers with unordered input sort it first: `regionLayoutResolve.js` sorts nodes numeric-aware (`level_2` before `level_10`) and links by (from, to, kind, dir).

`setMapLayout.canonicalLayout(graph)` is now a wrapper: room `i` becomes the id `String(i)`, the wrapper calls `layoutRegions` and maps back, with no min-shift (the (0,0)-origin follow-up, 2026-11-15). `regionLayout.test.js` keeps the pre-move function as an oracle over random graphs: the wrapper equals it translated by the start room's old cell. The drawn map did not move; only the position values did, so `seedlingSetMapLift.test.js`'s digests were re-recorded.

## Groups: `layoutGrouped(graph, { rule, gap })`

Links may carry a `kind` (`LINK_KINDS`): `'join'` (the default), `'down'`, `'up'` or `'warp'`.

- `join` is an **edge transition**: walking off one side of a region brings the player into the other, so the two belong side by side.
- `down`/`up` are stairs and pits.
- `warp` is any other non-spatial link: a doorway into a dungeon, an in-game teleporter. It is drawn, but it never joins two groups. It only places a group that has no `down`/`up` link at all (below).

- **The grouping rule** is a pure `(graph) → string[][]`, swappable by name in `GROUPING_RULES`. **R1** (the only one so far) is the connected components over `join` links. `down`/`up`/`warp` never join two nodes.
- **Inside a group**, `layoutRegions` runs over the group's own `join` links. The root is the start if the group holds it. Otherwise it is the group's first member entered by a `down` link, then by an `up` link, then its first member.
- **Between groups**, a `down` link a → b says a's group lies above b's, and an `up` link is the mirror. A cycle in that relation is broken by a depth-first walk from the start's group. `stats.vertical.cycleDropped` counts the dropped edges.
  - The start's group keeps its coordinates.
  - The start's ancestors are placed upward, nearest first.
  - Every other group is placed downward in topological order: below the lowest group it lies under, aligned under the linking cell.
  - A group nothing reaches goes right of everything so far.
  - A **warp-only** group (no `down`/`up` link, and some other group warps into it) is placed after that, beside its **first warp predecessor**: of the placed groups that warp into it, the one placed earliest. Its warped-to cell starts on the warping cell, and it slides clear right, left, down or up, whichever moves it least. `placedBy` is `'warp'`. A warp-only group that only another unplaced one warps into waits for it; one that nothing placed warps into goes right.
  - A **source** group (nothing lies over it, but it lies over something) is placed last, `gap` cells over the highest group it lies over. Its linking cell is aligned over the linked cell of its **first successor**: of the groups it lies over, the one placed earliest. `placedBy` is `'source'`.
  - `gap` empty cells separate any two groups, and a group that would come closer slides right. A source tries right, left and up and takes the shortest slide; each of these keeps it over everything it lies over.
- The result is `{ positions, groups: [{ id, root, members, bbox, placedBy }], stats }`. `stats` holds the group count and sizes, the directed links honoured and consistent, the links between adjacent cells, `down`/`up` across groups and how many landed below/above, `crossLength` (the summed length in cells of the links between groups), and the bbox.
- For an acyclic vertical relation, every `down` link across groups lands with its target group strictly below.

## The resolution order: `resolveRegionLayout({ rules, player, sidecars, registry, hookCtx, rule, gap })`

1. **`grid_cell`**: when every display region has a stored `grid_cell`, those cells are used minus the start region's cell, as one group.
2. **Hook**: otherwise the world's substrate declares `compositeMap.layoutGraph(ctx)` ([substrate-registry.md](substrate-registry.md) § Entry contract). The resolver uses it when every sidecar's substrate declares the same hook, and finds it through the registry, as `compositeMap.drawRegion` is found. No substrate is named in shared code.
3. **Generic**: otherwise the rules' regions and exits, with no `dir` and every link a `join`. This path opens any world, including a classic AP world with no sidecars.
4. **Mixed**: when some display regions carry a `grid_cell` and some do not, v1 lays out everything by 2 or 3 and records it in `stats.mixedGridCell`.

Steps 2 and 3 then run `layoutGrouped`. `stats.source` names the step that answered.

**The start and the Menu hub.** These are read as `layoutTopDown` reads them. A declared start with at least one exit and no locations is a pure hub (`isVirtualStart`). A hub is not drawn: its first exit's target is the start, and each further exit's target is a root joined to the start. Every region is read as its display region (`compositeMap.displayRegionOf`, else its own name).

## The Seedling hook

`flashPanel/seedlingCompositeMap.js` `seedlingLayoutGraph`, declared by `flash_seedling` and `flash_seedling_gen`:

- **Nodes** are the display regions: `level_N__rRcC` folds onto `level_N` by its payload's `atlas_region`.
- **Links** come from the sidecars' `exits` with a `targetRegion`. A link inside one level is dropped.
- **`kind`** comes off the `exit_id` prefix, the only stairs/pit signal a compiled sidecar carries: `out_stairsdown`/`out_pit` → `down`, `out_stairsup` → `up`, everything else `join`.
- **Edge transition or warp.** Every Seedling exit is the game's Teleporter object, whether it is a walk-off edge or a doorway. `seedlingEdgeTransitionOf` tells them apart. A `join` is kept only when its door tile is on the border of its level AND its arrival lies within `EDGE_ARRIVAL_TILES` (1) tiles of the opposite border of the target; otherwise it becomes `warp`. Without the level sizes it cannot say, and the link stays `join`.
- **`dir`** (for joins only) comes from `seedlingSetMap.dirOfExit`: the door's side of its level, else the arrival's side of the target, reversed. It needs the level sizes from an atlas the library ships, or one handed in as `hookCtx.atlases`.

A custom set compiled by the set editor (`seedlingSetAdapter.rulesJsonOf`) carries the same payload shape, so the hook lays it out. Its derived atlas is not shipped, though: without `hookCtx.atlases: { [atlas.atlas_id]: atlas }` its links have no direction, and no warp can be told from an edge transition.
