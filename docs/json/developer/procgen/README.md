# Procedural Generation

Developer documentation for the procedural-generation ("procgen") system: the pipeline that generates multi-region game worlds in the browser, the substrates that provide per-region playable content, and the runtime that plays the result.

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Orientation: the pipeline, drivers, substrates, rules.json extensions, runtime, and Python round-trip. Read this first. |
| [Substrate Registry Reference](./substrate-registry.md) | The registry entry contract, field by field, with a capability matrix of the five substrates and a checklist for adding one. |
| [Gotchas and Disambiguations](./gotchas.md) | The things most likely to mislead someone orienting in the procgen code — naming overlaps, shared-code-vs-shared-identity, invariants. |

## Related documentation

- [Headless procgen scripts](../../../../scripts/procgen/README.md) — CLI reference for running the pipelines outside the browser
- [Loops feature](../../features/loops.md) — loop mode from the user side
- [Developer documentation index](../README.md)
