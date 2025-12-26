"""Kirby's Dream Land 3 game-specific export handler."""

from typing import Dict, Any, List, Optional
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

    # Note: Ability helpers (can_reach_*) are auto-discovered during rule analysis
    # and no longer need to be whitelisted explicitly.

    # Blacklist helpers that have loops or complex logic (don't export as definitions)
    # These helpers use dynamic function dispatch (ability_map[copy_abilities[enemy]])
    # which requires runtime resolution of nested dict lookups - handled via JS fallback
    HELPERS_TO_EXPORT_BLACKLIST = {'can_assemble_rob', 'can_fix_angel_wings'}

    # Preserve these helpers as helper calls (don't inline them - use JavaScript instead)
    # These helpers have loops/iterators that can't be evaluated by the frontend rule engine
    # Note: These are now expanded at export time when called with constant args via expand_helper()
    HELPERS_TO_PRESERVE = {'can_assemble_rob', 'can_fix_angel_wings'}

    # The restrictive enemy/ability pairs for Sand Canyon 6 (R.O.B. assembly)
    # Matches enemy_abilities.enemy_restrictive[1:5] from Python and JS implementations
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
    # Each ability requires the base item and the ability item
    ABILITY_REQUIREMENTS = {
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

    # Map animal names to item requirements
    # Each animal requires the animal item and the spawn item
    ANIMAL_REQUIREMENTS = {
        "Coo": ("Coo", "Coo Spawn"),
        "Kine": ("Kine", "Kine Spawn"),
        "Rick": ("Rick", "Rick Spawn"),
        "Nago": ("Nago", "Nago Spawn"),
        "ChuChu": ("ChuChu", "ChuChu Spawn"),
        "Pitch": ("Pitch", "Pitch Spawn"),
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
        """Override to add KDL3-specific settings like ability_map."""
        # Note: COMPUTED_SETTINGS handles copy_abilities export
        settings = super().get_settings_data(world, multiworld, player)

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

        # Handle helper expansion for complex helpers with constant args
        # This expands can_assemble_rob and can_fix_angel_wings at export time
        # Check both AST format (type='helper') and rule builder format (rule=helper_name)
        helper_name = None
        if rule.get('type') == 'helper':
            helper_name = rule.get('name', '')
        elif rule.get('_original_ast_type') == 'helper':
            helper_name = rule.get('rule', '')

        if helper_name and helper_name in self.HELPERS_TO_PRESERVE:
            # Normalize to AST format for expand_helper
            normalized = {'type': 'helper', 'name': helper_name, 'args': rule.get('args', [])}
            expanded = self.expand_helper(normalized)
            if expanded:
                # Recursively expand the result
                return self.expand_rule(expanded, _depth + 1)
            # If expansion failed, keep as helper call for JS fallback

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

    def expand_helper(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Expand complex KDL3 helpers with constant arguments into simplified rules.

        This method handles can_assemble_rob and can_fix_angel_wings which have
        loop logic that can't be directly converted to AST format. When these
        helpers are called with constant copy_abilities arguments, we can evaluate
        the logic at export time and produce a simplified rule.

        Args:
            rule: A helper call rule with type='helper' and name in HELPERS_TO_PRESERVE

        Returns:
            A simplified rule dict if expansion was successful, None otherwise
        """
        helper_name = rule.get('name', '')
        args = rule.get('args', [])

        # Get copy_abilities from the first argument if it's a constant
        copy_abilities = None
        if args and isinstance(args[0], dict):
            arg = args[0]
            # Handle constant wrapped in rule format
            if arg.get('type') == 'constant':
                copy_abilities = arg.get('value', {})
            elif arg.get('rule') == 'Constant':
                copy_abilities = arg.get('args', {}).get('value', {})

        if copy_abilities is None:
            logger.debug(f"Could not extract copy_abilities from {helper_name} args")
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
            return {'type': 'constant', 'value': True}  # No Ability is always true
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
        """
        Expand can_assemble_rob helper with specific copy_abilities into a rule.

        The logic requires:
        1. can_reach_coo AND can_reach_kine (animal requirements)
        2. For each of 4 Bukiset pairs, at least one Bukiset must have a reachable
           ability from the allowed list
        3. can_reach_parasol AND can_reach_stone (final ability requirements)

        Args:
            copy_abilities: Map from enemy name to ability name

        Returns:
            A rule dict representing the simplified logic
        """
        conditions = []

        # Animal requirements: need both Coo and Kine
        conditions.append(self._make_animal_check('Coo'))
        conditions.append(self._make_animal_check('Kine'))

        # For each restrictive pair, find which abilities we need to check
        for allowed_abilities, bukisets in self.ENEMY_RESTRICTIVE_ROB:
            pair_conditions = []

            for bukiset in bukisets:
                enemy_ability = copy_abilities.get(bukiset)
                if enemy_ability and enemy_ability in allowed_abilities:
                    # This bukiset has an allowed ability - add its item check
                    ability_check = self._make_ability_check(enemy_ability)
                    if ability_check:
                        pair_conditions.append(ability_check)

            if pair_conditions:
                if len(pair_conditions) == 1:
                    conditions.append(pair_conditions[0])
                else:
                    # OR together all valid bukisets for this pair
                    conditions.append({'type': 'or', 'conditions': pair_conditions})
            else:
                # No bukiset in this pair has an allowed ability - this should never happen
                # for valid copy_abilities, but return False if it does
                logger.warning(f"No valid bukiset for pair {allowed_abilities} in can_assemble_rob")
                return {'type': 'constant', 'value': False}

        # Final ability requirements: need Parasol and Stone
        conditions.append(self._make_ability_check('Parasol Ability'))
        conditions.append(self._make_ability_check('Stone Ability'))

        logger.debug(f"Expanded can_assemble_rob to {len(conditions)} conditions")
        return {'type': 'and', 'conditions': conditions}

    def _expand_can_fix_angel_wings(self, copy_abilities: Dict[str, str]) -> Dict[str, Any]:
        """
        Expand can_fix_angel_wings helper with specific copy_abilities into a rule.

        Requires being able to reach ALL abilities from specific enemies:
        Sparky, Blocky, Jumper Shoot, Yuki, Sir Kibble, Haboki, Boboo, Captain Stitch

        Args:
            copy_abilities: Map from enemy name to ability name

        Returns:
            A rule dict representing the simplified logic
        """
        conditions = []

        for enemy in self.ANGEL_WINGS_ENEMIES:
            enemy_ability = copy_abilities.get(enemy)
            if enemy_ability:
                ability_check = self._make_ability_check(enemy_ability)
                if ability_check:
                    # Only add non-trivial checks (skip "No Ability" which returns constant True)
                    if ability_check.get('type') != 'constant':
                        conditions.append(ability_check)
            else:
                logger.warning(f"No ability mapping for enemy '{enemy}' in copy_abilities")
                return {'type': 'constant', 'value': False}

        if not conditions:
            # All enemies have "No Ability" - always reachable
            return {'type': 'constant', 'value': True}

        logger.debug(f"Expanded can_fix_angel_wings to {len(conditions)} conditions")
        return {'type': 'and', 'conditions': conditions}