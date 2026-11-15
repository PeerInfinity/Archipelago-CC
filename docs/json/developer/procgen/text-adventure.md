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
| `playbackProxy.js` / `playbackBridge.js` | The PlaybackController contract across the iframe boundary, used by the playback bot ([Playback and Debugging Tools](./playback-and-debugging.md#the-playbackcontroller-contract-and-iframe-proxies)) and by a loops Bot block (`TextAdventurePlaybackProxy.perform`). |
| `mana.js` | Shows loop-mode mana in the engine header. When loop mode is off, charges location checks and a region's move cost on departure, except in regions of another substrate that declares `sharing.mana`, because those substrates bill the pool themselves, and in regions of a substrate that loop mode prices by its own play (`loopSupport.summaryRecording` or `loopSupport.playClock`: Cloudberry, Noiz2sa, Bounce, flash_seedling, flash_seedling_gen), which cost no mana with loop mode off. |
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
- `exitGates` — `{exit_id: rule}` for gated exits only, forward and back. It is a sibling of `exits` because a substrate may not add fields to the envelope's exit record.
  - A **back-exit's** gate is its forward exit's compiled rule. The engine inserts a back-exit after placement with no rule. `buildRulesJson`'s bidirectional post-pass copies the forward rule onto the document's back-exit. For a substrate whose `regionRoundTrip.rules` is `authored` (the text adventure), it also writes the rule on the back-exit's own record, so the serializer writes it here.
  - Why it matters: the text adventure's round trip re-emits its rules from this payload. Before this (concept library T2c), a room behind a gate had no back-exit entry. `check-sidecar-fields.mjs` then failed its rule agreement on that room, and the round trip answered `True_` for the back-exit.
- `locations` — `{name, item?, access_rule?}`, with the AP location name filled in at serialize time.
- `fogEnabled` — engine flag, always present.
- `manaEnabled` — engine flag, present in loop mode.
- `prose` — optional; the region's own prose (see [below](#prose-and-its-resolution-order)). Written only when the room says something, so a room built without a concept has no `prose` key.
- `things` — optional; the room's things, which are not AP checks (see [Things](#things-that-are-not-ap-checks)). Written only when a theme offers one, so a world with no theme has no `things` key.

`deserializeWorld` returns `{exits: Map, locations}`. It copies `manaEnabled: true` onto the world, because play reads the flag from the world: `procgenPlayer.getRegionInfo` passes it to `mana.js`. It copies `prose` (and `things`) for the same reason: the bridge reads it off the world that `textAdventure:loadRegion` carries. `fogEnabled` is not copied; nothing reads it from a world.

A payload that is not a room (a tile-grid shape with `tiles`/`items` and no `exitGates`/`locations`) is refused with a message naming those keys (`textAdventureRoomRefusal`), rather than read as a room with no locations.

## Prose and its resolution order

The engine shows six kinds of message: a region's `enterMessage`, an exit's `moveMessage` and `inaccessibleMessage`, and a location's `checkMessage`, `alreadyCheckedMessage` and `inaccessibleMessage`. Each is a `{var}` template (`templating.js`): `{destinationRegion}` on an exit, `{item}` on a location.

They come from two documents:

- **The per-game file**, `shared/customData/<game>_textadventure.json`, fetched by game name (`customData.js`) and keyed by region, exit and location name across the whole game.
- **The region's payload `prose`**, a slice of the same shape for one region: `{name?, description?, enterMessage?, exits: {<exit_id>: {moveMessage?, inaccessibleMessage?}}, locations: {<AP name>: {checkMessage?, alreadyCheckedMessage?, inaccessibleMessage?}}}`.

Each message resolves in this order: **the region's payload prose → the per-game file → the bridge's generic line** ("You can't go that way: …"). The fall-through is per message, so a region may override one exit's `inaccessibleMessage` and keep the file's `moveMessage`. `composeProse` in `templating.js` does this: it lays the region's prose over the file and hands the six lookup helpers the result. The bridge caches each region's prose on `textAdventure:loadRegion` and maps its `exit_id` keys to the engine's exit names.

## Concept realisations

A text-adventure gate has no geometry. `placeFromRules` records the rule on the exit, and the bridge refuses the move while the rule fails. So what a [concept](./concepts.md) adds here is what the player reads, and every realisation is `tier: 'mechanic'`. The entry declares `conceptRealisations` (`textAdventureConceptRealisations.js`):

- `sword` and `swim` each give a location a `checkMessage`.
- `guardian` and `water` each have a `gate` placement that requires the sword or swim. The gate says a `blocked` message and a `passedWith` message (which names the weakness).

The realisations hold the logic only. The words are content (content sets R1): see [Content roles](#content-roles).

`placeFromRules` offers each exit rule to `selectRealisation` with the world's `params.concepts`. On a match it writes `prose.exits[exit_id] = {inaccessibleMessage: blocked, moveMessage: passedWith}`. A location holding an offered item concept gets that item's `checkMessage`. The rule itself is recorded unchanged. A world that offers no concepts gets no `prose`, and its payloads are byte-identical to what they were before.

## Content roles

The entry declares `defaultContentPack: 'text-adventure'` and `contentRoles` (both in `textAdventureConceptRealisations.js`); the contract is [Concepts § Content roles](./concepts.md#content-roles).

| Role | Accepts | Needs | Written as |
|---|---|---|---|
| `gate` | concepts presenting `guardian` or `water` | text `blocked`, `passedWith` | the exit's `inaccessibleMessage`, `moveMessage` |
| `item` | concepts presenting `sword` or `swim` | text `checkMessage` | the location's `checkMessage` |
| `place` | kind `place` | — | the room's `name` and `description` |
| `character` | kind `character` | text `says` | a thing of kind `character` |
| `object` | kind `object` | — | a thing of kind `object` |
| `info` | kind `info` | text `body` | the holder's `info`, or a thing of kind `info` when the room has no holder |

- **The default pack**, `frontend/packs/text-adventure/`, has one pack concept per realised mechanic concept, each `presents` it and names its text slots, and a `text` layer holding every string the generation writes. The strings are the ones the code held before R1, byte for byte, so every committed world compiles unchanged.
- **Which words a gate gets.** `presentedProse(contentSet, role, concept)` (`textAdventureRoom.js`) is the first answer of the contract's `resolveRole` for the role and the concept: the pack concepts that fill the role and present it, latest pack in the stack first, each with every slot resolved in the set's text layer. A later pack that presents the mechanic wins; one that lacks a slot falls through to an earlier pack, in the end the default pack. A selected concept with no content set, or with no pack presenting it, is refused by name.
- **`{item}` in a gate's words is filled at generation** (content sets S1). The item is a fact of the gate's rule: the selected realisation's `needs`, each as its concept's AP item id, joined with " and " (`gateItemText`). The placer fills it, HTML-escaped. `{destinationRegion}` in a gate's words, and `{item}` in a check message, are filled at play by `templating.js`, which also escapes HTML and highlights the item (the text library does neither). The `meta` theme's Gate lines say `{item}`; they bake to the same characters its earlier literal did, so `meta_trial`'s bytes did not move.
- **What a slot means** is behaviour (⚖ Q6) and stays in code: `GATE_PROSE_SLOTS` and `ITEM_PROSE_SLOTS` map each slot to its message, and the roles' `needs.text` are their keys.
- **A room's place.** `generateTextAdventureRoom` asks `roomPlace`: the pack concepts that fill `place` (`resolveRole`; a concept that `presents` a mechanic fills no kind role, and no default pack holds a place). With none, nothing is read or drawn and the payload has no new key. Otherwise it picks one by `hash32("<rng state>:<region_id>") mod <count>`, reading the region rng's state without advancing it, so the pick is fixed by the seed and the world's logic is the control's. The place's `name` and `description` go into the payload `prose`. Two rooms may get the same place.
- **The bridge** shows a room's payload `name` as its title, and on arrival shows its enter message, else its payload `description`, else "You are in <name or region>." (`arrivalLine` in `templating.js`). It reads the description off the payload only, never the per-game file's `regions.<name>.description`.
- **Exits are labelled by place.** An exit reads `<exit name> (to <place>)`, and `{destinationRegion}` is filled with the target's place name, when the target room has one; a target with no place (a maze region, an unthemed world) keeps its region id. The bridge learns a payload only for the room it enters, but the host wrapper holds the whole document: `roomExtrasOf(sidecars)` (`textAdventureRoom.js`) reads every text-adventure payload of the player into `{<region>: {name?, description?, things?}}`, and `index.js` sends it in the `initialState` event. Nothing is generated differently.

## Things that are not AP checks

⚖ The user, 2026-11-14: a character, object or piece of information that is not an AP check is **look-only** in v0. It can be looked at, talked to or read any number of times; it is never picked up, used or given, and nothing depends on it. An entity is AP if and only if it is in the rules document (a location, an item, an exit, a region); everything else is a thing, which lives only in the payload's `things` and has no rule, no state and no inventory.

- **Generation.** `roomThings(contentSet, region_id, rng, {roomName})` gives a room at most one HOLDER (from the `character` and `object` roles) and at most one piece of INFORMATION (the `info` role), each picked by `hash32("<rng state>:<region_id>:holder")` / `…:info` mod the candidate count, with no draw. With both, the holder carries the information; with only the information, it is a thing of kind `info`. The same character may stand in several rooms. With no candidate, nothing is written: no default pack offers one.
- **The shape.** `things: [{id, kind, concept, name, description?, says?, info?: {concept, name, body}}]`, `concept` the pack concept key. A character's `says` and the information's `body` are baked (Q8), resolved through the text library with `{regionId}` and `{roomName}` (the room's place name, else its region id) filled and escaped. Declared in `TEXT_ADVENTURE_SIDECAR_FIELDS`; the round trip carries it, because `save` re-serializes the deserialized room.
- **Play.** The bridge adds each thing to its room as an engine item with id `thing:<id>` and the thing's `kind` (the engine draws it as the class `tae-item-kind-<kind>`). It is never collected, has no rule, and is marked discovered when the room is entered (the discovery module knows AP locations only). Examining it shows, in order, its `description`, a character's `<name> says: …`, and the information as `<name>: <body>` (`thingLines` in `templating.js`), and publishes **`content:thingExamined`** `{region, thing, kind, concept, info}` instead of `user:locationCheck`. That event is the clue seam: a later case-file panel subscribes to it.

## Registry entry

The entry (in `textAdventureSubstrateWrapperLibrary.js`) declares `textAdventure:loadRegion`, `regionGeometry: SIDES`, the hooks and serializer above, `sidecarFields`, `apLocationNamesOf` (every `locations[].name`), `exitSides` with no side-keyed payload fields, the composite-map painter, and `conceptRealisations` (above). Full contract: [Substrate Registry Reference](./substrate-registry.md).

`regionRoundTrip` lets the APWorld hub's **Re-derive rules** reach every text-adventure region: `open` deserializes the room; `save` serializes it, re-adds `fogEnabled`/`manaEnabled`, and compiles the rules. It declares `rules: 'authored'`, so `scripts/procgen/check-sidecar-fields.mjs` fails a document rule the payload does not carry. **Edit** stays disabled because the entry has no `roomEditor`.

Loop support: `regionMove`/`locationCheck`/`explore` queue actions, manual play, and `record`/`playback`/`instant`, with `customQueues: false`. Every engine action is already a basic loop-queue action, so a custom queue would add nothing. For the same reason this is a coarse-only substrate for recording; see [Loop recording](./loop-recording.md#the-capture-contract-coarse-only-vs-fine-grained-vs-summary-substrates).

**Bot blocks.** The entry declares `executeVia: 'solver'`, so a Bot block plays the region through the walkTo solver. Its controller, `TextAdventurePlaybackProxy`, adds `perform(target)` to the shared proxy. The iframe bridge acts on a `perform` at once, while a `walkTo` waits for the bridge's clock, which only the standalone Playback Bot runs. A move or check comes back as the bridge's `user:regionMove` / `user:locationCheck`, and loops charges it at completion like any coarse action. An explore prints *You explore …* in the engine and publishes nothing; loops completes it and its `loop:exploreCompleted` does the revealing, so nothing is revealed twice. Each action lands in one step, so the entry declares `botActsAtOnce` and a Bot block has no Instant to honour. The loop-mode Playback Bot gives text-adventure blocks Bot mode. The row `playback-bot-loop-mode-text-adventure` plays a text-adventure-only world to Victory that way.

## Who reads the room

- **The bridge** re-applies each exit's side (sent with `textAdventure:loadRegion`) to the rooms it builds from `staticData`, which carry no sides. That is what makes the engine draw its 3×3 compass grid in a procgen world.
- **The composite-map painter** draws exits on their sides, the location count and names, and a gate as closed when its rule fails on an empty inventory.

In-app tests (`frontend/modules/tests/testCases/textAdventureWrapperTests.js`): `tasw-compass-grid-renders-procgen-sides`, `tasw-gate-holds-in-play`, `tasw-concept-prose-in-play` (a guardian-gated exit shows its `blocked` prose, and after the sword is granted its `passedWith` prose), `tasw-thing-examine-in-play` (a thing shows its text, publishes `content:thingExamined`, checks no location, and can be read twice) and `tasw-exit-label-by-place` (an exit's label and `{destinationRegion}` name the target's place before that room is entered).

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Maze Substrate](./maze.md)
