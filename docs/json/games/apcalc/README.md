# APCalc

**[Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=apcalc)**

A calculator-themed puzzle game for Archipelago. Collect number and operation buttons as items, then budget your button presses to navigate a graph of target numbers. Every seed procedurally generates a different puzzle.

## How to Play

1. You start with a few digit buttons that let you reach the first layer of nodes
2. Collect number buttons (0-9) and operation buttons (+, -, \*, /) from the multiworld
3. Use the calculator to compute target values and check locations
4. Budget your button presses carefully — each press is consumed along your path
5. Press Clear to return to Start and restore all presses
6. Check all locations to win

### The Calculator

The calculator works like a standard infix calculator:

- **From Start**: press a number, then `=` to reach a layer-0 node
- **From a node**: press an operation, enter a number (multi-digit allowed), then `=` to compute `current_value OP number`
- **`=`** never runs out — it's always available
- **Clear** returns to Start and restores all consumed button presses

### Button Presses

Each item collected grants **+1 press** of that button. Presses are consumed per path:

- Navigate Start → node A → node B → node C: each step consumes the buttons used
- Press Clear: return to Start, all presses restored
- The challenge is budgeting presses across an entire path, not any single calculation

### Multi-Digit Operands

Digit buttons compose into multi-digit numbers. To use operand 47, press `4` then `7`, consuming one press of each. This creates a rich puzzle space where the same digits can be combined in many ways.

### Example

You have buttons: `{3: 2, 7: 1, +: 1, *: 1}`

- Start → 3: press `[3] [=]` (consumes one `3` press)
- 3 → 10: press `[+] [7] [=]` (consumes `+` and `7`)
- 10 → 30: press `[*] [3] [=]` (consumes `*` and the second `3`)
- Clear: return to Start, all 5 presses restored

That path checked 3 locations using 5 button presses.

## Graph Structure

The puzzle is a layered directed graph:

- **Layer 0**: single-digit nodes, freely reachable from Start (digit buttons are precollected)
- **Layer 1+**: nodes reached by applying operations — each layer is one `=` press deeper
- **Multiple paths**: the same node can be reached via different routes with different button costs
- **Edges**: each edge represents an operation+operand step, with the full-path button cost as its access rule

### Spheres and Progression

The generator builds the graph in spheres. Each sphere introduces new button items:

- **Sphere 0**: starting digit buttons (precollected) + first items at layer-0 locations
- **Spheres 1-3**: each introduces one new operation (`+`, then `-`, then `*`, then `/`)
- **Spheres 4+**: additional digit and operation buttons for deeper chains
- **Final sphere**: consumes remaining buttons with trash-only nodes

This creates a natural learning curve — you start with addition, then unlock subtraction, multiplication, and division as you progress.

## Difficulty Modes

Three visibility modes control how much information the Region Graph shows:

| Mode | Edges | Accessibility Colors |
|------|-------|---------------------|
| **Easy** | All generator-discovered paths visible | Yes |
| **Medium** | Hidden | Yes |
| **Hard** | Hidden | No |

In all modes, you can perform any valid operation. Easy mode shows one possible solution path; medium and hard modes hide the edges, so you must figure out which operations reach which targets by experimenting with the calculator.

## Interface

### APCalc Panel

The main gameplay panel with:

- **Calculator**: number pad, operation buttons, `=` and Clear
- **Remaining Buttons**: sidebar showing press counts per button (filled/total)
- **Discovered Paths**: list of paths you've taken, click to reload a path state
- **Difficulty selector**: switch between Easy/Medium/Hard

### Region Graph

The standard Region Graph module visualizes the node graph. Nodes display their target values. Click a node to filter the Discovered Paths list to paths through that node.

## Configuration

| Option | Default | Range | Description |
|--------|---------|-------|-------------|
| `num_spheres` | 8 | 3-15 | Generation spheres (more = more locations and deeper chains) |
| `ops_per_sphere` | 1 | 1-3 | Operation buttons awarded per sphere |
| `nums_per_sphere` | 2 | 1-5 | Digit buttons awarded per sphere |
| `trash_per_sphere` | 1 | 0-5 | Junk filler items per sphere |
| `max_branches` | 5 | 2-10 | Max outgoing edges per node |
| `randomize_items` | true | on/off | Shuffle items into the multiworld pool (see below) |

### Randomize Items

When `randomize_items` is **on** (default), button items are shuffled into the multiworld item pool. You'll find APCalc buttons scattered across other players' worlds, and they'll find your items in APCalc locations. This is the standard multiworld experience.

When `randomize_items` is **off**, each location contains the exact button item the generator assigned to it. The puzzle becomes a standalone challenge with a fixed solution — you always know which button you'll get at each location. This is useful for solo play or for learning how the game works.

### Tuning Tips

- **Shorter games**: reduce `num_spheres` (3-4 spheres = ~12-16 locations)
- **Longer games**: increase `num_spheres` (12-15 spheres = 50-100+ locations)
- **More strategic**: increase `nums_per_sphere` for more multi-digit operand options
- **Easier**: increase `ops_per_sphere` to get more operation presses
- **Harder**: increase `trash_per_sphere` to dilute the item pool with junk

## Procedural Generation

APCalc generates a different puzzle for every seed. The same seed with the same options always produces the same puzzle.

The generator:

1. Creates sphere-0 nodes (random single digits) with precollected digit buttons
2. For each subsequent sphere, creates chains of new nodes using available buttons
3. Enforces sphere constraints — each sphere uses at least one item from the previous sphere
4. Adds reuse edges to create multiple paths to existing nodes
5. The final sphere greedily consumes remaining buttons with trash nodes

## Further Reading

- [Setup guide](../../../../worlds/apcalc/docs/setup_en.md) — installation, YAML configuration, example configs
- [APCalc design document](../../../../CC/docs/plans/apcalc-plan.md)
- [V2 strategic redesign](../../../../CC/docs/plans/apcalc-v2-design.md)
- [World source](../../../../worlds/apcalc/)
- [Generator source](../../../../worlds/apcalc/generator/)
