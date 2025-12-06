"""shapez game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class ShapezGameExportHandler(GenericGameExportHandler):
    """Export handler for shapez."""
    GAME_NAME = 'shapez'

    # Module paths for automatic helper extraction
    # Helpers are automatically discovered during rule analysis when they're used
    HELPER_MODULES = ['worlds.shapez.regions']
    ITEM_NAME_MODULES = ['worlds.shapez.data.strings']

    # Enable automatic export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Helpers that should NOT be exported as definitions (too complex, need JS implementation)
    # These will remain as helper calls that the frontend JavaScript must handle
    # Note: has_logic_list_building is now supported - list.index() is resolved at analysis time
    HELPERS_TO_EXPORT_BLACKLIST: set[str] = set()

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """
        Extract shapez-specific settings including the 'floating' parameter.

        The 'floating' (has_floating) setting is used by helper functions like
        can_make_stitched_shape and can_build_mam to determine if floating layers
        are allowed.
        """
        # Get base settings
        settings = super().get_settings_data(world, multiworld, player)

        # Add shapez-specific settings
        # 'floating' is computed from options in the world's __init__
        # We need to compute it the same way
        options = world.options
        has_floating = (options.allow_floating_layers.value or
                        not (options.randomize_level_requirements and
                             options.randomize_upgrade_requirements))
        settings['floating'] = has_floating

        return settings

    def should_preserve_as_helper(self, func_name: str) -> bool:
        """
        Tell the analyzer which functions should be preserved as helper calls
        instead of being inlined.

        Args:
            func_name: The name of the function being analyzed

        Returns:
            True if the function should be preserved as a helper call
        """
        # Preserve helper functions as helper calls so they can be exported as
        # reusable definitions or handled by JavaScript fallback.
        # Note: has_x_belt_multiplier and has_logic_list_building are NOT preserved -
        # they get inlined with imperative rule evaluation (block, for_range, assign, etc.)
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
