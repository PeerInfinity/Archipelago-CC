# Loops Mode

**[Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=loops)**

Loops is an incremental/idle game mode layered on top of the Archipelago tracker. Instead of checking locations directly, you queue actions and watch them execute automatically, spending mana on each action. When mana runs out, the loop resets and you start again — but with XP earned from previous loops reducing future costs.

Inspired by idle games like [Idle Loops](https://stopsign.github.io/idleLoops/), [Stuck in Time](https://store.steampowered.com/app/1681110/Stuck_In_Time/), and [Increlution](https://store.steampowered.com/app/1593350/Increlution/).

## How It Works

### Core Loop

1. You start each loop in the Menu region with full mana
2. Queue actions: move to regions, explore undiscovered areas, check locations
3. Actions execute automatically, each consuming mana based on its cost
4. When mana runs out, the loop resets: mana refills, position resets, queue restarts
5. Checked locations and earned XP persist across loops

### Action Types

| Action | Description | Base Cost |
|--------|-------------|-----------|
| **Move to Region** | Navigate to an adjacent region | Region's move cost (from cost data, or 50 default) |
| **Explore Region** | Discover locations and exits in a region | 2x the region's move cost |
| **Check Location** | Check a location for items | Per-location cost (from cost data, or 100 default) |

Actions are animated in real time. Each action's duration is proportional to its mana cost — expensive actions take longer. The formula is: `time = (cost * 5) / gameSpeed` seconds.

### Mana

Mana is the core resource that limits what you can accomplish in a single loop.

- **Base mana**: 100
- **Mana per item**: Each inventory item adds 10 to your max mana
- **Max mana formula**: `100 + (itemCount * 10)`
- Mana is consumed continuously as actions execute (not all at once)
- When mana hits 0, the loop resets
- On reset, mana refills to its current maximum

As you check locations and receive items, your max mana grows, letting you do more per loop.

### XP and Leveling

Each region tracks its own XP. Every mana point spent on an action in a region grants 1 XP to that region.

**XP thresholds:**

| Level | XP to Next Level | Total XP | Cost Reduction |
|-------|------------------|----------|----------------|
| 0 → 1 | 100 | 100 | 5% |
| 1 → 2 | 120 | 220 | 10% |
| 2 → 3 | 140 | 360 | 15% |
| 3 → 4 | 160 | 520 | 20% |
| N → N+1 | 100 + N×20 | 10N² + 90N | N×5% |

**Cost reduction formula**: `finalCost = baseCost / (1 + level * 0.05)`

At level 10, actions cost half their base price. At level 20, they cost a third. This means early loops are about exploration and discovery, while later loops become efficient as XP accumulates.

### Progression Strategy

- **Queue optimization**: Design efficient action sequences that check the most locations per loop
- **Mana management**: Balance exploration (expensive) with exploitation (cheaper with XP)
- **Region ordering**: Visit cheaper regions first to save mana for expensive areas deeper in the path
- **Explore vs. check**: Exploring costs 2x move cost but unlocks locations. Once discovered, check individual locations for their specific costs.

## How to Play

### Starting Loops Mode

Load the mode via URL parameter:
```
?mode=loops
```

Or select "Loops" from the mode selector in the frontend.

**Important**: The parameter must be `loops` (plural). `?mode=loop` does not work.

### Building a Queue

When Loops mode is active, clicking in the tracker queues actions instead of executing them directly:

- **Click a location** → Pathfinding calculates the route from Menu to the location's region, queues all the intermediate region moves, then queues the location check (or an explore action if the location is undiscovered)
- **Click an exit** → Queues region moves along the path to the exit's source region, then moves through the exit (or queues an explore if the exit is undiscovered)

Each click replaces the current queue with a fresh path to the clicked target.

### Controls

| Control | Function |
|---------|----------|
| **Start** | Begin processing the action queue |
| **Pause** | Stop processing mid-queue (resume from same point) |
| **Resume** | Continue from where you paused |
| **Restart** | Reset the loop (refill mana) and start the queue from the beginning |
| **Speed slider** | Adjust game speed (0.1x to 100x) |
| **Instant mode** | Global: timer actions complete in one frame (disables speed slider). Distinct from the per-block **Instant** checkbox described under [Block Modes](#playing-a-substrate-region-block-modes) |
| **Auto-restart** | Keep the queue running instead of stopping when a loop reset interrupts it. Applies to resets **loops itself causes** — running the pool dry. A reset the underlying game causes (Journey to Ascension, Idle Loops) always continues, because the game has already restarted and stopping would only strand the queue behind it |
| **Auto-resume** | Automatically resume processing when new actions are added after queue completion |
| **Auto-remove** | Remove completed location checks and fully-explored explore actions from the queue |
| **Clear queue** | Remove all queued actions |
| **Clear explores** | Remove only explore actions from the queue |

### Processing States

The queue cycles through these states:

| State | Meaning | Button |
|-------|---------|--------|
| **idle** | Queue not started or empty | Start |
| **running** | Actively processing actions | Pause |
| **paused** | User paused mid-queue | Resume |
| **completed** | Queue ran to the end | Restart |
| **waiting** | Queue completed, auto-resume on, waiting for new actions | — |

### Repeat Explore

Explore actions can be set to repeat. When a repeating explore action completes, a new explore action is automatically appended to the queue for the same region. This is useful for grinding XP in a region without manually re-queuing.

## Playing a Substrate Region: Block Modes

Everything above describes a queue of *tracker* actions — moves, explores, location checks — executed by a timer. When a region is backed by a **substrate** (an actual game: a maze, a text adventure, Journey to Ascension, Idle Loops, a runner or bounce level), the queue can hand that region over to you, to a recording, or to the game's own automation.

The unit of that choice is a **block**: one visit to one region, i.e. the run of queued entries between the move that brings you in and the move that takes you out. Visit the same region twice and you get two blocks, each with its own settings. Every block's header carries a row of radios:

| Mode | What happens when the queue reaches the block |
|------|-----------------------------------------------|
| **Manual** | The queue **parks** and hands you the controls. You play the region yourself; your actions cost mana as you perform them. Leaving through the exit the queue expected resumes the queue at the next block. |
| **Record** | Manual, plus the visit is remembered. On a successful exit the block's contents are rewritten to what you actually did, and (by default) the block flips itself to Playback so the next loop replays it. |
| **Playback** | The saved recording is replayed for you. Depending on the game this is a faithful re-enactment of your inputs, or an instant application of the visit's net result. |
| **Bot** | The game's own automation plays the block. Available only for regions whose game can drive itself to a queued target. |

**Record is the default**, which gives loop mode its intended rhythm: the first time you reach a region you play it by hand, and every loop after that replays it while you push on to the next one.

### What each mode costs

All four cost the same. A region visit is priced by what happens in it, not by who performed it — playing a block by hand, recording it, replaying the recording, and letting the Bot do it all charge the same mana and earn the same XP. There is no cheaper way to do the same content, and no penalty for automating it.

### Instant

**Instant** is a separate checkbox next to the radios, not a fifth mode. It applies to Playback and Bot blocks: instead of animating, the block resolves in a single frame.

Two things to know:

- **It is per-block.** You choose which visits you watch and which ones just happen.
- **It is not offered everywhere.** The checkbox appears only where the game underneath actually supports it — some games have no fast-forward at all, and where the Bot is involved it appears only where the automation itself honours it. A box that did nothing would be worse than no box.

Which games *should* offer Instant is under active design review. Several substrates are idle games whose pacing is the point — waiting is a real strategic cost, and removing it changes the game rather than speeding it up. Expect the set of Instant-capable regions to change.

### The normal way to play

The pattern the mode system is built around:

> **Every region Instant except the frontier — and live play at the frontier.**

Regions you have already solved are set to Playback + Instant, so a loop spends almost no real time replaying them. The one region you are actually working on stays Manual or Record, and that is where you spend the loop. As the frontier advances, yesterday's frontier becomes another instant replay.

That is also why loops are expected to be *short* in wall-clock time and *long* in queue: the queue grows with everything you have solved, but only the tail of it is played at human speed.

### Recordings

Recordings persist. They are stored per world, per region, and per *arrival* — which exit you came in through — so a region you enter two different ways keeps a separate recording for each.

- Re-recording a block **replaces** that block's recording rather than piling up duplicates.
- Recordings **survive deleting the block**. Rebuild a matching visit later and its recording comes back automatically.
- A per-block indicator (`● recorded` / `○ not recorded`) says whether one exists, and the **Playback** radio stays disabled until the block has something to play — so the mode you can pick is always a mode that will work.

### Why the game sometimes ignores your clicks

While loop mode is on, playing a substrate is only allowed **when the queue is parked on that region and is in Manual, Record, or a Bot block that fell back to live play**. Click into a game at any other time — the queue not started, paused, finished, empty, or parked somewhere else — and the action is refused with a `loops:clickIgnored` notice rather than silently taken.

This is deliberate. Loop mode's whole economy rests on every action being charged and, where relevant, captured; an action performed outside a parked block would be free, unrecorded, and out of order. The rule of thumb: **if you want to play, make the queue park you there.**

What is never blocked: the queue's own execution, the teleport that follows a loop reset, and the tracker's planning clicks (which author the queue rather than play the game).

### Loop games inside loop mode

Some substrates — Journey to Ascension and Idle Loops today — are *already* loop games: their own economy resets you to the start when a resource runs out. For those, a native reset **is** a loop-mode reset, and the two are wired together rather than kept apart. Consequences worth expecting:

- Loop mode **cannot be turned off** while such a world is loaded. It is not an optional layer there; it is the game's own structure.
- A recording, or a Bot walk, **routinely spans several loops**. One pool of mana is often not enough for one region visit, so the reset teleports you back and the queue re-drives from the start and returns. That is the intended behaviour, not a failure.

For the full mechanics, see the developer page [Loop Recording and Block Modes](../developer/procgen/loop-recording.md).

## Cost Data System

The mana cost for each region move and location check can be customized per game via cost data files.

### Cost Data File

Cost data is stored alongside preset files:
```
frontend/presets/{game}/AP_{seed_id}/AP_{seed_id}_costs.json
```

Format:
```json
{
  "version": "1.0",
  "generatedFrom": "AP_14089154938208861744_sphere_log.jsonl",
  "generatedAt": "2025-01-15T10:30:00Z",
  "regions": {
    "Menu": { "moveCost": 0 },
    "Light World": { "moveCost": 12 },
    "Kakariko": { "moveCost": 8 }
  },
  "locations": {
    "Kakariko - Bug Kid": 15,
    "Eastern Palace - Big Chest": 45
  },
  "defaultRegionCost": 50,
  "defaultLocationCost": 10
}
```

### Cost Generator

The cost generator creates balanced cost data by simulating an actual playthrough of the sphere log using the real loop mechanics:

1. Start at the start region with max mana
2. For each location in sphere order:
   - Find the path from start to the target location
   - For each uncosted region in the path: assign `floor(currentMana / 2 / uncostedRegionsRemaining)`
   - For the location (if uncosted): assign `floor(currentMana / 2)`
   - Simulate executing the queued actions using actual loop mechanics
   - Reset the loop, continue to the next location
3. Assign default costs to any unvisited regions (use highest neighbor's cost) and locations (use highest existing location cost)

This produces costs that scale with the game's progression — early-sphere locations are cheap, late-sphere locations are expensive.

### Fallback Costs

When no cost data is loaded, hardcoded defaults apply:

| Action | Default Cost |
|--------|-------------|
| Region move | 50 |
| Explore | 100 (2×50) |
| Location check | 100 |

## Loop Stats Panel

The Loop Stats panel appears in the left column and displays a detailed cost analysis for every action in the queue.

### Layout

- **Two-column table**: Previous loop data vs. current loop data
- **Expandable rows**: Click to expand an action's row for cost breakdown details
- **Tabs**: Mana Costs (active), Inventory (placeholder for future)

### Display Options

- **Show remaining mana** (default: on) — predicted mana after each action
- **Show mana cost** (default: off) — the mana cost of each action

When both are on, entries display as "cost / remaining".

### Cost Breakdown (Expanded View)

Each action row expands to show:

| Field | Description |
|-------|-------------|
| Base cost | Raw mana cost from cost data |
| Level discount | Reduction from region XP level |
| Final cost | Actual mana charged |
| Mana before | Mana at start of action |
| Mana after | Predicted remaining mana |
| Predicted time | Estimated real-time duration |

### Color Coding

Mana remaining is color-coded:
- **Green** (`loop-mana-good`): > 50% mana remaining
- **Yellow** (`loop-mana-warn`): 10–50% mana remaining
- **Red** (`loop-mana-low`): < 10% mana remaining
- **Red** (`loop-mana-insufficient`): mana goes negative (action won't complete)

### Previous vs. Current

When a loop resets, the current analysis is archived as the "previous" loop. This lets you compare how XP gains from the previous loop reduced costs in the current one.

## Cost Debugger

The Cost Debugger (`loopsCostDebugger` module) provides developer tools for inspecting, editing, and generating cost data. It includes a cost planner for designing balanced mana economies for new games.

## Settings

### Persisted Settings

Settings that survive across sessions (stored in localStorage):

| Setting | Default | Description |
|---------|---------|-------------|
| `defaultSpeed` | 10 | Game speed multiplier |
| `autoRestart` | false | Auto-restart loop on mana depletion |
| `instantMode` | false | Complete actions in one frame |

### Settings File

Loop mode can be pre-enabled via `frontend/settings/settings-loops.json`:
```json
{
  "moduleSettings": {
    "loops": {
      "loopModeEnabled": true
    }
  }
}
```

### Test Mode Flags

For testing and cost generation, two special flags bypass normal behavior:

| Flag | Effect |
|------|--------|
| `instantMode` | Actions complete in one animation frame |
| `noManaDepletionReset` | Mana can go negative without triggering a loop reset |

## Integration with Other Systems

### Discovery System

Loops mode integrates tightly with the discovery system:
- Only discovered regions and exits can be used for pathfinding
- Exploring a region triggers discovery events, revealing locations and exits
- The explore action publishes `loop:exploreCompleted` through the dispatcher chain

### GameState Path

The action queue is built on top of GameState's path system:
- Region moves, location checks, and explore actions are stored as GameState path entries
- The `ActionQueueManager` maps path entries to loop action objects with progress/completion tracking
- Queue modifications (add, remove, clear) delegate to GameState's API

### Region Graph

Loops mode is designed to integrate with the region graph visualization (planned features include displaying nodes as pie charts showing mana costs as fractions of total mana).

### MetaGame (Maze Metagame)

Loops mode can be combined with the [Maze Metagame](maze-metagame.md) via `?metagame=mazegameloops`, which adds maze challenges before explore and location check actions.

## Architecture

### Module Structure

The loops system is split across three frontend modules:

**`frontend/modules/loops/`** — Core loop mechanics:

| File | Purpose |
|------|---------|
| `loopState.js` | Core game state: mana, XP, action processing, loop reset |
| `loopUI.js` | Main UI controller, panel rendering, event coordination |
| `loopRenderer.js` | Rendering orchestration, separating render logic from state |
| `loopBlockBuilder.js` | Region block DOM construction, mana cost coloring |
| `actionQueueManager.js` | Maps GameState path to action objects, tracks progress |
| `costDataManager.js` | Loads and caches per-region/per-location cost data |
| `costGenerator.js` | Generates cost data by simulating sphere log playthrough |
| `eventCoordinator.js` | Centralizes event subscriptions and routing |
| `loopEvents.js` | Event handlers for location clicks, exit clicks, mode changes |
| `displaySettingsManager.js` | Persisted UI display preferences |
| `expansionStateManager.js` | Tracks which region blocks are expanded/collapsed |
| `xpFormulas.js` | XP calculation formulas (level thresholds, cost reduction) |
| `loopStateSingleton.js` | Singleton export for cross-module access |
| `loop.css` | Styling for the loop panel and region blocks |

**`frontend/modules/loopStats/`** — Statistics panel:

| File | Purpose |
|------|---------|
| `loopStatsUI.js` | Statistics panel UI with two-column prev/current layout |
| `queueAnalyzer.js` | Queue analysis with prev/current comparison and caching |
| `loopStats.css` | Statistics panel styling |

**`frontend/modules/loopsCostDebugger/`** — Developer tools:

| File | Purpose |
|------|---------|
| `costDebuggerUI.js` | Cost inspection and editing UI |
| `costPlanner.js` | Planning tool for designing cost economies |
| `costDebugger.css` | Cost debugger styling |

**`frontend/modules/shared/`** — Shared utilities:

| File | Purpose |
|------|---------|
| `queueAnalysis.js` | Cost calculation, queue analysis, time prediction, mana color coding |
| `pathfinder.js` | Pathfinding for route calculation from current region to target |

### Event Flow

The loops module uses a dispatcher-based event system:

1. **User clicks location/exit** → Event captured by `loopEvents.js`
2. **Pathfinding** → Route calculated from Menu to target
3. **Queue built** → Region moves and action dispatched via GameState API
4. **Processing** → `loopState._processFrame()` runs via `requestAnimationFrame`
5. **Mana consumed** → Continuous deduction proportional to progress
6. **XP awarded** → 1 XP per mana spent, applied to the action's source region
7. **Action completes** → Effects applied via dispatcher (`loop:exploreCompleted`, `user:locationCheck`)
8. **Mana depleted** → Loop resets or pauses depending on auto-restart setting

### Key Events

| Event | Published By | Description |
|-------|-------------|-------------|
| `loopState:manaChanged` | LoopState | Mana value updated |
| `loopState:xpChanged` | LoopState | Region XP changed |
| `loopState:queueUpdated` | LoopState | Action queue modified |
| `loopState:progressUpdated` | LoopState | Frame-by-frame progress tick |
| `loopState:actionCompleted` | LoopState | Single action finished |
| `loopState:queueCompleted` | LoopState | All actions in queue finished |
| `loopState:loopReset` | LoopState | Loop reset (mana refilled) |
| `loopState:pauseStateChanged` | LoopState | Processing state transition |
| `loopState:speedChanged` | LoopState | Game speed adjusted |
| `loopUI:modeChanged` | LoopUI | Loop mode toggled on/off |
| `costDataManager:loaded` | CostDataManager | Cost data loaded or generated |
| `costGenerator:progress` | CostGenerator | Cost generation progress update |

## Testing

### Test Modes

| URL Parameter | Description |
|---------------|-------------|
| `?mode=loops` | Normal Loops mode |
| `?mode=test-loops` | Loops with standard test suite |
| `?mode=test-loops-only` | Loops with only Loops-specific tests |

### Test Cases

The test suite (`frontend/modules/tests/testCases/loopsPanelTests.js`) covers:

1. **Initial Menu not processed** — Starting region isn't treated as an action
2. **Real actions processed** — Queued actions execute correctly
3. **Mana consumption** — Mana deducted proportional to action cost
4. **XP awarding** — XP gained matches mana spent
5. **Level up mechanics** — XP thresholds and cost reduction verified
6. **Speed adjustment** — Game speed affects processing rate
7. **Pause/resume** — Processing pauses and resumes correctly
8. **Auto-restart** — Queue restarts when mana depletes with auto-restart on
9. **Enter/exit loop mode** — Mode activation and deactivation

### Unit Tests

- `xpFormulas.test.js` — Tests for XP calculation formulas
- `queueAnalyzer.test.js` — Tests for queue analysis and cost calculations

## Current Status

The core systems are implemented and working: mana, XP, action queues, loop reset, cost calculations, cost generation, the Loop Stats panel with cost predictions, and the per-block mode system described above (Manual / Record / Playback / Bot, the Instant toggle, persistent recordings and the strict action gate) — built in the M1–M6 arc (2026-07-21/24) and extended by the omsi arcs D1/D2 (2026-07-25).

**Under active design review:** which substrates should offer **Instant** at all. The current thinking is that idle games keep their native pacing, because waiting in them is a strategic cost rather than dead time; a separate question is whether a fast-forward should exist as a testing capability regardless. Treat the Instant availability described above as the state today, not a commitment.

### Planned Features

- Missing item cost penalties (double cost if required item not collected in the current loop)
- Region graph visualization enhancements (pie chart nodes showing mana fractions, animated player movement)
- Global XP affecting game speed
- Server-side loop data persistence
- Inventory tab in the Loop Stats panel

## Further Reading

- [Loops Planning Document](../../../CC/docs/plans/partial/loops-planning-document.md)
- [Loop Stats Panel UI](../../../CC/docs/plans/completed/loops-panel-ui-upgrade.md)
- [Loops Testing Options Report](../../../CC/docs/plans/completed/loops-testing-options-report.md)
