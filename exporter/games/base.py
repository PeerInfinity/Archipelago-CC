"""Base class for game-specific helper expanders.

NOTE: New games should generally inherit from GenericGameExportHandler
instead of BaseGameExportHandler directly, unless you need full control
over all export methods. GenericGameExportHandler provides intelligent
defaults for rule analysis, item data discovery, and common helper patterns.

See exporter/games/generic.py for details on the enhanced functionality.
"""

from typing import Dict, Any, List, Set, Optional, Callable
import collections
import enum
import importlib
import inspect
import logging

from exporter.constants import MAX_RULE_EXPANSION_DEPTH, MAX_HELPER_DISCOVERY_ITERATIONS

logger = logging.getLogger(__name__)


class BaseGameExportHandler:
    # Configuration for automatic helper extraction
    # Games should override these class variables

    # List of module paths containing helper functions (e.g., ['worlds.shapez.regions'])
    HELPER_MODULES: List[str] = []

    # Dict mapping world attribute names to callables that compute them
    # Callable signature: (world, multiworld, player) -> value
    # Example: {'difficulty_requirements': lambda w, m, p: {...}}
    # These are exported to the 'world_attributes' section (separate from settings)
    # World attributes are runtime-computed values on the world instance (e.g., world.difficulty_requirements)
    WORLD_ATTRIBUTES: Dict[str, Callable] = {}

    # Legacy alias for WORLD_ATTRIBUTES - deprecated, use WORLD_ATTRIBUTES instead
    # TODO: Remove after migrating game-specific handlers
    COMPUTED_SETTINGS: Dict[str, Callable] = {}

    # List of option names to export at the top level of settings_dict
    # These are simple world.options.<name>.value extractions
    # Example: ['difficulty', 'logic_percent'] exports both as settings_dict['difficulty'], etc.
    EXPORTED_OPTIONS: List[str] = []

    # List of module paths containing item name constants (e.g., ['worlds.shapez.data.strings'])
    # The exporter will look for classes like ITEMS with attributes that map to item names
    ITEM_NAME_MODULES: List[str] = []

    # Whether to automatically export discovered helpers as definitions
    # When False (default), only whitelisted helpers are exported
    # When True, discovered helpers are exported (minus blacklist)
    # Games must explicitly set this to True to enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS: bool = False

    # Set of helper function names to export as definitions (manual whitelist)
    # These helpers are always exported regardless of AUTO_EXPORT_DISCOVERED_HELPERS
    HELPERS_TO_EXPORT_WHITELIST: Set[str] = set()

    # Set of helper function names to NOT export as definitions (blacklist)
    # These helpers are too complex and need JavaScript implementations
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = set()

    # Parameter name mappings for helpers whose parameter names don't match slot_data keys.
    # Maps helper_name -> {param_name: slot_data_key}
    # The frontend uses these mappings to resolve parameter values from slot_data/settings.
    # Example: {'my_helper': {'param1': 'slot_data_key1', 'param2': 'setting_key2'}}
    HELPER_PARAM_MAPPINGS: Dict[str, Dict[str, str]] = {}

    # Settings class attributes that control export behavior
    # These are applied in get_settings_data and can be overridden in subclasses

    # When True, eventProcessor uses resolved_items from sphere log instead of base_items
    # Use for games with complex event items or computed tracking items
    USE_RESOLVED_ITEMS: bool = False

    # When True, add all items from sphere log before comparing accessible locations
    # Required for games that need items in prog_items before evaluating rules
    ADD_SPHERE_ITEMS_UPFRONT: bool = False

    # When True, use auto sweep algorithm for indirect region dependencies.
    # Use for games with custom Rules.py that sets access_rule directly on entrances
    # without registering indirect_connections via RuleBuilder.set_rule().
    USE_AUTO_INDIRECT_CONDITIONS: bool = False

    # Set of helper function names that should be preserved as helper calls
    # during rule analysis (not inlined/expanded by generic pattern matching)
    # This is used by should_preserve_as_helper() - games can set this instead
    # of overriding the method
    HELPERS_TO_PRESERVE: Set[str] = set()

    # Whether exits should be assumed bidirectional for frontend logic
    # Set to True for games where going through an entrance implies being able to return
    ASSUME_BIDIRECTIONAL_EXITS: bool = False

    # Enable automatic helper preservation based on size
    # When enabled, helpers with more nodes than HELPER_INLINE_THRESHOLD will be
    # preserved as helper calls instead of inlined, reducing rules.json size
    # Most games work better with this disabled (17 games explicitly disable it)
    AUTO_PRESERVE_LARGE_HELPERS: bool = False

    # Threshold for automatic helper preservation (only used if AUTO_PRESERVE_LARGE_HELPERS is True)
    # Helpers with more than this many nodes will be preserved as helper calls
    HELPER_INLINE_THRESHOLD: int = 0

    # Set of helper names that are defined as computed helpers in get_helper_definitions()
    # rather than discovered from helper modules. Used with AUTO_PRESERVE_COMPUTED_HELPERS.
    COMPUTED_HELPERS: Set[str] = set()

    # When True, helpers listed in COMPUTED_HELPERS are automatically preserved
    # (not inlined during rule analysis). This allows games to avoid manually
    # listing computed helpers in HELPERS_TO_PRESERVE.
    AUTO_PRESERVE_COMPUTED_HELPERS: bool = False

    def __init__(self, world=None):
        """Initialize the handler with an empty set of discovered helpers.

        Args:
            world: Optional world object for game-specific data access.
                   Many game handlers need access to the world during rule
                   expansion or other processing.
        """
        # Store world reference if provided
        self.world = world
        # Set of helper names discovered during rule analysis
        # Populated automatically by register_helper_usage()
        self._discovered_helpers: Set[str] = set()
        # Dict mapping helper names to their source modules (auto-detected)
        self._discovered_helper_modules: Dict[str, str] = {}
        # Set of helper names that were auto-preserved due to HELPER_INLINE_THRESHOLD
        # These helpers should not be expanded by common pattern matching
        self._auto_preserved_helpers: Set[str] = set()
        # Cache of analyzed helper definitions (for auto-preserved large helpers)
        self._analyzed_helper_cache: Dict[str, Any] = {}

    def register_helper_usage(self, helper_name: str, helper_func: Any = None) -> None:
        """
        Register that a helper function is used in the rules.

        This is called by the analyzer when it encounters a helper function call.
        The helper will be automatically analyzed and exported as a definition
        (unless it's in the blacklist).

        Args:
            helper_name: The name of the helper function
            helper_func: Optional - the actual function object (used to auto-detect module)
        """
        if not hasattr(self, '_discovered_helpers'):
            self._discovered_helpers = set()
        if not hasattr(self, '_discovered_helper_modules'):
            self._discovered_helper_modules = {}
        self._discovered_helpers.add(helper_name)

        # Auto-detect the module from the function object
        if helper_func is not None and hasattr(helper_func, '__module__'):
            module_name = helper_func.__module__
            if module_name and helper_name not in self._discovered_helper_modules:
                self._discovered_helper_modules[helper_name] = module_name
                logger.debug(f"Auto-detected module for helper '{helper_name}': {module_name}")

    def get_discovered_helpers(self) -> Set[str]:
        """
        Return the set of helper names discovered during rule analysis.

        Returns:
            Set of helper function names that were used in the analyzed rules
        """
        if not hasattr(self, '_discovered_helpers'):
            self._discovered_helpers = set()
        return self._discovered_helpers

    def get_discovered_helper_modules(self) -> Dict[str, str]:
        """
        Return the dict mapping helper names to their auto-detected modules.

        Returns:
            Dict mapping helper function names to module paths
        """
        if not hasattr(self, '_discovered_helper_modules'):
            self._discovered_helper_modules = {}
        return self._discovered_helper_modules

    def register_auto_preserved_helper(self, helper_name: str) -> None:
        """
        Register that a helper was auto-preserved due to HELPER_INLINE_THRESHOLD.

        Auto-preserved helpers should not be expanded by common pattern matching
        in expand_rule() because they will have proper definitions exported.

        Args:
            helper_name: The name of the helper function
        """
        if not hasattr(self, '_auto_preserved_helpers'):
            self._auto_preserved_helpers = set()
        self._auto_preserved_helpers.add(helper_name)

    def is_auto_preserved_helper(self, helper_name: str) -> bool:
        """
        Check if a helper was auto-preserved due to HELPER_INLINE_THRESHOLD.

        Args:
            helper_name: The name of the helper function

        Returns:
            True if the helper was auto-preserved
        """
        if not hasattr(self, '_auto_preserved_helpers'):
            self._auto_preserved_helpers = set()
        return helper_name in self._auto_preserved_helpers

    def clear_discovered_helpers(self) -> None:
        """Clear the set of discovered helpers. Called between player exports."""
        self._discovered_helpers = set()
        self._discovered_helper_modules = {}
        self._auto_preserved_helpers = set()
        self._analyzed_helper_cache = {}

    def cache_analyzed_helper(self, helper_name: str, definition: Dict[str, Any]) -> None:
        """
        Cache an analyzed helper definition for later export.

        This is called by the analyzer when a helper is automatically preserved
        due to exceeding HELPER_INLINE_THRESHOLD. The cached definition will be
        used by get_helper_definitions() instead of re-analyzing the helper.

        Args:
            helper_name: The name of the helper function
            definition: The analyzed rule definition for the helper
        """
        if not hasattr(self, '_analyzed_helper_cache'):
            self._analyzed_helper_cache = {}
        self._analyzed_helper_cache[helper_name] = definition

    def get_cached_helper(self, helper_name: str) -> Optional[Dict[str, Any]]:
        """
        Get a cached helper definition if available.

        Args:
            helper_name: The name of the helper function

        Returns:
            The cached rule definition, or None if not cached
        """
        if not hasattr(self, '_analyzed_helper_cache'):
            self._analyzed_helper_cache = {}
        return self._analyzed_helper_cache.get(helper_name)

    @staticmethod
    def count_rule_nodes(rule: Dict[str, Any]) -> int:
        """
        Count the number of nodes in a rule tree.

        This is used to decide whether to inline a helper or preserve it as a
        helper call based on HELPER_INLINE_THRESHOLD.

        Args:
            rule: The rule structure to count nodes in

        Returns:
            The number of nodes in the rule tree
        """
        if not rule or not isinstance(rule, dict):
            return 0

        count = 1  # Count this node
        rule_type = rule.get('type')

        if rule_type in ['and', 'or']:
            for condition in rule.get('conditions', []):
                count += BaseGameExportHandler.count_rule_nodes(condition)
        elif rule_type == 'not':
            count += BaseGameExportHandler.count_rule_nodes(rule.get('condition'))
        elif rule_type == 'conditional':
            count += BaseGameExportHandler.count_rule_nodes(rule.get('test'))
            count += BaseGameExportHandler.count_rule_nodes(rule.get('if_true'))
            count += BaseGameExportHandler.count_rule_nodes(rule.get('if_false'))
        elif rule_type == 'helper':
            for arg in rule.get('args', []):
                if isinstance(arg, dict):
                    count += BaseGameExportHandler.count_rule_nodes(arg)
        elif rule_type == 'state_method':
            for arg in rule.get('args', []):
                if isinstance(arg, dict):
                    count += BaseGameExportHandler.count_rule_nodes(arg)
        elif rule_type == 'block':
            for stmt in rule.get('statements', []):
                if isinstance(stmt, dict):
                    count += BaseGameExportHandler.count_rule_nodes(stmt)

        return count

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand helper functions in a rule structure."""
        if _depth > MAX_RULE_EXPANSION_DEPTH:
            logging.error(f"Rule expansion exceeded maximum depth ({MAX_RULE_EXPANSION_DEPTH}). "
                         f"This likely indicates a circular helper reference. Rule type: {rule.get('type') if rule else 'None'}")
            return {'type': 'error', 'message': f'Max expansion depth ({MAX_RULE_EXPANSION_DEPTH}) exceeded'}

        if not rule or not isinstance(rule, dict):
            return rule

        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule['name'], rule.get('args', []))
            if expanded:
                return self.expand_rule(expanded, _depth + 1)

        # Recursively expand children of compound rules
        return self._recursively_expand_rule_children(rule, _depth)

    def _recursively_expand_rule_children(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """
        Recursively expand children of compound rules (and, or, not, conditional).

        This utility method can be called by game-specific expand_rule implementations
        to handle standard recursion after doing game-specific transformations.

        Args:
            rule: The rule dictionary to process
            _depth: Current recursion depth (for cycle detection)

        Returns:
            The rule with children recursively expanded
        """
        if not rule or not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        if rule_type in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', [])]

        elif rule_type == 'not':
            rule['condition'] = self.expand_rule(rule.get('condition'), _depth + 1)

        elif rule_type == 'conditional':
            rule['test'] = self.expand_rule(rule.get('test'), _depth + 1)
            rule['if_true'] = self.expand_rule(rule.get('if_true'), _depth + 1)
            rule['if_false'] = self.expand_rule(rule.get('if_false'), _depth + 1)

        return rule
        
    def expand_helper(self, helper_name: str, args: List[Any] = None) -> Dict[str, Any]:
        """Expand a helper function into basic rule conditions."""
        return None
    
    def replace_name(self, name: str) -> str:
        """Replace a name with another name if needed for game-specific logic."""
        return name
        
    def handle_special_function_call(self, func_name: str, processed_args: list) -> dict:
        """
        Handle game-specific special function calls that should be converted to helpers.
        
        Args:
            func_name: The name of the function being called
            processed_args: The processed arguments to the function
            
        Returns:
            A dict with the rule structure, or None if this function should not be handled specially
        """
        return None
    
    def should_preserve_as_helper(self, func_name: str) -> bool:
        """
        Check if a function should be preserved as a helper call during rule analysis.

        This prevents the analyzer from recursively analyzing closure variables that
        should remain as helper functions in the exported rules.

        Games can either:
        1. Set the HELPERS_TO_PRESERVE class attribute with a set of helper names
        2. Set AUTO_PRESERVE_COMPUTED_HELPERS = True and list helpers in COMPUTED_HELPERS
        3. Override this method for custom logic

        Args:
            func_name: The name of the function being analyzed

        Returns:
            True if the function should be preserved as a helper, False otherwise
        """
        # Check the class attribute for preserved helpers
        if func_name in self.HELPERS_TO_PRESERVE:
            return True

        # Check computed helpers if auto-preservation is enabled
        if self.AUTO_PRESERVE_COMPUTED_HELPERS and func_name in self.COMPUTED_HELPERS:
            return True

        return False

    def should_process_multistatement_if_bodies(self) -> bool:
        """
        Check if the analyzer should process if-statements with multiple statements in the body.

        By default, the analyzer only handles simple if-statements with a single statement
        in the body. Some games (like Mario Land 2) have complex if-statements with multiple
        statements that need to be combined into compound conditions.

        Returns:
            True if multi-statement if-bodies should be processed, False otherwise
        """
        # Default implementation: don't process multi-statement if-bodies
        return False

    def should_recursively_analyze_closures(self) -> bool:
        """
        Check if the analyzer should recursively analyze closure variable function calls.

        By default, closure variables are converted to helper calls without recursive analysis.
        Some games (like Mario Land 2) need closure variables to be recursively analyzed and
        inlined to properly export complex rule logic.

        Returns:
            True if closure variables should be recursively analyzed, False otherwise
        """
        # Default implementation: don't recursively analyze closures
        return False

    def get_effective_item_type(self, item_name: str, original_type: str) -> str:
        """
        Get the effective type for an item, considering game-specific event item rules.

        Args:
            item_name: The name of the item
            original_type: The original type from the item object

        Returns:
            The effective type that should be used for export
        """
        # Default implementation: return the original type
        return original_type
        
    def expand_count_check(self, items: List[str], count: int = 1) -> Dict[str, Any]:
        """Create a count check rule for one or more items."""
        return {
            'type': 'or',
            'conditions': [
                {'type': 'count_check', 'item': item, 'count': count}
                for item in items
            ]
        }

    def resolve_f_string(self, f_string_rule: Dict[str, Any]) -> Optional[str]:
        """
        Resolve an f_string AST node to a simple string.

        This is a utility method for game-specific handlers that need to resolve
        f-strings in rules. Override _resolve_f_string_value for game-specific
        value resolution (e.g., subscript lookups).

        Args:
            f_string_rule: The f_string rule node with 'parts' array

        Returns:
            The resolved string, or None if resolution fails
        """
        if f_string_rule.get('type') != 'f_string':
            return None

        parts = f_string_rule.get('parts', [])
        if not parts:
            return ''

        result_parts = []
        for part in parts:
            if part.get('type') == 'constant':
                result_parts.append(str(part.get('value', '')))
            elif part.get('type') == 'formatted_value':
                value_node = part.get('value', {})
                resolved = self._resolve_f_string_value(value_node)
                if resolved is None:
                    logger.debug(f"Cannot resolve f_string formatted_value: {value_node}")
                    return None
                result_parts.append(str(resolved))
            else:
                logger.debug(f"Cannot resolve f_string part type: {part.get('type')}")
                return None

        return ''.join(result_parts)

    def _resolve_f_string_value(self, value_node: Dict[str, Any]) -> Optional[Any]:
        """
        Resolve a single value node within an f-string.

        Override this method in game-specific handlers to support additional
        value types (like subscript lookups, attribute access, etc.).

        Args:
            value_node: The value node from a formatted_value part

        Returns:
            The resolved value, or None if resolution fails
        """
        node_type = value_node.get('type')

        if node_type == 'constant':
            return value_node.get('value', '')
        elif node_type == 'binary_op':
            return self._evaluate_binary_op(value_node)
        elif node_type == 'name':
            # Variable reference - can't resolve without context
            logger.debug(f"Variable reference in f-string: {value_node.get('name')}")
            return None

        # Unknown type - subclasses can handle additional types
        return None

    def _evaluate_binary_op(self, node: Dict[str, Any]) -> Optional[Any]:
        """
        Evaluate a binary operation node.

        Supports +, -, *, /, //, % operators on constant values.

        Args:
            node: The binary_op node

        Returns:
            The result of the operation, or None if evaluation fails
        """
        if node.get('type') != 'binary_op':
            return None

        left = node.get('left', {})
        right = node.get('right', {})
        op = node.get('op', '')

        # Get values (recursively resolve if needed)
        if left.get('type') == 'constant':
            left_val = left.get('value')
        elif left.get('type') == 'binary_op':
            left_val = self._evaluate_binary_op(left)
            if left_val is None:
                return None
        else:
            return None

        if right.get('type') == 'constant':
            right_val = right.get('value')
        elif right.get('type') == 'binary_op':
            right_val = self._evaluate_binary_op(right)
            if right_val is None:
                return None
        else:
            return None

        # Perform operation
        try:
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
                logger.debug(f"Unknown binary operator: {op}")
                return None
        except Exception as e:
            logger.debug(f"Error evaluating binary op: {e}")
            return None

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """
        Return game-specific item definitions beyond the base item_id_to_name.
        Keyed by item name. Should include classification flags.
        """
        return {}
        
    def get_item_max_counts(self, world) -> Dict[str, int]:
        """
        Return game-specific maximum counts for certain items.
        """
        return {}
        
    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Return game-specific progression item mapping data."""
        return {}
        
    def recalculate_collection_state_if_needed(self, current_collection_state, player_id, world):
        """
        Hook for game-specific state recalculations before sphere logging.

        Some games need to recalculate progressive items or state based on
        accessible regions before logging sphere details. Override this method
        in game-specific handlers to perform such recalculations.

        Args:
            current_collection_state: The CollectionState to potentially update
            player_id: The player ID
            world: The world instance for this player
        """
        # Default implementation: do nothing
        pass

    def get_itempool_counts(self, world, multiworld, player) -> Dict[str, int]:
        """Calculate and return item counts for the player's pool.

        Note: After the fill process, multiworld.itempool still contains all original items
        because distribute_items_restrictive operates on a sorted copy. We only count items
        that are actually placed in locations (plus precollected items) to get accurate counts.

        In multiworld, items owned by a player can be placed in ANY player's locations, so we
        must search all locations to find all items belonging to this player.
        """
        itempool_counts = collections.defaultdict(int)

        # Count precollected items (items player starts with)
        if hasattr(multiworld, 'precollected_items'):
            for item in multiworld.precollected_items.get(player, []):
                itempool_counts[item.name] += 1

        # Count items placed in locations (across ALL locations in multiworld)
        # Note: We don't count from multiworld.itempool because after fill it still contains
        # the original items (fill operates on a copy), which would cause double-counting.
        # In multiworld, a player's items may be placed in other players' locations,
        # so we iterate over all filled locations and check if item.player matches.
        for location in multiworld.get_filled_locations():
            if location.item and location.item.player == player:
                itempool_counts[location.item.name] += 1

        if hasattr(world, 'difficulty_requirements'):
            if hasattr(world.difficulty_requirements, 'progressive_bottle_limit'):
                itempool_counts['__max_progressive_bottle'] = world.difficulty_requirements.progressive_bottle_limit
            if hasattr(world.difficulty_requirements, 'boss_heart_container_limit'):
                itempool_counts['__max_boss_heart_container'] = world.difficulty_requirements.boss_heart_container_limit
            if hasattr(world.difficulty_requirements, 'heart_piece_limit'):
                itempool_counts['__max_heart_piece'] = world.difficulty_requirements.heart_piece_limit

        return dict(sorted(itempool_counts.items()))
        
    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extracts game settings relevant for export."""
        settings_dict = {'game': multiworld.game[player]}
        common_settings = [
            'accessibility',
        ]
        for setting in common_settings:
            if hasattr(multiworld, setting) and player in getattr(multiworld, setting, {}):
                value = getattr(multiworld, setting)[player]
                settings_dict[setting] = getattr(value, 'value', value)

        if hasattr(multiworld, 'mode') and player in multiworld.mode:
            mode_val = multiworld.mode[player]
            settings_dict['mode'] = getattr(mode_val, 'value', str(mode_val))

        # Add assume_bidirectional_exits setting from class attribute
        settings_dict['assume_bidirectional_exits'] = self.ASSUME_BIDIRECTIONAL_EXITS

        # Add use_resolved_items setting from class attribute
        # When false (default), eventProcessor uses only base_items from sphere log
        # When true, eventProcessor uses resolved_items (e.g., for games with complex event items)
        settings_dict['use_resolved_items'] = self.USE_RESOLVED_ITEMS

        # Add add_sphere_items_upfront setting from class attribute
        # When true, adds items at the start of each sphere before accessibility checks
        if self.ADD_SPHERE_ITEMS_UPFRONT:
            settings_dict['add_sphere_items_upfront'] = True

        # Add use_auto_indirect_conditions setting from class attribute
        # When true, use auto sweep for indirect region dependencies
        if self.USE_AUTO_INDIRECT_CONDITIONS:
            settings_dict['use_auto_indirect_conditions'] = True

        # Export all game-specific options from the world
        # This allows the world generator to recreate fill_slot_data behavior
        if hasattr(world, 'options') and world.options:
            options_dict = {}
            for option_name in dir(world.options):
                if option_name.startswith('_'):
                    continue
                try:
                    option = getattr(world.options, option_name)
                    # Check if it's an Option object with a value attribute
                    if hasattr(option, 'value'):
                        # For Choice options (which have name_lookup mapping values to string keys),
                        # use the string key since helpers often use dict subscript with string
                        # keys like 'easy', 'normal', 'hard'. For other options (Range, etc.),
                        # use raw value since they don't have named options.
                        # Note: dict/list values are unhashable so we catch TypeError.
                        try:
                            use_string_key = hasattr(option, 'name_lookup') and option.value in option.name_lookup
                        except TypeError:
                            use_string_key = False
                        if use_string_key:
                            value = option.current_key
                        else:
                            value = option.value
                        # Only export simple types (int, bool, str, list, dict)
                        if isinstance(value, (int, bool, str, list, dict)):
                            options_dict[option_name] = value
                        elif isinstance(value, set):
                            options_dict[option_name] = sorted(value)
                except Exception:
                    pass
            if options_dict:
                settings_dict['options'] = options_dict

        # Export option definitions for world generator to recreate proper Option classes
        # This captures the option type (Choice, Range, Toggle, etc.) and metadata
        if hasattr(world, 'options') and world.options:
            option_definitions = {}
            for option_name in dir(world.options):
                if option_name.startswith('_'):
                    continue
                try:
                    option = getattr(world.options, option_name)
                    # Check if it's an Option object
                    if not hasattr(option, 'value'):
                        continue

                    option_class = type(option)
                    option_def = {}

                    # Determine option type by checking class hierarchy
                    # Import here to avoid circular imports
                    from Options import Choice, Range, Toggle, DefaultOnToggle, OptionSet, OptionList, OptionDict

                    if isinstance(option, OptionSet) or isinstance(option, OptionList) or isinstance(option, OptionDict):
                        # Skip complex collection options for now
                        continue
                    elif isinstance(option, Range) and not isinstance(option, Choice):
                        option_def['type'] = 'range'
                        option_def['range_start'] = option_class.range_start
                        option_def['range_end'] = option_class.range_end
                        option_def['default'] = option_class.default
                    elif isinstance(option, DefaultOnToggle):
                        option_def['type'] = 'default_on_toggle'
                        option_def['default'] = option_class.default
                    elif isinstance(option, Toggle):
                        option_def['type'] = 'toggle'
                        option_def['default'] = option_class.default
                    elif isinstance(option, Choice):
                        option_def['type'] = 'choice'
                        # Export name_lookup which maps value -> name
                        # Handle buggy option definitions where values are tuples like (1,) instead of 1
                        def normalize_key(k):
                            if isinstance(k, tuple) and len(k) == 1:
                                return str(k[0])
                            return str(k)
                        option_def['name_lookup'] = {normalize_key(k): v for k, v in option_class.name_lookup.items()}
                        option_def['default'] = option_class.default
                    else:
                        # Unknown option type, skip
                        continue

                    # Add display_name if available
                    if hasattr(option_class, 'display_name') and option_class.display_name:
                        option_def['display_name'] = option_class.display_name

                    option_definitions[option_name] = option_def
                except Exception as e:
                    logger.debug(f"Failed to export option definition for '{option_name}': {e}")

            if option_definitions:
                settings_dict['option_definitions'] = option_definitions

        # Process EXPORTED_OPTIONS - simple option value extractions
        if self.EXPORTED_OPTIONS:
            for option_name in self.EXPORTED_OPTIONS:
                try:
                    if hasattr(world, 'options') and hasattr(world.options, option_name):
                        option = getattr(world.options, option_name)
                        if hasattr(option, 'value'):
                            settings_dict[option_name] = option.value
                except Exception as e:
                    logger.warning(f"Failed to export option '{option_name}': {e}")

        return settings_dict

    def get_world_attributes(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract world attributes (computed runtime values) for export.

        World attributes are values computed at runtime and stored as instance
        attributes on the world object (e.g., world.difficulty_requirements).
        These are separate from settings/options which are user-configurable.

        Returns:
            Dict of attribute_name -> value
        """
        world_attributes = {}

        # Process WORLD_ATTRIBUTES class attribute
        if self.WORLD_ATTRIBUTES:
            for attr_name, compute_func in self.WORLD_ATTRIBUTES.items():
                try:
                    value = compute_func(world, multiworld, player)
                    world_attributes[attr_name] = value
                except Exception as e:
                    logger.warning(f"Failed to compute world attribute '{attr_name}': {e}")

        # Also process COMPUTED_SETTINGS for backwards compatibility
        # TODO: Remove after migrating game-specific handlers to WORLD_ATTRIBUTES
        if self.COMPUTED_SETTINGS:
            for attr_name, compute_func in self.COMPUTED_SETTINGS.items():
                try:
                    value = compute_func(world, multiworld, player)
                    world_attributes[attr_name] = value
                except Exception as e:
                    logger.warning(f"Failed to compute world attribute '{attr_name}': {e}")

        # Auto-discover simple world attributes from the world instance
        # This extracts runtime-computed values without requiring explicit WORLD_ATTRIBUTES entries
        skip_attrs = {
            # Internal/infrastructure attributes
            'player', 'multiworld', 'options', 'random', 'options_dataclass',
            # World class infrastructure
            'game', 'topology_present', 'web', 'required_client_version',
            'origin_region_name', 'explicit_indirect_conditions',
            # Item/location infrastructure
            'item_name_to_id', 'location_name_to_id', 'item_id_to_name', 'location_id_to_name',
            'item_names', 'location_names', 'item_name_groups', 'location_name_groups',
            # Other common internal attributes
            'slot_data', 'settings_key', 'hint_blacklist',
        }

        def get_serializable_value(value: Any) -> Any:
            """Convert a value to a JSON-serializable form, or return None if not possible."""
            # Check bool before int (bool is subclass of int)
            if isinstance(value, bool):
                return value
            elif isinstance(value, (int, float, str)):
                return value
            elif isinstance(value, enum.Enum):
                # For enums, prefer .value (usually the serializable form)
                return value.value if hasattr(value, 'value') else str(value)
            elif isinstance(value, (list, tuple)):
                # Namedtuples should be handled by extract_nested_attributes, not as lists
                if hasattr(value, '_fields'):
                    return None
                result = []
                for v in value:
                    converted = get_serializable_value(v)
                    if converted is None:
                        return None  # Can't serialize this list
                    result.append(converted)
                return result
            return None

        def extract_nested_attributes(obj: Any) -> Optional[Dict[str, Any]]:
            """Extract simple attributes from an object as a nested dict."""
            if obj is None:
                return None

            result = {}

            # Check for namedtuple FIRST (before tuple check, since namedtuples are tuples)
            if hasattr(obj, '_fields'):
                for field in obj._fields:
                    if field.startswith('_'):
                        continue
                    try:
                        val = getattr(obj, field, None)
                        if val is None:
                            continue
                        serialized = get_serializable_value(val)
                        if serialized is not None:
                            result[field] = serialized
                    except Exception:
                        pass
                return result if result else None

            # Skip if it's a simple type (already handled by get_serializable_value)
            if isinstance(obj, (bool, int, float, str, list, tuple, enum.Enum)):
                return None
            # Skip common complex types that shouldn't be extracted
            if isinstance(obj, (type, collections.abc.Callable)):
                return None

            # Try to get attributes from __dict__ or __slots__
            attrs_to_check = []
            if hasattr(obj, '__dict__'):
                attrs_to_check = list(obj.__dict__.keys())
            elif hasattr(obj, '__slots__'):
                attrs_to_check = list(obj.__slots__)

            for attr in attrs_to_check:
                if attr.startswith('_'):
                    continue
                try:
                    val = getattr(obj, attr, None)
                    if val is None:
                        continue
                    serialized = get_serializable_value(val)
                    if serialized is not None:
                        result[attr] = serialized
                except Exception:
                    pass

            return result if result else None

        def try_add_attribute(attr_name: str, value: Any) -> bool:
            """Try to add an attribute if it's a simple JSON-serializable type."""
            if attr_name.startswith('_'):
                return False
            if attr_name in skip_attrs:
                return False
            if attr_name in world_attributes:
                return False

            # Try to get a serializable value
            serialized = get_serializable_value(value)
            if serialized is not None:
                world_attributes[attr_name] = serialized
                logger.debug(f"Auto-discovered world attribute '{attr_name}': {serialized}")
                return True

            # Try to extract nested attributes (one level deep)
            nested = extract_nested_attributes(value)
            if nested is not None:
                world_attributes[attr_name] = nested
                logger.debug(f"Auto-discovered nested world attribute '{attr_name}': {nested}")
                return True

            return False

        # Get instance attributes (set on self)
        if hasattr(world, '__dict__'):
            for attr_name, value in world.__dict__.items():
                try_add_attribute(attr_name, value)

        # Also check class-level attributes with type annotations (e.g., can_take_damage: bool = True)
        # These are defaults that may not be set on the instance
        world_class = type(world)
        if hasattr(world_class, '__annotations__'):
            for attr_name, attr_type in world_class.__annotations__.items():
                if attr_name in world_attributes:
                    continue  # Already discovered from instance
                if attr_name in skip_attrs:
                    continue
                # Only include simple annotated types
                if attr_type in (bool, int, float, str):
                    try:
                        value = getattr(world, attr_name, None)
                        if value is not None:
                            try_add_attribute(attr_name, value)
                    except Exception:
                        pass

        # For worldgen worlds, load world_attributes from _worldgen_settings.json
        # This is needed because worldgen worlds store computed attributes there
        module_path = type(world).__module__
        if module_path.endswith('_worldgen') or '_worldgen.' in module_path:
            try:
                from pathlib import Path
                import json
                parts = module_path.split('.')
                if len(parts) >= 2:
                    world_dir = parts[1]
                    settings_path = Path('worlds') / world_dir / '_worldgen_settings.json'
                    if settings_path.exists():
                        with open(settings_path, 'r') as f:
                            worldgen_settings = json.load(f)
                        # Load world_attributes section if present (new format)
                        if 'world_attributes' in worldgen_settings:
                            for key, value in worldgen_settings['world_attributes'].items():
                                if key not in world_attributes:
                                    world_attributes[key] = value
                        else:
                            # Legacy format: world attributes are mixed with settings
                            # Skip known settings keys
                            skip_keys = {
                                'game', 'options', 'option_definitions', 'world_directory',
                                'assume_bidirectional_exits', 'use_resolved_items',
                                'use_auto_indirect_conditions', 'add_sphere_items_upfront',
                            }
                            for key, value in worldgen_settings.items():
                                if key not in skip_keys and key not in world_attributes:
                                    world_attributes[key] = value
                        logger.debug(f"Loaded world attributes from {settings_path}")
            except Exception as e:
                logger.warning(f"Failed to load worldgen world attributes: {e}")

        return world_attributes
        
    def get_game_info(self, world) -> Dict[str, Any]:
        """
        Get information about the game's rule formats and structure.
        This can be overridden by game-specific expanders to provide more detailed information.

        The base handler checks for accumulator_rules and prog_items_init class attributes
        on the world, allowing generated worlds to define state counter patterns.

        Returns:
            A dictionary with game information for the frontend.
        """
        game_info = {
            "name": world.game,
            "rule_format": {
                "version": "1.0"
            }
        }

        # Check if the world defines accumulator rules (for state counter patterns like coins)
        # This allows generated worlds from AST format to export accumulator rules
        if hasattr(world, 'accumulator_rules') and world.accumulator_rules:
            game_info['accumulator_rules'] = world.accumulator_rules

        # Check if the world defines initial values for prog_items accumulators
        if hasattr(world, 'prog_items_init') and world.prog_items_init:
            game_info['prog_items_init'] = world.prog_items_init

        # Export base_id if available (used for ID allocation)
        if hasattr(world, 'base_id') and world.base_id is not None:
            game_info['base_id'] = world.base_id

        # Export WebWorld metadata if available
        if hasattr(world, 'web') and world.web:
            web = world.web
            # Theme
            if hasattr(web, 'theme') and web.theme:
                game_info['web_theme'] = web.theme
            # Tutorials
            if hasattr(web, 'tutorials') and web.tutorials:
                tutorials_data = []
                for tutorial in web.tutorials:
                    tutorial_info = {}
                    if hasattr(tutorial, 'tutorial_name'):
                        tutorial_info['name'] = tutorial.tutorial_name
                    if hasattr(tutorial, 'description'):
                        tutorial_info['description'] = tutorial.description
                    if hasattr(tutorial, 'language'):
                        tutorial_info['language'] = tutorial.language
                    if hasattr(tutorial, 'file_name'):
                        tutorial_info['file_name'] = tutorial.file_name
                    if hasattr(tutorial, 'link'):
                        tutorial_info['link'] = tutorial.link
                    if hasattr(tutorial, 'authors'):
                        tutorial_info['authors'] = tutorial.authors
                    if tutorial_info:
                        tutorials_data.append(tutorial_info)
                if tutorials_data:
                    game_info['web_tutorials'] = tutorials_data

        # Export world class docstring if available
        world_class = world.__class__
        if world_class.__doc__:
            # Clean up the docstring (strip leading/trailing whitespace from each line)
            docstring = world_class.__doc__
            # Normalize whitespace
            lines = [line.strip() for line in docstring.strip().split('\n')]
            game_info['world_description'] = '\n'.join(lines)

        # Export fill_slot_data return value if available
        # This captures the data the world sends to the client
        if hasattr(world, 'fill_slot_data') and callable(world.fill_slot_data):
            try:
                slot_data = world.fill_slot_data()
                if slot_data and isinstance(slot_data, dict):
                    game_info['slot_data'] = slot_data
            except Exception as e:
                logger.debug(f"Could not call fill_slot_data for {world.game}: {e}")

        return game_info
        
    def get_required_fields(self) -> List[str]:
        """
        Get list of required fields for a complete game export.
        
        Returns:
            A list of field names that must be included in the export.
        """
        return ['region_name', 'locations', 'entrances']
        
    def get_all_worlds(self) -> List[Any]:
        """
        Get all worlds associated with this helper.
        This is typically used to access game-specific data and logic.
        
        Returns:
            A list of world objects.
        """
        return []
        
    def cleanup_settings(self, settings_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Perform game-specific cleanup/mapping on exported settings.

        Converts numeric option values to string names to match how Python
        helpers compare against option values.
        """
        common_setting_mappings = {
            'accessibility': {0: 'items', 1: 'locations', 2: 'none'},
        }
        for setting_name, value in settings_dict.items():
            if setting_name in common_setting_mappings and isinstance(value, int):
                if value in common_setting_mappings[setting_name]:
                    settings_dict[setting_name] = common_setting_mappings[setting_name][value]
                else:
                    settings_dict[setting_name] = f"unknown_{value}"
        return settings_dict

    def get_region_attributes(self, region) -> Dict[str, Any]:
        """
        Get game-specific region attributes to include in the export.
        This is called for each region during processing.

        Args:
            region: The region object being processed

        Returns:
            A dictionary of attributes to add to the region data
        """
        attributes = {}

        # Check for dynamically_added attribute (set by worldgen for regions
        # that were added after sphere calculation in the original world)
        if getattr(region, 'dynamically_added', False):
            attributes['dynamically_added'] = True

        return attributes

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """
        Get game-specific location attributes to include in the export.
        This is called for each location during processing.

        Args:
            location: The location object being processed
            world: The world object for this player

        Returns:
            A dictionary of attributes to add to the location data
        """
        # Base implementation returns no additional attributes
        return {}

    def preprocess_world_data(self, world, export_data: Dict[str, Any], player: int) -> None:
        """
        Preprocess game-specific data before region processing.
        This is called early in the export process to set up any necessary data.

        Args:
            world: The world object for this player
            export_data: The export data dictionary being built
            player: The player number

        Returns:
            None (modifies export_data in place)
        """
        # Base implementation does nothing
        pass
    
    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post-process the exported data after all standard processing is complete.
        This is called at the end of the export process to allow game-specific modifications.

        Args:
            data: The complete export data dictionary

        Returns:
            The modified export data dictionary
        """
        # Base implementation returns data unchanged
        return data

    def get_helpers_to_export_whitelist(self) -> Set[str]:
        """
        Return a set of helper function names that SHOULD be exported as definitions.

        When this returns a non-empty set, only these helpers will be exported as
        definitions in the rules.json. All other helpers will remain as helper calls
        that the frontend must implement.

        Returns:
            A set of helper function names to export as definitions.
        """
        return self.HELPERS_TO_EXPORT_WHITELIST

    def get_helpers_to_export_blacklist(self) -> Set[str]:
        """
        Return a set of helper function names that should NOT be exported as definitions.

        When this returns a non-empty set, these helpers will NOT be exported as
        definitions even if they would otherwise be eligible. This is useful when
        most helpers can be exported but a few are too complex.

        The blacklist is checked after the whitelist.

        Returns:
            A set of helper function names to NOT export as definitions.
        """
        return self.HELPERS_TO_EXPORT_BLACKLIST

    def get_helper_modules(self) -> List[str]:
        """
        Return a list of module paths containing helper functions.

        Returns:
            A list of module paths (e.g., ['worlds.shapez.regions'])
        """
        return self.HELPER_MODULES

    def get_item_name_modules(self) -> List[str]:
        """
        Return a list of module paths containing item name constants.

        Returns:
            A list of module paths (e.g., ['worlds.shapez.data.strings'])
        """
        return self.ITEM_NAME_MODULES

    def _analyze_worldgen_helpers(self, rules_module, world) -> Dict[str, Any]:
        """
        Analyze helper functions from a worldgen Rules.py module.

        Worldgen worlds have helper functions defined as Python code in their Rules.py.
        This method finds all helper functions (those starting with '_' and taking
        state/player args) and analyzes them to produce AST definitions.

        Args:
            rules_module: The imported Rules.py module from a worldgen world
            world: The world object for this player

        Returns:
            A dictionary mapping helper names to their rule definitions.
        """
        from exporter.analyzer import analyze_rule

        helper_definitions = {}

        # Find all helper functions in the module
        # Worldgen helper functions follow the pattern: _gamename_worldgen_helpername
        # They take (state, player) or (state, player, *args) as parameters
        for name in dir(rules_module):
            if not name.startswith('_') or name.startswith('__'):
                continue

            obj = getattr(rules_module, name)
            if not callable(obj) or not hasattr(obj, '__code__'):
                continue

            # Check if this looks like a helper function (has state and player params)
            code = obj.__code__
            if code.co_argcount < 2:
                continue

            varnames = code.co_varnames[:code.co_argcount]
            if len(varnames) < 2 or varnames[0] != 'state' or varnames[1] != 'player':
                continue

            # This is a helper function - analyze it
            try:
                rule = analyze_rule(
                    rule_func=obj,
                    game_handler=self,
                    player_context=world.player if hasattr(world, 'player') else None,
                    preserve_parameter_names=True
                )

                if rule and rule.get('type') != 'error':
                    # Extract parameter names beyond state/player
                    params = list(varnames[2:])  # Skip state, player
                    defaults = {}

                    # Get default values if any
                    if obj.__defaults__:
                        num_defaults = len(obj.__defaults__)
                        param_names_with_defaults = params[-num_defaults:]
                        for param_name, default_val in zip(param_names_with_defaults, obj.__defaults__):
                            if default_val is not None:
                                defaults[param_name] = default_val

                    # Extract the helper name without the worldgen prefix
                    # e.g., _shapezworldgen_can_cut_half -> can_cut_half
                    # The pattern is: _<gamename>worldgen_<helper_name>
                    # We need to match the unprefixed names used in the rules
                    helper_name = name
                    if name.startswith('_') and 'worldgen_' in name:
                        # Strip the _<gamename>worldgen_ prefix
                        prefix_end = name.find('worldgen_') + len('worldgen_')
                        helper_name = name[prefix_end:]

                    if params:
                        helper_def = {
                            'params': params,
                            'body': rule
                        }
                        if defaults:
                            helper_def['defaults'] = defaults
                        helper_definitions[helper_name] = helper_def
                    else:
                        helper_definitions[helper_name] = rule

                    logger.debug(f"Analyzed worldgen helper '{helper_name}'")

            except Exception as e:
                logger.warning(f"Failed to analyze worldgen helper '{name}': {e}")

        # Post-process: strip worldgen prefix from all helper references within rules
        helper_definitions = self._strip_worldgen_prefixes_from_rules(helper_definitions)

        return helper_definitions

    def _strip_worldgen_prefixes_from_rules(self, helper_definitions: Dict[str, Any]) -> Dict[str, Any]:
        """
        Strip worldgen prefixes from all helper references within rule bodies.

        When the analyzer parses Python code like `_shapezworldgen_can_stack(state, player)`,
        it creates helper references with the full prefixed name. This method transforms
        all such references to use the unprefixed name (e.g., `can_stack`).
        """
        def strip_prefix(name: str) -> str:
            if name.startswith('_') and 'worldgen_' in name:
                prefix_end = name.find('worldgen_') + len('worldgen_')
                return name[prefix_end:]
            return name

        def transform_rule(rule: Any) -> Any:
            if isinstance(rule, dict):
                # Make a copy and recursively process all values
                result = {k: transform_rule(v) for k, v in rule.items()}
                # If this is a helper reference, strip the worldgen prefix from the name
                if result.get('type') == 'helper' and 'name' in result:
                    result['name'] = strip_prefix(result['name'])
                return result
            elif isinstance(rule, list):
                return [transform_rule(item) for item in rule]
            return rule

        return {name: transform_rule(definition) for name, definition in helper_definitions.items()}

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """
        Extract helper function definitions and return them as rule structures.

        This method automatically finds and analyzes helper functions from the
        modules specified in HELPER_MODULES, converting them to rule structures
        that the frontend can evaluate directly.

        Helper discovery works in two ways:
        1. Automatic: Helpers discovered during rule analysis (via register_helper_usage)
        2. Manual: Helpers listed in HELPERS_TO_EXPORT_WHITELIST

        The blacklist (HELPERS_TO_EXPORT_BLACKLIST) excludes helpers from export.

        For worldgen worlds, helper functions are analyzed directly from the
        Rules.py module's Python code, converting them to AST format.

        Args:
            world: The world object for this player

        Returns:
            A dictionary mapping helper names to their rule definitions.
            Example: {"can_cut_half": {"type": "item_check", "item": "Cutter"}}
        """
        # Check for worldgen worlds first - analyze helper functions from their Rules.py module
        try:
            world_module = type(world).__module__
            if '_worldgen' in world_module:
                # This is a worldgen world - analyze helper functions from Rules.py
                # world_module is like 'worlds.ahit_worldgen' - we need 'worlds.ahit_worldgen.Rules'
                rules_module_name = world_module + '.Rules'
                try:
                    rules_module = importlib.import_module(rules_module_name)
                    worldgen_helpers = self._analyze_worldgen_helpers(rules_module, world)
                    if worldgen_helpers:
                        logger.debug(f"Analyzed {len(worldgen_helpers)} helper definitions from worldgen Rules.py")
                        return worldgen_helpers
                except ImportError as e:
                    logger.debug(f"Could not import worldgen Rules module: {e}")
        except Exception as e:
            logger.debug(f"Error checking for worldgen helpers: {e}")

        # Import analyze_rule here to avoid circular imports
        from exporter.analyzer import analyze_rule

        helper_definitions = {}

        # Get helper configuration
        whitelist = self.get_helpers_to_export_whitelist()
        blacklist = self.get_helpers_to_export_blacklist()
        helper_modules = self.get_helper_modules()

        # Determine which helpers to export based on AUTO_EXPORT_DISCOVERED_HELPERS
        # When False (default), only whitelisted helpers are exported
        # When True, discovered helpers are also exported (minus blacklist)
        # Auto-preserved helpers (from AUTO_PRESERVE_LARGE_HELPERS) are always exported
        auto_preserved = self._auto_preserved_helpers if hasattr(self, '_auto_preserved_helpers') else set()
        if self.AUTO_EXPORT_DISCOVERED_HELPERS:
            discovered = self.get_discovered_helpers()
            helpers_to_export = discovered | whitelist | auto_preserved
        else:
            helpers_to_export = whitelist | auto_preserved

        # Collect modules to load - both manually specified and auto-discovered
        auto_discovered_modules = set(self.get_discovered_helper_modules().values())
        all_module_paths = set(helper_modules) | auto_discovered_modules

        if not helpers_to_export or not all_module_paths:
            return helper_definitions

        # Load helper modules
        loaded_modules = []
        for module_path in all_module_paths:
            try:
                module = importlib.import_module(module_path)
                loaded_modules.append(module)
            except ImportError as e:
                logger.warning(f"Could not import helper module '{module_path}': {e}")

        if not loaded_modules:
            return helper_definitions

        # Process helpers iteratively to discover nested helper dependencies
        # When analyzing a helper, it may call other helpers which get registered
        # Keep iterating until no new helpers are discovered
        processed_helpers: Set[str] = set()

        for iteration in range(MAX_HELPER_DISCOVERY_ITERATIONS):
            # Get current set of helpers to export (may grow as we discover new ones)
            # Include auto-preserved helpers in each iteration (they may grow too)
            auto_preserved = self._auto_preserved_helpers if hasattr(self, '_auto_preserved_helpers') else set()
            if self.AUTO_EXPORT_DISCOVERED_HELPERS:
                discovered = self.get_discovered_helpers()
                current_helpers = discovered | whitelist | auto_preserved
            else:
                current_helpers = whitelist | auto_preserved

            # Find helpers that haven't been processed yet
            new_helpers = current_helpers - processed_helpers - blacklist

            if not new_helpers:
                logger.debug(f"Helper discovery complete after {iteration + 1} iteration(s)")
                break

            logger.debug(f"Iteration {iteration + 1}: Processing {len(new_helpers)} new helpers: {new_helpers}")

            for helper_name in new_helpers:
                processed_helpers.add(helper_name)

                # Find the helper function in one of the loaded modules
                # First check module-level functions, then class methods
                helper_func = None
                for module in loaded_modules:
                    # Check module-level function
                    if hasattr(module, helper_name):
                        helper_func = getattr(module, helper_name)
                        break
                    # Check methods in classes defined in the module
                    for name, obj in vars(module).items():
                        if isinstance(obj, type):  # It's a class
                            if hasattr(obj, helper_name):
                                method = getattr(obj, helper_name)
                                # Get the underlying function from the method
                                if callable(method):
                                    helper_func = method
                                    break
                    if helper_func is not None:
                        break

                # Check if we have a cached definition (from auto-preservation due to size)
                cached_def = self.get_cached_helper(helper_name)
                if cached_def is not None:
                    # Apply game-specific rule expansion to cached definitions
                    # (e.g., TWW state method replacement, civ_6 subscript resolution)
                    if hasattr(self, 'expand_rule') and callable(self.expand_rule):
                        cached_def = self.expand_rule(cached_def)

                    # Extract parameter names and defaults from the function (excluding state, player, world, self)
                    params = []
                    defaults = {}
                    if helper_func and hasattr(helper_func, '__code__'):
                        all_params = helper_func.__code__.co_varnames[:helper_func.__code__.co_argcount]
                        params = [p for p in all_params if p not in ('state', 'player', 'world', 'self')]

                        # Extract default values for parameters
                        if hasattr(helper_func, '__defaults__') and helper_func.__defaults__:
                            func_defaults = helper_func.__defaults__
                            num_defaults = len(func_defaults)
                            params_with_defaults = all_params[-num_defaults:]
                            for param_name, default_value in zip(params_with_defaults, func_defaults):
                                if param_name in params:
                                    if isinstance(default_value, (bool, int, float, str, type(None))):
                                        defaults[param_name] = default_value

                    # Store with params if the helper has parameters
                    if params:
                        helper_def = {
                            'params': params,
                            'body': cached_def
                        }
                        if defaults:
                            helper_def['defaults'] = defaults
                        # Add param_mappings if defined for this helper
                        if helper_name in self.HELPER_PARAM_MAPPINGS:
                            helper_def['param_mappings'] = self.HELPER_PARAM_MAPPINGS[helper_name]
                        helper_definitions[helper_name] = helper_def
                        logger.debug(f"Using cached definition for helper '{helper_name}' with params {params}, defaults {defaults}")
                    else:
                        helper_definitions[helper_name] = cached_def
                        logger.debug(f"Using cached definition for helper '{helper_name}': {cached_def}")
                    continue

                if helper_func is None:
                    # Not found in helper modules - this is normal for built-in helpers
                    # like 'has', 'count', etc. that the frontend implements directly
                    logger.debug(f"Helper function '{helper_name}' not found in helper modules (may be a built-in)")
                    continue

                # Skip built-in functions (e.g., math.floor imported at module level)
                # These can't be analyzed via source inspection and are typically
                # handled directly by the frontend rule engine
                if inspect.isbuiltin(helper_func):
                    logger.debug(f"Helper '{helper_name}' is a built-in function, skipping analysis (handled by frontend)")
                    continue

                # Check if this is an enum class (e.g., Difficulty, HatType)
                # Enum constructors like Difficulty(value) are essentially identity functions
                # for rule purposes - they take a numeric value and return the enum member,
                # but for comparisons we only care about the underlying numeric value.
                if isinstance(helper_func, type) and issubclass(helper_func, enum.Enum):
                    logger.debug(f"Helper '{helper_name}' is an enum class - exporting as identity function")
                    # Export as a simple passthrough: takes one arg and returns it
                    # This allows Difficulty(world.options.LogicDifficulty) to work correctly
                    helper_definitions[helper_name] = {
                        'params': ['value'],
                        'body': {'type': 'name', 'name': 'value'}
                    }
                    continue

                # Check if this is a regular class (non-enum)
                # Classes like SMBool can't be analyzed via source inspection since they
                # don't have __code__ attributes. These classes are typically constructors
                # that the frontend implements directly.
                if isinstance(helper_func, type):
                    logger.debug(f"Helper '{helper_name}' is a class - skipping analysis (frontend-implemented)")
                    continue

                # Note: We previously checked for "dynamic for loops" here and blocked export.
                # Now that for_iter with tuple unpacking, map(), and dict methods are supported,
                # we allow the analysis to proceed. If the analyzer can't handle a specific case,
                # it will return an error or unsupported result.

                # Analyze the function to get its rule structure
                # This may discover new helpers via register_helper_usage
                # Use preserve_parameter_names=True so that default parameter values
                # are kept as name references (not inlined) for runtime resolution
                try:
                    rule = analyze_rule(
                        rule_func=helper_func,
                        game_handler=self,
                        player_context=world.player if hasattr(world, 'player') else None,
                        preserve_parameter_names=True
                    )

                    # Clean up the rule - resolve item names, convert state methods to rule types
                    rule = self._clean_helper_rule(rule, world)

                    # Expand helper calls in the rule (game-specific expansions)
                    if hasattr(self, 'expand_rule') and callable(self.expand_rule):
                        rule = self.expand_rule(rule)

                    if rule and rule.get('type') != 'error':
                        # Extract parameter names and defaults from the function (excluding state, player, world, self)
                        params = []
                        defaults = {}
                        if hasattr(helper_func, '__code__'):
                            all_params = helper_func.__code__.co_varnames[:helper_func.__code__.co_argcount]
                            params = [p for p in all_params if p not in ('state', 'player', 'world', 'self')]

                            # Extract default values for parameters
                            if hasattr(helper_func, '__defaults__') and helper_func.__defaults__:
                                func_defaults = helper_func.__defaults__
                                # Defaults apply to the last N parameters
                                num_defaults = len(func_defaults)
                                params_with_defaults = all_params[-num_defaults:]
                                for param_name, default_value in zip(params_with_defaults, func_defaults):
                                    if param_name in params:  # Only include if it's not state/player/world
                                        # Only include simple JSON-serializable defaults
                                        if isinstance(default_value, (bool, int, float, str, type(None))):
                                            defaults[param_name] = default_value

                        # Store with params if the helper has parameters, otherwise just the rule
                        if params:
                            helper_def = {
                                'params': params,
                                'body': rule
                            }
                            if defaults:
                                helper_def['defaults'] = defaults
                            # Add param_mappings if defined for this helper
                            if helper_name in self.HELPER_PARAM_MAPPINGS:
                                helper_def['param_mappings'] = self.HELPER_PARAM_MAPPINGS[helper_name]
                            helper_definitions[helper_name] = helper_def
                            logger.debug(f"Exported helper '{helper_name}' with params {params}, defaults {defaults}: {rule}")
                        else:
                            helper_definitions[helper_name] = rule
                            logger.debug(f"Exported helper '{helper_name}': {rule}")
                    else:
                        logger.warning(f"Failed to analyze helper '{helper_name}': {rule}")
                except Exception as e:
                    logger.error(f"Error analyzing helper '{helper_name}': {e}")
        else:
            logger.warning(f"Helper discovery reached max iterations ({MAX_HELPER_DISCOVERY_ITERATIONS}), may have circular dependencies")

        # Sort alphabetically for consistent output
        return dict(sorted(helper_definitions.items()))

    def _clean_helper_rule(self, rule: Dict[str, Any], world) -> Dict[str, Any]:
        """
        Clean up a helper rule by resolving attribute nodes and simplifying structure.

        This handles cases where the analyzer produces attribute nodes like
        ITEMS.cutter that need to be resolved to actual item names, and converts
        state method calls (has, has_any, has_all) to rule types the frontend
        can evaluate directly.

        Args:
            rule: The rule dictionary to clean up
            world: The world object for context

        Returns:
            The cleaned up rule dictionary
        """
        if not rule or not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Resolve item_check with attribute-based item names
        if rule_type == 'item_check':
            item = rule.get('item')
            if isinstance(item, dict) and item.get('type') == 'attribute':
                resolved_item = self._resolve_item_attribute(item)
                if resolved_item:
                    rule['item'] = resolved_item
            return rule

        # Handle state.has(item, player) -> item_check
        if rule_type == 'state_method' and rule.get('method') == 'has':
            args = rule.get('args', [])
            if len(args) >= 1:
                item_arg = args[0]
                if isinstance(item_arg, dict) and item_arg.get('type') == 'attribute':
                    resolved_item = self._resolve_item_attribute(item_arg)
                    if resolved_item:
                        return {'type': 'item_check', 'item': resolved_item}
                elif isinstance(item_arg, dict) and item_arg.get('type') == 'constant':
                    return {'type': 'item_check', 'item': item_arg.get('value')}
            return rule

        # Handle state.has_any((items), player) -> or of item_checks
        if rule_type == 'state_method' and rule.get('method') == 'has_any':
            args = rule.get('args', [])
            if len(args) >= 1:
                items_arg = args[0]
                items = self._resolve_items_collection(items_arg)
                if items:
                    return {
                        'type': 'or',
                        'conditions': [{'type': 'item_check', 'item': item} for item in items]
                    }
            return rule

        # Handle state.has_all((items), player) -> and of item_checks
        if rule_type == 'state_method' and rule.get('method') == 'has_all':
            args = rule.get('args', [])
            if len(args) >= 1:
                items_arg = args[0]
                items = self._resolve_items_collection(items_arg)
                if items:
                    return {
                        'type': 'and',
                        'conditions': [{'type': 'item_check', 'item': item} for item in items]
                    }
            return rule

        # Recursively clean conditions
        if rule_type in ['and', 'or']:
            rule['conditions'] = [self._clean_helper_rule(c, world) for c in rule.get('conditions', [])]
            return rule

        if rule_type == 'not':
            rule['condition'] = self._clean_helper_rule(rule.get('condition'), world)
            return rule

        return rule

    def _resolve_item_attribute(self, attr_node: Dict[str, Any]) -> Optional[str]:
        """
        Resolve an attribute node (like ITEMS.cutter) to an item name string.

        Searches through the modules specified in ITEM_NAME_MODULES for classes
        that have the matching attribute.

        Args:
            attr_node: The attribute node dictionary from the analyzer

        Returns:
            The resolved item name string, or None if not found
        """
        if not attr_node or attr_node.get('type') != 'attribute':
            return None

        attr_name = attr_node.get('attr')
        obj = attr_node.get('object', {})

        # Get the class name (e.g., 'ITEMS')
        class_name = None
        if obj.get('type') == 'name':
            class_name = obj.get('name')

        if not class_name or not attr_name:
            return None

        # Search through item name modules for the class and attribute
        for module_path in self.get_item_name_modules():
            try:
                module = importlib.import_module(module_path)
                if hasattr(module, class_name):
                    item_class = getattr(module, class_name)
                    if hasattr(item_class, attr_name):
                        return getattr(item_class, attr_name)
            except ImportError:
                pass

        return None

    def _resolve_items_collection(self, collection_node: Dict[str, Any]) -> Optional[List[str]]:
        """
        Resolve a tuple/list/set of item attributes to a list of item name strings.

        Handles:
        - Constant nodes with list/tuple values (already resolved by analyzer)
        - Tuple/list/set nodes with attribute or constant elements
        - Set nodes used in has_any/has_all patterns

        Args:
            collection_node: The collection node dictionary from the analyzer

        Returns:
            A list of item name strings, or None if not resolvable
        """
        if not collection_node:
            return None

        items = []
        node_type = collection_node.get('type')

        # Handle constant type with list/tuple value (already resolved by analyzer)
        if node_type == 'constant':
            value = collection_node.get('value')
            if isinstance(value, (list, tuple)):
                return list(value)

        # Handle tuple, list, or set types
        if node_type in ('tuple', 'list', 'set'):
            elements = collection_node.get('elements', [])
            for elem in elements:
                if elem.get('type') == 'attribute':
                    item_name = self._resolve_item_attribute(elem)
                    if item_name:
                        items.append(item_name)
                elif elem.get('type') == 'constant':
                    value = elem.get('value')
                    if isinstance(value, str):
                        items.append(value)

        return items if items else None