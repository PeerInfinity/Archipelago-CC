# Text Adventure Substrate

The text-adventure substrate (id `text_adventure`) shows a region as prose: a description with clickable compass exits and clickable locations. At build time a region is a room, not a tile grid: exits sit on compass sides, and gates are the document's own rules.

It is implemented by one module, `textAdventureSubstrateWrapper`, which hosts a separate engine in an iframe.

## The engine (`frontend/modules/textAdventureEngine/` — git submodule)

`TextAdventureEngine` is a text-adventure renderer and command parser that knows nothing about Archipelago items, regions or rules. It runs standalone (loading its own sample worlds, which is how the engine repo is developed) or managed (emitting events and letting a wrapper drive all state, which is how it runs in this app).

## The wrapper (`frontend/modules/textAdventureSubstrateWrapper/`)

The wrapper mounts the engine in a same-origin iframe and owns everything Archipelago-specific:

| File | Role |
|------|------|
| `bridge.js` | Runs inside the iframe. Turns host AP state into engine calls, and engine clicks into dispatcher events. |
| `playbackProxy.js` / `playbackBridge.js` | The PlaybackController contract across the iframe boundary, used by the playback bot ([Playback and Debugging Tools](./playback-and-debugging.md#the-playbackcontroller-contract-and-iframe-proxies)). |
| `mana.js` | Shows loop-mode mana in the engine header, and charges a region's move cost on departure when loop mode is off. |
| `textAdventureRoom.js` | Build-time hooks and the payload serializer (below). |
| `textAdventureRegionRoundTrip.js` | Document round trip for the APWorld hub. |
| `textAdventureCompositeMap.js` | Composite-map painter. |

Module settings: `messageHistoryLimit` (scrollback length), `autoFocusCommandInput`, and `autoLoadCustomData` (custom-data URL override; empty means detect by game name).

### Standalone play

With a plain AP `rules.json` there is no substrate routing. The bridge builds the engine's world from every region in `staticData` and follows `gameState:regionChanged`. The panel therefore skips `SubstrateInactiveOverlay` when the loaded rules carry no `preset_sidecars` for the player.

**Note:** `procgen:activeSubstrateChanged` cannot make this decision. It is `null` both for a standalone preset and for a procgen world whose current region belongs to another substrate.

This is how `?mode=textadventure` plays the non-procgen Adventure preset ([live demo](../../games/text-adventure/README.md)); its modules are listed in `frontend/module-configs/modules-textadventure.json`.

## The room and its payload

The hooks in `textAdventureRoom.js`:

| Hook | What it does |
|------|--------------|
| `generateRegionCore` | One exit per requested exit, on its requested side. A side-less exit (a teleporter) takes the free sides clockwise, then cycles. No locations. |
| `placeFromRules` | Records each exit's and location's authored rule on it (`True_` is stored as absent). |
| `placeFromItems` | Used by the spiral driver. Turns each item into a location holding it; places no obstacle, since a room has no geometry for a key/door pair. |
| `extractPathsAndObstacles` | Returns the rules unchanged, writing `True_` explicitly (the compiler would turn an absent rule with no paths into `False_`). |

The serialized payload has these fields:

- `exits` — the envelope's sided exit list.
- `exitGates` — `{exit_id: rule}` for gated exits only. It is a sibling of `exits` because a substrate may not add fields to the envelope's exit record.
- `locations` — `{name, item?, access_rule?}`, with the AP location name filled in at serialize time.
- `fogEnabled` — engine flag, always present.
- `manaEnabled` — engine flag, present in loop mode.

`deserializeWorld` returns `{exits: Map, locations}`. It copies `manaEnabled: true` onto the world, because play reads the flag from the world: `procgenPlayer.getRegionInfo` passes it to `mana.js`. `fogEnabled` is not copied; nothing reads it from a world.

A payload that is not a room (a tile-grid shape with `tiles`/`items` and no `exitGates`/`locations`) is refused with a message naming those keys (`textAdventureRoomRefusal`), rather than read as a room with no locations.

## Registry entry

The entry (in `textAdventureSubstrateWrapperLibrary.js`) declares `textAdventure:loadRegion`, `regionGeometry: SIDES`, the hooks and serializer above, `sidecarFields`, `apLocationNamesOf` (every `locations[].name`), `exitSides` with no side-keyed payload fields, and the composite-map painter. Full contract: [Substrate Registry Reference](./substrate-registry.md).

`regionRoundTrip` lets the APWorld hub's **Re-derive rules** reach every text-adventure region: `open` deserializes the room; `save` serializes it, re-adds `fogEnabled`/`manaEnabled`, and compiles the rules. It declares `rules: 'authored'`, so `scripts/procgen/check-sidecar-fields.mjs` fails a document rule the payload does not carry. **Edit** stays disabled because the entry has no `roomEditor`.

Loop support: `regionMove`/`locationCheck`/`explore` queue actions, manual play, and `record`/`playback`/`instant`, with `customQueues: false`. Every engine action is already a basic loop-queue action, so a custom queue would add nothing. For the same reason this is a coarse-only substrate for recording; see [Loop recording](./loop-recording.md#the-capture-contract-coarse-only-vs-fine-grained-vs-summary-substrates).

## Who reads the room

- **The bridge** re-applies each exit's side (sent with `textAdventure:loadRegion`) to the rooms it builds from `staticData`, which carry no sides. That is what makes the engine draw its 3×3 compass grid in a procgen world.
- **The composite-map painter** draws exits on their sides, the location count and names, and a gate as closed when its rule fails on an empty inventory.

In-app tests (`frontend/modules/tests/testCases/textAdventureWrapperTests.js`): `tasw-compass-grid-renders-procgen-sides` and `tasw-gate-holds-in-play`.

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Maze Substrate](./maze.md)
