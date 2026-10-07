# Playback and Debugging Tools

Tools for watching a generated world play itself: a playback bot that walks recorded playthroughs, the controller contract and iframe proxies it drives, shared timing and UI widgets, a forward simulator that writes sphere logs, and per-substrate visualizers.

Most of them are driven by a **sphere log**: the recorded order in which a playthrough collects progression items, in the JSONL format `exporter/sphere_logger.py` writes during seed generation.

## The playback bot (`frontend/modules/playbackBot/`)

A sphere-log-driven walker that auto-drives substrate panels through a recorded playthrough. It is substrate-agnostic above the controller boundary:

- It builds its visit queue from `sphereState`'s parsed sphere log, resolves each location's region via an index built from stateManager's static region data (`buildLocationIndex`), and uses the shared `PathFinder` for inter-region routing.
- For the current region it resolves the substrate's PlaybackController through the substrate registry and calls it directly (`play` / `stop` / `step` / `instant` / `reset` / `setRate` / `walkTo`) — bypassing the eventBus. Cross-region playback happens the same way keyboard play would: the substrate's exit-cross produces a `user:regionMove`, and the bot follows.
- The module owns the `playbackBotPanel` Golden Layout panel, registers the `playback:command` publisher, and subscribes to `user/system:locationCheck` and `user:regionMove` on the dispatcher, forwarding them to the active panel's bot. An active-panel singleton (`setActivePanel`/`getActivePanel`) lets those dispatcher receivers reach the bot without circular imports — the same pattern mazeRoom and procgenPipeline use.
- A persisted click-intercept toggle (`playbackBot_intercept`, off by default) and a bounded dispatcher event log (last 200 events) live in the panel UI.

**Restart as a route step (return to menu).** Where the slot declares `exporter[p].return_to_menu` (`procgenCore/restartWarp.js`), returning to the menu is always possible, and the bot's planner knows it without any edge into `Menu`. `procgenCore/restartRoute.js` `planRoute` answers the graph's walk from the player's region. Only when no walk exists, and the restart target (the Menu panel's `restartTargetOf`, `Menu`) has one, does it answer a route that BEGINS with a RESTART step (`steps[1].restart: true`). The tie-break is `ROUTE_TIE_BREAK` (`walk-before-restart`): a walk always wins, however long it is.
- The bot executes the step by calling the Menu panel's own Restart (the `menuPanel.restart` public function, the button's path), never an exit `walkTo`.
- It then waits on the restart target. The substrate takes the start hop (on Seedling the glue warps the game to `seedlingStartSpawn`), and the bot routes on from the arrival.
- The bot never takes the Restart while the active controller's leg is still playing. It first asks the controller's optional `settleBeforeRestart()`. A controller without it, or one that answers null, restarts at once, as before. The Seedling wasm controller answers its engine's `legEnd()`: a promise when a plan tape is playing, which resolves at the tape's held end. Until then the bot's status names the wait. A stop, a reset or a region move during the wait drops it. A leg that does not end within `RESTART_LEG_WAIT_MS` (30 s) is cut, and the status says so. Measured before this: the Restart after L17's chest stopped the 42-tick chest tape about 1.15 s in, at a wall-clock tick, so the room's clock at the start hop differed between runs. `getRestartDeferrals()` records each wait. On Seedling the glue then pushes the start hop's teleport in the Restart's own turn, because the stop released the room before the hop queued it. If the hop's load arrives in a later turn, the glue pushes at that load instead (`stats.restartPushes`, `at`: `restart` / `start-hop`). Before the push, the stop let the released room run, and the clock after the Restart differed by 0–2 ticks. The glue also tells the stopped wasm engines to expect the hop's arrival (`engine.expectArrival`, the crossing watch), so the landing is held and staged even when it beats the bot's next goal. Without that, 2 of 14 runs found an unwatched room: the adoption refused it (the player holds the Sword) and a forced re-arrival cost 2 frames. Measured on logical-links B (CI runs at one SHA): every clock after the Restart is the same relative to the start on every run, with 0 forced re-arrivals.
- Without the flag (fail-closed), the refusal is the old one, word for word: `error: no path from <region> to <goal>`.
- The bot also refuses by name when no Restart is wired, when Restart does not answer, or when Restart reports loop mode (loops' restart warps nobody).
- The region graph's one-step move takes the same step. The path analyzer and `analyzePathToRegion` answer AP reachability from the start and never need it.
- The live witness is `scripts/procgen/probe-seedling-restart-route.mjs` (a census RESTART-ONLY pocket, W and J; `--flag=off` is the fail-closed row).

**An arrival inside a solid escapes by its way out.** A Seedling arrival can land the player's box INSIDE a solid whose saved flag still holds, such as L12's door into L0 at (288,176) with the rock unbroken (an out-of-order arrival). The solver then refuses before any search, with `obstacle.kind: 'arrival-inside-solid'` and a `wayOut`: the Menu's Restart, plus the level's other arrivals.
- Both runtimes surface the refusal by name. The wasm engine's failure carries the `obstacle`. The JS page's walker fails the goal at once instead of walking from inside the solid.
- The Seedling controller translates `wayOut` into the bot's terms (`flashPanel/seedlingArrivalEscape.js`): it keeps the Restart offer and maps each other arrival to the AP exit whose sidecar door it is.
- When Restart is offered and the slot declares `return_to_menu`, the bot takes the same Restart step as above.
- The bot also remembers the entrance that landed inside. Every later route avoids it, through one of the refusal's other arrivals (`planRoute`'s `avoid`).
- Without the flag or a Restart offer, or when the player lands inside again, the bot makes a named stop that says which way out it could not take. ⚖ Nothing acts from inside the solid (no swing from inside).
- The live witness is `scripts/procgen/probe-seedling-arrival-escape.mjs` (W and J; `--flag=off` is the named stop, and `--expect=refusal` is the control).
- `scripts/procgen/probe-seedling-restart-held-items.mjs` measures that a Restart keeps the game's items, slot order and keys, and the AP inventory.

