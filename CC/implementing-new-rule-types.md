# Implementing New Rule Types

This guide explains how to identify missing rule types and implement support for them in both the Python analyzer and JavaScript frontend.

## When to Implement a New Rule Type

When following the [Helper Export Guide](helper-export-guide.md), you may encounter helpers that can't be exported because the rule system doesn't support certain Python patterns. Instead of blacklisting many helpers, consider implementing support for the missing rule type.

Signs you need a new rule type:
- Multiple helpers are blacklisted for the same reason (e.g., "uses loops")
- The browser console shows `[evaluateRule] Unknown rule type: <type>`
- Generated `rules.json` contains rule structures that the frontend can't evaluate

## Finding Missing Rule Types

### Method 1: Check Blacklisted Helpers

Look at game exporters to see why helpers were blacklisted:

```bash
grep -r "HELPERS_TO_EXPORT_BLACKLIST" exporter/games/
```

**Current blacklisted helpers and their reasons:**

| Game | Helper | Reason |
|------|--------|--------|
| A Link to the Past | `can_extend_magic` | Complex counting logic |
| A Link to the Past | `has_crystals` | Dynamic crystal counting |
| A Link to the Past | `has_hearts` | Heart piece counting loop |
| A Hat in Time | `can_use_hat` | Loop through `hat_craft_order` |
| A Hat in Time | `get_hat_cost` | Loop calculating cumulative costs |
| A Hat in Time | `has_relic_combo` | Uses `state.has_group` |
| A Hat in Time | `get_relic_count` | Uses `state.count_group` |
| Castlevania 64 | `location_item_name` | Dynamic item name lookup |

### Method 2: Check Browser Console

1. Generate a multiworld for a game with helper export enabled
2. Run the spoiler test: `npm test -- --mode=test-spoilers --game=gamename --seed=1`
3. Check the browser console for errors like:
   ```
   [evaluateRule] Unknown rule type: some_new_type
   ```

### Method 3: Examine Generated rules.json

1. Generate a multiworld and find the output:
   ```
   frontend/presets/<game>/AP_<seed>/AP_<seed>_rules.json
   ```
2. Search for rule types you don't recognize
3. Compare with the [Rule Types Reference](rule-types-reference.md)

### Method 4: Check Python Analyzer Output

Look for `visit_*` methods in `ast_visitors.py` that might be generating unsupported types:

```bash
grep -n "def visit_" exporter/analyzer/ast_visitors.py
```

## Implementing a New Rule Type

### Step 1: Understand the Python Pattern

First, understand what Python code pattern produces this rule type. Look at the original helper function in the game's world files.

**Example:** The `group_count` type was needed for `state.count_group(group_name, player)`:

```python
# Python helper that needed support
def has_enough_keys(state, player):
    return state.count_group("keys", player) >= 3
```

### Step 2: Update the Python Analyzer

**File:** `exporter/analyzer/ast_visitors.py`

Add handling in the appropriate `visit_*` method. For method calls on `state`, this is typically in `visit_Call()`:

```python
# In visit_Call() or the method call handling section
elif method == 'count_group' and len(filtered_args) >= 1:
    group_arg = filtered_args[0]
    if isinstance(group_arg, dict) and group_arg.get('type') == 'constant':
        group_value = group_arg.get('value')
    elif isinstance(group_arg, str):
        group_value = group_arg
    else:
        group_value = group_arg
    result = {'type': 'group_count', 'group': group_value}
```

**Key patterns to look for in ast_visitors.py:**
- `visit_Call()` - Function and method calls
- `visit_BoolOp()` - Boolean operations (and/or)
- `visit_Compare()` - Comparison operations
- `visit_BinOp()` - Arithmetic operations
- `visit_For()` - Loop constructs
- `visit_If()` / `visit_IfExp()` - Conditionals

### Step 3: Update the Frontend Rule Engine

**File:** `frontend/modules/shared/ruleEngine.js`

Add a case in the `evaluateRule()` function's switch statement (around line 371):

```javascript
case 'group_count': {
  const groupName = evaluateRule(rule.group, context, depth + 1);
  if (groupName === undefined) {
    result = undefined;
  } else if (typeof context.countGroup === 'function') {
    result = context.countGroup(groupName) ?? 0;
  } else {
    result = undefined;
  }
  break;
}
```

