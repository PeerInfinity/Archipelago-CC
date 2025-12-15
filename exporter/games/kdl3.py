"""Kirby's Dream Land 3 game-specific export handler."""

from typing import Dict, Any, List, Optional
from .base import BaseGameExportHandler
import logging
import importlib

logger = logging.getLogger(__name__)

class KDL3GameExportHandler(BaseGameExportHandler):
    """Handle KDL3-specific rule expansions and f-string conversions."""

    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
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
    # which requires runtime resolution of nested dict lookups - handled via JS fallback
    HELPERS_TO_EXPORT_BLACKLIST = {'can_assemble_rob', 'can_fix_angel_wings'}

    # Preserve these helpers as helper calls (don't inline them - use JavaScript instead)
    # These helpers have loops/iterators that can't be evaluated by the frontend rule engine
    HELPERS_TO_PRESERVE = {'can_assemble_rob', 'can_fix_angel_wings'}

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
        """Convert an f_string AST node to a simple concatenated string."""
        if f_string_rule.get('type') != 'f_string':
            return f_string_rule
            
        parts = f_string_rule.get('parts', [])
        result_parts = []
        
        for part in parts:
            if part.get('type') == 'constant':
                # Regular string literal part
                result_parts.append(part.get('value', ''))
            elif part.get('type') == 'formatted_value':
                # Expression inside f-string
                value_node = part.get('value', {})
                if value_node.get('type') == 'constant':
                    result_parts.append(str(value_node.get('value', '')))
                elif value_node.get('type') == 'name':
                    # This is a variable reference - for now just use the name
                    # In a more complete implementation, we'd resolve the variable
                    logger.warning(f"Variable reference in f-string: {value_node.get('name')}")
                    result_parts.append(f"{{{value_node.get('name')}}}")
                elif value_node.get('type') == 'binary_op':
                    # Handle binary operations like "3 - 1"
                    result = self._evaluate_binary_op(value_node)
                    result_parts.append(str(result))
                elif value_node.get('type') == 'subscript':
                    # Handle subscript expressions like location_name.level_names_inverse[level]
                    result = self._evaluate_subscript(value_node)
                    if result is not None:
                        result_parts.append(str(result))
                    else:
                        logger.warning(f"Could not evaluate subscript in f-string: {value_node}")
                        result_parts.append(str(value_node))
                else:
                    # Other expression types - convert to string representation
                    logger.warning(f"Complex expression in f-string: {value_node}")
                    result_parts.append(str(value_node))
                    
        # Join all parts into a single string
        return ''.join(result_parts)
    
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

    def _evaluate_binary_op(self, node: Dict[str, Any]) -> Any:
        """Evaluate a binary operation node."""
        if node.get('type') != 'binary_op':
            return node

        left = node.get('left', {})
        right = node.get('right', {})
        op = node.get('op', '')

        # Get values
        left_val = left.get('value') if left.get('type') == 'constant' else left
        right_val = right.get('value') if right.get('type') == 'constant' else right

        # Perform operation
        if op == '-':
            return left_val - right_val
        elif op == '+':
            return left_val + right_val
        elif op == '*':
            return left_val * right_val
        elif op == '/':
            return left_val / right_val
        elif op == '//':
            return left_val // right_val
        elif op == '%':
            return left_val % right_val
        else:
            logger.warning(f"Unknown binary operator: {op}")
            return f"{left_val} {op} {right_val}"
    
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