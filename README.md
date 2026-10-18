# Archipelago JSON Export Tools

A set of tools for working with Archipelago multiworld logic in JSON format.

An **exporter** runs during Archipelago multiworld generation and saves the multiworld's full logic to a `rules.json` file. A **frontend web page** holds a suite of tools that use this data: it connects to an Archipelago server as a logic-aware tracker, and it is the game client for several games in this repository. Its **APWorld Editor** edits a world's regions, exits, locations, access rules and items, and builds a working Python `.apworld` from any `rules.json`, directly in the browser.

The frontend also **generates** worlds. A collection of games act as procedural-generation **substrates**. In the **Procgen Pipeline** panel you choose the settings for a whole world; in its Sphere Growth mode the pipeline builds the contents of each region with that substrate's own procedural generation, then assembles the regions into a complete world with valid Archipelago progression logic. The pipeline hands the world to the APWorld Editor, which exports it as a `.apworld`. Several substrates can be combined in one world, so an exit in a maze region can lead to the entrance of a platformer region. Editors let you change a region's contents and the connections between regions by hand. These tools also work from the command line. Some substrates share stats and resources directly, without each update going through an Archipelago server.

**Loop mode** plays any of these worlds as an incremental game in the style of Idle Loops: player actions spend a pool of mana, the game restarts when it runs out, and XP and some other resources carry over between runs. Every procgen substrate supports it. Every substrate also has a **Playback Bot** that plays a region or the whole world. For Seedling, Bounce and Maze the pipeline checks each region it generates with the same game code the bot plays with, so a generated region is one a player can complete. Combined with Loop mode, the bot turns a substrate into an incremental game, or a fully idle one.

