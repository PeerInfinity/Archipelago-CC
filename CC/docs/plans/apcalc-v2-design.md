# APCalc V2 — Strategic Gameplay Redesign

## Overview

APCalc v1 is functional but lacks strategic depth. There's almost always one obvious button sequence to reach each node, so the player follows a linear path with no real decisions. V2 redesigns the core algorithm to create a genuine puzzle game with meaningful choices.

## Design Goals

1. **Multiple paths**: Nodes should be reachable via different routes with different button costs, forcing the player to choose based on their current budget
2. **Multi-digit operands**: Expand the number space so the player composes operands from digit buttons (e.g., pressing `4` then `7` to use operand 47)
3. **Layer-based structure**: Nodes are gated by equals-press depth (layer count), replacing the current tree structure
4. **Gradual operation unlock**: Each of the first four spheres introduces one operation (+, -, *, /), giving a natural learning curve
5. **Difficulty modes**: Easy/medium/hard modes that control how much of the solution is visible

## Problem Analysis

### Why v1 lacks strategy

- Each node has exactly one path to it — no decisions to make
- Node values are unique — the generator rejects any value that already exists
- Small number space (single-digit operands) limits reachable values
- With 1 operation per sphere and 1 number per sphere, the player barely has enough buttons to do anything

### What makes a good calculator puzzle

- The player has several buttons and must figure out which combination of operations reaches the target value in the allowed number of steps
- Different paths to the same node have different costs, so the player must budget across multiple targets
- Some paths are obvious, others require insight (e.g., using multiplication creatively)
- Dead ends exist — reachable nodes that only contain trash, wasting button presses

---

## Core Design Changes

### 1. Layer-based node identity

**Current**: Nodes are identified by value alone. Each value can only appear once.

**New**: Nodes are identified by **(value, layer)** pairs, where layer = number of equals presses from Start.

- Layer 0: the starting digit entry (press a number, press `=`)
- Layer 1: one operation applied
- Layer 2: two operations applied
- etc.

The same value CAN appear at different layers (e.g., "12 @ layer 2" and "12 @ layer 5" are distinct nodes). Within the same layer, each value is unique — reaching the same value at the same layer creates a new edge to the existing node, not a new node.

### 2. Multi-path nodes

When the generator reaches a value that already has a node at that layer, it creates a **new edge** to the existing node rather than rejecting the result. Multiple edges to the same node are expected and encouraged.

Each edge stores:
- The source node (parent at layer N-1)
- The operation and operand used
- The full-path button cost from Start through this specific route

The access rule on an edge is the **full path cost** for that specific route (necessary because buttons are consumed per-path). If multiple edges lead to the same node, the node's effective access rule is the `Or` of all known edge costs.

### 3. Multi-digit operands

Digit buttons are individual items (`Button: 0` through `Button: 9`). To use operand 47, the player presses digit `4` then digit `7`, consuming one press of each. The path cost of using operand 47 is `{4: 1, 7: 1}`.

During generation, the algorithm picks a random number of available digits to compose each operand. The average number of digits per operand should roughly match the number of digit buttons awarded per sphere (so the budget stays balanced).

Multi-digit operands expand the value space dramatically, making node value collisions rare naturally. This is what makes multi-path nodes a feature to encourage rather than avoid — the generator will need to actively seek reuse rather than stumbling into it.

### 4. One operation per sphere (first four)

The first four non-zero spheres each introduce exactly one new operation:
- Sphere 1: `+`
- Sphere 2: `-`
- Sphere 3: `*`
- Sphere 4: `/`

The order could be configurable, but this is the default. Spheres 5+ can award duplicate operations (additional copies of already-introduced operations).

This replaces the current approach where each sphere awards a random operation (excluding `/` until the divide sphere). It gives the player a clear learning curve and makes each sphere's theme distinct.

### 5. Difficulty modes

