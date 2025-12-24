"""Kirby's Dream Land 3 game-specific export handler."""

from typing import Dict, Any, List, Optional, Set, Tuple
from .generic import GenericGameExportHandler
import logging
import importlib

logger = logging.getLogger(__name__)

# Enemy restrictive pairs for can_assemble_rob (indices 1-4 from enemy_abilities.enemy_restrictive)
# Each tuple is (allowed_abilities, bukisets)
ENEMY_RESTRICTIVE_ROB: List[Tuple[List[str], List[str]]] = [
    (["Parasol Ability", "Cutter Ability"], ['Bukiset (Parasol)', 'Bukiset (Cutter)']),
    (["Spark Ability", "Clean Ability"], ['Bukiset (Spark)', 'Bukiset (Clean)']),
    (["Ice Ability", "Needle Ability"], ['Bukiset (Ice)', 'Bukiset (Needle)']),
    (["Stone Ability", "Burning Ability"], ['Bukiset (Stone)', 'Bukiset (Burning)']),
]

# Enemies required for can_fix_angel_wings
ANGEL_WINGS_ENEMIES: List[str] = [
    "Sparky", "Blocky", "Jumper Shoot", "Yuki",
    "Sir Kibble", "Haboki", "Boboo", "Captain Stitch"
]

# Mapping of ability names to helper function names
ABILITY_TO_HELPER: Dict[str, str] = {
    "Burning Ability": "can_reach_burning",
    "Stone Ability": "can_reach_stone",
    "Ice Ability": "can_reach_ice",
    "Needle Ability": "can_reach_needle",
    "Clean Ability": "can_reach_clean",
    "Parasol Ability": "can_reach_parasol",
    "Spark Ability": "can_reach_spark",
    "Cutter Ability": "can_reach_cutter",
    "No Ability": None,  # No ability means always accessible
}


