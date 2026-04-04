# Maze Metagame

**Live demo:** [Standard](https://peerinfinity.github.io/Archipelago-CC/?metagame=mazegame) | [With Loops](https://peerinfinity.github.io/Archipelago-CC/?metagame=mazegameloops)

A meta-progression layer that gates Archipelago actions behind procedurally-generated maze puzzles. Before you can move to a new region or check a location, you must navigate through a maze.

## How to Play

1. Play any Archipelago game through the web client with the maze metagame enabled
2. When you try to move to a region or check a location, a maze appears
3. Solve the maze by navigating through it (or use the game's built-in bot)
4. On completion, your original action goes through
5. Earn upgrades that persist across mazes, making future challenges easier

## Core Mechanics

The maze puzzles come from [A-Mazing-Idle](https://imgreghenry.github.io/A-Mazing-Idle/), a browser incremental game with:

- **15+ biomes** with distinct visual themes and mechanics
- **40+ upgrade types** that persist across mazes (movement speed, automation, pathfinding)
- **Incremental progression** — early mazes are simple, but upgrades accumulate to handle complex ones

## Modes

- **Standard** (`?metagame=mazegame`) — Mazes required for all tracker actions
- **With Loops** (`?metagame=mazegameloops`) — Integrates with Loops mode, applies automatic pre-configured upgrades

## Display Options

- **Iframe mode** (default) — Maze appears in a panel within the web client
- **Window mode** (`?useWindow=1`) — Maze opens in a separate browser window

## Further Reading

- [Detailed feature overview](../../features/maze-metagame.md)
