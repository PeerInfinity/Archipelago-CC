# Rule Builder: Arithmetic Rules Implementation Plan

## Overview

This document outlines the plan to add arithmetic operation support to Rule Builder, enabling expressions like `CountItem("Puppy") * 3` to be properly evaluated in access rules.

## Current State

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

### Current Workaround

The world generator (`rule_codegen.py`) has a specific pattern handler that converts `count * constant >= value` to `Has(item, ceil(value/constant))`. This works for simple cases but:

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

## Implementation Plan

### Phase 1: Core Arithmetic Class

**File**: `rule_builder/rules.py`

Add the `Arithmetic` class with:

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

        @override
        def item_dependencies(self) -> dict[str, set[int]]:
            deps: dict[str, set[int]] = {}
            if isinstance(self.left, Rule.Resolved):
                for name, ids in self.left.item_dependencies().items():
                    deps.setdefault(name, set()).update(ids)
            if isinstance(self.right, Rule.Resolved):
                for name, ids in self.right.item_dependencies().items():
                    deps.setdefault(name, set()).update(ids)
            return deps

        @override
        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            messages: list[JSONMessagePart] = [{"type": "text", "text": "("}]

            if isinstance(self.left, Rule.Resolved):
                messages.extend(self.left.explain_json(state))
            else:
                messages.append({"type": "text", "text": str(self.left)})

            messages.append({"type": "text", "text": f" {self.op} "})

            if isinstance(self.right, Rule.Resolved):
                messages.extend(self.right.explain_json(state))
            else:
                messages.append({"type": "text", "text": str(self.right)})

            messages.append({"type": "text", "text": ")"})

            if state is not None:
                value = self.get_value(state)
                messages.append({"type": "text", "text": f" = {value}"})

            return messages

        @override
        def explain_str(self, state: CollectionState | None = None) -> str:
            left_str = self.left.explain_str(state) if isinstance(self.left, Rule.Resolved) else str(self.left)
            right_str = self.right.explain_str(state) if isinstance(self.right, Rule.Resolved) else str(self.right)
            result = f"({left_str} {self.op} {right_str})"
            if state is not None:
                result += f" = {self.get_value(state)}"
            return result

        @override
        def __str__(self) -> str:
            return f"({self.left} {self.op} {self.right})"

        @override
        def _get_args_dict(self) -> dict[str, Any]:
            return {"left": self.left, "op": self.op, "right": self.right}
```

### Phase 2: Update Compare._get_value

**File**: `rule_builder/rules.py`

Update `Compare.Resolved._get_value` to check for `get_value` first:

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

### Phase 3: CC Format Parser

**File**: `rule_builder/cc_format.py`

Add handler for `binary_op` type:

```python
# In parse_cc_rule():
elif rule_type == 'binary_op':
    return _parse_binary_op(data, world_cls)

