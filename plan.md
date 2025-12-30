# Refactoring Plan: `exporter/analyzer/ast_visitors.py`

## Current State

The file `exporter/analyzer/ast_visitors.py` contains a single class `ASTVisitorMixin` with approximately **4000 lines** and **50+ methods**. This makes it difficult to navigate, maintain, and understand.

## Analysis

The methods can be logically grouped into 10 categories:

| Category | Line Range | Lines | Methods |
|----------|------------|-------|---------|
| Helper Registration | 35-100 | ~65 | `_register_helper_usage`, `_detect_and_register_param_mappings`, `_make_helper_rule` |
| Structure Visitors | 101-320 | ~220 | `visit_Module`, `visit_FunctionDef`, `visit_Lambda`, `visit_Return`, `visit_Break`, `visit_Continue`, `_needs_block_mode` |
| **Call Handling** | 320-1696 | **~1376** | `visit_Call` (massive single method) |
| Pattern Detection | 1697-2031 | ~335 | `_is_world_player_subscript`, `_is_world_attribute_chain`, `_is_world_options_pattern`, etc. |
| Expression Visitors | 2032-2721 | ~690 | `visit_Attribute`, `visit_Name`, `visit_Expr`, `visit_Constant`, `visit_JoinedStr`, `visit_FormattedValue`, `visit_Subscript`, `visit_BoolOp` |
| Operator Visitors | 2722-2890 | ~170 | `visit_UnaryOp`, `visit_Compare`, `_try_fold_comparison` |
| Data Structure Visitors | 2891-2995 | ~105 | `visit_Tuple`, `visit_List`, `visit_Set`, `visit_Dict` |
| Comprehension Visitors | 2996-3180 | ~185 | `visit_GeneratorExp`, `visit_ListComp`, `visit_comprehension`, `generic_visit` |
| Control Flow Visitors | 3180-3820 | ~640 | `visit_Assign`, `visit_If`, `visit_IfExp`, `visit_BinOp`, `visit_For`, `visit_While`, `visit_AugAssign`, `visit_statement`, etc. |
| Generator Utilities | 3820-3967 | ~147 | `_convert_generator_exp_to_all_of`, `_convert_generator_exp_to_any_of`, `_substitute_variable_in_rule` |

## Proposed Structure

Convert to a package: `exporter/analyzer/ast_visitors/`

```
exporter/analyzer/ast_visitors/
├── __init__.py           # Aggregates all mixins into final ASTVisitorMixin
├── base.py               # Base class, imports, helper registration
├── call_visitor.py       # visit_Call (needs internal refactoring too)
├── pattern_detection.py  # All _is_* pattern detection methods
├── expression_visitors.py
├── operator_visitors.py
├── data_structure_visitors.py
├── comprehension_visitors.py
└── control_flow_visitors.py
```

## Detailed File Breakdown

### 1. `ast_visitors/base.py` (~100 lines)
Core infrastructure and helper methods.

```python
class BaseVisitorMixin:
    """Base mixin with core infrastructure."""

    def _register_helper_usage(...)
    def _detect_and_register_param_mappings(...)
    def _make_helper_rule(...)
```

### 2. `ast_visitors/pattern_detection.py` (~350 lines)
Pattern detection helpers used by multiple visitors.

```python
class PatternDetectionMixin:
    """Mixin for detecting common AST patterns."""

    def _is_world_player_subscript(...)
    def _is_world_attribute_chain(...)
    def _is_world_options_pattern(...)
    def _is_world_attribute_subscript_pattern(...)
    def _is_prog_items_pattern(...)
    def _is_multiworld_get_region_call(...)
    def _is_region_parameter_attribute(...)
```

### 3. `ast_visitors/expression_visitors.py` (~700 lines)
Expression-level AST visitors.

```python
class ExpressionVisitorMixin:
    """Mixin for expression node visitors."""

    def visit_Attribute(...)
    def visit_Name(...)
    def visit_Expr(...)
    def visit_Constant(...)
    def visit_JoinedStr(...)
    def visit_FormattedValue(...)
    def visit_Subscript(...)
    def visit_BoolOp(...)
```

### 4. `ast_visitors/operator_visitors.py` (~200 lines)
Operators and comparisons.

```python
class OperatorVisitorMixin:
    """Mixin for operator visitors."""

    def visit_UnaryOp(...)
    def visit_Compare(...)
    def visit_BinOp(...)
    def _try_fold_comparison(...)
```

### 5. `ast_visitors/data_structure_visitors.py` (~120 lines)
Data structure literals.

```python
class DataStructureVisitorMixin:
    """Mixin for data structure visitors."""

    def visit_Tuple(...)
    def visit_List(...)
    def visit_Set(...)
    def visit_Dict(...)
```

### 6. `ast_visitors/comprehension_visitors.py` (~350 lines)
Comprehensions, generators, and related utilities.

