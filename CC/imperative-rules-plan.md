# Imperative Rule Evaluation Plan

This document outlines the plan to add support for imperative-style rule evaluation in the frontend, enabling complex helpers like `has_x_belt_multiplier` and `has_logic_list_building` to be exported as definitions.

## Target Helpers

### 1. `has_x_belt_multiplier`

```python
def has_x_belt_multiplier(state: CollectionState, player: int, needed: float) -> bool:
    multiplier = 1.0
    for _ in range(state.count(ITEMS.upgrade_rising_belt, player)):
        multiplier *= 2
    multiplier += state.count(ITEMS.upgrade_gigantic_belt, player) * 10
    multiplier += state.count(ITEMS.upgrade_big_belt, player)
    multiplier += state.count(ITEMS.upgrade_small_belt, player) * 0.1
    return multiplier >= needed
```

**Required features:**
- Variable initialization (`multiplier = 1.0`)
- For loop with range based on item count
- Compound assignment (`*=`, `+=`)
- Binary operations (`*`)
- Comparison (`>=`)

### 2. `has_logic_list_building`

```python
def has_logic_list_building(state: CollectionState, player: int, buildings: list[str],
                            index: int, includeuseful: bool, floating: bool) -> bool:
    if includeuseful and not (state.has(ITEMS.trash, player) and has_balancer(state, player) and
                              has_tunnel(state, player)):
        return False

    if buildings[index] == ITEMS.cutter:
        if buildings.index(ITEMS.stacker) < index and not floating:
            return state.has_any((ITEMS.cutter, ITEMS.cutter_quad), player)
        else:
            return can_cut_half(state, player)
    elif buildings[index] == ITEMS.rotator:
        return can_rotate_90(state, player)
    elif buildings[index] == ITEMS.stacker:
        return can_stack(state, player)
    elif buildings[index] == ITEMS.painter:
        return can_paint(state, player)
    elif buildings[index] == ITEMS.color_mixer:
        return can_mix_colors(state, player)
```

**Required features:**
- Multi-statement function body with early returns
- Array/list indexing (`buildings[index]`)
- Array method calls (`buildings.index(...)`)
- String equality comparison
- Nested conditionals

---

## New Rule Types

### Core Imperative Types

#### `block` - Execute statements in sequence
```json
{
  "type": "block",
  "statements": [
    { "type": "assign", ... },
    { "type": "for_range", ... },
    { "type": "return", ... }
  ]
}
```
Executes statements in order. Returns the value of a `return` statement if encountered, otherwise returns the value of the last statement.

#### `assign` - Variable assignment
```json
{
  "type": "assign",
  "name": "multiplier",
  "value": { "type": "constant", "value": 1.0 }
}
```

With compound operator:
```json
{
  "type": "assign",
  "name": "multiplier",
  "op": "*=",
  "value": { "type": "constant", "value": 2 }
}
```
Supported operators: `=`, `+=`, `-=`, `*=`, `/=`

#### `for_range` - For loop with numeric range
```json
{
  "type": "for_range",
  "var": "_",
  "count": { "type": "count_item", "item": "Rising Belt Upgrade" },
  "body": [
    { "type": "assign", "name": "multiplier", "op": "*=", "value": { "type": "constant", "value": 2 } }
  ]
}
```
Executes body `count` times. The loop variable `var` is available in body (use `_` if unused).

#### `return` - Early return
```json
{
  "type": "return",
  "value": { "type": "constant", "value": false }
}
```
Immediately returns from the current block with the given value.

### Expression Types

#### `comparison` - Comparison operators
```json
{
  "type": "comparison",
  "op": ">=",
  "left": { "type": "name", "name": "multiplier" },
  "right": { "type": "name", "name": "needed" }
}
```
Supported operators: `==`, `!=`, `<`, `<=`, `>`, `>=`

#### `binop` - Binary arithmetic operations
```json
{
  "type": "binop",
  "op": "*",
  "left": { "type": "count_item", "item": "Big Belt Upgrade" },
  "right": { "type": "constant", "value": 10 }
}
```
Supported operators: `+`, `-`, `*`, `/`, `//`, `%`

#### `index` - Array/list indexing
```json
{
  "type": "index",
  "object": { "type": "name", "name": "buildings" },
  "index": { "type": "name", "name": "index" }
}
```

