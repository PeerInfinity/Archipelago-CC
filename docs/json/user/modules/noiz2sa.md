# Noiz2sa Panel

The Noiz2sa panel plays a generated world's **Noiz2sa** regions. Noiz2sa is Kenta Cho's bullet-hell shoot-'em-up: you fly a small ship through waves of patterned bullets. Each region is a stretch of the game's scenes — survive to the end of it to clear the region. Score is shown, but only surviving counts.

## When it shows the game

The panel shows the Noiz2sa region you are in. In any other kind of region it says *Currently playing …* and offers a button to open that kind's panel; with no generated world loaded it says *No procgen substrate is active for the current region.*

To try it, build a world that includes it: in the [Procgen Pipeline](procgenPipeline.md), add **Noiz2sa** under *Substrates* (or follow the [mixed world](../tutorials/procgen-mixed-world.md) tutorial), press **Run all**, then **Load into frontend**.

## Playing

When you arrive, the game lists what you can do, numbered:

- **go → …** — an exit. Clear the region's run and you leave by that exit.
- **check …** — a location (if the region has any). Clear its run — a longer one — and the location is checked; you stay in the region.

Press the number, or click the button under the game. Then press **Z** or click the game to start.

| Key | What it does |
|---|---|
| **Arrow keys** or **W A S D** | Fly. |
| **Z** | Fire. |
| **X** | Fly slowly, for threading through bullets. |
| **P** | Pause / resume. |
| **R** | Start the current run again. |
| **B** | Let the bot fly the current run; press again to take over. |
| **1 – 9** | Choose from the list. |

A **hit** restarts the run from its beginning. A boss's part of a run ends when the boss is destroyed, or after three minutes without being hit. The game pauses when you click elsewhere (unless the bot is flying), and it has no sound.

The line above the game names the region, the run and your attempt; the panel in the game's lower left counts your attempts, hits and time.

## Bot training

Below the game, **Bot training** shows how good the bot is, in five tracks — **seeing**, **thinking**, **hands**, **focus** and **panic** — each up to 100. You earn training points by playing Noiz2sa regions — in a Loop-mode world for the mana you spend there, otherwise for each second of play — credited when you leave the region. Spend them on the tracks:

- **Strategy** chooses how points are spent: **Even** (the default), one track first, or **By hand** — then **+1** on a track buys one step yourself.
- **Respec** puts every track back to 0 and returns the points, free.
- Once every track is at 100, the leftover **Surplus** can be turned into the current region's experience (**→ region XP**).

Outside Loop mode the bot always flies at its best; your training is what it flies with in Loop mode. The training is kept in your browser across reloads; the [Storage panel](storagePanel.md) lists it.

## The bot and Loop mode

The [Playback Bot](playbackBot.md) plays Noiz2sa regions here — at its best outside Loop mode, at the skill you have trained in it — retrying after a hit until it clears. In a Loop-mode world, flying costs mana for each second of play (waiting, paused and the choice list are free), and a hit does not give back the mana already spent. A Noiz2sa region's block in the [Loops](loops.md) panel can be flown by hand, recorded and played back, or left to the bot.

How hard the region holding **Victory** is, and how good the bot should be by then, are set in the Procgen Pipeline's *noiz2sa parameters* (**Final region span**, **Victory skill**). Settings for the training — point prices, the bot's speed and retry cap — are in the Settings panel, under *noiz2saSubstrate*.

## Learn more

- Tutorials: [a mixed world](../tutorials/procgen-mixed-world.md) and [everything, in Loop mode](../tutorials/procgen-loop-mode-everything.md).
- [The procgen substrates](../../features/procgen-substrates.md).
- For developers: [the Noiz2sa substrate](../../developer/procgen/noiz2sa.md).
