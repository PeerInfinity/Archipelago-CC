# For Players

This page is for people who want to play. Everything here runs in the browser at the [live demo](https://peerinfinity.github.io/Archipelago-CC/), with nothing to install, unless the section says otherwise. It assumes you know what an Archipelago world, a location and an item are; if not, read the [Introduction to Archipelago](./introduction-to-archipelago.md) first.

## Play a generated world

The project generates complete randomizer worlds. Each region is drawn by a *substrate*, a small game of its own: a maze to walk, a platformer to climb, a text adventure to read, a shoot-'em-up stage, or a room of *Seedling*, a Flash game recompiled to run in the browser. One world can mix them. When you leave one region, the next one opens in its own game.

- **[Guided Tour](../user/guided-tour.md)** — ten minutes: watch a generated world play itself, look at the logic underneath, then generate a world of your own. Or [start it inside the app](https://peerinfinity.github.io/Archipelago-CC/?game=procgen_maze&seed=1&tutorial=guided-tour), where the Tutorial panel can do each step for you.
- **[Procgen: a mixed world](../user/tutorials/procgen-mixed-world.md)** — one world made of several substrates.
- **[Procgen: Seedling rooms](../user/tutorials/procgen-seedling.md)** — rooms of the real Seedling game, and new rooms generated in its style, as regions.
- **[Seedling: watch the bot play](../user/tutorials/seedling-bot.md)** — the whole original game as an Archipelago world, played by the Playback Bot.

The **Playback Bot** can play any generated world from its solution path, driving each substrate's real gameplay, so you can always see that a world can be finished.

## Play in Loop mode

[Loop mode](../features/loops.md) turns a world into an incremental game: every action costs mana, and when the mana runs out the loop restarts, keeping what you have learned. It works on any Archipelago game the app can load, and a generated world can ship with its loop costs built in.

- **[Procgen: Journey to Ascension in Loop mode](../user/tutorials/procgen-loop-mode-jta.md)** — a world whose regions are zones of the idle game *Journey to Ascension*.
- **[Procgen: everything, in Loop mode](../user/tutorials/procgen-loop-mode-everything.md)** — every substrate in one world, all spending the same mana.

## Play in a multiworld

A generated world is a real Archipelago game. The APWorld Editor packages it as an `.apworld`, Archipelago's own generator and server load it, and the browser app is its client.

- **[Procgen: from a generated world to a multiworld](../user/tutorials/procgen-to-multiworld.md)** — generate, package, host it on your own computer, connect and play. This one needs a local Archipelago installation.
- **[Seedling: in a multiworld](../user/tutorials/seedling-multiworld.md)** — the same for the Seedling world.

[MetaMath](../../../worlds/metamath/docs/README.md) and [DepGraph](../features/depgraph.md) are two more worlds from this project that can join a multiworld: a theorem's proof, or any dependency graph, as a game.

## Track an ordinary Archipelago game

The app is also a logic-aware tracker for the games Archipelago already supports. It knows each game's logic, shows which locations you can reach with the items you have, and, connected to the multiworld's server, follows your game as you play.

- **[Track a game](../user/tutorials/tracker-track-a-game.md)** — the tutorial.
- **[Quick Start Guide](../user/quick-start.md)** and **[Standard Client Guide](../user/standard-client.md)** — connecting to a server and using the tracker's panels.
- **[Tips, Tricks, and FAQs](../user/tips-and-tricks.md)**.

## More

- **[All tutorials](../user/modules/tutorials.md)** — the Tutorial panel's full list, each with a link that starts it in the app.
- **[What each substrate can do](../features/procgen-substrates.md)** — which substrates you can play by hand, in Loop mode, or with the Playback Bot.
- **[Overview](../user/overview.md)** — the whole project, feature by feature.