#### `method_call` - Method calls on objects
```json
{
  "type": "method_call",
  "object": { "type": "name", "name": "buildings" },
  "method": "index",
  "args": [{ "type": "constant", "value": "Stacker" }]
}
```
Supports common list methods: `index`, `count`, `__contains__` (for `in` operator)

#### `count_item` - Get item count (returns number, not boolean)
```json
{
  "type": "count_item",
  "item": "Rising Belt Upgrade"
}
```
Unlike `count_check` which returns boolean, this returns the actual count for use in arithmetic.

---

## Example Transformed Rules

### `has_x_belt_multiplier` as JSON

```json
{
  "type": "block",
  "statements": [
    {
      "type": "assign",
      "name": "multiplier",
      "value": { "type": "constant", "value": 1.0 }
    },
    {
      "type": "for_range",
      "var": "_",
      "count": { "type": "count_item", "item": "Rising Belt Upgrade" },
      "body": [
        {
          "type": "assign",
          "name": "multiplier",
          "op": "*=",
          "value": { "type": "constant", "value": 2 }
        }
      ]
    },
    {
      "type": "assign",
      "name": "multiplier",
      "op": "+=",
      "value": {
        "type": "binop",
        "op": "*",
        "left": { "type": "count_item", "item": "Gigantic Belt Upgrade" },
        "right": { "type": "constant", "value": 10 }
      }
    },
    {
      "type": "assign",
      "name": "multiplier",
      "op": "+=",
      "value": { "type": "count_item", "item": "Big Belt Upgrade" }
    },
    {
      "type": "assign",
      "name": "multiplier",
      "op": "+=",
      "value": {
        "type": "binop",
        "op": "*",
        "left": { "type": "count_item", "item": "Small Belt Upgrade" },
        "right": { "type": "constant", "value": 0.1 }
      }
    },
    {
      "type": "return",
      "value": {
        "type": "comparison",
        "op": ">=",
        "left": { "type": "name", "name": "multiplier" },
        "right": { "type": "name", "name": "needed" }
      }
    }
  ]
}
```

### `has_logic_list_building` as JSON (simplified)

```json
{
  "type": "block",
  "statements": [
    {
      "type": "conditional",
      "test": {
        "type": "and",
        "conditions": [
          { "type": "name", "name": "includeuseful" },
          {
            "type": "not",
            "condition": {
              "type": "and",
              "conditions": [
                { "type": "item_check", "item": "Trash" },
                { "type": "helper", "name": "has_balancer", "args": [] },
                { "type": "helper", "name": "has_tunnel", "args": [] }
              ]
            }
          }
        ]
      },
      "if_true": { "type": "return", "value": { "type": "constant", "value": false } },
      "if_false": null
    },
    {
      "type": "assign",
      "name": "building",
      "value": {
        "type": "index",
        "object": { "type": "name", "name": "buildings" },
        "index": { "type": "name", "name": "index" }
      }
    },
    {
      "type": "conditional",
      "test": {
        "type": "comparison",
        "op": "==",
        "left": { "type": "name", "name": "building" },
        "right": { "type": "constant", "value": "Cutter" }
      },
      "if_true": {
        "type": "conditional",
        "test": {
          "type": "and",
          "conditions": [
            {
              "type": "comparison",
              "op": "<",
              "left": {
                "type": "method_call",
                "object": { "type": "name", "name": "buildings" },
                "method": "index",
                "args": [{ "type": "constant", "value": "Stacker" }]
              },
              "right": { "type": "name", "name": "index" }
            },
            {
              "type": "not",
              "condition": { "type": "name", "name": "floating" }
            }
          ]
        },
        "if_true": {
          "type": "return",
          "value": {
            "type": "or",
            "conditions": [
              { "type": "item_check", "item": "Cutter" },
              { "type": "item_check", "item": "Quad Cutter" }
            ]
          }
        },
        "if_false": {
          "type": "return",
          "value": { "type": "helper", "name": "can_cut_half", "args": [] }
        }
      },
      "if_false": {
        "type": "conditional",
        "test": {
          "type": "comparison",
          "op": "==",
          "left": { "type": "name", "name": "building" },
          "right": { "type": "constant", "value": "Rotator" }
        },
        "if_true": {
          "type": "return",
          "value": { "type": "helper", "name": "can_rotate_90", "args": [] }
        },
        "if_false": "... continues with elif chain ..."
      }
    }
  ]
}
```

---

## Implementation Plan

