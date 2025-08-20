import json
import os
import logging
from typing import Set, List, Dict, Optional, Union, TYPE_CHECKING
from itertools import chain

if TYPE_CHECKING:
    from BaseClasses import MultiWorld, CollectionState, Location, Spoiler, Item

def log_sphere_details(file_handler, multiworld: "MultiWorld", sphere_index: Union[int, str],
                       current_sphere_locations: Set["Location"],
                       current_collection_state: "CollectionState") -> None:
    """Logs details of the current sphere to the provided file handler."""
    if not file_handler:
        logging.warning("Spoiler log file not open. Cannot log sphere details.")
        return

    try:
        player_specific_data = {}
        for player_id in multiworld.player_ids:
            prog_items = {item_name: count for item_name, count in current_collection_state.prog_items.get(player_id, {}).items()}
            
            # non_prog_items logic remains difficult to source reliably from CollectionState
            # It primarily tracks prog_items. Logging empty for now.
            non_prog_items = {}

            inventory_details = {
                "prog_items": prog_items,
                "non_prog_items": non_prog_items 
            }

            accessible_locations = []
            if multiworld:
                accessible_locations = sorted([
                    loc.name for loc in multiworld.get_locations(player_id)
                    if loc.can_reach(current_collection_state)
                ])

            accessible_regions = []
            if multiworld:
                accessible_regions = sorted([
                    reg.name for reg in multiworld.get_regions(player_id)
                    if reg.can_reach(current_collection_state)
                ])
            
            player_specific_data[player_id] = {
                "inventory_details": inventory_details,
                "accessible_locations": accessible_locations,
                "accessible_regions": accessible_regions
            }
        
        sphere_location_names = sorted([loc.name for loc in current_sphere_locations])

        log_entry = {
            "type": "state_update",
            "sphere_index": sphere_index,
            "sphere_locations": sphere_location_names,
            "player_data": player_specific_data,
        }
        
        file_handler.write(json.dumps(log_entry) + "\n")
        file_handler.flush()

    except Exception as e:
        logging.error(f"Error during spoiler sphere logging for sphere {sphere_index}: {e}")


