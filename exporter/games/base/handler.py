"""Base class for game-specific helper expanders.

NOTE: New games should generally inherit from GenericGameExportHandler
instead of BaseGameExportHandler directly, unless you need full control
over all export methods. GenericGameExportHandler provides intelligent
defaults for rule analysis, item data discovery, and common helper patterns.

See exporter/games/generic.py for details on the enhanced functionality.
"""

from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set
import importlib
import logging

from exporter.games.base.rule_expansion import RuleExpansionMixin
from exporter.games.base.world_data import WorldDataMixin
from exporter.games.base.helper_discovery import HelperDiscoveryMixin
from exporter.games.base.option_normalization import OptionNormalizationMixin
from exporter.games.base.utilities import (
    extract_closure_vars,
    count_rule_nodes,
    sanitize_helper_name,
)

logger = logging.getLogger(__name__)


class BaseGameExportHandler(
    RuleExpansionMixin,
    WorldDataMixin,
    HelperDiscoveryMixin,
    OptionNormalizationMixin,
):
    """Base class for game-specific export handlers.

    This class provides the core functionality for exporting Archipelago
    world data to JSON format. Game-specific handlers should inherit from
    this class (or GenericGameExportHandler) and override methods as needed.
    """

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

    # Whether to auto-discover helper modules from the world directory
    # When True, all Python files in the game's world directory are treated as potential helper modules
    # This eliminates the need to manually specify HELPER_MODULES for most games
    # The discovery only affects where helpers are searched for - it doesn't cause extra exports
    AUTO_DISCOVER_WORLD_HELPER_MODULES: bool = True

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

    # Mapping of state_method names to their replacement rule structures.
    # This allows games to declaratively replace game-specific state methods with
    # equivalent rule structures without overriding expand_rule.
    # Example: {'_my_game_setting': {'type': 'setting_value', 'setting': 'my_setting'}}
    # Replacements are applied recursively during rule expansion.
    # Manual entries here take precedence over auto-detected replacements.
    STATE_METHOD_REPLACEMENTS: Dict[str, Dict[str, Any]] = {}

    # Whether to auto-detect LogicMixin state method replacements.
    # When True, analyzes LogicMixin subclasses to detect common patterns like:
    # - return self.multiworld.worlds[player].<attr> -> setting_value
    # - return not self.multiworld.worlds[player].<attr> -> not(setting_value)
    # Manual STATE_METHOD_REPLACEMENTS always take precedence over auto-detected ones.
    AUTO_DISCOVER_LOGIC_MIXIN_REPLACEMENTS: bool = True

    # Accumulator rules for games that track progressive items (like coins).
    # Each rule is a dict with keys: pattern (regex), extract_value (bool),
    # target (accumulator name), discriminator (optional grouping key).
    # Example: [{'pattern': r'^(\d+) coins?$', 'extract_value': True, 'target': ' coins'}]
    ACCUMULATOR_RULES: List[Dict[str, Any]] = []

    # Initial values for prog_items accumulators.
    # These are used to initialize counters for games with accumulator-based rules.
    # Example: {' coins': 0, ' coins freemium': 0}
    PROG_ITEMS_INIT: Dict[str, Any] = {}

    # Mapping of self.<attr> patterns to setting configurations.
    # Used by the analyzer to convert self.attr access to setting_value rules.
    # This is useful for games where the world class stores option values in instance attributes.
    # Values can be:
    #   - str: setting name (uses numeric value)
    #   - dict: {'setting': name, 'use_current_key': True} (uses string key from name_lookup)
    # Example: {'fight_logic': {'setting': 'FightLogic', 'use_current_key': True}}
    SELF_ATTR_TO_SETTING: Dict[str, Any] = {}

    # Mapping of helper function names to their constant return values.
    # Used for helpers that always return a constant (typically True or False).
    # These are automatically expanded by expand_helper in the base class.
    # Example: {'always_true_helper': True, 'disabled_feature': False}
    CONSTANT_HELPER_EXPANSIONS: Dict[str, Any] = {}

    # Mapping of helper function names to rule type configurations.
    # Used for helpers that take a single argument and convert it to a rule type.
    # Format: {'helper_name': {'type': 'rule_type', 'field': 'field_name', 'arg_index': 0}}
    # - type: The rule type to create (location_check, can_reach, item_check, etc.)
    # - field: The field name in the rule to set (location, region, item, etc.)
    # - arg_index: Which argument to use (default 0)
    # Example: {'_can_get': {'type': 'location_check', 'field': 'location'}}
    # This expands _can_get("Location Name") to {'type': 'location_check', 'location': ...}
    HELPER_TO_RULE_MAPPINGS: Dict[str, Dict[str, Any]] = {}

    # Mapping of export names to item value extraction configuration.
    # Used to compute item->value mappings from world attributes at export time.
    # Each entry defines: 'source' (world attribute name) and 'value_extractor' (callable).
    # The value_extractor takes an item name and returns its numeric value.
    # Example: {'qp_items': {'source': 'available_QP_locations', 'value_extractor': lambda x: int(x[0])}}
    # The computed mapping is exported as world data and can be used by DICT_SUM_HELPERS.
    ITEM_VALUE_MAPPINGS: Dict[str, Dict[str, Any]] = {}

    # Mapping of helper names to the dict setting they sum over.
    # Automatically generates sum_of helpers that iterate over item->value mappings.
    # Example: {'quest_points': 'qp_items'} generates a helper that sums qp_items values
    # for items the player has.
    DICT_SUM_HELPERS: Dict[str, str] = {}

    # Configuration for auto-generating accumulator items.
    # When PROG_ITEMS_INIT is set and these are configured, the base class will:
    # 1. Create accumulator target items (e.g., " coins") from PROG_ITEMS_INIT keys
    # 2. Find items matching ACCUMULATOR_RULES patterns in locations
    # 3. Configure all matching items with these properties
    ACCUMULATOR_ITEM_GROUP: str = ''  # Group name for accumulator items (e.g., 'coins')
    ACCUMULATOR_ITEM_TYPE: str = ''   # Type for accumulator items (e.g., 'coins')
    ACCUMULATOR_TARGET_MAX_COUNT: int = 999999  # Max count for accumulator target items

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
        # Cache for worldgen detection result
        self._is_worldgen_cache: Optional[bool] = None
        # Dict of auto-discovered param_mappings from call-site analysis
        # Maps helper_name -> {param_name: slot_data_key}
        self._discovered_param_mappings: Dict[str, Dict[str, str]] = {}
        # Cache for auto-detected LogicMixin state method replacements
        self._auto_detected_replacements_cache: Optional[Dict[str, Dict[str, Any]]] = None

    # ==========================================================================
    # Helper registration methods
    # ==========================================================================

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

    def register_discovered_param_mapping(self, helper_name: str, param_mappings: Dict[str, str]) -> None:
        """
        Register auto-discovered param_mappings from call-site analysis.

        This is called by the analyzer when it detects that helper arguments
        follow patterns like world.options.X.value or world.Y, allowing automatic
        mapping of parameter names to slot_data keys.

        Args:
            helper_name: The name of the helper function
            param_mappings: Dict mapping param_name -> slot_data_key
        """
        if not hasattr(self, '_discovered_param_mappings'):
            self._discovered_param_mappings = {}

        if not param_mappings:
            return

        # Merge with existing mappings (first discovery wins for each param)
        if helper_name not in self._discovered_param_mappings:
            self._discovered_param_mappings[helper_name] = {}

        for param_name, slot_data_key in param_mappings.items():
            if param_name not in self._discovered_param_mappings[helper_name]:
                self._discovered_param_mappings[helper_name][param_name] = slot_data_key
                logger.debug(f"Discovered param_mapping: {helper_name}.{param_name} -> '{slot_data_key}'")

    def get_discovered_param_mappings(self, helper_name: str = None) -> Dict[str, Dict[str, str]]:
        """
        Return auto-discovered param_mappings.

        Args:
            helper_name: Optional - if provided, return mappings for this helper only

        Returns:
            Dict mapping helper_name -> {param_name: slot_data_key}
            If helper_name is provided, returns just that helper's mappings dict
        """
        if not hasattr(self, '_discovered_param_mappings'):
            self._discovered_param_mappings = {}

        if helper_name:
            return self._discovered_param_mappings.get(helper_name, {})
        return self._discovered_param_mappings

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
        self._discovered_param_mappings = {}

    def get_effective_state_method_replacements(self) -> Dict[str, Dict[str, Any]]:
        """Get the effective STATE_METHOD_REPLACEMENTS combining auto-detected and manual.

        This method:
        1. Auto-detects LogicMixin patterns if AUTO_DISCOVER_LOGIC_MIXIN_REPLACEMENTS is True
        2. Merges with manual STATE_METHOD_REPLACEMENTS (manual takes precedence)
        3. Caches the result for performance

        Returns:
            Dict mapping method names to their rule replacement structures
        """
        # Return cached result if available
        if self._auto_detected_replacements_cache is not None:
            return self._auto_detected_replacements_cache

        # Start with manual replacements (these take precedence)
        effective = dict(self.STATE_METHOD_REPLACEMENTS)

        # Auto-detect if enabled
        if self.AUTO_DISCOVER_LOGIC_MIXIN_REPLACEMENTS and self.world is not None:
            try:
                from exporter.games.base.logic_mixin_analyzer import discover_state_method_replacements
                auto_detected = discover_state_method_replacements(self.world, None)

                # Merge auto-detected (manual takes precedence, so add auto-detected first)
                merged = dict(auto_detected)
                merged.update(effective)
                effective = merged

                # Log what was auto-detected vs manual
                auto_only = set(auto_detected.keys()) - set(self.STATE_METHOD_REPLACEMENTS.keys())
                if auto_only:
                    logger.info(f"Auto-detected {len(auto_only)} LogicMixin replacements: {sorted(auto_only)}")

            except Exception as e:
                logger.warning(f"Error auto-detecting LogicMixin replacements: {e}")

        # Cache the result
        self._auto_detected_replacements_cache = effective
        return effective

    def is_worldgen_world(self, world=None) -> bool:
        """
        Check if this is a worldgen world (generated by world_generator).

        Worldgen worlds have their module path ending with '_worldgen'
        (e.g., 'worlds.lingo_worldgen' or 'worlds.lingo_worldgen.LingoWorld').

        Args:
            world: Optional world object to check. If not provided, uses self.world.

        Returns:
            True if this is a worldgen world, False otherwise
        """
        # Use cached result if available
        if self._is_worldgen_cache is not None:
            return self._is_worldgen_cache

        check_world = world or self.world
        if not check_world:
            return False

        module_path = type(check_world).__module__
        self._is_worldgen_cache = module_path.endswith('_worldgen') or '_worldgen.' in module_path
        return self._is_worldgen_cache

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

    # ==========================================================================
    # Closure variable methods
    # ==========================================================================

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

    # ==========================================================================
    # Static utility methods (delegated to utilities module)
    # ==========================================================================

    @staticmethod
    def _extract_closure_vars(rule_func: Callable) -> Dict[str, Any]:
        """Extract closure variables from a function."""
        return extract_closure_vars(rule_func)

    @staticmethod
    def count_rule_nodes(rule: Dict[str, Any]) -> int:
        """Count the number of nodes in a rule tree."""
        return count_rule_nodes(rule)

    @staticmethod
    def sanitize_helper_name(name: str) -> str:
        """Convert a name to a valid helper function identifier."""
        return sanitize_helper_name(name)

    # ==========================================================================
    # Hook methods (override in subclasses)
    # ==========================================================================

    def expand_helper(self, helper_name: str, args: List[Any] = None) -> Dict[str, Any]:
        """Expand a helper function into basic rule conditions.

        Override this method in game-specific handlers to provide
        game-specific helper expansions. When overriding, call
        super().expand_helper() first to handle CONSTANT_HELPER_EXPANSIONS
        and HELPER_TO_RULE_MAPPINGS.

        Args:
            helper_name: The name of the helper to expand
            args: The arguments passed to the helper

        Returns:
            A rule dictionary if the helper should be expanded, None otherwise
        """
        # Check CONSTANT_HELPER_EXPANSIONS for helpers that return constant values
        if helper_name in self.CONSTANT_HELPER_EXPANSIONS:
            value = self.CONSTANT_HELPER_EXPANSIONS[helper_name]
            return {'type': 'constant', 'value': value}

        # Check HELPER_TO_RULE_MAPPINGS for helpers that map to rule types
        if helper_name in self.HELPER_TO_RULE_MAPPINGS:
            mapping = self.HELPER_TO_RULE_MAPPINGS[helper_name]
            arg_index = mapping.get('arg_index', 0)
            if args and len(args) > arg_index:
                arg = args[arg_index]
                # Extract value if arg is a dict with 'value' key (constant node)
                if isinstance(arg, dict) and arg.get('type') == 'constant':
                    value = arg.get('value')
                elif isinstance(arg, dict):
                    # Other dict types - use as-is
                    value = arg
                else:
                    value = arg
                return {
                    'type': mapping['type'],
                    mapping['field']: {'type': 'constant', 'value': value}
                }

        return None

    def replace_name(self, name: str) -> str:
        """Replace a name with another name if needed for game-specific logic."""
        return name

    def handle_special_function_call(self, func_name: str, processed_args: list) -> Optional[dict]:
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
            logger.debug(f"BaseGameExportHandler: Converting {func_name} to placement_lookup rule")
            # location_item_name takes (state, location_name, player) - we only need location_name
            if processed_args:
                return {
                    'type': 'placement_lookup',
                    'location': processed_args[0]  # First arg is location name
                }
            else:
                logger.warning(f"BaseGameExportHandler: location_item_name called without location argument")
                return None

        # Convert item_name_in_location_names calls to placement_search rule type
        # This is a generic function from worlds/generic/Rules.py used by multiple games
        # item_name_in_location_names(state, item, player, location_pairs) -> bool
        # After state/player filtering, processed_args contains: [item, location_pairs]
        if func_name == 'item_name_in_location_names':
            logger.debug(f"BaseGameExportHandler: Converting {func_name} to placement_search rule")
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
                logger.warning(f"BaseGameExportHandler: item_name_in_location_names missing arguments: {processed_args}")
                return None

        return None

    def handle_complex_exit_rule(self, exit_name: str, exit_rule) -> Optional[Dict[str, Any]]:
        """Handle complex exit rules by extracting locations from lambda closures.

        Many games use patterns like set_region_exit_rules() which creates lambdas:
            lambda state: any(location.access_rule(state) for location in locations)
            lambda state: all(location.access_rule(state) for location in locations)

        This method extracts the locations from the lambda's closure and analyzes
        their access rules, combining them with 'or' (any) or 'and' (all).

        Args:
            exit_name: The name of the exit being processed
            exit_rule: The exit's access rule function (lambda)

        Returns:
            A rule dict combining the location access rules, or None to let
            normal analysis proceed
        """
        # Try to extract locations from the lambda's closure
        if hasattr(exit_rule, '__closure__') and exit_rule.__closure__:
            locations = None
            for cell in exit_rule.__closure__:
                try:
                    cell_contents = cell.cell_contents
                    # Check if this is a list of location objects
                    if isinstance(cell_contents, list) and len(cell_contents) > 0:
                        # Check if the first item looks like a location (has access_rule)
                        if hasattr(cell_contents[0], 'access_rule'):
                            locations = cell_contents
                            break
                except (AttributeError, ValueError):
                    continue

            # If we found locations, analyze their access rules
            if locations:
                from exporter.analyzer import analyze_rule
                location_access_rules = []
                player = getattr(self, 'player', 1)

                for location in locations:
                    if hasattr(location, 'access_rule') and location.access_rule:
                        loc_name = getattr(location, 'name', 'Unknown')
                        try:
                            # Get the raw access rule function
                            access_rule_func = location.access_rule

                            # Analyze it with the proper context
                            analyzed_rule = analyze_rule(
                                rule_func=access_rule_func,
                                game_handler=self,
                                player_context=player
                            )

                            if analyzed_rule and analyzed_rule.get('type') != 'error':
                                # Expand the rule using the game handler
                                expanded_rule = self.expand_rule(analyzed_rule)
                                if expanded_rule:
                                    location_access_rules.append(expanded_rule)
                                else:
                                    # If expansion failed, use the analyzed rule as-is
                                    location_access_rules.append(analyzed_rule)
                        except Exception as e:
                            logger.warning(f"Could not analyze location rule for {loc_name}: {e}")
                            # Try to continue with other locations

                # If we got location rules, combine them with 'or' (any pattern)
                if location_access_rules:
                    if len(location_access_rules) == 1:
                        return location_access_rules[0]
                    else:
                        return {'type': 'or', 'conditions': location_access_rules}

        return None  # Let normal analysis proceed

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

    # ==========================================================================
    # Item and progression data methods
    # ==========================================================================

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

    # ==========================================================================
    # Exporter settings and game info methods
    # ==========================================================================

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

    def get_game_info(self, world) -> Dict[str, Any]:
        """
        Get game-specific information for the frontend.

        This method is for game-specific custom data and accumulator patterns.
        Game-specific expanders can override this to add custom data.

        Accumulator rules can be set via:
        1. Class attribute ACCUMULATOR_RULES (preferred for game-specific exporters)
        2. World attribute accumulator_rules (for dynamically generated worlds)

        Initial prog_items values can be set via:
        1. Class attribute PROG_ITEMS_INIT (preferred for game-specific exporters)
        2. World attribute prog_items_init (for dynamically generated worlds)

        Note: Base fields have been moved to other methods:
        - name (game) -> world[player].game in get_world_data()
        - slot_data, base_id, world_description, web -> get_world_data()
        - rule_format -> get_exporter_settings()

        Returns:
            A dictionary with game-specific information for the frontend.
        """
        game_info = {}

        # Use class-level ACCUMULATOR_RULES if defined, otherwise check world attribute
        if self.ACCUMULATOR_RULES:
            game_info['accumulator_rules'] = self.ACCUMULATOR_RULES
        elif hasattr(world, 'accumulator_rules') and world.accumulator_rules:
            game_info['accumulator_rules'] = world.accumulator_rules

        # For prog_items_init, worldgen worlds get priority for world attribute
        # because worldgen worlds may pre-compute accumulator initial values.
        # For non-worldgen worlds, class attribute takes priority.
        if self.is_worldgen_world(world) and hasattr(world, 'prog_items_init') and world.prog_items_init:
            game_info['prog_items_init'] = dict(world.prog_items_init)
        elif self.PROG_ITEMS_INIT:
            game_info['prog_items_init'] = dict(self.PROG_ITEMS_INIT)
        elif hasattr(world, 'prog_items_init') and world.prog_items_init:
            game_info['prog_items_init'] = dict(world.prog_items_init)

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

    # ==========================================================================
    # Helper module configuration methods
    # ==========================================================================

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

        When AUTO_DISCOVER_WORLD_HELPER_MODULES is True, this method automatically
        includes all Python files from the game's world directory as potential
        helper modules. Non-callable objects (like lists, dicts) are filtered out
        at the helper retrieval stage, so it's safe to include all modules.

        Returns:
            A list of module paths (e.g., ['worlds.shapez.regions'])
        """
        # Start with manually specified modules
        modules = list(self.HELPER_MODULES)

        # Auto-discover helper modules from world directory if enabled
        if self.AUTO_DISCOVER_WORLD_HELPER_MODULES and self.world is not None:
            try:
                # Get the world class module path (e.g., 'worlds.mlss')
                world_module = type(self.world).__module__
                # Handle nested module paths - get the top-level world module
                # e.g., 'worlds.mlss.something' -> 'worlds.mlss'
                parts = world_module.split('.')
                if len(parts) >= 2 and parts[0] == 'worlds':
                    base_world_module = '.'.join(parts[:2])  # 'worlds.mlss'

                    # Get the directory path for this module
                    try:
                        world_pkg = __import__(base_world_module, fromlist=[''])
                        if hasattr(world_pkg, '__path__'):
                            world_dir = Path(world_pkg.__path__[0])

                            # Find all Python files in this directory
                            # Skip GUI/client modules that have display dependencies
                            skip_patterns = ('gui', 'client', 'kivy', 'kvui')
                            for py_file in world_dir.glob('*.py'):
                                if py_file.name.startswith('_'):
                                    continue  # Skip __init__.py, __pycache__, etc.

                                # Skip GUI/client modules to avoid importing display dependencies
                                name_lower = py_file.name.lower()
                                if any(pattern in name_lower for pattern in skip_patterns):
                                    logger.debug(f"Skipping GUI/client module: {py_file.name}")
                                    continue

                                module_name = py_file.stem  # e.g., 'StateLogic'

                                # Convert to module path
                                full_module_path = f"{base_world_module}.{module_name}"

                                # Add if not already in the list
                                if full_module_path not in modules:
                                    modules.append(full_module_path)
                                    logger.debug(f"Auto-discovered helper module: {full_module_path}")
                    except ImportError as e:
                        logger.debug(f"Could not import world package for helper discovery: {e}")
            except Exception as e:
                logger.debug(f"Error during helper module auto-discovery: {e}")

        return modules

    def get_item_name_modules(self) -> List[str]:
        """
        Return a list of module paths containing item name constants.

        Returns:
            A list of module paths (e.g., ['worlds.shapez.data.strings'])
        """
        return self.ITEM_NAME_MODULES

    # ==========================================================================
    # Pre/post processing hooks
    # ==========================================================================

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

        When PROG_ITEMS_INIT and ACCUMULATOR_ITEM_GROUP are set, this method:
        1. Creates accumulator target items (e.g., " coins") from PROG_ITEMS_INIT keys
        2. Finds items matching ACCUMULATOR_RULES patterns in locations
        3. Configures all matching items with the specified group and type

        Args:
            data: The complete export data dictionary

        Returns:
            The modified export data dictionary
        """
        import re

        # Auto-generate accumulator items if configured
        if self.PROG_ITEMS_INIT and self.ACCUMULATOR_ITEM_GROUP:
            group = self.ACCUMULATOR_ITEM_GROUP
            item_type = self.ACCUMULATOR_ITEM_TYPE or group
            max_count = self.ACCUMULATOR_TARGET_MAX_COUNT

            def make_accumulator_item(name: str, is_target: bool = False) -> Dict[str, Any]:
                return {
                    'name': name, 'id': None, 'groups': [group],
                    'advancement': True, 'useful': False, 'trap': False,
                    'event': False, 'type': item_type,
                    'max_count': max_count if is_target else 1
                }

            accumulator_items: Dict[str, Dict[str, Dict[str, Any]]] = {}

            # Step 1: Create accumulator target items from PROG_ITEMS_INIT
            for player_id in data.get('regions', {}).keys():
                accumulator_items[player_id] = {}
                for target_name in self.PROG_ITEMS_INIT.keys():
                    accumulator_items[player_id][target_name] = make_accumulator_item(
                        target_name, is_target=True
                    )

            # Step 2: Find items matching ACCUMULATOR_RULES patterns in locations
            patterns = [rule.get('pattern') for rule in self.ACCUMULATOR_RULES if rule.get('pattern')]
            if patterns:
                for player_id, regions in data.get('regions', {}).items():
                    for region_data in regions.values():
                        for location in region_data.get('locations', []):
                            item_name = location.get('item', {}).get('name', '')
                            if not item_name:
                                continue
                            # Check if item matches any accumulator pattern
                            for pattern in patterns:
                                if re.match(pattern, item_name):
                                    if item_name not in accumulator_items.get(player_id, {}):
                                        accumulator_items.setdefault(player_id, {})[item_name] = (
                                            make_accumulator_item(item_name)
                                        )
                                    break  # Only match first pattern

            # Step 3: Merge accumulator items into data
            if accumulator_items:
                data.setdefault('items', {})
                for player_id, player_items in accumulator_items.items():
                    data['items'].setdefault(player_id, {}).update(player_items)

        return data
