# DepGraph

**[Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=depgraph)**

Turn any directed acyclic graph (DAG) into a playable Archipelago world. Nodes become items and locations, edges become access rules. Complete tasks in dependency order to reach the final node.

## How to Play

1. Choose or create a dependency graph (tech tree, skill tree, recipe chain, task list)
2. Generate a seed — the graph's items get shuffled into the multiworld item pool
3. Play through the web client — use the Proof Queue (table) or Proof Graph (visual) to navigate and check locations
4. Complete nodes by collecting their dependency items from across the multiworld

### Graph-to-World Mapping

| Graph Concept | What It Becomes |
|---------------|-----------------|
| Node | A region, location, and item |
| Edge (A -> B) | An access rule — B requires A |
| Root node (no deps) | Accessible from the start |
| Final node | The win condition |

## Bundled Graphs

| Graph | Nodes | Theme |
|-------|-------|-------|
| `tech_tree` | 10 | Technology progression from basic tools to industrial age |
| `skill_tree` | 12 | RPG warrior skill tree with branching and convergence |
| `recipe_chain` | 8 | Alchemy recipe chain |
| `baking_adventure` | 15 | Cookie baking with ingredient prep and equipment |
| `coding_adventure` | 61 | Full-stack web development project |

Custom graphs can be provided in JSON, DOT, or CSV format.

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `graph_file` | `coding_adventure` | Bundled graph name or path to custom graph |
| `starting_nodes` | 0 | Percentage of nodes pre-unlocked at start (0-50) |
| `randomize_items` | true | Shuffle items across locations |
| `randomize_starting_nodes` | true | Select starting nodes randomly vs sequentially |
| `vanilla_placement` | false | Items stay in their original nodes (no randomization) |
| `entrance_rule_mode` | `relaxed_items` | How convergence nodes handle multi-dependency access rules |

### Entrance Rule Modes

For nodes with multiple dependencies, controls how strict the access rules are:

- **strict** — Faithful to the graph, but may cause fill failures in multiworld
- **relaxed_items** (default) — Relaxes item requirements per entrance while preserving dependency structure
- **relaxed_events** — Relaxes event requirements per entrance
- **fully_relaxed** — Each entrance only needs its source node's items

Use `relaxed_items` for multiworld. Use `strict` for solo play if you want exact graph fidelity.

## Task List Converter

The bundled `tasklist_to_depgraph.py` tool converts flat task lists into DepGraph DAGs. Supports four strategies: `layered` (horizontal layers), `sparse` (random dependencies), `priority` (tagged by priority), and `categories` (grouped by @category tags).

## Further Reading

- [Detailed feature overview](../../features/depgraph.md)
- [World source](../../../../worlds/depgraph/)
