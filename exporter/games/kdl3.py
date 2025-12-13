"""Kirby's Dream Land 3 game-specific export handler."""

from typing import Dict, Any, List, Optional
from .base import BaseGameExportHandler
import logging
import importlib

logger = logging.getLogger(__name__)

class KDL3GameExportHandler(BaseGameExportHandler):
    """Handle KDL3-specific rule expansions and f-string conversions."""

    GAME_NAME = "Kirby's Dream Land 3"
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
    # Note: Empty set() is needed because {} with no items is a dict
    HELPERS_TO_EXPORT_BLACKLIST = {
        'can_assemble_rob',
        'can_fix_angel_wings',
    }

    # Preserve these helpers as helper calls (don't inline them - use JavaScript instead)
    HELPERS_TO_PRESERVE = {
        'can_assemble_rob',
        'can_fix_angel_wings',
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

        # Store settings for resolving attribute accesses during post-processing
        self._cached_settings: Dict[str, Any] = {}

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

        # Cache settings for use in expand_rule during post-processing
        self._cached_settings = settings
        logger.debug(f"Cached settings for post-processing: ow_boss_requirement={settings.get('ow_boss_requirement')}")

        return settings

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand and convert KDL3 rules, including f-strings and can_reach_boss."""
        if not rule:
            return rule

        # Handle f_string conversion
        if rule.get('type') == 'f_string':
            return self._convert_f_string(rule)

        # Handle item_check with f_string item names
        if rule.get('type') == 'item_check' and isinstance(rule.get('item'), dict):
            if rule['item'].get('type') == 'f_string':
                rule['item'] = self._convert_f_string(rule['item'])

        # Handle can_reach_boss helper - inline it based on settings
        if rule.get('type') == 'helper' and rule.get('name') == 'can_reach_boss':
            inlined = self._inline_can_reach_boss(rule)
            if inlined is not None:
                return inlined

        # Handle attribute access on setting_value - resolve to constant
        if rule.get('type') == 'attribute':
            resolved = self._resolve_setting_attribute(rule)
            if resolved is not None:
                return resolved

        # Handle conditional expressions that test against setting values like open_world
        if rule.get('type') == 'conditional':
            resolved = self._resolve_conditional(rule, _depth)
            if resolved is not None:
                return resolved

        # Handle name references that should resolve to setting values
        if rule.get('type') == 'name':
            resolved = self._resolve_name_reference(rule)
            if resolved is not None:
                return resolved

        # Handle item_check rules with f_string items or name/attribute counts
        if rule.get('type') == 'item_check':
            # Process item if it's an f_string
            if isinstance(rule.get('item'), dict):
                resolved_item = self.expand_rule(rule['item'], _depth + 1)
                if isinstance(resolved_item, str):
                    rule['item'] = resolved_item
                elif resolved_item != rule['item']:
                    rule['item'] = resolved_item

            # Process count
            if isinstance(rule.get('count'), dict):
                resolved_count = self._resolve_setting_attribute(rule['count'])
                if resolved_count is not None:
                    rule['count'] = resolved_count
                else:
                    # Try name reference resolution
                    resolved_count = self._resolve_name_reference(rule['count'])
                    if resolved_count is not None:
                        rule['count'] = resolved_count
                    else:
                        # Recursively expand the count
                        rule['count'] = self.expand_rule(rule['count'], _depth + 1)

        # Recursively process nested rules
        if rule.get('type') in ['and', 'or']:
            if 'conditions' in rule:
                rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule['conditions']]

        # Process other nested structures
        for key in ['access_rule', 'rule', 'condition']:
            if key in rule and isinstance(rule[key], dict):
                rule[key] = self.expand_rule(rule[key], _depth + 1)

        return rule

    def _resolve_setting_attribute(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Resolve attribute access on setting_value to a constant.

        Handles patterns like:
            {"type": "attribute", "object": {"type": "setting_value", "setting": "ow_boss_requirement"}, "attr": "value"}
        Which should resolve to:
            {"type": "constant", "value": 3}
        """
        if rule.get('type') != 'attribute':
            return None

        obj = rule.get('object', {})
        attr = rule.get('attr')

        # Check if object is a setting_value
        if obj.get('type') == 'setting_value':
            setting_name = obj.get('setting')

            # Look up the setting value - check both direct and 'options' nested location
            setting_value = None
            if setting_name:
                # First try direct lookup in cached_settings
                if setting_name in self._cached_settings:
                    setting_value = self._cached_settings[setting_name]
                # Then try under 'options' (where Archipelago stores most game options)
                elif 'options' in self._cached_settings and setting_name in self._cached_settings['options']:
                    setting_value = self._cached_settings['options'][setting_name]

            if setting_value is not None:
                # Handle .value attribute access (common for Archipelago options)
                if attr == 'value':
                    # If the setting is already the raw value (int, str, etc.), use it directly
                    if isinstance(setting_value, (int, float, str, bool)):
                        logger.debug(f"Resolved setting_value.{setting_name}.value to constant: {setting_value}")
                        return {'type': 'constant', 'value': setting_value}
                    # If it's an object with a 'value' attribute, extract it
                    elif isinstance(setting_value, dict) and 'value' in setting_value:
                        logger.debug(f"Resolved setting_value.{setting_name}.value from dict to constant: {setting_value['value']}")
                        return {'type': 'constant', 'value': setting_value['value']}

                # Handle direct attribute access (no .value)
                if attr is None:
                    if isinstance(setting_value, (int, float, str, bool)):
                        return {'type': 'constant', 'value': setting_value}

        return None

    def _resolve_name_reference(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Resolve name references to setting values.

        Handles patterns like:
            {"type": "name", "name": "open_world"}
            {"type": "name", "name": "ow_boss_req"}
        Which should resolve to their setting values as constants.
        """
        if rule.get('type') != 'name':
            return None

        name = rule.get('name')
        if not name:
            return None

        # Map common parameter names to their setting names
        name_to_setting = {
            'open_world': 'open_world',
            'ow_boss_req': 'ow_boss_requirement',
        }

        setting_name = name_to_setting.get(name)
        if not setting_name:
            return None

        # Look up the setting value
        setting_value = None
        if setting_name in self._cached_settings:
            setting_value = self._cached_settings[setting_name]
        elif 'options' in self._cached_settings and setting_name in self._cached_settings['options']:
            setting_value = self._cached_settings['options'][setting_name]

        if setting_value is not None:
            logger.debug(f"Resolved name '{name}' to constant: {setting_value}")
            return {'type': 'constant', 'value': setting_value}

        return None

    def _resolve_conditional(self, rule: Dict[str, Any], _depth: int) -> Optional[Dict[str, Any]]:
        """
        Resolve conditional expressions by evaluating the test and returning the appropriate branch.

        Handles patterns like:
            {"type": "conditional", "test": {"type": "name", "name": "open_world"}, "if_true": ..., "if_false": ...}

        If open_world is true, returns the expanded if_true branch.
        If open_world is false, returns the expanded if_false branch.
        """
        if rule.get('type') != 'conditional':
            return None

        test = rule.get('test', {})
        if_true = rule.get('if_true')
        if_false = rule.get('if_false')

        # Check if the test is a simple name reference we can resolve
        if test.get('type') == 'name':
            resolved_test = self._resolve_name_reference(test)
            if resolved_test and resolved_test.get('type') == 'constant':
                test_value = resolved_test.get('value')

                # Select the appropriate branch based on truthiness
                if test_value:
                    logger.debug(f"Conditional test '{test.get('name')}' is truthy ({test_value}), selecting if_true branch")
                    if if_true:
                        return self.expand_rule(if_true, _depth + 1)
                else:
                    logger.debug(f"Conditional test '{test.get('name')}' is falsy ({test_value}), selecting if_false branch")
                    if if_false:
                        return self.expand_rule(if_false, _depth + 1)

        return None

    def _inline_can_reach_boss(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Inline can_reach_boss helper calls based on the constant arguments.

        The Python helper has this logic:
            def can_reach_boss(state, player, level, open_world, ow_boss_req, player_levels):
                if open_world:
                    return state.has(f"{level_names_inverse[level]} - Stage Completion", player, ow_boss_req)
                else:
                    return state.can_reach(location_table[player_levels[level][5]], "Location", player)

        Since all arguments are constants at generation time, we can inline this.
        """
        args = rule.get('args', [])
        if len(args) < 4:
            logger.warning(f"can_reach_boss has unexpected number of args: {len(args)}")
            return None

        # Extract argument values
        # args[0] = level (1-5)
        # args[1] = open_world (0 or 1)
        # args[2] = ow_boss_req (count)
        # args[3] = player_levels (dict, only used when open_world=0)

        level_arg = args[0]
        open_world_arg = args[1]
        ow_boss_req_arg = args[2]
        player_levels_arg = args[3] if len(args) > 3 else None

        # Get the level value
        level = self._get_constant_value(level_arg)
        if level is None:
            logger.debug("can_reach_boss: level is not a constant")
            return None

        # Get open_world value
        open_world = self._get_constant_value(open_world_arg)
        if open_world is None:
            logger.debug("can_reach_boss: open_world is not a constant")
            return None

        # Get ow_boss_req value
        ow_boss_req = self._get_constant_value(ow_boss_req_arg)
        if ow_boss_req is None:
            logger.debug("can_reach_boss: ow_boss_req is not a constant")
            return None

        if open_world:
            # open_world mode: state.has("<Level Name> - Stage Completion", player, ow_boss_req)
            level_name = self.level_names_inverse.get(level)
            if level_name is None:
                logger.warning(f"can_reach_boss: unknown level {level}")
                return None

            item_name = f"{level_name} - Stage Completion"
            logger.debug(f"Inlining can_reach_boss (open_world): level={level} -> item_check({item_name}, {ow_boss_req})")

            return {
                'type': 'item_check',
                'item': item_name,
                'count': {
                    'type': 'constant',
                    'value': ow_boss_req
                }
            }
        else:
            # Non open_world mode: state.can_reach(location_table[player_levels[level][5]], "Location", player)
            # We need to look up the location from player_levels
            player_levels = self._get_constant_value(player_levels_arg)
            if player_levels is None or not isinstance(player_levels, dict):
                logger.debug("can_reach_boss: player_levels is not a constant dict")
                return None

            # player_levels is a dict like {1: [loc_ids...], 2: [...], ...}
            # We need player_levels[level][5] which is the location ID
            level_key = str(level) if str(level) in player_levels else level
            level_locs = player_levels.get(level_key) or player_levels.get(level)

            if level_locs is None or len(level_locs) < 6:
                logger.warning(f"can_reach_boss: no location data for level {level}")
                return None

            location_id = level_locs[5]

            # We need to convert location_id to location name
            # For now, use can_reach with the location ID
            # The frontend will need to handle this
            logger.debug(f"Inlining can_reach_boss (non-open_world): level={level} -> can_reach location_id={location_id}")

            return {
                'type': 'can_reach',
                'region': f'__location_id__{location_id}',  # Marker for location ID lookup
                'reach_type': 'Location'
            }

    def _get_constant_value(self, arg: Any) -> Any:
        """Extract a constant value from a rule argument."""
        if arg is None:
            return None
        if isinstance(arg, dict):
            if arg.get('type') == 'constant':
                return arg.get('value')
            # Not a constant
            return None
        # Assume it's already a raw value
        return arg
    
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
        """Post-process the exported data to resolve f-strings and setting-dependent rules."""
        logger.debug(f"KDL3 post_process_data called")

        # If cached settings are empty, try to populate from export_data
        if not self._cached_settings and 'settings' in data:
            # Get first player's settings
            for player_id, settings in data['settings'].items():
                if isinstance(settings, dict) and 'error' not in settings:
                    self._cached_settings = settings
                    logger.debug(f"Populated cached_settings from export_data")
                    break

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