```python
class ComprehensionVisitorMixin:
    """Mixin for comprehension and generator visitors."""

    def visit_GeneratorExp(...)
    def visit_ListComp(...)
    def visit_comprehension(...)
    def _convert_generator_exp_to_all_of(...)
    def _convert_generator_exp_to_any_of(...)
    def _substitute_variable_in_rule(...)
```

### 7. `ast_visitors/control_flow_visitors.py` (~700 lines)
Control flow and statement handling.

```python
class ControlFlowVisitorMixin:
    """Mixin for control flow and statement visitors."""

    def visit_Module(...)
    def visit_FunctionDef(...)
    def visit_Lambda(...)
    def visit_Return(...)
    def visit_Break(...)
    def visit_Continue(...)
    def visit_Assign(...)
    def visit_If(...)
    def visit_IfExp(...)
    def visit_For(...)
    def visit_While(...)
    def visit_AugAssign(...)
    def visit_statement(...)
    def _visit_If_statement(...)
    def _try_convert_if_to_assign(...)
    def _needs_block_mode(...)
    def generic_visit(...)
```

### 8. `ast_visitors/call_visitor.py` (~1400 lines)
The `visit_Call` method. This is the largest and may need further internal refactoring.

**Internal refactoring suggestions for `visit_Call`:**
- Extract helper call handling into `_handle_helper_call()`
- Extract method call handling into `_handle_method_call()`
- Extract built-in function handling into `_handle_builtin_call()`
- Extract recursive analysis logic into `_handle_recursive_analysis()`

```python
class CallVisitorMixin:
    """Mixin for function call handling."""

    def visit_Call(...)
    def _handle_helper_call(...)
    def _handle_method_call(...)
    def _handle_builtin_call(...)
    def _handle_recursive_analysis(...)
    def _filter_special_args(...)  # if not already elsewhere
```

### 9. `ast_visitors/__init__.py`
Aggregates all mixins into the final class.

```python
from .base import BaseVisitorMixin
from .pattern_detection import PatternDetectionMixin
from .expression_visitors import ExpressionVisitorMixin
from .operator_visitors import OperatorVisitorMixin
from .data_structure_visitors import DataStructureVisitorMixin
from .comprehension_visitors import ComprehensionVisitorMixin
from .control_flow_visitors import ControlFlowVisitorMixin
from .call_visitor import CallVisitorMixin

class ASTVisitorMixin(
    BaseVisitorMixin,
    PatternDetectionMixin,
    ExpressionVisitorMixin,
    OperatorVisitorMixin,
    DataStructureVisitorMixin,
    ComprehensionVisitorMixin,
    ControlFlowVisitorMixin,
    CallVisitorMixin
):
    """
    Complete AST visitor mixin combining all visitor types.

    This class is designed to be mixed into RuleAnalyzer and provides
    all the visitor methods for handling different AST node types.
    """
    pass
```

## Implementation Steps

1. **Create the package directory**: `mkdir exporter/analyzer/ast_visitors`

2. **Create `base.py`**: Extract helper registration methods and imports

3. **Create `pattern_detection.py`**: Extract all `_is_*` pattern detection methods

4. **Create `expression_visitors.py`**: Extract expression visitors (`visit_Attribute`, `visit_Name`, etc.)

5. **Create `operator_visitors.py`**: Extract operator visitors

6. **Create `data_structure_visitors.py`**: Extract data structure visitors

7. **Create `comprehension_visitors.py`**: Extract comprehension/generator visitors

8. **Create `control_flow_visitors.py`**: Extract control flow/statement visitors

9. **Create `call_visitor.py`**: Extract `visit_Call` (largest, may need further internal restructuring)

10. **Create `__init__.py`**: Aggregate all mixins

11. **Update imports**: Update `exporter/analyzer/rule_analyzer.py` to import from the new package

12. **Remove old file**: Delete `exporter/analyzer/ast_visitors.py`

13. **Test**: Run tests to ensure no regressions

## Mixin Order Considerations

The order of mixin inheritance matters for method resolution. The recommended order (right-to-left in Python MRO):

1. `BaseVisitorMixin` - Base infrastructure (leftmost = highest priority for shared methods)
2. `PatternDetectionMixin` - Used by other mixins
3. `ExpressionVisitorMixin` - Lower-level visitors
4. `OperatorVisitorMixin`
5. `DataStructureVisitorMixin`
6. `ComprehensionVisitorMixin`
7. `ControlFlowVisitorMixin`
8. `CallVisitorMixin` - Complex, uses other mixins' methods

## Backward Compatibility

The refactoring maintains the same public interface (`ASTVisitorMixin` class with all `visit_*` methods). Any code importing `from .ast_visitors import ASTVisitorMixin` will continue to work unchanged after updating to import from the package's `__init__.py`.

## Future Improvements

After this initial split, consider:

1. **Breaking down `visit_Call`**: The 1400-line method should be split into smaller helper methods
2. **Type hints**: Add proper type hints throughout
3. **Documentation**: Add docstrings for each mixin class describing its responsibility
4. **Testing**: Add unit tests for individual visitor methods
