# For World Builders

This page is for people who want to make Archipelago worlds. The main way to do that here is the **[procgen pipeline](../features/procgen.md)**, which generates complete worlds in the browser. You can also author a world directly from a [graph](../features/depgraph.md), a [proof](../../../worlds/metamath/docs/README.md), or an existing game's logic, with the [World Generator](../../../world_generator/README.md). It assumes you know how an Archipelago world is put together: regions, locations, items and access rules.

## Generate a world

The **[Procgen Pipeline](../features/procgen.md)** panel builds a world from a seed and a few choices: which substrates draw its regions (maze, text adventure, the Bounce platformer, Noiz2sa stages, Seedling rooms, and the idle games in Loop mode), how many regions of each, and which items it is about. The access rules are not just written down: for substrates such as Bounce and Seedling they are derived from the game's physics and checked, so if the logic says you need an item to reach an exit, that is true in play. The result compiles to a standard `rules.json`, the same format this project exports from real games, so the whole app works on it.

The pipeline has several layout modes, each with its own tutorial:

- **[Sphere growth](../user/tutorials/procgen-sphere-growth.md)** — the default. It plans the item progression first, sphere by sphere, and then grows a world guaranteed to match the plan. The plan doubles as a proof that the world can be finished as intended.
- **[Shuffled spiral](../user/tutorials/procgen-shuffled-spiral.md)** — regions laid out from a centre cell outwards, in shuffled zones.
- **[Top-down](../user/tutorials/procgen-top-down.md)** — starts from an existing game's `rules.json` and realises each of its regions as a generated room, keeping the original access rules.
- **[Grid growth](../user/tutorials/procgen-grid-growth.md)** — the original grower, which grows regions cell by cell.

The panel's **Preset** drop-down holds ready-made configurations, one per feature. **[Procgen: settings and the Playback Bot](../user/tutorials/procgen-settings-and-bot.md)** covers the parameters and running the pipeline one step at a time. Between steps you can open a generated region in its editor: **[Procgen: editing a bounce region](../user/tutorials/procgen-bounce-region-editor.md)**.

## Ship it to Archipelago

A generated world converts to a Python APWorld and runs through real Archipelago generation. **[Procgen: from a generated world to a multiworld](../user/tutorials/procgen-to-multiworld.md)** goes the whole way, from generating to playing in a locally hosted multiworld.

## Generate from the command line

The pipeline also runs headless in Node, so it can be scripted. The scripts in [`scripts/procgen/`](../../../scripts/procgen/README.md) generate a world from command-line options and write a standard `rules.json`; the same options and seed always produce the same file. The format is described by [`rules.schema.json`](../../../frontend/schema/rules.schema.json).

## Explore the generators

- **[The procgen demo catalogue](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html)** — every demonstrable feature of the lab pages, each with the link that shows it and the command that reproduces it.
- **[The maze lab](https://peerinfinity.github.io/Archipelago-CC/modules/mazeRoom/lab.html)** — generate, edit, solve and play maze levels from URL parameters alone.
- **[What each substrate can do](../features/procgen-substrates.md)** — the capability chart, generated from the code.
- **[Procedural Generation](../features/procgen.md)** — the feature page.

## Author a world directly

- **[DepGraph](../features/depgraph.md)** — any directed acyclic graph, in JSON, DOT or CSV, becomes a playable world. **[DepGraph: more graphs, and your own](../user/tutorials/depgraph-extras.md)**.
- **[MetaMath](../../../worlds/metamath/docs/README.md)** — any MetaMath theorem becomes a world: each proof step is a location, each proven statement an item.
- **[World Generator](../../../world_generator/README.md)** — turns any `rules.json`, exported or generated, into a Python world package, using the [Rule Builder](../../../rule_builder/README.md).

## Going deeper

The [procgen developer documentation](../developer/procgen/README.md) explains how the pipeline and the substrates work, starting with the [architecture overview](../developer/procgen/architecture.md). To add a substrate of your own, read [For Developers](./for-developers.md) next.
