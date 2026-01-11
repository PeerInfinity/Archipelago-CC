from fuzz import BaseHook, GenOutcome
from typing import List, Dict, Set, Any
import collections
import json
import logging
import os
from . import TrackerCore, DeferredEntranceMode
from BaseClasses import MultiWorld,Location,ItemClassification
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
        Collect explain support statistics for locations in the worldgen world.

        This checks the world generated by TrackerCore from rules.json, which uses
        the Rule Builder. The goal is to measure how many locations have rules
        with explain_json() support.

        Counts:
        - total_locations: Total number of locations with addresses
        - locations_with_explain: Locations whose access_rule has explain_json method
        - locations_default_rule: Locations using default access_rule (always True)
        - locations_without_explain: Locations with custom rules but no explain_json
        """
        try:
            # Use the worldgen multiworld from TrackerCore
            worldgen_mw = self.ut_core.multiworld
            if not worldgen_mw:
                logger.warning("No worldgen multiworld available for explain stats")
                return

            world = worldgen_mw.worlds[self.ut_core.player_id]
            locations = list(world.get_locations())

            total_locations = 0
            locations_with_explain = 0
            locations_default_rule = 0
            locations_without_explain = 0

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

            # Calculate explain coverage percentage
            # Locations with custom rules that have explain support
            custom_rule_locations = locations_with_explain + locations_without_explain
            explain_coverage = (locations_with_explain / custom_rule_locations * 100) if custom_rule_locations > 0 else 100.0

            stats = {
                "game": world.game,
                "total_locations": total_locations,
                "locations_with_explain": locations_with_explain,
                "locations_default_rule": locations_default_rule,
                "locations_without_explain": locations_without_explain,
                "explain_coverage_percent": round(explain_coverage, 2)
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
            # Handle various fill-related errors that are caused by option configurations
            if "Not enough filler/trap items" in exc_str or "filler" in exc_str.lower():
                return GenOutcome.OptionError, exc
            # Handle FillError when options create impossible-to-fill seeds
            # (e.g., accessibility: minimal combined with level_shuffle in SMW)
            if "No more spots to place" in exc_str or "Remaining locations are invalid" in exc_str:
                return GenOutcome.OptionError, exc
        return (self.status if self.status is not None else outcome), exc
