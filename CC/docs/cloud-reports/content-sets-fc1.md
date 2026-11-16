# Content sets FC-1: a feature check that shows the themed maze example

Branch `content-fc1`, based on `content-tidy1` (`5bfb45edd9`). TIDY-1's composite-map theming is not on main yet.

- `868e0e2b5c`: the feature check, its `FEATURE_CHECKS` entry and its walk row.
- Then this report and its pictures.

The ask (the user, 2026-11-15): *"Can we set up a Feature Check in the Tutorials panel to load the scenario for me to
see what this maze example currently looks like?"*

## How to open it (click by click)

1. Open the app (any page; no `?game=` needed).
2. The **Tutorial** tab is in the left column, beside **Quick Launch**. Click it.
3. Scroll to the last section, **Feature checks**, and click its heading to unfold it.
4. On the card **Content sets: the meta theme in the maze, beside the plain world**, press **Start**.
5. Press **Do it** once per step, and do **not** use **▶ Play**. Each step leaves its view on screen until you press
   **Do it** on the next step. The panel may move to the next step's text on its own (*Auto-advance*), but it does
   nothing more until you press **Do it**. **◀ Back** and **Next ▶** move through the text without doing anything.

Direct link: `?tutorial=content-theme-maze-look`.

**How to stop on a step.** The walker has no per-step hold. **Do it** is the hold: the view stays until the next
**Do it**. **▶ Play** runs every step back to back, about 2 seconds in all, so nothing stays up long enough to look
at. If you used Play, press **⏸ Pause**, or go **◀ Back** to the step you want and press **Do it** there.

## The check

Id **`content-theme-maze-look`**, file `frontend/modules/tutorials/content/checks/contentThemeMaze.js`, registered last
in `FEATURE_CHECKS`. Walk row **`feature-check-content-theme-maze-look`**, category `Feature checks`, in the manual
batch `feature-checks`.

There are two sections with the same five steps each: **The themed world: meta_trial**, then **The plain control:
concept_trial**.

| # | step id | what you do / what is on screen | `done` reads |
|---|---|---|---|
| 1 / 6 | `meta-load` / `control-load` | Loads the world, as `?game=<id>&seed=1` does (`ctx.loadPreset`) | a rules load since the step began, and the preset is the loaded one |
| 2 / 7 | `*-take` | **Text Adventure Substrate** tab: click the first room's location **[l1]**. It sends Progressive Sword, and the room's exit turns green | the panel offers an open exit; the region its link names (`exit (to region_2_3)`) is recorded |
| 3 / 8 | `*-enter` | Click the exit **[s]**, then the **Maze Room** tab | the Maze Room is showing, with a canvas drawn since step 2, and its line reads `Loaded region: <the region the exit named>` |
| 4 / 9 | `*-maze` | Untick **Fog of war**. The whole region shows. The step text says what is themed and what is default | the Maze Room is showing, and Fog of war is unticked |
| 5 / 10 | `*-map` | **APWorld Editor** tab, then its **Map** tab: the composite map | the editor is showing, on its Map tab; the document it holds records the world's content set (`['meta']` / none); the canvas has regions |

The check **reads the page and changes nothing in the world.** The location it takes and the exit it walks are the
ones the Text Adventure panel offers, read off its links (`.tae-link-item…`, `.tae-link-exit.tae-link-accessible`). No
region id is written in the check. The maze region it expects is the one that exit's link names. The map's region
count is the canvas's own.

**One view setting changes.** Unticking Fog of war is saved by the Maze Room (`_saveViewSettings`) and marks the region
discovered. A world that declares its own fog setting overrides it on load (`mazeRoomUI.js` ~:1722). Fog hides
everything but the player's own cells, so the themed tiles cannot be seen without unticking it.

Each step's text, in short:

- **meta, Maze Room:**
  - The walls, floor, exits, entrance and player are all drawn from the meta theme's art. The player is the orange
    disc.
  - The waves are the Progressive Swim pickup, drawn as the meta swimmer.
  - The speech bubble is the Narrator.
  - The blue `~` water gate keeps the maze default look, because the theme presents no water.
  - The theme's **Gate** guards the sword exit in the text adventure room. It is not in this world's maze.