### Phase 1: Analyzer Updates (`exporter/analyzer/`)

#### 1.1 Add multi-statement function body handling

**File: `ast_visitors.py`**

Update `visit_FunctionDef` to handle multi-statement bodies:
- If body has single `Return` statement: current behavior
- If body has multiple statements: emit `block` type with statements array

```python
def visit_FunctionDef(self, node):
    if len(node.body) == 1 and isinstance(node.body[0], ast.Return):
        # Single return - current behavior
        return self.visit(node.body[0].value)
    else:
        # Multi-statement body
        statements = []
        for stmt in node.body:
            result = self.visit_statement(stmt)
            if result:
                statements.append(result)
        return {"type": "block", "statements": statements}
```

#### 1.2 Add statement visitors

**New methods in `ast_visitors.py`:**

```python
def visit_statement(self, node):
    """Route to appropriate statement handler"""
    if isinstance(node, ast.Return):
        return self.visit_Return_stmt(node)
    elif isinstance(node, ast.Assign):
        return self.visit_Assign_stmt(node)
    elif isinstance(node, ast.AugAssign):
        return self.visit_AugAssign(node)
    elif isinstance(node, ast.For):
        return self.visit_For(node)
    elif isinstance(node, ast.If):
        return self.visit_If_stmt(node)
    elif isinstance(node, ast.Expr):
        return self.visit(node.value)
    return None

def visit_Return_stmt(self, node):
    """Handle return as a statement (not just expression)"""
    return {
        "type": "return",
        "value": self.visit(node.value) if node.value else {"type": "constant", "value": None}
    }

def visit_Assign_stmt(self, node):
    """Handle assignment statement"""
    if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        return {
            "type": "assign",
            "name": node.targets[0].id,
            "value": self.visit(node.value)
        }
    return None

def visit_AugAssign(self, node):
    """Handle augmented assignment (+=, *=, etc.)"""
    op_map = {
        ast.Add: "+=", ast.Sub: "-=", ast.Mult: "*=", ast.Div: "/="
    }
    if isinstance(node.target, ast.Name):
        return {
            "type": "assign",
            "name": node.target.id,
            "op": op_map.get(type(node.op), "="),
            "value": self.visit(node.value)
        }
    return None

def visit_For(self, node):
    """Handle for loops with range()"""
    # Check for: for _ in range(count):
    if (isinstance(node.iter, ast.Call) and
        isinstance(node.iter.func, ast.Name) and
        node.iter.func.id == 'range'):

        count_arg = node.iter.args[0] if node.iter.args else None
        var_name = node.target.id if isinstance(node.target, ast.Name) else "_"

        body_stmts = []
        for stmt in node.body:
            result = self.visit_statement(stmt)
            if result:
                body_stmts.append(result)

        return {
            "type": "for_range",
            "var": var_name,
            "count": self.visit(count_arg),
            "body": body_stmts
        }
    return None

def visit_If_stmt(self, node):
    """Handle if statement with potential early return"""
    result = {
        "type": "conditional",
        "test": self.visit(node.test),
        "if_true": None,
        "if_false": None
    }

    # Handle if body (may be single statement or block)
    if len(node.body) == 1:
        result["if_true"] = self.visit_statement(node.body[0])
    else:
        result["if_true"] = {
            "type": "block",
            "statements": [self.visit_statement(s) for s in node.body if self.visit_statement(s)]
        }

    # Handle else/elif
    if node.orelse:
        if len(node.orelse) == 1:
            if isinstance(node.orelse[0], ast.If):
                # elif - recurse
                result["if_false"] = self.visit_If_stmt(node.orelse[0])
            else:
                result["if_false"] = self.visit_statement(node.orelse[0])
        else:
            result["if_false"] = {
                "type": "block",
                "statements": [self.visit_statement(s) for s in node.orelse if self.visit_statement(s)]
            }

    return result
```

#### 1.3 Add expression visitors

