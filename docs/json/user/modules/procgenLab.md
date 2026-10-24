# Procgen Lab Panel

The Procgen Lab shows a room generator's own page inside the app: the **maze** lab or the **Seedling** lab. There you can generate a room step by step, edit it by hand, solve it, and play it — the same rooms the [Procgen Pipeline](procgenPipeline.md) builds worlds from. The panel around the page lets you hand a room to the page, take the page's room back as data, or open the page in a tab of its own.

The app opens two of them: **Procgen Lab — maze** and **Procgen Lab — Seedling**.

## The panel's controls

Above the page:

- **The status line** — which lab it is and whether the page has connected: *connecting…*, then *connected*, followed by a summary of the room on screen (its seed, size and so on), whether it has been solved (**CERTIFIED**, or **UNCERTIFIED** while nothing has solved it), and how many edits you have made.
- **SEND — load this payload** — loads the room in the box below into the page. Paste a room's data (JSON) into the box first. If the page has not connected yet, the room waits and is sent when it does.
- **TAKE — the page's level** — puts the room the page is showing into the box, as data, ready to copy.
- **open standalone ↗** — opens the same page, with the same room, in a browser tab of its own.

The line under the buttons says what happened: *SENT…*, *TAKEN…*, or what was wrong (*that is not JSON…*, *nothing to take yet…*).

## The lab page

The page has a **source** list at the top that switches what it does — generate a room, edit one tile by tile, solve it, or drive the player yourself (the Seedling lab also replays the bot's recorded runs). Its **glossary**, **demos** and **reference** links explain every term and setting on it.

A generated room builds up one template at a time: **STEP — one template** adds the next, **RUN-ALL** finishes it, and **RESET to the skeleton** starts again. The **seed**, the room's size and the other settings above those buttons choose what it builds.

The lab is a workbench: nothing in it changes the world the app has loaded.

## Editing a world's room

In the [APWorld Editor](apworldEditor.md), a maze region's **Edit ▸** opens its room in **Procgen Lab — maze** and brings the lab to the front. The page says which room it opened: paint on the canvas with the tile buttons (**Floor**, **Wall**, **Entrance**, **Item**, …), then press **CLOSE**, and the edited room goes back to the APWorld Editor. A bounce zone's **Edit ▸** opens the [Bounce Region Editor](bounceRegionEditor.md) instead.

## Learn more

- Tutorial: [Seedling rooms](../tutorials/procgen-seedling.md), which takes a room from the Seedling lab.
- [What procgen is](../../features/procgen.md).
- For developers: [the maze lab](../../developer/procgen/maze-lab.md).
