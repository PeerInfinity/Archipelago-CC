# APCalc — Planning Document

## Origin

Idea from MetaMath Discord thread (2026-03-30). User **lights** proposed a calculator-themed Archipelago game where the player receives math operations and numbers as items, and solves equations to reach target answers as checks. Name "APCalc" coined in the thread and immediately endorsed.

See also: [MetaMath world](/worlds/metamath/) for the formal-proof-based predecessor that inspired the concept.

---

## Vision

APCalc is an Archipelago world where gameplay takes place on a **calculator**. The player collects **number buttons** and **operation buttons** as items from the multiworld. They press buttons on the calculator to compute target values, navigating a graph of target-number nodes. Each button press consumes one use of that button; pressing Clear resets to the starting node and restores all presses.

The game data is **procedurally generated** each time, so every playthrough presents a different puzzle. A generation algorithm builds a region graph and item set, exports it as `rules.json`, and runs it through the world generator to produce a playable apworld.

---

## Core Concepts

### Relationship to MetaMath

| | **MetaMath** | **APCalc** |
|---|---|---|
| Domain | Formal proofs (logic dependencies) | Arithmetic (building expressions) |
| Items | Statements usable in proofs | Calculator buttons (numbers, operations) |
| Locations | Proving a theorem step | Reaching a target number |
| Progression feel | Following a fixed logical path | Creative resource-budgeting puzzle |
| Client | metamath-lamp (proof assistant) | Calculator UI |
| Replayability | Choose different theorems | Procedurally generated each time |

### Key Mechanic: Consumable Button Presses Along Paths

The central design insight is that button presses are **consumed per path**, not per target. The player navigates a graph of target numbers, and each step along a path costs button presses. Pressing Clear returns to Start and restores all presses.

This means having many buttons doesn't trivialize the game — the difficulty comes from **budgeting** button presses across an entire path, not from any single calculation.

**Example:**
- Player has buttons: `{3, 7, 2, +, *}`
- Path: Start → node 3 → node 10 → node 20
- Start → 3: press `[3] [=]` (consumes one "3" press)
- 3 → 10: press `[+] [7] [=]` (consumes one "+" and one "7" press)
- 10 → 20: press `[*] [2] [=]` (consumes one "\*" and one "2" press)
- Total consumed: 3, +, 7, \*, 2 (5 presses for 3 checks)
- Clear: return to Start, all presses restored

### Calculator Model

Standard infix calculator behavior:
- From Start (display blank/0), press a number then `=` to reach that value
- From any node, press an operation, then a number, then `=` to compute `current_value OP number`
- The `=` button never runs out of uses
- The Clear button resets to Start and restores all button presses
- The current node's value is the current calculator display — no need to re-enter it

### Items

Items are calculator buttons. Each item collected grants **+1 press** of that button.

- **Number buttons:** `0, 1, 2, 3, 4, 5, 6, 7, 8, 9` (v1: single-digit only; each is an atomic button, not a digit)
- **Operation buttons:** `+, -, *, /` (and potentially `^`, `%` in later versions)
- **Junk items:** Filler that doesn't grant useful button presses (e.g., "Broken Button", "Lint")

Classification:
- Number and operation buttons: `progression` (each unlocks new nodes)
- Junk: `filler`

### Traps (Future)

Potential trap items for later versions:
- **Operator Jam:** One operation stops working temporarily
- **Number Scramble:** Digit buttons get shuffled
- **Rounding Error:** Results get rounded, breaking precision
- **Integer Mode:** Lose decimal capability temporarily

---

## Region Graph Structure

The game world is a directed graph of target-number nodes:

```
Start (Menu)
 ├── Node 3 (sphere 0)   → awards: [+]
 ├── Node 7 (sphere 0)   → awards: [*]
 ├── Node 2 (sphere 0)   → awards: [5]
 ├── Node 10 (sphere 1)  → awards: [8]  (3 + 7)
 ├── Node 14 (sphere 1)  → awards: [-]  (7 * 2)
 ├── Node 15 (sphere 2)  → awards: [6]  (10 + 5)
 └── ...
```

- **Regions** are nodes in the graph, each identified by its target number
- **Each region has one location** that gets checked when the player reaches that node
- **Each location awards one button item** (number, operation, or junk)
- **Edges** connect parent nodes to child nodes (child_value = parent_value OP operand)
- **Start region** connects directly to all sphere 0 nodes

### Sphere 0

- Nodes are single-digit numbers (v1)
- Connected directly to Start (free to navigate to)
- The number buttons for these values are in the **starting inventory**
- At least 2 locations, at most 10
- At least 1 location must award an operation button
- Remaining locations award number buttons, operation buttons, or junk

