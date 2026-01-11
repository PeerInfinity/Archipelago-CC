from fuzz import BaseHook, GenOutcome
from typing import List, Dict, Set, Optional
import collections
import logging
from . import TrackerCore, DeferredEntranceMode
from BaseClasses import MultiWorld,Location,ItemClassification
from NetUtils import NetworkItem
logger = logging.getLogger("Fuzzer")


class Hook(BaseHook):
    ut_core:TrackerCore.TrackerCore
    player_files_path:str
    status = None

    def before_generate(self, args):
        self.status = None
        self.player_files_path = args.player_files_path
        self.ut_core = TrackerCore.TrackerCore(logger,False,False)
        self.ut_core.enforce_deferred_connections = DeferredEntranceMode.disabled
        self.ut_core.run_generator(None,None,args.player_files_path) #initial UT gen

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
            if "Not enough filler/trap items" in exc_str or "filler" in exc_str.lower():
                return GenOutcome.OptionError, exc
            if "No more spots to place" in exc_str or "Remaining locations are invalid" in exc_str:
                return GenOutcome.OptionError, exc
        return (self.status if self.status is not None else outcome), exc

    def get_failed_players(self) -> Dict[int, str]:
        """Return dict of player_id -> failure reason for failed players."""
        return self.failed_players

    def get_player_results(self) -> Dict[int, bool]:
        """Return dict of player_id -> passed for all tested players."""
        return self.player_results
