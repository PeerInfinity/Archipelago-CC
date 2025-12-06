"""shapez game-specific export handler."""

from typing import Dict, Any, Set
from .generic import GenericGameExportHandler
from exporter.analyzer import analyze_rule
import logging
import inspect

logger = logging.getLogger(__name__)


class ShapezGameExportHandler(GenericGameExportHandler):
    """Export handler for shapez."""
    GAME_NAME = 'shapez'

    # Helpers that should be exported as rule definitions in rules.json
    # The frontend can evaluate these directly without needing JavaScript implementations
    HELPERS_TO_EXPORT_WHITELIST = {
        'can_cut_half',      # state.has(ITEMS.cutter, player)
        'can_stack',         # state.has(ITEMS.stacker, player)
        'can_mix_colors',    # state.has(ITEMS.color_mixer, player)
        'can_rotate_90',     # state.has_any((ITEMS.rotator, ITEMS.rotator_ccw), player)
        'can_rotate_180',    # state.has_any((ITEMS.rotator, ITEMS.rotator_ccw, ITEMS.rotator_180), player)
        'has_tunnel',        # state.has_any((ITEMS.tunnel, ITEMS.tunnel_tier_ii), player)
    }

    # Helpers that should NOT be exported as definitions (too complex, need JS implementation)
    HELPERS_TO_EXPORT_BLACKLIST = set()

    def get_helpers_to_export_whitelist(self) -> Set[str]:
        """Return the set of helpers to export as definitions."""
        return self.HELPERS_TO_EXPORT_WHITELIST

    def get_helpers_to_export_blacklist(self) -> Set[str]:
        """Return the set of helpers to NOT export as definitions."""
        return self.HELPERS_TO_EXPORT_BLACKLIST

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """
        Extract helper function definitions and return them as rule structures.

        For shapez, we analyze the helper functions from regions.py and convert
        them to rule structures that the frontend can evaluate directly.
        """
        helper_definitions = {}

        whitelist = self.get_helpers_to_export_whitelist()
        blacklist = self.get_helpers_to_export_blacklist()

        if not whitelist:
            return helper_definitions

        # Import the shapez regions module to get the helper functions
        try:
            from worlds.shapez import regions as shapez_regions
        except ImportError as e:
            logger.warning(f"Could not import shapez regions module: {e}")
            return helper_definitions

        for helper_name in whitelist:
            if helper_name in blacklist:
                continue

            # Get the function from the regions module
            if not hasattr(shapez_regions, helper_name):
                logger.warning(f"Helper function '{helper_name}' not found in shapez regions")
                continue

            helper_func = getattr(shapez_regions, helper_name)

            # Analyze the function to get its rule structure
            try:
                rule = analyze_rule(
                    rule_func=helper_func,
                    game_handler=self,
                    player_context=world.player if hasattr(world, 'player') else None
                )

                # Clean up the rule - we need to resolve any remaining attribute nodes
                rule = self._clean_helper_rule(rule, world)

                if rule and rule.get('type') != 'error':
                    helper_definitions[helper_name] = rule
                    logger.debug(f"Exported helper '{helper_name}': {rule}")
                else:
                    logger.warning(f"Failed to analyze helper '{helper_name}': {rule}")
            except Exception as e:
                logger.error(f"Error analyzing helper '{helper_name}': {e}")

        return helper_definitions

    def _clean_helper_rule(self, rule: Dict[str, Any], world) -> Dict[str, Any]:
        """
        Clean up a helper rule by resolving attribute nodes and simplifying structure.

        This handles cases where the analyzer produces attribute nodes like
        ITEMS.cutter that need to be resolved to actual item names.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Resolve item_check with attribute-based item names
        if rule_type == 'item_check':
            item = rule.get('item')
            if isinstance(item, dict) and item.get('type') == 'attribute':
                resolved_item = self._resolve_item_attribute(item)
                if resolved_item:
                    rule['item'] = resolved_item
            return rule

        # Handle state.has(item, player) -> item_check
        if rule_type == 'state_method' and rule.get('method') == 'has':
            args = rule.get('args', [])
            if len(args) >= 1:
                item_arg = args[0]
                if isinstance(item_arg, dict) and item_arg.get('type') == 'attribute':
                    resolved_item = self._resolve_item_attribute(item_arg)
                    if resolved_item:
                        return {'type': 'item_check', 'item': resolved_item}
                elif isinstance(item_arg, dict) and item_arg.get('type') == 'constant':
                    return {'type': 'item_check', 'item': item_arg.get('value')}
            return rule

        # Handle state.has_any((items), player) -> or of item_checks
        if rule_type == 'state_method' and rule.get('method') == 'has_any':
            args = rule.get('args', [])
            if len(args) >= 1:
                items_arg = args[0]
                items = self._resolve_items_tuple(items_arg)
                if items:
                    # Create an OR of item_checks
                    return {
                        'type': 'or',
                        'conditions': [{'type': 'item_check', 'item': item} for item in items]
                    }
            return rule

        # Handle state.has_all((items), player) -> and of item_checks
        if rule_type == 'state_method' and rule.get('method') == 'has_all':
            args = rule.get('args', [])
            if len(args) >= 1:
                items_arg = args[0]
                items = self._resolve_items_tuple(items_arg)
                if items:
                    # Create an AND of item_checks
                    return {
                        'type': 'and',
                        'conditions': [{'type': 'item_check', 'item': item} for item in items]
                    }
            return rule

        # Recursively clean conditions
        if rule_type in ['and', 'or']:
            rule['conditions'] = [self._clean_helper_rule(c, world) for c in rule.get('conditions', [])]
            return rule

        if rule_type == 'not':
            rule['condition'] = self._clean_helper_rule(rule.get('condition'), world)
            return rule

        return rule

    def _resolve_item_attribute(self, attr_node: Dict[str, Any]) -> str:
        """
        Resolve an attribute node (like ITEMS.cutter) to an item name string.
        """
        if not attr_node or attr_node.get('type') != 'attribute':
            return None

        attr_name = attr_node.get('attr')
        obj = attr_node.get('object', {})

        # Check if this is ITEMS.something
        if obj.get('type') == 'name' and obj.get('name') == 'ITEMS':
            # Import the ITEMS module to resolve the attribute
            try:
                from worlds.shapez.data.strings import ITEMS
                if hasattr(ITEMS, attr_name):
                    return getattr(ITEMS, attr_name)
            except ImportError:
                pass

        return None

    def _resolve_items_tuple(self, tuple_node: Dict[str, Any]) -> list:
        """
        Resolve a tuple of item attributes (like (ITEMS.rotator, ITEMS.rotator_ccw))
        to a list of item name strings.

        Also handles the case where the analyzer has already resolved the items
        to a constant value containing a list of strings.
        """
        if not tuple_node:
            return None

        items = []

        # Handle constant type with list value (already resolved by analyzer)
        if tuple_node.get('type') == 'constant':
            value = tuple_node.get('value')
            if isinstance(value, list):
                return value
            elif isinstance(value, tuple):
                return list(value)

        # Handle tuple type
        if tuple_node.get('type') == 'tuple':
            elements = tuple_node.get('elements', [])
            for elem in elements:
                if elem.get('type') == 'attribute':
                    item_name = self._resolve_item_attribute(elem)
                    if item_name:
                        items.append(item_name)
                elif elem.get('type') == 'constant':
                    items.append(elem.get('value'))

        # Handle list type
        elif tuple_node.get('type') == 'list':
            elements = tuple_node.get('elements', [])
            for elem in elements:
                if elem.get('type') == 'attribute':
                    item_name = self._resolve_item_attribute(elem)
                    if item_name:
                        items.append(item_name)
                elif elem.get('type') == 'constant':
                    items.append(elem.get('value'))

        return items if items else None

    def should_preserve_as_helper(self, func_name: str) -> bool:
        """
        Tell the analyzer which functions should be preserved as helper calls
        instead of being inlined.

        Args:
            func_name: The name of the function being analyzed

        Returns:
            True if the function should be preserved as a helper call
        """
        # Preserve has_logic_list_building as a helper
        # This function takes closure variables (buildings list, index) that
        # can't be properly resolved by the analyzer
        if func_name == 'has_logic_list_building':
            return True

        # All other shapez helper functions should also be preserved
        # This includes: can_cut_half, can_rotate_90, can_stack, can_paint, etc.
        shapez_helpers = {
            'can_cut_half',
            'can_rotate_90',
            'can_rotate_180',
            'can_stack',
            'can_paint',
            'can_mix_colors',
            'has_tunnel',
            'has_balancer',
            'can_use_quad_painter',
            'can_make_stitched_shape',
            'can_build_mam',
            'can_make_east_windmill',
            'can_make_half_half_shape',
            'can_make_half_shape',
            'has_x_belt_multiplier',
        }

        return func_name in shapez_helpers

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Override expand_rule to preserve helper functions as-is.

        shapez uses many helper functions (can_cut_half, can_stack, etc.)
        that should remain as helper calls rather than being expanded to
        capability rules or other inferred types.
        """
        if not rule:
            return rule

        # For helper rules, just return them as-is without expansion
        if rule.get('type') == 'helper':
            return rule

        # Handle __analyzed_func__ using parent logic
        if rule.get('type') == 'state_method' and rule.get('method') == '__analyzed_func__':
            if 'original' in rule:
                return self._analyze_original_rule(rule['original'])
            return self._infer_rule_type(rule)

        # Recursively expand conditions in and/or rules
        if rule['type'] in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]

        return rule
