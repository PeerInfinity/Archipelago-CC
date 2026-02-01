"""Game-specific option constraints for fuzzer.

Some games have inter-option dependencies that can't be expressed as simple
"default this option" or "disallow this value" rules. This module defines
game-specific constraint functions that fix option combinations after random
generation but before YAML is produced.

Each constraint function takes the game options dict and returns the modified dict.
"""

from typing import Dict, Any, List, Callable

# Registry of game-specific constraint functions
# Map from game directory name to constraint function
GAME_CONSTRAINTS: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {}


def register_constraint(game_name: str):
    """Decorator to register a game constraint function."""
    def decorator(func: Callable[[Dict[str, Any]], Dict[str, Any]]):
        GAME_CONSTRAINTS[game_name] = func
        return func
    return decorator


def apply_game_constraints(game_name: str, options: Dict[str, Any]) -> Dict[str, Any]:
    """Apply game-specific constraints to the options dict.

    Args:
        game_name: The game directory name (e.g., 'overcooked2')
        options: The generated game options dict

    Returns:
        The modified options dict with constraints applied
    """
    if game_name in GAME_CONSTRAINTS:
        return GAME_CONSTRAINTS[game_name](options)
    return options


# ==============================================================================
# Game-specific constraint functions
# ==============================================================================


@register_constraint("overcooked2")
def overcooked2_constraints(options: Dict[str, Any]) -> Dict[str, Any]:
    """Fix Overcooked! 2 option constraints.

    Constraint 1: When shuffle_level_order is False, 'Story' DLC must be enabled.
    From worlds/overcooked2/__init__.py lines 240-243.

    Constraint 2: When shuffle_level_order is True, there must be enough levels
    in the pool. The required count is 43 (with kevin) or 35 (without kevin).
    Level counts by DLC (usable / non-prep / non-prep-non-horde):
    - STORY: 43 / 35 / 35
    - SEASONAL: 32 / 18 / 16
    - SURF_N_TURF: 13 / 11 / 11
    - CAMPFIRE_COOK_OFF: 15 / 11 / 11
    - NIGHT_OF_THE_HANGRY_HORDE: 20 / 17 / 9
    - CARNIVAL_OF_CHAOS: 15 / 10 / 10

    When prep_levels=excluded, only non-prep levels count. Story alone provides
    35 non-prep, but we need 43 for kevin. Fix by ensuring enough DLCs or
    changing prep_levels to 'original'.
    """
    shuffle = options.get('shuffle_level_order')
    include_dlcs = options.get('include_dlcs', [])
    prep_levels = options.get('prep_levels', 'original')
    kevin_levels = options.get('kevin_levels', False)
    include_horde = options.get('include_horde_levels', False)

    # Normalize include_dlcs to a list
    if isinstance(include_dlcs, set):
        include_dlcs = list(include_dlcs)
    if not isinstance(include_dlcs, list):
        include_dlcs = []

    # Check if shuffle is disabled
    shuffle_disabled = False
    if shuffle is False or shuffle == 'false':
        shuffle_disabled = True
    elif isinstance(shuffle, dict):
        if shuffle.get('true', 1) == 0 and shuffle.get('false', 0) > 0:
            shuffle_disabled = True

    # Check if shuffle is enabled
    shuffle_enabled = False
    if shuffle is True or shuffle == 'true':
        shuffle_enabled = True
    elif isinstance(shuffle, dict):
        if shuffle.get('false', 1) == 0 and shuffle.get('true', 0) > 0:
            shuffle_enabled = True
        # If neither is 0, assume enabled (more common case)
        elif shuffle.get('true', 0) > 0:
            shuffle_enabled = True

    # Constraint 1: shuffle_level_order=False requires Story DLC
    if shuffle_disabled:
        if 'Story' not in include_dlcs:
            include_dlcs.append('Story')
            options['include_dlcs'] = include_dlcs

    # Constraint 2: shuffle_level_order=True requires enough levels
    if shuffle_enabled:
        # Check if prep_levels is 'excluded'
        prep_excluded = False
        if prep_levels == 'excluded':
            prep_excluded = True
        elif isinstance(prep_levels, dict):
            if prep_levels.get('excluded', 0) > 0 and prep_levels.get('original', 0) == 0:
                prep_excluded = True

        # Check kevin_levels status
        kevin = False
        if kevin_levels is True or kevin_levels == 'true':
            kevin = True
        elif isinstance(kevin_levels, dict):
            if kevin_levels.get('true', 0) > 0:
                kevin = True

        # Check horde status
        horde = False
        if include_horde is True or include_horde == 'true':
            horde = True
        elif isinstance(include_horde, dict):
            if include_horde.get('true', 0) > 0:
                horde = True

        # Calculate required levels
        required_levels = 43 if kevin else 35

        # Calculate available levels based on DLCs
        # Level counts: (usable, non_prep, non_prep_non_horde)
        dlc_levels = {
            'Story': (43, 35, 35),
            'Seasonal': (32, 18, 16),
            'Surf \'N\' Turf': (13, 11, 11),
            'Campfire Cook Off': (15, 11, 11),
            'Night of the Hangry Horde': (20, 17, 9),
            'Carnival of Chaos': (15, 10, 10),
        }

        available = 0
        for dlc_name, (usable, non_prep, non_prep_non_horde) in dlc_levels.items():
            if dlc_name in include_dlcs:
                if prep_excluded:
                    if horde:
                        available += non_prep
                    else:
                        available += non_prep_non_horde
                else:
                    available += usable

        # If not enough levels, fix by either:
        # 1. Change prep_levels to 'original' (allows more levels)
        # 2. Add more DLCs
        if available < required_levels:
            if prep_excluded:
                # Change prep_levels to 'original' to include prep levels
                options['prep_levels'] = 'original'
            else:
                # Need more DLCs - ensure Story + Seasonal at minimum
                if 'Story' not in include_dlcs:
                    include_dlcs.append('Story')
                if 'Seasonal' not in include_dlcs:
                    include_dlcs.append('Seasonal')
                options['include_dlcs'] = include_dlcs

    return options


# Add more game constraints below as needed:
#
# @register_constraint("some_other_game")
# def some_other_game_constraints(options: Dict[str, Any]) -> Dict[str, Any]:
#     """Fix some_other_game option constraints."""
#     # ... apply fixes ...
#     return options
