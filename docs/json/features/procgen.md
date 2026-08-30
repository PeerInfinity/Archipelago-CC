# Procedural Generation

Most of this project is about *tracking* existing randomizer games. Procedural generation turns that around: the frontend can **generate** a complete randomizer world — regions, entrances, items, and access rules — and then let you play it, all in the browser.

## What a generated world is

A generated world is a graph of connected regions, each rendered by a **substrate** — a small game engine that owns that region's actual gameplay:

- **Maze** — walk a grid maze, pick up items, dodge patrolling hazards
- **Bounce** — a Doodle-Jump-style vertical platformer where movement abilities (arrows, springs, jetpacks, colored platforms) are the progression items
- **Text Adventure** — the region as prose with clickable exits and locations
- **Flash** — a recompiled Flash game embedded as a region
- **Journey to Ascension** — zones of the idle game as regions

One world can mix substrates freely — a maze region can lead to a platformer region. Access rules aren't just written down; for substrates like bounce they are *derived from the actual physics* and verified, so if the logic says you need Springs to reach an exit, that's genuinely true in play.

## Generating and playing

The **Procgen Pipeline** panel (🧭) drives generation. Pick a layout mode — **sphere growth** is the primary one: it plans the item-progression spheres first, then grows a world guaranteed to match that plan — set per-substrate region quotas and a seed, and generate. The compiled output is a standard `rules.json`, the same format exported from real games, so the whole app just works on it: the region graph, the trackers, discovery mode, everything.

When you play a generated world, region transitions automatically bring up the right substrate panel: walk through a maze exit and the next region might open as a platformer. A few generated example worlds ship as presets (e.g. `procgen_maze`), so you can try one from the **Presets** panel without generating anything.

Extras that build on this:

- **Watch it play itself** — the **Playback Bot** panel replays the world's recorded solution path, driving each substrate's real gameplay (in bounce, it plays the actual physics).
- **Loop mode** — generation can embed loop-mode costs, turning the generated world into an incremental game ([Loops](./loops.md)).
- **Step-by-step generation** — the pipeline can run as discrete steps whose intermediate results you can inspect and edit (including a per-region geometry editor for bounce regions), then continue.
- **Real Archipelago seeds** — a generated world converts to a Python APWorld via the [world generator](../../../world_generator/README.md) and runs through real multiworld generation; the result is still playable in the frontend.

## Learn more

The full technical documentation lives in the [procgen developer docs](../developer/procgen/README.md) — start with the [architecture overview](../developer/procgen/architecture.md).
