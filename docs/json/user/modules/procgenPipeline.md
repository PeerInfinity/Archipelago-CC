# Procgen Pipeline Panel

The Procgen Pipeline generates a whole Archipelago world: it plans which items unlock what, builds a playable room for every region (a maze, a text adventure, a bounce zone, a Seedling room, …), draws the map, and loads the result into the app so you can play it, watch the [Playback Bot](playbackBot.md) play it, or package it in the [APWorld Editor](apworldEditor.md). It is where every procgen world starts.

## The quick way: a preset

1. Open the **Preset** drop-down at the top and pick one, for example **Maze demo (sphere growth)**. A preset fills in the whole setup: the mode, the scenario pool and the parameters.
2. Press **Run all**. When the world is ready, the map is drawn and the result buttons appear.
3. Press **Load into frontend**. The world you generated becomes the loaded game: the Maze Room, the Region Graph, the Locations panel and the Playback Bot all switch to it.

The same preset and seed always give the same world.

## The sections, top to bottom

Each section with a ▼ heading can be folded by clicking the heading (▶ = folded). The panel remembers which ones you folded.

### Preset

- **Preset** drop-down — the built-in presets, grouped by mode, then your own under **User**. Picking one replaces the whole setup at once, and clears any result. Hover an entry to read what it builds. As soon as you change anything, the drop-down shows **Custom**: the setup is your own now.
- **Save as…** — saves the current setup as a preset of your own, under a name you type. Saving with an existing name replaces that preset.
- **Delete** — deletes the selected preset (it asks first). Only your own presets can be deleted.
- **Reset panel** — puts the whole panel back to a fresh one: Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

### Mode

How the world is built:

| Mode | What it does |
|---|---|
| **Sphere growth** (the default) | Plans the progression first — which items are found in each *sphere* (round) of the playthrough — then grows rooms wave by wave to match the plan, and checks the result against it. |
| **Shuffled spiral** | Places a set number of rooms of each substrate outward from a centre room, in shuffled order, then places the items. |
| **Grid growth** | The older, one-shot grower: adds rooms until the item pool or the free space runs out. Kept for comparison. |
| **Top-down** | Takes an existing game's world — the one currently loaded, or a rules file — and rebuilds each of its regions as a generated room, keeping its access rules. Load any game's preset in the [Presets](presets.md) panel first. |

Changing the mode clears the current result.

### Scenario Pool

What goes into the world.