### Spheres 1..N

For each location in sphere S:
1. Choose a random parent node from any existing sphere
2. Compute the buttons consumed to reach that parent from Start (the full path cost)
3. Remove those consumed buttons from the simulated inventory
4. Choose a random operation and a random number from the remaining inventory
5. Compute: `child_value = parent_value OP number`
6. Create the new node as a child of the parent
7. The location at this node awards a new button (assigned during item placement)

At least 1 location per sphere must award an operation button (to keep future spheres accessible).

---

## Sphere Accessibility Constraint

**Goal:** Sphere N locations should require at least one item from sphere N-1 and should NOT be reachable with only items from spheres 0 through N-2.

### Option A: Forced Item Inclusion (Recommended for v1)

When generating a sphere N node, force the operation or number in the new step to be an item placed at a sphere N-1 location. Track which items come from which sphere.

**Pro:** Simple, direct, guaranteed correct.
**Con:** Constrains randomness. If sphere N-1 only awarded one item usable as a button, every sphere N node depends on it.

**Hybrid variant:** Ensure at least *one* node in sphere N uses a sphere N-1 item. Other nodes in the same sphere can use any available buttons. This loosens the constraint while preserving the sphere guarantee.

### Option B: Gate by New Operation

Each sphere introduces at most one new operation type. Sphere 0 introduces `+`, sphere 1 introduces `-`, sphere 2 introduces `*`, etc. All nodes in sphere N require the operation from sphere N-1 somewhere in their path.

**Pro:** Very clean mental model — "I got multiply, now I can reach multiply nodes."
**Con:** Limits sphere count to number of operations (4-6). Could combine with Option A for later spheres.

### Option C: Retroactive Placement

Generate the full graph first (ignoring spheres), then assign items to locations using a solver that respects sphere constraints. Decouples graph topology from item placement.

**Pro:** Maximum flexibility, optimal distribution.
**Con:** Two-pass algorithm, solver could need backtracking, significantly more complex.

### Decision

**Option A** (forced item inclusion) for v1. When generating a sphere N node, at least one of the operation or number in the new step must be an item placed at a sphere N-1 location.

---

## Game Data Generation

### Overview

The generation pipeline produces a `rules.json` file that feeds into the existing world generator. This can be implemented as either a **Python script** or a **frontend module** (like the cost generator for Loops/JTA).

### Configuration Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `num_spheres` | Target number of spheres (including sphere 0) | 5 |
| `locations_per_sphere` | Number of locations in each sphere (list or single value) | [4, 4, 4, 4, 4] |
| `max_branches` | Maximum child nodes per parent node | 3 |
| `operations` | Available operation types | [+, -, \*, /] |

### Node Data Structure

Each node stores the intended button press sequence to reach it from Start. This is computed during generation and included in `rules.json` slot data for the client.

```python
@dataclass
class Node:
    value: int                # target number at this node
    parent: Node | None       # parent node (None for sphere 0)
    sphere: int               # which sphere this node belongs to
    operation: str | None     # operation used from parent (None for sphere 0)
    operand: int | None       # number button used from parent (None for sphere 0)
    button_sequence: list     # full sequence of button presses from Start
                              # e.g. ["3", "=", "+", "7", "=", "*", "2", "="]
    item: str                 # button awarded at this location
```

For sphere 0 nodes, `button_sequence` is `[str(value), "="]`.
For deeper nodes, `button_sequence` is `parent.button_sequence + [operation, str(operand), "="]`.

### Generation Algorithm (Pseudocode)

```python
def generate_apcalc(config):
    inventory = Counter()           # button -> press count
    nodes = []                      # all nodes in the graph
    node_values = set()             # track used values (no duplicates)
    sphere_items = defaultdict(list)  # sphere -> items placed at that sphere's locations

    # --- Sphere 0 ---
    available_digits = list(range(10))
    for i in range(config.locations_per_sphere[0]):
        value = random.choice(available_digits)
        available_digits.remove(value)  # no duplicate node values
        nodes.append(Node(
            value=value, parent=None, sphere=0,
            operation=None, operand=None,
            button_sequence=[str(value), "="]
        ))
        node_values.add(value)
        inventory[str(value)] += 1     # add to starting inventory

    # Assign items to sphere 0 locations (at least 1 operation)
    sphere_0_items = assign_items(sphere=0, config=config)
    for item in sphere_0_items:
        sphere_items[0].append(item)
        inventory[item] += 1           # simulate receiving from multiworld

    # --- Spheres 1..N ---
    for sphere in range(1, config.num_spheres):
        for loc_idx in range(config.locations_per_sphere[sphere]):
            # Retry loop: pick parent, op, num until we get a valid new node
            parent = random.choice(nodes)
            path_cost = compute_path_cost(parent)
            remaining = inventory - path_cost

            # Pick operation + number (with sphere constraint)
            op, num = pick_step(remaining, sphere_items[sphere - 1])
            child_value = apply_op(parent.value, op, num)
            # Reject: duplicate value, division by zero, non-integer division,
            #         duplicate value from same parent
            # Retry with different parent/op/num on rejection

            sequence = parent.button_sequence + [op, str(num), "="]
            nodes.append(Node(
                value=child_value, parent=parent,
                operation=op, operand=num, sphere=sphere,
                button_sequence=sequence
            ))
            node_values.add(child_value)

        # Assign items to this sphere's locations
        new_items = assign_items(sphere=sphere, config=config)
        for item in new_items:
            sphere_items[sphere].append(item)
            inventory[item] += 1

    return build_rules_json(nodes, sphere_items, inventory)
```

