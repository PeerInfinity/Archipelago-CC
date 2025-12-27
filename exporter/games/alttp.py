# exporter/games/alttp.py

import logging
from .base import BaseGameExportHandler
from typing import Any, Dict
from worlds.alttp.Items import progression_mapping

logger = logging.getLogger(__name__)


class ALttPGameExportHandler(BaseGameExportHandler):
    # For now, treat all exits as bidirectional
    # This setting is currently only used for region navigation in the frontend
    ASSUME_BIDIRECTIONAL_EXITS = True

    # The following settings are just to make the rules.json file easier to read:

    # Auto-discover region attributes (is_light_world, is_dark_world, type)
    AUTO_DISCOVER_REGION_ATTRIBUTES = True

    # Auto-discover location attributes (crystal, player_address, shop_slot_disabled)
    AUTO_DISCOVER_LOCATION_ATTRIBUTES = False

    # Auto-discover world attributes (shops, dungeons, difficulty_requirements, etc.)
    AUTO_DISCOVER_WORLD_ATTRIBUTES = True

    # Export Choice options as string keys instead of numeric values
    # ALttP rules use string comparisons like `enemy_health in ("easy", "default")`
    # and don't use ordered comparisons, so string keys work correctly
    EXPORT_CHOICE_OPTIONS_AS_NUMERIC = False

    def replace_name(self, name: str) -> str:
        """Normalize closure-captured location variables to standard 'location' parameter.

        In worlds/alttp/Rules.py, some location access rules are written as:
            ep_boss = multiworld.get_location('Eastern Palace - Boss', player)
            add_rule(ep_boss, lambda state: ... ep_boss.parent_region.dungeon ...)

        The lambda captures 'ep_boss' from the enclosing scope. However, when the frontend
        evaluates access rules, it provides the location as a parameter named 'location'.
        This function replaces these closure-captured names with 'location' so the
        exported rules work correctly in the frontend.
        """
        if name == 'ep_boss' or name == 'ep_prize':
            return 'location'
        return name

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Return ALTTP-specific progression item mapping."""
        mapping_data = {}
        # Use the imported progression_mapping
        for target_item, (base_item, level) in progression_mapping.items():
            if base_item not in mapping_data:
                mapping_data[base_item] = {
                    'items': [],
                    'base_item': base_item
                }
            mapping_data[base_item]['items'].append({
                'name': target_item,
                'level': level
            })

        # Sort items by level
        for prog_type in mapping_data.values():
            prog_type['items'].sort(key=lambda x: x['level'])

        # Add Progressive Bow (Alt) with same progression as Progressive Bow
        # This handles the runtime conversion that happens in ItemPool.py line 330-335
        # where one Progressive Bow is converted to Progressive Bow (Alt) for hint text
        # IMPORTANT: base_item must be 'Progressive Bow' so both variants count toward
        # the same progression level (needed for Silver Bow which requires 2 bows)
        if 'Progressive Bow' in mapping_data:
            mapping_data['Progressive Bow (Alt)'] = {
                'items': [item.copy() for item in mapping_data['Progressive Bow']['items']],
                'base_item': 'Progressive Bow'
            }

        return mapping_data
