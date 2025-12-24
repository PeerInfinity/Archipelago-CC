"""A Hat in Time WorldGen specific export handler.

This handler exports settings from the worldgen world attributes,
ensuring hat_yarn_costs and hat_craft_order are available as settings
for the frontend rule evaluation.
"""

from typing import Dict, Any
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)


class AHitWorldGenGameExportHandler(BaseGameExportHandler):
    """A Hat in Time WorldGen-specific export handler.

    Uses the worldgen's Rules module for helper functions and
    exports world attributes as settings.
    """

    # Use the worldgen's Rules module for helper functions
    HELPER_MODULES = ['worlds.ahit_worldgen.Rules']

    # Enable Pattern 4 accumulator (like parent AHIT handler)
    AUTO_PRESERVE_LARGE_HELPERS = False

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export A Hat in Time WorldGen settings for frontend logic.

        Extracts hat_yarn_costs and hat_craft_order from world attributes
        and adds them to settings.
        """
        # Get base settings from parent class
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Enable Pattern 4 accumulator for "Time Shard (N)" items -> "Shards" counter
        settings_dict['use_paren_number_accumulator'] = True

        # Export hat_yarn_costs from world attribute
        if hasattr(world, 'hat_yarn_costs') and world.hat_yarn_costs is not None:
            settings_dict['hat_yarn_costs'] = {int(k): v for k, v in world.hat_yarn_costs.items()}
            logger.debug(f"Exported hat_yarn_costs: {settings_dict['hat_yarn_costs']}")

        # Export hat_craft_order from world attribute
        if hasattr(world, 'hat_craft_order') and world.hat_craft_order is not None:
            settings_dict['hat_craft_order'] = [int(h) for h in world.hat_craft_order]
            logger.debug(f"Exported hat_craft_order: {settings_dict['hat_craft_order']}")

        # Export item_name_groups for has_relic_combo helper
        if hasattr(world, 'item_name_groups') and world.item_name_groups is not None:
            item_groups = {}
            for group_name, items in world.item_name_groups.items():
                if isinstance(items, (set, frozenset)):
                    item_groups[group_name] = sorted(list(items))
                elif isinstance(items, list):
                    item_groups[group_name] = sorted(items)
                else:
                    try:
                        item_groups[group_name] = sorted(list(items))
                    except:
                        item_groups[group_name] = []
            settings_dict['item_name_groups'] = item_groups
            logger.debug(f"Exported item_name_groups with {len(item_groups)} groups")

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
                    settings_dict[setting_key] = converter(getattr(world.options, option_name).value)
                else:
                    settings_dict[setting_key] = default
            except Exception as e:
                logger.error(f"Error extracting {option_name} option: {e}")
                settings_dict[setting_key] = default

        return settings_dict
