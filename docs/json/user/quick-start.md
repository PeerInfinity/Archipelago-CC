# Quick Start Guide

Welcome to the Archipelago JSON Web Client! This guide will help you get started with the two primary ways to use the application: as an advanced tracker for a standard multiworld game, and as a player in the incremental "Archipelago Loops" game mode.

**[Try the JSON Web Client Live](https://peerinfinity.github.io/Archipelago/)**

## Getting Started (Standard Tracking Mode)

In this mode, you use the client to connect to a multiworld server and track your progress. The client uses a special `rules.json` file to give you detailed, real-time information about what locations you can access with your current items.

### What You Need

When you generate your game, you will receive two key files:

1.  **Your `.archipelago` file:** This contains your world's specific item placements. You will use this with the standard Archipelago client that you play your game with, or you can connect to a server that has this file.
2.  **A `rules.json` file:** This file is unique to this project. It contains all the game logic, region connections, and item rules. You will load this file into the JSON Web Client.

### First Steps

1.  **Open the Web Client:** Navigate to the [live web client](https://peerinfinity.github.io/Archipelago/). It will load with a default "A Link to the Past" ruleset, allowing you to explore the interface immediately.

2.  **Explore the Interface:**

    - **Left Panel (Inventory):** Click on items like "Progressive Sword" or "Hookshot".
    - **Right Panel (Main Views):** Switch to the "Locations" tab and watch how the location cards change color as you acquire items. Green means accessible, red means not.
    - The layout is fully customizable. You can drag, drop, and resize panels to your liking.

3.  **Load Your Game:**

    - Click the **"Presets"** tab in one of the panels.
    - At the top of this panel, click the **"Load JSON File"** button.
    - Select the `rules.json` file that was generated with your game. The client will now use your game's specific logic.

4.  **Connect to the Server:**
    - In the center **"Console & Status"** panel, find the "Server Address" input.
    - Enter your server's address (e.g., `archipelago.gg:12345`).
    - Click the **"Connect"** button. You can also use the `/connect` command in the console.

### Basic Interaction

- **Collecting Items:** When you receive an item in-game, find it in the **Inventory** panel and click it. This adds it to your local state, and the accessibility of all locations will update instantly. If you are connected to the server, this will also send a `!getitem` command.
- **Checking Locations:** When you check a location in your game, find its card in the **Locations** panel and click it. The location will be marked as checked (grayed out).
- **Understanding Blockers:** In the **Regions** panel, you can use the **"Analyze Paths"** button to see exactly which items are required to access a new region.

## Getting Started (Archipelago Loops)

**Note:** The Archipelago Loops mode is currently undergoing a refactor and is not documented. This section will be updated once it is available.

## Next Steps

You're all set with the basics! For more detailed information on the client's features, check out the following guides:

- **[Standard Client Guide](./standard-client.md)**: A deep dive into all the features available in the standard tracking mode.
- **[Tips & Tricks](./tips-and-tricks.md)**: A collection of useful console commands, keyboard shortcuts, and answers to common questions.