### Key Subroutines

**`compute_path_cost(node)`** — Walk from Start to `node`, summing button presses along the chain:
- For sphere 0 nodes: cost is `{node.value: 1}` (just the number button)
- For deeper nodes: cost is `compute_path_cost(node.parent) + {node.operation: 1, node.operand: 1}`

**`pick_step(remaining, prev_sphere_items)`** — Choose an operation and number from the remaining inventory, enforcing the sphere constraint (at least one must be from `prev_sphere_items`).

**`apply_op(parent_value, op, num)`** — Compute `parent_value OP num`. Reject if: division by zero, non-integer division result, or duplicate node value (same value as existing node, or same value as another child of the same parent).

**`assign_items(sphere, config)`** — Decide what button each location in this sphere awards. At least 1 must be an operation. Others can be numbers, operations, or junk.

### Implementation: Frontend vs Python

| Factor | Frontend (JS) | Python |
|--------|---------------|--------|
| Pattern precedent | Cost generator is frontend | World generator is Python |
| User experience | Instant in browser, no CLI | Requires running a script |
| Pipeline fit | Needs save/download step | Writes rules.json directly, feeds into world_generator |
| Testing | Browser devtools | pytest alongside existing tests |
| Code sharing | Shares code with APCalc client UI | Separate from client |

**Recommendation:** Python for v1 (natural fit with the world_generator pipeline). Frontend generation as a v2 feature ("Generate New Puzzle" button in browser).

### Button Sequences in rules.json

Each node's intended button press sequence is stored in the rules.json `slot_data`, so the client has access to it for hints, path validation, and debugging. Structure:

```json
{
  "slot_data": {
    "nodes": {
      "Node 10": {
        "value": 10,
        "parent": "Node 3",
        "sphere": 1,
        "operation": "+",
        "operand": 7,
        "button_sequence": ["3", "=", "+", "7", "="],
        "item": "Button: 8"
      }
    },
    "starting_buttons": {"3": 1, "7": 1, "2": 1},
    "operations": ["+", "-", "*", "/"]
  }
}
```

---

## Client UI

### Main Panels

The player has two main panels open:

1. **Region Graph** — Visual graph of target-number nodes, showing which are checked, reachable, and connected
2. **APCalc Panel** — The calculator and path management UI

### APCalc Panel Layout

