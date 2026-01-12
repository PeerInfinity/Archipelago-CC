from fuzz import BaseHook, GenOutcome
from typing import List, Dict, Set, Any, Optional
import collections
import json
import logging
import os
from . import TrackerCore, DeferredEntranceMode
from BaseClasses import MultiWorld, Location, Entrance, ItemClassification
from NetUtils import NetworkItem
logger = logging.getLogger("Fuzzer")

# Directory for explain stats output (relative to fuzz output directory)
EXPLAIN_STATS_DIR = "fuzz_output/explain_stats"


class Hook(BaseHook):
    ut_core:TrackerCore.TrackerCore
    player_files_path:str
    status = None
    run_id: int = 0  # Track run ID for explain stats files
    explain_stats_collected: bool = False  # Track if we've collected explain stats for this game

    def before_generate(self, args):
        self.status = None
        self.player_files_path = args.player_files_path
        self.ut_core = TrackerCore.TrackerCore(logger,False,False)
        self.ut_core.enforce_deferred_connections = DeferredEntranceMode.disabled
        self.ut_core.run_generator(None,None,args.player_files_path) #initial UT gen
        self.run_id = getattr(args, 'run_id', self.run_id)

    def after_generate(self, mw:MultiWorld, output_path):
        if mw is None:
            return
        if len(mw.worlds)>1:
            return
        assert self.player_files_path
        self.status = GenOutcome.Success
        import zipfile
        with zipfile.ZipFile(output_path+"/AP_"+mw.seed_name+".zip") as zf:
            for file in zf.namelist():
                if file.endswith(".archipelago"):
                    data = zf.read(file)
                    break
            else:
                raise Exception("No .archipelago found in archive.")
        from MultiServer import Context
        temp = Context.decompress(data)

        slot_data = temp["slot_data"][1] #slot 0 is reserved

        self.ut_core.set_slot_params(mw.worlds[1].game,1,mw.player_name[1],1)
        # Set seed_name to enable auto-discovery of rules.json for worldgen tracking
        self.ut_core.seed_name = mw.seed_name
        self.ut_core.auto_discover_rules_json()
        self.ut_core.initalize_tracker_core(mw.worlds[1].__class__,slot_data)
        assert self.ut_core.multiworld, self.ut_core.gen_error

        # Collect explain stats as soon as worldgen world is ready (before sphere comparison)
        # This ensures stats are collected regardless of whether the test passes or fails
        if not self.explain_stats_collected:
            self._collect_explain_stats()
            self.explain_stats_collected = True

        # Filter to only hashable addresses (some games like ALTTP have list-type addresses)
        remaining_locations = [location.address for location in mw.worlds[1].get_locations()
                               if location.address is not None and not isinstance(location.address, list)]
        current_inventory = [NetworkItem(item.code,-2,item.player,item.classification) for item in mw.precollected_items[1] if item.code is not None]
        new_items = []
        new_inventory = []

        # Recalc spheres
        for sphere_number, sphere in enumerate(mw.get_sendable_spheres()):
            current_sphere: Dict[str,Location] = {}
            for sphere_location in sphere:
                if sphere_location.address is not None:
                    current_sphere[sphere_location.name] = sphere_location
            current_inventory.extend(new_items)
            new_inventory.clear()
            new_items.clear()
            if current_sphere:
                self.ut_core.set_missing_locations(set(remaining_locations))
                self.ut_core.set_items_received(current_inventory)
                update_ret = self.ut_core.updateTracker()
                missed_locations = []
                for in_logic_location in update_ret.in_logic_locations:
                    if in_logic_location in current_sphere:
                        location = current_sphere[in_logic_location]
                        true_item = location.item
                        # Use location.address directly instead of true_item.location.address
                        # Some worlds set location.item without setting item.location back-reference
                        new_items.append(NetworkItem(true_item.code, location.address, true_item.player, true_item.classification))
                        if ItemClassification.progression in true_item.classification:
                            new_inventory.append(true_item.name)
                        remaining_locations.remove(location.address)
                        del current_sphere[in_logic_location]
                    else:
                        missed_locations.append(in_logic_location)
                if len(current_sphere) > 0:
                    print(f"Locations `{','.join(current_sphere.keys())}` were in server logic but not expected in UT")
                    print(f"UT logic sphere `{','.join(update_ret.in_logic_locations)}`")
                    print(f"Locations that weren't created in UT = [{','.join([loc for loc in current_sphere if loc not in self.ut_core.multiworld.regions.location_cache[self.ut_core.player_id]])}]")
                if len(missed_locations) > 0:
                    print(f"Locations {','.join(missed_locations)} were expected to be in logic but weren't")
                    print(f"Server logic sphere `{','.join([location.name for location in sphere if location.address is not None])}`")
                if len(current_sphere)>0 or len(missed_locations)>0:
                    print(f"After sphere #{sphere_number}")
                    item_id_to_name = self.ut_core.multiworld.worlds[self.ut_core.player_id].item_id_to_name
                    print(f"New Inventory = [{','.join(new_inventory)}]")
                    print(f"Current Inventory = [{','.join([item_id_to_name[item.item] for item in current_inventory if item.flags & 1])}]")
                    print(f"UT accessable regions `{','.join([region.name for region in update_ret.state.reachable_regions[1]])}`")
                    print(f"State inventory = `{','.join([f'{k}:{v}' for k,v in update_ret.state.prog_items[1].items()])}`")
                    self.status = GenOutcome.Failure
                    return
            else:
                return #if get_sendable_spheres returns an empty sphere that means we're done, the next sphere will be any unreachable locations... which aren't reachable...


        # Do the magic here, set `self.status` accordingly to `GenOutcome.Failure`/`GenOutcome.Success`

    def _collect_explain_stats(self) -> None:
        """
        Collect explain support statistics for locations and entrances in the worldgen world.

        This checks the world generated by TrackerCore from rules.json, which uses
        the Rule Builder. The goal is to measure how many rules have explain_json() support.

        Location counts:
        - total_locations: Total number of locations with addresses
        - locations_with_explain: Locations whose access_rule has explain_json method
        - locations_default_rule: Locations using default access_rule (always True)
        - locations_without_explain: Locations with custom rules but no explain_json

        Entrance counts:
        - total_entrances: Total number of entrances
        - entrances_with_explain: Entrances whose access_rule has explain_json method
        - entrances_default_rule: Entrances using default access_rule (always True)
        - entrances_without_explain: Entrances with custom rules but no explain_json
        """
        try:
            # Use the worldgen multiworld from TrackerCore
            worldgen_mw = self.ut_core.multiworld
            if not worldgen_mw:
                logger.warning("No worldgen multiworld available for explain stats")
                return

            world = worldgen_mw.worlds[self.ut_core.player_id]

            # Collect location stats
            locations = list(world.get_locations())
            total_locations = 0
            locations_with_explain = 0
            locations_default_rule = 0
            locations_without_explain = 0
            locations_without_explain_names = []  # Track names for debugging

            for location in locations:
                # Skip event locations (no address)
                if location.address is None:
                    continue

                total_locations += 1
                access_rule = location.access_rule

                # Check if using default access rule (always True, no custom logic)
                if access_rule is Location.access_rule:
                    locations_default_rule += 1
                # Check if rule has explain_json method (Rule Builder or compatible)
                elif hasattr(access_rule, 'explain_json'):
                    locations_with_explain += 1
                else:
                    # Custom rule without explain support (lambda/function)
                    locations_without_explain += 1
                    region_name = location.parent_region.name if location.parent_region else "Unknown"
                    locations_without_explain_names.append({
                        "name": location.name,
                        "region": region_name
                    })

            # Collect entrance stats
            total_entrances = 0
            entrances_with_explain = 0
            entrances_default_rule = 0
            entrances_without_explain = 0
            entrances_without_explain_names = []

            for region in worldgen_mw.get_regions(self.ut_core.player_id):
                for entrance in region.exits:
                    total_entrances += 1
                    access_rule = entrance.access_rule

                    if access_rule is Entrance.access_rule:
                        entrances_default_rule += 1
                    elif hasattr(access_rule, 'explain_json'):
                        entrances_with_explain += 1
                    else:
                        entrances_without_explain += 1
                        entrances_without_explain_names.append({
                            "name": entrance.name,
                            "from_region": region.name,
                            "to_region": entrance.connected_region.name if entrance.connected_region else "Unknown"
                        })

            # Calculate explain coverage percentages
            loc_custom_rules = locations_with_explain + locations_without_explain
            loc_explain_coverage = (locations_with_explain / loc_custom_rules * 100) if loc_custom_rules > 0 else 100.0

            ent_custom_rules = entrances_with_explain + entrances_without_explain
            ent_explain_coverage = (entrances_with_explain / ent_custom_rules * 100) if ent_custom_rules > 0 else 100.0

            stats = {
                "game": world.game,
                # Location stats
                "total_locations": total_locations,
                "locations_with_explain": locations_with_explain,
                "locations_default_rule": locations_default_rule,
                "locations_without_explain": locations_without_explain,
                "explain_coverage_percent": round(loc_explain_coverage, 2),
                "locations_without_explain_list": locations_without_explain_names,
                # Entrance stats
                "total_entrances": total_entrances,
                "entrances_with_explain": entrances_with_explain,
                "entrances_default_rule": entrances_default_rule,
                "entrances_without_explain": entrances_without_explain,
                "entrance_explain_coverage_percent": round(ent_explain_coverage, 2),
                "entrances_without_explain_list": entrances_without_explain_names
            }

            # Write stats to file
            self._write_explain_stats(stats)

        except Exception as e:
            logger.warning(f"Failed to collect explain stats: {e}")

    def _write_explain_stats(self, stats: Dict[str, Any]) -> None:
        """Write explain stats to a JSON file in the fuzz output directory."""
        try:
            os.makedirs(EXPLAIN_STATS_DIR, exist_ok=True)
            stats_file = os.path.join(EXPLAIN_STATS_DIR, "explain_stats.json")

            with open(stats_file, 'w') as f:
                json.dump(stats, f, indent=2)

        except Exception as e:
            logger.warning(f"Failed to write explain stats: {e}")

    def reclassify_outcome(self, outcome, exc):
        # If TrackerCore generation failed with a fill-related exception, treat as ignored
        # These are configuration issues, not logic mismatches
        if exc is not None and self.status is None:
            exc_str = str(exc)
            exc_type = type(exc).__name__
            # Handle various fill-related errors that are caused by option configurations
            if "Not enough filler/trap items" in exc_str or "filler" in exc_str.lower():
                return GenOutcome.OptionError, exc
            # Handle FillError when options create impossible-to-fill seeds
            # (e.g., accessibility: minimal combined with level_shuffle in SMW)
            if "No more spots to place" in exc_str or "Remaining locations are invalid" in exc_str:
                return GenOutcome.OptionError, exc
            # Handle FillError for accessibility check failures - this happens when random
            # option combinations create seeds where required locations are unreachable
            # (e.g., Terraria with certain goal/calamity combinations)
            if "Could not access required locations for accessibility check" in exc_str:
                return GenOutcome.OptionError, exc
            # Handle FFMQ API errors - the game requires external API for shuffle options
            # but the API may not be available in test environments
            if "Failed to fetch map shuffle data for FFMQ" in exc_str:
                return GenOutcome.OptionError, exc
            # Handle FFMQ's AttributeError when API fails with an exception (ProxyError, etc.)
            # The error handling code assumes HTTP response but may get an exception instead
            if exc_type == "AttributeError" and "status_code" in exc_str:
                return GenOutcome.OptionError, exc
            # Handle Overcooked! 2 option validation errors
            # These occur when the fuzzer generates invalid option combinations
            if "Invalid OC2 settings" in exc_str or "OC2 needs at least" in exc_str:
                return GenOutcome.OptionError, exc
        return (self.status if self.status is not None else outcome), exc