def _parse_binary_op(data: Mapping[str, Any], world_cls: type["RuleWorldMixin"]) -> "Rule[Any]":
    """
    Parse a binary_op rule (arithmetic expression).

    CC Format:
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


def _parse_arithmetic_operand(operand: Any, world_cls: type["RuleWorldMixin"]) -> Any:
    """Parse an arithmetic operand into a value or Rule."""
    from rule_builder.rules import CountItem, Arithmetic

    if not isinstance(operand, dict):
        return operand

    op_type = operand.get('type')

    if op_type == 'constant':
        return operand.get('value', 0)

    if op_type == 'state_method':
        method = operand.get('method', '')
        args = operand.get('args', [])

        if method == 'count':
            if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                item_name = args[0].get('value', '')
                return CountItem(item_name=item_name)

        if method == 'count_group_unique':
            from rule_builder.rules import CountGroupUnique
            if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                group_name = args[0].get('value', '')
                return CountGroupUnique(item_name_group=group_name)

    if op_type == 'binary_op':
        return _parse_binary_op(operand, world_cls)

    # For other types, try parsing as a rule
    try:
        return parse_cc_rule(operand, world_cls)
    except (ValueError, KeyError):
        return 0  # Default to 0 for unknown operands
```

### Phase 4: Update World Generator Codegen

**File**: `world_generator/rule_codegen.py`

Replace the specific pattern handler with general Arithmetic generation:

```python
def _convert_compare_operand(self, operand: Any) -> str:
    """Convert a compare operand to Python code."""
    if not isinstance(operand, dict):
        return repr(operand)

    op_type = operand.get('type', '')

    if op_type == 'constant':
        return repr(operand.get('value'))

    if op_type == 'state_method':
        method = operand.get('method', '')
        args = operand.get('args', [])

        if method == 'count':
            if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                item_name = args[0].get('value', '')
                self.required_imports.add('CountItem')
                item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
                return f'CountItem("{item_escaped}")'

    if op_type == 'binary_op':
        return self._convert_binary_op(operand)

    # For other types, try to convert as a rule
    return self._convert_rule(operand)


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


def _convert_arithmetic_operand(self, operand: Any) -> str:
    """Convert an arithmetic operand to Python code."""
    if not isinstance(operand, dict):
        return repr(operand)

    op_type = operand.get('type', '')

    if op_type == 'constant':
        return repr(operand.get('value'))

    if op_type == 'state_method':
        method = operand.get('method', '')
        args = operand.get('args', [])

        if method == 'count':
            if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                item_name = args[0].get('value', '')
                self.required_imports.add('CountItem')
                item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
                return f'CountItem("{item_escaped}")'

    if op_type == 'binary_op':
        return self._convert_binary_op(operand)

    # Fall back to converting as a rule
    return self._convert_rule(operand)
```

Remove the `_try_convert_binary_op_compare` method and its call in `_convert_compare`.

### Phase 5: Export Module Updates

**File**: `rule_builder/__init__.py`

Add `Arithmetic` to exports:

```python
from rule_builder.rules import (
    # ... existing exports ...
    Arithmetic,
)
```

### Phase 6: Optional - CountGroupUnique

If needed for BRC patterns, add a `CountGroupUnique` rule:

```python
@dataclasses.dataclass()
class CountGroupUnique(Rule[TWorld], game="Archipelago"):
    """Returns the count of unique items in a group."""
    item_name_group: str = ""

    class Resolved(Rule.Resolved):
        item_name_group: str
        skip_cache: ClassVar[bool] = True

        def get_count(self, state: CollectionState) -> int:
            return state.count_group_unique(self.item_name_group, self.player)

        get_value = get_count
```

## Testing Strategy

### Unit Tests

1. Basic arithmetic operations with constants
2. Arithmetic with `CountItem` operands
3. Nested arithmetic expressions
4. Division by zero handling
5. Use in `Compare` expressions
6. `item_dependencies()` propagation
7. `explain_json()` and `explain_str()` output

### Integration Tests

1. KH1 puppy rules evaluate correctly
2. Generated worldgen code compiles and runs
3. Spoiler tests pass for affected games

### Example Test Cases

```python
def test_arithmetic_multiply_constant():
    rule = Arithmetic(5, "*", 3)
    resolved = rule._instantiate(world)
    assert resolved.get_value(state) == 15

def test_arithmetic_with_count_item():
    rule = Arithmetic(CountItem("Puppy"), "*", 3)
    resolved = rule._instantiate(world)
    # With 4 puppies collected
    assert resolved.get_value(state) == 12

def test_arithmetic_in_compare():
    rule = Compare(Arithmetic(CountItem("Puppy"), "*", 3), ">=", 10)
    resolved = rule._instantiate(world)
    # With 4 puppies: 4 * 3 = 12 >= 10 -> True
    assert resolved(state) == True

def test_nested_arithmetic():
    # 30 + (count * 5)
    rule = Arithmetic(30, "+", Arithmetic(CountItem("Arrow +5"), "*", 5))
    resolved = rule._instantiate(world)
    # With 2 upgrades: 30 + (2 * 5) = 40
    assert resolved.get_value(state) == 40

def test_division_by_zero():
    rule = Arithmetic(10, "/", 0)
    resolved = rule._instantiate(world)
    assert resolved.get_value(state) == 0  # Safe fallback
```

## Migration Notes

### Backwards Compatibility

- Existing rules using `Compare(CountItem(...), ">=", N)` continue to work
- The specific pattern handler in `rule_codegen.py` can be removed
- Generated code will use `Arithmetic` instead of `Has` for scaled counts

### Breaking Changes

None expected. The new `Arithmetic` class is additive.

## Files Summary

| File | Action | Lines (est.) |
|------|--------|--------------|
| `rule_builder/rules.py` | Add `Arithmetic` class | ~100 |
| `rule_builder/rules.py` | Update `Compare._get_value` | ~5 |
| `rule_builder/cc_format.py` | Add `_parse_binary_op` | ~50 |
| `rule_builder/__init__.py` | Export `Arithmetic` | ~1 |
| `world_generator/rule_codegen.py` | Add `_convert_binary_op`, remove old handler | ~40 |
| Tests | New test file | ~100 |

**Total estimated new/modified code**: ~300 lines