**Important considerations:**
- Handle `undefined` values (indicates "unknown" state)
- Use `context` methods rather than global state
- Respect the depth limit (max 100) to prevent stack overflow
- Return appropriate types (boolean for checks, numbers for counts)

### Step 4: Update the Schema (Optional)

**File:** `frontend/schema/rules.schema.json`

If your new rule type has unique fields, add them to the schema for validation.

### Step 5: Test the Implementation

1. **Regenerate the multiworld:**
   ```bash
   python Generate.py --weights_file_path "Templates/GameName.yaml" --multi 1 --seed 1
   ```

2. **Run spoiler tests:**
   ```bash
   npm test -- --mode=test-spoilers --game=gamename --seed=1
   ```

3. **Check for console errors** in the browser during test execution

4. **Verify the helper now works** by removing it from `HELPERS_TO_EXPORT_BLACKLIST` and re-testing

## Examples from Recent Commits

### Example 1: `group_count` (commit c859b4cfe)

**Problem:** Helpers using `state.count_group()` couldn't be exported.

**Python pattern:**
```python
state.count_group("item_group", player)
```

**Analyzer change:**
```python
elif method == 'count_group' and len(filtered_args) >= 1:
    group_value = filtered_args[0]
    result = {'type': 'group_count', 'group': group_value}
```

**Frontend change:**
```javascript
case 'group_count': {
  const groupName = evaluateRule(rule.group, context, depth + 1);
  result = context.countGroup(groupName) ?? 0;
  break;
}
```

### Example 2: Imperative Blocks (commit d14f7433d)

**Problem:** Multi-statement helper functions with assignments and loops couldn't be exported.

**Python patterns:**
```python
def complex_helper(state, player):
    count = 0
    for i in range(5):
        if state.has(f"Key {i}", player):
            count += 1
    return count >= 3
```

**New rule types added:**
- `block` - Sequential statement execution
- `assign` - Variable assignment (including `+=`, `-=`, etc.)
- `return` - Early return from block
- `for_range` - Loop N times

### Example 3: Entrance Reachability (commit 84a156ebb)

**Problem:** `state.can_reach()` with Entrance type wasn't being converted correctly.

**Python pattern:**
```python
state.can_reach(entrance_obj, "Entrance", player)
```

**Change:** Updated `can_reach` handling to detect Entrance type and produce `can_reach_entrance` rule type.

### Example 4: `min` and `max` Built-in Functions

**Problem:** Helpers using Python's `min()` and `max()` functions couldn't be exported. This affected helpers like:
- `heart_count` in ALTTP
- `can_use_bombs` in ALTTP
- `bottle_count` in ALTTP
- `can_hold_arrows` in ALTTP

**Python patterns:**
```python
min(state.count('Piece of Heart', player), max_heart_pieces) // 4
max(0, (state.count("Bomb Upgrade (+5)", player) - 6) * 10)
```

**Analyzer change** (in `visit_Call()` after len handling):
```python
# *** Special handling for min() function ***
if func_name == 'min' and len(filtered_args) >= 2:
    logging.debug(f"Detected min() function call with {len(filtered_args)} args")
    result = {
        'type': 'min',
        'args': filtered_args
    }
    return result

# *** Special handling for max() function ***
if func_name == 'max' and len(filtered_args) >= 2:
    logging.debug(f"Detected max() function call with {len(filtered_args)} args")
    result = {
        'type': 'max',
        'args': filtered_args
    }
    return result
```

**Frontend change:**
```javascript
case 'min': {
  if (!rule.args || rule.args.length === 0) {
    result = undefined;
    break;
  }
  const minArgs = rule.args.map((arg) =>
    evaluateRule(arg, context, depth + 1)
  );
  if (minArgs.some((arg) => arg === undefined)) {
    result = undefined;
    break;
  }
  result = Math.min(...minArgs);
  break;
}

case 'max': {
  if (!rule.args || rule.args.length === 0) {
    result = undefined;
    break;
  }
  const maxArgs = rule.args.map((arg) =>
    evaluateRule(arg, context, depth + 1)
  );
  if (maxArgs.some((arg) => arg === undefined)) {
    result = undefined;
    break;
  }
  result = Math.max(...maxArgs);
  break;
}
```

