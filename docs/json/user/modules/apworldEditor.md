# APWorld Editor Panel

The APWorld Editor opens a world's rules — its regions, exits, locations, access rules and items — and lets you change them, with undo, a map, and a check that flags anything broken. When you are done, it can load the edited world into the app, save its rules file, or build a `.apworld`: a package Archipelago's own generator and server load like any other game.

It works on any loaded world, and it is how a world from the [Procgen Pipeline](procgenPipeline.md) becomes a game you can play in a multiworld.

## Opening a world

The editor always works on a **working copy** of one world:

- When the panel opens, it takes the world the app has loaded (from the [Presets](presets.md) panel, a file, or the Editor).
- **Open in APWorld Editor** in the Procgen Pipeline hands it the world you just generated, without loading it into the rest of the app.
- Loading a different world anywhere in the app replaces the working copy — and drops any edits you have not applied or saved.

With nothing loaded, the panel asks you to load a rules file first.

## A worked example: a generated world as a .apworld

1. In the Procgen Pipeline, choose the preset **Maze demo (sphere growth)**, press **Run all**, then **Open in APWorld Editor**.
2. Browse the **Regions** tab: each maze the pipeline built is a region, with its exits and its locations.
3. Type **Tutorial Maze** in the *apworld game name* box.
4. Press **⭳ .apworld**. The editor runs Archipelago's world generator in your browser and saves `tutorial_maze.apworld`. The first build downloads Python, which takes a few seconds and needs an internet connection; the status line shows the progress and, at the end, the file it saved.

Put that file in an Archipelago install's `custom_worlds/` folder and it is a game like any other. The tutorial [from a generated world to a multiworld](../tutorials/procgen-to-multiworld.md) takes it the rest of the way: hosting it on a local server, connecting, and letting the [Playback Bot](playbackBot.md) play it.

## The toolbar

| Control | What it does |
|---|---|
| **Apply** | Loads the working copy into the whole app, as if it were a preset, so the other panels show your edits. |
| **⭳ Download** | Saves the working copy as a rules file (`<Game>_AP_<seed>_rules.json`). |
| *apworld game name* | The game name for the `.apworld`. Blank keeps the world's own name. |
| **⭳ .apworld** | Builds and saves a `.apworld` from the working copy. |
| **Clear** | Removes all regions, exits, locations and items (it asks first). Can be undone. |
| **Reload** | Throws away your edits and reloads the world the app has loaded (it asks first). |
| **↶ Undo (N edits)** | Takes back the last edit. **Ctrl+Z** (**Cmd+Z**) does the same when you are not typing in a box. |
| **Player** | In a multiworld, which player's world the tabs show and edit. |

The status line at the right names the game and sums up the open tab.

⚠ **Nothing is saved automatically.** Edits live in the panel until you press **Apply**, **⭳ Download** or **⭳ .apworld**; a page reload loses them.

## The issues bar

Under the tabs, a coloured dot shows **No issues**, or how many errors and warnings the world has — an exit with no destination, a rule naming an item that does not exist, a missing start region or victory item, and so on. Click it to see the list; click an issue to jump to it. Every edit is checked as you make it.

## The tabs

### Regions

Every region, each with:

- its **name** (edit it in place) and **× Delete**;
- **Exits** — for each, a name, the region it leads to, and its **access rule**; **+ Add exit** adds one;
- **Locations** — for each, a name and its **access rule**; **+ Add location** adds one.

**+ Add region** at the top adds a region.

An **access rule** is edited as a tree. Pick the rule's type — **True_** (always open), **Has** (needs an item), **HasAll** / **HasAny** (needs all or any of several items), **And** / **Or** / **AtLeast** (combine other rules), **CanReachRegion**, **CanReachLocation**, **CountItem**, and others — then fill in its item or region. **+ child** adds a rule inside an And, Or or AtLeast; **⇪ And** / **⇪ Or** wraps a rule in one; **×** removes it.

In a generated world, each region also shows its **room** — what kind (maze, text adventure, bounce zone, …) and on which cell of the map — with these buttons:

| Button | What it does |
|---|---|
| **Edit ▸** | Opens the room in its own editor, for example the [Bounce Region Editor](../tutorials/procgen-bounce-region-editor.md). |
| **Re-derive rules ▸** | Rebuilds the region's access rules from its room. |
| **Re-roll ▸** | Generates a new room for the region: pick the source and the settings, then **Generate ▸**. |
| **Regenerate in the pipeline ▸** | Sends the whole world back to the Procgen Pipeline to regenerate it there. |

**Exit sides** moves an exit to another side of the room, or swaps two.

### Items

- **Starting inventory** — what the player starts with. Pick an item and **+ add ▸**.
- **Item groups** and **Progression** — named groups of items, and progressive items (one item name that stands for several levels).
- The item table — each item's **Name**, **id**, **Classification** (progression, useful, filler, trap, …), how many the world has (**Pool**), and its groups. **+ Add item** adds one.

### Placements

Which item the world puts at which location. This is what the world generator will place the next time it generates the world — set an item for a location, or choose *(unplaced)* to leave it to the randomiser. **Filter** narrows the list by location, item or region name.

### Meta

The game's name and folder name, the seed, the player's name and **Start region**, and the **Victory condition** — the item that wins the game.

### Map

For a generated world, the regions on their grid, drawn the way the Procgen Pipeline draws them. Click a region to select it; click it again to open its room. **Move / swap ▸** moves the selected region to an empty cell, or swaps it with another (Esc cancels). **Open region graph** shows the world in the [Region Graph](regionGraph.md).

A world that is not generated has no map. **Initialise procgen data ▸** gives it one: it lays its regions out on a grid and builds a room (a maze, by default) for each, keeping the locations and rules as they are — so any Archipelago world can become one the Playback Bot can walk.

### Sidecars, Document, Links and Raw JSON

These show the rest of the world's file, for those who want to look underneath: **Sidecars** the procgen data stored beside the regions, **Document** every part of the file with a short description, **Links** the other editors that can open this world, and **Raw JSON** the whole file as text (**Save JSON** applies a hand edit as one undoable step).

## Settings

In the Settings panel, under *apworldEditor*: how long room generation (60 s) and *Initialise procgen data* (300 s) may run before they give up, and whether the Map shows the starting menu.

## Learn more

- Tutorial: [from a generated world to a multiworld](../tutorials/procgen-to-multiworld.md).
- [What procgen is](../../features/procgen.md).
- For developers: [the APWorld Editor reference](../../modules/apworldEditor.md).
