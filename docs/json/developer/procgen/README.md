# Procedural Generation

Developer documentation for the procedural-generation ("procgen") system: the pipeline that generates multi-region game worlds in the browser, the substrates that provide per-region playable content, and the runtime that plays the result.

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Orientation: the pipeline, drivers, substrates, rules.json extensions, runtime, and Python round-trip. Read this first. |
| [Substrate Registry Reference](./substrate-registry.md) | The registry entry contract, field by field, with a capability matrix of the seven substrates and a checklist for adding one. |
| [Gotchas and Disambiguations](./gotchas.md) | The things most likely to mislead someone orienting in the procgen code — naming overlaps, shared-code-vs-shared-identity, invariants. |
| [Bounce Substrate](./bounce.md) | The Doodle-Jump-style platformer substrate: physics core, ability suppression, the canJump solver, the derive-rules verifier, level/braid generation, renderers, and the bot driver. |
| [Runner Substrate](./runner.md) | The auto-runner platformer substrate: the GMTK toolkit physics port, the canRun solver and its doom/touch/launch model, strip generation and spec planning, and the greedy re-plan bot. |
| [Playback and Debugging Tools](./playback-and-debugging.md) | The playback bot, the PlaybackController proxies, shared clock/control-bar primitives, the forward simulator (sphere-log generation), and the simulator core. |
| [Loop Recording and Block Modes](./loop-recording.md) | Per-block Manual/Record/Playback modes and the Instant toggle, the saved-recording store and tags, the Record/Playback flows, and the coarse-only vs. fine-grained capture contract. |
| [Maze Substrate](./maze.md) | The grid-of-tiles substrate: engine, biomes and wall backends, the action queue, content modules (hazards), the autopather, panel/editor. |
| [Sphere-Driven Growth](./sphere-growth.md) | The plan-first driver: the sphere plan and its oracle role, the stratification rule, gate compatibility, the three-phase tree split, config assembly. |
| [Paths and Obstacles](./paths-and-obstacles.md) | The intermediate access-rule representation: the item/obstacle vocabulary, per-substrate producers, the Rule Builder compiler, and the rule→requirement inverse. |
| [The Stepped Pipeline](./stepped-pipeline.md) | Running drivers as editable steps: the envelope, sphere/top-down step lists, byte identity, region editors, envelope rebuild, per-step CLIs. |
| [Text Adventure Substrate](./text-adventure.md) | The prose-rendered tile-grid substrate: the AP-naive engine, the iframe wrapper, and the two-module coexistence. |
| [Seedling Real-Game Bot](./seedling-bot.md) | Driving the real recompiled Seedling with an input tape, and the differential that checks a JS physics transcription — movement, collision, room transitions and A\* pathing — against what the game actually did. |
| [Flash Substrate](./flash.md) | Recompiled Flash games as regions: the `__swfBridge` contract and the per-game entry factory the bounce substrate builds on. |
| [JtA Substrate](./jta.md) | Journey to Ascension as the reference zone-based substrate, with host-side shared-mana brokering. |
| [Omsi Substrate](./omsi.md) | Idle Loops as a loop-game substrate: the host-owned clock and mana mirror, N regions overlaying one town, and the arc-D loops-mode support (step gate, per-region queues, plan-snapshot Record/Playback). |

## Related documentation

- [Headless procgen scripts](../../../../scripts/procgen/README.md) — CLI reference for running the pipelines outside the browser
- [Loops feature](../../features/loops.md) — loop mode from the user side
- [Developer documentation index](../README.md)