- **meta, map:**
  - Both maze cells use the theme's art: the swimmer, and a Narrator in each cell.
  - The water gate and the Victory pickup are default.
- **control:**
  - Flat default tiles. The player is a blue disc and the swim pickup a labelled disc.
  - The same water gate. There is no Narrator.
- **Both map steps:** *"The composite map draws 4 of the maze's 14 tile kinds today: floor, wall, an open exit and
  the entrance. It does not draw the other 10: mana, the player, trap, the three block kinds (block, struck,
  dormant), button up and button down, pulser and pull."*

## What it shows (pictures)

All pictures are from the check walked in the Tutorial panel with **Do it**, on this branch, at 2×.

- `content-sets-fc1/maze-meta-vs-control.png`: the Maze Room canvas in region_2_3. meta_trial is on the left,
  concept_trial on the right.
- `content-sets-fc1/composite-map-meta-vs-control.png`: the APWorld Editor's Map canvas. meta_trial is on the left,
  the control on the right. Each map has the text adventure room (region_2_2) and two maze cells.
- `content-sets-fc1/screen-{meta,control}-{maze,map}.png`: the whole screen at each of the four views, with the step
  text in the Tutorial panel.

## Measured along the way

1. **The Presets panel cannot pick these worlds by hand.** `meta_trial` and `concept_trial` both index as game
   *Procgen Maze* (`preset_files.json`). The panel shows them as two of the fifteen unlabelled **1** buttons in the
   *Procgen Maze* row (`title="Seed 1"`, distinguished only by `data-game-directory`). So the load step names the
   link `?game=<id>&seed=1`, and **Do it** loads it the way `?game=` does. A label for these rows would be a Presets
   change, which is outside this slice.
2. **The Regions panel is not a route into the maze here.** After the world loads, the game state stands in
   region_2_2, but the Regions panel shows only `Menu` with its `GameStart` exit. Clicking that exit moves nowhere,
   since the source is already region_2_2, and no region_2_2 block appears. The text adventure's own links are the
   route a person takes.
3. **Two `done` checks would have passed on stale state.** Both were found by walking the check, and both are fixed
   in the check:
   - After `concept_trial` loads, the Maze Room still shows meta_trial's region_2_3 until the exit is taken. It has
     the same id and the same `Loaded region: region_2_3` line, and its world still has meta's thing. So
     `control-enter` also asks for a maze canvas drawn since the take step.
   - The APWorld Editor stays on its Map tab from the meta section. So `control-map` ticked itself while the Maze
     Room was still in front: **Do it** greyed out, and the control's map was never shown. The step now asks for the
     editor tab to be showing.
4. **The water gate is the same in both worlds** (the maze default pack's), as R4 and TIDY-1 said. The Victory
   pickup is the default look in both (no concept, no art).

## Tests

- **Bounded vitest** (`frontend/modules/tutorials/` and `frontend/modules/tests/testBatches.test.js`): 4 files, 91
  tests, all passed. `tutorials.test.js` validates every `FEATURE_CHECKS` entry's shape and the import rule.
  `testBatches.test.js` holds the `Feature checks` category in `feature-checks`. No count pin moved.
- **Local single row** (port 8130, this tree, under the box lock): `[PROGRESS 1/1]
  feature-check-content-theme-maze-look PASSED 2.2s`, walk timing `meta-load 0.3s, meta-take 0.4s, meta-enter 0.1s,
  meta-maze 0.0s, meta-map 0.1s, control-load 0.2s, control-take 0.4s, control-enter 0.0s, control-maze 0.0s,
  control-map 0.0s`.
- **CI at the tip** (the `feature-checks` dispatch with this row and its headroom, TT, `unittests` and JSUT) is quoted
  in the report-back.

No doc names the check. `docs/json/user/modules/tutorials.md` lists no feature checks one by one, and no procgen doc
was edited, so no docs pin is owed.

## Open, for the user

- **Should the composite map also draw the other 10 tile kinds?** This check exists to show it. The player is the
  most visible of them: it is drawn in the Maze Room and not on the map. In both worlds' maze regions, the player is
  the only one of the 10 present (no mana, traps, blocks, buttons, pulser or pull). So for these two worlds the
  question comes down to the player.
- Presets labels for the trial worlds (finding 1).
