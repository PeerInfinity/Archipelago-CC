"""Base class for game-specific helper expanders.

NOTE: New games should generally inherit from GenericGameExportHandler
instead of BaseGameExportHandler directly, unless you need full control
over all export methods. GenericGameExportHandler provides intelligent
defaults for rule analysis, item data discovery, and common helper patterns.

See exporter/games/generic.py for details on the enhanced functionality.
"""

from typing import Dict, Any, List, Set, Optional
import collections
import importlib
import logging

logger = logging.getLogger(__name__)


class BaseGameExportHandler:
    # Configuration for automatic helper extraction
    # Games should override these class variables

    # List of module paths containing helper functions (e.g., ['worlds.shapez.regions'])
    HELPER_MODULES: List[str] = []

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

    def __init__(self):
        """Initialize the handler with an empty set of discovered helpers."""
        # Set of helper names discovered during rule analysis
        # Populated automatically by register_helper_usage()
        self._discovered_helpers: Set[str] = set()

    def register_helper_usage(self, helper_name: str) -> None:
        """
        Register that a helper function is used in the rules.

        This is called by the analyzer when it encounters a helper function call.
        The helper will be automatically analyzed and exported as a definition
        (unless it's in the blacklist).

        Args:
            helper_name: The name of the helper function
        """
        if not hasattr(self, '_discovered_helpers'):
            self._discovered_helpers = set()
        self._discovered_helpers.add(helper_name)

    def get_discovered_helpers(self) -> Set[str]:
        """
        Return the set of helper names discovered during rule analysis.

        Returns:
            Set of helper function names that were used in the analyzed rules
        """
        if not hasattr(self, '_discovered_helpers'):
            self._discovered_helpers = set()
        return self._discovered_helpers

    def clear_discovered_helpers(self) -> None:
        """Clear the set of discovered helpers. Called between player exports."""
        self._discovered_helpers = set()

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand helper functions in a rule structure."""
        if not rule or not isinstance(rule, dict):
            return rule
            
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule['name'], rule.get('args', []))
            if expanded:
                return self.expand_rule(expanded)
            
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule.get('conditions', [])]
            
        if rule.get('type') == 'not':
            rule['condition'] = self.expand_rule(rule.get('condition'))
        if rule.get('type') == 'conditional':
            rule['test'] = self.expand_rule(rule.get('test'))
            rule['if_true'] = self.expand_rule(rule.get('if_true'))
            rule['if_false'] = self.expand_rule(rule.get('if_false'))
            
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

        Args:
            func_name: The name of the function being analyzed

        Returns:
            True if the function should be preserved as a helper, False otherwise
        """
        # Default implementation: don't preserve any functions as helpers
        # Games can override this to preserve specific helpers
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
        """
        itempool_counts = collections.defaultdict(int)

        # Count precollected items (items player starts with)
        if hasattr(multiworld, 'precollected_items'):
            for item in multiworld.precollected_items.get(player, []):
                itempool_counts[item.name] += 1

        # Count items placed in locations
        # Note: We don't count from multiworld.itempool because after fill it still contains
        # the original items (fill operates on a copy), which would cause double-counting.
        for location in multiworld.get_locations(player):
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

        # Add assume_bidirectional_exits setting with default false
        settings_dict['assume_bidirectional_exits'] = False

        # Add use_resolved_items setting with default false
        # When false (default), eventProcessor uses only base_items from sphere log
        # When true, eventProcessor uses resolved_items (e.g., for games with complex event items)
        # Games that need resolved_items should override get_settings_data and set this to True
        settings_dict['use_resolved_items'] = False

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
                        value = option.value
                        # Only export simple types (int, bool, str, list, dict)
                        if isinstance(value, (int, bool, str, list, dict)):
                            options_dict[option_name] = value
                        elif isinstance(value, set):
                            options_dict[option_name] = list(value)
                except Exception:
                    pass
            if options_dict:
                settings_dict['options'] = options_dict

        return settings_dict
        
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
        # This allows generated worlds from CC format to export accumulator rules
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
        """Perform game-specific cleanup/mapping on exported settings."""
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
        # Base implementation returns no additional attributes
        return {}

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

        Args:
            world: The world object for this player

        Returns:
            A dictionary mapping helper names to their rule definitions.
            Example: {"can_cut_half": {"type": "item_check", "item": "Cutter"}}
        """
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
        if self.AUTO_EXPORT_DISCOVERED_HELPERS:
            discovered = self.get_discovered_helpers()
            helpers_to_export = discovered | whitelist
        else:
            helpers_to_export = whitelist

        if not helpers_to_export or not helper_modules:
            return helper_definitions

        # Load helper modules
        loaded_modules = []
        for module_path in helper_modules:
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
        max_iterations = 10  # Safety limit to prevent infinite loops

        for iteration in range(max_iterations):
            # Get current set of helpers to export (may grow as we discover new ones)
            if self.AUTO_EXPORT_DISCOVERED_HELPERS:
                discovered = self.get_discovered_helpers()
                current_helpers = discovered | whitelist
            else:
                current_helpers = whitelist

            # Find helpers that haven't been processed yet
            new_helpers = current_helpers - processed_helpers - blacklist

            if not new_helpers:
                logger.debug(f"Helper discovery complete after {iteration + 1} iteration(s)")
                break

            logger.debug(f"Iteration {iteration + 1}: Processing {len(new_helpers)} new helpers: {new_helpers}")

            for helper_name in new_helpers:
                processed_helpers.add(helper_name)

                # Find the helper function in one of the loaded modules
                helper_func = None
                for module in loaded_modules:
                    if hasattr(module, helper_name):
                        helper_func = getattr(module, helper_name)
                        break

                if helper_func is None:
                    # Not found in helper modules - this is normal for built-in helpers
                    # like 'has', 'count', etc. that the frontend implements directly
                    logger.debug(f"Helper function '{helper_name}' not found in helper modules (may be a built-in)")
                    continue

                # Analyze the function to get its rule structure
                # This may discover new helpers via register_helper_usage
                try:
                    rule = analyze_rule(
                        rule_func=helper_func,
                        game_handler=self,
                        player_context=world.player if hasattr(world, 'player') else None
                    )

                    # Clean up the rule - resolve item names, convert state methods to rule types
                    rule = self._clean_helper_rule(rule, world)

                    if rule and rule.get('type') != 'error':
                        helper_definitions[helper_name] = rule
                        logger.debug(f"Exported helper '{helper_name}': {rule}")
                    else:
                        logger.warning(f"Failed to analyze helper '{helper_name}': {rule}")
                except Exception as e:
                    logger.error(f"Error analyzing helper '{helper_name}': {e}")
        else:
            logger.warning(f"Helper discovery reached max iterations ({max_iterations}), may have circular dependencies")

        return helper_definitions

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
        Resolve a tuple/list of item attributes to a list of item name strings.

        Handles both:
        - Tuple/list nodes with attribute elements (not yet resolved)
        - Constant nodes with list/tuple values (already resolved by analyzer)

        Args:
            collection_node: The collection node dictionary from the analyzer

        Returns:
            A list of item name strings, or None if not resolvable
        """
        if not collection_node:
            return None

        items = []

        # Handle constant type with list/tuple value (already resolved by analyzer)
        if collection_node.get('type') == 'constant':
            value = collection_node.get('value')
            if isinstance(value, (list, tuple)):
                return list(value)

        # Handle tuple type
        if collection_node.get('type') == 'tuple':
            elements = collection_node.get('elements', [])
            for elem in elements:
                if elem.get('type') == 'attribute':
                    item_name = self._resolve_item_attribute(elem)
                    if item_name:
                        items.append(item_name)
                elif elem.get('type') == 'constant':
                    items.append(elem.get('value'))

        # Handle list type
        elif collection_node.get('type') == 'list':
            elements = collection_node.get('elements', [])
            for elem in elements:
                if elem.get('type') == 'attribute':
                    item_name = self._resolve_item_attribute(elem)
                    if item_name:
                        items.append(item_name)
                elif elem.get('type') == 'constant':
                    items.append(elem.get('value'))

        return items if items else None