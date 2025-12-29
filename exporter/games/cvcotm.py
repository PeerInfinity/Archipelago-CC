"""Castlevania - Circle of the Moon specific exporter."""

from typing import Dict, Any
from .generic import GenericGameExportHandler

class CvCotMGameExportHandler(GenericGameExportHandler):
    """Expander for Castlevania - Circle of the Moon specific functions."""

    # Options to export at top level of settings (simple value extractions)
    # Note: required_last_keys is a computed world attribute, not an option,
    # and is auto-discovered via AUTO_DISCOVER_WORLD_ATTRIBUTES (default True)
    EXPORTED_OPTIONS = [
        'nerf_roc_wing',
        'ignore_cleansing',
        'iron_maiden_behavior',
        'completion_goal',
    ]

    # Helpers that should be preserved as helper calls (not expanded to item checks)
    # These are defined in get_helper_definitions() and must be preserved
    HELPERS_TO_PRESERVE = {
        'has_jump_level_1',
        'has_jump_level_2',
        'has_jump_level_3',
        'has_jump_level_4',
        'has_jump_level_5',
        'has_kick',
        'has_tackle',
        'has_push',
        'has_ice_or_stone',
        'can_touch_water',
        'broke_iron_maidens',
        'can_open_ceremonial_door',
    }

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """
        Export CvCotM helper definitions.

        CvCotM helpers are defined as class methods in CVCotMRules, so we need to
        manually export them as rule definitions.
        """
        # Get settings values from the world
        nerf_roc_wing = world.options.nerf_roc_wing.value if hasattr(world.options, 'nerf_roc_wing') else 0
        ignore_cleansing = world.options.ignore_cleansing.value if hasattr(world.options, 'ignore_cleansing') else 0
        iron_maiden_behavior = world.options.iron_maiden_behavior.value if hasattr(world.options, 'iron_maiden_behavior') else 0
        required_last_keys = world.required_last_keys if hasattr(world, 'required_last_keys') else 0

        # Item names from worlds.cvcotm.data.iname
        double = "Double"
        roc_wing = "Roc Wing"
        kick_boots = "Kick Boots"
        tackle = "Tackle"
        heavy_ring = "Heavy Ring"
        serpent = "Serpent Card"
        cockatrice = "Cockatrice Card"
        mercury = "Mercury Card"
        mars = "Mars Card"
        cleansing = "Cleansing"
        maiden_detonator = "Maiden Detonator"
        last_key = "Last Key"

        helpers = {}

        # Helper function to create item_check rule
        def has_item(item_name):
            return {
                'type': 'item_check',
                'item': {'type': 'constant', 'value': item_name}
            }

        # Helper function to create state_method has_any rule
        def has_any_items(items):
            return {
                'type': 'state_method',
                'method': 'has_any',
                'args': [{'type': 'constant', 'value': items}]
            }

        # Helper function to create state_method has_all rule
        def has_all_items(items):
            return {
                'type': 'state_method',
                'method': 'has_all',
                'args': [{'type': 'constant', 'value': items}]
            }

        # has_jump_level_1: Double OR Roc Wing
        helpers['has_jump_level_1'] = has_any_items([double, roc_wing])

        # has_jump_level_2: Roc Wing
        helpers['has_jump_level_2'] = has_item(roc_wing)

        # has_jump_level_3: if nerf_roc_wing: Roc Wing AND (Double OR Kick Boots) else: Roc Wing
        if nerf_roc_wing:
            helpers['has_jump_level_3'] = {
                'type': 'and',
                'conditions': [
                    has_item(roc_wing),
                    has_any_items([double, kick_boots])
                ]
            }
        else:
            helpers['has_jump_level_3'] = has_item(roc_wing)

        # has_jump_level_4: if nerf_roc_wing: Roc Wing AND Kick Boots else: Roc Wing
        if nerf_roc_wing:
            helpers['has_jump_level_4'] = has_all_items([roc_wing, kick_boots])
        else:
            helpers['has_jump_level_4'] = has_item(roc_wing)

        # has_jump_level_5: if nerf_roc_wing: Roc Wing AND Double AND Kick Boots else: Roc Wing
        if nerf_roc_wing:
            helpers['has_jump_level_5'] = has_all_items([roc_wing, double, kick_boots])
        else:
            helpers['has_jump_level_5'] = has_item(roc_wing)

        # has_kick: Kick Boots
        helpers['has_kick'] = has_item(kick_boots)

        # has_tackle: Tackle
        helpers['has_tackle'] = has_item(tackle)

        # has_push: Heavy Ring
        helpers['has_push'] = has_item(heavy_ring)

        # has_ice_or_stone: (Serpent OR Cockatrice) AND (Mercury OR Mars)
        helpers['has_ice_or_stone'] = {
            'type': 'and',
            'conditions': [
                has_any_items([serpent, cockatrice]),
                has_any_items([mercury, mars])
            ]
        }

        # can_touch_water: if ignore_cleansing: True else: Cleansing
        if ignore_cleansing:
            helpers['can_touch_water'] = {
                'type': 'constant',
                'value': True
            }
        else:
            helpers['can_touch_water'] = has_item(cleansing)

        # broke_iron_maidens: if iron_maiden_behavior == 1 (start_broken): True else: Maiden Detonator
        # From options.py: option_start_broken = 1
        if iron_maiden_behavior == 1:
            helpers['broke_iron_maidens'] = {
                'type': 'constant',
                'value': True
            }
        else:
            helpers['broke_iron_maidens'] = has_item(maiden_detonator)

        # can_open_ceremonial_door: Last Key count >= required_last_keys
        if required_last_keys == 0:
            helpers['can_open_ceremonial_door'] = {
                'type': 'constant',
                'value': True
            }
        else:
            helpers['can_open_ceremonial_door'] = {
                'type': 'item_check',
                'item': {'type': 'constant', 'value': last_key},
                'count': {'type': 'constant', 'value': required_last_keys}
            }

        return helpers
