# Guided Tour

Ten minutes, nothing to install, no server to set up — everything below runs in the [live demo](https://peerinfinity.github.io/Archipelago-CC/) in your browser. (New to Archipelago itself? Read the [Introduction to Archipelago](./introduction-to-archipelago.md) first; this tour assumes the basics.)

One warning before you start: the app opens with a *lot* of panels. That's normal — it's a workbench, and this tour only uses a handful of tabs. Ignore the rest; nothing breaks if you never touch them. If you ever rearrange things into a mess, the **Modules** panel's *Reset Default Mode* button restores the default layout.

## Stop 1 — Watch a world play itself

Open this link:

**<https://peerinfinity.github.io/Archipelago-CC/?game=procgen_maze&seed=1>**

That URL loads a small world that was *procedurally generated* by this project — three connected maze regions with a key, a locked door, and a Victory item, plus the machine-checkable logic that proves it's solvable.

1. Find the **Maze Room** tab and click it. You'll see the first maze region, with the player at the entrance.
2. Now find the **Playback Bot** tab. It says "Sphere log loaded" — the bot has the world's recorded solution path.
3. Press **▶** (Play), then click back to the **Maze Room** tab to watch.

The bot walks the maze for real — through the first region, picking up the red key, moving between regions, and finishing at the Victory pickup. Its log narrates the progression: `Sphere 0.1 → walking to "…key_red_pickup…"`, then the sphere-2 target, until `finished — 3 locations visited`. That order isn't scripted by hand; it's the world's actual progression spheres, replayed.

A few things worth trying while you're here:

- **↺** resets the run; **Step** advances one action at a time; **⏭** finishes instantly.
- Click into the **Maze Room** panel and walk yourself with the **arrow keys** — the bot isn't required.
- The bot panel's **Manual walk-to** buttons send the player to any region on demand.

## Stop 2 — See the logic underneath

The maze isn't just graphics — every location and passage has an Archipelago access rule, and the whole app is watching them.

1. Open the **Region Graph** tab: the world as a graph of regions, color-coded by reachability and check status. This is the same view used for real games like A Link to the Past — where it has hundreds of nodes.
2. Open the **Locations** panel: the three locations, with the ones the bot checked marked off.
3. Open the **Inventory** panel: the red key and Victory the bot collected.

Everything you just watched — which doors need which keys, which regions are reachable — was *derived* logic, evaluated live. This is the project's core trick: game logic exported to JSON, evaluated in the browser.

## Stop 3 — Generate your own world

The world from Stop 1 came out of a panel you also have open.

1. Find the **Procgen Pipeline** tab.
2. The **Mode** section has four generation strategies; **Sphere growth** — the one that plans the item progression first, then grows a world to match — is already selected.
3. The **Parameters** section has the knobs (seed, region size, number of spheres…). Leave the defaults for now.
4. Press **Run all**. The step buttons (1 Plan → 2a Allocate → 2b Topology → 2c Items → 3 Build regions → 4 Compile) run in sequence until it reports **Pipeline complete**.
5. Press **Load into frontend**.

Your world is now the loaded game — the Maze Room shows its first region, the Region Graph shows its layout, and the Playback Bot has its solution log. Change the **Seed** parameter and repeat for a different world every time. You can also run the steps one at a time and inspect what each produces, or **Download rules.json** to keep the world as a file.

The same panel can build worlds from other *substrates* — a Doodle-Jump-style platformer whose movement abilities are the progression items, a text adventure, and more, mixed in one world — via the **Scenario Pool** section. See [Procedural Generation](../features/procgen.md) for what's possible.

## Where to go next

- **Track a real game:** the **Presets** panel has exported seeds for dozens of Archipelago games — pick one and explore its region graph, no server needed. When you're ready to track a live multiworld, the [Quick Start Guide](./quick-start.md) covers connecting to a server.
- **Loop mode:** any world can become an incremental game — queue actions, spend mana, loop. See [Loops](../features/loops.md).
- **Everything else:** the [Overview](./overview.md) and the [Features Index](../features/README.md) map the rest of the project.
