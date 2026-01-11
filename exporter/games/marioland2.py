# exporter/games/marioland2.py
"""
Super Mario Land 2 specific export handler.

This handler pre-computes sprite-dependent values at export time since the
exporter cannot analyze complex set/list comprehensions that access sprite_data.

The problematic patterns are:
1. mario_zone_3_coins: len({sprites[i]["sprite"] == "Claw Grabber" for i in (17, 18, 25)})
2. not_blocked_by_sharks: [sprite_data[i]["sprite"] for i in (27, 28)].count("Shark")

These are resolved at export time by computing the actual sprite counts and
providing those as constants in the exported helpers.
"""

from .base import BaseGameExportHandler
from typing import Any, Callable, Dict, Optional, Set
import logging
import re

logger = logging.getLogger(__name__)


class Marioland2GameExportHandler(BaseGameExportHandler):
    """Super Mario Land 2 specific export handler."""

    # Only blacklist coin helpers that have complex logic we can't analyze.
    # Core helpers like is_auto_scroll are NOT blacklisted - we provide custom definitions.
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = set()

    # Whitelist the helpers we want to ensure are exported with custom definitions
    HELPERS_TO_EXPORT_WHITELIST: Set[str] = {
        'is_auto_scroll',
        'not_blocked_by_sharks',
    }

    def __init__(self, world=None):
        super().__init__(world=world)
        self._sprite_computations = {}
        self._world = world
        self._auto_scroll_computed = False

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """
        Get helper definitions, providing custom versions for helpers that
        access dynamic world data (sprite_data, auto_scroll_levels).
        """
        # Get base helper definitions
        try:
            helpers = super().get_helper_definitions(world)
        except Exception as e:
            logger.warning(f"Base helper discovery had errors: {e}")
            helpers = {}

        # Compute sprite values
        self._compute_sprite_values(world)

        # Provide custom is_auto_scroll definition
        # This helper checks auto_scroll_levels[level_id] - we export it as a lookup
        if hasattr(world, 'auto_scroll_levels'):
            helpers['is_auto_scroll'] = self._build_is_auto_scroll_helper(world.auto_scroll_levels)

        # Provide custom not_blocked_by_sharks definition
        shark_count = self._sprite_computations.get('turtle_zone_1_sharks', 0)
        helpers['not_blocked_by_sharks'] = self._build_not_blocked_by_sharks_helper(shark_count)

        # Provide custom mario_zone_3_coins definition
        # This helper uses a set comprehension that can't be properly analyzed
        claw_set_len = self._sprite_computations.get('mario_zone_3_claw_set_len', 1)
        helpers['mario_zone_3_coins'] = self._build_mario_zone_3_coins_helper(claw_set_len)

        return helpers

    def _build_is_auto_scroll_helper(self, auto_scroll_levels_list: list) -> Dict[str, Any]:
        """
        Build is_auto_scroll helper using pre-computed auto_scroll_levels.

        In the original code, auto_scroll_levels is a list indexed by level_id (int).
        We need to use level_name_to_id to convert level names to indices.

        Since this is seed-specific data, we pre-compute which levels are auto-scroll
        and return explicit checks for each level with their specific cancel items.

        Args:
            auto_scroll_levels_list: List of auto-scroll values indexed by level_id
        """
        # Get the level_name_to_id mapping from the world's locations module
        try:
            from worlds.marioland2.locations import level_name_to_id
        except ImportError:
            logger.warning("Could not import level_name_to_id, using empty mapping")
            level_name_to_id = {}

        auto_scroll_levels = auto_scroll_levels_list if auto_scroll_levels_list else []

        # Build a list of level names that have auto-scroll enabled (value > 0)
        auto_scroll_level_names = []
        for level_name, level_id in level_name_to_id.items():
            if level_id < len(auto_scroll_levels) and auto_scroll_levels[level_id] > 0:
                auto_scroll_level_names.append(level_name)

        logger.debug(f"Auto-scroll levels: {auto_scroll_level_names}")

        if not auto_scroll_level_names:
            # No auto-scroll levels - always returns False
            return {'type': 'constant', 'value': False}

        # Build explicit checks for each auto-scroll level with their level-specific cancel items.
        # For each level: (level == "LevelName") AND NOT has_any(["Cancel Auto Scroll", "Cancel Auto Scroll - LevelName"])
        # Combine all with OR - if any level matches and isn't cancelled, return True.
        level_conditions = []
        for level_name in auto_scroll_level_names:
            cancel_items = ['Cancel Auto Scroll', f'Cancel Auto Scroll - {level_name}']
            level_conditions.append({
                'type': 'and',
                'conditions': [
                    # Check if this is the level being queried
                    {
                        'type': 'compare',
                        'left': {'type': 'name', 'name': 'level'},
                        'op': '==',
                        'right': {'type': 'constant', 'value': level_name}
                    },
                    # AND not has_any(["Cancel Auto Scroll", "Cancel Auto Scroll - LevelName"])
                    {
                        'type': 'not',
                        'condition': {
                            'type': 'state_method',
                            'method': 'has_any',
                            'args': [{'type': 'constant', 'value': cancel_items}]
                        }
                    }
                ]
            })

        # If only one auto-scroll level, just return that condition directly
        if len(level_conditions) == 1:
            return {
                'params': ['level'],
                'body': level_conditions[0]
            }

        # Multiple auto-scroll levels - combine with OR
        return {
            'params': ['level'],
            'body': {
                'type': 'or',
                'conditions': level_conditions
            }
        }

    def _compute_sprite_values(self, world) -> Dict[str, Any]:
        """
        Pre-compute sprite-dependent values from the world's sprite_data.

        These values are constant for a given seed and affect rule evaluation.
        Computing them at export time allows the exporter to emit simpler code.
        """
        if self._sprite_computations:
            return self._sprite_computations

        if not hasattr(world, 'sprite_data') or not world.sprite_data:
            logger.debug("No sprite_data available for pre-computation")
            return {}

        sprite_data = world.sprite_data

        # Mario Zone 3: Compute the set length for claw grabber check
        # The original code: len({sprites[i]["sprite"] == "Claw Grabber" for i in (17, 18, 25)})
        # Creates a set of booleans, so len is at most 2
        if 'Mario Zone 3' in sprite_data:
            mz3_sprites = sprite_data['Mario Zone 3']
            booleans = set()
            for i in (17, 18, 25):
                if i < len(mz3_sprites):
                    is_claw = mz3_sprites[i].get('sprite') == 'Claw Grabber'
                    booleans.add(is_claw)
            # The set length is what's used in the rule
            self._sprite_computations['mario_zone_3_claw_set_len'] = len(booleans) if booleans else 1
            logger.debug(f"Mario Zone 3 claw set len: {self._sprite_computations['mario_zone_3_claw_set_len']}")

        # Turtle Zone 1: Count Sharks at specific positions
        # The original code: [sprite_data[i]["sprite"] for i in (27, 28)].count("Shark")
        if 'Turtle Zone 1' in sprite_data:
            tz1_sprites = sprite_data['Turtle Zone 1']
            shark_count = sum(
                1 for i in (27, 28)
                if i < len(tz1_sprites) and tz1_sprites[i].get('sprite') == 'Shark'
            )
            self._sprite_computations['turtle_zone_1_sharks'] = shark_count
            logger.debug(f"Turtle Zone 1 Shark count: {shark_count}")

        return self._sprite_computations

    def get_world_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export marioland2 specific world data including pre-computed sprite values."""
        world_data = super().get_world_data(world, multiworld, player)

        # Compute sprite-dependent values
        sprite_computations = self._compute_sprite_values(world)
        if sprite_computations:
            world_data['sprite_computations'] = sprite_computations

        return world_data

    def _build_mario_zone_3_coins_helper(self, claw_set_len: int) -> Dict[str, Any]:
        """
        Build the mario_zone_3_coins helper with pre-computed claw grabber set length.

        Original logic:
        def mario_zone_3_coins(state, player, coins):
            auto_scroll = is_auto_scroll(state, player, "Mario Zone 3")
            reachable_coins = 10
            if state.has("Carrot", player):
                reachable_spike_coins = 15
            else:
                sprites = state.multiworld.worlds[player].sprite_data["Mario Zone 3"]
                reachable_spike_coins = min(3, len({sprites[i]["sprite"] == "Claw Grabber" for i in (17, 18, 25)})
                                            + state.has("Mushroom", player) + state.has("Fire Flower", player)) * 5
            reachable_coins += reachable_spike_coins
            if not auto_scroll:
                reachable_coins += 10
            if state.has("Fire Flower", player):
                reachable_coins += 22
                if auto_scroll:
                    reachable_coins -= 3 + reachable_spike_coins
            return coins <= reachable_coins
        """
        # For now, return a simplified version that uses the pre-computed claw_set_len
        # The frontend will need to evaluate this
        return {
            'params': ['coins'],
            'body': {
                'type': 'block',
                'statements': [
                    # auto_scroll = is_auto_scroll(state, player, "Mario Zone 3")
                    {
                        'type': 'assign',
                        'name': 'auto_scroll',
                        'value': {
                            'type': 'helper',
                            'name': 'is_auto_scroll',
                            'args': [{'type': 'constant', 'value': 'Mario Zone 3'}]
                        }
                    },
                    # reachable_coins = 10
                    {
                        'type': 'assign',
                        'name': 'reachable_coins',
                        'value': {'type': 'constant', 'value': 10}
                    },
                    # if state.has("Carrot", player): reachable_spike_coins = 15 else: ...
                    {
                        'type': 'if_statement',
                        'test': {'type': 'item_check', 'item': 'Carrot'},
                        'body': [
                            {
                                'type': 'assign',
                                'name': 'reachable_spike_coins',
                                'value': {'type': 'constant', 'value': 15}
                            }
                        ],
                        'orelse': [
                            # reachable_spike_coins = min(3, claw_set_len + has_mushroom + has_fire_flower) * 5
                            {
                                'type': 'assign',
                                'name': 'reachable_spike_coins',
                                'value': {
                                    'type': 'binary_op',
                                    'left': {
                                        'type': 'call',
                                        'func': 'min',
                                        'args': [
                                            {'type': 'constant', 'value': 3},
                                            {
                                                'type': 'binary_op',
                                                'left': {
                                                    'type': 'binary_op',
                                                    'left': {'type': 'constant', 'value': claw_set_len},
                                                    'op': '+',
                                                    'right': {
                                                        'type': 'state_method',
                                                        'method': 'has',
                                                        'args': [{'type': 'constant', 'value': 'Mushroom'}]
                                                    }
                                                },
                                                'op': '+',
                                                'right': {
                                                    'type': 'state_method',
                                                    'method': 'has',
                                                    'args': [{'type': 'constant', 'value': 'Fire Flower'}]
                                                }
                                            }
                                        ]
                                    },
                                    'op': '*',
                                    'right': {'type': 'constant', 'value': 5}
                                }
                            }
                        ]
                    },
                    # reachable_coins += reachable_spike_coins
                    {
                        'type': 'aug_assign',
                        'target': 'reachable_coins',
                        'op': '+',
                        'value': {'type': 'name', 'name': 'reachable_spike_coins'}
                    },
                    # if not auto_scroll: reachable_coins += 10
                    {
                        'type': 'if_statement',
                        'test': {'type': 'not', 'condition': {'type': 'name', 'name': 'auto_scroll'}},
                        'body': [
                            {
                                'type': 'aug_assign',
                                'target': 'reachable_coins',
                                'op': '+',
                                'value': {'type': 'constant', 'value': 10}
                            }
                        ]
                    },
                    # if state.has("Fire Flower"): reachable_coins += 22; if auto_scroll: reachable_coins -= 3 + reachable_spike_coins
                    {
                        'type': 'if_statement',
                        'test': {'type': 'item_check', 'item': 'Fire Flower'},
                        'body': [
                            {
                                'type': 'aug_assign',
                                'target': 'reachable_coins',
                                'op': '+',
                                'value': {'type': 'constant', 'value': 22}
                            },
                            {
                                'type': 'if_statement',
                                'test': {'type': 'name', 'name': 'auto_scroll'},
                                'body': [
                                    {
                                        'type': 'aug_assign',
                                        'target': 'reachable_coins',
                                        'op': '-',
                                        'value': {
                                            'type': 'binary_op',
                                            'left': {'type': 'constant', 'value': 3},
                                            'op': '+',
                                            'right': {'type': 'name', 'name': 'reachable_spike_coins'}
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    # return coins <= reachable_coins
                    {
                        'type': 'return',
                        'value': {
                            'type': 'compare',
                            'left': {'type': 'name', 'name': 'coins'},
                            'op': '<=',
                            'right': {'type': 'name', 'name': 'reachable_coins'}
                        }
                    }
                ]
            }
        }

    def _build_not_blocked_by_sharks_helper(self, shark_count: int) -> Dict[str, Any]:
        """
        Build the not_blocked_by_sharks helper with pre-computed shark count.

        Original logic:
        def not_blocked_by_sharks(state, player):
            sharks = [state.multiworld.worlds[player].sprite_data["Turtle Zone 1"][i]["sprite"]
                      for i in (27, 28)].count("Shark")
            if state.has("Carrot", player) or not sharks:
                return True
            if sharks == 2:
                return state.has_all(["Mushroom", "Fire Flower"], player)
            if sharks == 1:
                return state.has_any(["Mushroom", "Fire Flower"], player)
            return False
        """
        # Build the rule based on shark_count
        if shark_count == 0:
            # No sharks - always accessible
            return {'type': 'constant', 'value': True}
        elif shark_count == 1:
            # 1 shark - need Carrot OR (Mushroom OR Fire Flower)
            return {
                'type': 'or',
                'conditions': [
                    {'type': 'item_check', 'item': 'Carrot'},
                    {
                        'type': 'state_method',
                        'method': 'has_any',
                        'args': [{'type': 'constant', 'value': ['Mushroom', 'Fire Flower']}]
                    }
                ]
            }
        else:  # shark_count == 2
            # 2 sharks - need Carrot OR (Mushroom AND Fire Flower)
            return {
                'type': 'or',
                'conditions': [
                    {'type': 'item_check', 'item': 'Carrot'},
                    {
                        'type': 'state_method',
                        'method': 'has_all',
                        'args': [{'type': 'constant', 'value': ['Mushroom', 'Fire Flower']}]
                    }
                ]
            }

    def _build_turtle_zone_1_coins_helper(self, shark_count: int) -> Dict[str, Any]:
        """
        Build the turtle_zone_1_coins helper.

        Original logic:
        def turtle_zone_1_coins(state, player, coins):
            auto_scroll = is_auto_scroll(state, player, "Turtle Zone 1")
            reachable_coins = 30
            if not_blocked_by_sharks(state, player):
                reachable_coins += 13
                if auto_scroll:
                    reachable_coins -= 1
            if state.has("Water Physics", player) or state.has("Carrot", player):
                reachable_coins += 10
            if state.has("Carrot", player):
                reachable_coins += 24
                if auto_scroll:
                    reachable_coins -= 10
            return coins <= reachable_coins
        """
        return {
            'params': ['coins'],
            'body': {
                'type': 'block',
                'statements': [
                    # auto_scroll = is_auto_scroll(state, player, "Turtle Zone 1")
                    {
                        'type': 'assign',
                        'name': 'auto_scroll',
                        'value': {
                            'type': 'helper',
                            'name': 'is_auto_scroll',
                            'args': [{'type': 'constant', 'value': 'Turtle Zone 1'}]
                        }
                    },
                    # reachable_coins = 30
                    {
                        'type': 'assign',
                        'name': 'reachable_coins',
                        'value': {'type': 'constant', 'value': 30}
                    },
                    # if not_blocked_by_sharks(state, player): reachable_coins += 13 ...
                    {
                        'type': 'if_statement',
                        'test': {
                            'type': 'helper',
                            'name': 'not_blocked_by_sharks'
                        },
                        'body': [
                            {
                                'type': 'aug_assign',
                                'target': 'reachable_coins',
                                'op': '+',
                                'value': {'type': 'constant', 'value': 13}
                            },
                            {
                                'type': 'if_statement',
                                'test': {'type': 'name', 'name': 'auto_scroll'},
                                'body': [
                                    {
                                        'type': 'aug_assign',
                                        'target': 'reachable_coins',
                                        'op': '-',
                                        'value': {'type': 'constant', 'value': 1}
                                    }
                                ]
                            }
                        ]
                    },
                    # if state.has("Water Physics") or state.has("Carrot"): reachable_coins += 10
                    {
                        'type': 'if_statement',
                        'test': {
                            'type': 'or',
                            'conditions': [
                                {'type': 'item_check', 'item': 'Water Physics'},
                                {'type': 'item_check', 'item': 'Carrot'}
                            ]
                        },
                        'body': [
                            {
                                'type': 'aug_assign',
                                'target': 'reachable_coins',
                                'op': '+',
                                'value': {'type': 'constant', 'value': 10}
                            }
                        ]
                    },
                    # if state.has("Carrot"): reachable_coins += 24 ...
                    {
                        'type': 'if_statement',
                        'test': {'type': 'item_check', 'item': 'Carrot'},
                        'body': [
                            {
                                'type': 'aug_assign',
                                'target': 'reachable_coins',
                                'op': '+',
                                'value': {'type': 'constant', 'value': 24}
                            },
                            {
                                'type': 'if_statement',
                                'test': {'type': 'name', 'name': 'auto_scroll'},
                                'body': [
                                    {
                                        'type': 'aug_assign',
                                        'target': 'reachable_coins',
                                        'op': '-',
                                        'value': {'type': 'constant', 'value': 10}
                                    }
                                ]
                            }
                        ]
                    },
                    # return coins <= reachable_coins
                    {
                        'type': 'return',
                        'value': {
                            'type': 'compare',
                            'left': {'type': 'name', 'name': 'coins'},
                            'op': '<=',
                            'right': {'type': 'name', 'name': 'reachable_coins'}
                        }
                    }
                ]
            }
        }
