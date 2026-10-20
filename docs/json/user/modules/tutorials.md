# Tutorial Panel

The Tutorial panel walks you through the app one step at a time — and can do each step for you, so you can watch what happens. It sits in the left column of the default layout, next to Quick Launch.

## Starting a tutorial

The panel opens on a list of tutorials in sections, every one collapsed until you click its heading: one section per group of finished tutorials (**Getting started**, **Procgen**, …), then **Needs a terminal** (tutorials with a step you run in a terminal yourself), **In progress** (tutorials that are written but do not work all the way through yet) and **For developers**. Inside **Needs a terminal** and **In progress**, each group is a collapsed subsection of its own. The last section, **Feature checks**, holds scripted walks that test a feature rather than teach one; they start and play like tutorials, but have no guide. A section you open stays open while the panel is open; the next time the app loads, they are all collapsed again. Press **Start** on a tutorial. The panel then moves into a stack of its own *below* the panels it shared a stack with, so it stays visible while you open other panels on the left. (The default layout is not split until you start a tutorial.) A tutorial always starts from its first step: the earlier steps set up the state the later ones need, and reloading the page does not keep that state. When you leave a tutorial with **All tutorials**, the sections that hold it open again.

Each step shows its section of the tutorial, with the current step marked. You can:

- **◀ Back** / **Next ▶** — move between steps. Clicking a step goes straight to it.
- **Do it** — have the panel perform the current step. With *Animate the cursor* on, a pointer moves to each tab or button and presses it, so you can see where it is.
- **▶ Play** — perform every step from here, one after another. **⏸ Pause** stops after the current step.
- **Merge ⇧** / **Split ⇩** — put the panel back into the stack above it, or give it its own stack again.
- **Quick Launch** — bring the [Quick Launch panel](quickLaunch.md) forward, from which every other panel can be opened.
- **All tutorials** — stop the tutorial and go back to the list. This also merges the panel back.

A step whose result the panel can check is ticked (✓) once it is done — whether the panel did it or you did it yourself. With *Auto-advance* on, the panel then moves to the next step on its own.

Some steps happen **outside the app**, such as starting a local Archipelago server. Their command is shown in a box with a **Copy** button. The panel cannot do these for you, so **Do it** is off; **Play** waits until the app can see the step is done (for example, the Console connecting), or stops so you can do the step and press **Next ▶**.

A tutorial that **needs a terminal** is marked with a badge, and its card and first screen name the first step you run in a terminal. The panel does every step before that one, and its test checks them. The test cannot run a terminal, so the steps after it are not checked.

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

### Procgen

- **Procgen: Sphere growth, with Maze** ([guide](../tutorials/procgen-sphere-growth.md)) — Generate a maze-only world with the Sphere growth mode, load it, and watch the Playback Bot finish it. `?tutorial=procgen-sphere-growth`
- **Procgen: Shuffled spiral, with Maze** ([guide](../tutorials/procgen-shuffled-spiral.md)) — Generate a maze-only world with the Shuffled spiral mode, load it, and watch the Playback Bot finish it. `?tutorial=procgen-shuffled-spiral`
- **Procgen: Grid growth, with Maze** ([guide](../tutorials/procgen-grid-growth.md)) — Generate a maze-only world with the legacy Grid growth mode, load it, and watch the Playback Bot finish it. `?tutorial=procgen-grid-growth`
- **Procgen: Top-down, with Maze** ([guide](../tutorials/procgen-top-down.md)) — Turn an existing game's region graph (Adventure) into a world of mazes with the Top-down mode, and watch the Playback Bot finish it. `?tutorial=procgen-top-down`
- **Procgen: settings and the Playback Bot** ([guide](../tutorials/procgen-settings-and-bot.md)) — Change a generated world's seed and size, run the pipeline one step at a time, and drive the Playback Bot by hand. `?tutorial=procgen-settings-and-bot`
- **Procgen: editing a bounce region** ([guide](../tutorials/procgen-bounce-region-editor.md)) — Open a generated world's bounce zone in the Bounce Region Editor, change a platform, save it back to the pipeline, and play the result. `?tutorial=procgen-bounce-region-editor`
- **Procgen: Seedling rooms** ([guide](../tutorials/procgen-seedling.md)) — Put generated Seedling rooms into a procgen world, play them in the original game, look at a room in the Procgen Lab, and watch the bot. `?tutorial=procgen-seedling`
- **Procgen: a mixed world** ([guide](../tutorials/procgen-mixed-world.md)) — Build one world from a maze, a text adventure, a bounce zone, a stretch of Noiz2sa and a generated Seedling room, and watch the Playback Bot play every kind. `?tutorial=procgen-mixed-world`
- **Procgen: Journey to Ascension in Loop mode** ([guide](../tutorials/procgen-loop-mode-jta.md)) — Generate a world of Journey to Ascension zones with loop mode on, see the loop panels, and watch the bot finish it. `?tutorial=procgen-loop-mode-jta`
- **Procgen: everything, in Loop mode** ([guide](../tutorials/procgen-loop-mode-everything.md)) — Mix every substrate — Idle Loops included — into one loop-mode world sharing one mana pool, and watch the bot finish it. `?tutorial=procgen-loop-mode-everything`

