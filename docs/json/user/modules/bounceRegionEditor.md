# Bounce Region Editor Panel

The Bounce Region Editor edits one bounce zone of a generated world: its platforms, the springs, jetpacks, pickups and portals on them, and the size of the level. As you edit, it works out again what reaching each exit and each pickup needs, and shows those access rules beside the canvas. When you are done, **Save** puts the edited zone back into the world the [Procgen Pipeline](procgenPipeline.md) is building.

## Opening a zone

- **From the Procgen Pipeline.** Generate a world with bounce zones — for example the preset **Maze + bounce (sphere growth)** — then, in the **Sphere pipeline** section's region list, press **Edit ▸** on a region whose substrate reads **Bounce Demo**. The editor comes to the front with that zone, and the line under the toolbar reads *Editing … (pipeline — Save writes back to 3).*
- **On its own.** Opened from Quick Launch, the editor shows a hand-made level; the **Load fixture…** list has five (*bounceStack*, *easyTower*, *springGap*, *fork*, *fillerClimb*). Nothing you do here changes a world.

The title line names the zone and says which of the two it is: **[pipeline]** or **[standalone]**.

## Editing

The canvas shows the level. **Click a platform** to select it (or pick it from the sidebar's **pick** list, which names each platform with its position); a click on empty space clears the selection. There is no dragging: everything is changed with the sidebar.

**Level**

- **width** and **height** — the level's size.
- **+ platform** — adds a platform and selects it.

**Platform** (once one is selected)

- **x** and **y** — where it is.
- **type** — **green**, **blue** or **brown**.
- **+ spring**, **+ jetpack**, **+ pickup**, **+ portal**, **+ teleport** — put one on the platform; the button then reads **✓ …**, and clicking it again takes it off.
- **pickup item** — with a pickup on the platform, which item it gives.
- **portal dir** — with a portal on the platform, which way it leads: up, down, left or right.
- **Delete platform** — removes it, with everything on it.

**Region generation** (click to unfold) builds a new level for the zone instead: set the **seed** and the other knobs, then press **Regenerate 🎲**. The new level replaces the old one as one edit, so **↶ Undo** brings the old one back.

**↶ Undo (N edits)** takes back the last edit; **Ctrl+Z** (**Cmd+Z**) does the same when you are not typing in a box.

## Checking it

Beside the canvas:

- **✓ valid**, or **⚠ N issue(s)** followed by what is wrong — for example an exit no ability can reach.
- A count of the level's platforms, pickups and portals, and its size.
- **Expected on entry** — in a pipeline zone, the items the player is expected to hold on arrival.
- **Derived access rules** — one line per exit and per pickup: **ALWAYS**, **IMPOSSIBLE**, or the items it needs. They change as you edit.

## Saving

⚠ **Nothing is saved automatically.** Edits stay in the panel until you press **Save**.

| Control | What it does |
|---|---|
| **Save** | In a pipeline zone, writes the edited zone back into the pipeline's world: *Saved … back to the pipeline. Re-run 4 to recheck.* Then press **Run 4 Compile** in the Procgen Pipeline and **Load into frontend** to play it. On its own, the same as **Export level JSON**. |
| **Export level JSON** | Saves the level to a file. |
| **Open in APWorld Editor** | In a pipeline zone, brings the [APWorld Editor](apworldEditor.md) to the front with this region selected. It sends nothing across: the APWorld Editor keeps its own copy of the world. |

To play the result, see [Bounce Demo](bounceDemo.md).

## Learn more

- Tutorial: [editing a bounce region](../tutorials/procgen-bounce-region-editor.md).
- [The procgen substrates](../../features/procgen-substrates.md).
- For developers: [the bounce substrate](../../developer/procgen/bounce.md).
