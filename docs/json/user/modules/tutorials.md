# Tutorial Panel

The Tutorial panel walks you through the app one step at a time — and can do each step for you, so you can watch what happens. It sits in the left column of the default layout, next to Quick Launch.

## Starting a tutorial

The panel opens on a list of tutorials. Press **Start** on one. The panel then moves into a stack of its own *below* the panels it shared a stack with, so it stays visible while you open other panels on the left. (The default layout is not split until you start a tutorial.) If you stopped part-way through, the list offers **Resume** at the step you were on.

Each step shows its section of the tutorial, with the current step marked. You can:

- **◀ Back** / **Next ▶** — move between steps. Clicking a step goes straight to it.
- **Do it** — have the panel perform the current step. With *Animate the cursor* on, a pointer moves to each tab or button and presses it, so you can see where it is.
- **▶ Play** — perform every step from here, one after another. **⏸ Pause** stops after the current step.
- **Merge ⇧** / **Split ⇩** — put the panel back into the stack above it, or give it its own stack again.
- **Quick Launch** — bring the [Quick Launch panel](quickLaunch.md) forward, from which every other panel can be opened.
- **All tutorials** — stop the tutorial and go back to the list. This also merges the panel back.

A step whose result the panel can check is ticked (✓) once it is done — whether the panel did it or you did it yourself. With *Auto-advance* on, the panel then moves to the next step on its own.

While a step is current, the next thing to press is outlined: the panel's tab, the **▾** button of a stack whose tab has spilled into that stack's list, or the button the step names.

On the mobile layout the panel is never split, and there is no cursor or outline; **Do it** and **Play** still work.

## Opening a tutorial from a link

Add `?tutorial=<id>` to the app's address to open it with that tutorial started — for example, this link loads the Guided Tour's world and starts the tour:

**<https://peerinfinity.github.io/Archipelago-CC/?game=procgen_maze&seed=1&tutorial=guided-tour>**

`&tutorialStep=<n>` starts at step *n* instead of the first. (The [URL parameters reference](../../developer/reference/url-parameters.md#tutorial--tutorialstep) has the details.)

## Tutorials

- **Guided Tour** — watch a generated world play itself, see the logic underneath, and generate a world of your own. It is the same tour as the [Guided Tour guide](../guided-tour.md), which is generated from the tutorial.

## Settings

In the Settings panel, under *tutorials*:

| Setting | Default | What it does |
|---|---|---|
| Auto-advance | on | Move to the next step once the current one is done. Play always advances. |
| Auto-advance delay (ms) | 1200 | How long a finished step stays on screen before the next one. |
| Animate the cursor | on | Show the moving pointer when the panel performs a step. |
| Cursor move time (ms) | 600 | How long the pointer takes to reach each target. |
| Outline the next control | on | Outline the next thing to press. |
