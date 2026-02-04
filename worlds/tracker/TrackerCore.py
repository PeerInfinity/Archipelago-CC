"""
Extended TrackerCore with Worldgen and Testing Support

This module provides TrackerCore, an extended version of TrackerCoreBase that adds:
- Worldgen world integration for rule explain support
- Direct AST rule explanation from JSON rules files
- Testing mode with lenient error handling
- Debug logging support

For upstream compatibility, TrackerCoreBase contains the original TrackerCore code
(matching upstream FarisTheAncient/Archipelago). This extended version adds our
modifications via mixins, making it easier to merge upstream updates.

Usage:
    from worlds.tracker.TrackerCore import TrackerCore
    # or
    from worlds.tracker import TrackerCore
"""

import logging
from collections import Counter
from typing import Any, Optional, TYPE_CHECKING

from BaseClasses import CollectionState, LocationProgressType, ItemClassification
from . import CurrentTrackerState, UT_VERSION, DeferredEntranceMode
from .TrackerCoreBase import TrackerCoreBase
from .worldgen_mixin import WorldgenMixin
from .tracker_extensions import TrackerTestingMixin
from Utils import __version__

if TYPE_CHECKING:
    from BaseClasses import MultiWorld


class TrackerCore(WorldgenMixin, TrackerTestingMixin, TrackerCoreBase):
    """
    Extended TrackerCore with worldgen and testing support.

    This class combines:
    - TrackerCoreBase: Original UT functionality (matches upstream)
    - WorldgenMixin: Worldgen world integration and AST explain
    - TrackerTestingMixin: Testing mode and debug logging

    The mixins add new methods and override behavior where needed,
    while keeping TrackerCoreBase close to upstream for easier merging.
    """

    def __init__(self, logger: logging.Logger, print_list: bool, print_count: bool) -> None:
        """Initialize TrackerCore with extensions."""
        # Initialize base class
        super().__init__(logger, print_list, print_count)

        # Initialize mixins
        self._init_worldgen_mixin()
        self._init_testing_mixin()

    def disconnect(self):
        """Disconnect and clear all state including extensions."""
        # Clear mixin state
        self._disconnect_worldgen_mixin()

        # Call base disconnect
        super().disconnect()

    def initalize_tracker_core(self, connected_cls, raw_slot_data):
        """
        Initialize tracker core with worldgen support.

        This overrides the base initalize_tracker_core to try worldgen-based
        tracking first when rules.json is available, falling back to standard
        YAML-based tracking if worldgen fails.
        """
        if getattr(connected_cls, "disable_ut", False):
            self.log_to_tab("World Author has requested UT be disabled on this world, please respect their decision")
            return

        self._log_debug("initalize_tracker_core", {"rules_json_path": self.rules_json_path})

        # Try worldgen-based tracking if rules.json is available.
        # The presence of rules.json indicates the exporter ran and produced rules.
        # In "hybrid" mode (skip_export_for_native_ut=True), the exporter skips rule
        # generation for worlds with native UT support, so rules.json won't exist.
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

        # Fall back to base class YAML-based tracking
        super().initalize_tracker_core(connected_cls, raw_slot_data)

    def updateTracker(self) -> CurrentTrackerState:
        """
        Update tracker state with extension support.

        This overrides the base updateTracker to add:
        - Lenient error handling in sphere_log_mode
        - Configurable event filtering
        - Server-trusted item classification
        """
        if self.player_id is None or self.multiworld is None:
            self.logger.error("Player YAML not installed or Generator failed")
            self.set_page(f"Check Player YAMLs for error; Tracker {UT_VERSION} for AP version {__version__}")
            return CurrentTrackerState.init_empty_state()

        state = CollectionState(self.multiworld, self.enforce_deferred_connections != DeferredEntranceMode.disabled)
        prog_items = Counter()
        all_items = Counter()

        callback_list: list[str] = []
        glitches_callback_list: list[str] = []

        item_id_to_name = self.multiworld.worlds[self.player_id].item_id_to_name
        location_id_to_name = self.multiworld.worlds[self.player_id].location_id_to_name

        # Check for invalid items
        invalid_items = [str(item.item) for item in self.tracker_items_received if item.item not in item_id_to_name]
        if invalid_items:
            if self.sphere_log_mode:
                # In sphere_log_mode: Log warning but don't throw
                self.logger.warning(
                    f"Skipping {len(invalid_items)} unknown items (datapackage mismatch?): "
                    f"{invalid_items[:5]}{'...' if len(invalid_items) > 5 else ''}"
                )
            else:
                # Normal mode: throw an exception (original behavior)
                print(invalid_items)
                self.logger.error("Your datapackage is incorrect, please correct the apworld for " + str(self.game))
                self.logger.error("The Following items are unknown [" + ",".join(invalid_items) + "]")
                raise Exception("Your datapackage is incorrect, please correct the apworld for " + str(self.game))

        # Filter to only valid items in sphere_log_mode
        items_to_process = self._filter_invalid_items(self.tracker_items_received, item_id_to_name)

        for item_name, item_flags, item_loc, item_player in [
            (item_id_to_name[item.item], item.flags, item.location, item.player)
            for item in items_to_process if item.item in item_id_to_name
        ] + [(name, ItemClassification.progression, -1, -1) for name in self.manual_items]:
            try:
                world_item = self.multiworld.create_item(item_name, self.player_id)
                if item_loc > 0 and item_player == self.slot and item_loc in location_id_to_name:
                    world_item.location = self.multiworld.get_location(location_id_to_name[item_loc], self.player_id)
                # Use server's item_flags directly for classification
                world_item.classification = item_flags
                state.collect(world_item, True)
                if world_item.advancement:
                    prog_items[world_item.name] += 1
                if self._should_include_item_in_count(world_item):
                    all_items[world_item.name] += 1
            except Exception:
                self.log_to_tab("Item id " + str(item_name) + " not able to be created", False)

        if self._should_sweep_for_advancements():
            state.sweep_for_advancements(
                locations=[location for location in self.multiworld.get_locations(self.player_id) if not location.address]
            )

        self.clear_page()
        regions = []
        locations = []
        readable_locations = []
        glitches_locations: list[int] = []
        hinted_locations = []

        for temp_loc in self.multiworld.get_reachable_locations(state, self.player_id):
            address_is_none_or_list = temp_loc.address is None or isinstance(temp_loc.address, list)
            if not self._should_include_location(temp_loc, address_is_none_or_list):
                continue
            elif self.hide_excluded and temp_loc.progress_type == LocationProgressType.EXCLUDED:
                continue
            elif temp_loc.address in self.ignored_locations:
                continue
            try:
                if temp_loc.address in self.missing_locations:
                    region = ""
                    if temp_loc.parent_region is not None:
                        region = temp_loc.parent_region.name
                    temp_name = temp_loc.name
                    if temp_loc.address in self.location_alias_map:
                        temp_name += f" ({self.location_alias_map[temp_loc.address]})"
                    if self.output_format == "Both":
                        if temp_loc.progress_type == LocationProgressType.EXCLUDED:
                            self.log_to_tab("[color=" + self.get_ut_color("excluded") + "]" + region + " | " + temp_name + "[/color]", True)
                        elif temp_loc.address in self.hints:
                            self.log_to_tab("[color=" + self.get_ut_color("hinted") + "]" + region + " | " + temp_name + "[/color]", True)
                            hinted_locations.append(temp_loc)
                        else:
                            self.log_to_tab(region + " | " + temp_name, True)
                        readable_locations.append(region + " | " + temp_name)
                    elif self.output_format == "Location":
                        if temp_loc.progress_type == LocationProgressType.EXCLUDED:
                            self.log_to_tab("[color=" + self.get_ut_color("excluded") + "]" + temp_name + "[/color]", True)
                        elif temp_loc.address in self.hints:
                            self.log_to_tab("[color=" + self.get_ut_color("hinted") + "]" + temp_name + "[/color]", True)
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

        events = [location.item.name for location in state.advancements if location.player == self.player_id and location.item is not None]
        event_locations = [location.name for location in state.advancements if location.player == self.player_id]
        unconnected_entrances = [
            entrance for region in state.reachable_regions[self.player_id]
            for entrance in region.exits if entrance.can_reach(state) and entrance.connected_region is None
        ]

        self.locations_available = locations
        glitches_item_name = getattr(self.multiworld.worlds[self.player_id], "glitches_item_name", "")
        glitches_state = state.copy()
        if glitches_item_name:
            try:
                world_item = self.multiworld.create_item(glitches_item_name, self.player_id)
                glitches_state.collect(world_item, True)
            except Exception:
                self.log_to_tab("Item id " + str(glitches_item_name) + " not able to be created", False)
            else:
                glitches_state.sweep_for_advancements(
                    locations=[location for location in self.multiworld.get_locations(self.player_id) if not location.address]
                )
                for temp_loc in self.multiworld.get_reachable_locations(glitches_state, self.player_id):
                    if temp_loc.address is None or isinstance(temp_loc.address, list):
                        continue
                    elif self.hide_excluded and temp_loc.progress_type == LocationProgressType.EXCLUDED:
                        continue
                    elif temp_loc.address in self.ignored_locations:
                        continue
                    elif temp_loc.address in locations:
                        continue  # already in logic
                    try:
                        if temp_loc.address in self.missing_locations:
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
                                        self.log_to_tab("[color=" + self.get_ut_color("out_of_logic_glitched") + "]" + region + " | " + temp_name + "[/color]", True)
                                    elif temp_loc.address in self.hints:
                                        self.log_to_tab("[color=" + self.get_ut_color("hinted_glitched") + "]" + region + " | " + temp_name + "[/color]", True)
                                        hinted_locations.append(temp_loc)
                                    else:
                                        self.log_to_tab("[color=" + self.get_ut_color("glitched") + "]" + region + " | " + temp_name + "[/color]", True)
                                    readable_locations.append(region + " | " + temp_name)
                                elif self.output_format == "Location":
                                    if temp_loc.progress_type == LocationProgressType.EXCLUDED:
                                        self.log_to_tab("[color=" + self.get_ut_color("out_of_logic_glitched") + "]" + temp_name + "[/color]", True)
                                    elif temp_loc.address in self.hints:
                                        self.log_to_tab("[color=" + self.get_ut_color("hinted_glitched") + "]" + temp_name + "[/color]", True)
                                        hinted_locations.append(temp_loc)
                                    else:
                                        self.log_to_tab("[color=" + self.get_ut_color("glitched") + "]" + temp_name + "[/color]", True)
                                    readable_locations.append(temp_name)
                            if region not in regions:
                                regions.append(region)
                                if self.output_format == "Region" and self.enable_glitched_logic:
                                    self.log_to_tab("[color=" + self.get_ut_color("glitched") + "]" + region + "[/color]", True)
                                    readable_locations.append(region)
                    except Exception:
                        self.log_to_tab("ERROR: location " + temp_loc.name + " broke something, report this to discord")
                        pass
        self.glitched_locations = glitches_locations

        return CurrentTrackerState(
            all_items, prog_items, glitches_callback_list, events, event_locations,
            callback_list, regions, unconnected_entrances, readable_locations,
            hinted_locations, state, glitches_state
        )
