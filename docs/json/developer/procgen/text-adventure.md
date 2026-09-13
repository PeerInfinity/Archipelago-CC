# Text Adventure Substrate

The text-adventure substrate (id `text_adventure`) renders a procgen region as prose: a textual description with compass-labelled clickable exits and clickable locations. Under the hood a region is a *room*, not a tile grid: its exits stand on their compass sides, and its locations and gates are the document's own rules — no tiles, no entrance, no rng draw. Since PRESET SIDECARS G2a (2026-09-13) it has its own build-time hooks and its own sidecar payload; until then it reused the maze's hooks and serializer, and every text-adventure region grew a maze that nothing at play read.

One module implements it: **`textAdventureSubstrateWrapper`**, an iframe-hosted engine with a host↔iframe bridge.

A second implementation, the direct-panel `textAdventureSubstrate`, was **deleted 2026-07-26** after `?mode=textadventure` migrated onto the wrapper. It had registered the same substrate id and, because it loaded first, won that id wherever both were enabled — silently downgrading loop support, since its entry declared no `record`/`playback`/`instant`. If you find a reference to it, it is stale.

### Standalone play, and why the overlay steps aside for it

A substrate panel shows `SubstrateInactiveOverlay` when some *other* substrate owns the current region — a question that only means anything inside a procgen world. With a plain AP `rules.json` there is no substrate routing at all: the bridge builds the engine's world from the whole `staticData` region set (the sidecar filter is bypassed) and follows `gameState:regionChanged`, so the engine has something to show for every region.

The wrapper panel therefore **skips the overlay entirely when the loaded rules carry no `preset_sidecars` for the player**, tracked from the host's `initialState` snapshot. `procgen:activeSubstrateChanged` cannot answer this — it is `null` both for "standalone preset" and for "procgen world whose current region isn't mine".

This is what unblocked `?mode=textadventure`, the [documented live demo](../../games/text-adventure/README.md), which plays the non-procgen Adventure preset. It previously ran on the deprecated module and was hiding a *working* text adventure behind "No procgen substrate is active for the current region". Migrating it also needed the `textadventure` layout preset's component type swapped and `iframeAdapter` enabled in `modules-textadventure.json`.

That migration also fixed the deployed site, where the mode was already broken for a different reason: the deprecated module is not bundled, so `?mode=textadventure` showed a dead "Waiting for region…" panel there while working in local dev.

## The engine (`frontend/modules/textAdventureEngine/` — git submodule)

`TextAdventureEngine` is a synthetic, deliberately **Archipelago-naive** text-adventure renderer and command parser. It runs in two modes: standalone (loads bundled sample worlds and mutates its own state — how the engine repo is developed and demoed) and managed (emits events and lets a wrapper drive all state — how it runs inside this app). The engine knows nothing about AP items, regions, or rules; that separation is the point of the wrapper pattern.

## The wrapper (`frontend/modules/textAdventureSubstrateWrapper/`)

The wrapper mounts the engine in a same-origin iframe and owns everything Archipelago-shaped:

- **`bridge.js`** (in-iframe) translates host AP state into engine API calls and engine interactions back into dispatcher events.
- **`playbackProxy.js` / `playbackBridge.js`** implement the PlaybackController contract across the iframe boundary ([Playback and Debugging Tools](./playback-and-debugging.md#the-playbackcontroller-contract-and-iframe-proxies)).
- **`mana.js`** wires loop-mode mana display into the engine's header (and out-of-loop-mode deduction; loop-mode live play is charged host-side by loops).
- Module settings: scrollback limit, input auto-focus, and a custom-data URL override (empty = auto-detect by game name).

## The room and its payload

`textAdventureSubstrateWrapper/textAdventureRoom.js` is what a text-adventure region is at build time. `generateRegionCore` makes one exit record per requested exit on its requested side (a side-less exit — a teleporter — takes the still-free sides clockwise, then cycles), and no location; `placeFromRules` records each exit's and location's AUTHORED rule on it (`True_` as absent); `placeFromItems` (the spiral's placer) turns each item into a location holding it and places no obstacle, because a key/door pair has no geometry to stand between in a room; `extractPathsAndObstacles` hands the rules back verbatim, with `True_` written explicitly (the compiler turns an absent rule with no paths into `False_`).

The payload is `{exits, exitGates, locations}` plus the engine's `fogEnabled` (and `manaEnabled` in loop mode). `exits` is the envelope's sided exit list; `exitGates` maps each GATED exit's `exit_id` to its rule, a sibling of `exits` because a substrate may not add a field to the envelope's exit record; `locations` is `{name, item?, access_rule?}` with the AP location name baked in at serialize. `deserializeWorld` returns `{exits: Map, locations}` (a clone), and a rebuild re-emits the document's rules from it. There is one format: a payload that is not a room — the tile-grid shape written before G2a, carrying `tiles`/`items`/… and no `exitGates`/`locations` — is refused with a sentence naming those keys (`textAdventureRoomRefusal`), never read as a room with no locations; every committed text-adventure payload was regenerated in the room format. The entry declares all of this — its own `sidecarFields`, `apLocationNamesOf` over `locations[].name`, and `exitSides` with an empty `keys` list: the side is where an exit is listed and nothing else in the payload is keyed by one.

Two consumers read the room. The bridge re-applies each exit's side (from the deserialized world's exit Map, sent on `textAdventure:loadRegion`) to the rooms it builds from `staticData`, which carry no side; that is what makes the engine draw its 3×3 compass grid for a procgen world — in-app row `tasw-compass-grid-renders-procgen-sides`. The composite-map painter (`textAdventureCompositeMap.js`) paints the room with no payload key of its own: exits on their sides, the location count and names, and a gate drawn closed when its authored rule does not hold on an empty inventory.

## Registry entry

The entry declares `textAdventure:loadRegion`, `regionGeometry: 'sides'`, the room's hooks and serializer pair above, its payload declarations, and the composite-map painter. Loop support: `regionMove`/`locationCheck`/`explore` queue actions, manual play, and `record`/`playback`/`instant`, but **no custom queues** — a deliberate decision, since the engine's actions are exactly the basic loop-queue actions, so a recorded queue would duplicate what the loops queue already expresses. Full contract: [Substrate Registry Reference](./substrate-registry.md).

That same reasoning extends to recording: the text adventure is the reference **coarse-only** substrate under the [loop-recording capture contract](./loop-recording.md#the-capture-contract-coarse-only-vs-fine-grained-vs-summary-substrates) — every action it has is queue-grade, so a recorded visit carries no information the block's own queue interior doesn't. The M3b refactor (2026-07-22) therefore removed the M2-era wrapper recorder (`recorder.js`, the `textAdventure:commandRecorded` side-channel, and the replay half of `playbackBridge.js`/`playbackProxy.js`): loops owns coarse capture during parked Record blocks and runs Playback interiors through its generic executor host-side ([`CC/docs/plans/loops-coarse-capture-plan.md`](../../../../CC/docs/plans/loops-coarse-capture-plan.md)). The `walkTo`/bot half of `playbackBridge.js` and `playbackProxy.js` remains — the playback bot rides it independently of recordings.

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Maze Substrate](./maze.md) (the tile-grid substrate this one used to reuse)
