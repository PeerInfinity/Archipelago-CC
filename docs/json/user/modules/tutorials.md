# Tutorial Panel

The Tutorial panel walks you through the app one step at a time — and can do each step for you, so you can watch what happens. It sits in the left column of the default layout, next to Quick Launch.

## Starting a tutorial

The panel opens on a list of tutorials, grouped by what they teach. Two groups are collapsed until you open them: **In progress** (tutorials that are written but do not work all the way through yet) and **For developers**. Press **Start** on one. The panel then moves into a stack of its own *below* the panels it shared a stack with, so it stays visible while you open other panels on the left. (The default layout is not split until you start a tutorial.) If you stopped part-way through, the list offers **Resume** at the step you were on.

Each step shows its section of the tutorial, with the current step marked. You can:

- **◀ Back** / **Next ▶** — move between steps. Clicking a step goes straight to it.
- **Do it** — have the panel perform the current step. With *Animate the cursor* on, a pointer moves to each tab or button and presses it, so you can see where it is.
- **▶ Play** — perform every step from here, one after another. **⏸ Pause** stops after the current step.
- **Merge ⇧** / **Split ⇩** — put the panel back into the stack above it, or give it its own stack again.
- **Quick Launch** — bring the [Quick Launch panel](quickLaunch.md) forward, from which every other panel can be opened.
- **All tutorials** — stop the tutorial and go back to the list. This also merges the panel back.

A step whose result the panel can check is ticked (✓) once it is done — whether the panel did it or you did it yourself. With *Auto-advance* on, the panel then moves to the next step on its own.

Some steps happen **outside the app**, such as starting a local Archipelago server. Their command is shown in a box with a **Copy** button. The panel cannot do these for you, so **Do it** is off; **Play** waits until the app can see the step is done (for example, the Console connecting), or stops so you can do the step and press **Next ▶**.

An **in-progress** tutorial is marked with a badge. Its card and its first screen say which step does not work yet, and that step is marked in the list of steps.

While a step is current, the next thing to press is outlined: the panel's tab, the **▾** button of a stack whose tab has spilled into that stack's list, or the button the step names.

On the mobile layout the panel is never split, and there is no cursor or outline; **Do it** and **Play** still work.

## Opening a tutorial from a link

Add `?tutorial=<id>` to the app's address to open it with that tutorial started — for example, this link loads the Guided Tour's world and starts the tour:

**<https://peerinfinity.github.io/Archipelago-CC/?game=procgen_maze&seed=1&tutorial=guided-tour>**

`&tutorialStep=<n>` starts at step *n* instead of the first. (The [URL parameters reference](../../developer/reference/url-parameters.md#tutorial--tutorialstep) has the details.)

## Tutorials

Tutorials are grouped by what they teach; procgen is the project's core use. Each one opens from a link with `?tutorial=<id>`.

<!-- BEGIN GENERATED tutorial lists (scripts/tutorials/generate-tutorial-docs.mjs; edit the tutorial data, not this) -->

### Getting started

- **Guided Tour** ([guide](../guided-tour.md)) — Watch a generated world play itself, see the logic underneath, and generate a world of your own. `?tutorial=guided-tour`

### In progress

Written, but not working all the way through yet. The panel lists these in a collapsed section and marks the step where each one stops.

- **Procgen: Sphere growth, with Maze** — Generate a maze-only world with the Sphere growth mode, load it, and watch the Playback Bot finish it. `?tutorial=procgen-sphere-growth`
- **Procgen: Shuffled spiral, with Maze** — Generate a maze-only world with the Shuffled spiral mode, load it, and watch the Playback Bot finish it. `?tutorial=procgen-shuffled-spiral`
- **Procgen: Grid growth, with Maze** — Generate a maze-only world with the legacy Grid growth mode, load it, and watch the Playback Bot finish it. `?tutorial=procgen-grid-growth`
- **Procgen: Top-down, with Maze** — Turn an existing game's region graph (Adventure) into a world of mazes with the Top-down mode, and watch the Playback Bot finish it. `?tutorial=procgen-top-down`
- **Procgen: settings and the Playback Bot** — Change a generated world's seed and size, run the pipeline one step at a time, and drive the Playback Bot by hand. `?tutorial=procgen-settings-and-bot`
- **Procgen: from a generated world to a multiworld** — Take a generated world through the APWorld Editor to a .apworld, play it on a local Archipelago server, and let the Playback Bot send the checks. `?tutorial=procgen-to-multiworld`
- **Procgen: editing a bounce region** — Open a generated world's bounce zone in the Bounce Region Editor, change a platform, save it back to the pipeline, and play the result. `?tutorial=procgen-bounce-region-editor`
- **Procgen: Seedling rooms** — Put generated Seedling rooms into a procgen world, play them in the original game, look at a room in the Procgen Lab, and watch the bot. `?tutorial=procgen-seedling`
- **Procgen: a mixed world** — Build one world from a maze, a text adventure, a bounce zone, a Noiz2sa stage and a generated Seedling room, and watch the Playback Bot play every kind. `?tutorial=procgen-mixed-world`
- **Procgen: Journey to Ascension in Loop mode** — Generate a world of Journey to Ascension zones with loop mode on, see the loop panels, and watch the bot finish it. `?tutorial=procgen-loop-mode-jta`
- **Procgen: everything, in Loop mode** — Mix every substrate — Idle Loops included — into one loop-mode world sharing one mana pool, and watch the bot finish it. `?tutorial=procgen-loop-mode-everything`

### Panels with no tutorial

These panels are deliberately left out of the tutorials:

| Panel | Why |
|---|---|
| JtA Action Queue | Part of the non-procgen Journey to Ascension, which is deprecated. |
| JtA Game Data | Part of the non-procgen Journey to Ascension, which is deprecated. |
| JtA Cost Debugger | Deprecated. |
| Rule Converter | Very out of date; it may be deprecated or removed. |
| Tile Map Analyzer | Currently a failed experiment. |

<!-- END GENERATED tutorial lists -->

## Settings

In the Settings panel, under *tutorials*:

| Setting | Default | What it does |
|---|---|---|
| Auto-advance | on | Move to the next step once the current one is done. Play always advances. |
| Auto-advance delay (ms) | 1200 | How long a finished step stays on screen before the next one. |
| Animate the cursor | on | Show the moving pointer when the panel performs a step. |
| Cursor move time (ms) | 600 | How long the pointer takes to reach each target. |
| Outline the next control | on | Outline the next thing to press. |