### Seedling

- **Seedling: recompile the original game in your browser** ([guide](../tutorials/seedling-recompile.md)) — Turn a Flash file into a WebAssembly program in the browser and run it — then, if you like, all of Seedling. `?tutorial=seedling-recompile`
- **Seedling: watch the bot play** ([guide](../tutorials/seedling-bot.md)) — Load the whole of Seedling as an Archipelago world and watch the Playback Bot take its first checks in the original game. `?tutorial=seedling-bot`

### MetaMath, DepGraph and APCalc

- **APCalc: generate a world** ([guide](../tutorials/apcalc-generator.md)) — Generate a new APCalc map with the APCalc Generator, play it, and package it as a .apworld. `?tutorial=apcalc-generator`

### Needs a terminal

Each of these runs a command in a terminal partway through. The panel can do every step before that one, and its test checks those steps. At the terminal step, copy the command and run it yourself. The test cannot run a terminal, so it does not check the steps after that one. The panel lists these in a collapsed section.

- **Procgen: from a generated world to a multiworld** ([guide](../tutorials/procgen-to-multiworld.md)) — Take a generated world through the APWorld Editor to a .apworld, play it on a local Archipelago server, and let the Playback Bot send the checks. `?tutorial=procgen-to-multiworld`
- **Seedling: in a multiworld** ([guide](../tutorials/seedling-multiworld.md)) — Generate a multiworld with Seedling Playthrough, host it locally, and connect the app to play it. `?tutorial=seedling-multiworld`
- **MetaMath: in a multiworld** ([guide](../tutorials/metamath-multiworld.md)) — Host a MetaMath proof on a local Archipelago server and prove it from the app. `?tutorial=metamath-multiworld`
- **DepGraph: more graphs, and your own** ([guide](../tutorials/depgraph-extras.md)) — Load DepGraph's other bundled graphs, see one in the Region Graph, and turn a task list of your own into a game. `?tutorial=depgraph-extras`
- **DepGraph: in a multiworld** ([guide](../tutorials/depgraph-multiworld.md)) — Host a DepGraph graph on a local Archipelago server and solve it from the app. `?tutorial=depgraph-multiworld`
- **APCalc: in a multiworld** ([guide](../tutorials/apcalc-multiworld.md)) — Host APCalc on a local Archipelago server and play it from the app. `?tutorial=apcalc-multiworld`
- **Track a game** ([guide](../tutorials/tracker-track-a-game.md)) — Load a game's logic, track items and checks by hand, see what is reachable, and connect to your multiworld's server. `?tutorial=tracker-track-a-game`

### In progress

Written, but not working all the way through yet. The panel lists these in a collapsed section and marks the step where each one stops.