def create_playthrough_with_logging(spoiler: "Spoiler", create_paths: bool = True) -> None:
    """
    Enhanced version of create_playthrough that adds sphere logging.
    Destructive to the multiworld while it is run, damage gets repaired afterwards.
    """
    from settings import get_settings
    from BaseClasses import CollectionState
    
    settings = get_settings()
    
    # Set up logging
    log_fractional_sphere_details = settings.general_options.log_fractional_sphere_details
    log_integer_sphere_details = settings.general_options.log_integer_sphere_details
    
    spoiler_log_file_handler = None
    log_file_path = ""
    
    try:
        # Use temp_dir from multiworld if available for spheres_log.jsonl, otherwise fallback to output_path
        log_output_directory = getattr(spoiler.multiworld, 'temp_dir_for_spheres_log', None)

        if log_output_directory is None:
            log_output_directory = getattr(spoiler.multiworld, 'output_path', 'output')
            if not os.path.exists(log_output_directory):
                os.makedirs(log_output_directory, exist_ok=True)
        
        log_filename = f"AP_{spoiler.multiworld.seed_name}_spheres_log.jsonl"
        log_file_path = os.path.join(log_output_directory, log_filename)
        
        logging.info(f"Attempting to open spoiler log file for sphere data at: {log_file_path}")
        spoiler_log_file_handler = open(log_file_path, "w")
        logging.info(f"Spoiler sphere log will be written to: {log_file_path}")
    except Exception as e:
        logging.error(f"Failed to open spoiler log file {log_file_path}: {e}")
        spoiler_log_file_handler = None
    
    try:
        # Main implementation with logging
        multiworld = spoiler.multiworld
        prog_locations = {location for location in multiworld.get_filled_locations() if location.item.advancement}
        state_cache: List[Optional[CollectionState]] = [None]
        # collection_spheres will be redefined later for the final pass
        initial_collection_spheres: List[Set["Location"]] = []
        state = CollectionState(multiworld)
        sphere_candidates = set(prog_locations)
        
        logging.debug('Building up initial collection spheres for pruning.')
        while sphere_candidates:
            sphere = {location for location in sphere_candidates if state.can_reach(location)}
            for location in sphere:
                state.collect(location.item, True, location)
            sphere_candidates -= sphere
            initial_collection_spheres.append(sphere)
            state_cache.append(state.copy())
            logging.debug('Calculated initial sphere %i, containing %i of %i progress items.', 
                          len(initial_collection_spheres), len(sphere), len(prog_locations))
            if not sphere:
                if any([multiworld.worlds[location.item.player].options.accessibility != 'minimal' for location in sphere_candidates]):
                    raise RuntimeError(f'Not all progression items reachable ({sphere_candidates}). Something went wrong.')
                else:
                    spoiler.unreachables = sphere_candidates
                    break
        
        # Pruning phase
        restore_later: Dict["Location", "Item"] = {}
        for num, sphere in reversed(tuple(enumerate(initial_collection_spheres))):
            to_delete: Set["Location"] = set()
            for location in sphere:
                old_item = location.item
                location.item = None
                if multiworld.can_beat_game(state_cache[num]):
                    to_delete.add(location)
                    restore_later[location] = old_item
                else:
                    location.item = old_item
            sphere -= to_delete
            initial_collection_spheres[num] = sphere

        # Precollected items phase
        removed_precollected: List["Item"] = []
        for player_id in multiworld.player_ids:
            if player_id in multiworld.precollected_items:
                player_precollected = multiworld.precollected_items[player_id]
                for item in player_precollected[:]:  # Iterate over a copy
                    if not item.advancement:
                        continue
                    player_precollected.remove(item)
                    multiworld.state.remove(item)
                    if not multiworld.can_beat_game():
                        multiworld.push_precollected(item)
                    else:
                        removed_precollected.append(item)
        
        # Final sphere calculation pass
        required_locations = {loc for sphere_set in initial_collection_spheres for loc in sphere_set}
        
        # Initialize current_playthrough_state for logging
        current_playthrough_state = CollectionState(multiworld)
        for p_id in current_playthrough_state.prog_items:
            current_playthrough_state.prog_items[p_id].clear()
        current_playthrough_state.advancements.clear()
        current_playthrough_state.locations_checked.clear()

        if spoiler_log_file_handler:
            # Log precollected items one by one for "0.x" spheres
            precollected_advancement_items = sorted(
                [item for p_items in multiworld.precollected_items.values() for item in p_items if item.advancement],
                key=lambda item: (item.player, item.name)
            )
            
            sub_index_sphere0 = 0
            for item in precollected_advancement_items:
                current_playthrough_state.collect(item, True)  # Collect into the accumulating state, prevent sweep
                sub_index_sphere0 += 1
                if log_fractional_sphere_details:
                    log_sphere_details(spoiler_log_file_handler, multiworld,
                                     f"0.{sub_index_sphere0}",
                                     set(), 
                                     current_playthrough_state.copy())

            # Log the final "sphere 0" state
            log_sphere_details(spoiler_log_file_handler, multiworld, 0, set(), current_playthrough_state.copy())
        
        if not spoiler_log_file_handler:
            # If not logging, ensure state includes precollected items for main loop
            current_playthrough_state = CollectionState(multiworld)

        # This is the list that will store the final spheres for the text spoiler output
        final_collection_spheres: List[Set["Location"]] = []
        main_sphere_index_counter = 0

        while required_locations:
            main_sphere_index_counter += 1
            current_full_sphere_locations = {loc for loc in required_locations if current_playthrough_state.can_reach(loc)}

            if not current_full_sphere_locations and required_locations:
                raise RuntimeError(f'Not all required items reachable. Unreachable locations: {required_locations}')

            # Sort locations in the sphere for deterministic item collection order
            sorted_locations_in_sphere = sorted(list(current_full_sphere_locations), key=lambda loc: (loc.player, loc.name))

            item_sub_index = 0
            for location in sorted_locations_in_sphere:
                # Collect one item
                current_playthrough_state.collect(location.item, True, location)
                item_sub_index += 1
                
                # Log after this single item
                if spoiler_log_file_handler and log_fractional_sphere_details:
                    sub_sphere_label = f"{main_sphere_index_counter - 1}.{item_sub_index}"
                    log_sphere_details(spoiler_log_file_handler, multiworld,
                                     sub_sphere_label,
                                     {location},  # The single location collected in this sub-step
                                     current_playthrough_state.copy())

            # After all items in the current_full_sphere_locations are processed individually:
            final_collection_spheres.append(current_full_sphere_locations)

            # Log the state for the full sphere
            if spoiler_log_file_handler and log_integer_sphere_details:
                log_sphere_details(spoiler_log_file_handler, multiworld,
                                 main_sphere_index_counter,  # Integer index for the full sphere
                                 current_full_sphere_locations,  # All locations making up this sphere
                                 current_playthrough_state.copy())  # State AFTER all items in this sphere are collected
            
            logging.debug('Calculated final sphere %i, containing %i of %i progress items.', 
                          main_sphere_index_counter, len(current_full_sphere_locations), len(required_locations))

            required_locations -= current_full_sphere_locations
        
        # Populate spoiler.playthrough for the text spoiler using final_collection_spheres
        spoiler.playthrough = {"0": sorted([spoiler.multiworld.get_name_string_for_object(item) for player_items in
                                         multiworld.precollected_items.values() for item in player_items if item.advancement])}
        for i, sphere_content in enumerate(final_collection_spheres):
            spoiler.playthrough[str(i + 1)] = {
                str(location): str(location.item) for location in sorted(list(sphere_content))}

        if create_paths:
            spoiler.create_paths(current_playthrough_state, final_collection_spheres)

    finally:
        if spoiler_log_file_handler:
            try:
                spoiler_log_file_handler.close()
                logging.info(f"Closed spoiler log file: {log_file_path}")
            except Exception as e:
                logging.error(f"Error closing spoiler log file {log_file_path}: {e}")

        # Repair the multiworld
        for location, item in restore_later.items():
            location.item = item
        for item in removed_precollected:
            multiworld.push_precollected(item)