class KDL3GameExportHandler(GenericGameExportHandler):
    """Handle KDL3-specific rule expansions and f-string conversions."""

    AUTO_PRESERVE_LARGE_HELPERS = False

    # Module path for helper functions
    HELPER_MODULES = ['worlds.kdl3.rules']

    # Whitelist ability and animal reach helpers that are used in the expanded rules
    # for can_assemble_rob and can_fix_angel_wings. These need to be exported so
    # the worldgen can properly interpret them.
    HELPERS_TO_EXPORT_WHITELIST: Set[str] = {
        'can_reach_coo', 'can_reach_kine', 'can_reach_rick',
        'can_reach_chuchu', 'can_reach_nago', 'can_reach_pitch',
        'can_reach_burning', 'can_reach_stone', 'can_reach_ice',
        'can_reach_needle', 'can_reach_clean', 'can_reach_parasol',
        'can_reach_spark', 'can_reach_cutter',
    }

    # Note: can_assemble_rob and can_fix_angel_wings are now expanded inline
    # at export time rather than being preserved as helper calls.
    # This ensures the worldgen can properly interpret the rules.
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = set()
    HELPERS_TO_PRESERVE: Set[str] = set()

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
        """Recursively expand and convert KDL3 rules, including f-strings and complex helpers."""
        if not rule:
            return rule

        # Handle can_assemble_rob and can_fix_angel_wings helper expansion
        # These helpers have complex loop logic, so we expand them at export time
        # using the constant copy_abilities argument
        if rule.get('type') == 'helper' or rule.get('_original_ast_type') == 'helper':
            helper_name = rule.get('name', '') or rule.get('rule', '')
            if helper_name == 'can_assemble_rob':
                expanded = self._expand_can_assemble_rob(rule)
                if expanded:
                    return expanded
            elif helper_name == 'can_fix_angel_wings':
                expanded = self._expand_can_fix_angel_wings(rule)
                if expanded:
                    return expanded

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
    
    # NOTE: post_process_data removed - f-string resolution now happens during
    # the initial export pass via safe_expand_rule() -> expand_rule() -> _convert_f_string()

    def _extract_copy_abilities(self, rule: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Extract copy_abilities dictionary from a helper rule's arguments."""
        args = rule.get('args', [])
        if not args:
            return None

        # The copy_abilities is typically the first argument
        first_arg = args[0] if args else None
        if not isinstance(first_arg, dict):
            return None

        # Handle Rule Builder format: {'rule': 'Constant', 'args': {'value': {...}}}
        if first_arg.get('rule') == 'Constant':
            return first_arg.get('args', {}).get('value')

        # Handle AST format: {'type': 'constant', 'value': {...}}
        if first_arg.get('type') == 'constant':
            return first_arg.get('value')

        return None

    def _make_helper_call(self, helper_name: str) -> Dict[str, Any]:
        """Create a helper call rule for a can_reach_* helper."""
        return {
            'type': 'helper',
            'name': helper_name,
            'args': []
        }

    def _make_and_rule(self, conditions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create an AND rule from a list of conditions."""
        if len(conditions) == 0:
            return {'type': 'constant', 'value': True}
        if len(conditions) == 1:
            return conditions[0]
        return {
            'type': 'and',
            'conditions': conditions
        }

    def _make_or_rule(self, conditions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create an OR rule from a list of conditions."""
        if len(conditions) == 0:
            return {'type': 'constant', 'value': False}
        if len(conditions) == 1:
            return conditions[0]
        return {
            'type': 'or',
            'conditions': conditions
        }

    def _expand_can_assemble_rob(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Expand can_assemble_rob helper to an AND/OR rule structure.

        The logic is:
        1. Must have Coo AND Kine animals
        2. For each bukiset pair in ENEMY_RESTRICTIVE_ROB:
           - Find bukisets that have an ability in the allowed abilities list
           - Check if we can reach at least one of those abilities
        3. Must have Parasol AND Stone abilities
        """
        copy_abilities = self._extract_copy_abilities(rule)
        if not copy_abilities:
            logger.warning("Could not extract copy_abilities for can_assemble_rob")
            return None

        conditions = []

        # 1. Must have Coo and Kine animals
        conditions.append(self._make_helper_call('can_reach_coo'))
        conditions.append(self._make_helper_call('can_reach_kine'))

        # 2. For each bukiset pair, need at least one reachable ability
        for allowed_abilities, bukisets in ENEMY_RESTRICTIVE_ROB:
            or_conditions = []
            for bukiset in bukisets:
                enemy_ability = copy_abilities.get(bukiset)
                if enemy_ability and enemy_ability in allowed_abilities:
                    helper_name = ABILITY_TO_HELPER.get(enemy_ability)
                    if helper_name:
                        or_conditions.append(self._make_helper_call(helper_name))
                    elif enemy_ability == "No Ability":
                        # No ability means always accessible
                        or_conditions.append({'type': 'constant', 'value': True})

            if or_conditions:
                conditions.append(self._make_or_rule(or_conditions))
            else:
                # No valid bukisets for this pair - this would make the check fail
                # but we should still include the constraint
                logger.warning(f"No valid bukisets found for abilities {allowed_abilities}")
                conditions.append({'type': 'constant', 'value': False})

        # 3. Must have Parasol and Stone abilities
        conditions.append(self._make_helper_call('can_reach_parasol'))
        conditions.append(self._make_helper_call('can_reach_stone'))

        result = self._make_and_rule(conditions)
        logger.debug(f"Expanded can_assemble_rob to: {result}")
        return result

    def _expand_can_fix_angel_wings(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Expand can_fix_angel_wings helper to an AND rule structure.

        Must be able to reach ALL abilities from the required enemies:
        Sparky, Blocky, Jumper Shoot, Yuki, Sir Kibble, Haboki, Boboo, Captain Stitch
        """
        copy_abilities = self._extract_copy_abilities(rule)
        if not copy_abilities:
            logger.warning("Could not extract copy_abilities for can_fix_angel_wings")
            return None

        conditions = []

        for enemy in ANGEL_WINGS_ENEMIES:
            enemy_ability = copy_abilities.get(enemy)
            if enemy_ability:
                helper_name = ABILITY_TO_HELPER.get(enemy_ability)
                if helper_name:
                    conditions.append(self._make_helper_call(helper_name))
                elif enemy_ability == "No Ability":
                    # No ability means always accessible - no constraint needed
                    pass
                else:
                    logger.warning(f"Unknown ability '{enemy_ability}' for enemy '{enemy}'")
            else:
                logger.warning(f"Enemy '{enemy}' not found in copy_abilities")

        if not conditions:
            # If no constraints, it's always accessible
            return {'type': 'constant', 'value': True}

        result = self._make_and_rule(conditions)
        logger.debug(f"Expanded can_fix_angel_wings to: {result}")
        return result