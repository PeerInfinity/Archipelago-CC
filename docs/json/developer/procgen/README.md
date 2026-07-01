# Procedural Generation

Developer documentation for the procedural-generation ("procgen") system: the pipeline that generates multi-region game worlds in the browser, the substrates that provide per-region playable content, and the runtime that plays the result.

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Orientation: the pipeline, drivers, substrates, rules.json extensions, runtime, and Python round-trip. Read this first. |
| [Substrate Registry Reference](./substrate-registry.md) | The registry entry contract, field by field, with a capability matrix of the five substrates and a checklist for adding one. |
| [Gotchas and Disambiguations](./gotchas.md) | The things most likely to mislead someone orienting in the procgen code — naming overlaps, shared-code-vs-shared-identity, invariants. |
| [Bounce Substrate](./bounce.md) | The Doodle-Jump-style platformer substrate: physics core, ability suppression, the canJump solver, the derive-rules verifier, level/braid generation, renderers, and the bot driver. |
| [Playback and Debugging Tools](./playback-and-debugging.md) | The playback bot, the PlaybackController proxies, shared clock/control-bar primitives, the forward simulator (sphere-log generation), and the simulator core. |
| [Maze Substrate](./maze.md) | The grid-of-tiles substrate: engine, biomes and wall backends, the action queue, content modules (hazards), the autopather, panel/editor. |
| [Sphere-Driven Growth](./sphere-growth.md) | The plan-first driver: the sphere plan and its oracle role, the stratification rule, gate compatibility, the three-phase tree split, config assembly. |
| [Paths and Obstacles](./paths-and-obstacles.md) | The intermediate access-rule representation: the item/obstacle vocabulary, per-substrate producers, the Rule Builder compiler, and the rule→requirement inverse. |

## Related documentation

- [Headless procgen scripts](../../../../scripts/procgen/README.md) — CLI reference for running the pipelines outside the browser
- [Loops feature](../../features/loops.md) — loop mode from the user side
- [Developer documentation index](../README.md)
