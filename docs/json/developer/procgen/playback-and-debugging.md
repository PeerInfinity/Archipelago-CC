# Playback and Debugging Tools

The procgen stack ships a family of tools for *watching a world play itself*: a playback bot that walks recorded playthroughs, a substrate-neutral controller contract with iframe proxies, shared timing/UI primitives, a forward simulator that generates sphere logs, and per-substrate visualizers. The common thread is the **sphere log** — the recorded order in which a playthrough collects progression items (the same JSONL format `exporter/sphere_logger.py` emits during seed generation).

## The playback bot (`frontend/modules/playbackBot/`)

A sphere-log-driven walker that auto-drives substrate panels through a recorded playthrough. It is substrate-agnostic above the controller boundary:

- It builds its visit queue from `sphereState`'s parsed sphere log, resolves each location's region via an index built from stateManager's static region data (`buildLocationIndex`), and uses the shared `PathFinder` for inter-region routing.
- For the current region it resolves the substrate's PlaybackController through the substrate registry and calls it directly (`play` / `stop` / `step` / `instant` / `reset` / `setRate` / `walkTo`) — bypassing the eventBus. Cross-region playback happens the same way keyboard play would: the substrate's exit-cross produces a `user:regionMove`, and the bot follows.
- The module owns the `playbackBotPanel` Golden Layout panel, registers the `playback:command` publisher, and subscribes to `user/system:locationCheck` and `user:regionMove` on the dispatcher, forwarding them to the active panel's bot. An active-panel singleton (`setActivePanel`/`getActivePanel`) lets those dispatcher receivers reach the bot without circular imports — the same pattern mazeRoom and procgenPipeline use.
- A persisted click-intercept toggle (`playbackBot_intercept`, off by default) and a bounded dispatcher event log (last 200 events) live in the panel UI.

When no sphere log is loaded, target selection falls to the forward simulator's `pickNextTarget` (below), so bot, visualizer, and log generator never re-implement "what should be sought next".

## The PlaybackController contract and iframe proxies

Substrates expose playback through `getPlaybackController()` on their registry entry; the contract (methods, `walkTo` target shape, null semantics) is specified in the [Substrate Registry Reference](./substrate-registry.md#playback).

For in-process substrates (maze), the controller is the live panel's own object. For iframe-hosted substrates there is no host-side object to call, so `textAdventureSubstrateWrapper/playbackProxy.js` provides the host-side **PlaybackProxy**: each method publishes the invocation as an eventBus event, and the in-iframe `playbackBridge.js` subscribes and executes it. Methods are fire-and-forget — the bot never awaits them; progress comes back through the ordinary dispatcher events (`user:locationCheck`, `user:regionMove`), identically for in-process and iframe substrates.

The proxy is deliberately reusable: it takes a `controlEvent` parameter, so other iframe substrates use the same class on their own channel — bounce constructs one on `bounce:playbackControl`, received by the shared flash bridge's playback receiver and translated into bot-driver targets ([Bounce Substrate](./bounce.md)).

## Shared timing and UI primitives (`frontend/modules/shared/`)

- **`playbackClock.js`** — the substrate-neutral timing primitive: drives `onTick` at a configurable Hz with start/stop/single-step/rate controls. `_tick(nowMs)` is a pure decision function; production wraps it in a requestAnimationFrame scheduler, tests call it directly with controlled timestamps.
- **`playbackControlBar.js`** — the pure-DOM widget with instant / step / play / stop buttons and a speed slider (0.5–30 Hz). Callers wire the buttons to any controller-shaped object via the `actions` argument; it has no layout integration of its own. The maze panel and the playback bot panel both mount one.

Both live in the `shared/` git submodule.

## The forward simulator (`frontend/modules/shared/procgen/forwardSimulator.js`)

A substrate-neutral playthrough walker over `rules.json`, with two entry points sharing one set of accessibility primitives:

- `generateSphereLog(rulesDoc, opts)` — runs a full walk and returns a sphere log as JSONL-compatible entries. This is how the procgen pipeline embeds a sphere log into a compiled `rules.json`.
- `pickNextTarget(model, state)` — given current inventory and checked locations, returns the next `{ region, location, item, accessRule }` to seek. Used by the playthrough visualizer and the playback bot when no recorded log is loaded.

Its faithfulness contract against Python: **integer-sphere contents must match `MultiWorld.get_spheres` exactly** (sphere boundaries snapshot reachability at sphere start; locations that become reachable mid-sphere belong to the next sphere), while fractional ordering *within* a sphere may differ (the walker picks alphabetically). The emitted format matches `exporter/sphere_logger.py`: a metadata entry, a `0` integer-header with initial accessibility sets, then one fractional entry per advancement-item pickup; filler items never appear as `sphere_locations`.

## The shared simulator core (`frontend/modules/shared/simulatorCore.js`)

Genre-agnostic search machinery shared by playbots, reachability analyzers, and generators:

- `reach(world, solver, startState, goalPred, options)` — a query wrapper over a pluggable solver.
- `makeBfsSolver({ step, inputs, visitedKey })` — a generic-search **feasibility** oracle closed over a per-game step function; bounce's `canJump` and the maze autopather both plug into it. A returned plan is the input sequence itself.
- A random-walker solver factory — a **difficulty** oracle: runs randomized trials through `step` and reports what fraction reach the goal within a step budget. Feasibility and difficulty are deliberately separate oracles used together.

World/state/input shapes, step functions, and goal predicates are all per-game; only the contract is shared.

## Per-substrate visualizers

The maze panel's playthrough visualizer (`frontend/modules/mazeRoom/mazeRoomVisualizer.js`) drives an automated tile-walk through the loaded region, surfacing each step's outcome (move, pickup, exit-cross, blocked — with rule-evaluation context when blocked). It owns a PlaybackClock and its *own* simulated per-region state, publishing `playback:snapshotUpdated` for opt-in subscribers rather than touching `stateManager:snapshotUpdated`. Bounce's equivalent "watch it play" surface is the bot driver itself ([Bounce Substrate](./bounce.md)).

## Headless verification

The `scripts/procgen/` CLIs are the non-interactive counterparts: the dump scripts print a driver's full output, the `*-step.js` drivers expose the stepped pipelines, `verify-*.mjs` scripts check byte-identity, and `verify-bounce-embed.mjs` drives the real frontend with Playwright. See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).

## Related documentation

- [Architecture](./architecture.md) — where playback sits in the runtime flow
- [Substrate Registry Reference](./substrate-registry.md) — the PlaybackController contract
- [Bounce Substrate](./bounce.md) — the bot driver and playback proxy in a real substrate