```
┌─────────────────────────────────────────────┐
│  ┌─────────────┐   ┌─────────────────────┐  │
│  │  Calculator  │   │  Remaining Buttons  │  │
│  │             │   │  3: ██░░ (2/4)      │  │
│  │  [ 10  ]   │   │  7: ███░ (3/4)      │  │
│  │             │   │  +: █░░░ (1/4)      │  │
│  │ [7][8][9]  │   │  *: ██░░ (2/4)      │  │
│  │ [4][5][6]  │   │  ...                 │  │
│  │ [1][2][3]  │   │  [Hide]              │  │
│  │ [0][=][C]  │   └─────────────────────┘  │
│  │ [+][-][*]  │                             │
│  │ [/]        │                             │
│  └─────────────┘                            │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Discovered Paths                     │   │
│  │  ─────────────────────────────────── │   │
│  │  Node 10: [3] [+] [7] [=]           │   │
│  │  Node 20: [3] [+] [7] [=] [*] [2]  │   │
│  │  Node 5:  [5] [=]                    │   │
│  │  ...                                  │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Calculator Display Options

Two display modes (configurable):

1. **Normal calculator:** Buttons are either available or greyed out. Press count not shown on the calculator itself (check the Remaining Buttons list).
2. **LED mode:** Each button has indicator LEDs showing remaining presses. Visually richer, more information at a glance.

### Discovered Paths

- List of all paths the player has taken that reached a node
- Clicking an entry **loads that state** — restores the calculator to that point in the path (consuming the same buttons)
- Clicking a node in the **region graph** filters the path list to paths that travel through that node
- Duplicate paths (same button sequence to same node) are not added
- Paths that reach unchecked nodes send the check on first arrival

### Gameplay Flow

1. Player presses buttons on the calculator
2. Each press consumes one use of that button
3. Pressing `=` performs the calculation
4. If the result matches a neighboring node in the graph:
   - Player moves to that node
   - Location is checked (if not already checked) — sends item to multiworld
   - Path is recorded in the Discovered Paths list (if unique)
5. If the result does NOT match a neighbor: display the result but don't move (player can continue or Clear)
6. Pressing Clear: return to Start, restore all button presses

---

## Design Decisions (v1)

### Operations
**`+ - * /`** — all four basic operations. `^` (power) and `%` (mod) deferred to later versions.

### Division
**Exact division only.** During generation, division is only used when `parent_value` is evenly divisible by `operand` (integer result). During gameplay, non-integer division displays an error and doesn't consume button presses.

### Negative numbers
**Allowed.** Subtraction can produce negative node values. This broadens the graph and creates interesting gameplay.

### Number range
**No bounds for v1.** Multiplication can produce large numbers — this is fine. If it becomes a problem in practice, bounds can be added later.

### Multi-digit input
**Not in v1.** Each number button is atomic — pressing `3` enters the value 3, not the digit "3". There is no way to compose multi-digit numbers from single-digit buttons. This keeps the generation algorithm and puzzle space well-controlled.

### Duplicate node values
**No duplicates for v1** (unless implementation difficulty forces a change). Each node in the graph has a unique target value. Generation retries with different parent/operation/operand if a duplicate would be produced. Since sphere 0 values are also unique, max sphere 0 size is 10 (digits 0-9).

### Same-parent duplicates
**Never allowed**, even if global duplicates are relaxed later. A single parent node cannot have two children with the same value.

### Multiple items per button
**Allowed.** The player can collect multiple copies of the same button (e.g., three "5" items = 3 presses of "5" per path attempt). Each item collected grants +1 press.

### Division by zero / invalid operations
- **During generation:** Skip/retry. Never generate an invalid node.
- **During gameplay:** Display an error, don't consume button presses, don't move.

### Carry-forward
**Not applicable.** When the player reaches a node, that node's value is already the calculator display — it's automatically the left operand for the next operation. There's no separate "carry-forward" mechanic needed; this is just how calculators work.

---

## Implementation Phases

### Phase 0: Design Finalization
- [x] Resolve design questions — operations, division, negatives, range, duplicates, etc.
- [x] Decide sphere constraint approach — Option A (forced item inclusion)
- [x] Decide implementation language — Python first (easier for automated testing), frontend version later (easier for manual testing)

### Phase 1: Generation Algorithm (Python)
- [ ] Implement `Node` data structure with button_sequence tracking
- [ ] Implement sphere 0 generation (unique single-digit values)
- [ ] Implement sphere N generation with path cost tracking
- [ ] Implement item assignment with sphere constraints (Option A)
- [ ] Implement retry logic for duplicate values, invalid division, etc.
- [ ] Implement `rules.json` export including button sequences in slot_data
- [ ] Test: generated rules.json passes schema validation
- [ ] Test: world_generator successfully produces a world from output

### Phase 2: World Package
- [ ] Generate world via world_generator from rules.json
- [ ] Create template YAML
- [ ] Test seed generation
- [ ] Run spoiler tests

### Phase 3: Client UI
- [ ] Calculator panel with button press tracking
- [ ] Region graph visualization
- [ ] Path recording and discovery list
- [ ] Path loading (click to restore state)
- [ ] Node filtering (click graph node to filter paths)
- [ ] LED mode vs normal mode toggle
- [ ] Remaining buttons list (hideable)

### Phase 4: Future Enhancements
- [ ] Trap items
- [ ] Additional operations (^, %)
- [ ] Multi-digit numbers / multi-digit input
- [ ] Frontend generation ("Generate New Puzzle" button)
- [ ] Difficulty presets

---

## References

- [MetaMath world](/worlds/metamath/) — formal-proof predecessor
- [MetaMath docs](/worlds/metamath/docs/) — gameplay, settings, developer docs
- [Cost generator (Loops)](/frontend/modules/loops/costGenerator.js) — frontend generation pattern
- [Cost generator (JTA)](/frontend/modules/jtaCostDebugger/jtaCostPlanner.js) — alternative generation pattern
- [World generator](/world_generator/) — rules.json → world package pipeline
- [Rules schema](/frontend/schema/rules.schema.json) — rules.json format specification
