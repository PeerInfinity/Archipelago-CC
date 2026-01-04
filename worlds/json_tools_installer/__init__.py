"""
JSON Tools Installer - Install and manage JSON Tools for Archipelago.

This APWorld provides:
- Installer to download JSON Tools from GitHub (stable or dev versions)
- Status checker to verify installation state
- Script launcher for utility scripts
- Patcher to apply/revert core file modifications

Components are available in the Archipelago Launcher after installation.
"""

from worlds.AutoWorld import World

# Import and register launcher components
from . import components as _components


class JSONToolsInstallerWorld(World):
    """
    Minimal hidden world to satisfy AutoWorldRegister.
    JSON Tools Installer is a utility package, not a playable game.
    """
    game = "JSON Tools Installer"
    hidden = True

    # Empty mappings - no actual items or locations
    item_name_to_id = {}
    location_name_to_id = {}

    # Prevent this from being selected as a game
    @classmethod
    def stage_assert_generate(cls, multiworld) -> None:
        raise RuntimeError("JSON Tools Installer is a utility package, not a playable game.")
