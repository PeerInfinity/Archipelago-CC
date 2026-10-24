# The Maze Lab Page

The maze lab page (`frontend/modules/mazeRoom/lab.html`) is a standalone static page that generates, edits, solves and hand-drives maze levels from URL parameters alone, and edits region libraries and worlds. It is the maze's counterpart of Seedling's `seedlingDemo/watch.html`, and it also runs inside the frontend in a Golden Layout panel.

The page needs no frontend and no eventBus. What it shares with `watch.html` lives in `frontend/modules/procgenCore/` (`urlParams.js`, `labView.js`, `paletteRoster.js`, `pageLifetime.js`, `setEditorView.js`). The engine, procgen binding, area graph and elements it exercises are described in [Maze Substrate](./maze.md).

## Running it

```
python -m http.server 8000        # from the repo root
http://localhost:8000/frontend/modules/mazeRoom/lab.html?seed=3&count=4&run=1
```

| File (`mazeRoom/`) | Role |
|---|---|
| `lab.html` | The page |
| `mazeLab.js` | Headless half: URL reader/writer (`readLabParams` / `writeLabParams`), the modes' logic, the payload |
| `mazeLabView.js` | DOM half |
| `mazeLabWalk.js` | The manual mode's walk session |
| `mazeSetLab.js` | The set mode's maze bindings (no DOM) |
| `mazeLabBridge.js` | The in-frame bridge, loaded only when hosted |
| `mazeEditAdapter.js` | The maze as an `editCore` adapter |

## The edit session

Edits go through `mazeEditAdapter.js`, which describes the maze in the terms the shared edit core asks for (see [Architecture](./architecture.md)). That gives the maze a base-plus-ops identity, grouped strokes, rectangle copy/paste and flood fill. The ops are the editor's `EDIT_OPS`, applied with `mazeRoomEditor.applyEditOp`; equality is `procgenMaze.worldsEqual`.

`mazeLab.openEditSession` opens a session on the page state; `projectSession` is the one writer of `record`, `edits` and `certified` back onto the state; `certifyInto` is the one bridge from the oracle's verdict. A state carries `baseRecord` (what the ladder, a directive or a load produced), and `record` is the fold of the edits over it.

**There is no world stack.** Undo is the fold over a shorter edit list, so undoing gives a level byte-identical to one that never had the edit. A drag, a paste and a flood are each one grouped entry and one undo; `editCore.describeOps` prints the count, e.g. `1 manual edit(s) (1 group of 3)`.

**Warning:** a pasted `setButton` keeps its resolved index and the engine allows duplicates, so a copied gadget gives two cells the same door; and a paste that carries the entrance moves it. The page counts both in a clip and says so before the paste lands.

A loaded payload is taken as it stands: it is its own base with no edit list, since its `level` already has the edits applied.

## The five modes

`?source=` switches modes in place. Each switch starts a new page lifetime (`procgenCore/pageLifetime.js`), so the mode being left drops its listeners. The values are `mazeLab.SOURCES`; an unknown value refuses and lists them.