Three visibility modes for the frontend, affecting the Region Graph display:

| Mode | Nodes | Edges | Accessibility coloring |
|------|-------|-------|----------------------|
| **Easy** | Visible | Visible (generator's discovered paths) | Yes |
| **Medium** | Visible | Hidden until discovered by player | Yes |
| **Hard** | Visible | Hidden until discovered by player | No |

In all modes, the player can perform any valid operation that moves from a node at layer N to a node at layer N+1, as long as they have the required buttons. The edges shown in easy mode are the generator's discovered solution paths — one possible solution, not necessarily the only one.

Items at unchecked nodes are not visible until the player reaches the node (this is already the case).

---

## Access Rules

### Why full-path costs are needed

Archipelago's logic solver assumes items are permanent (collecting a key doesn't consume it). But APCalc buttons are consumed per-path. To make the solver correctly determine reachability, each edge's access rule must encode the full path cost from Start, not just the incremental cost.

Example:
- Path to Node A costs `{3: 1, +: 1, 5: 1}` (press 3, =, +, 5, =)
- Edge from A to B uses `+ 7`, incremental cost `{+: 1, 7: 1}`
- Full path cost to B via A: `{3: 1, +: 2, 5: 1, 7: 1}`
- The edge A→B stores this full cost, so the solver checks `Has(+, 2)` not `Has(+, 1)`

### Multiple paths and Or rules

When a node has multiple incoming edges (from different parents or via different operations), each edge has its own full-path cost. The effective access rule for the node is the `Or` of all edge costs. The logic solver considers the node reachable if ANY of the known paths is affordable.

Each edge from parent X to child Y at layer N stores the full-path costs as an `Or` over all known routes from Start to X, each extended by the X→Y step cost. For example, if X has 2 known paths and the X→Y step costs the same either way, Y via X has 2 full-path alternatives.

The generator stores all paths it discovers. It does not need to enumerate every possible path — the logic solver just needs at least one valid path to determine reachability.

### Path cost growth

