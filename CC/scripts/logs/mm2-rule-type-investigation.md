# Mega Man 2 Rule Type Investigation

## Summary

Investigation of what rule types are required to automatically export the `can_defeat_enough_rbms` helper function from Python, rather than relying on the manual JavaScript implementation in `mm2Logic.js`.

## Current Status

The `can_defeat_enough_rbms` helper is currently **blacklisted** in `exporter/games/mm2.py`:

```python
HELPERS_TO_EXPORT_BLACKLIST = {'can_defeat_enough_rbms'}
```

A manual JavaScript implementation exists in `frontend/modules/shared/gameLogic/mm2/mm2Logic.js` that handles this helper. The spoiler tests pass using this manual implementation.

## The Helper Function

From `worlds/mm2/rules.py`:

```python
def can_defeat_enough_rbms(state: "CollectionState", player: int,
                           required: int, boss_requirements: Dict[int, List[int]]):
    can_defeat = 0
    for boss, reqs in boss_requirements.items():
        if boss in robot_masters:
            if state.has_all(map(lambda x: weapons_to_name[x], reqs), player):
                can_defeat += 1
                if can_defeat >= required:
                    return True
    return False
```

## Missing Rule Types / Features

### 1. Tuple Unpacking in For Loops

**Python Pattern:**
```python
for boss, reqs in boss_requirements.items():
```

**AST Structure:**
```python
For(
    target=Tuple(elts=[Name(id='boss'), Name(id='reqs')]),
    iter=Call(func=Attribute(value=Name(id='boss_requirements'), attr='items'))
)
```

**Current State:**
- Analyzer (`ast_visitors.py:visit_For`): Only handles `ast.Name` targets, not `ast.Tuple`
- Frontend (`ruleEngine.js:for_iter`): Only handles single string `var`, not tuple unpacking

**Required Changes:**

1. **Analyzer** - Update `visit_For()` to handle tuple targets:
   ```python
   if isinstance(node.target, ast.Tuple):
       var_names = [elt.id for elt in node.target.elts if isinstance(elt, ast.Name)]
       # Create a rule with 'vars' as an array instead of single 'var'
   ```

2. **Frontend** - Update `for_iter` case to handle array of variable names:
   ```javascript
   if (Array.isArray(rule.vars)) {
       // Assume iterable items are arrays (e.g., dict.items() produces [[key, value], ...])
       rule.vars.forEach((varName, idx) => {
           if (varName !== '_') {
               localScope[varName] = item[idx];
           }
       });
   }
   ```

### 2. `map()` Built-in Function

**Python Pattern:**
```python
map(lambda x: weapons_to_name[x], reqs)
```

**AST Structure:**
```python
Call(
    func=Name(id='map'),
    args=[
        Lambda(args=..., body=Subscript(...)),
        Name(id='reqs')
    ]
)
```

**Current State:**
- Analyzer: No handling for `map()` function
- Frontend: No `map` rule type

**Required Changes:**

1. **Analyzer** - Add handling in `visit_Call()` for `map()`:
   ```python
   if func_name == 'map' and len(node.args) == 2:
       # First arg should be a lambda
       func_arg = self.visit(node.args[0])
       iterable_arg = self.visit(node.args[1])
       return {
           'type': 'map',
           'function': func_arg,
           'iterable': iterable_arg
       }
   ```

2. **Frontend** - Add `map` case:
   ```javascript
   case 'map': {
       const iterable = evaluateRule(rule.iterable, context, depth + 1, localScope);
       if (!Array.isArray(iterable)) {
           result = undefined;
           break;
       }
       // The function should be a lambda-like rule
       result = iterable.map(item => {
           const lambdaScope = {...localScope};
           // Set lambda parameter to item
           if (rule.function.params && rule.function.params[0]) {
               lambdaScope[rule.function.params[0]] = item;
           }
           return evaluateRule(rule.function.body, context, depth + 1, lambdaScope);
       });
       break;
   }
   ```

### 3. Lambda Expressions (as Function Arguments)

**Python Pattern:**
```python
lambda x: weapons_to_name[x]
```

