# exporter/games/alttp.py

from .base import BaseGameExportHandler
from typing import Any, Dict, Optional, Set, List
from worlds.alttp.Items import item_table, progression_mapping
from BaseClasses import ItemClassification
import collections
import logging

logger = logging.getLogger(__name__) # Add logger if needed later


class ALttPGameExportHandler(BaseGameExportHandler):
    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = True  # Closure functions are cached during analysis and exported
    # Helper modules containing functions that can be exported as JSON rule definitions
    HELPER_MODULES = ['worlds.alttp.StateHelpers', 'worlds.alttp.Bosses']

    # ALTTP exits are bidirectional - going through an entrance implies being able to return
    ASSUME_BIDIRECTIONAL_EXITS = True

    # Auto-discover region attributes (is_light_world, is_dark_world, type, etc.)
    AUTO_DISCOVER_REGION_ATTRIBUTES = True

    # Auto-discover location attributes
    AUTO_DISCOVER_LOCATION_ATTRIBUTES = False

    # Computed helpers defined in get_helper_definitions() rather than from helper modules
    # These are auto-preserved when AUTO_PRESERVE_COMPUTED_HELPERS is True
    COMPUTED_HELPERS = {'can_buy', 'can_buy_unlimited', 'can_defeat_boss'}
    AUTO_PRESERVE_COMPUTED_HELPERS = True

    # Simple world attributes that can be automatically exported via base class
    # These are runtime-computed values on the world instance, not user-configurable options
    WORLD_ATTRIBUTES = {
        'treasure_hunt_required': lambda w, m, p: getattr(w, 'treasure_hunt_required', 0),
        'can_take_damage': lambda w, m, p: getattr(w, 'can_take_damage', True),
        'logical_heart_pieces': lambda w, m, p: getattr(w, 'logical_heart_pieces', 24),
        'logical_heart_containers': lambda w, m, p: getattr(w, 'logical_heart_containers', 10),
    }

    # Complex helpers that can't be exported (need JavaScript implementations)
    # NOTE: Use set() for empty blacklist - {} creates an empty dict!
    # All helpers now exported via computed definitions or other mechanisms
    HELPERS_TO_EXPORT_BLACKLIST = set()

    # Helpers that MUST be exported as definitions (whitelist)
    # For WorldGen worlds, helpers aren't discovered during AST analysis since rules
    # are already Rule Builder objects. This whitelist ensures all ALTTP helpers
    # are exported for both original and WorldGen worlds.
    HELPERS_TO_EXPORT_WHITELIST = {
        'GanonDefeatRule',
        'basement_key_rule',
        'bottle_count',
        'can_activate_crystal_switch',
        'can_bomb_or_bonk',
        'can_extend_magic',
        'can_get_good_bee',
        'can_hold_arrows',
        'can_kill_most_things',
        'can_lift_heavy_rocks',
        'can_lift_rocks',
        'can_melt_things',
        'can_retrieve_tablet',
        'can_shoot_arrows',
        'can_use_bombs',
        'cross_peg_bridge',
        'has_beam_sword',
        'has_crystals',
        'has_fire_source',
        'has_hearts',
        'has_melee_weapon',
        'has_misery_mire_medallion',
        'has_sword',
        'has_turtle_rock_medallion',
        'heart_count',
        'is_not_bunny',
        # can_buy, can_buy_unlimited, can_defeat_boss are computed helpers
        # defined in get_helper_definitions(), not from StateHelpers
    }

    # Helpers that should be preserved as helper calls (not inlined by generic pattern matching)
    # These are complex helpers exported as definitions via get_helper_definitions().
    # Note: Computed helpers (can_buy, can_buy_unlimited, can_defeat_boss) are now
    # auto-preserved via COMPUTED_HELPERS + AUTO_PRESERVE_COMPUTED_HELPERS.
    HELPERS_TO_PRESERVE = {
        'GanonDefeatRule',
        'can_extend_magic',
        'can_get_good_bee',  # Uses region_reference and is_not_bunny
        'is_not_bunny',  # Takes region parameter, uses region_attribute
        'can_kill_most_things',
        'can_shoot_arrows',
        'can_use_bombs',
        'has_crystals',  # Exported with group_count support
        'has_hearts',  # Exported with logical_heart settings
        'has_misery_mire_medallion',  # Exported with setting_value index support
        'has_turtle_rock_medallion',  # Exported with setting_value index support
        'orig_rule',  # Internal helper that doesn't appear in final export
    }
    
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


# Reminder: Ensure get_game_export_handler in exporter/games/__init__.py
# returns an instance of ALttPGameExportHandler for the 'A Link to the Past' game.
