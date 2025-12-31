"""Yoshi's Island game-specific export handler."""

from typing import Any, Callable, Dict
from .generic import GenericGameExportHandler


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
