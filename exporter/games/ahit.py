"""A Hat in Time game-specific exporter handler.

Helper Export Status:
- can_use_hat: Exported to rules.json, JS fallback still needed
- get_hat_cost: Exported to rules.json, JS fallback still needed
- has_relic_combo: Exported to rules.json, JS fallback still needed
- painting_logic: Exported to rules.json, JS fallback still needed
- get_difficulty: Exported to rules.json, JS fallback still needed
- can_clear_required_act: NOT exported (uses region reachability), requires JS

Note: JavaScript helpers in ahitLogic.js are still required as fallback
because some rule engine code paths use executeHelper() instead of
evaluating the exported helper definitions directly.
"""

from typing import Dict, Any, Set
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)


class AHitGameExportHandler(BaseGameExportHandler):
    """A Hat in Time export handler with automatic helper export."""

    GAME_NAME = 'A Hat in Time'

    # Module containing helper functions for definition export
    HELPER_MODULES = ['worlds.ahit.Rules']

    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = False

    # Blacklist helpers that are too complex to analyze automatically:
    # - can_clear_required_act: Uses multiworld.get_entrance and region reachability
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = {
        'can_clear_required_act',
    }

    # Preserve these helpers as helper calls (don't inline their bodies)
    # This is necessary for complex helpers that reference runtime objects
    HELPERS_TO_PRESERVE: Set[str] = {
        'can_clear_required_act',
        'can_use_hat',
        'get_hat_cost',
        'has_relic_combo',
    }

    def get_settings_data(self, world, multiworld, player):
        """Extract A Hat in Time settings."""
        settings = super().get_settings_data(world, multiworld, player)

        # Add AHIT-specific settings used by helpers
        options_map = {
            'HatItems': ('HatItems', bool, False),
            'UmbrellaLogic': ('UmbrellaLogic', bool, False),
            'ShuffleSubconPaintings': ('ShuffleSubconPaintings', bool, False),
            'LogicDifficulty': ('LogicDifficulty', int, -1),
            'NoPaintingSkips': ('NoPaintingSkips', bool, False),
            'ShuffleAlpineZiplines': ('ShuffleAlpineZiplines', bool, False),
        }

        for setting_key, (option_name, converter, default) in options_map.items():
            try:
                if hasattr(world, 'options') and hasattr(world.options, option_name):
                    settings[setting_key] = converter(getattr(world.options, option_name).value)
                else:
                    settings[setting_key] = default
            except Exception as e:
                logger.error(f"Error extracting {option_name} option: {e}")
                settings[setting_key] = default

        return settings

    def get_chapter_costs(self, world):
        """Extract A Hat in Time chapter costs for telescope access rules."""
        try:
            chapter_costs = {}
            if hasattr(world, 'chapter_timepiece_costs'):
                chapter_names = {
                    0: 'Spaceship',
                    1: 'Mafia Town',
                    2: 'Battle of the Birds',
                    3: 'Subcon Forest',
                    4: 'Alpine Skyline',
                    5: "Time's End",
                    6: 'Arctic Cruise',
                    7: 'Nyakuza Metro'
                }

                for chapter_index, cost in world.chapter_timepiece_costs.items():
                    chapter_name = chapter_names.get(int(chapter_index), f'Chapter_{chapter_index}')
                    chapter_costs[chapter_name] = cost

                return chapter_costs
            return {}
        except Exception as e:
            logger.error(f"Error extracting chapter costs: {e}")
            return {}

    def get_hat_costs(self, world):
        """Extract A Hat in Time hat yarn costs and crafting order."""
        try:
            hat_info = {}
            if hasattr(world, 'hat_yarn_costs'):
                hat_info['hat_yarn_costs'] = {int(k): v for k, v in world.hat_yarn_costs.items()}
            if hasattr(world, 'hat_craft_order'):
                hat_info['hat_craft_order'] = [int(h) for h in world.hat_craft_order]
            return hat_info
        except Exception as e:
            logger.error(f"Error extracting hat costs: {e}")
            return {}

    def get_relic_groups(self, world):
        """Extract A Hat in Time relic groups (item_name_groups)."""
        try:
            relic_groups = {}
            if hasattr(world, 'item_name_groups'):
                for group_name, items in world.item_name_groups.items():
                    if isinstance(items, (set, frozenset)):
                        relic_groups[group_name] = sorted(list(items))
                    elif isinstance(items, list):
                        relic_groups[group_name] = sorted(items)
                    else:
                        try:
                            relic_groups[group_name] = sorted(list(items))
                        except:
                            relic_groups[group_name] = []
            return relic_groups
        except Exception as e:
            logger.error(f"Error extracting relic groups: {e}")
            return {}

    def get_game_info(self, world):
        """Get A Hat in Time specific game information."""
        try:
            return {
                "name": "A Hat in Time",
                "rule_format": {"version": "1.0"},
                "chapter_costs": self.get_chapter_costs(world),
                "hat_info": self.get_hat_costs(world),
                "relic_groups": self.get_relic_groups(world)
            }
        except Exception as e:
            logger.error(f"Error getting A Hat in Time game info: {e}")
            return {
                "name": "A Hat in Time",
                "rule_format": {"version": "1.0"},
                "chapter_costs": {},
                "hat_info": {},
                "relic_groups": {}
            }
