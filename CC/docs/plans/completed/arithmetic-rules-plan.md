# Rule Builder: Arithmetic Rules Implementation Plan

**Status: Completed**

## Implementation Summary

This feature has been implemented. The `Arithmetic` class enables expressions like `Compare(Arithmetic(CountItem("Puppy"), "*", 3), ">=", 10)` to be properly evaluated in access rules.

### What Was Implemented

| Phase | Status | Location |
|-------|--------|----------|
| Phase 1: Core Arithmetic Class | Done | `rule_builder/rules.py:2601` |
| Phase 2: Update Compare._get_value | Done | `rule_builder/rules.py:2481` |
| Phase 3: AST Format Parser | Done | `rule_builder/ast_format.py:589` (`_parse_binary_op`) |
| Phase 4: World Generator Codegen | Done | `world_generator/rule_codegen.py` (`_convert_binary_op`) |
| Phase 5: Export Module Updates | Done | `rule_builder/__init__.py:67` |
| Phase 6: CountGroupUnique | Skipped | Handled via `HasGroupUnique` instead |

### Not Implemented

- **Unit tests**: No dedicated unit tests were created for the `Arithmetic` class
- **CountGroupUnique**: Instead of a separate class, `count_group_unique` is handled by returning `HasGroupUnique` in `_parse_arithmetic_operand`

---

## Original Plan

### Overview

This document outlines the plan to add arithmetic operation support to Rule Builder, enabling expressions like `CountItem("Puppy") * 3` to be properly evaluated in access rules.

### The Problem

Rule Builder can express item counts via `CountItem` and comparisons via `Compare`:

```python
# This works
Compare(CountItem("Key"), ">=", 3)  # Has at least 3 keys
```

However, there's no way to express arithmetic operations on counts:

```python
# This doesn't exist yet
Compare(CountItem("Puppy") * 3, ">=", 10)  # Each Puppy item worth 3 puppies
```

### Real-World Examples

**KH1 Puppies** (`worlds/kh1/Rules.py`):
```python
def has_puppies(state, player, puppies_required, puppy_value):
    return (state.count("Puppy", player) * puppy_value) >= puppies_required
```

**Bomb Rush Cyberfunk** (graffiti spots):
```python
count_group_unique("graffitil") * 6 >= spots
```

**ALTTP** (arrow capacity):
```python
30 + (state.count("Arrow Upgrade (+5)") * 5) + (state.count("Arrow Upgrade (+10)") * 10)
```

### Original Workaround

The world generator (`rule_codegen.py`) had a specific pattern handler that converts `count * constant >= value` to `Has(item, ceil(value/constant))`. This worked for simple cases but:

1. Only handles multiplication with constants
2. Doesn't handle addition, subtraction, or complex expressions
3. Falls back to `True_()` for anything more complex

### Operators Found in Existing Rules

| Operator | Count | Description |
|----------|-------|-------------|
| `+` | 573 | Addition |
| `*` | 398 | Multiplication |
| `/` | 259 | Division |
| `//` | 118 | Floor division |
| `-` | 46 | Subtraction |
| `**` | 11 | Power |
| `%` | 1 | Modulo |

## Design

### Single `Arithmetic` Class

Following the pattern established by `Compare`, use a single class with an operator parameter:

```python
@dataclasses.dataclass()
class Arithmetic(Rule[TWorld], game="Archipelago"):
    """
    Arithmetic operation between two numeric values/rules.

    Supports operators: +, -, *, /, //, %, **

    Usage:
        # Puppy value calculation
        rule = Compare(Arithmetic(CountItem("Puppy"), "*", 3), ">=", 10)

        # Arrow capacity calculation
        capacity = Arithmetic(
            Arithmetic(30, "+", Arithmetic(CountItem("Arrow +5"), "*", 5)),
            "+",
            Arithmetic(CountItem("Arrow +10"), "*", 10)
        )
    """
    left: "Rule[TWorld] | int | float" = 0
    op: str = "+"
    right: "Rule[TWorld] | int | float" = 0
```

### Key Design Decisions

1. **Operands can be Rules or primitives** - mirrors `Compare` pattern
2. **`get_value()` method returns numeric result** - enables nesting and use in `Compare`
3. **Alias `get_count = get_value`** - for compatibility with existing `Compare._get_value()`
4. **Skip caching** - arithmetic results depend on state, like `CountItem`

## Implementation Details

### Phase 1: Core Arithmetic Class

**File**: `rule_builder/rules.py`

The `Arithmetic` class was added with:

```python
@dataclasses.dataclass()
class Arithmetic(Rule[TWorld], game="Archipelago"):
    """
    Arithmetic operation between two numeric values/rules.

    Supports operators: +, -, *, /, //, %, **
    """
    left: "Rule[TWorld] | int | float" = dataclasses.field(default=0)
    op: str = "+"
    right: "Rule[TWorld] | int | float" = dataclasses.field(default=0)

    @override
    def _instantiate(self, world: TWorld) -> Rule.Resolved:
        resolved_left: Any
        resolved_right: Any

        if isinstance(self.left, Rule):
            resolved_left = self.left._instantiate(world)
        else:
            resolved_left = self.left

        if isinstance(self.right, Rule):
            resolved_right = self.right._instantiate(world)
        else:
            resolved_right = self.right

        return self.Resolved(
            resolved_left,
            self.op,
            resolved_right,
            player=world.player,
            caching_enabled=False,
        )

    @override
    def __str__(self) -> str:
        return f"({self.left} {self.op} {self.right})"

    class Resolved(Rule.Resolved):
        left: Any  # Rule.Resolved or literal value
        op: str
        right: Any  # Rule.Resolved or literal value
        skip_cache: ClassVar[bool] = True

        def _get_operand_value(self, operand: Any, state: CollectionState) -> float | int:
            """Get the numeric value of an operand."""
            if isinstance(operand, Rule.Resolved):
                if hasattr(operand, 'get_value'):
                    return operand.get_value(state)
                if hasattr(operand, 'get_count'):
                    return operand.get_count(state)
                # Boolean rules: True=1, False=0
                return 1 if operand(state) else 0
            return operand

        def get_value(self, state: CollectionState) -> float | int:
            """Get the computed value of this arithmetic expression."""
            left_val = self._get_operand_value(self.left, state)
            right_val = self._get_operand_value(self.right, state)

            if self.op == '+':
                return left_val + right_val
            elif self.op == '-':
                return left_val - right_val
            elif self.op == '*':
                return left_val * right_val
            elif self.op == '/':
                return left_val / right_val if right_val != 0 else 0
            elif self.op == '//':
                return left_val // right_val if right_val != 0 else 0
            elif self.op == '%':
                return left_val % right_val if right_val != 0 else 0
            elif self.op == '**':
                return left_val ** right_val
            else:
                return left_val + right_val  # Default to addition

        # Alias for Compare compatibility
        get_count = get_value

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            # When used as boolean, true if value is truthy (non-zero)
            return bool(self.get_value(state))
```

### Phase 2: Update Compare._get_value

**File**: `rule_builder/rules.py`

`Compare.Resolved._get_value` was updated to check for `get_value` first:

```python
def _get_value(self, operand: Any, state: CollectionState) -> Any:
    """Get the value of an operand."""
    if isinstance(operand, Rule.Resolved):
        # Check for get_value (Arithmetic) first, then get_count (CountItem)
        if hasattr(operand, 'get_value'):
            return operand.get_value(state)
        if hasattr(operand, 'get_count'):
            return operand.get_count(state)
        # Otherwise evaluate as boolean
        return operand(state)
    return operand
```

### Phase 3: AST Format Parser

**File**: `rule_builder/ast_format.py`

Handler added for `binary_op` type:

```python
# In parse_ast_rule():
elif rule_type == 'binary_op' or rule_type == 'binop':
    return _parse_binary_op(data, world_cls)

def _parse_binary_op(data: Mapping[str, Any], world_cls: type["RuleWorldMixin"]) -> "Rule[Any]":
    """
    Parse a binary_op rule (arithmetic expression).

    AST Format:
        {"type": "binary_op", "left": {...}, "op": "*", "right": {...}}
    """
    from rule_builder.rules import Arithmetic

    left_data = data.get('left', {})
    op = data.get('op', '+')
    right_data = data.get('right', {})

    # Normalize operator names from Python AST
    op_map = {
        'Add': '+', 'Sub': '-', 'Mult': '*', 'Div': '/',
        'FloorDiv': '//', 'Mod': '%', 'Pow': '**',
    }
    op = op_map.get(op, op)

    left = _parse_arithmetic_operand(left_data, world_cls)
    right = _parse_arithmetic_operand(right_data, world_cls)

    return Arithmetic(left=left, op=op, right=right)
```

### Phase 4: World Generator Codegen

**File**: `world_generator/rule_codegen.py`

The `_convert_binary_op` method generates `Arithmetic` rules:

```python
def _convert_binary_op(self, operand: Dict[str, Any]) -> str:
    """Convert a binary_op to Arithmetic rule."""
    self.required_imports.add('Arithmetic')

    left = operand.get('left', {})
    op = operand.get('op', '+')
    right = operand.get('right', {})

    # Normalize operator names
    op_map = {
        'Add': '+', 'Sub': '-', 'Mult': '*', 'Div': '/',
        'FloorDiv': '//', 'Mod': '%', 'Pow': '**',
    }
    op = op_map.get(op, op)

    left_code = self._convert_arithmetic_operand(left)
    right_code = self._convert_arithmetic_operand(right)

    return f'Arithmetic({left_code}, "{op}", {right_code})'
```

### Phase 5: Export Module Updates

**File**: `rule_builder/__init__.py`

`Arithmetic` added to exports.

### Phase 6: CountGroupUnique (Skipped)

Instead of implementing a separate `CountGroupUnique` class, `count_group_unique` calls are handled by returning `HasGroupUnique` in the `_parse_arithmetic_operand` function in `ast_format.py`.

## Testing Strategy

### Unit Tests (Not Implemented)

The following unit tests were planned but not implemented:

1. Basic arithmetic operations with constants
2. Arithmetic with `CountItem` operands
3. Nested arithmetic expressions
4. Division by zero handling
5. Use in `Compare` expressions
6. `item_dependencies()` propagation
7. `explain_json()` and `explain_str()` output

### Integration Tests

The feature is exercised through integration tests:

1. Generated worldgen code compiles and runs
2. Spoiler tests pass for affected games

## Files Summary

| File | Action | Status |
|------|--------|--------|
| `rule_builder/rules.py` | Add `Arithmetic` class | Done |
| `rule_builder/rules.py` | Update `Compare._get_value` | Done |
| `rule_builder/ast_format.py` | Add `_parse_binary_op` | Done |
| `rule_builder/__init__.py` | Export `Arithmetic` | Done |
| `world_generator/rule_codegen.py` | Add `_convert_binary_op` | Done |
| Tests | New test file | Not done |
