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

    # Module-level variables to inject into closure_vars for helper analysis.
    # Maps module path -> list of variable names to import.
    # Used by prepare_closure_vars() to make module constants available during rule analysis.
    # Example: {'worlds.mm2.rules': ['robot_masters', 'weapons_to_name']}
    CLOSURE_VAR_IMPORTS: Dict[str, List[str]] = {}

    # Whether to automatically export discovered helpers as definitions
    # When False (default), only whitelisted helpers are exported
    # When True, discovered helpers are exported (minus blacklist)
    # Games must explicitly set this to True to enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS: bool = False

    # Whether to auto-discover and export all simple region attributes
    # When False (default), only dynamically_added is exported
    # When True, all simple attributes (bool, int, float, str) are exported
    AUTO_DISCOVER_REGION_ATTRIBUTES: bool = True

    # Whether to auto-discover and export all simple location attributes
    # When False (default), no attributes are exported
    # When True, all simple attributes (bool, int, float, str) are exported
    AUTO_DISCOVER_LOCATION_ATTRIBUTES: bool = True

    # Whether to auto-discover and export all simple world attributes
    # When False (default), only explicitly defined WORLD_ATTRIBUTES are exported
    # When True, all simple attributes (bool, int, float, str) on the world instance are exported
    AUTO_DISCOVER_WORLD_ATTRIBUTES: bool = True

    # Whether the analyzer should process if-statements with multiple statements in the body
    # When False (default), only simple if-statements with a single statement are handled
    # When True, complex if-statements with multiple statements are combined into compound conditions
    PROCESS_MULTISTATEMENT_IF_BODIES: bool = True

    # Whether the analyzer should recursively analyze closure variable function calls
    # When False (default), closure variables are converted to helper calls without recursive analysis
    # When True, closure variables are recursively analyzed and inlined for complex rule logic
    RECURSIVELY_ANALYZE_CLOSURES: bool = True

    # Whether to export Choice options as numeric values or string keys
    # When True (default), Choice options are exported as integers (e.g., 0, 1, 2)
    #   - Enables proper ordered comparisons (< > <= >=) in JavaScript
    #   - String constants in helpers are normalized to numeric via normalize_helper_option_constants
    # When False, Choice options are exported as string keys (e.g., "easy", "default")
    #   - Works for equality/membership comparisons only
    #   - Ordered comparisons will use JavaScript string ordering (alphabetical, not semantic)
    EXPORT_CHOICE_OPTIONS_AS_NUMERIC: bool = True

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
    # These are applied in get_world_data and can be overridden in subclasses

    # When True, method calls on 'self' or 'world' (e.g., self.quest_points(), world.quest_points())
    # are automatically converted to helper function calls in expand_rule.
    # This is useful for games that define methods on the World class that are used in rules.
    CONVERT_WORLD_METHODS_TO_HELPERS: bool = True

    # Set of object names whose method calls/attribute access should be converted to helper calls.
    # When a function_call like obj.method() is found where obj is one of these names,
    # it's converted to a helper call with name='method'.
    # Default includes 'self' and 'world' for World class methods.
    # Games like Yoshi's Island can extend this to include 'logic', 'bosses', etc.
    HELPER_OBJECT_NAMES: Set[str] = {'self', 'world'}

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
    AUTO_PRESERVE_LARGE_HELPERS: bool = True

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

    # Mapping of parameter/variable names used in inlined functions to their
    # corresponding setting names. Applied during expand_rule for 'name' type rules.
    # Example: {'ow_boss_req': 'ow_boss_requirement'}
    NAME_REMAPPING: Dict[str, str] = {}

    # Set of setting names that should be converted from 'name' type to 'setting_value' type.
    # This ensures they are looked up via getSetting which checks the options.* path.
    # Example: {'open_world', 'ow_boss_requirement'}
    SETTINGS_TO_CONVERT: Set[str] = set()

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

    def register_helpers_from_rule(self, rule: Dict[str, Any]) -> None:
        """
        Recursively register all helpers referenced in a rule structure.

        This is useful for games that construct rule structures manually
        (e.g., from JSON data or hardcoded dictionaries) and need to ensure
        all referenced helpers are discovered for export.

        Walks through the rule tree and calls register_helper_usage() for
        any helper nodes found.

        Args:
            rule: The rule dictionary to scan for helper references
        """
        if rule is None or not isinstance(rule, dict):
            return

        rule_type = rule.get('type')
        if rule_type == 'helper':
            helper_name = rule.get('name')
            if helper_name:
                self.register_helper_usage(helper_name)
        elif rule_type in ('and', 'or'):
            for condition in rule.get('conditions', []):
                self.register_helpers_from_rule(condition)
        elif rule_type == 'not':
            self.register_helpers_from_rule(rule.get('condition'))
        elif rule_type == 'conditional':
            self.register_helpers_from_rule(rule.get('test'))
            self.register_helpers_from_rule(rule.get('if_true'))
            self.register_helpers_from_rule(rule.get('if_false'))

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

    def prepare_closure_vars(self, rule_func: Callable, closure_vars: Dict[str, Any]) -> Dict[str, Any]:
        """Inject module-level variables into closure_vars for helper analysis.

        This default implementation uses CLOSURE_VAR_IMPORTS to automatically
        inject module-level constants that are needed during rule analysis.

        Games can override this method for more complex injection logic, such as
        processing Region objects or handling dynamic module discovery.

        Args:
            rule_func: The rule function being analyzed (unused in base implementation)
            closure_vars: The existing closure variables dict

        Returns:
            Enhanced closure_vars dict with injected module-level variables
        """
        if not self.CLOSURE_VAR_IMPORTS:
            return closure_vars

        enhanced_closure = closure_vars.copy()

        for module_path, var_names in self.CLOSURE_VAR_IMPORTS.items():
            try:
                module = importlib.import_module(module_path)
                for var_name in var_names:
                    if var_name not in enhanced_closure:
                        if hasattr(module, var_name):
                            enhanced_closure[var_name] = getattr(module, var_name)
                            logger.debug(f"Injected {var_name} from {module_path} into closure_vars")
                        else:
                            logger.warning(f"Variable {var_name} not found in module {module_path}")
            except ImportError as e:
                logger.warning(f"Could not import module {module_path} for closure injection: {e}")

        return enhanced_closure

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

        # Handle helper type in AST format: {'type': 'helper', 'name': 'helper_name', 'args': [...]}
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule['name'], rule.get('args', []))
            if expanded:
                return self.expand_rule(expanded, _depth + 1)

        # Handle helper type in RB format: {'rule': 'helper_name', '_original_ast_type': 'helper', 'args': [...]}
        if rule.get('_original_ast_type') == 'helper':
            helper_name = rule.get('rule', '')
            if helper_name:
                expanded = self.expand_helper(helper_name, rule.get('args', []))
                if expanded:
                    return self.expand_rule(expanded, _depth + 1)

        # Recursively expand children of compound rules
        return self._recursively_expand_rule_children(rule, _depth)

    def _recursively_expand_rule_children(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """
        Recursively expand children of compound rules (and, or, not, conditional).

        This utility method can be called by game-specific expand_rule implementations
        to handle standard recursion after doing game-specific transformations.

        Also handles:
        - f_string conversion using resolve_f_string
        - Name remapping using NAME_REMAPPING
        - Settings conversion using SETTINGS_TO_CONVERT
        - Recursive processing of item_check items

        Args:
            rule: The rule dictionary to process
            _depth: Current recursion depth (for cycle detection)

        Returns:
            The rule with children recursively expanded
        """
        if not rule or not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Handle f_string conversion (AST format: type='f_string')
        if rule_type == 'f_string':
            resolved = self.resolve_f_string(rule)
            if resolved is not None:
                return {'type': 'constant', 'value': resolved}
            # Fallback: return original rule if we can't resolve
            return rule

        # Handle f_string conversion (RB format: rule='AST_f_string' with args containing f_string data)
        # RB format has args with 'parts', 'all_simple', 'value', '_original_ast_type': 'f_string'
        if rule.get('rule') == 'AST_f_string':
            args = rule.get('args', {})
            # If all_simple is true and value is already resolved, use it directly
            if args.get('all_simple') and 'value' in args:
                return {'type': 'constant', 'value': args['value']}
            # Otherwise try to resolve from parts
            if args.get('_original_ast_type') == 'f_string':
                resolved = self.resolve_f_string(args)
                if resolved is not None:
                    return {'type': 'constant', 'value': resolved}
            return rule

        # Handle name remapping and settings conversion
        if rule_type == 'name':
            name = rule.get('name', '')
            # First apply any name remapping
            if name in self.NAME_REMAPPING:
                name = self.NAME_REMAPPING[name]
                logger.debug(f"Remapped name '{rule.get('name')}' to '{name}'")

            # Convert known setting names to setting_value type
            if name in self.SETTINGS_TO_CONVERT:
                logger.debug(f"Converting name '{name}' to setting_value type")
                return {'type': 'setting_value', 'setting': name}

            # Otherwise just update the name and return
            rule['name'] = name
            return rule

        # Handle item_check with dict item names (e.g., f_string items)
        # AST format: type='item_check'
        if rule_type == 'item_check':
            if isinstance(rule.get('item'), dict):
                rule['item'] = self.expand_rule(rule['item'], _depth + 1)
            if isinstance(rule.get('count'), dict):
                rule['count'] = self.expand_rule(rule['count'], _depth + 1)

        # Handle item_check in RB format: rule='ItemCheck' with args containing item/count
        if rule.get('rule') == 'ItemCheck':
            args = rule.get('args', {})
            if isinstance(args.get('item'), dict):
                args['item'] = self.expand_rule(args['item'], _depth + 1)
            if isinstance(args.get('count'), dict):
                args['count'] = self.expand_rule(args['count'], _depth + 1)

        # Handle compound rules
        if rule_type in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', [])]

        elif rule_type == 'not':
            rule['condition'] = self.expand_rule(rule.get('condition'), _depth + 1)

        elif rule_type == 'conditional':
            rule['test'] = self.expand_rule(rule.get('test'), _depth + 1)
            rule['if_true'] = self.expand_rule(rule.get('if_true'), _depth + 1)
            rule['if_false'] = self.expand_rule(rule.get('if_false'), _depth + 1)

        # Handle compare operations (expand left/right recursively)
        elif rule_type == 'compare':
            if 'left' in rule:
                rule['left'] = self.expand_rule(rule['left'], _depth + 1)
            if 'right' in rule:
                rule['right'] = self.expand_rule(rule['right'], _depth + 1)

        # Handle state_method (expand args recursively)
        elif rule_type == 'state_method':
            # Check for has_all(set([items])) pattern and simplify to item checks
            if rule.get('method') == 'has_all':
                simplified = self._simplify_has_all(rule)
                if simplified != rule:
                    return simplified

            if 'args' in rule:
                rule['args'] = [
                    self.expand_rule(arg, _depth + 1) if isinstance(arg, dict) else arg
                    for arg in rule.get('args', [])
                ]

        # Handle function_call - convert obj.method() to helper calls for configured objects
        # This allows games to define methods on the World class (or logic objects) that are used as rules
        elif rule_type == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                method_name = function.get('attr')

                # Pattern 1: Convert configured object method calls to helper functions
                if self.CONVERT_WORLD_METHODS_TO_HELPERS:
                    if obj.get('type') == 'name' and obj.get('name') in self.HELPER_OBJECT_NAMES:
                        logger.debug(f"Converting {obj.get('name')}.{method_name}() to helper function")
                        return {
                            'type': 'helper',
                            'name': method_name,
                            'args': []
                        }

                # Pattern 2: state.multiworld.get_location(loc, player).can_reach(state) -> location_check
                if method_name == 'can_reach':
                    if (obj.get('type') == 'function_call' and
                        obj.get('function', {}).get('type') == 'attribute' and
                        obj.get('function', {}).get('attr') == 'get_location'):
                        get_loc_func = obj.get('function', {})
                        multiworld_obj = get_loc_func.get('object', {})
                        if (multiworld_obj.get('type') == 'attribute' and
                            multiworld_obj.get('attr') == 'multiworld' and
                            multiworld_obj.get('object', {}).get('type') == 'name' and
                            multiworld_obj.get('object', {}).get('name') == 'state'):
                            location_args = obj.get('args', [])
                            if location_args:
                                logger.debug(f"Converting get_location().can_reach() to location_check")
                                return {'type': 'location_check', 'location': location_args[0]}

        # Handle option access patterns and resolve to constant values
        # This handles patterns like:
        # - self.options.X -> constant value
        # - state.multiworld.worlds[player].options.X -> constant value
        elif rule_type == 'attribute':
            # First apply NAME_REMAPPING to the object if it's a name node
            # This handles patterns like flooded.something -> precalculated_weights.something
            obj = rule.get('object', {})
            if isinstance(obj, dict) and obj.get('type') == 'name':
                original_name = obj.get('name', '')
                if original_name in self.NAME_REMAPPING:
                    new_name = self.NAME_REMAPPING[original_name]
                    logger.debug(f"Remapped attribute object name '{original_name}' to '{new_name}'")
                    obj['name'] = new_name

            # Check for helper object attribute access (e.g., logic.method_name without parentheses)
            # This handles cases where Python code accessed a method without calling it
            # NOTE: Excludes 'self' and 'world' since their attribute access is usually settings,
            # not helper methods. Only convert attribute access for game-specific logic objects.
            obj_name = obj.get('name') if obj.get('type') == 'name' else None
            if obj_name and obj_name in self.HELPER_OBJECT_NAMES and obj_name not in {'self', 'world'}:
                attr_name = rule.get('attr')
                logger.debug(f"Converting {obj_name}.{attr_name} attribute access to helper function")
                return {
                    'type': 'helper',
                    'name': attr_name,
                    'args': []
                }

            # Try to resolve as option access
            resolved = self._resolve_option_access(rule)
            if resolved is not None:
                return resolved

        # Handle block type (contains statements array)
        elif rule_type == 'block':
            if 'statements' in rule:
                rule['statements'] = [
                    self.expand_rule(stmt, _depth + 1) if isinstance(stmt, dict) else stmt
                    for stmt in rule.get('statements', [])
                ]

        # Handle assign type (contains value)
        elif rule_type == 'assign':
            if 'value' in rule and isinstance(rule['value'], dict):
                rule['value'] = self.expand_rule(rule['value'], _depth + 1)

        # Handle return type (contains value)
        elif rule_type == 'return':
            if 'value' in rule and isinstance(rule['value'], dict):
                rule['value'] = self.expand_rule(rule['value'], _depth + 1)

        # Handle if_statement type (contains test, body, orelse)
        elif rule_type == 'if_statement':
            if 'test' in rule and isinstance(rule['test'], dict):
                rule['test'] = self.expand_rule(rule['test'], _depth + 1)
            if 'body' in rule:
                rule['body'] = [
                    self.expand_rule(stmt, _depth + 1) if isinstance(stmt, dict) else stmt
                    for stmt in rule.get('body', [])
                ]
            if 'orelse' in rule:
                rule['orelse'] = [
                    self.expand_rule(stmt, _depth + 1) if isinstance(stmt, dict) else stmt
                    for stmt in rule.get('orelse', [])
                ]

        # Handle subscript type (contains value and slice)
        elif rule_type == 'subscript':
            if 'value' in rule and isinstance(rule['value'], dict):
                rule['value'] = self.expand_rule(rule['value'], _depth + 1)
            if 'slice' in rule and isinstance(rule['slice'], dict):
                rule['slice'] = self.expand_rule(rule['slice'], _depth + 1)

        # Handle list/set types (contain value array)
        elif rule_type in ['list', 'set']:
            if 'value' in rule and isinstance(rule['value'], list):
                rule['value'] = [
                    self.expand_rule(item, _depth + 1) if isinstance(item, dict) else item
                    for item in rule['value']
                ]

        # Handle sum_of/any_of/all_of types (contain iterable and optionally condition)
        elif rule_type in ['sum_of', 'any_of', 'all_of']:
            if 'iterable' in rule and isinstance(rule['iterable'], dict):
                rule['iterable'] = self.expand_rule(rule['iterable'], _depth + 1)
            if 'element_rule' in rule and isinstance(rule['element_rule'], dict):
                rule['element_rule'] = self.expand_rule(rule['element_rule'], _depth + 1)
            if 'condition' in rule and isinstance(rule['condition'], dict):
                rule['condition'] = self.expand_rule(rule['condition'], _depth + 1)

        # Handle sum type (contains iterable)
        elif rule_type == 'sum':
            if 'iterable' in rule and isinstance(rule['iterable'], dict):
                rule['iterable'] = self.expand_rule(rule['iterable'], _depth + 1)

        # Handle binary_op type (contains left and right)
        elif rule_type == 'binary_op':
            if 'left' in rule and isinstance(rule['left'], dict):
                rule['left'] = self.expand_rule(rule['left'], _depth + 1)
            if 'right' in rule and isinstance(rule['right'], dict):
                rule['right'] = self.expand_rule(rule['right'], _depth + 1)

        # Handle comparison type (alias for compare, contains left and right)
        elif rule_type == 'comparison':
            if 'left' in rule and isinstance(rule['left'], dict):
                rule['left'] = self.expand_rule(rule['left'], _depth + 1)
            if 'right' in rule and isinstance(rule['right'], dict):
                rule['right'] = self.expand_rule(rule['right'], _depth + 1)

        # Handle constant type where value is a dict containing rule structures
        # This handles cases where Python code defines dicts with rule objects as values
        elif rule_type == 'constant':
            value = rule.get('value')
            if isinstance(value, dict):
                # Recursively expand any rule structures in the dict values
                expanded_value = self._expand_dict_values(value, _depth + 1)
                rule['value'] = expanded_value
            elif isinstance(value, list):
                # Recursively expand any rule structures in the list
                rule['value'] = [
                    self._expand_dict_values(item, _depth + 1) if isinstance(item, dict) else item
                    for item in value
                ]

        return rule

    def _expand_dict_values(self, d: Dict[str, Any], _depth: int) -> Dict[str, Any]:
        """Recursively expand rule structures in a dict.

        This handles constant dicts that contain rule structures as values.
        """
        result = {}
        for key, value in d.items():
            if isinstance(value, dict):
                # Check if this is a rule structure (has 'type' key)
                if 'type' in value:
                    result[key] = self.expand_rule(value, _depth)
                else:
                    # Recurse into nested dicts
                    result[key] = self._expand_dict_values(value, _depth)
            elif isinstance(value, list):
                result[key] = [
                    self.expand_rule(item, _depth) if isinstance(item, dict) and 'type' in item
                    else (self._expand_dict_values(item, _depth) if isinstance(item, dict) else item)
                    for item in value
                ]
            else:
                result[key] = value
        return result

    def _resolve_option_access(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Resolve option access patterns to constant values.

        Handles patterns like:
        - self.options.X -> constant value
        - state.multiworld.worlds[player].options.X -> constant value

        Args:
            rule: An attribute type rule node

        Returns:
            A constant rule node if the option was resolved, None otherwise
        """
        if rule.get('type') != 'attribute':
            return None

        option_name = rule.get('attr')
        obj = rule.get('object', {})

        # Pattern 1: self.options.X or world.options.X
        if (obj.get('type') == 'attribute' and
            obj.get('attr') == 'options' and
            obj.get('object', {}).get('type') == 'name' and
            obj.get('object', {}).get('name') in ['self', 'world']):

            world = self.world
            if world and hasattr(world, 'options'):
                option_value = getattr(world.options, option_name, None)
                if option_value is not None:
                    value = getattr(option_value, 'value', option_value)
                    logger.debug(f"Resolved self.options.{option_name} to constant: {value}")
                    return {'type': 'constant', 'value': value}

        # Pattern 2: state.multiworld.worlds[player].options.X
        if (obj.get('type') == 'attribute' and
            obj.get('attr') == 'options' and
            obj.get('object', {}).get('type') == 'subscript'):

            world = self.world
            if world and hasattr(world, 'options'):
                option_value = getattr(world.options, option_name, None)
                if option_value is not None:
                    value = getattr(option_value, 'value', option_value)
                    logger.debug(f"Resolved state.multiworld.worlds[player].options.{option_name} to constant: {value}")
                    return {'type': 'constant', 'value': value}

        return None
        
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
        # Convert location_item_name calls to placement_lookup rule type
        # This is a generic function from worlds/generic/Rules.py used by multiple games
        # location_item_name(state, location_name, player) -> (item_name, player) tuple
        if func_name == 'location_item_name':
            logging.debug(f"BaseGameExportHandler: Converting {func_name} to placement_lookup rule")
            # location_item_name takes (state, location_name, player) - we only need location_name
            if processed_args:
                return {
                    'type': 'placement_lookup',
                    'location': processed_args[0]  # First arg is location name
                }
            else:
                logging.warning(f"BaseGameExportHandler: location_item_name called without location argument")
                return None

        # Convert item_name_in_location_names calls to placement_search rule type
        # This is a generic function from worlds/generic/Rules.py used by multiple games
        # item_name_in_location_names(state, item, player, location_pairs) -> bool
        # After state/player filtering, processed_args contains: [item, location_pairs]
        if func_name == 'item_name_in_location_names':
            logging.debug(f"BaseGameExportHandler: Converting {func_name} to placement_search rule")
            if len(processed_args) >= 2:
                item_arg = processed_args[0]
                locations_arg = processed_args[1]
                # Player is filtered out; use player 1 for single-player exports
                return {
                    'type': 'placement_search',
                    'item': item_arg,
                    'player': {'type': 'constant', 'value': 1},
                    'locations': locations_arg
                }
            else:
                logging.warning(f"BaseGameExportHandler: item_name_in_location_names missing arguments: {processed_args}")
                return None

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

        Note: Helpers listed in HELPERS_TO_EXPORT_BLACKLIST are automatically preserved,
        since complex helpers that can't be exported also shouldn't be inlined.

        Args:
            func_name: The name of the function being analyzed

        Returns:
            True if the function should be preserved as a helper, False otherwise
        """
        # Check the class attribute for preserved helpers
        if func_name in self.HELPERS_TO_PRESERVE:
            return True

        # Blacklisted helpers are automatically preserved - if a helper is too complex
        # to export as a definition, it shouldn't be inlined during analysis either
        if func_name in self.HELPERS_TO_EXPORT_BLACKLIST:
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

        Games can either override this method or set PROCESS_MULTISTATEMENT_IF_BODIES = True.

        Returns:
            True if multi-statement if-bodies should be processed, False otherwise
        """
        return self.PROCESS_MULTISTATEMENT_IF_BODIES

    def should_recursively_analyze_closures(self) -> bool:
        """
        Check if the analyzer should recursively analyze closure variable function calls.

        By default, closure variables are converted to helper calls without recursive analysis.
        Some games (like Mario Land 2) need closure variables to be recursively analyzed and
        inlined to properly export complex rule logic.

        Games can either override this method or set RECURSIVELY_ANALYZE_CLOSURES = True.

        Returns:
            True if closure variables should be recursively analyzed, False otherwise
        """
        return self.RECURSIVELY_ANALYZE_CLOSURES

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
        
    def get_exporter_settings(self) -> Dict[str, Any]:
        """Get exporter-specific settings (not part of the Archipelago world).

        These settings control how the frontend processes the exported data.
        """
        exporter_settings = {}

        # rule_format: Version metadata for the exported rules
        exporter_settings['rule_format'] = {"version": "1.0"}

        # assume_bidirectional_exits: Whether region connections are bidirectional by default
        exporter_settings['assume_bidirectional_exits'] = self.ASSUME_BIDIRECTIONAL_EXITS

        # use_resolved_items: When false (default), eventProcessor uses only base_items from sphere log
        # When true, eventProcessor uses resolved_items (e.g., for games with complex event items)
        exporter_settings['use_resolved_items'] = self.USE_RESOLVED_ITEMS

        # add_sphere_items_upfront: When true, adds items at the start of each sphere before accessibility checks
        if self.ADD_SPHERE_ITEMS_UPFRONT:
            exporter_settings['add_sphere_items_upfront'] = True

        # use_auto_indirect_conditions: When true, use auto sweep for indirect region dependencies
        if self.USE_AUTO_INDIRECT_CONDITIONS:
            exporter_settings['use_auto_indirect_conditions'] = True

        return exporter_settings

    def get_world_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extracts world data for export.

        This mirrors Archipelago's world structure:
        - world.game -> world_data['game']
        - world.options.X -> world_data['options']['X']
        - world.X (runtime attributes) -> world_data['X']

        Note: Exporter-specific settings are now in get_exporter_settings().
        """
        # Store world reference for use in expand_rule (option resolution)
        self.world = world

        world_data = {'game': multiworld.game[player]}

        # Common multiworld settings (like accessibility)
        common_settings = [
            'accessibility',
        ]
        for setting in common_settings:
            if hasattr(multiworld, setting) and player in getattr(multiworld, setting, {}):
                value = getattr(multiworld, setting)[player]
                world_data[setting] = getattr(value, 'value', value)

        if hasattr(multiworld, 'mode') and player in multiworld.mode:
            mode_val = multiworld.mode[player]
            world_data['mode'] = getattr(mode_val, 'value', str(mode_val))

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
                        from Options import Toggle, Choice
                        value = option.value
                        # Convert Toggle int values (0/1) to actual booleans
                        if isinstance(option, Toggle):
                            value = bool(value)
                        # For Choice options, check EXPORT_CHOICE_OPTIONS_AS_NUMERIC flag
                        elif isinstance(option, Choice):
                            if self.EXPORT_CHOICE_OPTIONS_AS_NUMERIC:
                                # Export as integer for proper ordered comparisons
                                value = option.value
                            else:
                                # Export as string key for equality comparisons
                                value = option.current_key
                        # Only export simple types (int, bool, str, list, dict)
                        if isinstance(value, (int, bool, str, list, dict)):
                            options_dict[option_name] = value
                        elif isinstance(value, set):
                            options_dict[option_name] = sorted(value)
                except Exception:
                    pass
            if options_dict:
                world_data['options'] = options_dict

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
                world_data['option_definitions'] = option_definitions

        # Process EXPORTED_OPTIONS - simple option value extractions at top level
        if self.EXPORTED_OPTIONS:
            for option_name in self.EXPORTED_OPTIONS:
                try:
                    if hasattr(world, 'options') and hasattr(world.options, option_name):
                        option = getattr(world.options, option_name)
                        if hasattr(option, 'value'):
                            world_data[option_name] = option.value
                except Exception as e:
                    logger.warning(f"Failed to export option '{option_name}': {e}")

        # Merge in world attributes (runtime-computed values)
        # These are values like treasure_hunt_required, difficulty_requirements, etc.
        world_attributes = self.get_world_attributes(world, multiworld, player)
        for attr_name, attr_value in world_attributes.items():
            if attr_name not in world_data:  # Don't override existing values
                world_data[attr_name] = attr_value

        # Export base_id if available (used for ID allocation)
        # This mirrors Archipelago's world.base_id
        if hasattr(world, 'base_id') and world.base_id is not None:
            world_data['base_id'] = world.base_id

        # Export world class docstring if available
        # This provides a description of the world/game
        world_class = world.__class__
        if world_class.__doc__:
            # Clean up the docstring (strip leading/trailing whitespace from each line)
            docstring = world_class.__doc__
            # Normalize whitespace
            lines = [line.strip() for line in docstring.strip().split('\n')]
            world_data['world_description'] = '\n'.join(lines)

        # Export fill_slot_data return value if available
        # This captures the data the world sends to the client
        if hasattr(world, 'fill_slot_data') and callable(world.fill_slot_data):
            try:
                slot_data = world.fill_slot_data()
                if slot_data and isinstance(slot_data, dict):
                    world_data['slot_data'] = slot_data
            except Exception as e:
                logger.debug(f"Could not call fill_slot_data for {world.game}: {e}")

        # Export WebWorld metadata if available
        # This mirrors Archipelago's world.web structure
        if hasattr(world, 'web') and world.web:
            web = world.web
            web_data = {}
            # Theme
            if hasattr(web, 'theme') and web.theme:
                web_data['theme'] = web.theme
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
                    web_data['tutorials'] = tutorials_data
            if web_data:
                world_data['web'] = web_data

        return world_data

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

        def get_serializable_value(value: Any, depth: int = 0) -> Any:
            """Convert a value to a JSON-serializable form, or return None if not possible.

            Args:
                value: The value to serialize
                depth: Current recursion depth (to prevent infinite recursion)
            """
            # Prevent infinite recursion (5 levels: list -> object -> list -> dict -> value)
            if depth > 5:
                return None

            # Check bool before int (bool is subclass of int)
            if isinstance(value, bool):
                return value
            elif isinstance(value, (int, float, str)):
                return value
            elif isinstance(value, enum.Enum):
                # For enums, prefer .value (usually the serializable form)
                return value.value if hasattr(value, 'value') else str(value)
            elif isinstance(value, dict):
                # Serialize dicts recursively
                result = {}
                for k, v in value.items():
                    # Convert key to string (handle enum keys like EraType)
                    if isinstance(k, str):
                        key_str = k
                    elif isinstance(k, enum.Enum):
                        key_str = k.value if hasattr(k, 'value') else str(k)
                    else:
                        continue  # Skip other non-string keys
                    converted = get_serializable_value(v, depth + 1)
                    if converted is not None:
                        result[key_str] = converted
                return result if result else None
            elif isinstance(value, (list, tuple)):
                # Namedtuples should be handled by extract_nested_attributes, not as lists
                if hasattr(value, '_fields'):
                    return None
                result = []
                for v in value:
                    # None elements are valid in JSON (as null)
                    if v is None:
                        result.append(None)
                        continue
                    converted = get_serializable_value(v, depth + 1)
                    if converted is None:
                        # Try extracting as a complex object
                        converted = extract_nested_attributes(v, depth + 1)
                    if converted is None:
                        return None  # Can't serialize this list
                    result.append(converted)
                return result
            # For objects with a 'name' attribute (like Region, Location), just use the name
            # Use try/except because some objects (like LADXR Settings) have custom __getattr__
            # that raises KeyError for unknown attributes instead of returning AttributeError
            try:
                if hasattr(value, 'name') and isinstance(getattr(value, 'name', None), str):
                    return value.name
            except (KeyError, TypeError):
                pass  # Attribute lookup failed, object cannot be serialized by name
            return None

        def extract_nested_attributes(obj: Any, depth: int = 0) -> Optional[Dict[str, Any]]:
            """Extract simple attributes from an object as a nested dict.

            Args:
                obj: The object to extract attributes from
                depth: Current recursion depth (to prevent infinite recursion)
            """
            if obj is None:
                return None

            # Prevent infinite recursion (5 levels: list -> object -> list -> dict -> value)
            if depth > 5:
                return None

            result = {}

            # Check for namedtuple FIRST (before tuple check, since namedtuples are tuples)
            # Use try/except because some objects (like LADXR Settings) have custom __getattr__
            # that raises KeyError for unknown attributes instead of returning AttributeError
            try:
                is_namedtuple = hasattr(obj, '_fields')
            except (KeyError, TypeError):
                is_namedtuple = False
            if is_namedtuple:
                for field in obj._fields:
                    if field.startswith('_'):
                        continue
                    try:
                        val = getattr(obj, field, None)
                        if val is None:
                            continue
                        serialized = get_serializable_value(val, depth + 1)
                        if serialized is not None:
                            result[field] = serialized
                    except Exception:
                        pass
                return result if result else None

            # Skip if it's a simple type (already handled by get_serializable_value)
            if isinstance(obj, (bool, int, float, str, list, tuple, dict, enum.Enum)):
                return None
            # Skip common complex types that shouldn't be extracted
            if isinstance(obj, (type, collections.abc.Callable)):
                return None

            # Try to get attributes from __dict__ or __slots__
            # Wrap in try/except in case of custom __getattr__ that raises exceptions
            attrs_to_check = []
            try:
                if hasattr(obj, '__dict__'):
                    attrs_to_check = list(obj.__dict__.keys())
                elif hasattr(obj, '__slots__'):
                    attrs_to_check = list(obj.__slots__)
            except (KeyError, TypeError, AttributeError):
                pass

            for attr in attrs_to_check:
                if attr.startswith('_'):
                    continue
                try:
                    val = getattr(obj, attr, None)
                    if val is None:
                        continue
                    serialized = get_serializable_value(val, depth + 1)
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

        # Auto-discover world attributes if enabled
        if self.AUTO_DISCOVER_WORLD_ATTRIBUTES:
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
        Get game-specific information for the frontend.

        This method is for game-specific custom data and accumulator patterns.
        Game-specific expanders can override this to add custom data.

        Note: Base fields have been moved to other methods:
        - name (game) -> world[player].game in get_world_data()
        - slot_data, base_id, world_description, web -> get_world_data()
        - rule_format -> get_exporter_settings()

        Returns:
            A dictionary with game-specific information for the frontend.
        """
        game_info = {}

        # Check if the world defines accumulator rules (for state counter patterns like coins)
        # This allows generated worlds from AST format to export accumulator rules
        if hasattr(world, 'accumulator_rules') and world.accumulator_rules:
            game_info['accumulator_rules'] = world.accumulator_rules

        # Check if the world defines initial values for prog_items accumulators
        if hasattr(world, 'prog_items_init') and world.prog_items_init:
            game_info['prog_items_init'] = world.prog_items_init

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
        
    def cleanup_world_data(self, world_data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform game-specific cleanup/mapping on exported world data.

        Converts numeric option values to string names to match how Python
        helpers compare against option values.
        """
        common_setting_mappings = {
            'accessibility': {0: 'items', 1: 'locations', 2: 'none'},
        }
        for setting_name, value in world_data.items():
            if setting_name in common_setting_mappings and isinstance(value, int):
                if value in common_setting_mappings[setting_name]:
                    world_data[setting_name] = common_setting_mappings[setting_name][value]
                else:
                    world_data[setting_name] = f"unknown_{value}"
        return world_data

    # Keep cleanup_settings as an alias for backwards compatibility
    def cleanup_settings(self, settings_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Deprecated: Use cleanup_world_data instead."""
        return self.cleanup_world_data(settings_dict)

    def get_region_attributes(self, region) -> Dict[str, Any]:
        """
        Get region attributes to include in the export.

        When AUTO_DISCOVER_REGION_ATTRIBUTES is True, auto-discovers simple attributes
        (bool, int, float, str) from the region object, including class-level annotated
        attributes with defaults.

        When False (default), only exports dynamically_added if set.

        Args:
            region: The region object being processed

        Returns:
            A dictionary of attributes to add to the region data
        """
        attributes = {}

        # Always check for dynamically_added attribute
        if getattr(region, 'dynamically_added', False):
            attributes['dynamically_added'] = True

        # Only do full auto-discovery if enabled
        if not self.AUTO_DISCOVER_REGION_ATTRIBUTES:
            return attributes

        # Attributes to skip (base Region class infrastructure)
        skip_attrs = {
            'name', 'player', 'multiworld',  # Already exported or known
            'entrances', 'exits', 'locations',  # Complex objects, exported separately
            'entrance_type',  # Class variable
            'dynamically_added',  # Already handled above
        }

        # Collect attributes to check from multiple sources
        attrs_to_check = set()

        # Instance attributes (set on self)
        if hasattr(region, '__dict__'):
            attrs_to_check.update(region.__dict__.keys())

        # Class-level annotated attributes (e.g., is_light_world: bool = False)
        for cls in type(region).__mro__:
            if hasattr(cls, '__annotations__'):
                attrs_to_check.update(cls.__annotations__.keys())

        for attr_name in sorted(attrs_to_check):
            if attr_name.startswith('_'):
                continue
            if attr_name in skip_attrs:
                continue

            try:
                value = getattr(region, attr_name, None)
                if value is None:
                    continue

                # Only export simple JSON-serializable types
                if isinstance(value, bool):
                    attributes[attr_name] = value
                elif isinstance(value, (int, float, str)):
                    attributes[attr_name] = value
            except Exception:
                pass

        return attributes

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """
        Get location attributes to include in the export.

        When AUTO_DISCOVER_LOCATION_ATTRIBUTES is True, auto-discovers simple attributes
        (bool, int, float, str) from the location object, including class-level annotated
        attributes with defaults.

        When False (default), no attributes are exported.

        Args:
            location: The location object being processed
            world: The world object for this player

        Returns:
            A dictionary of attributes to add to the location data
        """
        attributes = {}

        # Only do full auto-discovery if enabled
        if not self.AUTO_DISCOVER_LOCATION_ATTRIBUTES:
            return attributes

        # Attributes to skip (base Location class infrastructure)
        skip_attrs = {
            'name', 'player', 'game',  # Already exported or known
            'address',  # Internal implementation detail
            'parent_region',  # Complex object, exported separately
            'locked', 'show_in_spoiler', 'progress_type',  # Internal state
            'always_allow', 'access_rule', 'item_rule',  # Rules, exported separately
            'item',  # Complex object
        }

        # Collect attributes to check from multiple sources
        attrs_to_check = set()

        # Instance attributes (set on self)
        if hasattr(location, '__dict__'):
            attrs_to_check.update(location.__dict__.keys())

        # Class-level annotated attributes (e.g., some_flag: bool = False)
        for cls in type(location).__mro__:
            if hasattr(cls, '__annotations__'):
                attrs_to_check.update(cls.__annotations__.keys())

        for attr_name in sorted(attrs_to_check):
            if attr_name.startswith('_'):
                continue
            if attr_name in skip_attrs:
                continue

            try:
                value = getattr(location, attr_name, None)
                if value is None:
                    continue

                # Only export simple JSON-serializable types
                if isinstance(value, bool):
                    attributes[attr_name] = value
                elif isinstance(value, (int, float, str)):
                    attributes[attr_name] = value
            except Exception:
                pass

        return attributes

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

    def normalize_helper_option_constants(
        self,
        helper_definitions: Dict[str, Any],
        option_definitions: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Convert string constants to numeric values in helpers when compared with Choice options.

        Some games use string comparisons like `enemy_health in ("easy", "default")` in their
        rules. When we export settings as numeric values (for proper ordered comparisons),
        these string constants need to be converted to their numeric equivalents.

        This method walks through helper definitions, finds comparisons where:
        - One side is a `setting_value` for a Choice option
        - The other side contains string constants

        And converts those string constants to their numeric values using the option's name_lookup.

        Args:
            helper_definitions: The helper definitions to process
            option_definitions: The option definitions containing name_lookup for Choice options

        Returns:
            The helper definitions with string constants converted to numeric values
        """
        if not helper_definitions or not option_definitions:
            return helper_definitions

        # Build reverse lookups for all Choice options: {"easy": 0, "default": 1, ...}
        option_reverse_lookups: Dict[str, Dict[str, int]] = {}
        for option_name, option_def in option_definitions.items():
            if option_def.get('type') == 'choice' and 'name_lookup' in option_def:
                # name_lookup is {"0": "easy", "1": "default", ...}
                # We need reverse: {"easy": 0, "default": 1, ...}
                reverse = {}
                for num_str, name in option_def['name_lookup'].items():
                    try:
                        reverse[name] = int(num_str)
                    except (ValueError, TypeError):
                        pass
                if reverse:
                    option_reverse_lookups[option_name] = reverse

        if not option_reverse_lookups:
            return helper_definitions

        def convert_node(node: Any, context_option: str = None) -> Any:
            """Recursively process nodes, converting string constants when appropriate."""
            if not isinstance(node, dict):
                if isinstance(node, list):
                    return [convert_node(item, context_option) for item in node]
                return node

            node_type = node.get('type') or node.get('rule')

            # Handle comparisons - check if one side is a setting_value for a Choice option
            if node_type == 'compare':
                left = node.get('left', {})
                right = node.get('right', {})
                op = node.get('op', '')

                # Check if left is a setting_value for a Choice option
                left_option = None
                if left.get('type') == 'setting_value':
                    setting = left.get('setting', '')
                    if setting in option_reverse_lookups:
                        left_option = setting

                # Check if right is a setting_value for a Choice option
                right_option = None
                if right.get('type') == 'setting_value':
                    setting = right.get('setting', '')
                    if setting in option_reverse_lookups:
                        right_option = setting

                # Convert the other side if one side is a Choice option
                result = dict(node)
                if left_option:
                    result['right'] = convert_node(right, left_option)
                if right_option:
                    result['left'] = convert_node(left, right_option)

                # Also process any nested structures
                if not left_option and not right_option:
                    result['left'] = convert_node(left, context_option)
                    result['right'] = convert_node(right, context_option)

                return result

            # Handle constants - convert if we're in a Choice option context
            if node_type == 'constant' or node.get('rule') == 'Constant':
                value = node.get('value') if node_type == 'constant' else node.get('args', {}).get('value')
                if context_option and isinstance(value, str):
                    reverse_lookup = option_reverse_lookups.get(context_option, {})
                    if value in reverse_lookup:
                        numeric_value = reverse_lookup[value]
                        logger.debug(f"Converting string constant '{value}' to {numeric_value} for option {context_option}")
                        if node_type == 'constant':
                            return {'type': 'constant', 'value': numeric_value}
                        else:
                            return {'rule': 'Constant', 'args': {'value': numeric_value}, '_converted_from_ast': True}
                return node

            # Handle lists in comparisons (e.g., `x in ["easy", "default"]`)
            if node_type == 'list':
                if context_option:
                    new_values = []
                    for item in node.get('value', []):
                        new_values.append(convert_node(item, context_option))
                    return {'type': 'list', 'value': new_values}
                return node

            # Recursively process all dict values
            result = {}
            for key, value in node.items():
                if isinstance(value, dict):
                    result[key] = convert_node(value, context_option)
                elif isinstance(value, list):
                    result[key] = [convert_node(item, context_option) for item in value]
                else:
                    result[key] = value
            return result

        # Process all helper definitions
        return {name: convert_node(definition) for name, definition in helper_definitions.items()}

    def normalize_region_option_constants(
        self,
        regions_data: Dict[str, Any],
        option_definitions: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Convert string constants to numeric values in region access rules.

        This is the counterpart to normalize_helper_option_constants, but for
        access rules in regions (locations and exits) rather than helper definitions.

        Args:
            regions_data: The regions data containing locations and exits with access rules
            option_definitions: The option definitions containing name_lookup for Choice options

        Returns:
            The regions data with string constants converted to numeric values
        """
        if not regions_data or not option_definitions:
            return regions_data

        # Build reverse lookups for all Choice options: {"easy": 0, "default": 1, ...}
        option_reverse_lookups: Dict[str, Dict[str, int]] = {}
        for option_name, option_def in option_definitions.items():
            if option_def.get('type') == 'choice' and 'name_lookup' in option_def:
                reverse = {}
                for num_str, name in option_def['name_lookup'].items():
                    try:
                        reverse[name] = int(num_str)
                    except (ValueError, TypeError):
                        pass
                if reverse:
                    option_reverse_lookups[option_name] = reverse

        if not option_reverse_lookups:
            return regions_data

        def convert_node(node: Any, context_option: str = None) -> Any:
            """Recursively process nodes, converting string constants when appropriate."""
            if not isinstance(node, dict):
                if isinstance(node, list):
                    return [convert_node(item, context_option) for item in node]
                return node

            node_type = node.get('type') or node.get('rule')

            # Handle comparisons - check if one side is a setting_value for a Choice option
            if node_type in ('compare', 'Compare'):
                # Handle both formats: {left, right} and {args: {left, right}}
                args = node.get('args', node)
                left = args.get('left', {})
                right = args.get('right', {})

                # Check if left is a setting_value for a Choice option
                left_option = None
                left_type = left.get('type') or left.get('rule')
                if left_type in ('setting_value', 'AST_setting_value'):
                    left_args = left.get('args', left)
                    setting = left_args.get('setting', '')
                    if setting in option_reverse_lookups:
                        left_option = setting

                # Check if right is a setting_value for a Choice option
                right_option = None
                right_type = right.get('type') or right.get('rule')
                if right_type in ('setting_value', 'AST_setting_value'):
                    right_args = right.get('args', right)
                    setting = right_args.get('setting', '')
                    if setting in option_reverse_lookups:
                        right_option = setting

                # Convert the other side if one side is a Choice option
                if 'args' in node:
                    result = dict(node)
                    result['args'] = dict(args)
                    if left_option:
                        result['args']['right'] = convert_node(right, left_option)
                    if right_option:
                        result['args']['left'] = convert_node(left, right_option)
                    if not left_option and not right_option:
                        result['args']['left'] = convert_node(left, context_option)
                        result['args']['right'] = convert_node(right, context_option)
                    return result
                else:
                    result = dict(node)
                    if left_option:
                        result['right'] = convert_node(right, left_option)
                    if right_option:
                        result['left'] = convert_node(left, right_option)
                    if not left_option and not right_option:
                        result['left'] = convert_node(left, context_option)
                        result['right'] = convert_node(right, context_option)
                    return result

            # Handle constants - convert if we're in a Choice option context
            if node_type in ('constant', 'Constant'):
                if 'args' in node:
                    value = node.get('args', {}).get('value')
                else:
                    value = node.get('value')
                if context_option and isinstance(value, str):
                    reverse_lookup = option_reverse_lookups.get(context_option, {})
                    if value in reverse_lookup:
                        numeric_value = reverse_lookup[value]
                        logger.debug(f"Converting region constant '{value}' to {numeric_value} for option {context_option}")
                        if 'args' in node:
                            return {'rule': 'Constant', 'args': {'value': numeric_value}, '_converted_from_ast': True}
                        else:
                            return {'type': 'constant', 'value': numeric_value}
                return node

            # Handle lists in comparisons (e.g., `x in ["easy", "default"]`)
            if node_type == 'list':
                if context_option:
                    new_values = []
                    for item in node.get('value', []):
                        new_values.append(convert_node(item, context_option))
                    return {'type': 'list', 'value': new_values}
                return node

            # Recursively process all dict values
            result = {}
            for key, value in node.items():
                if isinstance(value, dict):
                    result[key] = convert_node(value, context_option)
                elif isinstance(value, list):
                    result[key] = [convert_node(item, context_option) for item in value]
                else:
                    result[key] = value
            return result

        # Process all regions
        result = {}
        for region_name, region_data in regions_data.items():
            if not isinstance(region_data, dict):
                result[region_name] = region_data
                continue

            new_region = dict(region_data)

            # Process location access rules
            if 'locations' in region_data:
                new_locations = []
                for loc in region_data['locations']:
                    if isinstance(loc, dict) and 'access_rule' in loc:
                        new_loc = dict(loc)
                        new_loc['access_rule'] = convert_node(loc['access_rule'])
                        new_locations.append(new_loc)
                    else:
                        new_locations.append(loc)
                new_region['locations'] = new_locations

            # Process exit access rules
            if 'exits' in region_data:
                new_exits = []
                for exit_data in region_data['exits']:
                    if isinstance(exit_data, dict) and 'access_rule' in exit_data:
                        new_exit = dict(exit_data)
                        new_exit['access_rule'] = convert_node(exit_data['access_rule'])
                        new_exits.append(new_exit)
                    else:
                        new_exits.append(exit_data)
                new_region['exits'] = new_exits

            result[region_name] = new_region

        return result

    def normalize_to_string_constants(
        self,
        data: Dict[str, Any],
        option_definitions: Dict[str, Any],
        data_type: str = 'helpers'
    ) -> Dict[str, Any]:
        """
        Convert numeric constants to string values when compared with Choice options.

        This is the reverse of normalize_helper_option_constants - used when
        EXPORT_CHOICE_OPTIONS_AS_NUMERIC is False and we need to convert numeric
        constants (from expression_resolver) back to string keys.

        Args:
            data: The data to process (helpers or regions)
            option_definitions: The option definitions containing name_lookup for Choice options
            data_type: Either 'helpers' or 'regions' to determine processing logic

        Returns:
            The data with numeric constants converted to string values
        """
        if not data or not option_definitions:
            return data

        # Build lookups for all Choice options: {0: "easy", 1: "default", ...}
        option_lookups: Dict[str, Dict[int, str]] = {}
        for option_name, option_def in option_definitions.items():
            if option_def.get('type') == 'choice' and 'name_lookup' in option_def:
                lookup = {}
                for num_str, name in option_def['name_lookup'].items():
                    try:
                        lookup[int(num_str)] = name
                    except (ValueError, TypeError):
                        pass
                if lookup:
                    option_lookups[option_name] = lookup

        if not option_lookups:
            return data

        def convert_node(node: Any, context_option: str = None) -> Any:
            """Recursively process nodes, converting numeric constants to strings."""
            if not isinstance(node, dict):
                if isinstance(node, list):
                    return [convert_node(item, context_option) for item in node]
                return node

            node_type = node.get('type') or node.get('rule')

            # Handle comparisons
            if node_type in ('compare', 'Compare'):
                args = node.get('args', node)
                left = args.get('left', {})
                right = args.get('right', {})

                left_option = None
                left_type = left.get('type') or left.get('rule')
                if left_type in ('setting_value', 'AST_setting_value'):
                    left_args = left.get('args', left)
                    setting = left_args.get('setting', '')
                    if setting in option_lookups:
                        left_option = setting

                right_option = None
                right_type = right.get('type') or right.get('rule')
                if right_type in ('setting_value', 'AST_setting_value'):
                    right_args = right.get('args', right)
                    setting = right_args.get('setting', '')
                    if setting in option_lookups:
                        right_option = setting

                if 'args' in node:
                    result = dict(node)
                    result['args'] = dict(args)
                    if left_option:
                        result['args']['right'] = convert_node(right, left_option)
                    if right_option:
                        result['args']['left'] = convert_node(left, right_option)
                    if not left_option and not right_option:
                        result['args']['left'] = convert_node(left, context_option)
                        result['args']['right'] = convert_node(right, context_option)
                    return result
                else:
                    result = dict(node)
                    if left_option:
                        result['right'] = convert_node(right, left_option)
                    if right_option:
                        result['left'] = convert_node(left, right_option)
                    if not left_option and not right_option:
                        result['left'] = convert_node(left, context_option)
                        result['right'] = convert_node(right, context_option)
                    return result

            # Handle constants - convert numeric to string if in Choice option context
            if node_type in ('constant', 'Constant'):
                if 'args' in node:
                    value = node.get('args', {}).get('value')
                else:
                    value = node.get('value')
                if context_option and isinstance(value, int):
                    lookup = option_lookups.get(context_option, {})
                    if value in lookup:
                        string_value = lookup[value]
                        logger.debug(f"Converting constant {value} to '{string_value}' for option {context_option}")
                        if 'args' in node:
                            return {'rule': 'Constant', 'args': {'value': string_value}, '_converted_from_ast': True}
                        else:
                            return {'type': 'constant', 'value': string_value}
                return node

            # Handle lists
            if node_type == 'list':
                if context_option:
                    new_values = [convert_node(item, context_option) for item in node.get('value', [])]
                    return {'type': 'list', 'value': new_values}
                return node

            # Recursively process all dict values
            result = {}
            for key, value in node.items():
                if isinstance(value, dict):
                    result[key] = convert_node(value, context_option)
                elif isinstance(value, list):
                    result[key] = [convert_node(item, context_option) for item in value]
                else:
                    result[key] = value
            return result

        if data_type == 'helpers':
            return {name: convert_node(definition) for name, definition in data.items()}
        elif data_type == 'regions':
            result = {}
            for region_name, region_data in data.items():
                if not isinstance(region_data, dict):
                    result[region_name] = region_data
                    continue

                new_region = dict(region_data)

                if 'locations' in region_data:
                    new_locations = []
                    for loc in region_data['locations']:
                        if isinstance(loc, dict) and 'access_rule' in loc:
                            new_loc = dict(loc)
                            new_loc['access_rule'] = convert_node(loc['access_rule'])
                            new_locations.append(new_loc)
                        else:
                            new_locations.append(loc)
                    new_region['locations'] = new_locations

                if 'exits' in region_data:
                    new_exits = []
                    for exit_data in region_data['exits']:
                        if isinstance(exit_data, dict) and 'access_rule' in exit_data:
                            new_exit = dict(exit_data)
                            new_exit['access_rule'] = convert_node(exit_data['access_rule'])
                            new_exits.append(new_exit)
                        else:
                            new_exits.append(exit_data)
                    new_region['exits'] = new_exits

                result[region_name] = new_region
            return result

        return data

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

    def _simplify_has_all(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Simplify state.has_all(set([items]), player) patterns to item checks.

        Converts patterns like:
          state.has_all(set(["Safety Pass"]), player)
        To:
          {"type": "item_check", "item": "Safety Pass"}

        Or for multiple items:
          state.has_all(set(["Item1", "Item2"]), player)
        To:
          {"type": "and", "conditions": [
            {"type": "item_check", "item": "Item1"},
            {"type": "item_check", "item": "Item2"}
          ]}

        This pattern is used in games like Landstalker, KH2, and Messenger.

        Args:
            rule: The state_method rule with method='has_all'

        Returns:
            Simplified rule, or the original rule if simplification isn't possible
        """
        args = rule.get('args', [])

        if not args:
            logger.debug("has_all with no args, keeping as-is")
            return rule

        first_arg = args[0]

        # Check if first arg is a set() helper call
        if isinstance(first_arg, dict) and first_arg.get('type') == 'helper' and first_arg.get('name') == 'set':
            # Extract the items from set(items)
            set_args = first_arg.get('args', [])
            if set_args:
                items_arg = set_args[0]

                # Extract the actual list of item names
                items = self._extract_items_from_constant(items_arg)

                if items is not None:
                    # Convert to item checks
                    if len(items) == 0:
                        # Empty set, always true
                        return {"type": "constant", "value": True}
                    elif len(items) == 1:
                        # Single item, simple item_check
                        return {"type": "item_check", "item": items[0]}
                    else:
                        # Multiple items, AND them together
                        return {
                            "type": "and",
                            "conditions": [
                                {"type": "item_check", "item": item}
                                for item in items
                            ]
                        }

        # Couldn't simplify, return original
        return rule

    def _extract_items_from_constant(self, arg: Any) -> Optional[List[str]]:
        """Extract list of item names from a constant value argument.

        Handles patterns like:
          {"type": "constant", "value": ["Safety Pass"]}
          {"type": "constant", "value": ["Item1", "Item2"]}
          {"type": "constant", "value": []}  (empty list)

        Args:
            arg: The argument node from the AST

        Returns:
            List of item name strings, or None if not extractable
        """
        if isinstance(arg, dict) and arg.get('type') == 'constant':
            value = arg.get('value')
            if isinstance(value, list):
                # Filter to only string items (item names)
                # Return empty list for empty value, not None
                return [item for item in value if isinstance(item, str)]

        return None