### Example 5: `setting_value` Pattern Detection (commit 52fe9b0a)

**Problem:** Helpers accessing world options like `state.multiworld.worlds[player].options.bombless_start` produced verbose, deeply nested attribute chains in the exported rules that the frontend couldn't evaluate.

**Python pattern:**
```python
# Common pattern in helpers that check game settings
if state.multiworld.worlds[player].options.bombless_start:
    bombs = 0
else:
    bombs = 10
```

**Solution:** Add pattern detection to recognize this specific attribute chain and convert it to a simple `setting_value` rule type.

**Analyzer change** (add helper method to `ASTVisitorMixin` class):
```python
def _is_world_options_pattern(self, node):
    """
    Detect the pattern: state.multiworld.worlds[player].options.<setting>
    Returns the setting name if matched, None otherwise.
    """
    if not isinstance(node, ast.Attribute):
        return None

    setting_name = node.attr

    # Check .options
    if not isinstance(node.value, ast.Attribute) or node.value.attr != 'options':
        return None

    # Check [player] subscript
    subscript = node.value.value
    if not isinstance(subscript, ast.Subscript):
        return None
    if not isinstance(subscript.slice, ast.Name) or subscript.slice.id != 'player':
        return None

    # Check .worlds
    worlds_attr = subscript.value
    if not isinstance(worlds_attr, ast.Attribute) or worlds_attr.attr != 'worlds':
        return None

    # Check .multiworld
    multiworld_attr = worlds_attr.value
    if not isinstance(multiworld_attr, ast.Attribute) or multiworld_attr.attr != 'multiworld':
        return None

    # Check state (or world)
    state_name = multiworld_attr.value
    if not isinstance(state_name, ast.Name) or state_name.id not in ('state', 'world'):
        return None

    return setting_name
```

**Usage in `visit_Attribute()`:**
```python
def visit_Attribute(self, node):
    # Check for state.multiworld.worlds[player].options.<setting> pattern
    setting_name = self._is_world_options_pattern(node)
    if setting_name:
        logging.debug(f"Detected world options pattern, setting: {setting_name}")
        return {'type': 'setting_value', 'setting': setting_name}

    # ... rest of visit_Attribute
```

**Result:** Instead of a deeply nested attribute structure, the exported rule is simply:
```json
{"type": "setting_value", "setting": "bombless_start"}
```

**Key insight:** Pattern detection is useful when Python code uses a common idiom that produces verbose output. By detecting the pattern early in the analyzer, you can emit a simpler, more semantic rule type that the frontend can easily evaluate.

## Debugging Tips

### Print Analyzer Output

Add logging to `ast_visitors.py` to see what's being generated:

```python
import logging
logger = logging.getLogger(__name__)

# In your visit method
logger.debug(f"Generated rule: {result}")
```

### Inspect rules.json

Use `jq` or a JSON viewer to examine the generated rules:

```bash
cat frontend/presets/gamename/AP_*/AP_*_rules.json | jq '.helpers'
```

### Add Frontend Logging

Temporarily add logging in `ruleEngine.js`:

```javascript
case 'your_new_type': {
  console.log('[evaluateRule] Processing your_new_type:', rule);
  // ... implementation
  console.log('[evaluateRule] Result:', result);
  break;
}
```

### Check StateManager Context

Ensure the context object has the methods your rule type needs. Check `StateManager` for available methods:
- `hasItem(itemName)` / `countItem(itemName)`
- `hasGroup(groupName)` / `countGroup(groupName)`
- `canReach(regionName)` / `canReachEntrance(entranceName)`
- Settings via `context.settings`

## Checklist for New Rule Types

- [ ] Identified the Python pattern that needs support
- [ ] Added handling in `exporter/analyzer/ast_visitors.py`
- [ ] Added case in `frontend/modules/shared/ruleEngine.js`
- [ ] Handled `undefined` values appropriately
- [ ] Tested with a game that uses this pattern
- [ ] Removed helper from blacklist if applicable
- [ ] Verified spoiler tests pass

## See Also

- [Rule Types Reference](rule-types-reference.md) - Complete list of supported rule types
- [Helper Export Guide](helper-export-guide.md) - Exporting helper functions as rule definitions
