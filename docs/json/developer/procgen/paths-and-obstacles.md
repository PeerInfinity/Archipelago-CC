# Paths and Obstacles

Paths-and-obstacles is the intermediate representation procgen uses for access rules. Substrates reason spatially — "to reach this goal you cross these obstacles" — while Archipelago reasons in Boolean item logic. This representation is the bridge: rules are *authored* as paths of obstacles during generation, verified against the geometry, and *compiled* to Rule Builder JSON only at the end.

The terms used here (*obstacle*, *clearer*, *goal*, *requirement*, *region*) are defined in the [procgen glossary](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/glossary.html) (data: [`frontend/modules/procgenDocs/glossary.js`](../../../../frontend/modules/procgenDocs/glossary.js)).

The shape:

- A goal's access is an **OR over paths** (alternative routes).
- A path is an **AND over obstacles** it crosses.
- An obstacle clears via an **OR over item combinations**, each an **AND over items**.

## The vocabulary (`frontend/modules/shared/procgen/library.js`)

`DEFAULT_ITEMS` / `DEFAULT_OBSTACLES` define the cross-substrate item and obstacle vocabulary. Items declare their Archipelago classification (progression/filler/…) plus presentation hints. Obstacles declare one of two clear-condition representations, distinguished by `clear_set_type`:

- **`combo_list`** (default) — `clear_set` is an OR of AND-combinations: `[["key_red"]]` clears with the red key; `[["jump"], ["fly"], ["rocket"]]` clears with any one; `[["red_key", "keycard"]]` requires both.
- **`rule`** — `clear_rule` is a Rule Builder JSON expression evaluated against the player's inventory. This is the **`logic_gate`** obstacle: an arbitrary AP access rule expressed as an in-world gate, which is how any item — foreign multiworld items included — can gate any substrate's geometry.

Two rules are built into the library:

- **Items are permanent.** Archipelago's `has()` never becomes false again, so a picked-up key keeps its doors open for the rest of the game.
- **`victory` is special.** When the pool holds a `victory` item, drivers wire a `state.has(victory)` completion condition instead of the constant-true placeholder, and the scenario pool places it last, so it lands in a leaf region gated on the rest of the inventory.

Substrates add items through `libraryItems` on their registry entries, which the pipeline merges with the defaults. Obstacles travel per region instead: a zone substrate's physics gates (bounce's `bounce_gate_<ability>`) arrive as the region's own `obstacle_defs`, which `compileRegionGraph` merges over the shared library when it compiles that region.

**Keys and doors are per instance, not per colour.** The fixed colour list in the library is what the vanilla maze uses. The level generator's area graph instead names each lock group with its own symbol (`K0`, `K1`, …), and the maze turns a symbol into a `door_K{n}` obstacle and a `key_K{n}` item (`doorIdFor` / `keyIdFor` in `frontend/modules/mazeRoom/procgenMaze.js`), so a level can hold many independent lock groups and the colours are cosmetic. Seedling has no key items: a key is a `ButtonRoom` flag that the player steps on, and it opens every lock in its group by writing a level persistence tag. Each key group costs two of the level's 30 tags. See [Maze Substrate](./maze.md#the-area-graph) and [Flash Substrate](./flash.md).

## Producers

Each substrate extracts paths-and-obstacles from its *built* geometry, so the emitted rules describe what the world actually enforces:

- **Maze** (`mazeRoomEngine.js`, "Paths-and-obstacles extraction"): for each target (the exits and every item pickup), an obstacle-transparent BFS from the entrance, annotated with the obstacles the path crosses. One path per target.

  **Note:** `world.items` and `world.exits` are exactly what this extractor publishes as Archipelago locations, so anything that is not a check (a generated button, an element's port) must live elsewhere, such as the separate `world.buttons` map. Filing it in `world.items` would create a phantom location.
- **Bounce** (`apRules.js`): the physics-derived minimal ability sets become an OR of paths of physics-obstacle ids, and authored non-physics terms (foreign items, counts > 1) become per-term `logic_gate` obstacles ANDed onto every path — physics first, logic gates as the fallback. The obstacle id ties the geometry template, the verifier, and the emitted path together.

The empty cases matter at both ends: no paths ⇒ unreachable ⇒ `False_`; one path with no obstacles ⇒ always reachable ⇒ `True_`; an obstacle with an empty `clear_set` ⇒ never clearable ⇒ `False_`; an empty combination ⇒ clears for free ⇒ `True_`.

## The compiler (`frontend/modules/shared/procgen/pathsAndObstaclesCompiler.js`)

Genre-agnostic four-nested-loop expansion:

```
reach(target) =
  OR over paths p:
    AND over obstacles o in p.obstacles:
      OR over combinations c in o.clear_set:
        AND over items i in c:
          has(i)
```

The caller supplies the obstacle library; `rule`-type obstacles inline their `clear_rule` unchanged. The output is Rule Builder JSON conforming to `frontend/schema/rules.schema.json`, consumable by `world_generator` — from this point on, a procgen rule is indistinguishable from any exported game's rule.

## The inverse: rule → requirement (`frontend/modules/procgenPipeline/ruleRequirements.js`)

The top-down driver realises an *existing* `rules.json` onto substrates whose geometry is item-gated, which needs the opposite mapping: given a rule, which items must the player hold? `extractRuleRequirement` returns `{ requirement, counts, exact }`:

- `True_` / `Has` / `And` / `HasAll` extract **exactly** (`exact: true` — the requirement is logically equivalent to the rule).
- `Or` / `HasAny` / unsupported constructs can't be one AND-of-items, so the result falls back to the items required in *every* branch (the necessary subset, possibly empty) with `exact: false`.

An inexact extraction is safe because the driver preserves the original rule text: the geometry only has to be *open enough*, and the preserved `access_rule` still gates at play time.

## Related documentation

- [Architecture](./architecture.md) — where compilation sits in the flow
- [Bounce Substrate](./bounce.md) — the physics-first emitter and obstacle templates
- [Maze Substrate](./maze.md) — the BFS extractor
- [Rule Format Specification](../specs/rule-format-specification.md) — the compiled target format