```python
def visit_Compare(self, node):
    """Handle comparison expressions"""
    op_map = {
        ast.Eq: "==", ast.NotEq: "!=",
        ast.Lt: "<", ast.LtE: "<=",
        ast.Gt: ">", ast.GtE: ">="
    }
    # Simple case: single comparison
    if len(node.ops) == 1 and len(node.comparators) == 1:
        return {
            "type": "comparison",
            "op": op_map.get(type(node.ops[0]), "=="),
            "left": self.visit(node.left),
            "right": self.visit(node.comparators[0])
        }
    # Chain comparisons: a < b < c -> (a < b) and (b < c)
    # ... handle chained comparisons

def visit_BinOp(self, node):
    """Handle binary operations"""
    op_map = {
        ast.Add: "+", ast.Sub: "-", ast.Mult: "*",
        ast.Div: "/", ast.FloorDiv: "//", ast.Mod: "%"
    }
    return {
        "type": "binop",
        "op": op_map.get(type(node.op), "+"),
        "left": self.visit(node.left),
        "right": self.visit(node.right)
    }

def visit_Subscript(self, node):
    """Handle indexing: buildings[index]"""
    return {
        "type": "index",
        "object": self.visit(node.value),
        "index": self.visit(node.slice)
    }
```

#### 1.4 Handle state.count() returning numbers

Update `visit_Call` to distinguish between:
- `state.count(...) >= N` context -> `count_check` (returns boolean)
- `state.count(...)` in arithmetic -> `count_item` (returns number)

Add a context flag or create separate handler.

---

### Phase 2: Rule Engine Updates (`frontend/modules/shared/ruleEngine.js`)

#### 2.1 Add local variable scope

```javascript
// Add to evaluateRule parameters
export const evaluateRule = (rule, context, depth = 0, localScope = {}) => {
  // ...
}

// Helper to get/set local variables
const getLocalVar = (name, localScope, context) => {
  if (name in localScope) return localScope[name];
  // Fall back to context resolution (for function arguments)
  if (context && typeof context.resolveName === 'function') {
    return context.resolveName(name);
  }
  return undefined;
};
```

#### 2.2 Add new case handlers

```javascript
case 'block': {
  let lastResult = undefined;
  const blockScope = { ...localScope }; // New scope for this block

  for (const stmt of rule.statements) {
    const stmtResult = evaluateRule(stmt, context, depth + 1, blockScope);

    // Check for early return
    if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isReturn) {
      return stmtResult.value;
    }
    lastResult = stmtResult;
  }
  result = lastResult;
  break;
}

case 'assign': {
  const value = evaluateRule(rule.value, context, depth + 1, localScope);

  if (rule.op && rule.op !== '=') {
    const currentVal = localScope[rule.name] || 0;
    switch (rule.op) {
      case '+=': localScope[rule.name] = currentVal + value; break;
      case '-=': localScope[rule.name] = currentVal - value; break;
      case '*=': localScope[rule.name] = currentVal * value; break;
      case '/=': localScope[rule.name] = currentVal / value; break;
    }
  } else {
    localScope[rule.name] = value;
  }
  result = localScope[rule.name];
  break;
}

case 'for_range': {
  const count = evaluateRule(rule.count, context, depth + 1, localScope);
  if (typeof count !== 'number' || count < 0) {
    result = undefined;
    break;
  }

  for (let i = 0; i < count; i++) {
    if (rule.var && rule.var !== '_') {
      localScope[rule.var] = i;
    }
    for (const stmt of rule.body) {
      const stmtResult = evaluateRule(stmt, context, depth + 1, localScope);
      if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isReturn) {
        return stmtResult.value;
      }
    }
  }
  result = undefined; // for loops don't return a value
  break;
}

case 'return': {
  const returnValue = evaluateRule(rule.value, context, depth + 1, localScope);
  // Use special marker object for early return propagation
  return { __isReturn: true, value: returnValue };
}

case 'comparison': {
  const left = evaluateRule(rule.left, context, depth + 1, localScope);
  const right = evaluateRule(rule.right, context, depth + 1, localScope);

  if (left === undefined || right === undefined) {
    result = undefined;
    break;
  }

  switch (rule.op) {
    case '==': result = left === right; break;
    case '!=': result = left !== right; break;
    case '<': result = left < right; break;
    case '<=': result = left <= right; break;
    case '>': result = left > right; break;
    case '>=': result = left >= right; break;
    default: result = undefined;
  }
  break;
}

case 'binop': {
  const left = evaluateRule(rule.left, context, depth + 1, localScope);
  const right = evaluateRule(rule.right, context, depth + 1, localScope);

  if (left === undefined || right === undefined) {
    result = undefined;
    break;
  }

  switch (rule.op) {
    case '+': result = left + right; break;
    case '-': result = left - right; break;
    case '*': result = left * right; break;
    case '/': result = left / right; break;
    case '//': result = Math.floor(left / right); break;
    case '%': result = left % right; break;
    default: result = undefined;
  }
  break;
}

case 'index': {
  const obj = evaluateRule(rule.object, context, depth + 1, localScope);
  const idx = evaluateRule(rule.index, context, depth + 1, localScope);

  if (obj === undefined || idx === undefined) {
    result = undefined;
  } else if (Array.isArray(obj)) {
    result = obj[idx];
  } else if (typeof obj === 'object') {
    result = obj[idx];
  } else {
    result = undefined;
  }
  break;
}

case 'method_call': {
  const obj = evaluateRule(rule.object, context, depth + 1, localScope);
  const args = rule.args.map(arg => evaluateRule(arg, context, depth + 1, localScope));

  if (obj === undefined) {
    result = undefined;
    break;
  }

  // Handle common list/array methods
  if (Array.isArray(obj)) {
    switch (rule.method) {
      case 'index':
        result = obj.indexOf(args[0]);
        break;
      case 'count':
        result = obj.filter(x => x === args[0]).length;
        break;
      default:
        result = undefined;
    }
  } else {
    result = undefined;
  }
  break;
}

case 'count_item': {
  // Return the count as a number (not boolean)
  const itemName = typeof rule.item === 'string'
    ? rule.item
    : evaluateRule(rule.item, context, depth + 1, localScope);

  if (typeof context.countItem === 'function') {
    result = context.countItem(itemName) || 0;
  } else {
    result = 0;
  }
  break;
}
```