**AST Structure:**
```python
Lambda(
    args=arguments(args=[arg(arg='x')]),
    body=Subscript(value=Name(id='weapons_to_name'), slice=Name(id='x'))
)
```

**Current State:**
- Analyzer: Has some lambda support but primarily for rule extraction, not as first-class values
- Frontend: Limited lambda support

**Required Changes:**

The analyzer needs to produce a rule type that captures:
- Lambda parameters (variable names)
- Lambda body (the expression to evaluate)

```python
# Analyzer output
{
    'type': 'lambda',
    'params': ['x'],
    'body': {'type': 'subscript', 'value': {...}, 'index': {'type': 'name', 'name': 'x'}}
}
```

### 4. Module-Level Variable Resolution

**Python Pattern:**
```python
boss in robot_masters  # robot_masters is module-level dict
weapons_to_name[x]      # weapons_to_name is module-level dict
```

**Current State:**
- The analyzer doesn't automatically capture module-level variables as closure variables
- These would appear as unresolved `name` references

**Required Changes:**

Two options:

**Option A: Pre-populate closure_vars**
- When analyzing helpers, automatically include module-level dicts referenced in the function
- Pass `robot_masters` and `weapons_to_name` in `closure_vars`

**Option B: Export as constants**
- Export module-level dicts as constants in the rules.json
- Add a `module_constants` field that the frontend can reference

For MM2, the dicts are:
```python
robot_masters = {0: "Heat Man Defeated", 1: "Air Man Defeated", ...}
weapons_to_name = {1: "Atomic Fire", 2: "Air Shooter", ...}
```

## Implementation Priority

1. **High Priority**: Tuple unpacking in for loops - This is a common pattern
2. **High Priority**: Module-level variable resolution - Needed for many helpers
3. **Medium Priority**: `map()` function support - Can sometimes be rewritten as list comprehension
4. **Medium Priority**: Lambda as first-class value - Primarily needed for `map()`

## Alternative Approaches

### Approach 1: Rewrite the Helper (Not Recommended)

The helper could be rewritten to avoid problematic patterns:

```python
def can_defeat_enough_rbms(state, player, required, boss_requirements):
    can_defeat = 0
    for boss_id in boss_requirements.keys():
        if boss_id in [0, 1, 2, 3, 4, 5, 6, 7]:  # Inline robot_masters check
            reqs = boss_requirements[boss_id]
            weapon_names = [weapons_to_name[x] for x in reqs]  # List comp instead of map
            if state.has_all(weapon_names, player):
                can_defeat += 1
                if can_defeat >= required:
                    return True
    return False
```

This still requires module-level variable resolution.

### Approach 2: Keep Manual JS Implementation (Current)

The current `mm2Logic.js` implementation works and passes tests. This is acceptable for games with only one or two complex helpers.

### Approach 3: Implement Missing Rule Types (Recommended)

For long-term maintainability and to support other games that might use similar patterns, implementing the missing rule types is the best approach.

## Estimated Effort

| Feature | Analyzer | Frontend | Testing | Total |
|---------|----------|----------|---------|-------|
| Tuple unpacking in for | 2-3 hours | 2-3 hours | 2 hours | 6-8 hours |
| `map()` function | 2-3 hours | 3-4 hours | 2 hours | 7-9 hours |
| Module variable resolution | 4-6 hours | 2-3 hours | 3 hours | 9-12 hours |
| Lambda as value | 2-3 hours | 2-3 hours | 2 hours | 6-8 hours |

**Total estimated**: 28-37 hours of development work

## Files to Modify

1. `exporter/analyzer/ast_visitors.py` - Add handling for tuple unpacking, map(), lambda
2. `frontend/modules/shared/ruleEngine.js` - Add cases for new rule types
3. `frontend/schema/rules.schema.json` - Add schema definitions for new types
4. `CC/rule-types-reference.md` - Document new rule types
5. `exporter/games/mm2.py` - Remove from blacklist once supported

## Next Steps

1. Decide on approach (implement rule types vs keep manual implementation)
2. If implementing: Start with tuple unpacking as it's the most common pattern
3. Add comprehensive tests for each new rule type
4. Update documentation
