"""Landstalker - The Treasures of King Nole game-specific export handler."""

from typing import Dict, Any, List, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class LandstalkerGameExportHandler(GenericGameExportHandler):
    """Export handler for Landstalker - The Treasures of King Nole.

    This handler extends GenericGameExportHandler to provide custom handling
    for Landstalker-specific rule patterns, particularly:
    - Region visit tracking via event_visited_* items
    - Converting Region objects to their string codes in closures
    - Resolving all_of iterator patterns for region requirements
    """


    # Use resolved_items from sphere log for event item handling
    USE_RESOLVED_ITEMS = True


    def __init__(self):
        super().__init__()
        # Stack to track required_regions for nested rule processing
        self._regions_stack = []

    # Don't preserve _landstalker_has_visited_regions as a helper - let it be inlined
    # so that the required_regions parameter gets resolved to actual values

    def prepare_closure_vars(self, rule_func, closure_vars: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare closure variables before rule analysis.

        For Landstalker, this converts Region objects in required_regions to their codes
        so they can be properly serialized during analysis, and stores them for expansion.
        """
        if not callable(rule_func):
            return closure_vars

        # Log closure variable names for debugging
        logger.debug(f"prepare_closure_vars called, closure vars: {list(closure_vars.keys())}")

        # Make a copy to avoid modifying the original
        enhanced_closure = closure_vars.copy()

        # Check if 'required_regions' exists in closure_vars and contains Region objects
        if 'required_regions' in enhanced_closure:
            required_regions = enhanced_closure['required_regions']

            # If it's a list, process it (could be empty or contain Region objects)
            if isinstance(required_regions, list):
                if len(required_regions) == 0:
                    # Empty list - no regions required
                    logger.debug(f"Found empty required_regions list")
                    # Store empty list in stack for use during expansion phase
                    self._regions_stack.append([])
                elif hasattr(required_regions[0], 'code'):
                    # Convert Region objects to their codes
                    region_codes = [r.code for r in required_regions]
                    logger.debug(f"Converting required_regions from Region objects to codes: {region_codes}")
                    enhanced_closure['required_regions'] = region_codes

                    # Store in stack for use during expansion phase
                    self._regions_stack.append(region_codes)

        return enhanced_closure

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand rule functions with Landstalker-specific handling.

        Handles Landstalker-specific patterns:
        - all_of with unresolved iterator (from generator expressions over regions)
        - item_check with binary_op for event_visited_ + region.code
        - _landstalker_has_visited_regions helper expansion

        Note: state.has_all(set(items)) is now handled by the base class.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # First, recursively expand nested structures
        if 'conditions' in rule and isinstance(rule['conditions'], list):
            rule = rule.copy()  # Make a copy to avoid modifying the original
            rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule['conditions']]

        # Handle all_of pattern with unresolved iterator
        # This comes from: all(state.has("event_visited_" + region.code, player) for region in regions)
        if rule.get('type') == 'all_of':
            return self._resolve_all_of_iterator(rule)

        # Handle item_check with binary_op pattern for event_visited_ + region.code
        # This comes from inlined _landstalker_has_visited_regions
        if rule.get('type') == 'item_check':
            item = rule.get('item', {})
            if isinstance(item, dict) and item.get('type') == 'binary_op':
                simplified_item = self._simplify_region_event_binary_op(item)
                if simplified_item is not None:
                    return {"type": "item_check", "item": simplified_item}

        # Handle _landstalker_has_visited_regions helper call directly
        # This helper checks that all specified regions have been visited via event items
        # Pattern: {"type": "helper", "name": "_landstalker_has_visited_regions", "args": [...]}
        if rule.get('type') == 'helper' and rule.get('name') == '_landstalker_has_visited_regions':
            return self._expand_has_visited_regions_helper(rule)

        # Let parent handle standard cases (including has_all/has_any expansion)
        return super().expand_rule(rule, _depth)

    def _expand_has_visited_regions_helper(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Expand _landstalker_has_visited_regions helper to item_check conditions.

        Converts:
          {"type": "helper", "name": "_landstalker_has_visited_regions",
           "args": [{"type": "constant", "value": ["Region1", "Region2"]}]}
        To:
          {"type": "and", "conditions": [
            {"type": "item_check", "item": "event_visited_region1"},
            {"type": "item_check", "item": "event_visited_region2"}
          ]}
        """
        args = rule.get('args', [])

        if not args:
            logger.debug("_landstalker_has_visited_regions called with no args, returning True")
            return {"type": "constant", "value": True}

        # Extract regions from the first argument (should be a constant list or a list)
        regions_arg = args[0]
        region_names = []

        if isinstance(regions_arg, dict):
            if regions_arg.get('type') == 'constant':
                value = regions_arg.get('value', [])
                if isinstance(value, list):
                    region_names = value
            elif regions_arg.get('type') == 'list':
                # Handle list type if present
                elements = regions_arg.get('elements', [])
                for elem in elements:
                    if isinstance(elem, dict) and elem.get('type') == 'constant':
                        region_names.append(elem.get('value'))
                    elif isinstance(elem, str):
                        region_names.append(elem)
        elif isinstance(regions_arg, list):
            region_names = regions_arg

        if not region_names:
            logger.debug("No region names found in _landstalker_has_visited_regions args")
            return {"type": "constant", "value": True}

        # Convert region names to codes and build conditions
        region_codes = self._normalize_region_codes(region_names)
        logger.debug(f"Expanding _landstalker_has_visited_regions: {region_names} -> {region_codes}")

        return self._build_event_visited_conditions(region_codes)

    def _resolve_all_of_iterator(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve unresolved iterator in all_of rules.

        Detects the pattern:
        {
          "type": "all_of",
          "element_rule": {"type": "item_check", "item": {"type": "binary_op", ...}},
          "iterator_info": {
            "iterator": {"type": "name", "name": "regions"}  <-- unresolved
            OR
            "iterator": {"type": "constant", "value": ["Massan", ...]}  <-- already resolved
          }
        }

        And converts it to a concrete list of item checks.
        """
        iterator_info = rule.get('iterator_info', {})
        iterator = iterator_info.get('iterator', {})
        element_rule = rule.get('element_rule', {})

        logger.debug(f"_resolve_all_of_iterator called, iterator type: {iterator.get('type') if isinstance(iterator, dict) else type(iterator)}, stack size: {len(self._regions_stack)}")

        # Check if this is the event_visited_ + region.code pattern
        is_event_visited_pattern = self._is_event_visited_pattern(element_rule)

        if isinstance(iterator, dict):
            # Check if iterator is an unresolved name reference
            if iterator.get('type') == 'name':
                iter_name = iterator.get('name')

                # Check if this is the 'regions' variable we need to resolve
                if iter_name == 'regions' and self._regions_stack:
                    # Pop the most recent regions list from our stack
                    region_codes = self._regions_stack.pop() if self._regions_stack else None

                    if region_codes is not None:
                        logger.debug(f"Resolving all_of iterator 'regions' to: {region_codes}")
                        return self._build_event_visited_conditions(region_codes)

            # Check if iterator is a constant list (already resolved)
            elif iterator.get('type') == 'constant' and is_event_visited_pattern:
                iterator_value = iterator.get('value', [])
                if isinstance(iterator_value, list) and len(iterator_value) > 0:
                    # The values are region names/codes - convert to codes if needed
                    region_codes = self._normalize_region_codes(iterator_value)
                    logger.debug(f"Resolving all_of with constant iterator to: {region_codes}")
                    return self._build_event_visited_conditions(region_codes)

        # Couldn't resolve, return as-is
        return rule

    def _is_event_visited_pattern(self, element_rule: Dict[str, Any]) -> bool:
        """Check if element_rule matches the event_visited_ + region.code pattern."""
        if element_rule.get('type') != 'item_check':
            return False

        item = element_rule.get('item', {})
        if not isinstance(item, dict) or item.get('type') != 'binary_op':
            return False

        if item.get('op') != '+':
            return False

        left = item.get('left', {})
        if left.get('type') == 'constant' and left.get('value') == 'event_visited_':
            return True

        return False

    def _normalize_region_codes(self, values: List) -> List[str]:
        """Convert region names/objects to region codes.

        Region codes are lowercase identifiers like 'massan', 'helga_hut', etc.
        Region names are human-readable like 'Massan', "Witch Helga's Hut", etc.
        """
        result = []
        for val in values:
            if hasattr(val, 'code'):
                # It's a Region object
                result.append(val.code)
            elif isinstance(val, str):
                # It's a string - could be name or code
                # Convert to code format: lowercase, replace spaces with underscores,
                # remove special characters
                code = val.lower().replace(' ', '_').replace("'", "").replace('-', '_')
                result.append(code)
            else:
                # Unknown type, try str conversion
                result.append(str(val).lower())
        return result

    def _build_event_visited_conditions(self, region_codes: List[str]) -> Dict[str, Any]:
        """Build AND conditions for event_visited_ checks."""
        conditions = []
        for region_code in region_codes:
            # Build the item name: "event_visited_" + region_code
            event_name = f"event_visited_{region_code}"
            condition = {
                "type": "item_check",
                "item": event_name
            }
            conditions.append(condition)

        # Convert to AND of all conditions
        if len(conditions) == 0:
            # Empty list, always true
            return {"type": "constant", "value": True}
        elif len(conditions) == 1:
            # Single condition
            return conditions[0]
        else:
            # Multiple conditions, AND them
            return {
                "type": "and",
                "conditions": conditions
            }

    def _simplify_region_event_binary_op(self, binary_op: Dict[str, Any]) -> Optional[str]:
        """Simplify binary_op pattern for region event names.

        Detects the pattern:
        {
          "type": "binary_op",
          "left": {"type": "constant", "value": "event_visited_"},
          "op": "+",
          "right": {
            "type": "attribute",
            "object": {"type": "constant", "value": "region_code"},
            "attr": "code"
          }
        }

        And returns: "event_visited_region_code"
        """
        logger.debug(f"_simplify_region_event_binary_op called, op: {binary_op.get('op')}")

        if binary_op.get('op') != '+':
            return None

        left = binary_op.get('left', {})
        right = binary_op.get('right', {})

        # Check if left is the constant "event_visited_"
        if left.get('type') == 'constant' and left.get('value') == 'event_visited_':
            # Check if right is trying to access .code attribute
            if right.get('type') == 'attribute' and right.get('attr') == 'code':
                obj = right.get('object', {})
                # The object should be a constant (could be Region object or string)
                if obj.get('type') == 'constant':
                    region_value = obj.get('value')

                    # Check if it's a Region object
                    if hasattr(region_value, 'code'):
                        # It's a LandstalkerRegion object, extract the code
                        region_code = region_value.code
                        logger.debug(f"Simplified region event binary_op: Region({region_value.name}) -> event_visited_{region_code}")
                        return f"event_visited_{region_code}"
                    elif isinstance(region_value, str):
                        # It's already a string (region name or code)
                        # Convert region name to code format
                        region_code = region_value.lower().replace(' ', '_').replace('(', '').replace(')', '')
                        logger.debug(f"Simplified region event binary_op: '{region_value}' -> 'event_visited_{region_code}'")
                        return f"event_visited_{region_code}"

        logger.debug(f"Could not simplify binary_op: left={left}, right={right}")
        return None

