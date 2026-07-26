# Text Adventure Substrate

The text-adventure substrate (id `text_adventure`) renders a procgen region as prose: a textual description with compass-labelled clickable exits and clickable locations. Under the hood it is a *tile-grid world wearing a text skin* — its build-time hooks reuse the shared tile-grid adapter primitives verbatim, so its sidecar shape is identical to the maze's; only the panel differs.

Two modules implement the same substrate id (first registration wins — see [Gotchas](./gotchas.md#two-text-adventure-modules-register-the-same-substrate-id)):

- **`textAdventureSubstrateWrapper`** — the **surviving** module: an iframe-hosted engine with a host↔iframe bridge.
- **`textAdventureSubstrate`** — the direct-panel variant, **deprecated 2026-07-26**. Disabled in every module config but one, and absent from `__BUNDLED_MODULES__` entirely.

### Why the deprecated module is still here

`?mode=textadventure` — the [documented live demo](../../games/text-adventure/README.md) — plays a **non-procgen** preset, and the wrapper's *panel* cannot serve that: it covers itself with `SubstrateInactiveOverlay` ("No procgen substrate is active for the current region") whenever `procgenPlayer` reports no active substrate, which is always without a procgen world. The wrapper's *bridge* is fine — it builds the engine world straight from `staticData.regions` with the sidecar filter bypassed, and renders that preset's prose correctly behind the overlay. So the gap is one panel predicate, not a missing capability. Migrating that mode also needs its `layout_presets.json` component type swapped and `iframeAdapter` enabled in `modules-textadventure.json`.

Until then the mode is **dev-only in practice**: the deprecated module is not bundled, so the deployed site's `?mode=textadventure` shows a dead "Waiting for region…" panel, and only local dev (or `?dev`) gets the working direct panel.

## The engine (`frontend/modules/textAdventureEngine/` — git submodule)

`TextAdventureEngine` is a synthetic, deliberately **Archipelago-naive** text-adventure renderer and command parser. It runs in two modes: standalone (loads bundled sample worlds and mutates its own state — how the engine repo is developed and demoed) and managed (emits events and lets a wrapper drive all state — how it runs inside this app). The engine knows nothing about AP items, regions, or rules; that separation is the point of the wrapper pattern.

## The wrapper (`frontend/modules/textAdventureSubstrateWrapper/`)

The wrapper mounts the engine in a same-origin iframe and owns everything Archipelago-shaped:

- **`bridge.js`** (in-iframe) translates host AP state into engine API calls and engine interactions back into dispatcher events.
- **`playbackProxy.js` / `playbackBridge.js`** implement the PlaybackController contract across the iframe boundary ([Playback and Debugging Tools](./playback-and-debugging.md#the-playbackcontroller-contract-and-iframe-proxies)).
- **`mana.js`** wires loop-mode mana display into the engine's header (and out-of-loop-mode deduction; loop-mode live play is charged host-side by loops).
- Module settings: scrollback limit, input auto-focus, and a custom-data URL override (empty = auto-detect by game name).

## Registry entry

Both modules' entries share the same shape (`textAdventure:loadRegion`, tile-grid `deserializeWorld`, full procedural build-time hooks from `adapterPrimitives.js`). Loop support: `regionMove`/`locationCheck`/`explore` queue actions, manual play, and `record`/`playback`/`instant`, but **no custom queues** — a deliberate decision, since the engine's actions are exactly the basic loop-queue actions, so a recorded queue would duplicate what the loops queue already expresses. Full contract: [Substrate Registry Reference](./substrate-registry.md).

That same reasoning extends to recording: the text adventure is the reference **coarse-only** substrate under the [loop-recording capture contract](./loop-recording.md#the-capture-contract-coarse-only-vs-fine-grained-substrates) — every action it has is queue-grade, so a recorded visit carries no information the block's own queue interior doesn't. The M3b refactor (2026-07-22) therefore removed the M2-era wrapper recorder (`recorder.js`, the `textAdventure:commandRecorded` side-channel, and the replay half of `playbackBridge.js`/`playbackProxy.js`): loops owns coarse capture during parked Record blocks and runs Playback interiors through its generic executor host-side ([`CC/docs/plans/loops-coarse-capture-plan.md`](../../../../CC/docs/plans/loops-coarse-capture-plan.md)). The `walkTo`/bot half of `playbackBridge.js` and `playbackProxy.js` remains — the playback bot rides it independently of recordings.

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Maze Substrate](./maze.md) (the tile-grid semantics this substrate reuses)
