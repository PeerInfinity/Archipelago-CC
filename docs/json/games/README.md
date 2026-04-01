# Playable Games

Games and game modes playable through the Archipelago JSON Tools web client.

Each game has its own documentation covering how to play, game mechanics, and configuration. For technical module documentation, see the [Frontend Module Reference](../modules/README.md). For the broader feature overview (including non-game features), see the [Features Index](../features/README.md).

## Game Modes

These are alternate ways to interact with the tracker. They work with any Archipelago world.

| Game | Description | Docs |
|------|-------------|------|
| **Loops** | Incremental/idle game layered on the tracker — queue actions, spend mana, earn XP, optimize your loops. [Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=loops) | [loops/](loops/) |
| **Text Adventure** | Text-based adventure mode for navigating any Archipelago world via typed commands. [Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=textadventure) | [text-adventure/](text-adventure/) |
| **Maze Metagame** | A-Mazing-Idle as a meta-progression layer — solve mazes before checking locations. [Live demo](https://peerinfinity.github.io/Archipelago-CC/?metagame=mazegame) | [maze-metagame/](maze-metagame/) |

## APWorld Games

These are standalone Archipelago worlds with their own items, locations, and rules.

| Game | Description | Docs |
|------|-------------|------|
| **MetaMath** | Turns MetaMath theorem proofs into playable Archipelago worlds. [Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=metamath) | [metamath/](metamath/) |
| **DepGraph** | Turn any directed acyclic graph into a playable Archipelago world — nodes become items and locations, edges become access rules. [Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=depgraph) | [depgraph/](depgraph/) |
| **Journey to Ascension** | Archipelago integration for the incremental/idle game Journey to Ascension. [Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=jta) | [journey-to-ascension/](journey-to-ascension/) |

## DepGraph Games

These use the DepGraph APWorld as their backend but provide a distinct game experience through a custom frontend.

| Game | Description | Docs |
|------|-------------|------|
| **Vibe Coding Simulator** | Manage an AI-assisted coding project — assign tasks, review agent work, accept or reject changes. Quality is hidden; information is revealed through review, testing, and manual inspection. [Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=vibecoding) | [vibe-coding-simulator/](vibe-coding-simulator/) |
