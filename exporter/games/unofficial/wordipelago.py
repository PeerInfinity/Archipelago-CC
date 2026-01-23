"""Wordipelago game-specific export handler.

Wordipelago uses starred argument unpacking with option-dependent lookups
in its rule definitions:

    lambda state: needed_for_words(state, player, *(rule_logic[logic_difficulty]["green"][str(point_shop_logic_level)]))

The base exporter can't resolve this because:
1. The index depends on str(option.value) which involves a helper call
2. The expression resolver can't evaluate str() with option_value args

This handler intercepts the problematic entrance rule and constructs a
properly formed helper call rule directly, bypassing the normal analysis
that can't handle starred argument unpacking with option-dependent indices.
"""

from typing import Any, Dict, List, Set, Optional, Callable, TYPE_CHECKING
import logging
import inspect
import ast

from ..base import GenericGameExportHandler

logger = logging.getLogger(__name__)


# Copy of rule_logic from the apworld's logicrules.py
# This is the data structure used to look up helper arguments
RULE_LOGIC = {
    1: {
        "green": {
            "1": [0, 0, 1, False],
            "2": [2, 50, 2, True],
            "3": [4, 120, 4, True],
            "4": [5, 170, 5, True],
            "5": [6, 190, 5, True],
        },
        "yellow": {
            "1": [0, 0, 2, True],
            "2": [2, 50, 3, True],
            "3": [4, 120, 4, True],
            "4": [5, 170, 5, True],
            "5": [6, 190, 5, True],
        },
        "letters": [1, 3, 1, False],
        "streak": [6, 190, 5, True]
    },
    2: {
        "green": {
            "1": [0, 0, 1, False],
            "2": [2, 50, 2, False],
            "3": [3, 105, 3, True],
            "4": [5, 150, 5, True],
            "5": [6, 175, 6, True],
        },
        "yellow": {
            "1": [0, 0, 2, True],
            "2": [2, 50, 3, True],
            "3": [3, 105, 3, True],
            "4": [5, 150, 5, True],
            "5": [6, 175, 6, True],
        },
        "letters": [1, 3, 1, False],
        "streak": [6, 175, 6, True]
    },
    3: {
        "green": {
            "1": [0, 0, 1, False],
            "2": [1, 40, 2, False],
            "3": [2, 90, 3, False],
            "4": [4, 120, 4, True],
            "5": [5, 150, 5, True],
        },
        "yellow": {
            "1": [0, 0, 2, True],
            "2": [2, 40, 3, True],
            "3": [4, 90, 4, True],
            "4": [5, 120, 5, True],
            "5": [6, 150, 6, True],
        },
        "letters": [1, 3, 1, False],
        "streak": [6, 150, 6, True]
    },
    4: {
        "green": {
            "1": [0, 0, 1, False],
            "2": [2, 30, 2, False],
            "3": [3, 75, 3, False],
            "4": [4, 100, 4, True],
            "5": [5, 125, 5, True],
        },
        "yellow": {
            "1": [0, 0, 1, True],
            "2": [1, 30, 1, True],
            "3": [2, 75, 2, True],
            "4": [3, 100, 3, True],
            "5": [4, 125, 4, True],
        },
        "letters": [1, 3, 1, False],
        "streak": [4, 125, 4, True]
    },
    5: {
        "green": {
            "1": [0, 0, 1, False],
            "2": [1, 20, 2, False],
            "3": [2, 60, 2, False],
            "4": [3, 85, 3, False],
            "5": [3, 100, 3, True],
        },
        "yellow": {
            "1": [0, 0, 1, True],
            "2": [1, 20, 2, True],
            "3": [2, 60, 2, True],
            "4": [3, 85, 3, True],
            "5": [3, 100, 3, True],
        },
        "letters": [1, 3, 1, False],
        "streak": [3, 100, 3, True]
    }
}


