
import logging
import inspect
import tempfile
from typing import Union, Any, TYPE_CHECKING
import traceback

if TYPE_CHECKING:
    from world_generator.json_world_builder import JSONWorldBuilder
from Options import PerGameCommonOptions
from BaseClasses import CollectionState, MultiWorld, LocationProgressType, ItemClassification
from worlds import AutoWorld
from collections import Counter, defaultdict
from . import TrackerWorld, UTMapTabData, CurrentTrackerState, UT_VERSION, DeferredEntranceMode
import sys
from Utils import __version__, output_path, open_filename

from Generate import main as GMain, mystery_argparse
from worlds.generic.Rules import exclusion_rules
from argparse import Namespace
from typing import Optional,Callable
from NetUtils import NetworkItem, HintStatus


    
REGEN_WORLDS = {name for name, world in AutoWorld.AutoWorldRegister.world_types.items() if getattr(world, "ut_can_gen_without_yaml", False)}

class TrackerCore():
    cached_multiworlds: list[MultiWorld] = []
    cached_slot_data: list[dict[str, Any]] = []

    def __init__(self,logger: logging.Logger, print_list: bool, print_count: bool) -> None:
        self.logger = logger
        self.player_id = None
        self.game: Optional[str] = None
        self.slot: Optional[int] = None
        self.slot_name: Optional[str] = None
        self.team: Optional[int] = None
        self.common_option_overrides = {}
        self.locations_available = []
        self.launch_multiworld = None
        self.multiworld = None
        self.enforce_deferred_connections = None
        self.enable_glitched_logic = True
        self.glitched_locations = []
        self.quit_after_update = print_list or print_count
        self.print_list = print_list
        self.print_count = print_count
        self._set_page = None
        self._log_to_tab = None
        self._clear_page = None
        self.re_gen_passthrough = None
        self._get_ut_color = None
        self.stored_data:dict[str,Any] = {}
        self.location_alias_map: dict[int, str] = {}
        self.hints = {}
        self.tracker_items_received = []
        self.manual_items = []
        self.player_folder_override = None
        self.gen_error:str = ""

        self.ignored_locations: set[int] = set()
        self.missing_locations: set[int] = set()
        self.seed_override: int | None = None  # Optional seed to use for generation (for UT comparison testing)
        self.sphere_log_mode: bool = False  # Enable lenient error handling for UT comparison testing
        self.auto_collect_events: bool = True  # Auto-collect event items when locations become accessible
        self.filter_event_items: bool = True  # Filter out event locations/items from output (default UT behavior)

        # Worldgen world support for rule explain and tracking functionality
        self.worldgen_builder: Optional["JSONWorldBuilder"] = None
        self.worldgen_world: Optional[Any] = None
        self.worldgen_multiworld: Optional[MultiWorld] = None
        self._tracking_from_worldgen: bool = False  # True if tracking uses worldgen world

        # Direct AST explain support (works without worldgen world)
        self.seed_name: Optional[str] = None  # Seed name from RoomInfo (e.g., "14089154938208861744")
        self.generation_seed: Optional[int] = None  # Short seed number from rules JSON (e.g., 1)
        self.rules_json_data: Optional[dict] = None  # Loaded rules JSON for direct AST explain
        self.rules_json_path: Optional[str] = None  # Path to loaded rules JSON

        # Auto-worldgen option: if True, generate worldgen world from rules JSON
        self.auto_generate_worldgen: bool = False

    def disconnect(self):
        self.re_gen_passthrough = None
        self.player_id = None
        self.multiworld = None
        self.manual_items.clear()
        self.player_folder_override = None
        self.location_alias_map = {}
        # Clear worldgen world
        self.worldgen_builder = None
        self.worldgen_world = None
        self.worldgen_multiworld = None
        self._tracking_from_worldgen = False
        # Clear direct AST explain data
        self.seed_name = None
        self.generation_seed = None
        self.rules_json_data = None
        self.rules_json_path = None

    def set_set_page(self,set_page:Optional[Callable[[str],None]]):
        self._set_page = set_page
    
    def set_log_to_tab(self,log_to_tab:Optional[Callable[[str,bool],None]]):
        self._log_to_tab = log_to_tab
    
    def set_clear_page(self, clear_page:Optional[Callable[[],None]]):
        self._clear_page = clear_page
    
    def set_get_ut_color(self,get_ut_color:Optional[Callable[[str],str]]):
        self._get_ut_color = get_ut_color

    def set_debug_logger(self, debug_logger: Optional[Callable[[str, dict], None]]):
        """Set callback for debug logging (used by TrackerClient for debug log file)."""
        self._debug_logger = debug_logger

    def _log_debug(self, event_type: str, data: dict):
        """Log a debug event if debug logger is configured."""
        if hasattr(self, '_debug_logger') and self._debug_logger:
            self._debug_logger(event_type, data)

    def get_current_world(self):
        if self.player_id and self.multiworld:
            return self.multiworld.worlds[self.player_id]
        return None

    def load_worldgen_world(self, json_path: str, worldgen_game_name: Optional[str] = None) -> bool:
        """
        Load a worldgen world from JSON for rule explain support.

        This allows the tracker to explain rules for worlds that don't natively
        support Rule Builder by loading the corresponding _worldgen world.

        Args:
            json_path: Path to the JSON rules file
            worldgen_game_name: Optional override for worldgen world name.
                If None, derives from JSON metadata (e.g., "TUNIC" -> "TUNIC WorldGen")

        Returns:
            True if worldgen world was loaded successfully, False otherwise
        """
        try:
            from world_generator.json_world_builder import JSONWorldBuilder
            self.worldgen_builder = JSONWorldBuilder(json_path)
            self.worldgen_builder.load()
            self.worldgen_world = self.worldgen_builder.build_world(worldgen_game_name)
            self.worldgen_multiworld = self.worldgen_builder.multiworld
            self.logger.info(f"Loaded worldgen world for explain support: {worldgen_game_name or self.worldgen_builder.data.metadata.game_name}")
            return True
        except Exception as e:
            self.logger.warning(f"Failed to load worldgen world: {e}")
            self.worldgen_builder = None
            self.worldgen_world = None
            self.worldgen_multiworld = None
            return False

    def initialize_tracking_from_worldgen(self) -> bool:
        """
        Initialize tracking using the worldgen world.

        This method attempts to use an already-loaded worldgen world for tracking.
        The worldgen world must have been created via build_world() which runs
        the generation steps (create_regions, set_rules, etc.).

        Returns:
            True if tracking was initialized from worldgen, False otherwise
        """
        if not self.worldgen_multiworld or not self.worldgen_world:
            self.logger.debug("No worldgen world available for tracking")
            return False

        try:
            # Use worldgen multiworld for tracking
            self.multiworld = self.worldgen_multiworld
            self.player_id = 1
            self._tracking_from_worldgen = True

            self.logger.info(
                f"Initialized tracking from worldgen world: {self.worldgen_world.game}"
            )
            return True

        except Exception as e:
            self.logger.warning(f"Failed to initialize tracking from worldgen: {e}")
            self._tracking_from_worldgen = False
            return False

    def generate_and_load_worldgen_world(self, json_path: str) -> bool:
        """
        Generate a worldgen world from a rules JSON file and load it.

        This runs the world generator to create Python files, then dynamically
        imports the new world and loads it for use by the tracker.

        Args:
            json_path: Path to the JSON rules file

        Returns:
            True if world was generated and loaded successfully, False otherwise
        """
        try:
            import importlib
            import json
            import sys
            from pathlib import Path
            from world_generator.generator import WorldGenerator

            # Load JSON to get game name
            with open(json_path) as f:
                json_data = json.load(f)

            game_name = json_data.get('game_name', 'Unknown')

            # Include seed name in directory and game name for parallel-safe operation
            # This allows multiple fuzzer processes to run simultaneously without conflicts
            seed_suffix = f"_{self.seed_name}" if self.seed_name else ""
            worldgen_game_name = f"{game_name} WorldGen{seed_suffix}"

            # Derive output directory with seed-specific suffix
            game_directory = json_data.get('game_directory', game_name.lower().replace(' ', '_'))
            output_dir = Path('worlds') / f"{game_directory}_worldgen{seed_suffix}"
            module_name = output_dir.name  # e.g., "adventure_worldgen_12345"

            self.logger.info(f"Generating worldgen world from {json_path}")

            # Run world generator to create/overwrite Python files
            generator = WorldGenerator(
                json_path=json_path,
                output_dir=str(output_dir),
                game_name=worldgen_game_name,
                force=True,  # Overwrite existing
                canonical_seed=1,  # Enable canonical placement for seed 1
            )
            generator.generate()

            self.logger.info(f"Generated world files in {output_dir}")

            # Check if module was previously imported
            full_module_name = f"worlds.{module_name}"
            if full_module_name in sys.modules:
                # Unregister the old world class before reloading
                if worldgen_game_name in AutoWorld.AutoWorldRegister.world_types:
                    self.logger.info(f"Unregistering existing '{worldgen_game_name}' before reload")
                    del AutoWorld.AutoWorldRegister.world_types[worldgen_game_name]

                # Reload the module to pick up the new code
                self.logger.info(f"Reloading module: {full_module_name}")
                importlib.reload(sys.modules[full_module_name])
            else:
                # Import the module for the first time
                self.logger.info(f"Importing new world module: {full_module_name}")
                importlib.import_module(full_module_name)

            # Verify the world was registered
            if worldgen_game_name not in AutoWorld.AutoWorldRegister.world_types:
                self.logger.error(f"World '{worldgen_game_name}' not found after import")
                return False

            self.logger.info(f"Successfully imported '{worldgen_game_name}'")

            # Now load the worldgen world using JSONWorldBuilder
            return self.load_worldgen_world(json_path, worldgen_game_name)

        except Exception as e:
            self.logger.warning(f"Failed to generate/load worldgen world: {e}")
            import traceback
            self.logger.debug(traceback.format_exc())
            return False

    def get_worldgen_world(self):
        """Get the worldgen world if loaded, for rule explain support."""
        return self.worldgen_world

    def get_worldgen_location(self, location_name: str):
        """
        Get a location from the worldgen world by name.

        Useful for getting explain support for locations in non-Rule Builder worlds.
        """
        if self.worldgen_multiworld and self.worldgen_world:
            try:
                return self.worldgen_multiworld.get_location(location_name, 1)
            except KeyError:
                return None
        return None

    def explain_location_rule(self, location_name: str, state: CollectionState) -> Optional[list]:
        """
        Explain a location's access rule, using worldgen world if available.

        Tries to get explanation from:
        1. The main world's location (if it has explain_json)
        2. The worldgen world's location (if loaded and has explain_json)

        Args:
            location_name: Name of the location to explain
            state: Current collection state

        Returns:
            List of JSONMessagePart, or None if no explanation available
        """
        # Try main world first
        if self.multiworld and self.player_id:
            try:
                location = self.multiworld.get_location(location_name, self.player_id)
                if hasattr(location.access_rule, 'explain_json'):
                    return location.access_rule.explain_json(state)
            except KeyError:
                pass

        # Fall back to worldgen world
        if self.worldgen_multiworld:
            try:
                wg_location = self.worldgen_multiworld.get_location(location_name, 1)
                if hasattr(wg_location.access_rule, 'explain_json'):
                    # Use worldgen's state if we have it
                    wg_state = self.worldgen_multiworld.state if self.worldgen_multiworld.state else state
                    return wg_location.access_rule.explain_json(wg_state)
            except KeyError:
                pass

        # Fall back to direct AST explain from rules JSON
        if self.rules_json_data:
            return self._explain_from_rules_json(location_name, state)

        return None

    def _explain_from_rules_json(self, location_name: str, state: CollectionState) -> Optional[list]:
        """
        Explain a location's access rule directly from loaded rules JSON.

        This works without needing the worldgen world - just the rules JSON file.
        """
        if not self.rules_json_data:
            return None

        try:
            from rule_builder.ast_explain import explain_ast_rule

            # Find the location's access rule in the JSON
            regions = self.rules_json_data.get('regions', {})
            for region_name, region_data in regions.items():
                locations = region_data.get('locations', {})
                if location_name in locations:
                    loc_data = locations[location_name]
                    access_rule = loc_data.get('access_rule')
                    if access_rule:
                        player_id = self.player_id or 1
                        return explain_ast_rule(access_rule, state, player_id)
                    else:
                        # No rule means always accessible
                        return [{"text": "Always accessible", "type": "text"}]

            # Location not found in JSON
            return None
        except Exception as e:
            self.logger.warning(f"Failed to explain rule from JSON: {e}")
            return None

    def set_seed_name(self, seed_name: str):
        """Set the seed name (from RoomInfo) for auto-discovery."""
        self.seed_name = seed_name

    def _validate_rules_json(self, json_path: str) -> bool:
        """
        Validate that a rules JSON file matches the expected game and seed.

        Args:
            json_path: Path to the JSON rules file

        Returns:
            True if the file matches game and seed, False otherwise
        """
        import json
        try:
            with open(json_path) as f:
                data = json.load(f)

            json_game_name = data.get('game_name')
            json_seed_name = data.get('seed_name')

            # Validate game name
            if json_game_name and json_game_name != self.game:
                self.logger.debug(
                    f"Rules JSON game mismatch: expected '{self.game}', got '{json_game_name}' in {json_path}"
                )
                return False

            # Validate seed name (if present in the JSON)
            if json_seed_name and self.seed_name and str(json_seed_name) != str(self.seed_name):
                self.logger.debug(
                    f"Rules JSON seed mismatch: expected '{self.seed_name}', got '{json_seed_name}' in {json_path}"
                )
                return False

            return True
        except Exception as e:
            self.logger.debug(f"Failed to validate rules JSON {json_path}: {e}")
            return False

    def auto_discover_rules_json(self) -> bool:
        """
        Auto-discover and load the rules JSON file based on game name and seed name.

        Searches for rules files in multiple locations (in order):
        1. frontend/presets/{world_directory}_worldgen/AP_{seed_name}/ - worldgen presets
        2. frontend/presets/{world_directory}/AP_{seed_name}/ - original presets
        3. output/ directory - default generation output (extracted ZIP)
        4. User data directory (~/.local/share/Archipelago/ on Linux)

        Each candidate file is validated to ensure game_name and seed_name match
        before being accepted. If validation fails, the search continues.

        Returns:
            True if rules were loaded successfully, False otherwise
        """
        self._log_debug("auto_discover_rules_json", {"game": self.game, "seed_name": self.seed_name})
        if not self.game or not self.seed_name:
            self.logger.debug("Cannot auto-discover: game or seed_name not set")
            return False

        import json
        from pathlib import Path
        from Utils import user_path, output_path

        # Get project root (TrackerCore is in worlds/tracker/)
        project_root = Path(__file__).parent.parent.parent

        # Try to load world mapping for game -> directory conversion
        world_mapping_path = project_root / "scripts" / "data" / "world-mapping.json"
        world_directory = None

        if world_mapping_path.exists():
            try:
                with open(world_mapping_path) as f:
                    world_mapping = json.load(f)
                if self.game in world_mapping:
                    world_directory = world_mapping[self.game].get('world_directory')
            except Exception as e:
                self.logger.debug(f"Failed to load world mapping: {e}")

        if not world_directory:
            # Fallback: convert game name to lowercase, replace spaces with underscores
            world_directory = self.game.lower().replace(' ', '_').replace("'", "")

        presets_dir = project_root / "frontend" / "presets"
        seed_folder = f"AP_{self.seed_name}"

        # Build list of search paths (in priority order)
        search_paths = [
            # 1. Worldgen presets directory
            presets_dir / f"{world_directory}_worldgen" / seed_folder,
            # 2. Original presets directory
            presets_dir / world_directory / seed_folder,
            # 3. Output directory (where ZIP is extracted)
            Path(output_path()) / seed_folder,
            Path(output_path()),  # Also check output root for flat extraction
            # 4. User data directory
            Path(user_path()) / seed_folder,
            Path(user_path()) / "seeds" / seed_folder,
        ]

        for folder in search_paths:
            if folder.exists():
                # Look for *_rules.json file matching the seed
                rules_files = list(folder.glob(f"*{self.seed_name}*_rules.json"))
                if not rules_files:
                    # Fallback to any rules.json in the folder
                    rules_files = list(folder.glob("*_rules.json"))

                # Check each candidate file for validity
                for rules_file in rules_files:
                    json_path = str(rules_file)

                    # Validate the file matches our game and seed
                    if not self._validate_rules_json(json_path):
                        continue

                    self.logger.info(f"Auto-discovered rules JSON: {json_path}")
                    self._log_debug("rules_json_found", {"path": json_path})

                    # If auto_generate_worldgen is enabled, generate and load the worldgen world
                    if self.auto_generate_worldgen:
                        self.logger.info("Auto-worldgen enabled, generating worldgen world...")
                        if self.generate_and_load_worldgen_world(json_path):
                            # Also load the rules JSON for direct AST explain as fallback
                            self.load_rules_json(json_path)
                            return True
                        else:
                            self.logger.warning("Worldgen generation failed, falling back to direct AST explain")

                    # Default: just load the rules JSON for direct AST explain
                    result = self.load_rules_json(json_path)
                    self._log_debug("load_rules_json_result", {"result": result, "rules_json_path": self.rules_json_path})
                    return result

        self.logger.debug(f"No rules JSON found for {self.game} seed {self.seed_name}")
        self._log_debug("rules_json_not_found", {"game": self.game, "seed_name": self.seed_name})
        return False

    def load_rules_json(self, json_path: str) -> bool:
        """
        Load a rules JSON file for direct AST explain support.

        This is a lighter-weight alternative to load_worldgen_world() that doesn't
        require the worldgen world to be installed.

        Args:
            json_path: Path to the JSON rules file

        Returns:
            True if rules were loaded successfully, False otherwise
        """
        import json
        from pathlib import Path

        try:
            path = Path(json_path)
            if not path.exists():
                self.logger.warning(f"Rules JSON not found: {json_path}")
                return False

            with open(path) as f:
                self.rules_json_data = json.load(f)

            self.rules_json_path = json_path

            # Extract seed information
            game_name = self.rules_json_data.get('game_name', 'Unknown')
            schema_version = self.rules_json_data.get('schema_version', 'Unknown')
            self.generation_seed = self.rules_json_data.get('generation_seed')
            json_seed_name = self.rules_json_data.get('seed_name')

            # Validate game_name matches if we have both
            if game_name and self.game and game_name != self.game:
                self.logger.warning(
                    f"Rules JSON game mismatch: expected {self.game}, got {game_name}"
                )
                self.rules_json_data = None
                self.rules_json_path = None
                return False

            # Validate seed_name matches if we have both
            if json_seed_name and self.seed_name and str(json_seed_name) != str(self.seed_name):
                self.logger.warning(
                    f"Rules JSON seed_name mismatch: expected {self.seed_name}, got {json_seed_name}"
                )
                self.rules_json_data = None
                self.rules_json_path = None
                return False

            self.logger.info(
                f"Loaded rules JSON for {game_name} (schema v{schema_version}, "
                f"seed {self.generation_seed})"
            )
            return True

        except Exception as e:
            self.logger.warning(f"Failed to load rules JSON: {e}")
            self.rules_json_data = None
            self.rules_json_path = None
            self.generation_seed = None
            return False

    def set_page(self, line: str):
        if self._set_page:
            self._set_page(line)
    
    def set_missing_locations(self,missing_locations:set[int]):
        self.missing_locations = missing_locations

    def set_items_received(self, items_received:list[NetworkItem]):
        self.tracker_items_received = items_received
    
    def set_hints(self,hints:dict[int,int]):
        self.hints = hints
    
    def log_to_tab(self,line: str, sort: bool = False):
        if self._log_to_tab:
            self._log_to_tab(line,sort)
    
    def clear_page(self):
        if self._clear_page:
            self._clear_page()

    def get_ut_color(self,color:str):
        if self._get_ut_color:
            return self._get_ut_color(color)
        else:
            return "DD00FF"

    def set_slot_params(self,game:Optional[str],slot:Optional[int],slot_name:Optional[str],team:Optional[int]):
        self.game = game
        self.slot = slot
        self.slot_name = slot_name
        self.team = team
    
    def set_stored_data(self,stored_data:dict[str, Any]):
        if stored_data:
            self.stored_data = stored_data
        else:
            self.stored_data = {}

    def regen_slots(self, world, slot_data, tempdir: str | None = None) -> bool:
        if callable(getattr(world, "interpret_slot_data", None)):
            temp = world.interpret_slot_data(slot_data)

            # back compat for worlds that trigger regen with interpret_slot_data, will remove eventually
            if temp:
                self.player_id = 1
                self.re_gen_passthrough = {self.game: temp}
                self.run_generator(slot_data, tempdir)
            return True
        else:
            return False
        
    def _set_host_settings(self):
        from . import TrackerWorld
        tracker_settings = TrackerWorld.settings
        report_type = "Both"
        if tracker_settings['include_location_name']:
            if tracker_settings['include_region_name']:
                report_type = "Both"
            else:
                report_type = "Location"
        else:
            report_type = "Region"
        defered_mode = DeferredEntranceMode.default
        try:
            defered_mode = DeferredEntranceMode(tracker_settings["enforce_deferred_entrances"])
        except:
            tracker_settings["enforce_deferred_entrances"] =  DeferredEntranceMode.default
        return tracker_settings['player_files_path'], report_type, tracker_settings['hide_excluded_locations'],\
            tracker_settings["use_split_map_icons"], defered_mode, tracker_settings['display_glitched_logic']
    
    def run_generator(self, slot_data: dict | None = None, override_yaml_path: str | None = None, super_override_yaml_path: str|None = None):
        def move_slots(args: "Namespace", slot_name: str):
            """
            helper function to copy all the proper option values into slot 1,
            may need to change if/when multiworld.option_name dicts get fully removed
            """
            player = {name: i for i, name in args.name.items()}[slot_name]
            if player == 1:
                if slot_name in self.common_option_overrides:
                    vars(args).update({
                        option_name: {player: option_value}
                        for option_name, option_value in self.common_option_overrides[slot_name].items()
                    })
                return args
            for option_name, option_value in args._get_kwargs():
                if isinstance(option_value, dict) and player in option_value:
                    set_value = self.common_option_overrides.get(slot_name, {}).get(option_name, False) or option_value[player]
                    setattr(args, option_name, {1: set_value})
            return args

        def stash_generic_options(args: dict[str, dict[int, Any]]) -> None:
            ap_slots = {slot: args["name"][slot] for slot, game in args["game"].items() if game == "Archipelago"}
            override_dict = {
                option_name: {slot: option_class.from_any(option_class.default) for slot in ap_slots.keys()}
                for option_name, option_class in PerGameCommonOptions.type_hints.items()
            }
            per_player_overrides = {
                slot_name: {option_name: args[option_name][slot] for option_name in override_dict.keys()}
                for slot, slot_name in ap_slots.items()
            }
            self.common_option_overrides.update(per_player_overrides)
            for option_name, player_mapping in override_dict.items():
                args[option_name].update(player_mapping)

        try:
            yaml_path, self.output_format, self.hide_excluded, self.use_split, enforce_deferred_connections, self.enable_glitched_logic = self._set_host_settings()
            if self.enforce_deferred_connections is None: self.enforce_deferred_connections = enforce_deferred_connections
            # strip command line args, they won't be useful from the client anyway
            sys.argv = sys.argv[:1]
            args = mystery_argparse()
            if super_override_yaml_path:
                args.player_files_path = super_override_yaml_path
            elif override_yaml_path:
                args.player_files_path = override_yaml_path
            elif self.player_folder_override:
                args.player_files_path = self.player_folder_override
            elif yaml_path:
                args.player_files_path = yaml_path
            self.player_folder_override = args.player_files_path
            args.skip_output = True
            args.multi = 0
            if self.quit_after_update:
                from logging import ERROR
                args.log_level = ERROR

            # Use seed_override if set (for UT comparison testing)
            if self.seed_override is not None:
                args.seed = self.seed_override

            g_args, seed = GMain(args)
            if slot_data or override_yaml_path:
                if slot_data and slot_data in self.cached_slot_data:
                    print("found cached multiworld!")
                    index = next(i for i, s in enumerate(self.cached_slot_data) if s == slot_data)
                    self.multiworld = self.cached_multiworlds[index]
                    return
                if not self.game:
                    raise "No Game found for slot, this should not happen ever"
                g_args.multi = 1
                g_args.game = {1: self.game}
                g_args.player_ids = {1}

                # TODO confirm that this will never not be filled
                g_args = move_slots(g_args, self.slot_name)

                self.multiworld = self.TMain(g_args, seed)
                assert len(self.cached_slot_data) == len(self.cached_multiworlds)
                self.cached_multiworlds.append(self.multiworld)
                self.cached_slot_data.append(slot_data)
            else:
                # skip worlds that we know will regen on connect
                g_args.game = {
                    slot: game if game not in REGEN_WORLDS else "Archipelago"
                    for slot, game in g_args.game.items()
                    }

                stash_generic_options(vars(g_args))
                self.launch_multiworld = self.TMain(g_args, seed)
                self.multiworld = self.launch_multiworld

            temp_precollect = {}
            for player_id, items in self.multiworld.precollected_items.items():
                temp_items = [item for item in items if item.code is None]
                temp_precollect[player_id] = temp_items
            self.multiworld.precollected_items = temp_precollect
        except Exception as e:
            tb = traceback.format_exc()
            self.gen_error = tb
            self.logger.error(tb)

    def TMain(self, args, seed=None):
        from worlds.AutoWorld import World
        gen_steps = filter(
            lambda s: hasattr(World, s),
            # filter out stages that World doesn't define so we can keep this list bleeding edge
            (
                "generate_early",
                "create_regions",
                "create_items",
                "set_rules",
                "connect_entrances",
                "generate_basic",
                "pre_fill",  # Needed for worldgen worlds that place items in pre_fill (e.g., for location_item_name checks)
            )
        )

        multiworld = MultiWorld(args.multi)

        multiworld.generation_is_fake = True
        if self.re_gen_passthrough is not None:
            multiworld.re_gen_passthrough = self.re_gen_passthrough
        if self.enforce_deferred_connections is None: self.enforce_deferred_connections = DeferredEntranceMode.default
        multiworld.enforce_deferred_connections = self.enforce_deferred_connections.value

        multiworld.set_seed(seed, args.race, str(args.outputname) if args.outputname else None)
        multiworld.game = args.game.copy()
        multiworld.player_name = args.name.copy()
        multiworld.set_options(args)
        multiworld.state = CollectionState(multiworld,self.enforce_deferred_connections != DeferredEntranceMode.disabled)

        for step in gen_steps:
            AutoWorld.call_all(multiworld, step)
            if step == "set_rules":
                for player in multiworld.player_ids:
                    exclusion_rules(multiworld, player, multiworld.worlds[player].options.exclude_locations.value)
            if step == "generate_basic":
                break

        return multiworld
    
    def updateTracker(self) -> CurrentTrackerState:
        if self.player_id is None or self.multiworld is None:
            self.logger.error("Player YAML not installed or Generator failed")
            self.set_page(f"Check Player YAMLs for error; Tracker {UT_VERSION} for AP version {__version__}")
            return CurrentTrackerState.init_empty_state()

        state = CollectionState(self.multiworld,self.enforce_deferred_connections != DeferredEntranceMode.disabled)
        prog_items = Counter()
        all_items = Counter()

        callback_list:list[str] = []
        glitches_callback_list:list[str] = []

        item_id_to_name = self.multiworld.worlds[self.player_id].item_id_to_name
        location_id_to_name = self.multiworld.worlds[self.player_id].location_id_to_name

        invalid_items = [str(item.item) for item in self.tracker_items_received if item.item not in item_id_to_name]
        if invalid_items:
            if self.sphere_log_mode:
                # In sphere_log_mode: Log warning but don't throw - filter out invalid items and continue
                # This allows the tracker to continue operating even with datapackage mismatches
                self.logger.warning(f"Skipping {len(invalid_items)} unknown items (datapackage mismatch?): {invalid_items[:5]}{'...' if len(invalid_items) > 5 else ''}")
            else:
                # Normal mode: throw an exception (original behavior)
                print(invalid_items)
                self.logger.error("Your datapackage is incorrect, please correct the apworld for "+str(self.game))
                self.logger.error("The Following items are unknown [" + ",".join(invalid_items)+"]")
                raise Exception("Your datapackage is incorrect, please correct the apworld for "+str(self.game))

        # Filter to only valid items before processing (in sphere_log_mode) or use all items (normal mode)
        items_to_process = [item for item in self.tracker_items_received if item.item in item_id_to_name] if self.sphere_log_mode else self.tracker_items_received
        for item_name, item_flags, item_loc, item_player in [(item_id_to_name[item.item],item.flags,item.location, item.player) for item in items_to_process] + [(name,ItemClassification.progression,-1,-1) for name in self.manual_items]:
            try:
                world_item = self.multiworld.create_item(item_name, self.player_id)
                if item_loc>0 and item_player == self.slot and item_loc in location_id_to_name:
                    world_item.location = self.multiworld.get_location(location_id_to_name[item_loc],self.player_id)
                world_item.classification = world_item.classification | item_flags
                state.collect(world_item, True)
                if world_item.advancement:
                    prog_items[world_item.name] += 1
                # Add to all_items unless filtering event items (code is None)
                if not self.filter_event_items or world_item.code is not None:
                    all_items[world_item.name] += 1
            except Exception:
                self.log_to_tab("Item id " + str(item_name) + " not able to be created", False)
        if self.auto_collect_events:
            state.sweep_for_advancements(
                locations=[location for location in self.multiworld.get_locations(self.player_id) if (not location.address)])

        self.clear_page()
        regions = []
        locations = []
        readable_locations = []
        glitches_locations:list[int] = []
        hinted_locations = []
        for temp_loc in self.multiworld.get_reachable_locations(state, self.player_id):
            # Filter event locations (address is None) if filter_event_items is enabled
            if self.filter_event_items and (temp_loc.address is None or isinstance(temp_loc.address, list)):
                continue
            elif self.hide_excluded and temp_loc.progress_type == LocationProgressType.EXCLUDED:
                continue
            elif temp_loc.address in self.ignored_locations:
                continue
            try:
                if (temp_loc.address in self.missing_locations):
                    # logger.info("YES rechable (" + temp_loc.name + ")")
                    region = ""
                    if temp_loc.parent_region is not None:
                        region = temp_loc.parent_region.name
                    temp_name = temp_loc.name
                    if temp_loc.address in self.location_alias_map:
                        temp_name += f" ({self.location_alias_map[temp_loc.address]})"
                    if self.output_format == "Both":
                        if temp_loc.progress_type == LocationProgressType.EXCLUDED:
                            self.log_to_tab("[color="+self.get_ut_color("excluded") + "]" +region + " | " + temp_name+"[/color]", True)
                        elif temp_loc.address in self.hints:
                            self.log_to_tab("[color="+self.get_ut_color("hinted") + "]" +region + " | " + temp_name+"[/color]", True)
                            hinted_locations.append(temp_loc)
                        else:
                            self.log_to_tab(region + " | " + temp_name, True)
                        readable_locations.append(region + " | " + temp_name)
                    elif self.output_format == "Location":
                        if temp_loc.progress_type == LocationProgressType.EXCLUDED:
                            self.log_to_tab("[color="+self.get_ut_color("excluded") + "]" +temp_name+"[/color]", True)
                        elif temp_loc.address in self.hints:
                            self.log_to_tab("[color="+self.get_ut_color("hinted") + "]" +temp_name+"[/color]", True)
                            hinted_locations.append(temp_loc)
                        else:
                            self.log_to_tab(temp_name, True)
                        readable_locations.append(temp_name)
                    if region not in regions:
                        regions.append(region)
                        if self.output_format == "Region":
                            self.log_to_tab(region, True)
                            readable_locations.append(region)
                    callback_list.append(temp_loc.name)
                    locations.append(temp_loc.address)
            except Exception:
                self.log_to_tab("ERROR: location " + temp_loc.name + " broke something, report this to discord")
                pass
        events = [location.item.name for location in state.advancements if location.player == self.player_id]
        event_locations = [location.name for location in state.advancements if location.player == self.player_id]
        unconnected_entrances = [entrance for region in state.reachable_regions[self.player_id] for entrance in region.exits if entrance.can_reach(state) and entrance.connected_region is None]

        self.locations_available = locations
        glitches_item_name = getattr(self.multiworld.worlds[self.player_id],"glitches_item_name","")
        if glitches_item_name:
            try:
                world_item = self.multiworld.create_item(glitches_item_name, self.player_id)
                state.collect(world_item, True)
            except Exception:
                self.log_to_tab("Item id " + str(glitches_item_name) + " not able to be created", False)
            else:
                if self.auto_collect_events:
                    state.sweep_for_advancements(
                        locations=[location for location in self.multiworld.get_locations(self.player_id) if (not location.address)])
                for temp_loc in self.multiworld.get_reachable_locations(state, self.player_id):
                    # Filter event locations (address is None) if filter_event_items is enabled
                    if self.filter_event_items and (temp_loc.address is None or isinstance(temp_loc.address, list)):
                        continue
                    elif self.hide_excluded and temp_loc.progress_type == LocationProgressType.EXCLUDED:
                        continue
                    elif temp_loc.address in self.ignored_locations:
                        continue
                    elif temp_loc.address in locations:
                        continue # already in logic
                    try:
                        if (temp_loc.address in self.missing_locations):
                            glitches_locations.append(temp_loc.address)
                            glitches_callback_list.append(temp_loc.name)
                            region = ""
                            if temp_loc.parent_region is not None:  
                                region = temp_loc.parent_region.name
                            if self.enable_glitched_logic:
                                temp_name = temp_loc.name
                                if temp_loc.address in self.location_alias_map:
                                    temp_name += f" ({self.location_alias_map[temp_loc.address]})"
                                if self.output_format == "Both":
                                    if temp_loc.progress_type == LocationProgressType.EXCLUDED:
                                        self.log_to_tab("[color="+self.get_ut_color("out_of_logic_glitched") + "]" +region + " | " + temp_name+"[/color]", True)
                                    elif temp_loc.address in self.hints:
                                        self.log_to_tab("[color="+self.get_ut_color("hinted_glitched") + "]" +region + " | " + temp_name+"[/color]", True)
                                        hinted_locations.append(temp_loc)
                                    else:
                                        self.log_to_tab("[color="+self.get_ut_color("glitched") + "]" +region + " | " + temp_name+"[/color]", True)
                                    readable_locations.append(region + " | " + temp_name)
                                elif self.output_format == "Location":
                                    if temp_loc.progress_type == LocationProgressType.EXCLUDED:
                                        self.log_to_tab("[color="+self.get_ut_color("out_of_logic_glitched") + "]" +temp_name+"[/color]", True)
                                    elif temp_loc.address in self.hints:
                                        self.log_to_tab("[color="+self.get_ut_color("hinted_glitched") + "]" +temp_name+"[/color]", True)
                                        hinted_locations.append(temp_loc)
                                    else:
                                        self.log_to_tab("[color="+self.get_ut_color("glitched") + "]" +temp_name+"[/color]", True)
                                    readable_locations.append(temp_name)
                            if region not in regions:
                                regions.append(region)
                                if self.output_format == "Region" and self.enable_glitched_logic:
                                    self.log_to_tab("[color="+self.get_ut_color("glitched")+"]"+region+"[/color]", True)
                                    readable_locations.append(region)
                    except Exception:
                        self.log_to_tab("ERROR: location " + temp_loc.name + " broke something, report this to discord")
                        pass
        self.glitched_locations = glitches_locations

        return CurrentTrackerState(all_items, prog_items, glitches_callback_list, events, event_locations, callback_list, regions, unconnected_entrances, readable_locations, hinted_locations, state)

    def write_empty_yaml(self, game, player_name, tempdir):
        import json
        import os
        path = os.path.join(tempdir, f'yamlless_yaml.yaml')
        yaml_out = {"name":player_name,"game":game,game:{}}
        with open(path, 'w',encoding="utf-8") as f:
            f.write(json.dumps(yaml_out))

    def initalize_tracker_core(self,connected_cls:type[AutoWorld.World],raw_slot_data):
        if getattr(connected_cls, "disable_ut", False):
            self.log_to_tab("World Author has requested UT be disabled on this world, please respect their decision")
            return

        # Try worldgen-based tracking first if rules.json is available
        self._log_debug("initalize_tracker_core", {"rules_json_path": self.rules_json_path})
        if self.rules_json_path:
            self.logger.info(f"Attempting worldgen-based tracking from {self.rules_json_path}")
            self._log_debug("attempting_worldgen_tracking", {"rules_json_path": self.rules_json_path})
            # Generate a fresh worldgen world from the rules.json file
            # This ensures the worldgen world matches the specific seed we're connecting to
            worldgen_result = self.generate_and_load_worldgen_world(self.rules_json_path)
            self._log_debug("generate_worldgen_result", {"success": worldgen_result})
            if worldgen_result:
                tracking_result = self.initialize_tracking_from_worldgen()
                self._log_debug("initialize_tracking_result", {"success": tracking_result})
                if tracking_result:
                    self.logger.info("Using worldgen-based tracking")
                    self._log_debug("using_worldgen_tracking", {"success": True})
                    return
                else:
                    self.logger.warning("Failed to initialize tracking from worldgen, falling back")
            else:
                self.logger.warning("Failed to generate worldgen world, falling back to standard tracking")

        # first check if we don't need a yaml
        if getattr(connected_cls, "ut_can_gen_without_yaml", False):
            with tempfile.TemporaryDirectory() as tempdir:
                self.write_empty_yaml(self.game, self.slot_name, tempdir)
                self.player_id = 1
                slot_data = raw_slot_data
                world = None
                temp_isd = inspect.getattr_static(connected_cls, "interpret_slot_data", None)
                if isinstance(temp_isd, (staticmethod, classmethod)) and callable(temp_isd):
                    world = connected_cls
                else:
                    self.re_gen_passthrough = {self.game: slot_data}
                    self.run_generator(raw_slot_data, tempdir)
                    if self.multiworld is None:
                        self.log_to_tab("Internal world was not able to be generated, check your yamls and relaunch", False)
                        self.log_to_tab("If this issue persists, reproduce with the debug launcher and post the error message to the discord channel", False)
                        return
                    world = self.get_current_world()
                self.regen_slots(world, slot_data, tempdir)
                if self.multiworld is None:
                    self.log_to_tab("Internal world was not able to be generated, check your yamls and relaunch", False)
                    self.log_to_tab("If this issue persists, reproduce with the debug launcher and post the error message to the discord channel", False)
                    return

        else:
            if self.launch_multiworld is None:
                self.log_to_tab("Internal world was not able to be generated, check your yamls and relaunch", False)
                self.log_to_tab("If this issue persists, reproduce with the debug launcher and post the error message to the discord channel", False)
                return

            if self.slot_name in self.launch_multiworld.world_name_lookup:
                internal_id = self.launch_multiworld.world_name_lookup[self.slot_name]
                if self.launch_multiworld.worlds[internal_id].game == self.game:
                    self.multiworld = self.launch_multiworld
                    self.player_id = internal_id
                    self.regen_slots(self.get_current_world(), raw_slot_data)
                elif self.launch_multiworld.worlds[internal_id].game == "Archipelago":
                    if not self.regen_slots(connected_cls, raw_slot_data):
                        raise "TODO: add error - something went very wrong with interpret_slot_data"
                else:
                    world_dict = {name: self.launch_multiworld.worlds[slot].game for name, slot in self.launch_multiworld.world_name_lookup.items()}
                    tb = f"Tried to match game '{self.game}'" + \
                            f" to slot name '{self.slot_name}'" + \
                            f" with known slots {world_dict}"
                    self.gen_error = tb
                    self.logger.error(tb)
                    return
            else:
                known_slots = [f"{slot_name} ({self.launch_multiworld.worlds[slot_id].game})" for slot_name, slot_id in self.launch_multiworld.world_name_lookup.items() if self.launch_multiworld.worlds[slot_id].game != "Archipelago"]
                if known_slots:
                    self.logger.error(f"Player's Yaml not in tracker's list. Known players: {known_slots}")
                else:
                    self.logger.error(f"Player's Yaml not in tracker's list. All known players are Yaml-less")
                return
        if self.multiworld:
            self.location_alias_map = getattr(self.multiworld.worlds[self.player_id],"location_id_to_alias",{})