"""Yoshi's Island game-specific export handler."""

import logging
from typing import Any, Callable, Dict, Optional
from .generic import GenericGameExportHandler

logger = logging.getLogger(__name__)


# Default boss order when world.boss_order is not set
DEFAULT_BOSS_ORDER = [
    "Burt The Bashful's Boss Room",
    "Salvo The Slime's Boss Room",
    "Bigger Boo's Boss Room",
    "Roger The Ghost's Boss Room",
    "Prince Froggy's Boss Room",
    "Naval Piranha's Boss Room",
    "Marching Milde's Boss Room",
    "Hookbill The Koopa's Boss Room",
    "Sluggy The Unshaven's Boss Room",
    "Raphael The Raven's Boss Room",
    "Tap-Tap The Red Nose's Boss Room"
]


def _get_option(world, option_name: str, default: Any = None) -> Any:
    """Helper to safely extract option value from world."""
    if not hasattr(world, 'options'):
        return default
    option = getattr(world.options, option_name, None)
    if option is None:
        return default
    return getattr(option, 'value', option)


class YoshisIslandGameExportHandler(GenericGameExportHandler):
    """Export handler for Yoshi's Island.

    Uses declarative class attributes for configuration:
    - HELPER_OBJECT_NAMES: Converts logic.method() and bosses.method() to helpers
    - HELPERS_TO_EXPORT_WHITELIST: Exports these helpers as definitions
    - WORLD_ATTRIBUTES: Computes settings needed by helpers from world options
    """

    # Convert logic.method() and bosses.method() calls to helper functions
    HELPER_OBJECT_NAMES = {'self', 'world', 'logic', 'bosses'}

    # Helpers that should be exported as definitions
    # Note: These are automatically preserved (not inlined) due to
    # AUTO_PRESERVE_WHITELISTED_HELPERS = True (default in base class)
    HELPERS_TO_EXPORT_WHITELIST = {
        # BossReqs class helpers
        'castle_access',
        'castle_clear',
        # YoshiLogic class helpers
        'has_midring',
        'reconstitute_luigi',
        'bandit_bonus',
        'item_bonus',
        'combat_item',
        'melon_item',
        'default_vis',
        'cansee_clouds',
        'bowserdoor_1',
        'bowserdoor_2',
        'bowserdoor_3',
        'bowserdoor_4',
    }

    # Computed world attributes needed by helpers
    # These replace the get_world_data override with declarative lambdas
    WORLD_ATTRIBUTES: Dict[str, Callable] = {
        # game_logic: "Easy"/"Normal"/"Hard" based on stage_logic option
        'game_logic': lambda w, m, p: (
            "Easy" if _get_option(w, 'stage_logic', 0) == 0
            else "Normal" if _get_option(w, 'stage_logic', 0) == 1
            else "Hard"
        ),
        # midring_start: True if midrings are not shuffled
        'midring_start': lambda w, m, p: not _get_option(w, 'shuffle_midrings', False),
        # clouds_always_visible: True if hidden_object_visibility >= 2
        'clouds_always_visible': lambda w, m, p: _get_option(w, 'hidden_object_visibility', 1) >= 2,
        # consumable_logic: True if item_logic is disabled
        'consumable_logic': lambda w, m, p: not _get_option(w, 'item_logic', False),
        # bowser_door: bowser_door_mode with door_4 mapped to door_3
        'bowser_door': lambda w, m, p: (
            3 if _get_option(w, 'bowser_door_mode', 0) == 4
            else _get_option(w, 'bowser_door_mode', 0)
        ),
        # luigi_pieces: luigi_pieces_required option value
        'luigi_pieces': lambda w, m, p: _get_option(w, 'luigi_pieces_required', 25),
        # boss_order: world.boss_order or default
        'boss_order': lambda w, m, p: (
            list(w.boss_order) if hasattr(w, 'boss_order') and w.boss_order
            else DEFAULT_BOSS_ORDER
        ),
        # castle_unlock: castle_open_condition option value
        'castle_unlock': lambda w, m, p: _get_option(w, 'castle_open_condition', 5),
        # boss_unlock: castle_clear_condition option value
        'boss_unlock': lambda w, m, p: _get_option(w, 'castle_clear_condition', 0),
    }

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand rules with game-specific handling for boss_order subscripts.

        Resolves patterns like self.boss_order[6] to the actual boss room name
        at export time. This is necessary because boss_order is shuffled per-seed
        and the worldgen world doesn't have access to the original boss_order.

        Also simplifies conditionals where if_true is True and if_false is None,
        converting them to just the test expression. This fixes the _*CanFightBoss
        pattern which would otherwise be interpreted as always True.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Handle subscript on self.boss_order -> resolve to actual boss room name
        if rule.get('type') == 'subscript':
            value = rule.get('value', {})
            index_node = rule.get('index', {})

            # Check if this is self.boss_order[constant_index]
            if (value.get('type') == 'attribute' and
                value.get('attr') == 'boss_order' and
                value.get('object', {}).get('type') == 'name' and
                value.get('object', {}).get('name') == 'self' and
                index_node.get('type') == 'constant'):

                index = index_node.get('value')
                if isinstance(index, int):
                    # Get the boss_order from the world
                    boss_order = self._get_boss_order()
                    if boss_order and 0 <= index < len(boss_order):
                        boss_room = boss_order[index]
                        logger.debug(f"Resolved self.boss_order[{index}] to '{boss_room}'")
                        return {'type': 'constant', 'value': boss_room}
                    else:
                        logger.warning(f"boss_order index {index} out of range (len={len(boss_order) if boss_order else 0})")

        # Simplify conditionals where if_true=True and if_false=None
        # Pattern: {test: X, if_true: True, if_false: None} -> just X
        # This fixes the _*CanFightBoss pattern which is:
        #   if can_reach(boss_room): return True
        # Without explicit else, Python returns None. The world_generator
        # interprets if_false=None as "else True", making the rule always pass.
        # We simplify to just the test expression, which correctly fails when
        # the can_reach check fails.
        if rule.get('type') == 'conditional':
            if_true = rule.get('if_true', {})
            if_false = rule.get('if_false')

            # Check if this is the pattern: if_true=True, if_false=None
            is_if_true_just_true = (
                isinstance(if_true, dict) and
                if_true.get('type') == 'constant' and
                if_true.get('value') is True
            )
            is_if_false_none = if_false is None

            if is_if_true_just_true and is_if_false_none:
                # Simplify to just the test - this makes the rule behave correctly:
                # - If test passes, it's truthy
                # - If test fails, it's falsy
                test = rule.get('test', {})
                logger.debug(f"Simplified conditional (if_true=True, if_false=None) to just the test: {test.get('type', 'unknown')}")
                return self.expand_rule(test, _depth)

        # Call parent expand_rule first to handle recursive expansion
        result = super().expand_rule(rule, _depth)

        # Post-process: Convert can_reach(boss_room, 'Location') to can_reach(boss_room, 'Region')
        # Boss room locations are event locations with no access rules, so reaching
        # the location is equivalent to reaching the region. Using 'Region' is more
        # reliable for worldgen tracking.
        # We do this after parent expansion so that subscripts are already resolved.
        if isinstance(result, dict) and result.get('type') == 'state_method' and result.get('method') == 'can_reach':
            args = result.get('args', [])
            if len(args) >= 2:
                location_arg = args[0]
                type_arg = args[1]

                # Check if this is can_reach(boss_room_name, 'Location')
                if (isinstance(location_arg, dict) and location_arg.get('type') == 'constant' and
                    isinstance(type_arg, dict) and type_arg.get('type') == 'constant' and
                    type_arg.get('value') == 'Location'):

                    location_name = location_arg.get('value', '')
                    if location_name.endswith("'s Boss Room"):
                        # Convert to 'Region' check - boss rooms have the same name
                        # for both region and location
                        logger.debug(f"Converting can_reach('{location_name}', 'Location') to 'Region'")
                        result = dict(result)
                        result['args'] = [
                            args[0],  # Keep the location name
                            {'type': 'constant', 'value': 'Region'}  # Change to Region
                        ] + list(args[2:])  # Keep any additional args

        return result

    def _get_boss_order(self) -> Optional[list]:
        """Get the boss_order from the world, falling back to default if not available."""
        if self.world and hasattr(self.world, 'boss_order') and self.world.boss_order:
            return list(self.world.boss_order)
        return DEFAULT_BOSS_ORDER