class WordipelagoGameExportHandler(GenericGameExportHandler):
    """Wordipelago game handler - resolves starred arg unpacking for needed_for_words."""

    GAME_NAME = 'Wordipelago'

    # Preserve needed_for_words as a helper (we just need to fix its args)
    HELPERS_TO_PRESERVE: Set[str] = {'needed_for_words', 'needed_for_letter', 'end_game_event_check', 'all_needed_locations_checked'}

    # Export these helpers as definitions so the world generator can use them
    HELPERS_TO_EXPORT_WHITELIST: Set[str] = {'needed_for_words', 'needed_for_letter', 'end_game_event_check', 'all_needed_locations_checked'}

    # Specify helper modules for discovery
    HELPER_MODULES: List[str] = ['worlds.wordipelago.rules']

    AUTO_DISCOVER_WORLD_HELPER_MODULES = True
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._logic_difficulty = None
        self._point_shop_logic_level = None
        self._world = None

    def _get_option_values_from_world(self, world) -> None:
        """Extract relevant option values from the world."""
        self._world = world
        if hasattr(world, 'options'):
            if hasattr(world.options, 'logic_difficulty'):
                self._logic_difficulty = world.options.logic_difficulty.value
            if hasattr(world.options, 'point_shop_logic_level'):
                self._point_shop_logic_level = world.options.point_shop_logic_level.value

        logger.info(f"Wordipelago options extracted: logic_difficulty={self._logic_difficulty}, "
                    f"point_shop_logic_level={self._point_shop_logic_level}")

    def _extract_world_from_lambda(self, access_rule: Callable) -> Optional[Any]:
        """Extract the world object from a lambda's closure."""
        try:
            if hasattr(access_rule, '__closure__') and access_rule.__closure__:
                for cell in access_rule.__closure__:
                    cell_contents = cell.cell_contents
                    # Check if this looks like a world object
                    if hasattr(cell_contents, 'options') and hasattr(cell_contents, 'player'):
                        logger.debug(f"Found world object in closure: {type(cell_contents).__name__}")
                        return cell_contents
        except Exception as e:
            logger.debug(f"Could not extract world from lambda closure: {e}")
        return None

    def _get_rule_logic_args(self, category: str, level: str) -> Optional[List[Any]]:
        """Look up args from RULE_LOGIC based on current option values."""
        if self._logic_difficulty is None:
            return None

        try:
            difficulty_rules = RULE_LOGIC.get(self._logic_difficulty, {})
            category_rules = difficulty_rules.get(category, {})
            args_list = category_rules.get(level)
            return args_list
        except (KeyError, TypeError) as e:
            logger.warning(f"Failed to look up RULE_LOGIC[{self._logic_difficulty}]['{category}']['{level}']: {e}")
            return None

    def _build_helper_call_rule(self, helper_name: str, args: List[Any]) -> Dict[str, Any]:
        """Build a helper call rule dict with the given arguments."""
        # Convert args to Constant rule format
        arg_rules = []
        for arg in args:
            arg_rules.append({
                'rule': 'Constant',
                'args': {'value': arg},
                '_converted_from_ast': True
            })

        return {
            'rule': helper_name,
            '_original_ast_type': 'helper',
            '_converted_from_ast': True,
            'args': arg_rules
        }

    def _has_starred_rule_logic_pattern(self, access_rule: Callable) -> bool:
        """Check if an access rule lambda has the starred rule_logic pattern."""
        try:
            source = inspect.getsource(access_rule)
            # Look for the pattern: *(rules_for_difficulty["..."][...])
            if 'rules_for_difficulty' in source and '*(' in source:
                return True
        except (OSError, TypeError):
            pass
        return False

    def _extract_category_from_source(self, source: str) -> Optional[str]:
        """Extract the category ("green" or "yellow") from the lambda source."""
        if '"green"' in source or "'green'" in source:
            return "green"
        if '"yellow"' in source or "'yellow'" in source:
            return "yellow"
        return None

    def _extract_level_from_source(self, source: str) -> Optional[str]:
        """Extract the level index from the lambda source.

        Handles two patterns:
        1. Literal index: rules_for_difficulty["green"]["1"]
        2. Option-based: rules_for_difficulty["green"][str(world.options.point_shop_logic_level.value)]
        """
        import re

        # Pattern 1: Literal string index like ["1"], ["2"], etc.
        # Look for the second subscript after "green" or "yellow"
        literal_match = re.search(r'\["(?:green|yellow)"\]\s*\[\s*["\'](\d+)["\']\s*\]', source)
        if literal_match:
            return literal_match.group(1)

        # Pattern 2: point_shop_logic_level option
        if 'point_shop_logic_level' in source:
            return str(self._point_shop_logic_level) if self._point_shop_logic_level is not None else None

        return None

    def handle_complex_entrance_rule(self, entrance_name: str, access_rule_method) -> Optional[Dict[str, Any]]:
        """
        Intercept entrance rules that use starred rule_logic unpacking.

        The Letters -> Point Shop entrance has:
            lambda state: needed_for_words(state, world.player,
                *(rules_for_difficulty["green"][str(world.options.point_shop_logic_level.value)]))

        We detect this pattern and construct the helper call rule directly
        with the args resolved from RULE_LOGIC.
        """
        # Check if this is a lambda with the starred rule_logic pattern
        if not callable(access_rule_method):
            return None

        if not self._has_starred_rule_logic_pattern(access_rule_method):
            return None

        # Try to extract world from lambda closure if we don't have option values yet
        if self._logic_difficulty is None or self._point_shop_logic_level is None:
            world = self._extract_world_from_lambda(access_rule_method)
            if world:
                self._get_option_values_from_world(world)

        # Still no option values - can't handle this rule
        if self._logic_difficulty is None or self._point_shop_logic_level is None:
            logger.warning(f"Cannot handle '{entrance_name}': option values not available")
            return None

        try:
            source = inspect.getsource(access_rule_method)
            logger.info(f"Detected starred rule_logic pattern in '{entrance_name}': {source.strip()}")

            # Extract the category from the source
            category = self._extract_category_from_source(source)
            if not category:
                logger.warning(f"Could not extract category from source: {source}")
                return None

            # Extract the level index from the source
            level_str = self._extract_level_from_source(source)
            if not level_str:
                logger.warning(f"Could not extract level from source: {source}")
                return None

            # Look up the args
            args = self._get_rule_logic_args(category, level_str)
            if args is None:
                logger.warning(f"Could not find args for RULE_LOGIC[{self._logic_difficulty}]['{category}']['{level_str}']")
                return None

            logger.info(f"Resolved '{entrance_name}' args: needed_for_words({category}/{level_str}) = {args}")

            # Build the helper call rule
            return self._build_helper_call_rule('needed_for_words', args)

        except Exception as e:
            logger.warning(f"Error handling complex entrance rule for '{entrance_name}': {e}")
            return None

    def handle_complex_exit_rule(self, exit_name: str, access_rule_method) -> Optional[Dict[str, Any]]:
        """Handle complex exit rules the same way as entrance rules."""
        return self.handle_complex_entrance_rule(exit_name, access_rule_method)
