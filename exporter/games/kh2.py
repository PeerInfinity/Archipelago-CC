"""Kingdom Hearts 2 specific helper expander."""

from typing import Dict, Any, List
from .base import BaseGameExportHandler
import re
import logging

logger = logging.getLogger(__name__)

class KH2GameExportHandler(BaseGameExportHandler):
    """KH2-specific expander that handles Kingdom Hearts 2 rules."""

    # Enable automatic export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Module paths containing helper functions
    HELPER_MODULES = ['worlds.kh2.Rules']

    # Module paths containing item name constants and other resolvable variables
    ITEM_NAME_MODULES = ['worlds.kh2.Names', 'worlds.kh2.Logic', 'worlds.kh2.Items']

    # Mapping of self.<attr> to setting names for the analyzer
    # This enables conversion of patterns like self.fight_logic to setting_value rules
    SELF_ATTR_TO_SETTING = {
        'fight_logic': 'FightLogic',  # self.fight_logic = world.options.FightLogic.current_key
    }

    # Helpers too complex for automatic export
    HELPERS_TO_EXPORT_BLACKLIST = {
        # Form-related helpers - expanded via expand_helper when called
        # Keep in blacklist to prevent export of complex imperative definitions
        # When called, expand_helper generates equivalent declarative rules
        'form_list_unlock',           # Expanded to conditional has_any + get_form_level_requirement
        'get_form_level_requirement', # Expanded to form count comparison with FinalFormLogic

        # Helpers with sum/loop patterns - NOW SUPPORTED
        # 'level_locking_unlock' - Now supported (setting check + sum_of)
        # 'summon_levels_unlocked' - Now supported via sum_of rule type
        # 'kh2_list_count_sum' - Now supported (sum over parameter list)
        # 'kh2_list_any_sum' - Now supported (sum with if clause)
        # 'kh2_dict_count' - Now supported (all_of with dict.items())
        # 'kh2_dict_one_count' - Now supported (sum with if clause over dict.items())
        # 'kh2_has_all' - Now supported via self.player → player_id
        # 'kh2_has_any' - Now supported via self.player → player_id

        # Location-based helpers - NOW SUPPORTED via expand_helper → location_check
        # 'kh2_can_reach' - Converted to location_check
        # 'kh2_can_reach_any' - Converted to OR of location_checks
        # 'kh2_can_reach_all' - Converted to AND of location_checks
        # 'final_form_region_access' - Expanded inline to OR of location_checks

        # Fight rule helpers - NOW SUPPORTED via sum(), closure vars, and setting_value
        # These helpers use kh2_list_any_sum, kh2_dict_count, etc. which are now supported
        # They also access self.fight_logic which maps to setting_value 'FightLogic'
        # Removing from blacklist to allow export

        # Fight rule helpers - now auto-exported via dict subscript with setting key
        # These use patterns like: fight_rules_dict[self.fight_logic]
        # The frontend evaluates the setting to get "easy"/"normal"/"hard" key,
        # then evaluates the rule at that key.

        # Static methods that return True - handled via helper_map expansion
        # 'get_axel_one_rules', 'get_axel_two_rules', 'get_twilight_thorn_rules',
        # 'get_beast_rules', 'get_grim_reaper1_rules', 'get_old_pete_rules', 'get_oogie_rules',
        'limit_form_region_access', 'multi_form_region_access',
    }

    def __init__(self, world=None):
        """Initialize with optional world reference."""
        super().__init__(world=world)

    def prepare_closure_vars(self, rule_func, closure_vars: Dict[str, Any]) -> Dict[str, Any]:
        """Inject KH2 module-level data structures into closure_vars for helper analysis.

        This ensures that constants from Logic.py and Items.py are available
        during rule analysis, even when they're not in the function's direct closure.
        """
        enhanced_closure = closure_vars.copy()

        try:
            # Import KH2 Logic module data
            from worlds.kh2.Logic import (
                auto_form_dict, summons, form_list, form_list_without_final,
                gap_closer, defensive_tool, ground_finisher, party_limit,
                donald_limit, aerial_move, black_magic, magic, three_proofs,
                final_leveling_access, drive_form_list
            )
            from worlds.kh2.Items import visit_locking_dict
            from worlds.kh2.Names import ItemName, RegionName, LocationName

            # Add all the data structures to closure vars
            data_to_inject = {
                'auto_form_dict': auto_form_dict,
                'summons': summons,
                'form_list': form_list,
                'form_list_without_final': form_list_without_final,
                'gap_closer': gap_closer,
                'defensive_tool': defensive_tool,
                'ground_finisher': ground_finisher,
                'party_limit': party_limit,
                'donald_limit': donald_limit,
                'aerial_move': aerial_move,
                'black_magic': black_magic,
                'magic': magic,
                'three_proofs': three_proofs,
                'final_leveling_access': final_leveling_access,
                'drive_form_list': drive_form_list,
                'visit_locking_dict': visit_locking_dict,
                'ItemName': ItemName,
                'RegionName': RegionName,
                'LocationName': LocationName,
            }

            # Also import all the fight rule dicts from Logic.py
            from worlds.kh2 import Logic
            for name in dir(Logic):
                if name.startswith(('easy_', 'normal_', 'hard_', 'not_hard_', 'transport_')):
                    value = getattr(Logic, name)
                    if isinstance(value, dict):
                        data_to_inject[name] = value

            for name, value in data_to_inject.items():
                if name not in enhanced_closure:
                    enhanced_closure[name] = value
                    logger.debug(f"Injected {name} into closure_vars for KH2 helper analysis")

        except ImportError as e:
            logger.warning(f"Could not import KH2 modules for closure injection: {e}")

        return enhanced_closure

    def expand_helper(self, helper_name: str, args=None):
        """Expand KH2-specific helper functions."""
        # Map of KH2 helper functions to their simplified rules
        helper_map = {
            'limit_form_region_access': {'type': 'constant', 'value': True},
            'multi_form_region_access': {'type': 'constant', 'value': True},
            # Static methods that return True (no parameters needed)
            'get_axel_one_rules': {'type': 'constant', 'value': True},
            'get_axel_two_rules': {'type': 'constant', 'value': True},
            'get_twilight_thorn_rules': {'type': 'constant', 'value': True},
            'get_beast_rules': {'type': 'constant', 'value': True},
            'get_grim_reaper1_rules': {'type': 'constant', 'value': True},
            'get_old_pete_rules': {'type': 'constant', 'value': True},
            'get_oogie_rules': {'type': 'constant', 'value': True},
        }

        # form_list_unlock(state, parent_form_list, level_required, fight_logic=False)
        # Expands the set mutation logic into a conditional rule structure
        if helper_name == 'form_list_unlock' and args and len(args) >= 2:
            from worlds.kh2.Logic import auto_form_dict
            from worlds.kh2.Names import ItemName

            parent_form_arg = args[0]  # e.g., {'type': 'constant', 'value': 'Valor Form'}
            level_required_arg = args[1]  # e.g., {'type': 'constant', 'value': 3}
            fight_logic_arg = args[2] if len(args) >= 3 else {'type': 'constant', 'value': False}

            # Extract the parent form value if it's a constant
            parent_form_value = None
            if isinstance(parent_form_arg, dict) and parent_form_arg.get('type') == 'constant':
                parent_form_value = parent_form_arg.get('value')

            # Get the auto form for this parent form
            auto_form_value = None
            if parent_form_value:
                # Find the matching entry in auto_form_dict
                for form_item, auto_item in auto_form_dict.items():
                    if form_item == parent_form_value or str(form_item) == parent_form_value:
                        auto_form_value = str(auto_item) if hasattr(auto_item, '__str__') else auto_item
                        break

            # Build the has_any(form_access) part with conditional logic
            # Base case: just check parent form
            base_form_check = {'type': 'item_check', 'item': parent_form_arg.get('value') if isinstance(parent_form_arg, dict) else parent_form_arg}

            # With auto form: or(item_check(parent_form), item_check(auto_form))
            # Using 'or' instead of 'has_any' since has_any isn't supported in ruleEngine
            if auto_form_value:
                with_auto_form_check = {
                    'type': 'or',
                    'conditions': [
                        {'type': 'item_check', 'item': parent_form_value},
                        {'type': 'item_check', 'item': auto_form_value}
                    ]
                }
            else:
                with_auto_form_check = base_form_check

            # Determine if this is MasterForm
            is_master_form = parent_form_value == str(ItemName.MasterForm) if parent_form_value else False

            # Build the conditional form access logic
            # If fight_logic is a constant False, we can simplify
            fight_logic_is_false = (isinstance(fight_logic_arg, dict) and
                                    fight_logic_arg.get('type') == 'constant' and
                                    fight_logic_arg.get('value') == False)

            if fight_logic_is_false:
                # No fight_logic, so just check AutoFormLogic AND SecondChance
                if is_master_form:
                    # MasterForm requires DriveConverter for auto form
                    form_access_rule = {
                        'type': 'conditional',
                        'test': {
                            'type': 'and',
                            'conditions': [
                                {'type': 'setting_value', 'setting': 'AutoFormLogic'},
                                {'type': 'item_check', 'item': 'Second Chance'},
                                {'type': 'item_check', 'item': 'Drive Converter'}
                            ]
                        },
                        'if_true': with_auto_form_check,
                        'if_false': base_form_check
                    }
                else:
                    # Non-MasterForm: auto form if AutoFormLogic AND SecondChance
                    form_access_rule = {
                        'type': 'conditional',
                        'test': {
                            'type': 'and',
                            'conditions': [
                                {'type': 'setting_value', 'setting': 'AutoFormLogic'},
                                {'type': 'item_check', 'item': 'Second Chance'}
                            ]
                        },
                        'if_true': with_auto_form_check,
                        'if_false': base_form_check
                    }
            else:
                # fight_logic could be True, need to include NOT fight_logic in condition
                # For simplicity, if fight_logic is True, just use base form check
                if isinstance(fight_logic_arg, dict) and fight_logic_arg.get('type') == 'constant' and fight_logic_arg.get('value') == True:
                    form_access_rule = base_form_check
                else:
                    # fight_logic is dynamic parameter - use full conditional
                    if is_master_form:
                        form_access_rule = {
                            'type': 'conditional',
                            'test': {
                                'type': 'and',
                                'conditions': [
                                    {'type': 'setting_value', 'setting': 'AutoFormLogic'},
                                    {'type': 'item_check', 'item': 'Second Chance'},
                                    {'type': 'not', 'condition': fight_logic_arg},
                                    {'type': 'item_check', 'item': 'Drive Converter'}
                                ]
                            },
                            'if_true': with_auto_form_check,
                            'if_false': base_form_check
                        }
                    else:
                        form_access_rule = {
                            'type': 'conditional',
                            'test': {
                                'type': 'and',
                                'conditions': [
                                    {'type': 'setting_value', 'setting': 'AutoFormLogic'},
                                    {'type': 'item_check', 'item': 'Second Chance'},
                                    {'type': 'not', 'condition': fight_logic_arg}
                                ]
                            },
                            'if_true': with_auto_form_check,
                            'if_false': base_form_check
                        }

            # Combine with get_form_level_requirement
            return {
                'type': 'and',
                'conditions': [
                    form_access_rule,
                    {'type': 'helper', 'name': 'get_form_level_requirement', 'args': [level_required_arg]}
                ]
            }

        # get_form_level_requirement(state, amount)
        # Checks if player has enough forms to meet the level requirement
        # Logic varies based on FinalFormLogic setting
        if helper_name == 'get_form_level_requirement' and args and len(args) >= 1:
            from worlds.kh2.Names import ItemName

            amount_arg = args[0]  # e.g., {'type': 'constant', 'value': 3}

            # Form names
            all_forms = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form']
            forms_without_final = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form']

            # Helper to build form count sum
            def build_form_count_sum(forms):
                """Build a sum of item_checks for the given forms."""
                return {
                    'type': 'sum',
                    'iterable': {
                        'type': 'list',
                        'value': [{'type': 'item_check', 'item': form} for form in forms]
                    }
                }

            # Case 1: no_light_and_darkness - count all 5 forms
            no_ld_check = {
                'type': 'comparison',
                'op': '>=',  # ruleEngine uses 'op' not 'operator'
                'left': build_form_count_sum(all_forms),
                'right': amount_arg
            }

            # Helper to build or(item_check, item_check, ...) for has_any
            def build_has_any_as_or(forms):
                """Convert has_any to or of item_checks since has_any isn't supported."""
                if len(forms) == 1:
                    return {'type': 'item_check', 'item': forms[0]}
                return {
                    'type': 'or',
                    'conditions': [{'type': 'item_check', 'item': form} for form in forms]
                }

            # Case 2: light_and_darkness
            # If has L&D + any form: bonus=1, count 4 forms (without Final)
            # If NOT (has L&D + any form): bonus=0, count ALL 5 forms (including Final!)
            # Python removes Final from list only when L&D condition is met
            ld_condition = {
                'type': 'and',
                'conditions': [
                    {'type': 'item_check', 'item': 'Light & Darkness'},
                    build_has_any_as_or(all_forms)
                ]
            }
            ld_check = {
                'type': 'conditional',
                'test': ld_condition,
                'if_true': {
                    # Has L&D + any form: bonus=1, count 4 forms without Final
                    'type': 'comparison',
                    'op': '>=',
                    'left': {
                        'type': 'binary_op',
                        'op': '+',
                        'left': {'type': 'constant', 'value': 1},
                        'right': build_form_count_sum(forms_without_final)
                    },
                    'right': amount_arg
                },
                'if_false': {
                    # No L&D condition: bonus=0, count ALL 5 forms including Final
                    'type': 'comparison',
                    'op': '>=',
                    'left': build_form_count_sum(all_forms),
                    'right': amount_arg
                }
            }

            # Case 3: just a form - bonus if has any of 4 forms, count 4 forms
            # forms_available = (1 if has_any(4 forms) else 0) + count(4 forms without Final)
            just_form_bonus = {
                'type': 'conditional',
                'test': build_has_any_as_or(forms_without_final),
                'if_true': {'type': 'constant', 'value': 1},
                'if_false': {'type': 'constant', 'value': 0}
            }
            just_form_check = {
                'type': 'comparison',
                'op': '>=',  # ruleEngine uses 'op' not 'operator'
                'left': {
                    'type': 'binary_op',
                    'op': '+',
                    'left': just_form_bonus,
                    'right': build_form_count_sum(forms_without_final)
                },
                'right': amount_arg
            }

            # Build the full conditional based on FinalFormLogic setting
            # FinalFormLogic options: 0=no_light_and_darkness, 1=light_and_darkness, 2=just_a_form
            return {
                'type': 'conditional',
                'test': {
                    'type': 'comparison',
                    'op': '!=',  # ruleEngine uses 'op' not 'operator'
                    'left': {'type': 'setting_value', 'setting': 'FinalFormLogic'},
                    'right': {'type': 'constant', 'value': 0}  # no_light_and_darkness
                },
                'if_true': {
                    # FinalFormLogic is either light_and_darkness (1) or just_a_form (2)
                    'type': 'conditional',
                    'test': {
                        'type': 'comparison',
                        'op': '==',  # ruleEngine uses 'op' not 'operator'
                        'left': {'type': 'setting_value', 'setting': 'FinalFormLogic'},
                        'right': {'type': 'constant', 'value': 1}  # light_and_darkness
                    },
                    'if_true': ld_check,
                    'if_false': just_form_check
                },
                'if_false': no_ld_check
            }

        if helper_name in helper_map:
            return helper_map[helper_name]

        # Handle kh2_can_reach - convert to location_check
        # kh2_can_reach(loc, state) checks if a location is reachable (region + access rule)
        # location_check uses isLocationAccessible which checks both region reachability AND access rule
        if helper_name == 'kh2_can_reach' and args and len(args) >= 1:
            loc_arg = args[0]
            # If loc_arg is a constant string, use it directly
            if isinstance(loc_arg, dict) and loc_arg.get('type') == 'constant':
                return {'type': 'location_check', 'location': {'type': 'constant', 'value': loc_arg.get('value')}}
            # Otherwise, keep it as a dynamic reference
            return {'type': 'location_check', 'location': loc_arg}

        # Handle kh2_can_reach_any - convert to OR of location_checks
        if helper_name == 'kh2_can_reach_any' and args and len(args) >= 1:
            loc_list_arg = args[0]
            # If loc_list_arg is a constant list, expand it inline
            if isinstance(loc_list_arg, dict) and loc_list_arg.get('type') == 'constant':
                locations = loc_list_arg.get('value', [])
                if isinstance(locations, (list, set, tuple)):
                    conditions = [{'type': 'location_check', 'location': {'type': 'constant', 'value': loc}} for loc in locations]
                    if len(conditions) == 1:
                        return conditions[0]
                    return {'type': 'or', 'conditions': conditions}
            # Otherwise preserve as any_of pattern
            return None

        # Handle kh2_can_reach_all - convert to AND of location_checks
        if helper_name == 'kh2_can_reach_all' and args and len(args) >= 1:
            loc_list_arg = args[0]
            # If loc_list_arg is a constant list, expand it inline
            if isinstance(loc_list_arg, dict) and loc_list_arg.get('type') == 'constant':
                locations = loc_list_arg.get('value', [])
                if isinstance(locations, (list, set, tuple)):
                    conditions = [{'type': 'location_check', 'location': {'type': 'constant', 'value': loc}} for loc in locations]
                    if len(conditions) == 1:
                        return conditions[0]
                    return {'type': 'and', 'conditions': conditions}
            # Otherwise preserve as all_of pattern
            return None

        # Handle final_form_region_access - expands to any() over final_leveling_access locations
        # Uses location_check which checks both region reachability AND location access rule
        if helper_name == 'final_form_region_access':
            try:
                from worlds.kh2.Logic import final_leveling_access
                # final_leveling_access is a set of location names
                locations = list(final_leveling_access)
                conditions = [{'type': 'location_check', 'location': {'type': 'constant', 'value': loc}} for loc in locations]
                if len(conditions) == 1:
                    return conditions[0]
                return {'type': 'or', 'conditions': conditions}
            except ImportError:
                logger.warning("Could not import final_leveling_access for final_form_region_access expansion")
                return None

        # For now, preserve helper nodes as-is until we identify specific helpers
        return None
        
    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand rule functions for KH2."""
        if not rule:
            return rule

        # Special handling for function_call with self methods
        if rule.get('type') == 'function_call':
            func = rule.get('function', {})
            # Check if this is a self.method_name pattern
            if func.get('type') == 'attribute' and isinstance(func.get('object'), dict):
                obj = func.get('object', {})
                if obj.get('type') == 'name' and obj.get('name') == 'self':
                    # This is a self.method_name call
                    method_name = func.get('attr')
                    args = rule.get('args', [])
                    if method_name:
                        # Try to expand this as a helper with args
                        expanded = self.expand_helper(method_name, args)
                        if expanded:
                            return self.expand_rule(expanded, _depth + 1)  # Recursively expand the result
                        # If not expandable, convert to a helper node with args
                        return {'type': 'helper', 'name': method_name, 'args': args}

        # Special handling for __analyzed_func__
        if rule.get('type') == 'state_method' and rule.get('method') == '__analyzed_func__':
            if 'original' in rule:
                return self._analyze_original_rule(rule['original'])
            return self._infer_rule_type(rule)

        # Special handling for helper nodes
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule.get('name'), rule.get('args'))
            if expanded:
                return self.expand_rule(expanded, _depth + 1)  # Recursively expand
            return rule

        # Handle and/or conditions recursively
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', [])]
            return rule

        # Recursively process all dict/list values to expand nested helpers
        return self._recursive_expand(rule, _depth)

    def _recursive_expand(self, obj: Any, depth: int = 0) -> Any:
        """Recursively expand helper calls in any nested structure."""
        if depth > 50:  # Prevent infinite recursion
            return obj

        if isinstance(obj, dict):
            # First check if this is a helper node that can be expanded
            if obj.get('type') == 'helper':
                expanded = self.expand_helper(obj.get('name'), obj.get('args'))
                if expanded:
                    return self._recursive_expand(expanded, depth + 1)
                # If not expandable, still process args
                if 'args' in obj:
                    obj['args'] = [self._recursive_expand(arg, depth + 1) for arg in obj['args']]
                return obj

            # Process all values in the dict
            result = {}
            for key, value in obj.items():
                result[key] = self._recursive_expand(value, depth + 1)
            return result

        elif isinstance(obj, list):
            return [self._recursive_expand(item, depth + 1) for item in obj]

        else:
            return obj
    
    def _analyze_original_rule(self, original_rule):
        """Analyze the original rule structure for KH2-specific patterns."""
        if original_rule.get('type') == 'state_method':
            method = original_rule.get('method', '')
            args = original_rule.get('args', [])
            
            # Handle 'has' method for item requirements
            if method == 'has' and len(args) >= 1:
                item_check = {
                    'type': 'item_check',
                    'item': args[0]
                }
                # Add count if specified
                if len(args) >= 2:
                    item_check['count'] = {'type': 'constant', 'value': args[1]}
                return item_check
                
            # Handle other known state methods
            if method in ['can_reach', 'has_group', 'has_any']:
                return {
                    'type': 'game_specific_check',
                    'method': method,
                    'args': args,
                    'description': f"Requires {method}({', '.join(str(a) for a in args)})"
                }
        
        return {
            'type': 'generic_rule',
            'description': 'KH2-specific rule',
            'details': 'This rule could not be fully analyzed'
        }
    
    def _infer_rule_type(self, rule):
        """Infer rule type for KH2 based on context clues."""
        args = rule.get('args', [])
        rule_str = str(rule)
        
        # Item check patterns
        if 'has(' in rule_str.lower() or 'state.has' in rule_str.lower():
            item_match = re.search(r"has\(['\"](.*?)['\"]\s*,", rule_str)
            if item_match:
                return {
                    'type': 'item_check',
                    'item': item_match.group(1),
                    'inferred': True
                }
        
        # Location access patterns
        if 'can_reach' in rule_str.lower():
            return {
                'type': 'can_reach',
                'inferred': True,
                'description': 'Requires reaching a specific location'
            }
        
        # Return a generic rule
        return {
            'type': 'generic_rule',
            'description': 'KH2-specific rule',
            'details': 'This rule requires KH2-specific logic'
        }
    
    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export KH2-specific settings for frontend logic."""
        # Get base settings from parent class
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Add KH2-specific settings that affect logic
        kh2_settings = [
            'FightLogic',
            'AutoFormLogic',
            'FinalFormLogic',
            'Promise_Charm',
            'CorSkipToggle'
        ]

        for setting_name in kh2_settings:
            if hasattr(world, 'options') and hasattr(world.options, setting_name):
                option = getattr(world.options, setting_name)
                # For Choice options like FightLogic, use current_key to get the string
                # (e.g., "easy", "normal", "hard") since helper dicts use string keys.
                # For other options, use the raw value.
                if hasattr(option, 'current_key'):
                    settings_dict[setting_name] = option.current_key
                elif hasattr(option, 'value'):
                    settings_dict[setting_name] = option.value
                else:
                    settings_dict[setting_name] = option

        return settings_dict

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Return KH2-specific item data with classification flags."""
        from BaseClasses import ItemClassification
        
        item_data = {}
        
        # Get items from world.item_name_to_id if available
        if hasattr(world, 'item_name_to_id'):
            for item_name, item_id in world.item_name_to_id.items():
                # Try to get classification from item class
                is_advancement = False
                is_useful = False
                is_trap = False
                
                try:
                    item_class = getattr(world, 'item_name_to_item', {}).get(item_name)
                    if item_class and hasattr(item_class, 'classification'):
                        classification = item_class.classification
                        is_advancement = classification == ItemClassification.progression
                        is_useful = classification == ItemClassification.useful
                        is_trap = classification == ItemClassification.trap
                except Exception as e:
                    logger.debug(f"Could not determine classification for {item_name}: {e}")
                    # Check item pool if available
                    if hasattr(world, 'multiworld'):
                        for item in world.multiworld.itempool:
                            if item.player == world.player and item.name == item_name:
                                is_advancement = item.classification == ItemClassification.progression
                                is_useful = item.classification == ItemClassification.useful
                                is_trap = item.classification == ItemClassification.trap
                                break
                        
                        # Check placed items in locations
                        if not (is_advancement or is_useful or is_trap):
                            for location in world.multiworld.get_locations(world.player):
                                if (location.item and location.item.player == world.player and 
                                    location.item.name == item_name and location.item.code is not None):
                                    is_advancement = location.item.classification == ItemClassification.progression
                                    is_useful = location.item.classification == ItemClassification.useful
                                    is_trap = location.item.classification == ItemClassification.trap
                                    break
                
                # Get groups if available
                groups = []
                if hasattr(world, 'item_name_groups'):
                    groups = [
                        group_name for group_name, items in world.item_name_groups.items()
                        if item_name in items
                    ]
                
                item_data[item_name] = {
                    'name': item_name,
                    'id': item_id,
                    'groups': sorted(groups),
                    'advancement': is_advancement,
                    'useful': is_useful,
                    'trap': is_trap,
                    'event': False,
                    'type': None,
                    'max_count': 1
                }
        
        # Handle event items by scanning locations
        if hasattr(world, 'multiworld'):
            for location in world.multiworld.get_locations(world.player):
                if location.item and location.item.player == world.player:
                    item_name = location.item.name
                    # Check if this is an event item (no code/ID) that we haven't seen
                    if (location.item.code is None and 
                        item_name not in item_data and
                        hasattr(location.item, 'classification')):
                        
                        item_data[item_name] = {
                            'name': item_name,
                            'id': None,
                            'groups': ['Event'],
                            'advancement': location.item.classification == ItemClassification.progression,
                            'useful': location.item.classification == ItemClassification.useful,
                            'trap': location.item.classification == ItemClassification.trap,
                            'event': True,
                            'type': 'Event',
                            'max_count': 1
                        }
        
        return item_data