#### 2.3 Update `name` case for local variables

```javascript
case 'name': {
  // First check local scope
  if (rule.name in localScope) {
    result = localScope[rule.name];
    break;
  }

  // Then try context resolution
  if (context && typeof context.resolveName === 'function') {
    result = context.resolveName(rule.name);
  }

  // Then try settings
  if (result === undefined && typeof context?.getStaticData === 'function') {
    const staticData = context.getStaticData();
    const playerId = context.playerId || /* ... */;
    const settingValue = staticData?.settings?.[playerId]?.[rule.name];
    if (settingValue !== undefined) {
      result = settingValue;
    }
  }

  // Handle Python builtins
  if (result === undefined) {
    if (rule.name === 'True') result = true;
    else if (rule.name === 'False') result = false;
    else if (rule.name === 'None') result = null;
  }

  break;
}
```

---

### Phase 3: Testing

#### 3.1 Unit tests for new rule types

Create test cases for each new type:
- `block` with multiple statements
- `assign` with simple and compound operators
- `for_range` with various counts
- `return` for early exit
- `comparison` for all operators
- `binop` for arithmetic
- `index` for array access
- `method_call` for list methods

#### 3.2 Integration tests

1. Remove `has_x_belt_multiplier` from blacklist
2. Regenerate shapez preset
3. Run spoiler test
4. Verify no mismatches

5. Remove `has_logic_list_building` from blacklist
6. Regenerate shapez preset
7. Run spoiler test
8. Verify no mismatches

---

## Implementation Order

1. **Phase 1A**: Add `comparison` and `binop` to rule engine (simple, foundational)
2. **Phase 1B**: Add `count_item` type (needed for arithmetic with counts)
3. **Phase 2A**: Add `block`, `assign`, `return` to rule engine
4. **Phase 2B**: Add `for_range` to rule engine
5. **Phase 2C**: Add `index` and `method_call` to rule engine
6. **Phase 3A**: Update analyzer for multi-statement functions
7. **Phase 3B**: Update analyzer for `For`, `AugAssign`, `Compare`, `BinOp`
8. **Phase 4**: Test with `has_x_belt_multiplier`
9. **Phase 5**: Test with `has_logic_list_building`
10. **Phase 6**: Update documentation

---

## Risk Assessment

### Low Risk
- `comparison`, `binop`, `count_item` - Simple additions, no side effects
- `index`, `method_call` - Straightforward implementations

### Medium Risk
- `block`, `assign` - Requires scope management, but well-understood pattern
- `for_range` - Loop execution, need to handle edge cases (0 iterations, large counts)

### Higher Risk
- Early `return` propagation - Need to ensure it doesn't break existing code paths
- Analyzer changes - Must not break existing single-expression rules

---

## Rollback Plan

If issues arise:
1. Keep helpers on blacklist (current behavior works)
2. JavaScript implementations remain as fallback
3. New rule types can be added incrementally without breaking existing rules
