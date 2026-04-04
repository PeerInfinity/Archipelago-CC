# Features

An overview of the major features in the Archipelago JSON Export Tools project.

## Core Tools

| Feature | Description | Overview |
|---------|-------------|----------|
| **JSON Exporter** | Exports multiworld game logic (rules, regions, items, locations) to a standardized JSON format | [exporter/README.md](../../../exporter/README.md) |
| **Web Frontend & Tracker** | Modular browser-based tracker with region graph visualization, discovery mode, reachability analysis, and multiple game modes. [Live demo](https://peerinfinity.github.io/Archipelago-CC/) | [frontend/README.md](../../../frontend/README.md) |
| **JSON Tools Installer** | APWorld package for installing JSON Tools into a vanilla Archipelago installation — no repository clone needed | [worlds/json_tools_installer/README.md](../../../worlds/json_tools_installer/README.md) |
| **Skip Required Files** | Generate seeds without ROM files for testing, CI/CD, and tool development | [skip-required-files.md](skip-required-files.md) |

## World Generation & Tracking

| Feature | Description | Overview |
|---------|-------------|----------|
| **World Generator** | Converts JSON rules files back into fully functional Python Archipelago world packages | [world_generator/README.md](../../../world_generator/README.md) |
| **Universal Tracker Enhancements** | Three tracking modes (worldgen, pickle, original) with hybrid auto-selection per game | [universal-tracker.md](universal-tracker.md) |
| **Rule Builder Extensions** | 15 new rule types, AST format support, explain support, and pathfinding — extending upstream PR #5048 | [rule_builder/README.md](../../../rule_builder/README.md) |
| **Fuzzer Improvements** | Reproducible seeded fuzzing, option exclusion, early termination — enabling comprehensive cross-game validation | [fuzzer.md](fuzzer.md) |

## New Games & Modes

See the **[Playable Games Index](../games/README.md)** for all games and game modes, including DepGraph, Loops, MetaMath, Journey to Ascension, Maze Metagame, Text Adventure, and Vibe Coding Simulator.