- **Your workbench** — Find any panel with Quick Launch, arrange the tabs, follow a tutorial beside your work, and switch modules on and off. `?tutorial=start-workbench`
- **Saving your setup** — Change the options and settings, save the layout and settings as a mode of your own, and clear what the app keeps in your browser. `?tutorial=start-saving-your-setup`
- **Procgen: a runner world** — Play a generated world of auto-running platformer strips, where the jumps you can make are the items you hold. `?tutorial=procgen-runner-demo`
- **Seedling: the bot through the whole game** — Watch the Playback Bot play the original Seedling from the first chest to the end. `?tutorial=seedling-whole-game`
- **MetaMath: prove 2 + 2 = 4** — Play a MetaMath proof as an Archipelago game: each proof step is a location, unlocked when the steps it depends on are proved. `?tutorial=metamath-demo`
- **DepGraph: a coding adventure** — Play a dependency graph as an Archipelago game: each task is a location, unlocked when the tasks it depends on are done. `?tutorial=depgraph-demo`
- **APCalc: the calculator game** — Play APCalc: a calculator whose number and operation keys are the items, and whose results are the locations. `?tutorial=apcalc-demo`
- **Tracking: why can't I get there?** — Ask the Path Analyzer how to reach a region, and which items each way needs. `?tutorial=tracker-path-analyzer`
- **Tracking: the Region Graph** — Track a game on the Region Graph: regions coloured by reachability, clicked to move, check and show. `?tutorial=tracker-region-graph`
- **Tracking: dungeons** — See a dungeon's regions and boss in the Dungeons panel. `?tutorial=tracker-dungeons`
- **Tracking: helpers** — Watch a game's helper rules — "can lift rocks" and the like — turn true as you collect items. `?tutorial=tracker-helpers`
- **Tracking: the Spoiler Checklist** — Follow a seed's spoiler sphere by sphere, and see which item each location holds. `?tutorial=tracker-spoiler-checklist`
- **Tracking: check reachable locations automatically** — Let the Playback Bot check every reachable location by itself, on a timer. `?tutorial=tracker-timer`
- **Tracking: the rules in the Editor** — Read the loaded game's rules JSON — and other data — in the Editor. `?tutorial=tracker-editor`
- **Adventure in Loop Mode** — Turn a world into an incremental game: queue moves, explores and checks, spend mana, and start again when it runs out. `?tutorial=loops-adventure`
- **Embedding pages and windows** — Load a page into an Iframe panel, or open it in a window of its own, and watch it connect to the app. `?tutorial=other-embedding`
- **The Vibe Coding Simulator** — Manage unreliable AI agents building a project, one feature (one location) at a time — a joke game, fully playable. `?tutorial=other-vibe-coding`

### For developers (a collapsed section in the panel)

- **Run the in-app tests** — Run one of the app's in-app tests from the Tests panel and read its conditions. `?tutorial=dev-tests`
- **Replay a spoiler test** — Replay a world's solution sphere by sphere and check the app's logic reaches what the generator said it would. `?tutorial=dev-spoiler-test`
- **The event registry** — See which modules publish and subscribe to each event, in the Events panel. `?tutorial=dev-events`
- **The Loops Cost Debugger** — Plan a world's solution as a Loop-mode queue and see what each step would cost. `?tutorial=dev-loops-cost-debugger`
- **The Region Marking Tool** — Mark a level map's regions, exits and locations by hand, and save them as a region atlas. `?tutorial=dev-region-marking-tool`

### Panels with no tutorial

These panels are deliberately left out of the tutorials:

| Panel | Why |
|---|---|
| JtA Action Queue | Part of the non-procgen Journey to Ascension, which is deprecated. |
| JtA Game Data | Part of the non-procgen Journey to Ascension, which is deprecated. |
| JtA Cost Debugger | Deprecated. |
| Rule Converter | Deprecated. |
| Tile Map Analyzer | Currently a failed experiment. |
| Meta Game | Deprecated (an early draft of the procgen idea). |
| Progress Bars | Deprecated, with the Meta Game panel. |
| Flash Substrate | A placeholder page, not a substrate: no world uses it. |

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
