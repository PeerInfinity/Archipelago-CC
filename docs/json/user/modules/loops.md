# Loops Panel

The Loops panel runs **Loop mode**, which turns a world into an incremental game. Instead of acting directly, you build a **queue** of actions — move to a region, explore it, check a location — and the queue runs, spending **mana**. When the mana runs out the loop starts over from the beginning, but the **experience** each region earned stays, so every loop gets a little further. It works with any world, and generated worlds can be built for it.

## Starting Loop mode

- A world generated with **Enable loop mode** in the [Procgen Pipeline](procgenPipeline.md) — for example the preset **Maze hazards + loop mode (sphere growth)** — turns Loop mode on when you load it.
- For any other world, the panel first says **No cost data loaded** and offers two buttons. **Generate Costs** works out each action's cost from the world's solution; **Accept Defaults** gives every move and every check a fixed cost. Either one enters Loop mode.
- **Enter Loop Mode** / **Exit Loop Mode** (under **Controls**) switches it by hand. A world that only works in Loop mode (one with Journey to Ascension or Idle Loops zones) cannot leave it.

## Mana and experience

- Each loop starts with a full **Mana** bar: 100, plus 10 for each item you have received (some kinds of zone add more). Every action spends mana while it runs; the bar shows what is left.
- When the mana reaches 0, the loop resets: mana refills, and the queue goes back to its first action. With **Auto-restart when queue complete** off, the queue then waits for you to press **Resume**.
- Each region gains **experience** as you spend mana in it. Every level makes that region's actions 5% cheaper (the **+N%** beside the level). Experience survives resets.

## The queue

Below the mana bar there is one block per region the queue visits, starting with the region you start in. Each block's header shows the region's name, its **Level**, its discount and an experience bar; click the header to open or fold it. The queued actions are listed in the block they run in, each with its cost, the mana that will be left after it (red when there will not be enough), and how long it will take. **✕** removes an action — removing a move also removes everything after it.

Open a block to add actions:

- **Explore Region** queues an explore of that region. It earns experience and uncovers the region's hidden exits and locations: Loop mode turns Discovery mode on, so what you have not discovered yet is shown as **???**. Tick **Repeat** to queue it again each time it finishes.
- **Exits** — click an available exit to queue moving through it.
- **Locations** — click an available location to queue checking it.

Clicking in other panels does not add to the queue unless you choose so with **Click-to-queue** (below); the [Region Graph](regionGraph.md) and the Menu panel's exits always queue in Loop mode.

## Running it

| Control | What it does |
|---|---|
| **Start** / **Pause** / **Resume** | Run the queue, or pause it. |
| **Restart** | Go back to the first action, refill the mana, and run. |
| **Step** | Run the next action, then pause. At the end of the queue it becomes **Reset**: back to the start, mana refilled, paused. |
| **Clear Queue** | Remove every action and go back to the start region. |
| **Expand All** / **Collapse All** | Open or fold every block. |
| **Compact View** | Show the queue as one table. |

The line under the mana bar says what is running: *Action N of M: …* with its progress, or *Queue idle*, *Queue paused*, *Queue complete*.

## Controls

Click **▼ Controls** to unfold the rest:

- **Speed** — how fast actions run (100× to start with). **Instant** finishes each action at once.
- **Auto-restart when queue complete** — keep looping on its own after each reset.
- **Auto-resume on new action** — a finished queue carries on as soon as you add an action.
- **Auto-remove completed actions** — drop actions from the list once they have run.
- **Keep this panel focused** — stop the game panels coming to the front while the queue runs.
- **Click-to-queue** — what a click in the Regions, Locations or Exits panel does in Loop mode: **Off** (the default — the click acts at once, as it would without Loop mode), **Append to queue** (add it to the end of the queue), or **Rebuild path (advanced)** (replace the queue with a path to what you clicked).
- **Save Game** / **Load Game** keep the loop's progress — mana, experience, block settings — in your browser; **Export** / **Import** save it to or load it from a file. **Hard Reset** clears the queue, all experience and what has been discovered, and refills the mana (it asks first).
- **Clear Explore Actions** removes every queued explore.

## Generated worlds: playing a region yourself, or by the bot

In a generated world, each region's block has a **Mode**:

| Mode | What happens when the queue reaches the region |
|---|---|
| **Manual** | The queue stops so you can play the region yourself in its panel (the [Maze Room](mazeRoom.md), [Bounce Demo](bounceDemo.md), [Noiz2sa](noiz2sa.md), …). Leaving by the exit the queue expects carries it on. |
| **Record** | Like Manual, but your visit is recorded: the actions, mana and time it took. |
| **Playback** | Replays the recorded visit (available once there is a recording — **● recorded**). |
| **Bot** | The bot plays the region in its panel. |

New blocks start in **Record**, and switch to **Playback** after a recording (**Auto-switch to Playback after recording**). Under **Controls**, **Default block mode**, **Set all blocks** and **Set all Instant** change every block at once; a block's own **Instant** box replays it at once. In a maze region, **Custom queue** picks one of the maze's saved best paths.

To let the bot do all of it — choose what to queue, loop after loop, until the world is finished — use the [Playback Bot](playbackBot.md#in-loop-mode).

## Learn more

- The [Loop Stats](loopStats.md) panel shows each queued action's cost and the mana left, this loop and the last.
- Tutorials: [Journey to Ascension in Loop mode](../tutorials/procgen-loop-mode-jta.md) and [everything, in Loop mode](../tutorials/procgen-loop-mode-everything.md).
- [Loop mode, the feature](../../features/loops.md).
- For developers: [loop recording](../../developer/procgen/loop-recording.md).