**A saved obstacle is broken before first use.** ⚖ The user ruled that a persisted obstacle is *"break before first use"*. The rules carry one event per saved obstacle flag (`event_kind: 'game_state'`, `flashPanel/seedlingObstacleEvents.js`): it sits on the obstacle's open side (`side`), names its far side (`across`), and gates every door whose landing is inside the obstacle.
- The state manager never collects such an event when it becomes reachable (`stateManager/core/eventKinds.js`). The runtime collects it when the GAME's flag is set (`flashPanel/seedlingEventCollector.js`, in the region glue): a cleared `pendingCheck` of its `{level, tag}`, which both runtimes report, or `botStatus().persistence_cleared` at load. It is collected as a local event check, never a server check, because the location has no id.
- ⚖ The direction is game → AP only. Nothing stages a flag the game did not set: the game is the authority for a broken rock. Every staged boot already carries the game's own clears (the wasm arrival staging, a continuation's declarations, the mid-room re-stage, and every JS boot).
- The bot never queues a game-state event: walking to one would break the obstacle eagerly. Where the graph has no walk, `procgenCore/eventRoute.js` plans one (`planRoute`'s `eventPath`, before any Restart). A hop through the obstacle at its own cost CREDITS the event, and the bot remembers the credit until the collector sees the flag. An event the route still needs is a goal visited first (a BREAK step).
- The playback map lists the events beside its entries and refusals; an unknown event kind is refused by name. A walk to an event stops by name: breaking an obstacle on purpose is the solver goal `clear-tag`, whose executor is not built.
- The live witness is `scripts/procgen/probe-seedling-obstacle-events.mjs` (W and J): the walk breaks L0's rock, the event is collected live and at load, and L12's door into L0 then lands clear of it.

When no sphere log is loaded, the bot acts as a plain remote control: it starts the substrate's own clock and leaves target choice to the substrate (the maze visualizer picks the alphabetically-first uncollected item or unvisited exit in the current region).

## The PlaybackController contract and iframe proxies

Substrates expose playback through `getPlaybackController()` on their registry entry; the contract (methods, `walkTo` target shape, null semantics) is specified in the [Substrate Registry Reference](./substrate-registry.md#playback).

For in-process substrates (maze), the controller is the live panel's own object. For iframe-hosted substrates there is no host-side object to call, so `textAdventureSubstrateWrapper/playbackProxy.js` provides the host-side **PlaybackProxy**: each method publishes the invocation as an eventBus event, and the in-iframe `playbackBridge.js` subscribes and executes it. Methods are fire-and-forget — the bot never awaits them; progress comes back through the ordinary dispatcher events (`user:locationCheck`, `user:regionMove`), identically for in-process and iframe substrates.

The proxy is reusable: it takes a `controlEvent` parameter, so other iframe substrates use the same class on their own channel — bounce constructs one on `bounce:playbackControl`, received by the shared flash bridge's playback receiver and translated into bot-driver targets ([Bounce Substrate](./bounce.md)).

A proxy cannot refuse a target, because its methods return nothing. Seedling rooms, both generated (`flash_seedling_gen`) and real atlas rooms (`flash_seedling`), need to refuse: generated rooms can only be walked on the Flash Panel's JS runtime, real rooms on the JS or the wasm runtime, and the bot must say so rather than wait. Their controller (`flashPanel/seedlingPlaybackController.js`, one instance per substrate) is therefore a host-side object that calls into the same-origin game page directly. `walkTo` returns `false` with a `lastRefusal` reason on a runtime it cannot walk. On the JS runtime the walk runs inside the page's own tick ([Flash Substrate](./flash.md#the-playback-bot-on-the-js-runtime)); on the wasm runtime a real room is solved at its arrival and played as one host tape ([Wasm playback](./flash.md#wasm-playback-solver-walk-w1-w2)). A refusal that comes after the target was accepted is published as `playback:walkFailed`; the bot turns both kinds into a named `error:` status. With the Flash Panel's `seedlingSolverWalk` setting on (on by default), the page asks the real solver for an atlas room's plan and plays its keys one per tick, re-solving when the game leaves the plan. The solve runs in a worker, and the room is held while it does. A solve that passes its 5 s budget is stopped. A goal the solver declines is walked by the walker, with the solver's reason in the status, and offered to the solver again later. While a solve is in flight the controller publishes `playback:walkNote` (*solving… (budget 5 s)*), and the bot shows the note after its status ([the solver mode](./flash.md#the-solver-mode-flashpanelseedlingsolverwalk)).

## Shared timing and UI primitives (`frontend/modules/shared/`)

- **`playbackClock.js`** — the substrate-neutral timing primitive: drives `onTick` at a configurable Hz with start/stop/single-step/rate controls. `_tick(nowMs)` is a pure decision function; production wraps it in a requestAnimationFrame scheduler, tests call it directly with controlled timestamps.
- **`playbackControlBar.js`** — the pure-DOM widget with instant / step / play / stop buttons and a speed slider (0.5–30 Hz). Callers wire the buttons to any controller-shaped object via the `actions` argument; it has no layout integration of its own. The maze panel and the playback bot panel both mount one.

Both live in the `shared/` git submodule.

## The forward simulator (`frontend/modules/shared/procgen/forwardSimulator.js`)

A substrate-neutral playthrough walker over `rules.json`, with two entry points sharing one set of accessibility primitives:

- `generateSphereLog(rulesDoc, opts)` — runs a full walk and returns a sphere log as JSONL-compatible entries. This is how the procgen pipeline embeds a sphere log into a compiled `rules.json`.
- `pickNextTarget(model, state)` — given current inventory and checked locations, returns the next `{ region, location, item, accessRule }` to seek. Nothing in the app calls it; the maze visualizer and the playback bot choose targets themselves.

Its faithfulness contract against Python: **integer-sphere contents must match `MultiWorld.get_spheres` exactly** (sphere boundaries snapshot reachability at sphere start; locations that become reachable mid-sphere belong to the next sphere), while fractional ordering *within* a sphere may differ (the walker picks alphabetically). The emitted format matches `exporter/sphere_logger.py`: a metadata entry, a `0` integer-header with initial accessibility sets, then one fractional entry per advancement-item pickup; filler items never appear as `sphere_locations`.

## The shared simulator core (`frontend/modules/shared/simulatorCore.js`)

Genre-agnostic search machinery shared by playbots, reachability analyzers, and generators:

- `reach(world, solver, startState, goalPred, options)` — a query wrapper over a pluggable solver.
- `makeBfsSolver({ step, inputs, visitedKey })` — a generic-search **feasibility** oracle closed over a per-game step function; bounce's `canJump` and the maze autopather both plug into it. A returned plan is the input sequence itself.
- A random-walker solver factory — a **difficulty** oracle: runs randomized trials through `step` and reports what fraction reach the goal within a step budget. Feasibility and difficulty are separate oracles, used together.

World/state/input shapes, step functions, and goal predicates are all per-game; only the contract is shared.

## Per-substrate visualizers

The maze panel's playthrough visualizer (`frontend/modules/mazeRoom/mazeRoomVisualizer.js`) drives an automated tile-walk through the loaded region, surfacing each step's outcome (move, pickup, exit-cross, blocked — with rule-evaluation context when blocked). It owns a PlaybackClock and its *own* simulated per-region state, publishing `playback:snapshotUpdated` for opt-in subscribers rather than touching `stateManager:snapshotUpdated`. Bounce's equivalent "watch it play" surface is the bot driver itself ([Bounce Substrate](./bounce.md)).

## Headless verification

The `scripts/procgen/` CLIs are the non-interactive counterparts: the dump scripts print a driver's full output, the `*-step.js` drivers expose the stepped pipelines, `dump-*-byteidentity.mjs` and `check-spiral-byteidentity.mjs` check the [byte-identity contract](./stepped-pipeline.md#the-byte-identity-contract), and `check-bounce-embed.mjs` drives the real frontend with Playwright. See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).

## Related documentation

- [Architecture](./architecture.md) — where playback sits in the runtime flow
- [Substrate Registry Reference](./substrate-registry.md) — the PlaybackController contract
- [Bounce Substrate](./bounce.md) — the bot driver and playback proxy in a real substrate
