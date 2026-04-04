# Loops

**[Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=loops)**

An incremental/idle game mode layered on top of the Archipelago tracker. Queue actions, spend mana, earn XP, and optimize your runs. Inspired by Idle Loops, Stuck in Time, and Increlution.

## How to Play

### The Basic Cycle

1. **Build a queue** — Click locations and exits in the tracker to add actions
2. **Run the queue** — Actions execute automatically, consuming mana
3. **Mana runs out** — The loop resets (position and mana refill, but XP persists)
4. **Repeat** — Each loop, XP from previous runs reduces action costs, letting you reach further

### Action Types

| Action | Base Cost | Description |
|--------|-----------|-------------|
| Move to Region | 50 mana | Navigate to an adjacent region |
| Explore Region | 100 mana | Discover locations and exits |
| Check Location | 100 mana | Check a location for items |

Costs are customizable per game/seed through generated cost data files.

### Progression

- **Mana** — Starts at 100, grows by +10 per inventory item collected
- **XP** — Earned per mana spent, tracked per region. Every level reduces that region's costs by 5%
- **Checked locations** — Persist across loops. You only need to check each location once

By level 10 in a region, costs are halved. By level 20, costs are a third. Each loop gets you further than the last.

## Controls

| Control | Description |
|---------|-------------|
| Start / Pause / Resume | Queue execution control |
| Speed slider (0.1x-100x) | Adjust game speed |
| Instant mode | Complete actions in one frame |
| Auto-restart | Automatically restart when mana depletes |
| Auto-resume | Resume when new actions are added to the queue |
| Auto-remove | Remove completed actions from the queue |
| Repeat explore | Keep re-exploring a region for XP grinding |

## Loop Stats Panel

Shows a side-by-side comparison of previous loop vs current loop costs. Expandable rows reveal cost breakdowns showing base cost, level discount, and predicted mana after each action. Color-coded mana indicators show green (>50%), yellow (10-50%), and red (<10%).

## Cost Data System

Per-game cost files balance mana costs based on the sphere log progression. Generated automatically during seed generation or in-browser via the cost debugger. When no cost data exists, default costs apply (50 mana per move, 100 per explore/check).

## Combination Modes

Loops can combine with the Maze Metagame via `?metagame=mazegameloops` — adding maze challenges on top of the loop mechanics.

## Further Reading

- [Detailed feature overview](../../features/loops.md)
