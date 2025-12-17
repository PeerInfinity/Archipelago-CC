"""Kingdom Hearts 1 specific helper expander."""

from typing import Dict, Any, List, Set
from .base import BaseGameExportHandler
import re
import logging

logger = logging.getLogger(__name__)

class KH1GameExportHandler(BaseGameExportHandler):
    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = False

    # Module paths containing helper functions
    HELPER_MODULES: List[str] = ['worlds.kh1.Rules']

    # Note: Simple helpers (has_all_magic_lvx, has_x_worlds, etc.) are auto-discovered
    # during rule analysis and no longer need to be whitelisted explicitly.

    # Helpers that should be preserved as helper calls (not inlined)
    # Complex helpers with for loops, assignments, etc. need localScope
    # which is only created when called as a helper, not when inlined
    HELPERS_TO_PRESERVE: Set[str] = {
        'has_x_worlds',         # Has for loop and variable assignments
    }

    # Helpers that are too complex to export (have loops/complex logic)
    # These require JavaScript implementations
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = {
        'has_x_worlds',         # Has for loops, variable assignments - JS implementation in kh1Logic.js
        'has_emblems',          # Calls has_x_worlds which has loops
        'has_defensive_tools',  # Called without args but definition needs logic_difficulty param
        'has_puppies',          # Has loops over puppy items
        'has_reports',          # Has loops over report items
        'has_torn_pages',       # Has loops over torn pages
        'has_lucky_emblems',    # Simple but rarely used
        'has_final_rest_door',  # Complex with multiple branches
        'has_parasite_cage',    # Complex with nested calls
        'has_key_item',         # Complex with multiple parameters
    }

    """KH1-specific expander that handles Kingdom Hearts 1 rules."""

    def __init__(self, world=None):
        """Initialize with optional world reference."""
        super().__init__(world=world)
        self.options_cache = {}
    
    def preprocess_world_data(self, world, export_data: Dict[str, Any], player: int) -> None:
        """Populate options cache before region processing."""
        if hasattr(world, 'options'):
            self.options_cache = {}
            options = world.options

            # Extract all KH1-specific options
            kh1_option_names = [
                'goal', 'end_of_the_world_unlock', 'final_rest_door',
                'required_reports_eotw', 'required_reports_door', 'reports_in_pool',
                'super_bosses', 'atlantica', 'hundred_acre_wood', 'cups',
                'puppies', 'starting_worlds', 'keyblades_unlock_chests',
                'interact_in_battle', 'exp_multiplier', 'advanced_logic',
                'extra_shared_abilities', 'exp_zero_in_pool', 'vanilla_emblem_pieces',
                'donald_death_link', 'goofy_death_link', 'randomize_keyblade_stats',
                'bad_starting_weapons', 'keyblade_min_str', 'keyblade_max_str',
                'keyblade_min_mp', 'keyblade_max_mp', 'level_checks',
                'force_stats_on_levels', 'strength_increase', 'defense_increase',
                'hp_increase', 'ap_increase', 'mp_increase',
                'accessory_slot_increase', 'item_slot_increase'
            ]

            for option_name in kh1_option_names:
                if hasattr(options, option_name):
                    option_obj = getattr(options, option_name)
                    # Get the value attribute if it exists, otherwise use the object itself
                    value = getattr(option_obj, 'value', option_obj)
                    # Cache for options resolution
                    self.options_cache[option_name] = value
                    logger.debug(f"Cached KH1 option: {option_name} = {value}")

    def expand_helper(self, helper_name: str, args=None):
        """Expand KH1-specific helper functions."""
        # Map of KH1 helper functions to their simplified rules
        helper_map = {
            # Add specific KH1 helpers as we discover them
        }

        if helper_name in helper_map:
            return helper_map[helper_name]

        # For now, preserve helper nodes as-is until we identify specific helpers
        return None
        
    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand rule functions for KH1."""
        if not rule:
            return rule

        # First, resolve any options references
        rule = self._resolve_options_in_rule(rule)

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
            # Resolve options in args first
            if 'args' in rule and rule['args']:
                rule['args'] = [self._resolve_options_in_rule(arg) for arg in rule['args']]
            expanded = self.expand_helper(rule.get('name'), rule.get('args'))
            if expanded:
                return self.expand_rule(expanded, _depth + 1)  # Recursively expand
            return rule

        # Handle and/or conditions recursively
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', [])]

        # Handle not condition
        if rule.get('type') == 'not':
            rule['condition'] = self.expand_rule(rule.get('condition'), _depth + 1)

        return rule
    
    def _analyze_original_rule(self, original_rule):
        """
        Attempt to analyze the original rule structure before it became __analyzed_func__.
        """
        # Look for state method calls in the original rule
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
            'description': 'Game-specific rule',
            'details': 'This rule could not be fully analyzed due to game-specific implementation'
        }
    
    def _infer_rule_type(self, rule):
        """
        Attempt to infer rule type based on context clues.
        """
        args = rule.get('args', [])
        
        # Look for keywords in rule name or source code if available
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
        
        # Return a more descriptive generic rule
        return {
            'type': 'generic_rule',
            'description': 'Game-specific rule',
            'details': 'This rule could not be fully analyzed but may involve item requirements'
        }
    
    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """
        Return KH1-specific item data with classification flags.
        """
        from BaseClasses import ItemClassification
        import collections

        item_data = {}

        # Calculate item counts from the pool to determine max_count
        # This is important for items like World items that can appear multiple times
        item_counts = collections.defaultdict(int)
        if hasattr(world, 'multiworld'):
            # Count items in the item pool
            for item in world.multiworld.itempool:
                if item.player == world.player:
                    item_counts[item.name] += 1
            # Also count items placed in locations
            for location in world.multiworld.get_locations():
                if location.item and location.item.player == world.player:
                    item_counts[location.item.name] += 1
            # Count precollected items
            for item in world.multiworld.precollected_items.get(world.player, []):
                item_counts[item.name] += 1

        # Get items from world.item_name_to_id if available
        if hasattr(world, 'item_name_to_id'):
            for item_name, item_id in world.item_name_to_id.items():
                # Try to get classification from item class
                is_advancement = False
                is_useful = False
                is_trap = False
                
                try:
                    # Try to get classification from item pool
                    if hasattr(world, 'multiworld'):
                        for item in world.multiworld.itempool:
                            if item.player == world.player and item.name == item_name:
                                is_advancement = item.classification == ItemClassification.progression
                                is_useful = item.classification == ItemClassification.useful
                                is_trap = item.classification == ItemClassification.trap
                                break
                        
                        # Additional check: scan placed items in locations
                        if not (is_advancement or is_useful or is_trap):
                            for location in world.multiworld.get_locations(world.player):
                                if (location.item and location.item.player == world.player and 
                                    location.item.name == item_name and location.item.code is not None):
                                    is_advancement = location.item.classification == ItemClassification.progression
                                    is_useful = location.item.classification == ItemClassification.useful
                                    is_trap = location.item.classification == ItemClassification.trap
                                    break
                except Exception as e:
                    logger.debug(f"Could not determine classification for {item_name}: {e}")
                
                # Get groups if available
                groups = []
                if hasattr(world, 'item_name_groups'):
                    groups = [
                        group_name for group_name, items in world.item_name_groups.items()
                        if item_name in items
                    ]
                
                # Use the item count from pool as max_count, defaulting to 1 if not found
                max_count = item_counts.get(item_name, 1)
                # Ensure max_count is at least 1
                max_count = max(max_count, 1)

                item_data[item_name] = {
                    'name': item_name,
                    'id': item_id,
                    'groups': sorted(groups),
                    'advancement': is_advancement,
                    'useful': is_useful,
                    'trap': is_trap,
                    'event': False,  # Regular items are not events
                    'type': None,
                    'max_count': max_count
                }
        
        # Handle dynamically created event items by scanning locations
        if hasattr(world, 'multiworld'):
            for location in world.multiworld.get_locations(world.player):
                if location.item and location.item.player == world.player:
                    item_name = location.item.name
                    # Check if this is an event item (no code/ID) that we haven't seen
                    if (location.item.code is None and 
                        item_name not in item_data and
                        hasattr(location.item, 'classification')):
                        
                        # Event items typically have max_count of 1, but use pool count if available
                        event_max_count = item_counts.get(item_name, 1)
                        event_max_count = max(event_max_count, 1)

                        item_data[item_name] = {
                            'name': item_name,
                            'id': None,
                            'groups': ['Event'],
                            'advancement': location.item.classification == ItemClassification.progression,
                            'useful': location.item.classification == ItemClassification.useful,
                            'trap': location.item.classification == ItemClassification.trap,
                            'event': True,
                            'type': 'Event',
                            'max_count': event_max_count
                        }

        return item_data

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extracts KH1-specific game settings for export."""
        # Get base settings
        settings_dict = super().get_settings_data(world, multiworld, player)

        settings_dict['use_resolved_items'] = True

        # Add cached KH1 options to settings
        # (options were already cached in preprocess_world_data)
        for option_name, value in self.options_cache.items():
            settings_dict[option_name] = value
            logger.debug(f"Exported KH1 option: {option_name} = {value}")

        return settings_dict

    def _resolve_options_in_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursively resolve options.* attribute references to their constant values.

        This method finds patterns like:
        {
          "type": "attribute",
          "object": {"type": "name", "name": "options"},
          "attr": "keyblades_unlock_chests"
        }

        And replaces them with:
        {
          "type": "constant",
          "value": False  # or whatever the actual option value is
        }
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Check if this is an options attribute access
        if rule.get('type') == 'attribute':
            obj = rule.get('object', {})
            if isinstance(obj, dict) and obj.get('type') == 'name' and obj.get('name') == 'options':
                attr_name = rule.get('attr')
                if attr_name and attr_name in self.options_cache:
                    value = self.options_cache[attr_name]
                    logger.debug(f"Resolved options.{attr_name} to constant value: {value}")
                    return {'type': 'constant', 'value': value}
                else:
                    logger.warning(f"Could not resolve options.{attr_name} - not in cache")

        # Recursively process nested structures
        if 'conditions' in rule and isinstance(rule['conditions'], list):
            rule['conditions'] = [self._resolve_options_in_rule(cond) for cond in rule['conditions']]

        if 'condition' in rule:
            rule['condition'] = self._resolve_options_in_rule(rule['condition'])

        if 'args' in rule and isinstance(rule['args'], list):
            rule['args'] = [self._resolve_options_in_rule(arg) for arg in rule['args']]

        if 'test' in rule:
            rule['test'] = self._resolve_options_in_rule(rule['test'])

        if 'if_true' in rule:
            rule['if_true'] = self._resolve_options_in_rule(rule['if_true'])

        if 'if_false' in rule:
            rule['if_false'] = self._resolve_options_in_rule(rule['if_false'])

        if 'left' in rule:
            rule['left'] = self._resolve_options_in_rule(rule['left'])

        if 'right' in rule:
            rule['right'] = self._resolve_options_in_rule(rule['right'])

        if 'object' in rule:
            rule['object'] = self._resolve_options_in_rule(rule['object'])

        return rule

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post-process the exported data to fix KH1-specific issues.

        NOTE: The analyzer now handles most KH1 issues:
        - has_x_worlds is preserved as a helper (has_dynamic_for_loops detects state.has() in loop)
        - Parameter substitution now works (rule dicts passed as arguments are substituted)

        TEMPORARILY DISABLED to verify parameter substitution fix works.
        """
        # Parameter substitution fix should now handle has_parasite_cage correctly
        return data

    def _fix_world_map_exit_rule(self, rule: Dict[str, Any], exit_name: str) -> Dict[str, Any]:
        """
        Fix World Map exit access rules that contain broken has_x_worlds conditionals.

        The Python rule for most world exits is:
        state.has("WorldName", player) and has_x_worlds(state, player, N, ...)

        The analyzer produces:
        {
            "type": "and",
            "conditions": [
                {broken_has_x_worlds_conditional},
                {"type": "item_check", "item": "WorldName"}
            ]
        }

        For End of the World, the rule is more complex with lucky emblems:
        {
            "type": "and",
            "conditions": [
                {broken_has_x_worlds_conditional},
                {"type": "or", "conditions": [lucky_emblem_check, item_check]}
            ]
        }

        We replace the broken conditional with a proper helper call.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Check if this is the expected pattern
        if rule.get('type') == 'and' and 'conditions' in rule:
            conditions = rule['conditions']
            if len(conditions) == 2:
                first, second = conditions
                # Check if first condition is the broken conditional
                if self._is_broken_has_x_worlds_conditional(first):
                    # Case 1: second is a direct item_check for the world
                    if second.get('type') == 'item_check' and second.get('item') == exit_name:
                        num_of_worlds = self._get_world_map_exit_num_worlds(exit_name)
                        logger.info(f"Fixing World Map exit to {exit_name} -> has_x_worlds({num_of_worlds}) AND item_check")
                        return {
                            'type': 'and',
                            'conditions': [
                                {
                                    'type': 'helper',
                                    'name': 'has_x_worlds',
                                    'args': [
                                        {'type': 'constant', 'value': num_of_worlds},
                                        {'type': 'constant', 'value': self.options_cache.get('keyblades_unlock_chests', False)},
                                        {'type': 'constant', 'value': self.options_cache.get('logic_difficulty', 5)},
                                        {'type': 'constant', 'value': self.options_cache.get('hundred_acre_wood', 0)}
                                    ]
                                },
                                second  # Keep the item_check
                            ]
                        }

                    # Case 2: second is an 'or' containing the item_check (e.g., End of the World with lucky emblems)
                    if second.get('type') == 'or' and 'conditions' in second:
                        or_conditions = second['conditions']
                        # Check if any of the or conditions is an item_check for the exit
                        has_item_check = any(
                            isinstance(c, dict) and c.get('type') == 'item_check' and c.get('item') == exit_name
                            for c in or_conditions
                        )
                        if has_item_check:
                            num_of_worlds = self._get_world_map_exit_num_worlds(exit_name)
                            logger.info(f"Fixing World Map exit to {exit_name} -> has_x_worlds({num_of_worlds}) AND (or conditions)")
                            return {
                                'type': 'and',
                                'conditions': [
                                    {
                                        'type': 'helper',
                                        'name': 'has_x_worlds',
                                        'args': [
                                            {'type': 'constant', 'value': num_of_worlds},
                                            {'type': 'constant', 'value': self.options_cache.get('keyblades_unlock_chests', False)},
                                            {'type': 'constant', 'value': self.options_cache.get('logic_difficulty', 5)},
                                            {'type': 'constant', 'value': self.options_cache.get('hundred_acre_wood', 0)}
                                        ]
                                    },
                                    second  # Keep the 'or' conditions as-is
                                ]
                            }

        return rule

    def _is_broken_has_x_worlds_conditional(self, rule: Dict[str, Any]) -> bool:
        """
        Detect the broken has_x_worlds conditional pattern.

        Pattern 1 (full conditional):
        {
            "type": "conditional",
            "test": {"type": "compare", "left": {"type": "constant", "value": X}, "op": ">=", "right": {"type": "constant", "value": 15}},
            "if_true": {"type": "constant", "value": true},
            "if_false": {"type": "constant", "value": 0.0}
        }

        Pattern 2 (simplified to constant 0.0):
        {"type": "constant", "value": 0.0}

        Where X is the difficulty value (typically 5) and 15 is LOGIC_MINIMAL.
        """
        if not isinstance(rule, dict):
            return False

        # Pattern 2: Simplified to just constant 0.0
        # This happens when the analyzer simplifies the broken conditional to just its falsy result
        if rule.get('type') == 'constant' and rule.get('value') == 0.0:
            return True

        # Pattern 1: Full conditional structure
        if rule.get('type') != 'conditional':
            return False

        test = rule.get('test', {})
        if_true = rule.get('if_true', {})
        if_false = rule.get('if_false', {})

        # Check the structure
        if test.get('type') != 'compare':
            return False
        if test.get('op') != '>=':
            return False

        # Check left side is a constant (difficulty value)
        left = test.get('left', {})
        if left.get('type') != 'constant':
            return False

        # Check right side is constant 15 (LOGIC_MINIMAL)
        right = test.get('right', {})
        if right.get('type') != 'constant' or right.get('value') != 15:
            return False

        # Check if_true is constant True
        if if_true.get('type') != 'constant' or if_true.get('value') is not True:
            return False

        # Check if_false is constant 0.0 (the broken part)
        if if_false.get('type') != 'constant' or if_false.get('value') != 0.0:
            return False

        return True

    def _fix_has_all_counts_rule(self, rule: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """
        Recursively fix has_all_counts state_method calls in rules.

        When we find a state_method with has_all_counts and empty args,
        we convert it to a helper call to has_all_magic_lvx with the
        appropriate level extracted from the location name.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # First, recursively process nested structures to fix all has_all_counts
        if 'conditions' in rule and isinstance(rule['conditions'], list):
            rule['conditions'] = [self._fix_has_all_counts_rule(cond, location_name) for cond in rule['conditions']]

        if 'condition' in rule:
            rule['condition'] = self._fix_has_all_counts_rule(rule['condition'], location_name)

        if 'test' in rule:
            rule['test'] = self._fix_has_all_counts_rule(rule['test'], location_name)

        if 'if_true' in rule:
            rule['if_true'] = self._fix_has_all_counts_rule(rule['if_true'], location_name)

        if 'if_false' in rule:
            rule['if_false'] = self._fix_has_all_counts_rule(rule['if_false'], location_name)

        if 'left' in rule:
            rule['left'] = self._fix_has_all_counts_rule(rule['left'], location_name)

        if 'right' in rule:
            rule['right'] = self._fix_has_all_counts_rule(rule['right'], location_name)

        # Now check for patterns AFTER nested fixes

        # Check if this is a has_all_counts state_method with empty or missing args
        if (rule.get('type') == 'state_method' and
            rule.get('method') == 'has_all_counts' and
            not rule.get('args')):

            # Skip conversion for Wonderland locations that use non-magic has_all_counts
            # These locations have: difficulty > LOGIC_PROUD and has_all_counts({"Combo Master": 1, "High Jump": 3, "Air Combo Plus": 2})
            # Since default difficulty is LOGIC_NORMAL (5) and LOGIC_PROUD is 10, this branch should be unreachable
            # We should NOT convert this to has_all_magic_lvx
            if self._is_wonderland_advanced_logic_location(location_name):
                logger.info(f"Skipping has_all_counts conversion for Wonderland advanced logic location: {location_name}")
                # Return constant false since this branch is guarded by difficulty > LOGIC_PROUD which is false
                return {'type': 'constant', 'value': False}

            # Extract level from location name
            # Level 3 locations
            if 'LV3 Magic' in location_name or 'All LV3 Magic' in location_name:
                level = 3
            # Level 2 locations - specific Neverland locations and superboss-related checks
            elif ('Clock Tower' in location_name or
                  'Phantom' in location_name or
                  ('Final Rest' in location_name and 'superboss' in location_name.lower())):
                level = 2
            # Level 2 magic explicitly
            elif 'LV2 Magic' in location_name or 'All LV2 Magic' in location_name:
                level = 2
            # Default to level 1 for all other cases
            # This includes "Obtained All Arts Items" and similar locations
            else:
                level = 1

            logger.info(f"Fixing has_all_counts rule for {location_name} -> has_all_magic_lvx({level})")
            return {
                'type': 'helper',
                'name': 'has_all_magic_lvx',
                'args': [{'type': 'constant', 'value': level}]
            }

        # Check for has_defensive_tools pattern:
        # An 'and' condition containing has_all_counts (for defensive tools) and has_any_count
        # This occurs when has_defensive_tools is inlined
        if rule.get('type') == 'and' and 'conditions' in rule:
            conditions = rule['conditions']

            def _is_defensive_tools_has_all_counts(node):
                """Check if this is the has_all_counts for defensive tools."""
                if not isinstance(node, dict):
                    return False
                if node.get('type') != 'state_method' or node.get('method') != 'has_all_counts':
                    return False
                args = node.get('args', [])
                if not args:
                    return False
                # Check if args contain the defensive tools items
                first_arg = args[0] if args else {}
                if isinstance(first_arg, dict) and first_arg.get('type') == 'constant':
                    value = first_arg.get('value', {})
                    if isinstance(value, dict):
                        # Defensive tools require: Progressive Cure, Leaf Bracer, Dodge Roll
                        return 'Progressive Cure' in value or 'Leaf Bracer' in value or 'Dodge Roll' in value
                return False

            has_defensive_all_counts = any(_is_defensive_tools_has_all_counts(c) for c in conditions)
            has_any_count = any(
                isinstance(c, dict) and c.get('type') == 'state_method' and c.get('method') == 'has_any_count'
                for c in conditions
            )

            if has_defensive_all_counts and has_any_count:
                # This is the has_defensive_tools pattern - replace the entire 'and' with a helper call
                logger.info(f"Detected has_defensive_tools pattern in {location_name}, converting to helper call")
                return {
                    'type': 'helper',
                    'name': 'has_defensive_tools',
                    'args': []
                }

            # Also check for has_defensive_tools with resolved args pattern:
            # has_all_counts with {"Progressive Cure": 2, "Leaf Bracer": 1, "Dodge Roll": 1}
            # has_any_count with {"Second Chance": 1, "MP Rage": 1, "Progressive Aero": 2}
            has_all_counts_defensive = any(
                isinstance(c, dict) and c.get('type') == 'state_method' and
                c.get('method') == 'has_all_counts' and
                self._is_defensive_tools_has_all_counts(c.get('args', []))
                for c in conditions
            )
            has_any_count_defensive = any(
                isinstance(c, dict) and c.get('type') == 'state_method' and
                c.get('method') == 'has_any_count' and
                self._is_defensive_tools_has_any_count(c.get('args', []))
                for c in conditions
            )

            if has_all_counts_defensive and has_any_count_defensive:
                # This is the has_defensive_tools pattern with resolved args
                logger.info(f"Detected has_defensive_tools pattern (resolved args) in {location_name}, converting to helper call")
                return {
                    'type': 'helper',
                    'name': 'has_defensive_tools',
                    'args': []
                }

            # Check for has_parasite_cage pattern:
            # AND with:
            #   - constant 0.0 (broken worlds parameter from has_x_worlds)
            #   - OR with High Jump / Progressive Glide
            #   - item_check for Monstro
            # This is the pattern for locations that require has_parasite_cage
            has_constant_zero = any(
                isinstance(c, dict) and c.get('type') == 'constant' and c.get('value') == 0.0
                for c in conditions
            )
            has_monstro_check = any(
                isinstance(c, dict) and c.get('type') == 'item_check' and c.get('item') == 'Monstro'
                for c in conditions
            )
            has_glide_highjump_or = any(
                isinstance(c, dict) and c.get('type') == 'or' and 'conditions' in c
                for c in conditions
            )

            if has_constant_zero and has_monstro_check and has_glide_highjump_or:
                # This is the has_parasite_cage pattern - replace constant 0.0 with has_x_worlds(3)
                logger.info(f"Detected has_parasite_cage pattern in {location_name}, fixing worlds parameter")
                new_conditions = []
                for c in conditions:
                    if isinstance(c, dict) and c.get('type') == 'constant' and c.get('value') == 0.0:
                        # Replace with has_x_worlds(3)
                        new_conditions.append({
                            'type': 'helper',
                            'name': 'has_x_worlds',
                            'args': [
                                {'type': 'constant', 'value': 3},
                                {'type': 'constant', 'value': self.options_cache.get('keyblades_unlock_chests', False)},
                                {'type': 'constant', 'value': self.options_cache.get('logic_difficulty', 5)},
                                {'type': 'constant', 'value': self.options_cache.get('hundred_acre_wood', 0)}
                            ]
                        })
                    else:
                        new_conditions.append(c)
                return {
                    'type': 'and',
                    'conditions': new_conditions
                }

            # Check for has_emblems pattern:
            # AND with:
            #   - Inner AND with constant 0.0 and has_all for emblem pieces
            #   - constant 0.0 (broken has_x_worlds)
            #   - item_check for Hollow Bastion
            has_hollow_bastion_check = any(
                isinstance(c, dict) and c.get('type') == 'item_check' and c.get('item') == 'Hollow Bastion'
                for c in conditions
            )

            def _has_emblem_piece_in_args(args):
                """Check if args contain Emblem Piece strings."""
                if not args:
                    return False
                for arg in args:
                    if isinstance(arg, dict):
                        value = arg.get('value', [])
                        if isinstance(value, list):
                            for item in value:
                                if isinstance(item, str) and 'Emblem Piece' in item:
                                    return True
                    elif isinstance(arg, str) and 'Emblem Piece' in arg:
                        return True
                return False

            has_inner_and_with_emblems = any(
                isinstance(c, dict) and c.get('type') == 'and' and 'conditions' in c and
                any(
                    isinstance(sc, dict) and sc.get('type') == 'state_method' and
                    sc.get('method') == 'has_all' and
                    _has_emblem_piece_in_args(sc.get('args', []))
                    for sc in c.get('conditions', [])
                )
                for c in conditions
            )

            if has_constant_zero and has_hollow_bastion_check and has_inner_and_with_emblems:
                # This is the has_emblems pattern - replace entire AND with has_emblems helper
                logger.info(f"Detected has_emblems pattern in {location_name}, converting to helper call")
                return {
                    'type': 'helper',
                    'name': 'has_emblems',
                    'args': [
                        {'type': 'constant', 'value': self.options_cache.get('keyblades_unlock_chests', False)}
                    ]
                }

            # Check for simpler has_emblems pattern (no separate item_check):
            # AND with just constant 0.0 and has_all for emblem pieces + Hollow Bastion
            has_direct_emblems_has_all = any(
                isinstance(c, dict) and c.get('type') == 'state_method' and
                c.get('method') == 'has_all' and
                _has_emblem_piece_in_args(c.get('args', []))
                for c in conditions
            )

            if has_constant_zero and has_direct_emblems_has_all and len(conditions) == 2:
                # This is the simpler has_emblems pattern
                logger.info(f"Detected direct has_emblems pattern in {location_name}, converting to helper call")
                return {
                    'type': 'helper',
                    'name': 'has_emblems',
                    'args': [
                        {'type': 'constant', 'value': self.options_cache.get('keyblades_unlock_chests', False)}
                    ]
                }

            # Check for has_emblems with redundant checks pattern:
            # AND with has_emblems helper + constant 0.0 + item_check for Hollow Bastion
            # This happens when the Python has: has_emblems(...) AND state.has("HB") AND has_x_worlds(6)
            # The has_x_worlds(6) becomes constant 0.0, but has_emblems already includes these
            has_emblems_helper = any(
                isinstance(c, dict) and c.get('type') == 'helper' and c.get('name') == 'has_emblems'
                for c in conditions
            )

            if has_emblems_helper and has_constant_zero and has_hollow_bastion_check:
                # has_emblems already includes has_x_worlds(6) and Hollow Bastion check
                # So we can simplify the entire AND to just has_emblems
                logger.info(f"Simplifying redundant has_emblems pattern in {location_name}")
                for c in conditions:
                    if isinstance(c, dict) and c.get('type') == 'helper' and c.get('name') == 'has_emblems':
                        return c

            # Check for Final Ansem pattern:
            # AND with has_defensive_tools helper + constant 0.0 (broken has_x_worlds(8)) + complex OR
            has_defensive_tools_helper = any(
                isinstance(c, dict) and c.get('type') == 'helper' and c.get('name') == 'has_defensive_tools'
                for c in conditions
            )
            has_or_condition = any(
                isinstance(c, dict) and c.get('type') == 'or'
                for c in conditions
            )

            if has_defensive_tools_helper and has_constant_zero and has_or_condition:
                # This is the Final Ansem pattern - fix the constant 0.0 to has_x_worlds(8)
                logger.info(f"Detected Final Ansem pattern in {location_name}, fixing has_x_worlds(8)")
                new_conditions = []
                for c in conditions:
                    if isinstance(c, dict) and c.get('type') == 'constant' and c.get('value') == 0.0:
                        # Replace with has_x_worlds(8)
                        new_conditions.append({
                            'type': 'helper',
                            'name': 'has_x_worlds',
                            'args': [
                                {'type': 'constant', 'value': 8},
                                {'type': 'constant', 'value': self.options_cache.get('keyblades_unlock_chests', False)},
                                {'type': 'constant', 'value': self.options_cache.get('logic_difficulty', 5)},
                                {'type': 'constant', 'value': self.options_cache.get('hundred_acre_wood', 0)}
                            ]
                        })
                    else:
                        new_conditions.append(c)
                return {
                    'type': 'and',
                    'conditions': new_conditions
                }

            # Check for has_all_magic_lvx + constant 0.0 pattern:
            # AND with has_all_magic_lvx (helper or state_method has_all_counts for magic) + constant 0.0 (broken has_x_worlds(8))
            # This happens with "Obtained All Arts Items" and similar locations
            def _is_magic_has_all_counts(node):
                """Check if this is a has_all_counts for magic items (has_all_magic_lvx pattern)."""
                if not isinstance(node, dict):
                    return False
                if node.get('type') != 'state_method' or node.get('method') != 'has_all_counts':
                    return False
                args = node.get('args', [])
                if not args:
                    return False
                first_arg = args[0] if args else {}
                if isinstance(first_arg, dict) and first_arg.get('type') == 'constant':
                    value = first_arg.get('value', {})
                    if isinstance(value, dict):
                        # Magic items pattern: Progressive Fire, Progressive Blizzard, etc.
                        return 'Progressive Fire' in value or 'Progressive Blizzard' in value or 'Progressive Thunder' in value
                return False

            has_all_magic_lvx_helper = any(
                isinstance(c, dict) and c.get('type') == 'helper' and c.get('name') == 'has_all_magic_lvx'
                for c in conditions
            )
            has_magic_has_all_counts = any(_is_magic_has_all_counts(c) for c in conditions)

            # Also check for has_all_counts with resolved magic args (represents has_all_magic_lvx)
            has_all_counts_magic = any(
                isinstance(c, dict) and c.get('type') == 'state_method' and
                c.get('method') == 'has_all_counts' and
                self._is_magic_level_has_all_counts(c.get('args', []))
                for c in conditions
            )

            if (has_all_magic_lvx_helper or has_all_counts_magic) and has_constant_zero:
                # This is a has_all_magic_lvx + has_x_worlds pattern - fix the constant 0.0
                # Infer the num_of_worlds from location name
                num_worlds = self._infer_num_of_worlds_general(location_name)
                logger.info(f"Detected has_all_magic_lvx pattern with broken has_x_worlds in {location_name}, fixing -> has_x_worlds({num_worlds})")
                new_conditions = []
                for c in conditions:
                    if isinstance(c, dict) and c.get('type') == 'constant' and c.get('value') == 0.0:
                        # Replace with has_x_worlds
                        new_conditions.append({
                            'type': 'helper',
                            'name': 'has_x_worlds',
                            'args': [
                                {'type': 'constant', 'value': num_worlds},
                                {'type': 'constant', 'value': self.options_cache.get('keyblades_unlock_chests', False)},
                                {'type': 'constant', 'value': self.options_cache.get('logic_difficulty', 5)},
                                {'type': 'constant', 'value': self.options_cache.get('hundred_acre_wood', 0)}
                            ]
                        })
                    else:
                        new_conditions.append(c)
                return {
                    'type': 'and',
                    'conditions': new_conditions
                }

        # Check for broken has_x_worlds OR pattern:
        # OR with all falsy conditions (constant 0.0 or false)
        # This happens when has_x_worlds or difficulty checks weren't properly analyzed
        if rule.get('type') == 'or' and 'conditions' in rule:
            conditions = rule['conditions']
            all_falsy = all(
                isinstance(c, dict) and (
                    (c.get('type') == 'constant' and c.get('value') in [0.0, False, 0]) or
                    (c.get('type') == 'and' and all(
                        isinstance(sc, dict) and sc.get('type') == 'constant' and sc.get('value') in [0.0, False, 0]
                        for sc in c.get('conditions', [])
                    ))
                )
                for c in conditions
            )

            if all_falsy:
                # Check if this location is known to require has_x_worlds
                num_of_worlds = self._get_has_x_worlds_requirement(location_name)
                if num_of_worlds is not None:
                    logger.info(f"Fixing broken has_x_worlds OR in {location_name} -> has_x_worlds({num_of_worlds})")
                    return {
                        'type': 'helper',
                        'name': 'has_x_worlds',
                        'args': [
                            {'type': 'constant', 'value': num_of_worlds},
                            {'type': 'constant', 'value': self.options_cache.get('keyblades_unlock_chests', False)},
                            {'type': 'constant', 'value': self.options_cache.get('logic_difficulty', 5)},
                            {'type': 'constant', 'value': self.options_cache.get('hundred_acre_wood', 0)}
                        ]
                    }

        # Fix "name" type references to functions like has_basic_tools
        # In Python, function references used without calling them are truthy,
        # so "or has_basic_tools" (without parentheses) is effectively "or True"
        # This is a bug in the upstream Python code but we need to match its behavior
        if rule.get('type') == 'name':
            func_name = rule.get('name')
            # List of known function names that are mistakenly used without calling them
            truthy_function_names = [
                'has_basic_tools',  # Used in Oogie's Manor rules without calling it
            ]
            if func_name in truthy_function_names:
                logger.info(f"Converting function reference '{func_name}' to constant True (function refs are truthy in Python)")
                return {'type': 'constant', 'value': True}

            # Fix "worlds" parameter reference in has_parasite_cage
            # The analyzer couldn't inline has_x_worlds call, so it outputs the parameter name
            # has_parasite_cage is always called with has_x_worlds(state, player, 3, ...) for the worlds param
            if func_name == 'worlds':
                logger.info(f"Converting 'worlds' parameter reference to has_x_worlds(3) for {location_name}")
                return {
                    'type': 'helper',
                    'name': 'has_x_worlds',
                    'args': [
                        {'type': 'constant', 'value': 3},
                        {'type': 'constant', 'value': self.options_cache.get('keyblades_unlock_chests', False)},
                        {'type': 'constant', 'value': self.options_cache.get('logic_difficulty', 5)},
                        {'type': 'constant', 'value': self.options_cache.get('hundred_acre_wood', 0)}
                    ]
                }

        # Note: The catch-all for _is_broken_has_x_worlds_conditional was removed because
        # it was too broad. It was matching {"type": "constant", "value": 0.0} which also
        # appears when "difficulty > LOGIC_NORMAL" evaluates to False.
        # World Map exits and Level locations have their own specific handlers.

        return rule

    def _infer_num_of_worlds_general(self, location_name: str) -> int:
        """
        Infer the num_of_worlds for a general location.

        This is used for locations that aren't World Map exits or Level locations.
        Based on the Python code, most locations use 3 or 6 worlds.
        """
        # Locations that require 8 worlds
        if any(keyword in location_name for keyword in [
            'Final Ansem', 'All Arts Items'
        ]):
            return 8
        # Locations that typically require 6 worlds
        if any(keyword in location_name for keyword in [
            'Hollow Bastion', 'End of the World', 'Defeat Heartless 3',
            'Secret Waterway Navi', 'Kairi Secret Waterway Oathkeeper'
        ]):
            return 6
        # Default to 3 for most other locations
        return 3

    def _get_has_x_worlds_requirement(self, location_name: str) -> int:
        """
        Get the has_x_worlds requirement for a location if known.

        Returns None if the location doesn't have a known has_x_worlds requirement,
        or the number of worlds required if it does.
        """
        # Locations that specifically require has_x_worlds(6)
        # From worlds/kh1/Rules.py
        if 'Defeat Heartless 3' in location_name:
            return 6

        # Locations that require has_x_worlds(3)
        # These are typically locations that use has_parasite_cage or similar
        # Already handled by has_parasite_cage pattern detection

        return None

    def _is_world_map_exit(self, location_name: str) -> bool:
        """Check if this is a World Map exit to a world region."""
        # World Map exit names are just the world names
        world_names = [
            'Wonderland', 'Olympus Coliseum', 'Deep Jungle', 'Agrabah',
            'Monstro', 'Atlantica', 'Halloween Town', 'Neverland',
            'Hollow Bastion', 'End of the World', 'Destiny Islands'
        ]
        return location_name in world_names

    def _get_world_map_exit_num_worlds(self, exit_name: str) -> int:
        """Get the num_of_worlds requirement for a World Map exit."""
        # Based on worlds/kh1/Rules.py lines 1766-1786
        if exit_name == 'Neverland':
            return 4
        elif exit_name == 'Hollow Bastion':
            return 6
        elif exit_name == 'End of the World':
            return 8
        else:
            return 3  # Default for most worlds

    def _is_level_location(self, location_name: str) -> bool:
        """Check if this is a Level-up location."""
        import re
        return bool(re.match(r'^Level \d{3} \(Slot [12]\)$', location_name))

    def _get_level_num_worlds(self, location_name: str) -> int:
        """
        Get the num_of_worlds requirement for a Level location.

        Based on worlds/kh1/Rules.py lines 1694-1703:
        min(((level_num//10)*2), 8)

        For Level 002-009: level_num is 1-8, (//10)*2 = 0
        For Level 010-019: level_num is 9-18, (//10)*2 = 0 or 2
        etc.
        """
        import re
        match = re.match(r'^Level (\d{3})', location_name)
        if match:
            level_display = int(match.group(1))  # e.g., "002" -> 2
            level_num = level_display - 1  # The Python code uses level_num = i, where display is i+1
            num_worlds = min((level_num // 10) * 2, 8)
            return num_worlds
        return 0

    def _fix_level_location_rule(self, rule: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """
        Fix Level location access rules that contain broken has_x_worlds conditionals.

        The Python rule for Level locations is:
        has_x_worlds(state, player, min(((level_num//10)*2), 8), ...)

        For early levels (2-9), this requires 0 worlds - always True.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Check if this is the broken conditional pattern
        if self._is_broken_has_x_worlds_conditional(rule):
            num_of_worlds = self._get_level_num_worlds(location_name)
            logger.info(f"Fixing Level location {location_name} -> has_x_worlds({num_of_worlds})")
            return {
                'type': 'helper',
                'name': 'has_x_worlds',
                'args': [
                    {'type': 'constant', 'value': num_of_worlds},
                    {'type': 'constant', 'value': self.options_cache.get('keyblades_unlock_chests', False)},
                    {'type': 'constant', 'value': self.options_cache.get('logic_difficulty', 5)},
                    {'type': 'constant', 'value': self.options_cache.get('hundred_acre_wood', 0)}
                ]
            }

        return rule

    def _needs_additional_check(self, location_name: str) -> bool:
        """
        Check if a location needs an additional check that the analyzer may have dropped.
        """
        # Locations that require has_all_summons
        if "Geppetto All Summons" in location_name:
            return True
        # Locations that require has_all_arts
        if "Obtained All Arts Items" in location_name:
            return True
        return False

    def _add_missing_check(self, rule: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """
        Add missing checks that the analyzer dropped for specific locations.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Add has_all_summons for Geppetto All Summons Reward
        if "Geppetto All Summons" in location_name:
            logger.info(f"Adding missing has_all_summons check for {location_name}")
            # has_all_summons requires: Simba, Bambi, Genie, Dumbo, Mushu, Tinker Bell
            has_all_summons_check = {
                'type': 'state_method',
                'method': 'has_all',
                'args': [
                    {
                        'type': 'constant',
                        'value': ["Simba", "Bambi", "Genie", "Dumbo", "Mushu", "Tinker Bell"]
                    }
                ]
            }
            return {
                'type': 'and',
                'conditions': [rule, has_all_summons_check]
            }

        # Add has_all_arts for Obtained All Arts Items
        if "Obtained All Arts Items" in location_name:
            logger.info(f"Adding missing has_all_arts check for {location_name}")
            # has_all_arts requires: Fire Arts, Blizzard Arts, Thunder Arts, Cure Arts, Gravity Arts, Stop Arts, Aero Arts
            has_all_arts_check = {
                'type': 'state_method',
                'method': 'has_all',
                'args': [
                    {
                        'type': 'constant',
                        'value': ["Fire Arts", "Blizzard Arts", "Thunder Arts", "Cure Arts", "Gravity Arts", "Stop Arts", "Aero Arts"]
                    }
                ]
            }
            return {
                'type': 'and',
                'conditions': [rule, has_all_arts_check]
            }

        return rule

    def _is_wonderland_advanced_logic_location(self, location_name: str) -> bool:
        """
        Check if this is a Wonderland location that uses non-magic has_all_counts.

        These locations have rules like:
        difficulty > LOGIC_PROUD and state.has_all_counts({"Combo Master": 1, "High Jump": 3, "Air Combo Plus": 2}, player)

        This is NOT for magic items, so we should not convert to has_all_magic_lvx.
        The difficulty check makes this branch unreachable in default settings.
        """
        # List of Wonderland locations that use the advanced logic has_all_counts
        # These are from worlds/kh1/Rules.py - locations using the LOGIC_PROUD difficulty branch
        wonderland_advanced_logic_locations = [
            "Wonderland Lotus Forest Glide Chest",
            "Wonderland Tea Party Garden Above Lotus Forest Entrance 1st Chest",
            "Wonderland Tea Party Garden Above Lotus Forest Entrance 2nd Chest",
            "Wonderland Tea Party Garden Across From Bizarre Room Entrance Chest",
            "Wonderland Tea Party Garden Bear and Clock Puzzle Chest",
            "Wonderland Tea Party Garden Left Cushioned Chair",
            "Wonderland Tea Party Garden Left Gray Chair",
            "Wonderland Tea Party Garden Left Pink Chair",
            "Wonderland Tea Party Garden Right Brown Chair",
            "Wonderland Tea Party Garden Right Yellow Chair",
        ]

        return location_name in wonderland_advanced_logic_locations

    def _is_defensive_tools_has_all_counts(self, args: list) -> bool:
        """
        Check if the args contain the has_defensive_tools has_all_counts pattern:
        {"Progressive Cure": 2, "Leaf Bracer": 1, "Dodge Roll": 1}
        """
        if not args:
            return False
        for arg in args:
            if isinstance(arg, dict) and arg.get('type') == 'constant':
                value = arg.get('value', {})
                if isinstance(value, dict):
                    # Check for the specific keys
                    if ('Progressive Cure' in value and
                        'Leaf Bracer' in value and
                        'Dodge Roll' in value):
                        return True
        return False

    def _is_defensive_tools_has_any_count(self, args: list) -> bool:
        """
        Check if the args contain the has_defensive_tools has_any_count pattern:
        {"Second Chance": 1, "MP Rage": 1, "Progressive Aero": 2}
        """
        if not args:
            return False
        for arg in args:
            if isinstance(arg, dict) and arg.get('type') == 'constant':
                value = arg.get('value', {})
                if isinstance(value, dict):
                    # Check for the specific keys
                    if ('Second Chance' in value and
                        'MP Rage' in value and
                        'Progressive Aero' in value):
                        return True
        return False

    def _is_magic_level_has_all_counts(self, args: list) -> bool:
        """
        Check if the args contain magic level items pattern (has_all_magic_lvx):
        {"Progressive Fire": N, "Progressive Blizzard": N, "Progressive Thunder": N, etc.}
        """
        if not args:
            return False
        for arg in args:
            if isinstance(arg, dict) and arg.get('type') == 'constant':
                value = arg.get('value', {})
                if isinstance(value, dict):
                    # Check for magic level items
                    magic_items = {'Progressive Fire', 'Progressive Blizzard', 'Progressive Thunder',
                                   'Progressive Cure', 'Progressive Gravity', 'Progressive Aero',
                                   'Progressive Stop'}
                    # Should have at least 4 of these to be considered magic level pattern
                    matching = sum(1 for item in magic_items if item in value)
                    if matching >= 4:
                        return True
        return False