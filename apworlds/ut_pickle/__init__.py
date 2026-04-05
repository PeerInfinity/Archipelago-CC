"""
Universal Tracker (Pickle Mode) - Improved tracking accuracy via pickle export.

This APWorld provides:
- Pickle-based multiworld export during seed generation (via monkey-patched Main.main)
- Universal Tracker client with pickle mode for improved tracking accuracy
- Toggle between pickle mode and original YAML-based tracking via host.yaml settings

This is a replacement for the standard Universal Tracker APWorld.
Do not install both at the same time.
"""

from worlds.LauncherComponents import Component, components, Type, icon_paths
from settings import Group, Bool, UserFolderPath
from typing import Any, ClassVar, NamedTuple, Callable, Optional
from worlds.AutoWorld import WebWorld, World
from BaseClasses import CollectionState, Entrance
from collections import Counter
from enum import Enum


def launch_client(*args):
    from Utils import messagebox, version_tuple
    if version_tuple < (0, 6, 2):
        from CommonClient import gui_enabled
        if gui_enabled:
            messagebox("Failure", "Running incompatible version of AP; either downgrade UT or upgrade AP", True)
        else:
            print("Running incompatible version of AP; either downgrade UT or upgrade AP")
        return

    from worlds.LauncherComponents import launch
    from .TrackerClient import launch as TCMain
    launch(TCMain, name="Universal Tracker client", args=args)


UT_VERSION = "v0.2.23-pickle"


class CurrentTrackerState(NamedTuple):
    all_items: Counter
    prog_items: Counter
    glitched_locations: list[str]
    events: list[str]
    event_locations: list[str]
    in_logic_locations: list[str]
    in_logic_regions: list[str]
    unconnected_entrances: list[Entrance]
    readable_locations: list[str]
    hinted_locations: list
    state: Optional[CollectionState]
    glitches_state: Optional[CollectionState]

    @staticmethod
    def init_empty_state() -> "CurrentTrackerState":
        return CurrentTrackerState(Counter(), Counter(), [], [], [], [], [], [], [], [], None, None)


class DeferredEntranceMode(Enum):
    """Determines how worlds should be allowed to use deferred entrances
    on: Force worlds to disconnect entrances
    default: Allow worlds to decide if entrances should be deferred
    off: Force worlds to connect all entrances
    """
    forced = "on"
    default = "default"
    disabled = "off"


class TrackerSettings(Group):
    class TrackerPlayersPath(UserFolderPath):
        """Players folder for UT to look for YAMLs"""

    class RegionNameBool(Bool):
        """Show Region names in the UT tab"""

    class LocationNameBool(Bool):
        """Show Location names in the UT tab"""

    class HideExcluded(Bool):
        """Have the UT tab ignore excluded locations"""

    class UseSplitMapIcons(Bool):
        """Use split icons rather than mixed for the UT map tab"""

    class DisplayGlitchedLogic(Bool):
        """Enable showing Glitched/yellow logic in tracker tab"""

    class PickleModeBool(Bool):
        """Enable pickle-based tracking for improved accuracy.
        When enabled, exports a pickle of the multiworld during generation
        and uses it for tracking. When disabled, uses original YAML-based tracking."""

    class SettingDeferredEntranceMode(str):
        """Determines how worlds should be allowed to use deferred entrances
        on: Force worlds to disconnect entrances
        default: Allow worlds to decide if entrances should be deferred
        off: Force worlds to connect all entrances
        """

    player_files_path: TrackerPlayersPath = TrackerPlayersPath("Players")
    include_region_name: RegionNameBool | bool = False
    include_location_name: LocationNameBool | bool = True
    hide_excluded_locations: HideExcluded | bool = False
    use_split_map_icons: UseSplitMapIcons | bool = True
    enforce_deferred_entrances: SettingDeferredEntranceMode | str = "default"
    display_glitched_logic: DisplayGlitchedLogic | bool = True
    pickle_mode: PickleModeBool | bool = True


class TrackerWorldWeb(WebWorld):
    tutorials = []
    game_info_languages = []


class TrackerWorld(World):
    settings: ClassVar[TrackerSettings]
    settings_key = "universal_tracker"

    # to make auto world register happy so we can register our settings
    game = "Universal Tracker"
    hidden = True
    web = TrackerWorldWeb()
    item_name_to_id = {}
    location_name_to_id = {}


class UTMapTabData:
    """The holding class for all the poptracker integration values"""

    map_page_folder: str
    map_page_maps: list[str]
    map_page_locations: list[str]
    map_page_layouts: list[str]
    map_page_groups: list[tuple[str, list]]
    map_page_setting_key: str
    map_page_index: Callable[[Any], int]
    external_pack_key: str
    poptracker_name_mapping: dict[str, int]
    poptracker_entrance_mapping: dict[str, str]
    location_setting_key: str
    location_icon_coords: Callable[[int, Any], tuple[int, int, str] | None]

    def __init__(
            self, player_id, team_id, map_page_folder: str = "", map_page_maps: list[str] | str = "",
            map_page_locations: list[str] | str = "", map_page_layouts: list[str] | str | None = None,
            map_page_groups: list[tuple[str, list]] | None = None,
            map_page_setting_key: str | None = None, map_page_index: Callable[[Any], int] | None = None,
            external_pack_key: str = "", poptracker_name_mapping: dict[str, int] | None = None,
            location_setting_key: str | None = None,
            location_icon_coords: Callable[[int, Any], tuple[int, int]] | None = None,
            poptracker_entrance_mapping: dict[str, str] | None = None, **kwargs):
        self.map_page_folder = map_page_folder
        if isinstance(map_page_maps, str):
            self.map_page_maps = [map_page_maps]
        else:
            self.map_page_maps = map_page_maps
        if isinstance(map_page_locations, str):
            self.map_page_locations = [map_page_locations]
        else:
            self.map_page_locations = map_page_locations
        if isinstance(map_page_layouts, str):
            self.map_page_layouts = [map_page_layouts]
        elif isinstance(map_page_layouts, list):
            self.map_page_layouts = map_page_layouts
        else:
            self.map_page_layouts = []
        self.map_page_groups = map_page_groups
        self.map_page_setting_key = map_page_setting_key
        if isinstance(self.map_page_setting_key, str):
            self.map_page_setting_key = self.map_page_setting_key.format(player=player_id, team=team_id)
        if map_page_index and callable(map_page_index):
            self.map_page_index = map_page_index
        else:
            self.map_page_index = lambda _: 0
        if poptracker_name_mapping:
            self.poptracker_name_mapping = poptracker_name_mapping
        else:
            self.poptracker_name_mapping = {}
        if poptracker_entrance_mapping:
            self.poptracker_entrance_mapping = poptracker_entrance_mapping
        else:
            self.poptracker_entrance_mapping = {}
        self.external_pack_key = external_pack_key
        self.location_setting_key = location_setting_key
        if isinstance(self.location_setting_key, str):
            self.location_setting_key = self.location_setting_key.format(player=player_id, team=team_id)
        if location_icon_coords and callable(location_icon_coords):
            self.location_icon_coords = location_icon_coords
        else:
            self.location_icon_coords = lambda _, __: None


# Register launcher component
icon_paths["ut_ico"] = f"ap:{__name__}/icon.png"
components.append(Component("Universal Tracker", None, func=launch_client, component_type=Type.CLIENT, icon="ut_ico"))

# Auto-install monkey patches for pickle export
try:
    from .monkey_patches import auto_install
    auto_install()
except Exception:
    pass