class MultiworldHook(BaseHook):
    """
    Extended hook for multiworld UT fuzz testing.

    Unlike the single-player Hook, this tests each player in the multiworld
    independently and tracks which players failed.
    """
    player_files_path: str
    status: Optional[int] = None
    failed_players: Dict[int, str]  # player_id -> failure reason
    player_results: Dict[int, bool]  # player_id -> passed

    def before_generate(self, args):
        self.status = None
        self.failed_players = {}
        self.player_results = {}
        self.player_files_path = args.player_files_path

    def _test_player(self, mw: MultiWorld, player_id: int, slot_data: dict) -> Optional[str]:
        """
        Test a single player in the multiworld.

        Returns None if passed, or an error message if failed.
        """
        # Create a fresh TrackerCore for this player
        ut_core = TrackerCore.TrackerCore(logger, False, False)
        ut_core.enforce_deferred_connections = DeferredEntranceMode.disabled

        # Run generator for this player's YAML
        ut_core.run_generator(None, None, self.player_files_path)

        game_name = mw.worlds[player_id].game
        player_name = mw.player_name[player_id]

        ut_core.set_slot_params(game_name, player_id, player_name, len(mw.worlds) - 1)
        ut_core.seed_name = mw.seed_name
        ut_core.auto_discover_rules_json()
        ut_core.initalize_tracker_core(mw.worlds[player_id].__class__, slot_data)

        if not ut_core.multiworld:
            return f"TrackerCore failed to initialize: {ut_core.gen_error}"

        # Filter to only hashable addresses
        remaining_locations = [
            location.address for location in mw.worlds[player_id].get_locations()
            if location.address is not None and not isinstance(location.address, list)
        ]
        current_inventory = [
            NetworkItem(item.code, -2, item.player, item.classification)
            for item in mw.precollected_items[player_id] if item.code is not None
        ]
        new_items = []
        new_inventory = []

        # Recalc spheres
        for sphere_number, sphere in enumerate(mw.get_sendable_spheres()):
            # Filter sphere to this player's locations
            current_sphere: Dict[str, Location] = {}
            for sphere_location in sphere:
                if sphere_location.player == player_id and sphere_location.address is not None:
                    current_sphere[sphere_location.name] = sphere_location

            current_inventory.extend(new_items)
            new_inventory.clear()
            new_items.clear()

            if current_sphere:
                ut_core.set_missing_locations(set(remaining_locations))
                ut_core.set_items_received(current_inventory)
                update_ret = ut_core.updateTracker()
                missed_locations = []

                for in_logic_location in update_ret.in_logic_locations:
                    if in_logic_location in current_sphere:
                        location = current_sphere[in_logic_location]
                        true_item = location.item
                        new_items.append(NetworkItem(
                            true_item.code, location.address,
                            true_item.player, true_item.classification
                        ))
                        if ItemClassification.progression in true_item.classification:
                            new_inventory.append(true_item.name)
                        remaining_locations.remove(location.address)
                        del current_sphere[in_logic_location]
                    else:
                        missed_locations.append(in_logic_location)

                if len(current_sphere) > 0 or len(missed_locations) > 0:
                    error_parts = []
                    if len(current_sphere) > 0:
                        error_parts.append(f"Locations in server but not UT: {list(current_sphere.keys())[:5]}")
                    if len(missed_locations) > 0:
                        error_parts.append(f"Locations in UT but not server: {missed_locations[:5]}")
                    return f"Sphere {sphere_number} mismatch for {game_name}: {'; '.join(error_parts)}"
            elif not current_sphere and sphere_number > 0:
                # Empty sphere for this player - continue checking other spheres
                pass

        return None  # Passed

    def after_generate(self, mw: MultiWorld, output_path):
        if mw is None:
            return

        self.status = GenOutcome.Success

        # Need at least 2 players for multiworld (slot 0 is reserved)
        if len(mw.worlds) <= 1:
            return

        import zipfile
        with zipfile.ZipFile(output_path + "/AP_" + mw.seed_name + ".zip") as zf:
            for file in zf.namelist():
                if file.endswith(".archipelago"):
                    data = zf.read(file)
                    break
            else:
                raise Exception("No .archipelago found in archive.")

        from MultiServer import Context
        temp = Context.decompress(data)

        # Test each player
        for player_id in range(1, len(mw.worlds)):
            slot_data = temp["slot_data"].get(player_id, {})
            game_name = mw.worlds[player_id].game

            try:
                error = self._test_player(mw, player_id, slot_data)
                if error:
                    self.failed_players[player_id] = error
                    self.player_results[player_id] = False
                    print(f"Player {player_id} ({game_name}): FAILED - {error}")
                    self.status = GenOutcome.Failure
                else:
                    self.player_results[player_id] = True
                    print(f"Player {player_id} ({game_name}): PASSED")
            except Exception as e:
                self.failed_players[player_id] = str(e)
                self.player_results[player_id] = False
                print(f"Player {player_id} ({game_name}): ERROR - {e}")
                self.status = GenOutcome.Failure

    def reclassify_outcome(self, outcome, exc):
        # If TrackerCore generation failed with a fill-related exception, treat as ignored
        if exc is not None and self.status is None:
            exc_str = str(exc)
            exc_type = type(exc).__name__
            if "Not enough filler/trap items" in exc_str or "filler" in exc_str.lower():
                return GenOutcome.OptionError, exc
            if "No more spots to place" in exc_str or "Remaining locations are invalid" in exc_str:
                return GenOutcome.OptionError, exc
            # Handle FillError for accessibility check failures
            if "Could not access required locations for accessibility check" in exc_str:
                return GenOutcome.OptionError, exc
            # Handle FFMQ API errors - the game requires external API for shuffle options
            # but the API may not be available in test environments
            if "Failed to fetch map shuffle data for FFMQ" in exc_str:
                return GenOutcome.OptionError, exc
            # Handle FFMQ's AttributeError when API fails with an exception (ProxyError, etc.)
            if exc_type == "AttributeError" and "status_code" in exc_str:
                return GenOutcome.OptionError, exc
            # Handle Overcooked! 2 option validation errors
            # These occur when the fuzzer generates invalid option combinations
            if "Invalid OC2 settings" in exc_str or "OC2 needs at least" in exc_str:
                return GenOutcome.OptionError, exc
        return (self.status if self.status is not None else outcome), exc

    def get_failed_players(self) -> Dict[int, str]:
        """Return dict of player_id -> failure reason for failed players."""
        return self.failed_players

    def get_player_results(self) -> Dict[int, bool]:
        """Return dict of player_id -> passed for all tested players."""
        return self.player_results
