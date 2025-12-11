# Rule Types Reference

This document catalogs all rule types currently supported by the Archipelago-CC rule system.

## Overview

The rule system has two layers that work together:

1. **Python Layer** (`exporter/analyzer/ast_visitors.py`) - Converts Python AST to JSON rule structures during export
2. **Frontend Layer** (`frontend/modules/shared/ruleEngine.js`) - Evaluates JSON rules in the browser at runtime

Both layers must support a rule type for it to work end-to-end.

## Rule Type Catalog

### Logical Operators

| Type | Description | Fields | Example |
|------|-------------|--------|---------|
| `and` | Logical AND of conditions | `conditions: []` | `{"type": "and", "conditions": [...]}` |
| `or` | Logical OR of conditions | `conditions: []` | `{"type": "or", "conditions": [...]}` |
| `not` | Logical negation | `condition` or `operand` | `{"type": "not", "condition": {...}}` |
| `conditional` | Ternary if-then-else | `test`, `if_true`, `if_false` | `{"type": "conditional", "test": {...}, "if_true": {...}, "if_false": {...}}` |
| `count_true` | True if N conditions pass | `conditions: []`, `count` | `{"type": "count_true", "conditions": [...], "count": 3}` |

### Item & Inventory Checks

| Type | Description | Fields | Example |
|------|-------------|--------|---------|
| `item_check` | Check if player has an item | `item`, `count` (optional) | `{"type": "item_check", "item": "Sword"}` |
| `count_check` | Check if player has N of item | `item`, `count` | `{"type": "count_check", "item": "Key", "count": 3}` |
| `group_check` | Check for N items from a group | `group`, `count` | `{"type": "group_check", "group": "swords", "count": 1}` |
| `group_count` | Get count of items in group (returns number) | `group` | `{"type": "group_count", "group": "keys"}` |
| `count_item` | Get item count as number | `item` | `{"type": "count_item", "item": "Rupee"}` |
| `total_items_count` | Check total items collected | `count` | `{"type": "total_items_count", "count": 50}` |
| `locations_checked` | Check locations checked count | `count` | `{"type": "locations_checked", "count": 10}` |

### Access & Reachability

| Type | Description | Fields | Example |
|------|-------------|--------|---------|
| `can_reach` | Check if region is reachable | `region` | `{"type": "can_reach", "region": "Death Mountain"}` |
| `can_reach_entrance` | Check if entrance is reachable | `entrance` | `{"type": "can_reach_entrance", "entrance": "Cave Door"}` |
| `location_check` | Check if location is accessible | `location` | `{"type": "location_check", "location": "Chest A"}` |
| `region_check` | Check if region is accessible | `region` | `{"type": "region_check", "region": "Dungeon 1"}` |
| `region_reference` | Reference to a region (from get_region) | `region` | `{"type": "region_reference", "region": "Good Bee Cave"}` |
| `region_attribute` | Access region property | `region`, `attr` | `{"type": "region_attribute", "region": {...}, "attr": "is_light_world"}` |
| `capability` | Check player capability | `capability` | `{"type": "capability", "capability": "can_swim"}` |
| `state_method` | Call StateManager methods | `method`, `args: []` | `{"type": "state_method", "method": "can_reach", "args": [...]}` |

### Data & Values

| Type | Description | Fields | Example |
|------|-------------|--------|---------|
| `constant` / `value` | Literal constant values | `value` | `{"type": "constant", "value": 5}` |
| `name` | Variable/name reference | `name` | `{"type": "name", "name": "player"}` |
| `attribute` | Property access (obj.attr) | `object`, `attr` | `{"type": "attribute", "object": {...}, "attr": "name"}` |
| `subscript` | Array/dict indexing | `value`/`object`, `index` | `{"type": "subscript", "value": {...}, "index": {...}}` |
| `list` | Array literal | `value: []` | `{"type": "list", "value": [...]}` |
| `tuple` | Fixed array | `elements: []` | `{"type": "tuple", "elements": [...]}` |
| `world_reference` | Reference to world object | (none) | `{"type": "world_reference"}` |
| `setting_value` | Get game setting value | `setting` | `{"type": "setting_value", "setting": "difficulty"}` |
| `setting_check` | Check if setting equals value | `setting`, `value` | `{"type": "setting_check", "setting": "mode", "value": "hard"}` |
| `f_string` | String formatting | `parts: [{type, value}]` | `{"type": "f_string", "parts": [...]}` |

