"""
CC Format Rule Explanation Functions.

This module provides functions to generate human-readable explanations
for CC format rules. These explanations are used by the Rule Builder's
explain_json() method when handling CC format rules that can't be
converted to native Rule Builder classes.

The explain functions return JSONMessagePart lists compatible with
Archipelago's printJSON system.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from BaseClasses import CollectionState

# Type alias for JSONMessagePart
JSONMessagePart = dict[str, Any]


def explain_cc_rule(
    rule: dict,
    state: "CollectionState | None",
    player: int,
    depth: int = 0
) -> list[JSONMessagePart]:
    """
    Generate explain output for any CC format rule.

    Args:
        rule: CC format rule dict
        state: Current collection state (or None for static explanation)
        player: Player ID
        depth: Recursion depth (for cycle prevention)

    Returns:
        List of JSONMessagePart dicts for display
    """
    if depth > 50:
        return [{"type": "text", "text": "[max depth]"}]

    if not isinstance(rule, dict):
        return [{"type": "text", "text": str(rule)}]

    rule_type = rule.get('type', '')

    # Dispatch to specific handlers
    handlers = {
        'constant': _explain_constant,
        'item_check': _explain_item_check,
        'count_check': _explain_count_check,
        'group_check': _explain_group_check,
        'and': _explain_and,
        'or': _explain_or,
        'not': _explain_not,
        'compare': _explain_compare,
        'comparison': _explain_compare,
        'conditional': _explain_conditional,
        'helper': _explain_helper,
        'state_method': _explain_state_method,
        'setting_value': _explain_setting_value,
        'can_reach': _explain_can_reach,
        'region_check': _explain_region_check,
        'location_check': _explain_location_check,
        'can_reach_entrance': _explain_can_reach_entrance,
        'binary_op': _explain_binary_op,
        'sum': _explain_sum,
        'min': _explain_min,
        'max': _explain_max,
        'attribute': _explain_attribute,
        'subscript': _explain_subscript,
        'name': _explain_name,
        'function_call': _explain_function_call,
        'block': _explain_block,
        'return': _explain_return,
    }

    handler = handlers.get(rule_type)
    if handler:
        return handler(rule, state, player, depth)

    # Fallback for unknown types
    return [{"type": "text", "text": f"[{rule_type or 'unknown'}]"}]


def _extract_value(value: Any) -> Any:
    """Extract value from potential constant wrapper."""
    if isinstance(value, dict) and value.get('type') == 'constant':
        return value.get('value')
    return value


def _explain_constant(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a constant rule."""
    value = rule.get('value')
    if value is True:
        return [{"type": "color", "color": "green", "text": "True"}]
    elif value is False:
        return [{"type": "color", "color": "salmon", "text": "False"}]
    else:
        return [{"type": "text", "text": str(value)}]