| Mode | What it does |
|---|---|
| `generate` (default) | Runs the procgen loop. STEP places one template and re-solves; RUN-ALL runs to the target or saturation. The pane shows every attempt's outcome (`KEPT` / `REVERTED` / `NO_ANCHOR` / `ILLEGAL_PLACEMENT`) and the oracle's refusal verbatim. Unticking a template family restricts the roster; ATTEMPT on a row runs one directed attempt. |
| `edit` | The editor palette (floor, wall, entrance, item, obstacle, block, button, flag, erase) plus brush, rectangle copy, paste and flood from `procgenCore/editorView.js`. Every edit lands on a clone. |
| `solve` | `mazeOracle` on the world on screen: `SOLVED` / `REFUSED` / `BUDGET_EXHAUSTED` with the reason. The plan can be stepped. |
| `manual` | Drive the player by keyboard; see [The manual arm](#the-manual-arm-sourcemanual). |
| `set` | Edit a region library or a world; see [The set arm](#the-set-arm-sourceset). |

`generate` is the default (unlike `watch.html`) because a maze solve takes milliseconds. A step-*k* level is exactly `generate-maze-level.mjs --seed=S --count=k`, because it is the same call.

## Identity and certification

The URL carries a run somebody could type, not manual edits. An edited level's identity is its **payload** (`?gen=`, the save box, or download/upload), and the identity line says so:

```
seed 3 · maze-v1 · 11x11 · step 4, then 2 manual edit(s)  ·  palette: maze-v1 …
UNCERTIFIED — nothing has solved the world now on screen  ·
⚠ the URL is NOT a reproduction after edits — the PAYLOAD is
```

**Editing never bypasses the oracle.** Any edit that changes the world drops certification until SOLVE gives a new verdict. An edit that was refused or changed nothing is not counted: `applyEdit` compares the serialized worlds. A loaded payload is uncertified whatever the file claims.

`certified` is a tri-state shared with Seedling: `null` means nobody has asked, `true` / `false` are the oracle's answer, and `false` comes only from a refused solve.

## The URL grammar

The per-parameter table for both lab pages (reader, writer, default, and whether the writer writes or deletes each at its default) is generated from the code on **[the reference page](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html#section-url)** (`frontend/modules/procgenDocs/reference.html`, data `procgenDocs/generated/urlGrammar.js`, by [`generate-procgen-reference.mjs`](../../../../scripts/procgen/generate-procgen-reference.mjs)). Do not copy it here. The general rule: absent means the default, and the writer deletes a parameter at its default and rewrites the rest in place.

**A URL names launch parameters; the payload carries construction.** `?directed=` is retired and refuses by name. `?gen=` and the host's `procgenLab:load` replay the ladder, then `payload.directives`, then `payload.edits`, through the same functions a button press uses (`applyDirective`, `applyEditOp`). An edit is a closed op (`{op: 'setTile' | 'setEntrance' | 'setItem' | 'setObstacle' | 'setBlock' | 'setButton' | 'setFlag' | 'clearEntity', x, y, id?, index?, tile?}`) with every allocated index resolved, so an edited payload reproduces exactly.

What the maze-specific parameters are for:

| Parameter | Purpose |
|---|---|
| `?width=` / `?height=` | Room size (default `MAZE_DEFAULTS`, 11×11). Small rooms are how the REVERTED and SATURATED panes are reached: `?width=5&height=5&count=12&run=1`. |
| `?expansions=` | The BFS node cap; not `?tickbudget=`, which is Seedling's tick budget. `?expansions=1` reaches `BUDGET_EXHAUSTED` on purpose. |
| `?biome=` | The pass-2 palette (`maze-v1`), not a wall backend. |
| `?skeleton=<kind>[;k=v]` | Skeleton kind and knobs ([Kind parameters](./maze.md#kind-parameters)); absent means `empty`. Changing it resets the ladder. `?seed=3&count=3&skeleton=winding&run=1` |
| `?areas=` / `?require=` | Area graph and require directive ([The area graph](./maze.md#the-area-graph)). `?seed=1&width=15&height=15&skeleton=rooms&areas=1&require=K0&count=2&run=1`; `?areas=1&require=K1` shows a refusal. |
| `?elements=` | The pass-1 element ([The first element](./maze.md#the-first-element)). Its writer keeps a named parameter even at its default, since named and drawn parameters are different runs. `?seed=2&width=15&height=15&skeleton=rooms&areas=1&elements=guard;len=2;turns=1&count=2&run=1` |
| `?library=` / `?world=` | Open a region library or a world bundle in the set mode. |
| `?room=<n>` | Open room *n* of the held library (navigation, not a load); copied forward so a reload re-opens it. |

## `drawWorld`'s `view` contract

The canvas draw is `drawWorld(ctx, world, view)` in `mazeRoom/mazeRoomRender.js`, shared by the panel and the page. **`view` is the whole input**: every field in `VIEW_FIELDS` is required and `assertView` refuses a missing one by name rather than defaulting it. `null` means "I have no such thing".

| Field | Meaning; what `null` means |
|---|---|
| `tilePx` | Tile side in canvas pixels; the caller sizes the canvas |
| `playerPos` | `{x,y}`, or `null` for no player |
| `inventory` | `Set`; decides whether a door reads cleared and (outside playback) whether an item is still shown |
| `isPlayback` | Playback tracks pickups per location, dev flow by inventory |
| `checkedLocations` | `Set`; playback's per-location pickups |
| `ruleEvaluator` | `(rule) => boolean`, or `null` for the library's local evaluator |
| `fogEnabled` | boolean |
| `isTileVisible` | `(x,y) => boolean`, used only with fog |
| `seenTiles` | `Set` of `"x,y"`, or `null` for full blackout |
| `isExitVisible` / `isLocationVisible` | Discovery filters (playback only) |
| `isConsumableCollected` | `(x,y) => boolean`, or `null` when nothing tracks them |

`plainView({tilePx})` turns every filter off. `mazeRoomRender.test.js` runs in node without a canvas, so it compares an ordered draw-op log recorded by `drawOpRecorder.js`, which throws on any member it does not model.

## Plan stepping and the element overlay

`mazeLab.planFrames(state, solved)` replays the oracle's plan through the engine's `step` and returns one frame per position (player cell, `turn`, `state.blocks`, and the entry that produced it). ⏮ / ◀ STEP / STEP ▶ / ▶ PLAY, a scrub slider and the input strip walk the frames; a HUD prints `frame i/n · turn · player · inventory · blocks · input`, and the readout publishes the same frame (`shownFrame()`). Scrub, strip and play rate are view settings, not in the URL.

`planFrames` is `framesForActions(state, solved.plan.map(moveEntry))`. `framesForActions` takes shared `actionQueue` entries, expands `loops`, starts from `procgenMaze.startStateFor` (the oracle's start state) and steps through `mazeQueueExecutor.executeMazeEntry`, the executor the panel uses — so an oracle plan and a hand walk are the same array with a different `author`. A walk that does not replay returns `null`, except that an entry stamped `params.refused` counts as a completion and repeats the previous frame.

`?elements=` draws the gadget with `mazeElementOverlay.drawElementOverlay(ctx, model.elements, {tilePx, layer, blocks})`, after `drawWorld` and the area overlay. It is separate from `drawWorld` because the block moves: the frame's `state.blocks` is passed in, so the block visibly reaches its button and the button fills. It draws the site outline, the connector tunnel, block, button, guard door, flag and port stubs, with ids named once in the legend. A refused element prints the reason and still shows the carved level; `guard;len=2;turns=1` at 15×15 is the friendliest demo.

The edit palette's block, button and flag write the library entries the mechanism needs, with ids from `procgenCore/elements.guardIdsFor` / `flagIdFor`, so a hand-built gadget matches a generated one. Placing a button registers its `door_A{n}`; put that door at least two cells from the button.

## The area-graph overlay

`mazeAreaOverlay.drawAreaOverlay(ctx, model.areas, {tilePx, layer})` draws the graph after `drawWorld`. It is a separate overlay because the graph belongs to the generator's model, which the panel does not have. LAYER ▶ steps through cumulative layers:

| Layer | Adds |
|---|---|
| `off` | Nothing |
| `partition` | Each area shaded; synthetic entrance/goal areas outlined dashed |
| `locks` | Shading by key level, borders on door cells, `graphify` edges dashed between centroids |
| `keys` | Key cells ringed, solution path through the centroids |
| `all` | Everything |

The layer is a view setting and does not reset the ladder; changing `?areas=` or `?require=` does. Symbols are named once in the legend. A refused graph prints the reason and shows the carved level; a refused directive shows no level and no payload. At 11×11 with two keys most seeds refuse.

## The manual arm (`?source=manual`)

Arrows or WASD move and SPACE waits. **One key press is one shared `actionQueue` entry** (`mazeKeys.KEY_MAP`), appended to a live `ActionQueue` and executed at once by `executeMazeEntry`. The engine is turn-based, so there is no pacer or held-key state. Keys are bound on `window` under the mode's lifetime and call `preventDefault` only on bound keys while a session is started.

`mazeLabWalk.createWalkSession(state)` holds the non-DOM logic: it starts from `startStateFor`, pushes one `mazeLab.frameOf` per entry into the frame list the SOLVE controls read, and asks the oracle's own `goalPred` whether the walk arrived.

**A walk is a loops recording**: the loops `SavedQueue` envelope plus an additive `lab` block.

```json
{ "substrate": "maze", "format": "actionQueue/1", "regionName": null,
  "arrivalExitId": "entrance", "departureExitId": "goal",
  "actions": [{"actionType":"move","actionId":"S","substrate":"maze","loops":3}],
  "locationsChecked": [], "itemsPickedUp": [],
  "manaAtEntry": 0, "manaAtExit": 0, "manaMin": 0, "name": "lab: entrance→goal",
  "lab": { "generator": "frontend/modules/mazeRoom/lab.html",
           "payload": { "…the level's own labPayload…": true },
           "author": "hand", "reachedGoal": true, "refused": 1 } }
```

So a lab walk and a region visit are the same kind of document; SOLVE writes it with `author: "oracle"`.

- **A refused press is kept**, marked `params: {refused: true}`, because it still passes a turn for hazards. Its sentence is the engine's [`whyBlocked`](./maze.md#whyblocked--why-the-engine-refused-in-one-place).
- **LOAD** validates each action (`validateEntry`), loads the level (`loadPayload`, uncertified), checks the recording's preconditions, then replays with `framesForActions`. A walk the level will not take refuses at the turn index — *"input 1 (move (S)) is illegal on this level — move S blocked: wall at (1,1)"* — and nothing partial is drawn.
- **STOP** folds the walk into the envelope and replays it to check the round trip. There is no undo (`ActionQueue.removeAt` refuses the done region); RESTART re-opens the session. Switching modes keeps a stopped walk in its box and loses an unstopped one.
- **A hand walk that reaches the goal is a witness, not a certification**: the identity line says so and `certified` is unchanged. If the oracle refused the level and a hand walk still reaches the goal, the page prints `⛔ SEAM: …` in red.

### Recording preconditions

Every maze recording, the lab's and the panel's, may carry two top-level fields stamped by `mazeQueueExecutor.stampRecordingPreconditions` and checked before step 0 by `refuseReplayPreconditions`:

| Field | Content | On mismatch |
|---|---|---|
| `worldDigest` | `mazeWorldDigest`: 8-hex `fnv1a32` of the serialized level | Refuses: made on a different level. For a lab walk, that means `lab.payload.level` was edited after recording, and the message says so. |
| `requires` | Item ids the walk needed to pass obstacles (`deriveRequires`), minus those it picked up | Refuses naming every missing id. Button tokens are excluded; a recording crossing a `rule`-typed gate carries no `requires`. |

Both are optional; without them the replay's own step refusal is the safety net. See [Loop Recording and Block Modes](./loop-recording.md) for the panel's side.

## The set arm (`?source=set`)

The set mode edits a **region library** — a positionally addressed list of interchangeable maze rooms — through `procgenCore/setEditorView.mountSetEditor`, the same mount `watch.html` uses for Seedling. The strip, CONNECT gesture, rooms table, forms, rule box, REPORT and downloads are shared; this page supplies the maze bindings (`mazeSetLab.js` over `mazeSetAdapter.js`).

A library is pasted into the mode's own box, uploaded (`.json`, or a `.zip` bundle), picked from the served index (packs whose `substrates` include `maze`), or fetched with `?library=<url>`.

- **The load box is `#labSetText`.** The level save box `#labText` is rewritten on every render and would overwrite a pasted library.
- **A fetch failure is fatal; a content failure is not.** A failed `?library=` fetch refuses by name; a validation failure (`validateRegionLibrary`) is shown in the load box and the page keeps working.
- **A room opens inside this mode**, not by switching to `edit` (see [Gotchas](./gotchas.md)). Closing it folds its edits into one `replace-room` op (`closeRoomSession`).
- **ADD ROOM** mints `blankMazeRoomPayload({width, height})` (`mazeSetAdapter.js`): a doorless all-floor room, so the REPORT refuses the `rules.json` export until a connect gives it a door. `createWorld` refuses a dimension below 2 by name, and that message reaches the mode's note.

### Editing a world (`?world=<bundle>.zip`)

A **world** is a bundle of a Seedling level set, a region library and the `world.json` naming them (see [Architecture](./architecture.md)). The set mode opens it as one composite session over both parts' rooms; `lab.html` is the world editor's page.

- `?world=` names a `.zip`. A bare `world.json` holds no rooms and refuses by name, listing the parts it names.
- A world and a library are alternatives: loading one drops the other. Each part passes its own validator, and the world binds them by `doc_id`, never by position.
- Every cell shows its substrate (`readCell().substrate`). Maze cells are drawn with `makeDrawRoomStill`; Seedling cells get a card, because this page does not import Seedling's painter.
- A maze room opens on this page's canvas; a Seedling room opens in `watch.html`'s edit mode in a frame. Only one room session at a time; the strip refuses a second by name.
- A cross-part door is authored from the derived exit ids; `one_way` starts unset and must be chosen.
- The download is the four documents in one bundle (`world_id` minted at the press), plus an all-maze `rules.json` projection, since a mixed world does not play in the app yet.

## Hosted in the frontend

The page also opens inside the frontend in a `procgenLabPanel` panel (`frontend/modules/procgenLabPanel/`), unchanged. The panel mounts

```
./modules/mazeRoom/lab.html?iframeId=procgenLab-maze-1&hostOrigin=<host origin>
```

and talks to it over the `iframeAdapter` bridge. The vocabulary is defined once in `procgenCore/labProtocol.js` (`LAB_EVENTS`, field lists in `LAB_PAYLOAD_FIELDS`, one `assert*` per event) for both lab pages. Every payload carries `substrate` and `iframeId`.

| Event | Direction | Extra fields |
|---|---|---|
| `procgenLab:load` | host → page | `payload` |
| `procgenLab:navigate` | host → page | `search` |
| `procgenLab:requestState` | host → page | — |
| `procgenLab:ready` | page → host | `url` |
| `procgenLab:stateChanged` | page → host | `url`, `source`, `seed`, `step`, `identity`, `certified`, `edits`, `directives` |
| `procgenLab:levelChanged` | page → host | `payload` |
| `procgenLab:selectTile` | page → host | `tx`, `ty` |
| `procgenLab:openInApworldEditor` | page → host | `rules`, `source` |

`selectTile` fires on a canvas click in every mode. `openInApworldEditor` sends the set mode's compiled `rules.json`; the panel forwards it as `apworldEditor:loadRules` plus `ui:activatePanel`. Its button is hidden when the page is standalone. See [the APWorld editor](../../modules/apworldEditor.md#the-links-tab).

The in-page half, `mazeLabBridge.js`, is imported dynamically only when `?iframeId=` is present (`check-procgen-lab-hosting.mjs` checks a standalone load never fetches it). `window.__mazeLab.loaded` is true when the state came from a payload.

## The browser row

```
node scripts/procgen/check-maze-lab.mjs
node scripts/procgen/check-maze-lab.mjs --host=http://localhost:8000
```

It starts its own static server (`serveRepoRoot`) unless `--host=` is given, and never skips. It checks that the import graph has no `node:` or bare specifiers, the page loads without console errors, the browser reproduces node's level and trace byte for byte, STEP and restriction reach the loop, a click edit shows UNCERTIFIED, SOLVE re-certifies while a sealed entrance is REFUSED with the oracle's text, the payload round-trips, and the URL is a fixed point whose values match numbers the check states itself. It also drives the manual and set modes.

## Related documentation

- [Maze Substrate](./maze.md)
- [Loop Recording and Block Modes](./loop-recording.md)
- [Architecture](./architecture.md)
- [Flash Substrate](./flash.md) — Seedling's lab page and room hosting
