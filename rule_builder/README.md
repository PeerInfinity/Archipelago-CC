# Rule Builder

Rule Builder is a declarative rule definition system for Archipelago. It replaces lambda-based access rules with composable, serializable Python objects — making game logic intrinsically convertible to and from JSON.

Rule Builder is part of the main Archipelago repository (originally [PR #5048](https://github.com/ArchipelagoMW/Archipelago/pull/5048) by drtchops). This repository extends it with additional rule types, modules, and integration points needed by the [exporter](../exporter/README.md), [world generator](../world_generator/README.md), and web frontend.

## Module Layout

As of the 2026-06-25 upstream re-base, `rule_builder/` is the **clean upstream package plus fork overlay files** — the upstream modules stay close to vanilla and the fork's features live in separate modules. This keeps future upstream merges low-conflict (see [the upstream merge guide](../CC/docs/upstream-merge-guide.md), Category 6).

| Module | Origin | Purpose |
|--------|--------|---------|
| `rules.py` | Upstream + **minimal additive edits** | Base rule classes (`Has`, `And`, `Or`, `CanReach*`, …). Fork additions: `Rule.Resolved.get_value()/get_count()/to_dict()`, `_make_hashable`, `Has` dynamic counts, broadened subclass guard |
| `field_resolvers.py` | Upstream | Dynamic field values (`FromOption`, `FromWorldAttr`, `resolve_field`) |
| `cached_world.py`, `options.py` | Upstream | World caching base + `OptionFilter` |
| `extra_rules.py` | **Fork** | The 15 extended rule types + `BOOLEAN_RULE_TYPES` |
| `world_mixin.py` | **Fork** | `RuleWorldMixin` / `RuleBuilderLogicMixin` |
| `ast_format.py`, `ast_explain.py`, `_ast_utils.py` | **Fork** | AST-JSON parsing + human-readable explanations |
| `pathfinding.py` | **Fork** | Region accessibility + hypothetical-state analysis |
| `__init__.py` | **Fork** | Re-exports the full public API (57 names) across the modules above |

All public names are importable from the package root regardless of which module they live in (`from rule_builder import CountItem, RuleWorldMixin, FromOption`).

## How It Works

In standard Archipelago, access rules are Python lambdas:

```python
# Traditional lambda rules — not serializable
set_rule(location, lambda state: state.has("Sword", player) and state.has("Shield", player))
```

Rule Builder replaces these with declarative objects that can be serialized to JSON and reconstructed:

```python
from rule_builder import Has, HasAll, And, Or, CanReachRegion, Rule

# Declarative rules
rule = Has("Sword") & Has("Shield")
rule = HasAll(["Key1", "Key2"]) | CanReachRegion("Shortcut")

# Serialize to JSON, then reconstruct
rule_dict = rule.to_dict()
rule = Rule.from_dict(rule_dict)
```

This is the foundation of the JSON export pipeline: the [exporter](../exporter/README.md) converts lambda rules to AST JSON, which can be parsed into Rule Builder objects, and the [world generator](../world_generator/README.md) converts them back into Python world code.

## Upstream Rule Types

| Category | Classes |
|----------|---------|
| Boolean | `True_`, `False_` |
| Composite | `And`, `Or`, `AtLeast`, `Filtered` |
| Item checks | `Has`, `HasAll`, `HasAny`, `HasAllCounts`, `HasAnyCount`, `HasFromList`, `HasFromListUnique`, `HasGroup`, `HasGroupUnique` |
| Reachability | `CanReachLocation`, `CanReachRegion`, `CanReachEntrance` |
| Base classes | `Rule`, `NestedRule`, `WrapperRule` |
| World integration | `RuleWorldMixin`, `RuleBuilderLogicMixin`, `OptionFilter` |
| Dynamic values | `FieldResolver`, `FromOption`, `FromWorldAttr`, `resolve_field` |

## Fork-Only Rule Types (`extra_rules.py`)

| Class | Purpose |
|-------|---------|
| `Not` | Logical negation |
| `Conditional` | Ternary if-then-else |
| `CountItem` | Get item count as a number (not boolean) |
| `CountFromList` | Cumulative count from item list |
| `CountGroup` | Count from item group |
| `Compare` | Comparison operations (`==`, `!=`, `<`, `>`, `<=`, `>=`) |
| `Arithmetic` | Math operations (`+`, `-`, `*`, `/`) |
| `MinValue` / `MaxValue` | Min/max of multiple values |
| `WeightedSum` | Weighted sum of item counts |
| `UniqueCount` | Count of unique items from list |
| `HelperCall` | Call game-specific helper functions by name |
| `OptionValue` | Access game options at runtime |
| `EntranceAccessRuleCall` | Call another entrance's access rule |
| `ASTRule` | Wrapper for AST-format expressions |

### Dynamic counts — two supported forms

`Has.count` accepts a static `int`, an upstream `FieldResolver` (`{"resolver": …}` in JSON), **or** a fork `Rule` that evaluates to a number (`{"rule": …}` in JSON):

```python
Has("Coin", count=5)                       # static
Has("Coin", count=FromOption("coin_goal")) # upstream FieldResolver
Has("Coin", count=CountItem("Wallet"))     # fork nested-rule count
```

Both dynamic forms coexist in one `rules.json`, distinguishable by key. This is what lets the fork serve both the fork's AST-converted worlds and upstream worlds authored against `field_resolvers` (e.g. the Baba Is You apworld).

### Game-specific custom rules

A world may define its own `Rule` subclass whose logic lives in a compiled
`Resolved._evaluate` (e.g. Baba Is You's `HasBlossoms`). On export these are
**auto-extracted into frontend-evaluable helper definitions** — the exporter reads
the `_evaluate` method, rewrites `self.player` / `self.<field>` references, and runs
it through the same `analyze_rule` pipeline used for helper functions, emitting the
result into the `helpers` section keyed by the rule's name. The rule's own dataclass
fields are auto-serialized as the rule node's `args` (no `_get_args_dict()` override
needed for custom rules). Rules whose `_evaluate` can't be analyzed fall back to an
opaque leaf. See the fork-vs-upstream rule_builder doc, §9. A worked example — plus
a frontend spoiler test that exercises the wider rule_builder vocabulary — lives in
`worlds/rulebuilder_test` (its `HasTreasure` is a custom `Rule` subclass).

### Enhanced Upstream Classes

- `Has` — dynamic count support (see above)
- `Rule.Resolved` — added `get_value()`, `get_count()`, and `to_dict()` for counting rules and JSON export
- `RuleWorldMixin` — extended for AST rule support, rule simplification, and entrance creation

## Fork-Only Tooling

### AST Format Parsing (`ast_format.py`)

```python
from rule_builder import is_ast_format, parse_ast_rule

if is_ast_format(rule_dict):
    rule = parse_ast_rule(rule_dict)
```

### Rule Explanations (`ast_explain.py`, used by Universal Tracker)

```python
from rule_builder.ast_explain import explain_rule

explanation = explain_rule(rule, state, world)
# Returns: ["Need Sword (have 0, need 1)", "Need Shield (have 1, need 1) ✓"]
```

### Pathfinding (`pathfinding.py`)

```python
from rule_builder import find_paths_to_region, HypotheticalState

paths = find_paths_to_region(state, target_region)
hypo_state = HypotheticalState(state, additional_items=["Hookshot"])
```

## Integration Points

```
Exporter:          Python lambda → AST JSON → Rule Builder objects
World Generator:   AST JSON → Rule Builder objects → Python world code
Universal Tracker: Rule Builder objects → ast_explain → Human-readable text
```

## Dependencies

This module requires Archipelago core modules (`BaseClasses`, `NetUtils`, `Options`) and only works within the Archipelago environment.

## Related Documentation

- [Rule Builder Modifications](../docs/json/developer/diffs/rule-builder/rule-builder-modifications.md) — changes from upstream PR #5048
- [Fork vs Upstream Comparison](../docs/json/developer/diffs/rule-builder/fork-vs-upstream-rule-builder.md) — API differences + the upstream re-base plan/status
- [Rule Types Reference](../docs/json/developer/reference/rule-types-reference.md) — catalog of AST rule types
- [Format Converter Guide](../docs/json/developer/guides/format-converter.md) — full documentation
