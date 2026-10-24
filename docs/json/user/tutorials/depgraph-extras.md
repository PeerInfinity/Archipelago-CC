# DepGraph: more graphs, and your own

DepGraph ships seven graphs — the coding and baking adventures, a tech tree, a skill tree, a recipe chain, the SWFRecomp vibe-coding plan and a task-flow example — and reads graphs of your own as JSON, DOT or CSV.

## The bundled graphs

1. Open the **Modules** tab and tick **Proof Queue**, **Proof Graph**. Each one's panel opens as you tick it. (Opened from [DepGraph's own mode](https://peerinfinity.github.io/Archipelago-CC/?mode=depgraph), the page has them on already, and you can skip this step.)
2. Load **DepGraph (tech tree)** (seed 7) — in the **Presets** panel, or by opening the page with `?game=depgraph&seed=7`. **Do it** loads it for you.
3. The **Proof Queue** now lists the tech tree's technologies.
4. Load **DepGraph (recipe chain)** (seed 13) — in the **Presets** panel, or by opening the page with `?game=depgraph&seed=13`. **Do it** loads it for you.

In the **Presets** panel, the DepGraph seeds come in threes per graph: 1–3 the coding adventure, 4–6 baking, 7–9 the tech tree, 10–12 the skill tree, 13–15 the recipe chain, 16–18 the vibe-coding plan, 19–21 the task flow. The *vanilla* presets keep each item in its own place.

1. Open the **Region Graph** tab: the same graph, laid out as regions. (In DepGraph's own mode, a click on a region there checks all its locations.)

## A graph of your own

A DepGraph world reads its graph from its options: a bundled one by name, or a file of your own. The Task List converter turns a plain to-do list into one, choosing how tasks depend on each other (`layered`, `sparse`, `priority` or `categories`).

1. In a checkout of this repository, convert a task list (one task per line) into a graph file.

   ```
   python worlds/depgraph/tasklist/tasklist_to_depgraph.py my_tasks.txt --approach layered -o my_graph.json
   ```

Then name the file in a player YAML (DepGraph's graph options) and generate as with any game — *DepGraph: in a multiworld* goes through that.

## Tidy up

1. To put the default layout back, untick **Proof Queue**, **Proof Graph** in the **Modules** tab.

## Next

The [DepGraph feature page](../features/depgraph.md) lists every option.

<!-- GENERATED from frontend/modules/tutorials/content/games/depgraphExtras.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
