# Archipelago JSON Export Tools

A suite of tools for exporting, visualizing, and tracking Archipelago game logic.

This project exports all the multiworld data from an Archipelago seed generation — access rules, regions, locations, items, helper functions — to a JSON file. A JavaScript frontend reads this JSON, connects to an Archipelago server, and works as a logic-aware tracker. The project also includes an enhanced Universal Tracker, several new APWorlds, and alternate game modes.

Most of the code for this project was written by Claude.

**Live Demos:** [Latest Stable Version](https://peerinfinity.github.io/Archipelago/) | [Latest Development Version](https://peerinfinity.github.io/Archipelago-CC/)

**Installer APWorld:** [Download](https://github.com/PeerInfinity/Archipelago/raw/JSONExport/apworlds/json_tools_installer.apworld) — install into an existing Archipelago directory without cloning this repository

**Game Compatibility:** [Test Results](./docs/json/developer/test-results/test-results-fuzz-summary.md)

**Full Feature List:** [Features Overview](./docs/json/features/README.md)

## How the Tracker Works

The exporter reads the Python AST for the multiworld data, including the full logic of all access rules and Python helper functions. By default it converts everything to [Rule Builder](https://github.com/ArchipelagoMW/Archipelago/pull/5048) format before saving to JSON. Some games are fully supported without any custom code. Others require a custom exporter that may need updating for future world versions. A few also require custom JavaScript in the frontend to parse game-specific logic.

The JavaScript frontend reads this JSON, connects to an Archipelago server, and provides logic-aware tracking. The region graph displays all regions and locations, color coded by accessibility and check status.

The frontend has a **discovery mode** that works especially well with entrance shuffle. Connect to the server, open the Region Graph, and click on nodes as you discover them. The graph shows only the regions you've discovered, and highlights when they contain newly accessible locations.

## Universal Tracker Enhancements

In addition to the JavaScript tracker, there is a modified [Universal Tracker](https://github.com/FarisTheAncient/Archipelago) that uses the JSON data. It uses Rule Builder to convert the data back into a Python APWorld with the seed's settings baked in. This means UT's `/explain` feature works even on games that didn't implement explain support.

There is also a pickle-based exporter and a matching UT mode that loads the serialized multiworld directly. Some games work with pickle but not JSON, and vice versa. And some games work with the original UT but not either alternate version.

A **hybrid mode** automatically selects the best UT variant for each game based on [fuzz test results](./docs/json/developer/test-results/test-results-fuzz-summary.md).

All three of the new trackers fully support every ALttP setting combination — including inverted mode, glitches, and entrance shuffle — with 0 failures across 10,000 seeds.

## Installation

You can clone the whole repository, or use the **[installer APWorld](https://github.com/PeerInfinity/Archipelago/raw/JSONExport/apworlds/json_tools_installer.apworld)**, which adds an installer tool to the Archipelago Launcher menu. Use it to select which components to download and install into your Archipelago directory. The exporter runs automatically during seed generation via runtime hooks — no modifications to existing Archipelago files are needed.

The installer also has an option to patch world init files so the generator and exporter can run without requiring any ROM files.

For a detailed walkthrough, see the [User Quick Start Guide](./docs/json/user/quick-start.md). For tips and FAQs, see [Tips and Tricks](./docs/json/user/tips-and-tricks.md).

## New APWorlds

**[MetaMath](./worlds/metamath/docs/README.md)** — Turns any MetaMath theorem into a playable Archipelago world. Each proof step is a location, each proven statement is an item. The frontend includes modules that act as a MetaMath client. [Demo](https://peerinfinity.github.io/Archipelago-CC/?mode=metamath)

**[DepGraph](./docs/json/features/depgraph.md)** — Turns any directed acyclic graph into a playable world. Supports JSON, DOT, and CSV graph formats. Bundled examples include tech trees, skill trees, and recipe chains. Includes a tool to convert a to-do list into a dependency graph. [Demo](https://peerinfinity.github.io/Archipelago-CC/?mode=depgraph)

**[Journey to Ascension](./worlds/jta/docs/en_Journey%20to%20Ascension.md)** — An incremental/idle game integrated via the frontend's iframe interface. The APWorld randomizes game features, then an algorithm adjusts energy costs and XP multipliers to guarantee the game is completable with a specific strategy. [Demo](https://peerinfinity.github.io/Archipelago-CC/?mode=jta)

## Alternate Game Modes

**[Loops](./docs/json/features/loops.md)** — Turns any Archipelago game into an incremental game inspired by Idle Loops. Queue actions to move between regions, explore, and check locations, spending mana on each action. Spending mana in a region earns XP that reduces action costs in that region. Obtaining items boosts max mana. When mana runs out, the loop resets — but XP and checked locations persist. A cost generation algorithm guarantees at least one path through the game without grinding. [Demo](https://peerinfinity.github.io/Archipelago-CC/?mode=loops)

**[Maze Metagame](./docs/json/features/maze-metagame.md)** — A meta-progression layer using A-Mazing Idle. Before each region discovery or location check, complete a maze challenge. A proof of concept demonstrating the MetaGame system, which can layer any iframe-based game on top of Archipelago tracking. [Demo](https://peerinfinity.github.io/Archipelago-CC/?metagame=mazegame) | [Loops variant](https://peerinfinity.github.io/Archipelago-CC/?metagame=mazegameloops)

**Text Adventure** — Play through any Archipelago world as a text adventure. Originally built for testing, but works as a standalone interface for any game.

## Procedural Generation

The frontend can also **generate** game worlds, not just track them. The procgen pipeline builds complete multi-region worlds — regions, entrances, items, and physics-verified access rules — where each region is rendered by a pluggable **substrate**: a grid maze, a Doodle-Jump-style platformer, a text adventure, a recompiled Flash game, or an idle game, freely mixed within one world. The flagship driver plans the item-progression spheres first and grows a world guaranteed to realise them, with the plan doubling as a verification oracle.

Generated worlds compile to the same `rules.json` format as exported games, so everything above applies to them: they play in the browser, convert to Python APWorlds via the world generator, and run through real Archipelago multiworld generation. Loop mode integrates directly — a generated world can ship with loop costs baked in. A playback bot can auto-play any generated world from its sphere log, driving each substrate's actual gameplay.

See the [procgen developer documentation](./docs/json/developer/procgen/README.md) for the architecture and per-substrate details.

## Documentation

This project contains a full documentation suite for both users and developers.

- **[Documentation Portal](./docs/json/README.md)** — Main documentation index
- **[Features Overview](./docs/json/features/README.md)** — All major features with links to detailed docs
- **[User Overview](./docs/json/user/overview.md)** — What this project does and how to use it
- **[Developer Getting Started](./docs/json/developer/getting-started.md)** — Set up a development environment
- **[System Architecture](./docs/json/developer/architecture.md)** — High-level design overview
- **[Procedural Generation](./docs/json/developer/procgen/README.md)** — The procgen pipeline, substrates, and playback tooling
- **[Project Roadmap](./docs/json/project-roadmap.md)** — Status, known issues, and future plans

## About This Repository

This is the active development repository for the Archipelago JSON Export Tools project, configured for development with [Claude Code](https://claude.ai/code).

### Related Repositories

- **[PeerInfinity/Archipelago](https://github.com/PeerInfinity/Archipelago)** (JSONExport branch) - Stable snapshot, periodically updated with current files (no git history). Use this for a clean starting point.
- **[ArchipelagoMW/Archipelago](https://github.com/ArchipelagoMW/Archipelago)** - The main upstream Archipelago project.

### Repository Notes

- Code is maintained in the `main` branch
- This repository is configured for Claude Code development (session branches are preserved)
- The `frontend` directory is deployed to GitHub Pages automatically
- **Note:** The commit history contains large files. See "Contributing" below for implications.

### Contributing

**To contribute to this project:** Clone or fork normally. The large file history will increase clone size but won't affect your work.

**To contribute to upstream Archipelago or maintain your own clean fork:** Do not fork this repository directly. Instead:

1. Fork the [main ArchipelagoMW repository](https://github.com/ArchipelagoMW/Archipelago)
2. Copy the new directories (see [Repository Changes](./docs/json/developer/diffs/repository-changes.md))
3. Apply the diff files (see [Diff Files](./docs/json/developer/diffs/README.md))

This approach ensures your fork maintains a clean relationship with the upstream Archipelago project.

## Credits

- Based on the original [Archipelago](https://github.com/ArchipelagoMW/Archipelago) multiworld system.
- Web client interface derived from [ArchipIDLE](https://github.com/LegendaryLinux/archipidle-client).
- Loop mode inspired by games like [Idle Loops](https://github.com/dmchurch/omsi-loops/), Increlution, and Stuck In Time.
- Uses [Golden Layout](https://github.com/golden-layout/golden-layout) for panel management.
- Uses [CodeMirror](https://github.com/codemirror/codemirror5)
- Uses [Cytoscape.js](https://github.com/cytoscape/cytoscape.js) for graph visualization
- Uses [metamath-py](https://pypi.org/project/metamath-py/) for the MetaMath apworld
- Uses [Rule Builder](https://github.com/ArchipelagoMW/Archipelago/pull/5048) by drtchops
- Universal Tracker based on [FarisTheAncient/Archipelago](https://github.com/FarisTheAncient/Archipelago)
- Fuzzer based on [Archipelago-fuzzer](https://github.com/Eijebong/Archipelago-fuzzer) by Eijebong
- APWorld Manager from [silasary/Archipelago](https://github.com/silasary/Archipelago)
- APWorld Index from [silasary/apworlds](https://github.com/silasary/apworlds)
- APWorld and Iframe integration of [Journey to Ascension](https://github.com/meneth/journey-to-ascension/) by Meneth
- Iframe integration of [A-Mazing-Idle](https://imgreghenry.github.io/A-Mazing-Idle/) by ImGregHenry
