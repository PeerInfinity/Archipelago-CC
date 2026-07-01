# Paths and Obstacles

Paths-and-obstacles is the intermediate representation procgen uses for access rules. Substrates reason spatially — "to reach this goal you cross these obstacles" — while Archipelago reasons in Boolean item logic. This representation is the bridge: rules are *authored* as paths of obstacles during generation, verified against the actual geometry, and *compiled* to Rule Builder JSON only at the end.

The shape:

- A goal's access is an **OR over paths** (alternative routes).
- A path is an **AND over obstacles** it crosses.
- An obstacle clears via an **OR over item combinations**, each an **AND over items**.

## The vocabulary (`frontend/modules/shared/procgen/library.js`)

`DEFAULT_ITEMS` / `DEFAULT_OBSTACLES` define the cross-substrate item and obstacle vocabulary. Items declare their Archipelago classification (progression/filler/…) plus presentation hints. Obstacles declare one of two clear-condition representations, distinguished by `clear_set_type`:

- **`combo_list`** (default) — `clear_set` is an OR of AND-combinations: `[["key_red"]]` clears with the red key; `[["jump"], ["fly"], ["rocket"]]` clears with any one; `[["red_key", "keycard"]]` requires both.
- **`rule`** — `clear_rule` is a Rule Builder JSON expression evaluated against the player's inventory. This is the **`logic_gate`** obstacle: an arbitrary AP access rule expressed as an in-world gate, which is how any item — foreign multiworld items included — can gate any substrate's geometry.

Two semantic notes baked into the library: AP's `has()` is *permanent* (a picked-up key keeps its doors open forever, so pools supply one key per color and any number of doors), and the `victory` item is special — when present in a pool, drivers wire a `state.has(victory)` completion condition instead of the constant-true placeholder, and the scenario pool defers its placement so it lands in a leaf region gated on the rest of the inventory. Substrates extend the vocabulary via `libraryItems` / `libraryObstacles` on their registry entries (bounce's `bounce_gate_<ability>` physics obstacles), merged with the defaults by consumers.

## Producers

Each substrate extracts paths-and-obstacles from its *built* geometry, so the emitted rules describe what the world actually enforces:

- **Maze** (`mazeRoomEngine.js`, "Paths-and-obstacles extraction"): for each target (the exits and every item pickup), an obstacle-transparent BFS from the entrance, annotated with the obstacles the path crosses. One path per target.
- **Bounce** (`apRules.js`): the physics-derived minimal ability sets become an OR of paths of physics-obstacle ids, and authored non-physics terms (foreign items, counts > 1) become per-term `logic_gate` obstacles ANDed onto every path — physics-first, logic-gate fallback. The obstacle id is the through-line tying the geometry template, the verifier, and the emitted path together.

Empty-case conventions are load-bearing at both ends: no paths ⇒ unreachable ⇒ `False_`; one path with no obstacles ⇒ always reachable ⇒ `True_`; an obstacle with an empty `clear_set` ⇒ never clearable ⇒ `False_`; an empty combination ⇒ clears for free ⇒ `True_`.

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
