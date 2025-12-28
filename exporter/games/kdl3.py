"""Kirby's Dream Land 3 game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging
import importlib

logger = logging.getLogger(__name__)


class KDL3GameExportHandler(GenericGameExportHandler):
    """Handle KDL3-specific rule expansions and f-string conversions."""

    # Simple world attributes that can be automatically exported via base class
    COMPUTED_SETTINGS = {
        'copy_abilities': lambda w, m, p: getattr(w, 'copy_abilities', {}),
    }

    # Module path for helper functions
    HELPER_MODULES = ['worlds.kdl3.rules']

    # Blacklist helpers that have loops or complex logic (don't export as definitions)
    # Blacklisted helpers are automatically preserved as helper calls
    HELPERS_TO_EXPORT_BLACKLIST = {'can_assemble_rob', 'can_fix_angel_wings'}

    # Map parameter names used in inlined functions to actual setting names
    NAME_REMAPPING = {
        'ow_boss_req': 'ow_boss_requirement',
    }

    # Setting names that should be converted from 'name' type to 'setting_value' type
    SETTINGS_TO_CONVERT = {
        'open_world',
        'ow_boss_requirement',
    }

    # The restrictive enemy/ability pairs for Sand Canyon 6 (R.O.B. assembly)
    ENEMY_RESTRICTIVE_ROB = [
        (["Parasol Ability", "Cutter Ability"], ["Bukiset (Parasol)", "Bukiset (Cutter)"]),
        (["Spark Ability", "Clean Ability"], ["Bukiset (Spark)", "Bukiset (Clean)"]),
        (["Ice Ability", "Needle Ability"], ["Bukiset (Ice)", "Bukiset (Needle)"]),
        (["Stone Ability", "Burning Ability"], ["Bukiset (Stone)", "Bukiset (Burning)"]),
    ]

    # Enemies required for fixing angel wings (Iceberg 6 - Angel location)
    ANGEL_WINGS_ENEMIES = [
        "Sparky", "Blocky", "Jumper Shoot", "Yuki",
        "Sir Kibble", "Haboki", "Boboo", "Captain Stitch"
    ]

    # Map ability names to item requirements
    ABILITY_REQUIREMENTS = {
        "No Ability": None,
        "Burning Ability": ("Burning", "Burning Ability"),
        "Stone Ability": ("Stone", "Stone Ability"),
        "Ice Ability": ("Ice", "Ice Ability"),
        "Needle Ability": ("Needle", "Needle Ability"),
        "Clean Ability": ("Clean", "Clean Ability"),
        "Parasol Ability": ("Parasol", "Parasol Ability"),
        "Spark Ability": ("Spark", "Spark Ability"),
        "Cutter Ability": ("Cutter", "Cutter Ability"),
    }

    # Map animal names to item requirements
    ANIMAL_REQUIREMENTS = {
        "Coo": ("Coo", "Coo Spawn"),
        "Kine": ("Kine", "Kine Spawn"),
        "Rick": ("Rick", "Rick Spawn"),
        "Nago": ("Nago", "Nago Spawn"),
        "ChuChu": ("ChuChu", "ChuChu Spawn"),
        "Pitch": ("Pitch", "Pitch Spawn"),
    }

    def __init__(self):
        """Initialize the KDL3 export handler and load location_name module."""
        super().__init__()
        try:
            location_name_mod = importlib.import_module('worlds.kdl3.names.location_name')
            self.level_names_inverse = getattr(location_name_mod, 'level_names_inverse', {})
        except Exception as e:
            logger.warning(f"Could not load location_name module: {e}")
            self.level_names_inverse = {}

    def get_world_data(self, world, multiworld, player):
        """Override to add KDL3-specific world data like ability_map."""
        world_data = super().get_world_data(world, multiworld, player)

        # Export ability_map as a dictionary mapping ability names to helper function names
        try:
            from worlds.kdl3 import rules as kdl3_rules
            if hasattr(kdl3_rules, 'ability_map'):
                ability_map = {}
                for ability_name, func in kdl3_rules.ability_map.items():
                    if callable(func):
                        func_name = getattr(func, '__name__', None)
                        ability_map[ability_name] = func_name if func_name else str(func)
                    else:
                        ability_map[ability_name] = str(func)
                world_data['ability_map'] = ability_map
        except Exception as e:
            logger.warning(f"Could not export ability_map: {e}")

        return world_data

    def _resolve_f_string_value(self, value_node: Dict[str, Any]) -> Optional[Any]:
        """Handle KDL3-specific subscript expressions in f-strings."""
        result = super()._resolve_f_string_value(value_node)
        if result is not None:
            return result

        # Handle subscript expressions like location_name.level_names_inverse[level]
        if value_node.get('type') == 'subscript':
            return self._evaluate_subscript(value_node)

        return None

    def _evaluate_subscript(self, node: Dict[str, Any]) -> Any:
        """Evaluate a subscript expression node."""
        if node.get('type') != 'subscript':
            return None

        value_node = node.get('value', {})
        index_node = node.get('index', {})

        if index_node.get('type') == 'constant':
            index_value = index_node.get('value')
        else:
            return None

        if value_node.get('type') == 'attribute':
            attr_name = value_node.get('attr')
            if attr_name == 'level_names_inverse':
                if index_value in self.level_names_inverse:
                    return self.level_names_inverse[index_value]
        return None

    def expand_helper(self, helper_name: str, args=None) -> Optional[Dict[str, Any]]:
        """Expand complex KDL3 helpers with constant arguments into simplified rules."""
        if args is None:
            args = []

        # Get copy_abilities from the first argument if it's a constant
        copy_abilities = None
        if args and isinstance(args[0], dict):
            arg = args[0]
            if arg.get('type') == 'constant':
                copy_abilities = arg.get('value', {})
            elif arg.get('rule') == 'Constant':
                copy_abilities = arg.get('args', {}).get('value', {})

        if copy_abilities is None:
            return None

        if helper_name == 'can_assemble_rob':
            return self._expand_can_assemble_rob(copy_abilities)
        elif helper_name == 'can_fix_angel_wings':
            return self._expand_can_fix_angel_wings(copy_abilities)

        return None

    def _make_ability_check(self, ability_name: str) -> Optional[Dict[str, Any]]:
        """Create an item check rule for an ability."""
        reqs = self.ABILITY_REQUIREMENTS.get(ability_name)
        if reqs is None:
            return {'type': 'constant', 'value': True}
        base_item, ability_item = reqs
        return {
            'type': 'and',
            'conditions': [
                {'type': 'item_check', 'item': base_item},
                {'type': 'item_check', 'item': ability_item}
            ]
        }

    def _make_animal_check(self, animal_name: str) -> Optional[Dict[str, Any]]:
        """Create an item check rule for an animal."""
        reqs = self.ANIMAL_REQUIREMENTS.get(animal_name)
        if reqs is None:
            return None
        animal_item, spawn_item = reqs
        return {
            'type': 'and',
            'conditions': [
                {'type': 'item_check', 'item': animal_item},
                {'type': 'item_check', 'item': spawn_item}
            ]
        }

    def _expand_can_assemble_rob(self, copy_abilities: Dict[str, str]) -> Dict[str, Any]:
        """Expand can_assemble_rob helper with specific copy_abilities into a rule."""
        conditions = []

        conditions.append(self._make_animal_check('Coo'))
        conditions.append(self._make_animal_check('Kine'))

        for allowed_abilities, bukisets in self.ENEMY_RESTRICTIVE_ROB:
            pair_conditions = []
            for bukiset in bukisets:
                enemy_ability = copy_abilities.get(bukiset)
                if enemy_ability and enemy_ability in allowed_abilities:
                    ability_check = self._make_ability_check(enemy_ability)
                    if ability_check:
                        pair_conditions.append(ability_check)

            if pair_conditions:
                if len(pair_conditions) == 1:
                    conditions.append(pair_conditions[0])
                else:
                    conditions.append({'type': 'or', 'conditions': pair_conditions})
            else:
                return {'type': 'constant', 'value': False}

        conditions.append(self._make_ability_check('Parasol Ability'))
        conditions.append(self._make_ability_check('Stone Ability'))

        return {'type': 'and', 'conditions': conditions}

    def _expand_can_fix_angel_wings(self, copy_abilities: Dict[str, str]) -> Dict[str, Any]:
        """Expand can_fix_angel_wings helper with specific copy_abilities into a rule."""
        conditions = []

        for enemy in self.ANGEL_WINGS_ENEMIES:
            enemy_ability = copy_abilities.get(enemy)
            if enemy_ability:
                ability_check = self._make_ability_check(enemy_ability)
                if ability_check and ability_check.get('type') != 'constant':
                    conditions.append(ability_check)
            else:
                return {'type': 'constant', 'value': False}

        if not conditions:
            return {'type': 'constant', 'value': True}

        return {'type': 'and', 'conditions': conditions}
