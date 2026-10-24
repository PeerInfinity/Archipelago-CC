# For Developers

This page is for people who want to work on the code. The project is a fork of [Archipelago](https://github.com/ArchipelagoMW/Archipelago) with three main parts: the **[procgen system](../developer/procgen/README.md)**, which generates and plays worlds in the browser; the **[exporter](../../../exporter/README.md)**, which writes a seed's full logic to JSON; and the **[web frontend](../../../frontend/README.md)**, which loads that JSON to track, play and visualise a world. Everything else, from the trackers to [Loop mode](../features/loops.md), builds on the shared [`rules.json`](../../../frontend/schema/rules.schema.json) format.

## Set up

- **[Getting Started for Developers](../developer/getting-started.md)** — clone, install, serve the frontend locally, and generate your first seed. On Windows, see **[Getting Started on Windows](../developer/getting-started-windows.md)**.
- **[Contributing](../../../README.md#contributing)** — how to fork, and how to keep a clean relationship with upstream Archipelago.

## Find your way around

- **[System Architecture](../developer/architecture.md)** — the exporter, `rules.json`, and the modular frontend.
- **[Procgen documentation](../developer/procgen/README.md)** — start with the [architecture overview](../developer/procgen/architecture.md), and read [Procgen Gotchas](../developer/procgen/gotchas.md) before changing anything. The [Substrate Registry Reference](../developer/procgen/substrate-registry.md) covers adding a substrate.
- **[Headless procgen scripts](../../../scripts/procgen/README.md)** — run the pipelines from the command line, outside the browser.
- **[Developer Documentation](../developer/README.md)** — the full index: guides to the state manager, module system and event system, and the reference pages.
- **[Module Reference](../modules/README.md)** — one page per frontend module.

The Python side has its own READMEs:

- **[Exporter](../../../exporter/README.md)** — the rule export pipeline and the game-specific handlers.
- **[World Generator](../../../world_generator/README.md)** — `rules.json` back to a Python world.
- **[Rule Builder](../../../rule_builder/README.md)** — the declarative rule format the exporter and the generator share.
- **[Frontend](../../../frontend/README.md)** — the web client's structure.

## Test

- **[Testing Pipeline](../developer/guides/testing-pipeline.md)** — the browser tests (`npm test`), the in-app test runner, and how to read and compare runs.
- **[Test Results](../developer/test-results/test-results-summary.md)** — how every supported game currently fares.