As layers deepen, the number of known full paths per node can grow combinatorially (each parent's paths × edges to this node). In practice this stays bounded because:
- The generator discovers a limited number of paths
- Not every parent-path combination is distinct in cost profile
- A cap on stored paths per node can be applied if needed (keeping the most diverse cost profiles)

---

## Generation Algorithm (V2)

### Overview

The algorithm builds a layered graph of (value, layer) nodes. It proceeds sphere by sphere, where each sphere adds new button items and creates new nodes/edges at appropriate layers.

### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `num_spheres` | 8 | Total spheres including sphere 0 |
| `nums_per_sphere` | 2 | Digit buttons awarded per sphere |
| `ops_per_sphere` | 1 | Operation buttons awarded per sphere (first 4 spheres: always 1 new op) |
| `trash_per_sphere` | 1 | Trash items per sphere |
| `max_branches` | 5 | Max outgoing edges per node |
| `max_layer` | - | Derived: equals num_spheres or configurable |
| `seed` | 42 | Random seed |

### Sphere 0: Starting digits

1. Pick `sphere_0_count` random digits (0-9)
2. Create layer-0 nodes for each (value = the digit itself)
3. These digit buttons are the player's starting inventory
4. Locations at these nodes award the first items: 1 operation (`+`) and digit buttons

Note: with the new "one op per sphere" rule, sphere 0 should probably not award any operations. Sphere 1 introduces `+`. Alternatively, sphere 0 awards `+` so sphere 1 can actually create nodes. This needs to be decided — see Open Questions.

### Spheres 1-4: New operation introduction

Each sphere introduces one new operation. The sphere awards that operation button plus digit buttons and trash.

For each node to create:
1. Pick a random existing node as parent (at any layer)
2. Compute full-path cost from Start to parent
3. Subtract from inventory to get remaining budget
4. Pick an operation and compose an operand from available digits
   - The operation must include the newly introduced operation OR a digit from this sphere's awards (sphere constraint)
   - Operand digit count: random, averaging `nums_per_sphere`
5. Compute `parent_value OP operand`
6. Determine the target layer: parent's layer + 1
7. If (value, layer) already exists: create a new edge to existing node
8. If (value, layer) is new: create a new node
9. Store the full-path cost for this route

### Spheres 5+: Additional buttons

Same as above, but operations are duplicates of already-introduced ones. More digit buttons enable longer multi-digit operands.

### Chain extension

Like v1, chains can extend through intermediate nodes to consume surplus buttons. Intermediate nodes get trash items. Chain length is driven by the surplus of operations and digits beyond what's reserved for future spheres.

With multi-digit operands, chain extension works slightly differently: instead of each step consuming exactly 1 operation + 1 digit, each step consumes 1 operation + N digits (where N is the operand's digit count). The chain length calculation must account for this.

### Division planning

With the new "one op per sphere" design, division arrives at a known sphere (sphere 4 by default). The algorithm should ensure divisible paths exist before that sphere, similar to v1. Multi-digit operands make this easier — there are more possible divisors.

### Final sphere

The final sphere continues to greedily consume remaining buttons, creating trash-only nodes. With multi-digit operands, it can consume multiple digits per step, making this more efficient.

### Encouraging node reuse

With single-digit operands and a small value space, collisions were a problem to avoid. With multi-digit operands, the value space is huge and collisions are rare. The generator should actively encourage reuse:

- After creating a new edge's target value, check if any existing node at that layer already has that value
- Additionally, when generating a step, sometimes try to TARGET an existing node: pick an existing node at layer+1, then search for an operation+operand that reaches its value from the parent
- The probability of attempting targeted reuse could increase with layer depth (early layers have few nodes to target; later layers have many)

---

## Frontend Changes

### APCalc game state

The game state needs updates to support:
- Layer tracking: current layer (number of `=` presses in current path)
- Multi-digit input: accumulating digits before pressing an operation or `=`
- Move validation: when `=` is pressed, check if result matches any node at current_layer + 1

### Calculator UI

- Multi-digit display: show the number being composed as digits are pressed
- Layer indicator: show current layer depth
- Remove the assumption that operands are single digits

### Region Graph

- No layer labels on nodes (the hierarchical layout already provides visual layer positioning, and labels would add clutter)
- Easy mode: show all generator-discovered edges
- Medium mode: show nodes, hide edges until player discovers them
- Hard mode: hide edges AND accessibility coloring
- Difficulty mode selector in UI

### Path discovery

When the player successfully navigates to a node via any valid path (not just generator-discovered ones), that path should be recorded. In medium/hard modes, discovering a path also reveals that edge in the graph.

---

## Data Model Changes

### Node structure

```python
@dataclass
class Node:
    index: int
    value: int
    layer: int                    # number of = presses from Start (was: sphere)
    sphere: int                   # which generation sphere created this node
    edges_in: list[Edge]          # incoming edges (multiple allowed)
    item: str                     # button awarded at this location
```

Note: `layer` and `sphere` are distinct concepts. `layer` is the depth in the graph (how many operations from Start). `sphere` is which generation pass created the node (determines which items were available). A node at layer 3 might be created during sphere 2 if the chain started from a layer-1 node.

### Edge structure

```python
@dataclass
class Edge:
    source_index: int             # parent node index
    target_index: int             # child node index
    operation: str                # +, -, *, /
    operand: int                  # the number used (possibly multi-digit)
    operand_digits: list[int]     # individual digits (for cost calculation)
    full_path_costs: list[Counter]  # all known full-path costs via this edge
```

### rules.json export changes

- Regions: one per (value, layer) node (internal name includes layer for uniqueness, but display label is just the value — the hierarchical layout provides layer context visually)
- Exits: one per edge, access rule = `Or` of full-path costs
- Slot data: includes layer info, edge list with operand digits, difficulty mode config

---

## Design Decisions

### Sphere 0 operations

**Decision: Option B** — Sphere 0 locations award `+` as the first found item. Sphere 1 becomes reachable after checking sphere 0 locations. This matches the current design where sphere 0 locations award items including operations, and preserves the "unlocking" feeling.

### Layer vs sphere relationship

**Decision: Independent.** Layers are independent of spheres. The existing chain extension code already handles this — chains extend through intermediate layers with junk items when starting from an earlier layer. The sphere constraint (must use an item from the previous sphere) ensures progression ordering regardless of layer depth.

### Operand digit count distribution

**Decision: Random with average matching `nums_per_sphere`.** Early spheres will naturally use shorter operands (fewer digits available). Later spheres with many digits available will use longer operands on average.

### Targeted reuse probability

**Decision: 50% probability.** Start with 50% probability of attempting targeted reuse. If the attempt fails (no valid operation+operand reaches an existing node from the chosen parent within budget), fall back to creating a new node. Tune based on testing.

### Max stored paths per node

**Decision: Uncapped.** Start uncapped. If performance becomes an issue in the logic solver or rules.json file size, add a cap (e.g., 10 paths per node) keeping the most diverse cost profiles.

### Dead-end trash nodes

**Decision: Keep current algorithm.** The existing algorithm already creates trash-only nodes naturally (chain intermediates and final-sphere nodes). With multi-path edges and difficulty modes, these function as natural dead ends — the player doesn't know what item a node gives until reaching it. No special dead-end generation logic needed.

---

## Implementation Plan

### Phase 1: Layer-based generation with multi-digit operands

**Files**: `apcalc_generator/generator.py`, `apcalc_generator/export.py`

1. Replace Node.sphere-as-depth with explicit Node.layer field
2. Add Edge data structure
3. Allow duplicate (value, layer) to create new edges instead of new nodes
4. Implement multi-digit operand composition (random digit count from available digits)
5. Update path cost calculation for multi-digit operands
6. Implement one-operation-per-sphere for first four spheres
7. Update default config (more spheres, more digits per sphere)
8. Update export to emit `Or` rules for multi-path nodes

### Phase 2: Frontend generator sync

**Files**: `frontend/modules/apcalcGenerator/apcalcGeneratorEngine.js`

1. Port all Phase 1 changes to the JavaScript generator
2. Ensure generation log output matches Python version

### Phase 3: Frontend gameplay updates

**Files**: `frontend/modules/apcalc/apcalcState.js`, `frontend/modules/apcalc/apcalcUI.js`

1. Update game state for layer tracking
2. Update calculator for multi-digit operand input
3. Update move validation: accept any operation that reaches a node at current_layer + 1
4. Update path discovery to record player-found paths

### Phase 4: Difficulty modes

**Files**: `frontend/modules/apcalc/`, `frontend/modules/regionGraph/`, `frontend/settings/settings-apcalc.json`

1. Add difficulty mode setting (easy/medium/hard)
2. Easy mode: show all generator edges + accessibility coloring (current behavior)
3. Medium mode: hide edges, reveal on player discovery
4. Hard mode: hide edges + hide accessibility coloring
5. Add difficulty selector to UI

### Phase 5: World regeneration and testing

1. Regenerate the APCalc world from new rules.json
2. Update template YAML
3. Run seed generation and spoiler tests
4. Test all three difficulty modes in the frontend
5. Tune default parameters for good gameplay

---

## References

- [APCalc v1 plan](apcalc-plan.md) — original design document
- [APCalc generator](../../apcalc_generator/) — Python generation code
- [APCalc frontend module](../../frontend/modules/apcalc/) — game UI
- [APCalc frontend generator](../../frontend/modules/apcalcGenerator/) — JS generation code
- [Region graph module](../../frontend/modules/regionGraph/) — graph visualization
