# Introduction to Archipelago

This page is for readers who have never heard of Archipelago or randomizers. The rest of this project's documentation assumes you know the basics covered here.

## What's a randomizer?

A **randomizer** takes an existing game and shuffles where its items are found. In a normal playthrough of a Zelda-style game, the hookshot is always in the same dungeon chest; in a randomized playthrough, that chest might hold anything, and the hookshot might be anywhere. What makes this a genre rather than chaos is **logic**: the shuffle guarantees the game is still completable. You'll never need the hookshot to reach the chest that contains the hookshot.

Two words you'll see constantly:

- A **location** (or "check") is any place an item can be found — a chest, a boss reward, a shop slot.
- An **item** is anything you can receive — equipment, abilities, keys, or filler.

## What's a multiworld?

[Archipelago](https://archipelago.gg/) connects many randomized games — different games, played by different people — into one shared **multiworld**. The item pool of every player's game is shuffled *across all of them*: when you open a chest in your game, you might find your friend's item, and it's sent to them instantly over the network. Your progression items are likewise scattered across everyone else's games.

A round of Archipelago works like this:

1. Every player writes a small **YAML** file describing their game and settings.
2. A **generation** step ("gen") takes all the YAMLs and produces a **seed**: one randomized multiworld where every item has a placement and the logic guarantees everyone can finish.
3. A **server** hosts the seed. Each player connects their game (via a game-specific client) to their **slot** and plays.
4. When a player checks a location, the server tells the owner of whatever item was there. Play continues until players reach their goals.

More vocabulary you'll meet in these docs:

- **Access rule / logic** — the condition attached to a location or passage ("reachable if you have the hookshot and a small key"). The whole randomizer rests on these rules being right.
- **Region** — a group of locations that share accessibility (a room, an area); regions connect to each other via **entrances/exits**.
- **Sphere** — a measure of progression depth. Sphere 1 is everything reachable from the start; sphere 2 is what becomes reachable using sphere-1 items; and so on. A seed's "sphere log" or "playthrough" is the intended solution path.
- **Tracker** — a tool that watches your items and tells you which locations are currently reachable, so you don't have to keep the logic in your head.

## Where this project fits

Archipelago itself provides the framework, the generator, the server, and clients for the supported games. **This project builds on top of it** in two ways:

- **It generates new games.** A procedural generator builds complete randomizer worlds in the browser: the regions, the items, and the access rules that connect them. Each region is a small playable game of its own, such as a maze, a platformer, a text adventure, or a room of a recompiled Flash game, and one world can mix them. A generated world is a real Archipelago game: you can play it in the browser, watch a bot play it, or package it so that Archipelago can host it in a multiworld.
- **It tracks existing games.** It exports the full logic of an Archipelago seed to JSON. A browser-based, logic-aware tracker then shows the whole world as a graph and explains exactly why a location is or isn't reachable.

Continue with:

- **[Guided Tour](../user/guided-tour.md)** — see the highlights in about ten minutes, nothing to install
- **[For Players](./for-players.md)**, **[For World Builders](./for-world-builders.md)** or **[For Developers](./for-developers.md)** — where to go next, depending on what you want to do
- **[archipelago.gg](https://archipelago.gg/)** — the official Archipelago site, with setup guides for playing real multiworlds
