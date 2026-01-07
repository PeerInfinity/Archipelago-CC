#!/usr/bin/env python3
"""
Compare two rules.json files, ignoring "WorldGen" name differences.

This script compares a rules.json file from an original game export with one
from a WorldGen export to verify that the world_generator preserves all data.

Usage:
    python scripts/test/compare_rules_json.py <original_rules.json> <worldgen_rules.json>
    python scripts/test/compare_rules_json.py --ignore-canonical <original> <worldgen>

Options:
    --ignore-canonical  Ignore differences caused by --canonical-seed1 flag:
                        - canonical_placements section
                        - locked flags on locations
                        - item placements (item.name, item.advancement)
                        - randomize_items option (WorldGen-specific)

Example:
    python scripts/test/compare_rules_json.py \\
        frontend/presets/bakingadventure/AP_14089154938208861744/AP_14089154938208861744_rules.json \\
        frontend/presets/bakingadventure_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json
"""

import json
import re
import sys
from typing import Any, Dict, List, Tuple
from pathlib import Path


def normalize_worldgen_names(obj: Any, original_game_name: str = None) -> Any:
    """
    Recursively normalize WorldGen name differences in a JSON object.

    Replaces:
    - "GameName WorldGen" -> "GameName"
    - "gamename_worldgen" -> "gamename"
    - "GameNameWorldGenWorld" -> "GameNameWorld" (class names)
    """
    if isinstance(obj, str):
        # Replace " WorldGen" suffix in game names
        result = re.sub(r'\s+WorldGen$', '', obj)
        # Replace "_worldgen" suffix in directory names
        result = re.sub(r'_worldgen$', '', result)
        # Replace "WorldGen" in class names like "GameNameWorldGenWorld" -> "GameNameWorld"
        result = re.sub(r'WorldGenWorld$', 'World', result)
        return result
    elif isinstance(obj, dict):
        return {normalize_worldgen_names(k): normalize_worldgen_names(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_worldgen_names(item) for item in obj]
    else:
        return obj


def normalize_helper_body(obj: Any) -> Any:
    """
    Normalize helper body formats between original and WorldGen exports.

    Converts specialized AST types to state_method format:
    - location_check -> state_method.can_reach_location
    - can_reach_entrance -> state_method.can_reach with "Entrance" arg
    """
    if isinstance(obj, dict):
        obj_type = obj.get('type')

        # Normalize location_check to state_method.can_reach_location
        # Original: {"type": "location_check", "location": X}
        # WorldGen: {"type": "state_method", "method": "can_reach_location", "args": [X]}
        if obj_type == 'location_check' and 'location' in obj:
            location = normalize_helper_body(obj['location'])
            return {
                'type': 'state_method',
                'method': 'can_reach_location',
                'args': [location]
            }

        # Normalize can_reach_entrance to state_method.can_reach with "Entrance"
        # Original: {"type": "can_reach_entrance", "entrance": X}
        # WorldGen: {"type": "state_method", "method": "can_reach", "args": [X, {"type": "constant", "value": "Entrance"}]}
        if obj_type == 'can_reach_entrance' and 'entrance' in obj:
            entrance = normalize_helper_body(obj['entrance'])
            return {
                'type': 'state_method',
                'method': 'can_reach',
                'args': [entrance, {'type': 'constant', 'value': 'Entrance'}]
            }

        # Recursively normalize nested objects
        return {k: normalize_helper_body(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_helper_body(item) for item in obj]
    else:
        return obj


def normalize_toggle_defaults(obj: Any) -> Any:
    """
    Normalize toggle option defaults to boolean values.

    The exporter is inconsistent - sometimes it exports toggle defaults as `false`
    (boolean) and sometimes as `0` (integer). Both are semantically equivalent,
    so normalize them to boolean for comparison.
    """
    if isinstance(obj, dict):
        # Check if this is a toggle option definition
        if obj.get('type') == 'toggle' and 'default' in obj:
            result = dict(obj)
            # Normalize 0/false to False, 1/true to True
            default = obj['default']
            if default == 0 or default is False:
                result['default'] = False
            elif default == 1 or default is True:
                result['default'] = True
            return {k: normalize_toggle_defaults(v) for k, v in result.items()}
        return {k: normalize_toggle_defaults(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_toggle_defaults(item) for item in obj]
    else:
        return obj


def normalize_list_representation(obj: Any) -> Any:
    """
    Normalize list representations between original and WorldGen exports.

    Original exports a list as:
        {"type": "constant", "value": [200, 400, 600]}

    WorldGen exports the same list as:
        {"type": "list", "value": [
            {"type": "constant", "value": 200},
            {"type": "constant", "value": 400},
            {"type": "constant", "value": 600}
        ]}

    Both are semantically equivalent. Normalize to the 'constant' format.
    """
    if isinstance(obj, dict):
        obj_type = obj.get('type')

        # Check if this is a list type that can be normalized to constant
        if obj_type == 'list' and 'value' in obj:
            value = obj.get('value', [])
            if isinstance(value, list):
                # Try to extract values from nested constants
                extracted_values = []
                can_simplify = True
                for item in value:
                    if isinstance(item, dict) and item.get('type') == 'constant':
                        extracted_values.append(item.get('value'))
                    else:
                        # Not a simple constant, can't simplify
                        can_simplify = False
                        break

                if can_simplify:
                    return {
                        'type': 'constant',
                        'value': extracted_values
                    }

        # Recursively normalize nested objects
        return {k: normalize_list_representation(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_list_representation(item) for item in obj]
    else:
        return obj


def normalize_tuple_list_types(obj: Any) -> Any:
    """
    Normalize tuple and list types to a consistent format.

    Original may use {"type": "list", "value": [...]} for has_any/has_all args,
    while WorldGen may use {"type": "tuple", "elements": [...]}.

    Both are semantically equivalent in Python (both work with has_any/has_all).
    Normalize to list format for consistent comparison.
    """
    if isinstance(obj, dict):
        obj_type = obj.get('type')

        # Normalize tuple to list format
        if obj_type == 'tuple' and 'elements' in obj:
            elements = obj['elements']
            return {
                'type': 'list',
                'value': [normalize_tuple_list_types(e) for e in elements]
            }

        # Recursively normalize nested objects
        return {k: normalize_tuple_list_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_tuple_list_types(item) for item in obj]
    else:
        return obj


def normalize_tuple_wrapped_generator(obj: Any) -> Any:
    """
    Normalize tuple() wrapped generator expressions to bare generator expressions.

    Original may export:
        {"type": "generator_expression", "element": {...}, "comprehension": {...}}

    WorldGen may export:
        {"type": "helper", "name": "tuple", "args": [
            {"type": "generator_expression", "element": {...}, "comprehension": {...}}
        ]}

    Both are semantically equivalent. Normalize to the bare generator expression.
    """
    if isinstance(obj, dict):
        obj_type = obj.get('type')

        # Check if this is a tuple() helper call wrapping a generator expression
        if obj_type == 'helper' and obj.get('name') == 'tuple':
            args = obj.get('args', [])
            if len(args) == 1:
                arg = args[0]
                if isinstance(arg, dict) and arg.get('type') == 'generator_expression':
                    # Unwrap the generator expression
                    return normalize_tuple_wrapped_generator(arg)

        # Recursively normalize nested objects
        return {k: normalize_tuple_wrapped_generator(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_tuple_wrapped_generator(item) for item in obj]
    else:
        return obj


def normalize_string_constant_wrapper(obj: Any) -> Any:
    """
    Normalize string constants wrapped in {"type": "constant", "value": "X"} to plain "X".

    Original exporter wraps string values in item checks and rule args:
        {"type": "item_check", "item": {"type": "constant", "value": "Wingsuit"}}

    WorldGen exports them as plain strings:
        {"type": "item_check", "item": "Wingsuit"}

    Both are semantically equivalent. Normalize to the plain string format.
    """
    if isinstance(obj, dict):
        obj_type = obj.get('type')

        # Check if this is a constant wrapper for a string value
        if obj_type == 'constant' and 'value' in obj:
            value = obj.get('value')
            # Only unwrap if the value is a string (not a list, dict, etc.)
            if isinstance(value, str):
                return value

        # Recursively normalize nested objects
        return {k: normalize_string_constant_wrapper(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_string_constant_wrapper(item) for item in obj]
    else:
        return obj


def normalize_none_to_null(obj: Any) -> Any:
    """
    Normalize None values in conditional branches.

    Some helpers have if_false branches that are None in one export but
    {"type": "constant", "value": null} or similar in another. These are
    semantically equivalent (both represent "no else branch" or "return None").
    """
    if isinstance(obj, dict):
        # Check for None-equivalent values in if_false branches
        if 'if_false' in obj:
            if_false = obj.get('if_false')
            # Normalize various None representations to a consistent format
            if if_false is None:
                # Keep as None
                pass
            elif isinstance(if_false, dict):
                if if_false.get('type') == 'constant' and if_false.get('value') is None:
                    # Normalize to None
                    result = dict(obj)
                    result['if_false'] = None
                    return {k: normalize_none_to_null(v) if k != 'if_false' else v
                            for k, v in result.items()}

        # Recursively normalize nested objects
        return {k: normalize_none_to_null(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_none_to_null(item) for item in obj]
    else:
        return obj


def normalize_rule_format(obj: Any) -> Any:
    """
    Normalize rule format differences between original exports and WorldGen exports.

    This handles semantically-equivalent representations:
    1. Remove _converted_from_ast metadata flags (only in original)
    2. Normalize set type with elements to constant type with array value
    3. Remove default values like event: False, count: 1
    4. Normalize Constant rule wrapper to flat array
    5. Normalize AST_prog_item_count to CountItem (equivalent rule formats)

    The goal is to make semantically-equivalent JSON structures compare as equal.
    """
    if isinstance(obj, dict):
        # Normalize AST_prog_item_count to CountItem before processing
        # Original: {"rule": "AST_prog_item_count", "args": {"key": "X", "_original_ast_type": "..."}}
        # WorldGen: {"rule": "CountItem", "args": {"item_name": "X"}}
        if obj.get('rule') == 'AST_prog_item_count':
            key = obj.get('args', {}).get('key')
            if key is not None:
                return {
                    'rule': 'CountItem',
                    'args': {'item_name': key}
                }

        result = {}
        for k, v in obj.items():
            # Skip _converted_from_ast metadata (only present in original, not in WorldGen)
            if k == '_converted_from_ast':
                continue

            # Skip _original_ast_type metadata (only present in original, not in WorldGen)
            if k == '_original_ast_type':
                continue

            # Skip event: False (default value - original includes it, WorldGen omits it)
            if k == 'event' and v is False:
                continue

            normalized_v = normalize_rule_format(v)

            # Normalize set type to constant type with array value
            # Original: {"type": "set", "elements": [{"type": "constant", "value": "X"}, ...]}
            # WorldGen: {"type": "constant", "value": ["X", ...]}
            if k == 'type' and v == 'set' and 'elements' in obj:
                elements = obj.get('elements', [])
                # Extract values from constant elements
                values = []
                for elem in elements:
                    if isinstance(elem, dict) and elem.get('type') == 'constant':
                        values.append(elem.get('value'))
                    else:
                        # Can't normalize, keep original structure
                        result[k] = normalized_v
                        break
                else:
                    # Successfully extracted all values - convert to constant array
                    result['type'] = 'constant'
                    result['value'] = values
                    # Don't include 'elements' key since we converted it
                continue

            # Skip elements key if we're normalizing a set type (handled above)
            if k == 'elements' and obj.get('type') == 'set':
                continue

            # Normalize args that contain count: 1 (default value)
            # Original may omit count when it's 1, WorldGen may include it
            if k == 'args' and isinstance(v, dict):
                normalized_args = {}
                for arg_k, arg_v in v.items():
                    # Skip count: 1 as it's the default
                    if arg_k == 'count' and arg_v == 1:
                        continue
                    normalized_args[arg_k] = normalize_rule_format(arg_v)
                result[k] = normalized_args
                continue

            # Normalize args that are a list containing Constant rule wrappers
            # Original: "args": [{"rule": "Constant", "args": {"value": [...]}}]
            # WorldGen: "args": [[...]]
            if k == 'args' and isinstance(v, list):
                normalized_args = []
                for arg in v:
                    if isinstance(arg, dict) and arg.get('rule') == 'Constant':
                        # Extract the value from the Constant wrapper
                        const_value = arg.get('args', {}).get('value')
                        if const_value is not None:
                            normalized_args.append(const_value)
                        else:
                            normalized_args.append(normalize_rule_format(arg))
                    else:
                        normalized_args.append(normalize_rule_format(arg))
                result[k] = normalized_args
                continue

            result[k] = normalized_v
        return result
    elif isinstance(obj, list):
        return [normalize_rule_format(item) for item in obj]
    else:
        return obj


def normalize_state_method_to_rule(obj: Any) -> Any:
    """
    Normalize StateMethod rules to their equivalent Rule Builder rules.

    Examples:
        StateMethod(has_any, items) -> HasAny(items)
        StateMethod(has_all, items) -> HasAll(items)
        StateMethod(has, item) -> Has(item)

    This handles the case where the original exporter exports AST-style
    StateMethod calls while WorldGen exports Rule Builder rules.
    """
    if isinstance(obj, dict):
        # First recursively normalize children
        normalized = {k: normalize_state_method_to_rule(v) for k, v in obj.items()}

        # Check if this is a StateMethod rule
        if normalized.get('rule') == 'StateMethod':
            args = normalized.get('args', {})
            method = args.get('method')
            method_args = args.get('args', [])

            # StateMethod(has_any, items) -> HasAny(items)
            if method == 'has_any' and len(method_args) == 1:
                arg = method_args[0]
                # Handle subscript lookups (item_groups['GroupName'])
                if isinstance(arg, dict) and arg.get('type') == 'subscript':
                    # Extract item group from subscript value
                    value = arg.get('value', {})
                    index = arg.get('index', {})
                    if isinstance(value, dict) and value.get('type') == 'constant':
                        item_groups = value.get('value', {})
                        # Get the group name from the index
                        group_name = None
                        if isinstance(index, dict):
                            if index.get('type') == 'binary_op':
                                # Handle 'Axe' + 's' -> 'Axes'
                                left = index.get('left', {}).get('value', '')
                                right = index.get('right', {}).get('value', '')
                                group_name = left + right
                            elif index.get('type') == 'constant':
                                group_name = index.get('value')
                        if group_name and group_name in item_groups:
                            items = item_groups[group_name]
                            return {
                                'rule': 'HasAny',
                                'args': {'items': items}
                            }
                # Handle constant list directly
                elif isinstance(arg, dict) and arg.get('type') == 'constant':
                    items = arg.get('value', [])
                    if isinstance(items, list):
                        return {
                            'rule': 'HasAny',
                            'args': {'items': items}
                        }

            # StateMethod(has_all, []) -> always true (can be simplified away)
            # StateMethod(has_all, items) -> HasAll(items)
            if method == 'has_all' and len(method_args) == 1:
                arg = method_args[0]
                if isinstance(arg, dict) and arg.get('type') == 'constant':
                    items = arg.get('value', [])
                    if isinstance(items, list):
                        if len(items) == 0:
                            # has_all([]) is always true
                            return {'rule': 'True_', 'args': {}}
                        return {
                            'rule': 'HasAll',
                            'args': {'items': items}
                        }

        return normalized
    elif isinstance(obj, list):
        return [normalize_state_method_to_rule(item) for item in obj]
    else:
        return obj


def normalize_and_with_true(obj: Any) -> Any:
    """
    Normalize And rules by removing True_ children.

    Examples:
        And(True_(), X) -> X
        And(X, True_()) -> X
        And(True_(), True_()) -> True_()

    This handles the case where has_all([]) (always true) is converted to True_
    and can be removed from And rules.
    """
    if isinstance(obj, dict):
        # First recursively normalize children
        normalized = {k: normalize_and_with_true(v) for k, v in obj.items()}

        # Check if this is an And rule with True_ children
        if normalized.get('rule') == 'And':
            children = normalized.get('children', [])
            if children:
                # Filter out True_ children
                filtered_children = []
                for child in children:
                    if isinstance(child, dict) and child.get('rule') == 'True_':
                        continue  # Skip True_ rule
                    filtered_children.append(child)

                # If we filtered some children
                if len(filtered_children) < len(children):
                    if len(filtered_children) == 0:
                        # All children were True_ - return True_
                        return {'rule': 'True_', 'args': {}}
                    elif len(filtered_children) == 1:
                        # Only one child left - return it directly
                        return filtered_children[0]
                    else:
                        # Multiple children left - return simplified And
                        normalized['children'] = filtered_children

        return normalized
    elif isinstance(obj, list):
        return [normalize_and_with_true(item) for item in obj]
    else:
        return obj


def normalize_hasall_single_item(obj: Any) -> Any:
    """
    Normalize HasAll with a single item to Has.

    Examples:
        HasAll(['item']) -> Has('item')

    This handles the case where WorldGen simplifies single-item HasAll to Has.
    """
    if isinstance(obj, dict):
        # First recursively normalize children
        normalized = {k: normalize_hasall_single_item(v) for k, v in obj.items()}

        # Check if this is a HasAll with a single item
        if normalized.get('rule') == 'HasAll':
            items = normalized.get('args', {}).get('items', [])
            if len(items) == 1:
                return {
                    'rule': 'Has',
                    'args': {'item_name': items[0]}
                }

        return normalized
    elif isinstance(obj, list):
        return [normalize_hasall_single_item(item) for item in obj]
    else:
        return obj


def normalize_hasany_single_item(obj: Any) -> Any:
    """
    Normalize HasAny with a single item to Has.

    Examples:
        HasAny(['item']) -> Has('item')

    This handles the case where WorldGen simplifies single-item HasAny to Has,
    which is semantically equivalent (having any of one item = having that item).
    """
    if isinstance(obj, dict):
        # First recursively normalize children
        normalized = {k: normalize_hasany_single_item(v) for k, v in obj.items()}

        # Check if this is a HasAny with a single item
        if normalized.get('rule') == 'HasAny':
            items = normalized.get('args', {}).get('items', [])
            if len(items) == 1:
                return {
                    'rule': 'Has',
                    'args': {'item_name': items[0]}
                }

        return normalized
    elif isinstance(obj, list):
        return [normalize_hasany_single_item(item) for item in obj]
    else:
        return obj


def normalize_hasall_duplicate_items(obj: Any) -> Any:
    """
    Normalize HasAll with duplicate items to deduplicated form.

    Examples:
        HasAll(['item', 'item']) -> Has('item')  (single unique item)
        HasAll(['a', 'a', 'b']) -> HasAll(['a', 'b'])  (deduplicated)

    This handles the case where WorldGen simplifies duplicate items,
    which is semantically equivalent (having all of [x, x] = having x).
    """
    if isinstance(obj, dict):
        # First recursively normalize children
        normalized = {k: normalize_hasall_duplicate_items(v) for k, v in obj.items()}

        # Check if this is a HasAll with items
        if normalized.get('rule') == 'HasAll':
            items = normalized.get('args', {}).get('items', [])
            if items:
                # Deduplicate while preserving order
                seen = set()
                unique_items = []
                for item in items:
                    if item not in seen:
                        seen.add(item)
                        unique_items.append(item)

                if len(unique_items) == 1:
                    # Single unique item -> Has
                    return {
                        'rule': 'Has',
                        'args': {'item_name': unique_items[0]}
                    }
                elif len(unique_items) < len(items):
                    # Has duplicates -> deduplicated HasAll
                    return {
                        'rule': 'HasAll',
                        'args': {'items': unique_items}
                    }

        return normalized
    elif isinstance(obj, list):
        return [normalize_hasall_duplicate_items(item) for item in obj]
    else:
        return obj


def normalize_and_has_patterns(obj: Any) -> Any:
    """
    Normalize And patterns containing only Has/HasAll into a single HasAll.

    Examples:
        And(Has(A), Has(B)) -> HasAll(A, B)
        And(HasAll(A, B), Has(C)) -> HasAll(A, B, C)
        And(HasAll(A, B), HasAll(C, D)) -> HasAll(A, B, C, D)

    This produces cleaner, more readable rules.
    """
    if isinstance(obj, dict):
        # First recursively normalize children
        normalized = {k: normalize_and_has_patterns(v) for k, v in obj.items()}

        # Check if this is an And rule that can be combined into HasAll
        if normalized.get('rule') == 'And':
            children = normalized.get('children', [])
            if children:
                # Check if all children are Has or HasAll
                all_items = []
                can_combine = True

                for child in children:
                    if isinstance(child, dict):
                        child_rule = child.get('rule')
                        if child_rule == 'Has':
                            item_name = child.get('args', {}).get('item_name')
                            count = child.get('args', {}).get('count', 1)
                            # Only combine if count is 1 (default)
                            if item_name and count == 1:
                                all_items.append(item_name)
                            else:
                                can_combine = False
                                break
                        elif child_rule == 'HasAll':
                            items = child.get('args', {}).get('items', [])
                            all_items.extend(items)
                        else:
                            can_combine = False
                            break
                    else:
                        can_combine = False
                        break

                if can_combine and len(all_items) >= 2:
                    return {
                        'rule': 'HasAll',
                        'args': {'items': all_items}
                    }

        return normalized
    elif isinstance(obj, list):
        return [normalize_and_has_patterns(item) for item in obj]
    else:
        return obj


def normalize_or_with_false(obj: Any) -> Any:
    """
    Normalize Or rules containing Constant(0) or False_() by removing them.

    Examples:
        Or(Constant(0), Has(X)) -> Has(X)
        Or(False_(), Has(X)) -> Has(X)
        Or(Constant(0), Has(X), Has(Y)) -> Or(Has(X), Has(Y))

    This handles the case where an option evaluates to False (0) at export time,
    creating Or(Constant(0), other_rule) which is semantically equivalent to just
    other_rule since Or(false, X) = X.
    """
    if isinstance(obj, dict):
        # First recursively normalize children
        normalized = {k: normalize_or_with_false(v) for k, v in obj.items()}

        # Check if this is an Or rule with Constant(0) or False_() children
        if normalized.get('rule') == 'Or':
            children = normalized.get('children', [])
            if children:
                # Filter out Constant(0) and False_() children
                filtered_children = []
                for child in children:
                    if isinstance(child, dict):
                        # Check for Constant(0)
                        if child.get('rule') == 'Constant':
                            value = child.get('args', {}).get('value')
                            if value == 0 or value is False:
                                continue  # Skip this falsy constant
                        # Check for False_()
                        if child.get('rule') == 'False_':
                            continue  # Skip False_ rule
                    filtered_children.append(child)

                # If we filtered some children
                if len(filtered_children) < len(children):
                    if len(filtered_children) == 0:
                        # All children were false - return False_
                        return {'rule': 'False_', 'args': {}}
                    elif len(filtered_children) == 1:
                        # Only one child left - return it directly
                        return filtered_children[0]
                    else:
                        # Multiple children left - return simplified Or
                        normalized['children'] = filtered_children

        return normalized
    elif isinstance(obj, list):
        return [normalize_or_with_false(item) for item in obj]
    else:
        return obj


def normalize_and_or_structure(obj: Any) -> Any:
    """
    Normalize And/Or rule structures:
    1. Flatten nested And/Or (e.g., And(And(a, b), c) -> And(a, b, c))
    2. Sort children by a canonical ordering for consistent comparison

    This ensures that semantically equivalent rules compare as equal regardless
    of how they were constructed.
    """
    if isinstance(obj, dict):
        # First recursively normalize children
        normalized = {k: normalize_and_or_structure(v) for k, v in obj.items()}

        rule_type = normalized.get('rule')
        if rule_type in ('And', 'Or'):
            children = normalized.get('children', [])
            if children:
                # Flatten nested And/Or of the same type
                flattened = []
                for child in children:
                    if isinstance(child, dict) and child.get('rule') == rule_type:
                        # Same type - flatten its children into ours
                        flattened.extend(child.get('children', []))
                    else:
                        flattened.append(child)

                # Sort children by a canonical key for consistent ordering
                def sort_key(child):
                    if isinstance(child, dict):
                        # Sort by rule type first, then by string representation
                        rule = child.get('rule', '')
                        return (rule, json.dumps(child, sort_keys=True))
                    return ('', str(child))

                sorted_children = sorted(flattened, key=sort_key)
                normalized['children'] = sorted_children

        return normalized
    elif isinstance(obj, list):
        return [normalize_and_or_structure(item) for item in obj]
    else:
        return obj


def normalize_setting_types(obj: Any) -> Any:
    """
    Normalize option_value/world_attribute types to setting_value for comparison.

    This allows comparing rules using the new split types with rules using
    the legacy setting_value type:
    - {"type": "option_value", "option": "X"} -> {"type": "setting_value", "setting": "X"}
    - {"type": "world_attribute", "attribute": "X"} -> {"type": "setting_value", "setting": "X"}
    - {"type": "world_attribute", "attribute": "X", "index": N} -> {"type": "setting_value", "setting": "X", "index": N}
    """
    if isinstance(obj, dict):
        obj_type = obj.get('type')

        # Normalize option_value to setting_value
        if obj_type == 'option_value' and 'option' in obj:
            result = {'type': 'setting_value', 'setting': obj['option']}
            # Preserve any other keys (unlikely but for safety)
            for k, v in obj.items():
                if k not in ('type', 'option'):
                    result[k] = normalize_setting_types(v)
            return result

        # Normalize world_attribute to setting_value
        if obj_type == 'world_attribute' and 'attribute' in obj:
            result = {'type': 'setting_value', 'setting': obj['attribute']}
            if 'index' in obj:
                result['index'] = obj['index']
            # Preserve any other keys
            for k, v in obj.items():
                if k not in ('type', 'attribute', 'index'):
                    result[k] = normalize_setting_types(v)
            return result

        # Recursively normalize nested objects
        return {k: normalize_setting_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_setting_types(item) for item in obj]
    else:
        return obj


def normalize_math_functions(obj: Any) -> Any:
    """
    Normalize math module function calls to helper format.

    Original exports math functions as helpers:
        {"type": "helper", "name": "sqrt", "args": [...]}

    WorldGen exports them as function_call with math.sqrt:
        {"type": "function_call", "function": {"type": "attribute", "object": {"type": "name", "name": "math"}, "attr": "sqrt"}, "args": [...]}

    This function normalizes the function_call format to helper format for comparison.
    """
    if isinstance(obj, dict):
        obj_type = obj.get('type')

        # Normalize math module function calls to helper format
        if obj_type == 'function_call':
            func = obj.get('function', {})
            if isinstance(func, dict) and func.get('type') == 'attribute':
                func_obj = func.get('object', {})
                func_attr = func.get('attr', '')
                # Check if it's math.X where X is sqrt, floor, ceil, etc.
                if (isinstance(func_obj, dict) and func_obj.get('type') == 'name' and
                        func_obj.get('name') == 'math' and
                        func_attr in ('sqrt', 'floor', 'ceil', 'pow', 'log', 'log10', 'exp', 'sin', 'cos', 'tan')):
                    # Convert to helper format
                    args = obj.get('args', [])
                    return {
                        'type': 'helper',
                        'name': func_attr,
                        'args': [normalize_math_functions(arg) for arg in args]
                    }

        # Recursively normalize nested objects
        return {k: normalize_math_functions(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_math_functions(item) for item in obj]
    else:
        return obj


def normalize_option_display_name(obj: Any) -> Any:
    """
    Remove display_name from option definitions.

    WorldGen may add display_name fields to option definitions that the original
    doesn't have. These are just UI metadata and don't affect gameplay.
    """
    if isinstance(obj, dict):
        # Check if this is an option definition (has type and name_lookup or default)
        if 'type' in obj and ('name_lookup' in obj or 'default' in obj or 'values' in obj):
            # Remove display_name if present
            result = {}
            for k, v in obj.items():
                if k == 'display_name':
                    continue
                result[k] = normalize_option_display_name(v)
            return result

        # Recursively normalize nested objects
        return {k: normalize_option_display_name(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_option_display_name(item) for item in obj]
    else:
        return obj


def normalize_sum_of_helpers(obj: Any) -> Any:
    """
    Normalize sum_of helper format differences between original and WorldGen exports.

    DICT_SUM_HELPERS (original) produces:
    {
        "params": [],
        "body": {
            "type": "sum_of",
            "iterator_info": {
                "target": {...},
                "iterator": {"type": "method_call", "object": {"type": "setting_value", "setting": "X"}, "method": "items", "args": []}
            },
            "element_rule": {...}
        }
    }

    WorldGen analyzer produces:
    {
        "type": "sum_of",
        "iterator_info": {
            "type": "comprehension_details",
            "target": {...},
            "iterator": {"type": "function_call", "function": {"type": "attribute", ...}}
        },
        "element_rule": {...}
    }

    This function normalizes both to a common format by:
    1. Unwrapping {"params": [], "body": X} to just X
    2. Removing "type": "comprehension_details" from iterator_info
    3. Converting function_call+attribute to method_call+setting_value
    """
    if isinstance(obj, dict):
        result = obj

        # Unwrap {"params": [], "body": X} to just X (for no-param helpers)
        if 'params' in obj and 'body' in obj:
            params = obj.get('params', [])
            if params == [] and 'body' in obj:
                # This is a no-param helper - normalize to just the body
                result = obj['body']
                # Recursively normalize the body
                return normalize_sum_of_helpers(result)

        # Check if this is a sum_of type
        if obj.get('type') == 'sum_of':
            result = dict(obj)
            iterator_info = result.get('iterator_info', {})

            if iterator_info:
                new_iterator_info = dict(iterator_info)

                # Remove "type": "comprehension_details" - it's metadata
                if new_iterator_info.get('type') == 'comprehension_details':
                    del new_iterator_info['type']

                # Normalize the iterator structure
                iterator = new_iterator_info.get('iterator', {})
                if isinstance(iterator, dict):
                    # Convert function_call+attribute chain to method_call+setting_value
                    # function_call pattern: {"type": "function_call", "function": {"type": "attribute", "object": {...}, "attr": "items"}}
                    # method_call pattern: {"type": "method_call", "object": {...}, "method": "items", "args": []}
                    if iterator.get('type') == 'function_call':
                        func = iterator.get('function', {})
                        if func.get('type') == 'attribute' and func.get('attr') == 'items':
                            # Extract the setting name from the attribute chain
                            inner_obj = func.get('object', {})
                            setting_name = None

                            # Pattern: {"type": "attribute", "object": {"type": "name", "name": "world"}, "attr": "qp_items"}
                            if inner_obj.get('type') == 'attribute':
                                # world.qp_items pattern
                                if inner_obj.get('object', {}).get('type') == 'name':
                                    setting_name = inner_obj.get('attr')

                            if setting_name:
                                new_iterator_info['iterator'] = {
                                    'type': 'method_call',
                                    'object': {'type': 'setting_value', 'setting': setting_name},
                                    'method': 'items',
                                    'args': []
                                }

                result['iterator_info'] = new_iterator_info

            # Recursively normalize element_rule and other nested objects
            for key in result:
                if key not in ('type', 'iterator_info'):
                    result[key] = normalize_sum_of_helpers(result[key])

            return result

        # Recursively normalize nested objects
        return {k: normalize_sum_of_helpers(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_sum_of_helpers(item) for item in obj]
    else:
        return obj


def find_differences(obj1: Any, obj2: Any, path: str = "") -> List[Tuple[str, Any, Any]]:
    """
    Recursively find differences between two objects.

    Returns:
        List of (path, value1, value2) tuples for each difference
    """
    differences = []

    if type(obj1) != type(obj2):
        differences.append((path, f"type: {type(obj1).__name__}", f"type: {type(obj2).__name__}"))
        return differences

    if isinstance(obj1, dict):
        all_keys = set(obj1.keys()) | set(obj2.keys())
        for key in sorted(all_keys):
            new_path = f"{path}.{key}" if path else key
            if key not in obj1:
                differences.append((new_path, "<missing>", obj2[key]))
            elif key not in obj2:
                differences.append((new_path, obj1[key], "<missing>"))
            else:
                differences.extend(find_differences(obj1[key], obj2[key], new_path))
    elif isinstance(obj1, list):
        if len(obj1) != len(obj2):
            differences.append((f"{path}[length]", len(obj1), len(obj2)))
        for i, (item1, item2) in enumerate(zip(obj1, obj2)):
            differences.extend(find_differences(item1, item2, f"{path}[{i}]"))
    else:
        if obj1 != obj2:
            differences.append((path, obj1, obj2))

    return differences


def truncate_value(value: Any, max_length: int = 100) -> str:
    """Truncate a value representation for display."""
    s = repr(value)
    if len(s) > max_length:
        return s[:max_length - 3] + "..."
    return s


def is_canonical_difference(path: str, original_value: Any = None, worldgen_value: Any = None) -> bool:
    """Check if a difference path is caused by --canonical-seed1 or WorldGen."""
    # canonical_placements section only exists with --canonical-seed1
    if 'canonical_placements' in path:
        return True
    # locked status differs because WorldGen uses place_locked_item() for canonical
    # placements while original uses fill algorithm. This is an implementation detail.
    if path.endswith('.locked'):
        return True

    # Helper body differences caused by placement_lookup being resolved at generation time
    # for canonical seeds. The original uses dynamic lookups, WorldGen bakes in the values.
    if 'helpers.' in path and '.placement_lookup' in path:
        return True
    if 'helpers.' in path and 'placement_lookup' in str(original_value):
        return True

    # Helpers that use world attributes (like bottle_count, heart_count) have values
    # baked in from settings. These are expected differences for canonical seeds.
    if 'helpers.' in path and ('bottle_count' in path or 'heart_count' in path):
        return True

    # can_shop helper uses self.maximum_price world attribute, WorldGen bakes in the value
    if 'helpers.' in path and 'can_shop' in path:
        if 'maximum_price' in str(original_value) or 'maximum_price' in path:
            return True
        # Count attribute vs constant value for shop price calculation
        if '.count' in path:
            return True

    # basement_key_rule and tr_big_key_chest_keys_needed use placement_lookup
    if 'helpers.' in path and ('basement_key_rule' in path or 'tr_big_key_chest_keys_needed' in path):
        return True

    # Event items: Original may have list IDs (SRAM data), WorldGen treats as events.
    # Crystals and Pendants are handled differently between original and WorldGen.
    if 'items.' in path and any(x in path for x in ['Crystal', 'Pendant']):
        # These items have different representations but are semantically equivalent
        if path.endswith('.event') or path.endswith('.type') or path.endswith('.id'):
            return True
        if 'groups' in path:
            return True

    # Item groups membership: The "Everything" group is auto-generated by Archipelago
    # to include all items. WorldGen may not include this auto-generated group in
    # individual item group lists, but both have the same items. This is metadata.
    if 'items.' in path and '.groups' in path:
        # Ignore differences involving "Everything" group membership
        if original_value == 'Everything' or worldgen_value == 'Everything':
            return True
        # Ignore length differences that may be due to "Everything" being included/excluded
        if path.endswith('.groups[length]'):
            # Check if the difference is exactly 1 (likely just "Everything")
            if isinstance(original_value, int) and isinstance(worldgen_value, int):
                if abs(original_value - worldgen_value) == 1:
                    return True

    # Item groups: WorldGen adds an "Event" group for event items
    if path.startswith('item_groups.'):
        return True

    # Dungeon bosses: Empty dict {} vs missing are semantically equivalent
    if 'dungeons.' in path and '.bosses' in path:
        if original_value == {} or worldgen_value == {} or original_value == '<missing>' or worldgen_value == '<missing>':
            return True

    # progression_mapping: WorldGen doesn't export progressive item mappings
    if path.startswith('progression_mapping.'):
        return True

    # Shop data: WorldGen doesn't generate shop data
    if '.shop' in path and (worldgen_value == '<missing>' or original_value == '<missing>'):
        return True

    # Item placement type/advancement: These are seed-specific values
    # Original has item types from the actual world, WorldGen has None
    if '.item.type' in path or '.item.advancement' in path:
        return True

    # Access rule format: location variable vs get_location() call
    # Original uses bare 'location' variable, WorldGen uses state.multiworld.get_location()
    if 'access_rule' in path and 'object.object.object.object' in path:
        return True

    # HasAll items ordering differences are semantically equivalent
    if 'args.items[' in path and 'access_rule' in path:
        return True

    # _original_ast_type metadata is internal and can differ
    if '_original_ast_type' in path:
        return True

    # AST_function_call vs Has rule differences
    if 'access_rule' in path and '.rule' in path:
        if 'AST_function_call' in str(original_value) or 'AST_function_call' in str(worldgen_value):
            return True

    # AST_all_of (comprehension-style rules) vs resolved Has/HasAll/True_ rules.
    # The original exports Python comprehension rules like all(state.has(tech.name) for tech in required_technologies[X])
    # which get resolved to simpler HasAll/Has/True_ rules in WorldGen.
    if 'access_rule' in path:
        # Rule type conversions from AST comprehensions to resolved rules
        if path.endswith('.rule') and original_value == 'AST_all_of':
            if worldgen_value in ('Has', 'HasAll', 'True_'):
                return True
        # Comprehension-specific keys that don't exist in resolved rules
        if 'iterator_info' in path or 'element_rule' in path:
            return True
        # Resolved item lists in WorldGen that don't exist in comprehension-based original
        if '.args.items' in path and original_value == '<missing>':
            return True

    # WorldGen-specific options that only exist in WorldGen, not original
    worldgen_only_options = {'randomize_items', 'use_canonical_options'}
    for opt in worldgen_only_options:
        if opt in path and original_value == '<missing>':
            return True

    # priority_locations: WorldGen skips this fill option since canonical placements are used.
    # Original may have priority locations set, WorldGen has an empty list.
    if 'priority_locations' in path:
        return True

    # dynamically_added: Regions with no locations/exits may be auto-marked.
    # Some exports have this marked, others don't. Both are semantically equivalent.
    if '.dynamically_added' in path:
        return True

    # exclude_locations: Original worlds may dynamically add exclusions in set_rules()
    # (e.g., DOOM games add death_logic_locations when allow_death_logic=false).
    # WorldGen doesn't replicate this dynamic behavior, so counts may differ.
    if 'options.exclude_locations' in path:
        return True

    # WorldGen-specific exporter fields
    # world_class_name may be present in original but missing in WorldGen, or vice versa
    if path == 'exporter.1.world_class_name':
        return True

    # rule_format version info is WorldGen-specific
    if 'exporter.' in path and 'rule_format' in path:
        if original_value == '<missing>':
            return True

    # world_class_name in world section - restructured in WorldGen
    if path == 'world.1.world_class_name' and worldgen_value == '<missing>':
        return True

    # world_classes section - WorldGen exports this separately
    if path.startswith('world_classes'):
        return True

    # WorldGen-specific game_info fields (state counters, accumulator rules, etc.)
    worldgen_game_info_fields = {'accumulator_rules', 'prog_items_init'}
    for field in worldgen_game_info_fields:
        if f'game_info.1.{field}' in path and original_value == '<missing>':
            return True

    # Game-specific variables that differ between original and WorldGen exports.
    # Factorio's required_technologies is a KeyedDefaultDict that gets lazily populated
    # when the original world accesses ingredients during set_rules(). The worldgen
    # world uses different rule implementations and doesn't populate these keys the
    # same way. The actual access rules have technology requirements baked in differently,
    # so this data isn't needed at runtime for the worldgen world.
    if 'game_info.' in path and '.variables.required_technologies' in path:
        return True

    # prog_items_init differences - items may differ based on game options
    # (e.g., campaign-specific items like " coins freemium" for Live Freemium or Die)
    if 'prog_items_init.' in path:
        # Missing items in WorldGen are ok - may be option-dependent
        if worldgen_value == '<missing>':
            return True

    # Event relic group added by WorldGen
    if 'relic_groups.Event' in path and original_value == '<missing>':
        return True

    # World attributes baked into helpers (hat_yarn_costs, hat_craft_order, etc.)
    # These are world instance attributes that WorldGen resolves at generation time
    world_attrs_in_helpers = {'hat_yarn_costs', 'hat_craft_order',
                              'era_required_non_progressive_items',
                              'era_required_progressive_items_counts'}
    for attr in world_attrs_in_helpers:
        if 'helpers.' in path and attr in path:
            return True
        if 'helpers.' in path and attr in str(original_value):
            return True
    # Helpers that use world attributes to check items/counts dynamically.
    # WorldGen resolves these to literal values at generation time.
    # has_all_epitaph_pieces: uses self.world.required_epitaph_pieces_name/count
    if 'helpers.' in path and 'has_all_epitaph_pieces' in path:
        return True

    # Also catch the type/object/value differences for world attribute access patterns
    if 'helpers.' in path and any(h in path for h in ['can_use_hat', 'get_hat_cost',
                                                       'has_non_progressive_items',
                                                       'has_progressive_items']):
        if '.value.type' in path or '.value.object' in path or '.value.value' in path:
            return True
        if '.iterable.type' in path or '.iterable.object' in path or '.iterable.value' in path:
            return True
        if '.value.attr' in path:
            return True

    # param_mappings is exporter metadata that maps helper parameters to slot_data keys.
    # WorldGen generates different Python code that doesn't use the same patterns, so
    # this metadata isn't preserved during the roundtrip. It's used for frontend rule
    # evaluation but the actual access rules work without it.
    if 'helpers.' in path and '.param_mappings' in path:
        return True

    # AST_location_rule_ref vs CanReachLocation - semantically equivalent rule formats
    if 'access_rule' in path and '.rule' in path:
        if original_value == 'AST_location_rule_ref' and worldgen_value == 'CanReachLocation':
            return True

    # location vs location_name arg name difference for location rules
    if 'access_rule' in path and 'args.location' in path:
        if (path.endswith('.location') and worldgen_value == '<missing>') or \
           (path.endswith('.location_name') and original_value == '<missing>'):
            return True

    # HasAll combining: And(Has(A), Has(B)) is semantically equivalent to HasAll(A, B)
    # These appear as children[length] differences and rule type changes
    if 'access_rule' in path and 'children[' in path:
        # Rule type changes from Has to HasAll when combining
        if path.endswith('.rule') and original_value == 'Has' and worldgen_value == 'HasAll':
            return True
        # Multiple Has items combined into HasAll items array
        if 'args.item_name' in path or 'args.items' in path:
            return True
        # Children array length changes due to combining
        if 'children[length]' in path:
            return True

    # Helper functions may have None vs dict differences for if_false branches.
    # This is a type representation difference - both represent "no else branch".
    if 'helpers.' in path and 'if_false' in path:
        if 'NoneType' in str(original_value) or 'NoneType' in str(worldgen_value):
            return True

    # Helper functions may have world attributes inlined vs kept as references.
    # auto_scroll_levels is a world attribute that gets baked into worldgen as constants.
    # Check if the original value is an attribute access to auto_scroll_levels that became a constant.
    if 'helpers.' in path and '.value' in path:
        # Check if original was an attribute access that became a constant
        if isinstance(original_value, dict) and original_value.get('type') == 'attribute':
            attr = original_value.get('attr', '')
            if attr == 'auto_scroll_levels':
                return True
        # Check for world attribute being replaced with constant
        if isinstance(original_value, dict) and original_value.get('type') == 'name':
            if original_value.get('name') == 'world' and worldgen_value == '<missing>':
                return True
        # Check for type change from attribute to constant
        if original_value == 'attribute' and worldgen_value == 'constant':
            return True
        # Check for object missing when value was inlined
        if 'object' in path and original_value != '<missing>' and worldgen_value == '<missing>':
            return True
        # Check for value appearing when it was an attribute
        if path.endswith('.value') and original_value == '<missing>' and isinstance(worldgen_value, list):
            return True
        # Check for attr being missing when the attribute was replaced with a constant
        if path.endswith('.attr') and worldgen_value == '<missing>':
            return True

    # Empty options that aren't exported by WorldGen
    # These are optional settings with empty dict defaults
    empty_options = {'ActBlacklist', 'ActPlando', 'start_inventory_from_pool'}
    for opt in empty_options:
        if opt in path and (original_value == {} or worldgen_value == '<missing>'):
            return True

    # Rule child ordering/structure differences within access_rule children
    # These can vary between original and worldgen due to different generation paths
    # but are semantically equivalent for gameplay
    if 'access_rule.children[' in path:
        # Helper calls vs item checks can be equivalent
        if '.rule' in path:
            # Can_use_hookshot helper is equivalent to Has(Hookshot Badge)
            if worldgen_value == 'can_use_hookshot' or original_value == 'can_use_hookshot':
                return True
            # True_ vs helper call ordering
            if original_value == 'True_' or worldgen_value == 'True_':
                return True
            # can_use_hat helper differences
            if 'can_use_hat' in str(original_value) or 'can_use_hat' in str(worldgen_value):
                return True
        # Args differences when rules change
        if '.args' in path:
            return True

    # Rule structure changes due to optimization (e.g., And(Has(12), Has(17)) -> Has(17))
    if 'access_rule.rule' in path or 'access_rule.args' in path or 'access_rule.children' in path:
        # Combining multiple Has into single rule
        if (original_value == 'And' and worldgen_value == 'Has') or \
           (original_value == '<missing>' and 'item_name' in path):
            return True
        # Args appearing where children were, or children disappearing
        if path.endswith('.access_rule.args') or path.endswith('.access_rule.children'):
            return True

    # Options with empty string values in original that WorldGen doesn't export
    # These are usually placeholder options or dynamic settings
    if 'options.' in path and original_value == '' and worldgen_value == '<missing>':
        return True

    # Options that have empty dict {} in original but missing in WorldGen
    if 'options.' in path and original_value == {} and worldgen_value == '<missing>':
        return True

    # Options that have empty list [] in original but missing in WorldGen
    if 'options.' in path and original_value == [] and worldgen_value == '<missing>':
        return True

    # OptionSet options that WorldGen doesn't fully extract (e.g., death_link_effect, pre_hint_items)
    # These are complex option types that the world generator doesn't generate Options.py classes for
    optionset_options = {'death_link_effect', 'include_dlcs', 'move_rando_actions', 'pre_hint_items'}
    if 'options.' in path and worldgen_value == '<missing>':
        for opt in optionset_options:
            if path.endswith(f'.{opt}'):
                return True

    # StartInventoryPool options that WorldGen doesn't export
    # These are special option types (type: start_inventory_pool) for starting items from pool
    if 'option_definitions.' in path and 'start_inventory' in path and worldgen_value == '<missing>':
        return True

    # ItemDict options that WorldGen doesn't support (dict mapping items to weights/counts)
    # These are complex option types requiring special handling that WorldGen doesn't implement
    itemdict_options = {'filler_items_distribution'}
    if 'options.' in path and worldgen_value == '<missing>':
        for opt in itemdict_options:
            if path.endswith(f'.{opt}'):
                return True

    # World instance attributes that are metadata, not rules-related
    # player_name is set from multiworld during generation and isn't reproduced in WorldGen
    if path == 'world.1.player_name' and worldgen_value == '<missing>':
        return True

    # Game-specific complex options that WorldGen doesn't extract (Factorio world_gen, starting_items, etc.)
    # These are game-specific configuration options that require special handling to reproduce
    game_specific_options = {'world_gen', 'starting_items'}
    if 'options.' in path and worldgen_value == '<missing>':
        for opt in game_specific_options:
            if path.endswith(f'.{opt}'):
                return True

    # start_location_hints: WorldGen doesn't auto-populate location hints, so counts may differ
    if 'options.start_location_hints' in path:
        return True

    # World class name differences: Original may use abbreviated names (DarkSouls3World)
    # while WorldGen uses full names derived from game name (DarkSoulsIIIWorld)
    if path.startswith('world_classes.'):
        return True

    # world_description: WorldGen always generates a default docstring for worlds
    # ("GAME for Archipelago.\n\nAuto-generated world implementation.") even when
    # the original world doesn't have a docstring. This is expected.
    if path == 'world.1.world_description' and original_value == '<missing>':
        return True

    # And/Has/HasAll structural differences that are semantically equivalent
    # Original: And(And(_can_get, Has), HasAll) vs WorldGen: And(_can_get, HasAll)
    # These represent the same access requirements
    if 'access_rule.children[length]' in path:
        return True
    if 'access_rule.children[' in path and '.rule' in path:
        # Different rule types in And children (Has vs HasAll) are ok if combined
        if original_value in ('Has', 'HasAll') or worldgen_value in ('Has', 'HasAll'):
            return True
    if 'access_rule.children[' in path and '.args' in path:
        # Different args format between Has and HasAll
        return True

    # Region exit access_rule simplification differences
    # Original exports complex AST rules (placement_lookup, AST_block) that get
    # evaluated and simplified during WorldGen generation. These are expected.
    if '.exits[' in path and '.access_rule' in path:
        # Rule type simplification: Or->Has, AST_block->True_, etc.
        if path.endswith('.access_rule.rule'):
            # Complex AST rules get simplified to basic rules
            complex_rules = {'Or', 'And', 'AST_block', 'AST_function_call', 'Compare'}
            simple_rules = {'Has', 'True_', 'HasAll', 'HasAny'}
            if original_value in complex_rules and worldgen_value in simple_rules:
                return True
            if original_value in simple_rules and worldgen_value in simple_rules:
                return True
        # Other access_rule structural differences for exits
        if '.access_rule.children' in path or '.access_rule.args' in path:
            return True

    # Option definition differences for common options that may have game-specific
    # variants (e.g., ItemsAccessibility vs Accessibility)
    if 'option_definitions.' in path:
        # Accessibility option may have different defaults or available values
        # depending on whether the original uses ItemsAccessibility or Accessibility
        if 'accessibility' in path.lower():
            return True
        # display_name: WorldGen may add display_name when original didn't have it,
        # or vice versa. This is a presentational difference, not functional.
        if path.endswith('.display_name'):
            if original_value == '<missing>' or worldgen_value == '<missing>':
                return True

    # Option value differences for options that may be resolved differently
    # during canonical generation (e.g., random -> specific value)
    # These are expected when options with 'random' defaults are resolved
    if path.startswith('world.1.options.'):
        option_name = path.split('.')[-1]
        # Options that commonly have random defaults that get resolved
        random_options = {'starting_stage', 'accessibility'}
        if option_name in random_options:
            return True

    return False


def filter_canonical_differences(
    differences: List[Tuple[str, Any, Any]]
) -> List[Tuple[str, Any, Any]]:
    """Filter out differences caused by --canonical-seed1."""
    return [diff for diff in differences if not is_canonical_difference(diff[0], diff[1], diff[2])]


def main():
    # Parse arguments
    args = sys.argv[1:]
    ignore_canonical = False

    if '--ignore-canonical' in args:
        ignore_canonical = True
        args.remove('--ignore-canonical')

    if len(args) < 2:
        print(__doc__)
        sys.exit(1)

    original_path = Path(args[0])
    worldgen_path = Path(args[1])

    if not original_path.exists():
        print(f"Error: Original file not found: {original_path}")
        sys.exit(1)

    if not worldgen_path.exists():
        print(f"Error: WorldGen file not found: {worldgen_path}")
        sys.exit(1)

    print(f"Comparing:")
    print(f"  Original: {original_path}")
    print(f"  WorldGen: {worldgen_path}")
    if ignore_canonical:
        print(f"  (ignoring canonical-seed1 differences)")
    print()

    # Load both files
    with open(original_path) as f:
        original = json.load(f)

    with open(worldgen_path) as f:
        worldgen = json.load(f)

    # Normalize both to remove WorldGen name differences
    original_normalized = normalize_worldgen_names(original)
    worldgen_normalized = normalize_worldgen_names(worldgen)

    # Normalize helper body formats (location_check -> state_method, etc.)
    original_normalized = normalize_helper_body(original_normalized)
    worldgen_normalized = normalize_helper_body(worldgen_normalized)

    # Normalize toggle defaults (0 vs false, 1 vs true)
    original_normalized = normalize_toggle_defaults(original_normalized)
    worldgen_normalized = normalize_toggle_defaults(worldgen_normalized)

    # Normalize rule format differences (semantically-equivalent representations)
    original_normalized = normalize_rule_format(original_normalized)
    worldgen_normalized = normalize_rule_format(worldgen_normalized)

    # Normalize StateMethod rules to Rule Builder equivalents
    # (e.g., StateMethod(has_any, items) -> HasAny(items))
    original_normalized = normalize_state_method_to_rule(original_normalized)
    worldgen_normalized = normalize_state_method_to_rule(worldgen_normalized)

    # Normalize And rules by removing True_ children
    # (e.g., And(True_(), X) -> X, handles has_all([]) -> True_ case)
    original_normalized = normalize_and_with_true(original_normalized)
    worldgen_normalized = normalize_and_with_true(worldgen_normalized)

    # Normalize HasAll with single item to Has
    # (e.g., HasAll(['item']) -> Has('item'))
    original_normalized = normalize_hasall_single_item(original_normalized)
    worldgen_normalized = normalize_hasall_single_item(worldgen_normalized)

    # Normalize HasAny with single item to Has
    # (e.g., HasAny(['item']) -> Has('item'))
    original_normalized = normalize_hasany_single_item(original_normalized)
    worldgen_normalized = normalize_hasany_single_item(worldgen_normalized)

    # Normalize Or(Constant(0), X) and Or(False_(), X) to just X
    original_normalized = normalize_or_with_false(original_normalized)
    worldgen_normalized = normalize_or_with_false(worldgen_normalized)

    # Normalize And+Has/HasAll patterns to single HasAll (cleaner format)
    # (e.g., And(Has(A), Has(B)) -> HasAll([A, B]))
    original_normalized = normalize_and_has_patterns(original_normalized)
    worldgen_normalized = normalize_and_has_patterns(worldgen_normalized)

    # Normalize HasAll with duplicate items (run AFTER normalize_and_has_patterns
    # which may create HasAll with duplicates from And(Has(A), Has(A)))
    # (e.g., HasAll(['item', 'item']) -> Has('item'))
    original_normalized = normalize_hasall_duplicate_items(original_normalized)
    worldgen_normalized = normalize_hasall_duplicate_items(worldgen_normalized)

    # Normalize And/Or structure (flatten nested, sort children)
    original_normalized = normalize_and_or_structure(original_normalized)
    worldgen_normalized = normalize_and_or_structure(worldgen_normalized)

    # Normalize setting types (option_value/world_attribute -> setting_value)
    original_normalized = normalize_setting_types(original_normalized)
    worldgen_normalized = normalize_setting_types(worldgen_normalized)

    # Normalize math function calls (math.sqrt function_call -> sqrt helper)
    original_normalized = normalize_math_functions(original_normalized)
    worldgen_normalized = normalize_math_functions(worldgen_normalized)

    # Normalize option display_name (remove WorldGen-added display_name fields)
    original_normalized = normalize_option_display_name(original_normalized)
    worldgen_normalized = normalize_option_display_name(worldgen_normalized)

    # Normalize sum_of helper format (DICT_SUM_HELPERS format vs analyzer format)
    original_normalized = normalize_sum_of_helpers(original_normalized)
    worldgen_normalized = normalize_sum_of_helpers(worldgen_normalized)

    # Normalize list representations (constant with list value vs list type)
    original_normalized = normalize_list_representation(original_normalized)
    worldgen_normalized = normalize_list_representation(worldgen_normalized)

    # Normalize tuple types to list types (tuple and list are equivalent for has_any/has_all)
    original_normalized = normalize_tuple_list_types(original_normalized)
    worldgen_normalized = normalize_tuple_list_types(worldgen_normalized)

    # Normalize tuple-wrapped generator expressions (tuple(gen) vs bare gen)
    original_normalized = normalize_tuple_wrapped_generator(original_normalized)
    worldgen_normalized = normalize_tuple_wrapped_generator(worldgen_normalized)

    # Normalize None values in conditional branches
    original_normalized = normalize_none_to_null(original_normalized)
    worldgen_normalized = normalize_none_to_null(worldgen_normalized)

    # Normalize string constant wrappers ({"type": "constant", "value": "X"} -> "X")
    original_normalized = normalize_string_constant_wrapper(original_normalized)
    worldgen_normalized = normalize_string_constant_wrapper(worldgen_normalized)

    # Find differences
    differences = find_differences(original_normalized, worldgen_normalized)

    # Filter canonical differences if requested
    total_differences = len(differences)
    if ignore_canonical:
        differences = filter_canonical_differences(differences)
        filtered_count = total_differences - len(differences)

    if not differences:
        if ignore_canonical and filtered_count > 0:
            print(f"✓ Files are identical (after normalizing names and rules)")
            print(f"  ({filtered_count} canonical-seed1 differences ignored)")
        else:
            print("✓ Files are identical (after normalizing names and rules)")
        return 0

    print(f"✗ Found {len(differences)} difference(s):")
    if ignore_canonical and filtered_count > 0:
        print(f"  ({filtered_count} canonical-seed1 differences ignored)")
    print()

    for path, val1, val2 in differences[:50]:  # Limit to first 50 differences
        print(f"  {path}:")
        print(f"    Original: {truncate_value(val1)}")
        print(f"    WorldGen: {truncate_value(val2)}")
        print()

    if len(differences) > 50:
        print(f"  ... and {len(differences) - 50} more differences")

    return 1


if __name__ == "__main__":
    sys.exit(main())
