# Maze Room Panel

The Maze Room is where a generated world's **maze** regions are played. Each maze region is a small grid of floor and walls: walk to the pickups to check their locations, use keys on their doors, and leave through an exit to the next region. The [Playback Bot](playbackBot.md) walks the mazes here too, so this is also where you watch it.

## When it shows a maze

The panel shows the maze region you are in. When you are in another kind of region — a text adventure, a bounce zone, … — it says *Currently playing …* and offers a button to open that kind's panel; with no generated world loaded it says *No procgen substrate is active for the current region.* Entering a maze region brings the panel to the front.

To try it: in the [Procgen Pipeline](procgenPipeline.md), choose the preset **Maze demo (sphere growth)**, press **Run all**, then **Load into frontend**.

## Playing

Click into the panel so it has the keyboard, then:

| Key | What it does |
|---|---|
| **Arrow keys** or **W A S D** | Move one tile. |
| **Space** | Wait one turn. |
| **Backspace** | Delete the last action that has not run yet. |

- **Picking up**: step onto an item to check its location.
- **Doors**: a coloured door is solid until you hold its key; then it is drawn as a faint dashed outline and you can walk through.
- **Leaving**: step onto an exit (green) to go to the region it leads to. An exit drawn red is closed until you have what it needs.
- **Hazards**: red paths with arrows. A move into a hazard's path is refused (the turn still passes). If no move is safe, you are sent back to where you came in.

### What the map shows

| Mark | Meaning |
|---|---|
| Blue circle | You. |
| Green border | Where you came in. |
| Green tile / red tile | An exit, open / closed. |
| Coloured circle | An item. A red border means its location is behind something you do not have yet. |
| Coloured block / dashed outline | A door, shut / open. |
| Diamond | A mana pickup (Loop mode). |
| Black | Fog: tiles you have not seen yet (with **Fog of war** on). |

## The controls

### Show generator controls

Ticked by default. Untick it for a play-only view: the generator, the step log and the editing tools are hidden.

### Generator

Builds a maze of its own, outside any world — handy for trying the biomes. Choose a **Biome** (*Classic* by default; hover each for what it makes — long corridors, loops, rooms, …), a **Seed**, **Width** and **Height**, and press **Generate**. **Reset Player** puts you back at the start. **Save Params** / **Load Params** keep a setup, and **Reset Defaults** puts the form back. Generating replaces the region you were playing; load the world again to return to it.

### Playback controls

A walker that plays **this room only**: it fetches the room's items, then visits its exits. **⏭** Instant, **⏯** Step, **▶** Play, **⏹** Stop, **↺** Reset, at the chosen **Speed** (actions per second). To play a whole world instead — following its solution from region to region — use the [Playback Bot](playbackBot.md).

### Action queue

Every move you make is an entry here: ↑ ↓ → ← for moves, ◌ for waits, ✓ for checks. Click an entry to insert your next moves before it; **Clear pending** removes the ones not yet run. In a Loop-mode world, saved best paths for this room appear as buttons below, to replay one.

### Fog of war, Edit mode and Explore

- **Fog of war** hides what you have not seen yet. You see your own tile and its four neighbours.
- **Explore** walks to the nearest tile you have not seen, again and again, until the room is uncovered. (With fog off, there is nothing to uncover.)
- **Edit mode** lets you paint the room: choose a tile in the palette — floor, wall, entrance, item, obstacle, block, button, flag — and click the map. Its **Verifier** checks that every exit and location can still be reached.

The **Paths & obstacles** and **Compiled rules** boxes at the bottom show the room's rules as data, for the curious.

## In Loop mode

In a world built with **Enable loop mode**, a **Mana** line appears: every step and wait costs mana, and when it runs out the loop starts over. While the [Loops](loops.md) panel is running its queue, it drives the maze — your keys, the queue and **Explore** wait until it stops.

The panel remembers whether you show the generator controls, fog and edit mode, and which sections you folded.

## Learn more

- Tutorials: [the Guided Tour](../guided-tour.md) and [Procgen: Sphere growth](../tutorials/procgen-sphere-growth.md).
- [The procgen substrates](../../features/procgen-substrates.md).
- For developers: [the maze substrate](../../developer/procgen/maze.md).