- **Substrates** — the kinds of room. Click one in the left list to add it; it then appears on the right with a number box (how many rooms of that kind, or — in Grid growth's *Mix* and in Top-down — its weight in a random mix) and **×** to remove it. With nothing chosen, every room is a maze. Hover a substrate to see what it supports.
- **Start substrate** — the kind of room the player starts in; **Auto** lets the pipeline choose.
- **Region libraries** (Sphere growth and Shuffled spiral) — ready-made rooms to mix in. Tick a library to add it, then set how many of its rooms to use.
- **Library** and **Scenario (counts)** — the items and obstacles to place: keys and their doors, Victory, and the substrate-specific ones. Click an entry to add one; set the count or remove it on the right. The world's goal is the **Victory** item.

### Top-down source (Top-down mode only)

**Use currently-loaded rules.json** (on by default) takes the world you have loaded; or choose a rules file to use instead. The line beside it names the source. If the loaded world has a sphere log, it is used too.

### Parameters

| Parameter | What it does |
|---|---|
| **Seed** | Picks one world among all the ones these settings allow. |
| **Region width** / **Region height** | The size of each room, in tiles. |
| **Max items/region** | The most items one room may hold. |
| **Spheres** (Sphere growth) | How many rounds of progression the plan has. |
| **Filler regions** (Sphere growth) | Extra rooms with nothing in them. |
| **Revisit %** (Sphere growth) | How often a new room attaches to an older one instead of the newest, which makes the world less linear. |
| **Grid width** / **Grid height** (Grid growth, Top-down) | The size of the map grid. In Top-down it follows the source world. |
| **Concepts** | What a gate may be *shown* as — a guardian that needs the sword, water that needs swimming, a door that needs a key. A concept changes the picture, never the logic; none ticked (the default) builds the plain world. |
| **Enable loop mode** | Builds the world for [Loop mode](../tutorials/procgen-loop-mode-jta.md): each action costs mana, and a run restarts when it runs out. |
| **Discovery mode** | **Same as loop mode** (default), **On** or **Off**. Same as loop mode: the world is in Discovery mode exactly while it is in Loop mode. On: as in Loop mode while it is on, and walk-to-reveal without it. Off: no Discovery mode, and everything counts as discovered. On and Off are saved in the world. The [Discovery panel guide](discoveryPanel.md#loop-mode-and-a-worlds-own-discovery-mode) has the full table. |

Below these, each substrate you chose has its own parameters (for a maze, for example, **Maze rooms play as** and **Enable hazards**). **Reset Defaults** puts only the parameters and the scenario back.

### Running the pipeline

- **Run all** runs every step and produces the world. (In Grid growth, Shuffled spiral and Top-down the button is called **Generate**.)
- **Run 1 Plan**, **Run 2a Allocate**, … runs only the *next* step, so you can look at — and change — each step's output before the next one. The chips above the buttons show the steps; a finished step turns green. Once some steps have run, the main button reads **Run all (finish)**.
- **◀ Previous sphere** (Sphere growth) drops the last sphere built, so it can be grown again.
- **Reset** clears the steps and the result.

The steps in Sphere growth are:

| Step | What you can do with its output |
|---|---|
| **1 Plan** | See which items each sphere holds; move an item a sphere earlier or later with **▲** / **▼**; add or remove a sphere. |
| **2a Allocate** | Change how many regions and filler regions each wave gets. |
| **2b Topology** | For each region, choose its substrate, the region it hangs off and the item that gates it. |
| **2c Items** | Move an item to another region. |
| **3 Build regions** | For each region: change its substrate, **Edit ▸** its room, or **Re-roll 🎲** it with a new seed. |
| **4 Compile** | Turns the world into a rules file and checks it matches the plan ("✓ oracle: plan realised exactly"). |

**Edit ▸** opens a region's room in that substrate's own editor: a maze room in **Procgen Lab — maze** (open that panel first — if it is not open, the button says so), a bounce zone in the Bounce Region Editor. Edit the room there and close it (the lab's **CLOSE**, the Bounce Region Editor's **Save**); the room is written back into the world, and **Run all (finish)** compiles it again and rechecks the plan. Seedling rooms cannot be edited from the pipeline yet; their **Edit ▸** says why.

Shuffled spiral (1 Arrange, 2 Content, 3 Regions, 4 Compile) and Top-down (1 Layout, 2 Realise, 3 Finalize, 4 Compile) have steps of their own.

### The result

Once a world exists:

- **Load into frontend** — make it the loaded game.
- **Open in APWorld Editor** — open it in the [APWorld Editor](apworldEditor.md) without loading it, to edit it or package it as a `.apworld`.
- **Download rules.json** — save the world's rules file.

The **Stats** line counts the regions, and the **map** shows them on their grid. In Sphere growth (after 2c) and Top-down (after 3 Finalize) the map can be edited: choose **Edit Region**, **Move Region** or **Move Exits** above it and click the map; **Undo ↶** takes an edit back.

## What the panel remembers

The setup — mode, parameters, scenario, substrates, chosen preset — is saved as you change it, and comes back when you reload. Your presets are saved separately. The step results and the generated world are **not** kept: after a reload, press **Run all** again (the same setup gives the same world). These live in your browser's storage; the [Storage panel](storagePanel.md) lists them.

## Learn more

- Tutorials: [Sphere growth](../tutorials/procgen-sphere-growth.md), [Shuffled spiral](../tutorials/procgen-shuffled-spiral.md), [Grid growth](../tutorials/procgen-grid-growth.md), [Top-down](../tutorials/procgen-top-down.md), [settings and the Playback Bot](../tutorials/procgen-settings-and-bot.md), [a mixed world](../tutorials/procgen-mixed-world.md), and [from a generated world to a multiworld](../tutorials/procgen-to-multiworld.md).
- [What procgen is](../../features/procgen.md) and [the substrates](../../features/procgen-substrates.md).
- For developers: [the procgen architecture](../../developer/procgen/architecture.md), [the stepped pipeline](../../developer/procgen/stepped-pipeline.md) and [pipeline presets](../../developer/procgen/pipeline-presets.md).