### Functions & Helpers

| Type | Description | Fields | Example |
|------|-------------|--------|---------|
| `helper` | Game-specific helper call | `name`, `args: []` | `{"type": "helper", "name": "can_swim", "args": []}` |
| `generic_helper` | Unconverted helper call | `name`, `args: []` | `{"type": "generic_helper", "name": "complex_check", "args": [...]}` |
| `function_call` | Generic function call | `function`, `args: []` | `{"type": "function_call", "function": {...}, "args": [...]}` |
| `method_call` | Method call on object | `object`, `method`, `args: []` | `{"type": "method_call", "object": {...}, "method": "check", "args": [...]}` |

### Arithmetic & Comparison

| Type | Description | Fields | Operators |
|------|-------------|--------|-----------|
| `binary_op` / `binop` | Arithmetic operations | `left`, `right`, `op` | `+`, `-`, `*`, `/`, `//`, `%` |
| `compare` / `comparison` | Comparison operations | `left`, `right`, `op` | `==`, `!=`, `<`, `>`, `<=`, `>=`, `in` |
| `min` | Return minimum of values | `args: []` | N/A |
| `max` | Return maximum of values | `args: []` | N/A |

### Generators & Iteration

| Type | Description | Fields | Example |
|------|-------------|--------|---------|
| `all_of` | Apply rule to all items (AND) | `element_rule`, `iterator_info` | All items in a list must satisfy condition |
| `any_of` | Apply rule to any item (OR) | `element_rule`, `iterator_info` | At least one item must satisfy condition |
| `generator_expression` | Python generator expression | `element`, `comprehension` | Complex iteration patterns |

### Imperative/Block Types

These types support complex helper functions with multi-statement bodies:

| Type | Description | Fields | Example |
|------|-------------|--------|---------|
| `block` | Execute statements sequentially | `statements: []` | Multi-line helper body |
| `assign` | Variable assignment | `name`, `value`, `op` | `count = 0` or `count += 1` |
| `return` | Early return from block | `value` | `return True` |
| `for_range` | Loop N times | `count`, `var`, `body: []` | `for i in range(5):` |

## Key Implementation Files

| File | Purpose |
|------|---------|
| `exporter/analyzer/ast_visitors.py` | Python AST to rule JSON conversion |
| `frontend/modules/shared/ruleEngine.js` | Rule evaluation engine (see `evaluateRule()` function) |
| `frontend/schema/rules.schema.json` | Rule structure validation schema |

## Python State Methods

The following `state.*` methods are recognized and converted to specific rule types:

| Python Method | Rule Type | Notes |
|---------------|-----------|-------|
| `state.has(item, player)` | `item_check` | Basic item check |
| `state.has(item, player, count)` | `count_check` | Item count check |
| `state.has_any(items, player)` | `or` of `item_check` | Has any of the items |
| `state.has_all(items, player)` | `and` of `item_check` | Has all items |
| `state.has_group(group, player)` | `group_check` | Has item from group |
| `state.has_group(group, player, count)` | `group_check` | Has N items from group |
| `state.count(item, player)` | `count_item` | Get item count |
| `state.count_group(group, player)` | `group_count` | Get group item count |
| `state.can_reach(region, ...)` | `can_reach` | Region reachability |
| `state.can_reach_entrance(entrance)` | `can_reach_entrance` | Entrance reachability |

## See Also

- [Helper Export Guide](helper-export-guide.md) - Exporting helper functions as rule definitions
- [Implementing New Rule Types](implementing-new-rule-types.md) - Adding support for new rule types
