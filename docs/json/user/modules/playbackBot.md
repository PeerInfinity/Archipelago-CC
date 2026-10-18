# Playback Bot Panel

The Playback Bot plays the loaded world for you. It follows the world's sphere log — the solution path, sphere by sphere — walking to each location in order and checking it, moving between regions on the way. In a generated world it drives each room's own game: it walks the mazes, plays the text adventures, jumps through the bounce zones, survives the Noiz2sa runs and plays the Seedling and Journey to Ascension rooms. Open the room's panel beside it to watch.

## Before you start

The bot needs a world with a sphere log. Either:

- generate one in the [Procgen Pipeline](procgenPipeline.md) and press **Load into frontend**, or
- load a preset that has a sphere log in the [Presets](presets.md) panel.

Until then the panel says **No sphere log loaded.** Once one is loaded, the status line reads *Sphere log loaded: N entries.*

## A first run

1. In the Procgen Pipeline, choose the preset **Maze demo (sphere growth)**, press **Run all**, then **Load into frontend**.
2. Open the **Playback Bot** tab and press **⏯** (Step). The bot takes one action and stops; the status line says what it is doing, for example *Sphere 0.1 → walking to "…" (1/5)*.
3. Open the **Maze Room** in another column, then press **▶** (Play) to watch the bot walk the rest of the world. **⏹** stops it.

When it is done, the status reads *finished — N locations visited* and the world's Victory has been found.

## The controls

### The Bot bar

| Button | What it does |
|---|---|
| **⏭** Instant | Plays the rest of the run at once. |
| **⏯** Step | Takes one action — one step towards the next target — and stops. |
| **▶** Play | Plays the run at the chosen speed. |
| **⏹** Stop | Pauses. **▶** carries on from the same place. |
| **↺** Reset | Starts the bot over. Locations already checked stay checked; the bot skips them next time. |

**Speed** sets how many actions the bot takes per second (0.5 to 30 Hz; 4 to start with). Drag the slider or type a number.

### Route clicks to bot

With **Route clicks to bot** ticked, clicking a location in the [Locations](locations.md) panel sends the bot to walk there and check it, instead of checking it at once. Clicking an exit in the [Exits](exits.md) panel sends the bot through that exit (exits of the region you are in). Off by default; the panel remembers your choice.

### Manual walk-to

Pick a region, type a cell's **x** and **y**, and press **Go**: the bot walks the player there, across other regions if it must. Useful for looking at one room. It is greyed out while a run is playing.

### Target and status

- **Target:** the location the bot is heading for (— when it has none).
- The **status line** says what the bot is doing now; the log below it keeps every status in order, so you can scroll back to see what happened.

If the bot cannot do something, the status says so — for example *blocked: the check of "…" did not land*, or *error: no path from …* when the next location cannot be reached.

## In Loop mode

In a world built with **Enable loop mode** (see the [Loops](../../features/loops.md) feature), the bot does not move the player itself. Each loop, it writes the Loops panel's queue for you — the moves to its target, then the check, or an explore when the target is not discovered yet — runs it until the mana runs out, and plans the next loop. **⏯** then plays one whole loop, and **⏭** is the same as **▶**; the Loops panel's own speed settings apply instead of the bot's **Speed**. The status shows the loop number, the action and the mana left. If it says *waiting: Generate Costs first (Loops panel)*, do that in the Loops panel.

**Loop mode, when a task is not affordable** chooses what the bot does when the next check costs more mana than one loop has:

| Choice | What the bot does |
|---|---|
| **Explore as far as mana allows** (the default) | Goes as far along the way as the mana allows and spends the rest exploring there, which earns experience and discovers more. |
| **Explore the target region only** | Goes straight for the task; when even the moves cost too much, explores the start region to earn experience. |
| **Keep attempting the task** | Queues the whole task anyway; the mana it spends still earns experience. |
| **Random task each loop** | Picks a random explore or check that is available, a different one from the last loop's when it can. |

The bot keeps going loop after loop until the world is finished or you press **⏹**.

## Without a generated world

In an ordinary game's preset (one that is not procgen, such as Adventure), the bot has no rooms to walk: it checks each location and moves between regions directly, one action per tick at the chosen speed.

## Learn more

- Tutorials: [settings and the Playback Bot](../tutorials/procgen-settings-and-bot.md), [a mixed world](../tutorials/procgen-mixed-world.md), [Journey to Ascension in Loop mode](../tutorials/procgen-loop-mode-jta.md), [everything, in Loop mode](../tutorials/procgen-loop-mode-everything.md), [Seedling: watch the bot play](../tutorials/seedling-bot.md) and [from a generated world to a multiworld](../tutorials/procgen-to-multiworld.md), where the bot's checks go to a real Archipelago server.
- For developers: [playback and debugging](../../developer/procgen/playback-and-debugging.md).