def _explain_item_check(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain an item_check rule."""
    item = _extract_value(rule.get('item', ''))
    count = _extract_value(rule.get('count', 1))

    if state is not None:
        has_count = state.count(item, player)
        has_enough = has_count >= count
        color = "green" if has_enough else "salmon"
        prefix = "Has" if has_enough else "Missing"

        if count == 1:
            return [
                {"type": "text", "text": f"{prefix} "},
                {"type": "color", "color": color, "text": item},
            ]
        else:
            return [
                {"type": "text", "text": f"{prefix} "},
                {"type": "color", "color": color, "text": f"{item} ({has_count}/{count})"},
            ]
    else:
        if count == 1:
            return [{"type": "text", "text": f"Has {item}"}]
        else:
            return [{"type": "text", "text": f"Has {item} x{count}"}]


def _explain_count_check(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a count_check rule (same as item_check)."""
    return _explain_item_check(rule, state, player, depth)


def _explain_group_check(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a group_check rule."""
    group = _extract_value(rule.get('group', ''))
    count = _extract_value(rule.get('count', 1))

    return [{"type": "text", "text": f"Has {count} from group '{group}'"}]


def _explain_and(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain an AND rule."""
    conditions = rule.get('conditions', [])
    if not conditions:
        return [{"type": "color", "color": "green", "text": "True"}]

    messages: list[JSONMessagePart] = [{"type": "text", "text": "("}]
    for i, cond in enumerate(conditions):
        if i > 0:
            messages.append({"type": "text", "text": " & "})
        messages.extend(explain_cc_rule(cond, state, player, depth + 1))
    messages.append({"type": "text", "text": ")"})
    return messages


def _explain_or(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain an OR rule."""
    conditions = rule.get('conditions', [])
    if not conditions:
        return [{"type": "color", "color": "salmon", "text": "False"}]

    messages: list[JSONMessagePart] = [{"type": "text", "text": "("}]
    for i, cond in enumerate(conditions):
        if i > 0:
            messages.append({"type": "text", "text": " | "})
        messages.extend(explain_cc_rule(cond, state, player, depth + 1))
    messages.append({"type": "text", "text": ")"})
    return messages


def _explain_not(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a NOT rule."""
    condition = rule.get('condition') or rule.get('operand', {})
    messages: list[JSONMessagePart] = [{"type": "text", "text": "NOT ("}]
    messages.extend(explain_cc_rule(condition, state, player, depth + 1))
    messages.append({"type": "text", "text": ")"})
    return messages


def _explain_compare(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a compare/comparison rule."""
    left = rule.get('left', {})
    op = rule.get('op', '==')
    right = rule.get('right', {})

    messages: list[JSONMessagePart] = []
    messages.extend(explain_cc_rule(left, state, player, depth + 1))
    messages.append({"type": "text", "text": f" {op} "})
    messages.extend(explain_cc_rule(right, state, player, depth + 1))
    return messages


def _explain_conditional(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a conditional (ternary) rule."""
    test = rule.get('test', {})
    if_true = rule.get('if_true', {})
    if_false = rule.get('if_false', {})

    messages: list[JSONMessagePart] = [{"type": "text", "text": "If ("}]
    messages.extend(explain_cc_rule(test, state, player, depth + 1))
    messages.append({"type": "text", "text": ") then ("})
    messages.extend(explain_cc_rule(if_true, state, player, depth + 1))
    messages.append({"type": "text", "text": ") else ("})
    messages.extend(explain_cc_rule(if_false, state, player, depth + 1))
    messages.append({"type": "text", "text": ")"})
    return messages


def _explain_helper(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a helper function call."""
    helper_name = rule.get('name', 'unknown')
    args = rule.get('args', [])

    messages: list[JSONMessagePart] = [
        {"type": "text", "text": "Helper: "},
        {"type": "color", "color": "magenta", "text": helper_name},
    ]

    if args:
        messages.append({"type": "text", "text": "("})
        for i, arg in enumerate(args):
            if i > 0:
                messages.append({"type": "text", "text": ", "})
            if isinstance(arg, dict):
                messages.extend(explain_cc_rule(arg, state, player, depth + 1))
            else:
                messages.append({"type": "text", "text": str(arg)})
        messages.append({"type": "text", "text": ")"})

    return messages


def _explain_state_method(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a state method call."""
    method = rule.get('method', '')
    args = rule.get('args', [])

    # Handle common state methods
    if method == 'has':
        item = _extract_value(args[0]) if args else ''
        count = _extract_value(args[1]) if len(args) > 1 else 1
        return _explain_item_check({'item': item, 'count': count}, state, player, depth)

    elif method == 'has_all':
        items = _extract_value(args[0]) if args else []
        if isinstance(items, list):
            return [{"type": "text", "text": f"Has all of: {', '.join(items)}"}]

    elif method == 'has_any':
        items = _extract_value(args[0]) if args else []
        if isinstance(items, list):
            return [{"type": "text", "text": f"Has any of: {', '.join(items)}"}]

    elif method == 'count':
        item = _extract_value(args[0]) if args else ''
        if state is not None:
            count = state.count(item, player)
            return [{"type": "text", "text": f"Count({item}): {count}"}]
        return [{"type": "text", "text": f"Count({item})"}]

    elif method == 'can_reach' or method == 'can_reach_region':
        region = _extract_value(args[0]) if args else ''
        return [{"type": "text", "text": f"Can reach region: {region}"}]

    # Generic state method display
    args_str = ', '.join(str(_extract_value(a)) for a in args)
    return [{"type": "text", "text": f"state.{method}({args_str})"}]


def _explain_setting_value(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a setting_value rule."""
    setting = rule.get('setting', '')
    return [
        {"type": "text", "text": "Setting: "},
        {"type": "color", "color": "cyan", "text": setting},
    ]


def _explain_can_reach(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a can_reach rule."""
    region = rule.get('region', '')
    return [{"type": "text", "text": f"Can reach region: {region}"}]


def _explain_region_check(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a region_check rule."""
    region = rule.get('region', '')
    return [{"type": "text", "text": f"Region accessible: {region}"}]


def _explain_location_check(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a location_check rule."""
    location = rule.get('location', '')
    return [{"type": "text", "text": f"Can reach location: {location}"}]


def _explain_can_reach_entrance(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a can_reach_entrance rule."""
    entrance = rule.get('entrance', '')
    return [{"type": "text", "text": f"Can reach entrance: {entrance}"}]


def _explain_binary_op(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a binary operation."""
    left = rule.get('left', {})
    op = rule.get('op', '+')
    right = rule.get('right', {})

    messages: list[JSONMessagePart] = [{"type": "text", "text": "("}]
    messages.extend(explain_cc_rule(left, state, player, depth + 1))
    messages.append({"type": "text", "text": f" {op} "})
    messages.extend(explain_cc_rule(right, state, player, depth + 1))
    messages.append({"type": "text", "text": ")"})
    return messages


def _explain_sum(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a sum rule."""
    args = rule.get('args', [])
    if args:
        messages: list[JSONMessagePart] = [{"type": "text", "text": "sum("}]
        messages.extend(explain_cc_rule(args[0], state, player, depth + 1))
        messages.append({"type": "text", "text": ")"})
        return messages
    return [{"type": "text", "text": "sum()"}]


def _explain_min(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a min rule."""
    args = rule.get('args', [])
    messages: list[JSONMessagePart] = [{"type": "text", "text": "min("}]
    for i, arg in enumerate(args):
        if i > 0:
            messages.append({"type": "text", "text": ", "})
        messages.extend(explain_cc_rule(arg, state, player, depth + 1))
    messages.append({"type": "text", "text": ")"})
    return messages


def _explain_max(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a max rule."""
    args = rule.get('args', [])
    messages: list[JSONMessagePart] = [{"type": "text", "text": "max("}]
    for i, arg in enumerate(args):
        if i > 0:
            messages.append({"type": "text", "text": ", "})
        messages.extend(explain_cc_rule(arg, state, player, depth + 1))
    messages.append({"type": "text", "text": ")"})
    return messages


def _explain_attribute(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain an attribute access."""
    obj = rule.get('object', rule.get('value', {}))
    attr = rule.get('attr', '')

    messages: list[JSONMessagePart] = []
    messages.extend(explain_cc_rule(obj, state, player, depth + 1))
    messages.append({"type": "text", "text": f".{attr}"})
    return messages


def _explain_subscript(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a subscript/index access."""
    value = rule.get('value', {})
    index = rule.get('index', {})

    messages: list[JSONMessagePart] = []
    messages.extend(explain_cc_rule(value, state, player, depth + 1))
    messages.append({"type": "text", "text": "["})
    messages.extend(explain_cc_rule(index, state, player, depth + 1))
    messages.append({"type": "text", "text": "]"})
    return messages


def _explain_name(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a variable name reference."""
    name = rule.get('name', rule.get('id', ''))
    return [{"type": "text", "text": name}]


def _explain_function_call(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a function call."""
    func = rule.get('func', rule.get('name', ''))
    args = rule.get('args', [])

    # Handle func as a rule (e.g., attribute access)
    if isinstance(func, dict):
        messages = explain_cc_rule(func, state, player, depth + 1)
    else:
        messages = [{"type": "text", "text": str(func)}]

    messages.append({"type": "text", "text": "("})
    for i, arg in enumerate(args):
        if i > 0:
            messages.append({"type": "text", "text": ", "})
        if isinstance(arg, dict):
            messages.extend(explain_cc_rule(arg, state, player, depth + 1))
        else:
            messages.append({"type": "text", "text": str(arg)})
    messages.append({"type": "text", "text": ")"})
    return messages


def _explain_block(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a block of statements."""
    statements = rule.get('statements', [])
    if not statements:
        return [{"type": "text", "text": "[empty block]"}]

    # Just show that it's a complex block
    return [{"type": "text", "text": f"[block with {len(statements)} statements]"}]


def _explain_return(
    rule: dict, state: "CollectionState | None", player: int, depth: int
) -> list[JSONMessagePart]:
    """Explain a return statement."""
    value = rule.get('value', {})
    messages: list[JSONMessagePart] = [{"type": "text", "text": "return "}]
    messages.extend(explain_cc_rule(value, state, player, depth + 1))
    return messages
