# Text Adventure Substrate

The text-adventure substrate (id `text_adventure`) renders a procgen region as prose: a textual description with compass-labelled clickable exits and clickable locations. Under the hood it is a *tile-grid world wearing a text skin* — its build-time hooks reuse the shared tile-grid adapter primitives verbatim, so its sidecar shape is identical to the maze's; only the panel differs.

Two modules implement the same substrate id (first registration wins — see [Gotchas](./gotchas.md#two-text-adventure-modules-register-the-same-substrate-id)):

- **`textAdventureSubstrateWrapper`** — the **surviving** module: an iframe-hosted engine with a host↔iframe bridge.
- **`textAdventureSubstrate`** — the direct-panel variant, **deprecated 2026-07-26**. Disabled in every module config, absent from `__BUNDLED_MODULES__`, and reached by nothing. Retained pending a decision to delete.

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

## Registry entry

Both modules' entries share the same shape (`textAdventure:loadRegion`, tile-grid `deserializeWorld`, full procedural build-time hooks from `adapterPrimitives.js`). Loop support: `regionMove`/`locationCheck`/`explore` queue actions, manual play, and `record`/`playback`/`instant`, but **no custom queues** — a deliberate decision, since the engine's actions are exactly the basic loop-queue actions, so a recorded queue would duplicate what the loops queue already expresses. Full contract: [Substrate Registry Reference](./substrate-registry.md).

That same reasoning extends to recording: the text adventure is the reference **coarse-only** substrate under the [loop-recording capture contract](./loop-recording.md#the-capture-contract-coarse-only-vs-fine-grained-substrates) — every action it has is queue-grade, so a recorded visit carries no information the block's own queue interior doesn't. The M3b refactor (2026-07-22) therefore removed the M2-era wrapper recorder (`recorder.js`, the `textAdventure:commandRecorded` side-channel, and the replay half of `playbackBridge.js`/`playbackProxy.js`): loops owns coarse capture during parked Record blocks and runs Playback interiors through its generic executor host-side ([`CC/docs/plans/loops-coarse-capture-plan.md`](../../../../CC/docs/plans/loops-coarse-capture-plan.md)). The `walkTo`/bot half of `playbackBridge.js` and `playbackProxy.js` remains — the playback bot rides it independently of recordings.

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Maze Substrate](./maze.md) (the tile-grid semantics this substrate reuses)
