"""Kirby's Dream Land 3 game-specific export handler."""

from typing import Dict, Any, List, Optional
from .generic import GenericGameExportHandler
import logging
import importlib

logger = logging.getLogger(__name__)

class KDL3GameExportHandler(GenericGameExportHandler):
    """Handle KDL3-specific rule expansions and f-string conversions."""

    AUTO_PRESERVE_LARGE_HELPERS = False

    # Module path for helper functions
    HELPER_MODULES = ['worlds.kdl3.rules']

    # Whitelist ability helpers that are called dynamically via ability_map
    # These need to be exported even though they're not discovered via direct calls
    HELPERS_TO_EXPORT_WHITELIST = {
        'can_reach_burning',
        'can_reach_stone',
        'can_reach_ice',
        'can_reach_needle',
        'can_reach_clean',
        'can_reach_parasol',
        'can_reach_spark',
        'can_reach_cutter',
        'can_reach_rick',
        'can_reach_kine',
        'can_reach_coo',
        'can_reach_nago',
        'can_reach_chuchu',
        'can_reach_pitch',
    }

    # Blacklist helpers that have loops or complex logic (don't export as definitions)
    # These helpers use dynamic function dispatch (ability_map[copy_abilities[enemy]])
    # which requires runtime resolution of nested dict lookups - expanded during post_process_data
    HELPERS_TO_EXPORT_BLACKLIST = {'can_assemble_rob', 'can_fix_angel_wings'}

    # Preserve these helpers as helper calls (don't inline their AST)
    # They will be expanded into AND/OR rules in post_process_data via expand_rule
    HELPERS_TO_PRESERVE = {'can_assemble_rob', 'can_fix_angel_wings'}

    # The restrictive enemy/ability pairs for Sand Canyon 6 (R.O.B. assembly)
    # Each entry is [allowedAbilities, bukisetEnemies]
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

    # Map from ability names to the items required to reach them
    ABILITY_ITEMS = {
        "No Ability": None,  # Always reachable
        "Burning Ability": ("Burning", "Burning Ability"),
        "Stone Ability": ("Stone", "Stone Ability"),
        "Ice Ability": ("Ice", "Ice Ability"),
        "Needle Ability": ("Needle", "Needle Ability"),
        "Clean Ability": ("Clean", "Clean Ability"),
        "Parasol Ability": ("Parasol", "Parasol Ability"),
        "Spark Ability": ("Spark", "Spark Ability"),
        "Cutter Ability": ("Cutter", "Cutter Ability"),
    }

    # Map parameter names used in inlined functions to actual setting names
    # When can_reach_boss is inlined, it uses parameter name 'ow_boss_req' but the
    # setting is exported as 'ow_boss_requirement'
    NAME_REMAPPING = {
        'ow_boss_req': 'ow_boss_requirement',
    }

    # Setting names that should be converted from 'name' type to 'setting_value' type
    # This ensures they are looked up via getSetting which checks options.* path
    SETTINGS_TO_CONVERT = {
        'open_world',
        'ow_boss_requirement',
    }

    def __init__(self):
        """Initialize the KDL3 export handler and load location_name module."""
        super().__init__()
        # Import location_name module to access level_names_inverse
        try:
            location_name_mod = importlib.import_module('worlds.kdl3.names.location_name')
            self.level_names_inverse = getattr(location_name_mod, 'level_names_inverse', {})
            logger.debug(f"Loaded level_names_inverse: {self.level_names_inverse}")
        except Exception as e:
            logger.warning(f"Could not load location_name module: {e}")
            self.level_names_inverse = {}

    def get_settings_data(self, world, multiworld, player):
        """Override to add KDL3-specific settings like copy_abilities."""
        settings = super().get_settings_data(world, multiworld, player)

        # Export copy_abilities dictionary if it exists on the world
        if hasattr(world, 'copy_abilities'):
            settings['copy_abilities'] = world.copy_abilities
            logger.debug(f"Exported copy_abilities: {len(world.copy_abilities)} entries")
        else:
            logger.warning("World does not have copy_abilities attribute")

        # Export ability_map as a dictionary mapping ability names to helper function names
        # This is needed for the dynamic function dispatch pattern:
        # ability_map[copy_abilities[enemy]](state, player)
        try:
            from worlds.kdl3 import rules as kdl3_rules
            if hasattr(kdl3_rules, 'ability_map'):
                # Convert function references to their names
                ability_map = {}
                for ability_name, func in kdl3_rules.ability_map.items():
                    if callable(func):
                        func_name = getattr(func, '__name__', None)
                        if func_name:
                            ability_map[ability_name] = func_name
                        else:
                            # Lambda functions - extract name from string representation
                            ability_map[ability_name] = str(func)
                    else:
                        ability_map[ability_name] = str(func)
                settings['ability_map'] = ability_map
                logger.debug(f"Exported ability_map: {ability_map}")
        except Exception as e:
            logger.warning(f"Could not export ability_map: {e}")

        return settings

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand and convert KDL3 rules, including f-strings."""
        if not rule:
            return rule

        # Expand complex helpers (can_assemble_rob, can_fix_angel_wings)
        if rule.get('type') == 'helper':
            helper_name = rule.get('name', '')
            if helper_name == 'can_assemble_rob':
                return self._expand_can_assemble_rob(rule)
            elif helper_name == 'can_fix_angel_wings':
                return self._expand_can_fix_angel_wings(rule)

        # Handle name remapping and conversion to setting_value type
        if rule.get('type') == 'name':
            name = rule.get('name', '')
            # First apply any name remapping
            if name in self.NAME_REMAPPING:
                name = self.NAME_REMAPPING[name]
                logger.debug(f"Remapped name '{rule.get('name')}' to '{name}'")

            # Convert known setting names to setting_value type
            # This ensures they are looked up via getSetting which properly checks options.*
            if name in self.SETTINGS_TO_CONVERT:
                logger.debug(f"Converting name '{name}' to setting_value type")
                return {'type': 'setting_value', 'setting': name}

            # Otherwise just update the name and return
            rule['name'] = name
            return rule

        # Handle f_string conversion
        if rule.get('type') == 'f_string':
            return self._convert_f_string(rule)

        # Handle item_check with f_string item names - recursively process item
        if rule.get('type') == 'item_check' and isinstance(rule.get('item'), dict):
            rule['item'] = self.expand_rule(rule['item'], _depth + 1)
        # Also process count if it's a dict
        if rule.get('type') == 'item_check' and isinstance(rule.get('count'), dict):
            rule['count'] = self.expand_rule(rule['count'], _depth + 1)

        # Recursively process nested rules for 'and' and 'or'
        if rule.get('type') in ['and', 'or']:
            if 'conditions' in rule:
                rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule['conditions']]

        # Handle conditional rules with if_true/if_false branches
        if rule.get('type') == 'conditional':
            if 'test' in rule and isinstance(rule['test'], dict):
                rule['test'] = self.expand_rule(rule['test'], _depth + 1)
            if 'if_true' in rule and isinstance(rule['if_true'], dict):
                rule['if_true'] = self.expand_rule(rule['if_true'], _depth + 1)
            if 'if_false' in rule and isinstance(rule['if_false'], dict):
                rule['if_false'] = self.expand_rule(rule['if_false'], _depth + 1)

        # Process other nested structures
        for key in ['access_rule', 'rule', 'condition']:
            if key in rule and isinstance(rule[key], dict):
                rule[key] = self.expand_rule(rule[key], _depth + 1)

        return rule
    
    def _convert_f_string(self, f_string_rule: Dict[str, Any]) -> Any:
        """Convert an f_string AST node to a simple concatenated string.

        Uses base class resolve_f_string with game-specific subscript handling.
        """
        result = self.resolve_f_string(f_string_rule)
        if result is not None:
            return result
        # Fallback: return original rule if we can't resolve
        return f_string_rule

    def _resolve_f_string_value(self, value_node: Dict[str, Any]) -> Optional[Any]:
        """
        Override to handle KDL3-specific subscript expressions.

        Handles level_names_inverse[level] lookups in addition to base class support.
        """
        # First try base class resolution
        result = super()._resolve_f_string_value(value_node)
        if result is not None:
            return result

        # Handle subscript expressions like location_name.level_names_inverse[level]
        if value_node.get('type') == 'subscript':
            return self._evaluate_subscript(value_node)

        return None

    def _evaluate_subscript(self, node: Dict[str, Any]) -> Any:
        """
        Evaluate a subscript expression node.
        Handles expressions like location_name.level_names_inverse[level].
        """
        if node.get('type') != 'subscript':
            return None

        # Get the value being subscripted (e.g., location_name.level_names_inverse)
        value_node = node.get('value', {})
        # Get the index (e.g., level or 1)
        index_node = node.get('index', {})

        # Evaluate the index - it should be a constant in most cases
        if index_node.get('type') == 'constant':
            index_value = index_node.get('value')
        else:
            logger.debug(f"Non-constant index in subscript: {index_node}")
            return None

        # Check if the value is an attribute access (e.g., location_name.level_names_inverse)
        if value_node.get('type') == 'attribute':
            attr_name = value_node.get('attr')

            # Check if this is accessing level_names_inverse
            if attr_name == 'level_names_inverse':
                # Use our cached level_names_inverse dictionary
                if index_value in self.level_names_inverse:
                    result = self.level_names_inverse[index_value]
                    logger.debug(f"Resolved subscript level_names_inverse[{index_value}] to: {result}")
                    return result
                else:
                    logger.warning(f"Index {index_value} not found in level_names_inverse")
                    return None
            else:
                logger.debug(f"Unknown attribute in subscript: {attr_name}")
                return None
        else:
            logger.debug(f"Non-attribute value in subscript: {value_node}")
            return None
    
    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process the exported data to resolve f-strings in rules."""
        if 'regions' in data:
            data['regions'] = self._process_regions(data['regions'])
        return data

    def _process_regions(self, regions: Dict[str, Any]) -> Dict[str, Any]:
        """Process all regions and their locations/entrances/exits."""
        for player_id, player_regions in regions.items():
            for region_name, region_data in player_regions.items():
                # Process locations
                if 'locations' in region_data:
                    for location in region_data['locations']:
                        if 'access_rule' in location:
                            location['access_rule'] = self.expand_rule(location['access_rule'])

                # Process entrances
                if 'entrances' in region_data:
                    for entrance in region_data['entrances']:
                        if 'access_rule' in entrance:
                            entrance['access_rule'] = self.expand_rule(entrance['access_rule'])

                # Process exits
                if 'exits' in region_data:
                    for exit_data in region_data['exits']:
                        if 'access_rule' in exit_data:
                            exit_data['access_rule'] = self.expand_rule(exit_data['access_rule'])

        return regions

    def _make_ability_check(self, ability_name: str) -> Dict[str, Any]:
        """Create a rule to check if an ability is reachable.

        Returns an AND rule checking both the base item and ability item,
        or a True constant for "No Ability" (always reachable).
        """
        items = self.ABILITY_ITEMS.get(ability_name)
        if items is None:
            # "No Ability" or unknown - always True
            return {'type': 'constant', 'value': True}

        base_item, ability_item = items
        return {
            'type': 'and',
            'conditions': [
                {'type': 'item_check', 'item': base_item},
                {'type': 'item_check', 'item': ability_item}
            ]
        }

    def _make_helper_call(self, helper_name: str) -> Dict[str, Any]:
        """Create a helper call rule."""
        return {'type': 'helper', 'name': helper_name, 'args': []}

    def _expand_can_assemble_rob(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Expand can_assemble_rob helper into concrete AND/OR rules.

        Requirements:
        1. Must have Coo and Kine animal friends
        2. For each of 4 Bukiset pairs, at least one Bukiset must:
           - Have an ability in the allowed abilities list (via copy_abilities mapping)
           - And that ability must be reachable
        3. Must have Parasol and Stone abilities
        """
        args = rule.get('args', [])
        if not args or not isinstance(args[0], dict):
            logger.warning("can_assemble_rob missing copy_abilities argument")
            return {'type': 'constant', 'value': True}

        # Get copy_abilities from the constant argument
        copy_abilities = args[0].get('value', {})
        if not isinstance(copy_abilities, dict):
            logger.warning("can_assemble_rob copy_abilities is not a dict")
            return {'type': 'constant', 'value': True}

        conditions = []

        # 1. Need Coo and Kine
        conditions.append(self._make_helper_call('can_reach_coo'))
        conditions.append(self._make_helper_call('can_reach_kine'))

        # 2. For each restrictive pair, need at least one bukiset with an allowed ability
        for allowed_abilities, bukisets in self.ENEMY_RESTRICTIVE_ROB:
            # Find which bukisets have abilities in the allowed list and can be reached
            pair_options = []
            for bukiset in bukisets:
                enemy_ability = copy_abilities.get(bukiset, "No Ability")
                if enemy_ability in allowed_abilities:
                    # This bukiset has an allowed ability - add check for that ability
                    pair_options.append(self._make_ability_check(enemy_ability))

            if not pair_options:
                # No bukiset in this pair has an allowed ability - requirement can never be met
                # This should be rare in valid seeds
                logger.warning(f"No bukiset has allowed ability for pair {allowed_abilities}")
                return {'type': 'constant', 'value': False}

            if len(pair_options) == 1:
                conditions.append(pair_options[0])
            else:
                conditions.append({'type': 'or', 'conditions': pair_options})

        # 3. Need Parasol and Stone abilities
        conditions.append(self._make_helper_call('can_reach_parasol'))
        conditions.append(self._make_helper_call('can_reach_stone'))

        return {'type': 'and', 'conditions': conditions}

    def _expand_can_fix_angel_wings(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Expand can_fix_angel_wings helper into concrete AND rules.

        Requires the ability to reach ALL abilities from specific enemies:
        Sparky, Blocky, Jumper Shoot, Yuki, Sir Kibble, Haboki, Boboo, Captain Stitch
        """
        args = rule.get('args', [])
        if not args or not isinstance(args[0], dict):
            logger.warning("can_fix_angel_wings missing copy_abilities argument")
            return {'type': 'constant', 'value': True}

        # Get copy_abilities from the constant argument
        copy_abilities = args[0].get('value', {})
        if not isinstance(copy_abilities, dict):
            logger.warning("can_fix_angel_wings copy_abilities is not a dict")
            return {'type': 'constant', 'value': True}

        conditions = []

        # Must be able to reach ALL abilities from the required enemies
        for enemy in self.ANGEL_WINGS_ENEMIES:
            enemy_ability = copy_abilities.get(enemy, "No Ability")
            conditions.append(self._make_ability_check(enemy_ability))

        return {'type': 'and', 'conditions': conditions}