**AI disclosure:** The code and documentation in this repository are predominantly AI-generated, written with [Claude Code](https://claude.ai/code). This applies to the Archipelago-CC project's own work; bundled upstream projects (see Credits) remain the work of their original authors.

**Live Demos:** [Development Version](https://peerinfinity.github.io/Archipelago-CC/) (includes procedural generation) | [Stable Version](https://peerinfinity.github.io/Archipelago/) (an older snapshot: tracking only)

**Start Here:** [New to Archipelago](./docs/json/intro/introduction-to-archipelago.md) | [For Players](./docs/json/intro/for-players.md) | [For World Builders](./docs/json/intro/for-world-builders.md) | [For Developers](./docs/json/intro/for-developers.md)

**Guided Tour:** [Read it](./docs/json/user/guided-tour.md), or [start it inside the app](https://peerinfinity.github.io/Archipelago-CC/?game=procgen_maze&seed=1&tutorial=guided-tour), where the Tutorial panel can do each step for you

## Procedural Generation

Substrates include a grid maze, a text adventure, a Doodle-Jump-style platformer, a Noiz2sa shoot-'em-up stage, rooms of *Seedling*, a Flash game recompiled to run in the browser, and, in Loop mode, zones of the idle games *Journey to Ascension* and *Idle Loops*. For physics-based substrates the access rules are derived from the game's physics and verified, so if the logic says you need an item to reach an exit, that is true in play.

The primary driver, **sphere growth**, plans the item-progression spheres first and then grows a world guaranteed to realise them; the plan doubles as a verification oracle. Other modes lay worlds out as a shuffled spiral, or start from an existing game's `rules.json` and realise each of its regions as a generated room. Generated worlds compile to the same `rules.json` format as exported games, so they play in the browser, track, and run through real Archipelago multiworld generation.

**From the command line:** the pipeline also runs headless in Node, so external tools can script it. The scripts in [`scripts/procgen/`](./scripts/procgen/README.md) generate a world from command-line options and write a standard `rules.json`; the same options and seed always produce the same file.

See [Procedural Generation](./docs/json/features/procgen.md) for the feature, [What each substrate can do](./docs/json/features/procgen-substrates.md) for the capability chart, and the [procgen developer documentation](./docs/json/developer/procgen/README.md) for the architecture.

## The Exporter and the Tracker

The exporter reads the Python AST for the multiworld data from an Archipelago seed generation, including the full logic of all access rules and Python helper functions, and writes it to JSON. By default it converts everything to [Rule Builder](https://github.com/ArchipelagoMW/Archipelago/pull/5048) format. Some games are fully supported without any custom code. Others require a custom exporter that may need updating for future world versions, and a few also require custom JavaScript in the frontend to parse game-specific logic. **Game Compatibility:** [Test Results](./docs/json/developer/test-results/test-results-fuzz-summary.md)

The JavaScript frontend reads this JSON, connects to an Archipelago server, and provides logic-aware tracking. The region graph displays all regions and locations, color coded by accessibility and check status. Its **discovery mode** works especially well with entrance shuffle: open the Region Graph and click on nodes as you discover them, and the graph shows only the regions you've discovered, highlighting when they contain newly accessible locations.

**[Universal Tracker enhancements](./docs/json/features/universal-tracker.md):** a modified [Universal Tracker](https://github.com/FarisTheAncient/Archipelago) uses the JSON data. It uses Rule Builder to convert the data back into a Python APWorld with the seed's settings baked in, so UT's `/explain` feature works even on games that didn't implement explain support. A pickle-based exporter with a matching UT mode loads the serialized multiworld directly, and a **hybrid mode** selects the best UT variant for each game based on the fuzz test results. All three of the new trackers fully support every ALttP setting combination — including inverted mode, glitches, and entrance shuffle — with 0 failures across 10,000 seeds.

## Other Worlds and Modes

**[MetaMath](./worlds/metamath/docs/README.md)** — Turns any MetaMath theorem into a playable Archipelago world. Each proof step is a location, each proven statement is an item. The frontend includes modules that act as a MetaMath client. [Demo](https://peerinfinity.github.io/Archipelago-CC/?mode=metamath)

**[DepGraph](./docs/json/features/depgraph.md)** — Turns any directed acyclic graph into a playable world. Supports JSON, DOT, and CSV graph formats. Bundled examples include tech trees, skill trees, and recipe chains. Includes a tool to convert a to-do list into a dependency graph. [Demo](https://peerinfinity.github.io/Archipelago-CC/?mode=depgraph)

**[Loops](./docs/json/features/loops.md)** — Turns any Archipelago game into an incremental game inspired by Idle Loops. Queue actions to move between regions, explore, and check locations, spending mana on each action. Spending mana in a region earns XP that reduces action costs in that region. Obtaining items boosts max mana. When mana runs out, the loop resets — but XP and checked locations persist. A cost generation algorithm guarantees at least one path through the game without grinding. [Demo](https://peerinfinity.github.io/Archipelago-CC/?mode=loops)

**Text Adventure** — Play through any Archipelago world as a text adventure. Originally built for testing, but works as a standalone interface for any game. [Demo](https://peerinfinity.github.io/Archipelago-CC/?mode=textadventure)

**Full Feature List:** [Features Overview](./docs/json/features/README.md)

## Installation

You can clone the whole repository, or use the **[installer APWorld](https://github.com/PeerInfinity/Archipelago/raw/JSONExport/apworlds/json_tools_installer.apworld)**, which adds an installer tool to the Archipelago Launcher menu. Use it to select which components to download and install into your Archipelago directory. The exporter runs automatically during seed generation via runtime hooks — no modifications to existing Archipelago files are needed. It can install from the stable snapshot or from this development repository.

The installer also has an option to patch world init files so the generator and exporter can run without requiring any ROM files.

For a detailed walkthrough, see the [User Quick Start Guide](./docs/json/user/quick-start.md). For tips and FAQs, see [Tips and Tricks](./docs/json/user/tips-and-tricks.md). To develop, start with [Getting Started for Developers](./docs/json/developer/getting-started.md).

## Documentation

- **[Start Here](./docs/json/intro/README.md)** — the four introductions: new to Archipelago, players, world builders, developers
- **[Guided Tour](./docs/json/user/guided-tour.md)** — the highlights in ten minutes, directly in the live demo
- **[Documentation Portal](./docs/json/README.md)** — the main documentation index
- **[Features Overview](./docs/json/features/README.md)** — all major features with links to detailed docs
- **[User Overview](./docs/json/user/overview.md)** — what this project does and how to use it
- **[Procedural Generation](./docs/json/developer/procgen/README.md)** — the procgen pipeline, substrates, and playback tooling
- **[Developer Getting Started](./docs/json/developer/getting-started.md)** and **[System Architecture](./docs/json/developer/architecture.md)**

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
- Uses [CodeMirror](https://github.com/codemirror/dev)
- Uses [Cytoscape.js](https://github.com/cytoscape/cytoscape.js) for graph visualization, with the [fCoSE](https://github.com/iVis-at-Bilkent/cytoscape.js-fcose) layout and [edgehandles](https://github.com/cytoscape/cytoscape.js-edgehandles) extensions
- Uses [archipelago.js](https://github.com/ThePhar/archipelago.js) by Zach Parks (MIT), [jQuery](https://jquery.com/), [JSZip](https://stuk.github.io/jszip/) and [marked](https://github.com/markedjs/marked)
- Uses [metamath-py](https://pypi.org/project/metamath-py/) for the MetaMath apworld
- Uses [Rule Builder](https://github.com/ArchipelagoMW/Archipelago/pull/5048) by drtchops
- Universal Tracker based on [FarisTheAncient/Archipelago](https://github.com/FarisTheAncient/Archipelago)
- Fuzzer based on [Archipelago-fuzzer](https://github.com/Eijebong/Archipelago-fuzzer) by Eijebong
- APWorld Manager from [silasary/Archipelago](https://github.com/silasary/Archipelago)
- APWorld Index from [silasary/apworlds](https://github.com/silasary/apworlds)
- APWorld and Iframe integration of [Journey to Ascension](https://github.com/meneth/journey-to-ascension/) by Meneth (used with permission, non-commercial; see [NOTICE.md](NOTICE.md))
- [Seedling](https://github.com/PeerInfinity/Seedling) by Connor Ullmann, music and sound effects by Rekcahdam (released into the public domain), built with the FlashPunk library and the Ogmo Editor
- Flash games recompiled to WebAssembly with SWFRecomp and SWFModernRuntime by LittleCube (MIT), via the [SWFRecomp-CC](https://github.com/PeerInfinity/SWFRecomp-CC) fork; the in-browser recompiler's bundled libraries are listed in [swfrecomp-browser](https://github.com/PeerInfinity/swfrecomp-browser)
- The Noiz2sa substrate plays Kenta Cho's Noiz2sa (BSD) with a JavaScript port of shinichiro.h's libBulletML (BSD), via [bulletml-dodge](https://github.com/PeerInfinity/bulletml-dodge)
- The Idle Loops substrate runs [Idle Loops](https://github.com/StopSign/stopsign.github.io) by StopSign, via the [omsi-loops](https://github.com/dmchurch/omsi-loops) fork
- Optional Flash playback through [Ruffle](https://ruffle.rs/), loaded from a CDN
