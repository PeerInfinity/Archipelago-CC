"""Super Mario Land 2 game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class MarioLand2GameExportHandler(GenericGameExportHandler):
    """Export handler for Super Mario Land 2.

    Super Mario Land 2 uses custom helper functions for pipe traversal,
    auto-scroll checks, level progression, and zone-specific logic.
    We inherit from GenericGameExportHandler to preserve these helpers.
    """
    GAME_NAME = 'Super Mario Land 2'

    # Functions that should be exported as helper calls rather than analyzed
    HELPER_FUNCTIONS = {
        'is_auto_scroll',
        'has_pipe_right',
        'has_pipe_left',
        'has_pipe_down',
        'has_pipe_up',
        'has_level_progression',
        'pumpkin_zone_1_midway_bell',
        'pumpkin_zone_1_normal_exit',
        'not_blocked_by_sharks',
        'turtle_zone_1_normal_exit',
        'mario_zone_1_normal_exit',
        'mario_zone_1_midway_bell',
        'macro_zone_1_normal_exit',
        'macro_zone_1_midway_bell',
        'tree_zone_2_normal_exit',
        'tree_zone_2_secret_exit',
        'tree_zone_2_midway_bell',
        'tree_zone_3_normal_exit',
        'tree_zone_4_normal_exit',
        'tree_zone_4_midway_bell',
        'tree_zone_5_boss',
        'pumpkin_zone_2_normal_exit',
        'pumpkin_zone_2_secret_exit',
        'pumpkin_zone_3_secret_exit',
        'pumpkin_zone_4_boss',
        'mario_zone_1_secret_exit',
        'mario_zone_2_normal_exit',
        'mario_zone_2_secret_exit',
        'mario_zone_3_secret_exit',
        'mario_zone_4_boss',
        'turtle_zone_2_normal_exit',
        'turtle_zone_2_midway_bell',
        'turtle_zone_secret_course_normal_exit',
        'space_zone_1_normal_exit',
        'space_zone_1_secret_exit',
        'space_zone_2_midway_bell',
        'space_zone_2_normal_exit',
        'space_zone_2_secret_exit',
        'space_zone_3_boss',
        'macro_zone_1_secret_exit',
        'macro_zone_2_normal_exit',
        'macro_zone_2_midway_bell',
        'macro_zone_3_boss',
        'mushroom_zone_coins',
        'tree_zone_1_coins',
        'tree_zone_2_coins',
        'tree_zone_3_coins',
        'tree_zone_4_coins',
        'tree_zone_5_coins',
        'pumpkin_zone_1_coins',
        'pumpkin_zone_2_coins',
        'pumpkin_zone_secret_course_1_coins',
        'pumpkin_zone_3_coins',
        'pumpkin_zone_4_coins',
        'mario_zone_1_coins',
        'mario_zone_2_coins',
        'mario_zone_3_coins',
        'mario_zone_4_coins',
        'turtle_zone_1_coins',
        'turtle_zone_2_coins',
        'turtle_zone_secret_course_coins',
        'space_zone_1_coins',
        'space_zone_2_coins',
        'space_zone_3_coins',
        'macro_zone_1_coins',
        'macro_zone_2_coins',
        'macro_zone_3_coins',
        'hippo_zone_coins'
    }

    def should_preserve_as_helper(self, func_name: str) -> bool:
        """Check if a function should be preserved as a helper call."""
        return func_name in self.HELPER_FUNCTIONS

    def should_process_multistatement_if_bodies(self) -> bool:
        """
        Enable processing of if-statements with multiple statements in the body.

        Mario Land 2 has complex rule functions with multiple if-statements that
        need to be combined into compound conditions for proper export.
        """
        return True

    def should_recursively_analyze_closures(self) -> bool:
        """
        Enable recursive analysis of closure variable function calls.

        Mario Land 2 needs closure variables to be recursively analyzed and inlined
        to properly export the complex rule logic used in this game.
        """
        return True

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Override expand_rule to prevent auto-expansion of our helper functions
        and to resolve self.options.* references to constant values.

        The generic exporter tries to auto-expand helpers matching patterns like has_*,
        but we want to preserve our helper functions as-is for the frontend to implement.
        """
        if not rule:
            return rule

        # Debug: log all attribute rules to see what we're getting
        if rule.get('type') == 'attribute':
            logger.debug(f"[marioland2] expand_rule called with attribute: attr={rule.get('attr')}, object={rule.get('object')}")

        # Resolve self.options.required_golden_coins to a constant value
        # Check if this is the nested attribute access pattern
        is_required_coins = (
            rule.get('type') == 'attribute' and
            rule.get('attr') == 'required_golden_coins' and
            rule.get('object', {}).get('type') == 'attribute' and
            rule.get('object', {}).get('attr') == 'options' and
            rule.get('object', {}).get('object', {}).get('type') == 'name' and
            rule.get('object', {}).get('object', {}).get('name') == 'self'
        )

        if is_required_coins:
            # Debug: log that we found the pattern
            logger.info("[marioland2] Found self.options.required_golden_coins pattern, resolving to constant")

            # Get the value from the world's options if available
            # Note: We need to get the world instance to access its options
            # For now, try to get it from _world if it was set earlier
            if hasattr(self, '_world'):
                world = self._world
            else:
                # Try to get it from get_all_worlds()
                worlds = self.get_all_worlds()
                world = worlds[0] if worlds else None

            if world and hasattr(world, 'options') and hasattr(world.options, 'required_golden_coins'):
                value = world.options.required_golden_coins.value
                logger.info(f"[marioland2] Resolved to value: {value}")
                return {'type': 'constant', 'value': value}
            else:
                # Fallback to default value (6 is the default for this option)
                logger.warning("[marioland2] Could not resolve self.options.required_golden_coins, using default value 6")
                return {'type': 'constant', 'value': 6}

        # For state_method rules, recursively expand args to catch nested attribute access
        if rule.get('type') == 'state_method':
            args = rule.get('args', [])
            if args:
                rule['args'] = [self.expand_rule(arg) if isinstance(arg, dict) and 'type' in arg else arg for arg in args]
            # Continue with parent processing
            return super().expand_rule(rule)

        # For our helper functions, preserve them without expansion
        if rule.get('type') == 'helper':
            helper_name = rule.get('name', '')
            if helper_name in self.HELPER_FUNCTIONS:
                # Recursively expand any arguments, but preserve the helper itself
                args = rule.get('args', [])
                if args:
                    rule['args'] = [self.expand_rule(arg) if isinstance(arg, dict) and 'type' in arg else arg for arg in args]
                return rule

        # For all other rules, use the parent's expansion logic
        return super().expand_rule(rule)

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract Super Mario Land 2 settings including player options."""
        # Store world reference for use in expand_rule
        self._world = world

        # Get base settings from parent
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Add Mario Land 2 specific options that are referenced in rules
        if hasattr(world, 'options'):
            # Export required_golden_coins as it's used in access rules
            required_coins = getattr(world.options, 'required_golden_coins', None)
            if required_coins is not None:
                settings_dict['required_golden_coins'] = getattr(required_coins, 'value', required_coins)

        return settings_dict
