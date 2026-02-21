"""
Post-output hook for JSON rule export and pickle export.

Registered by json_tools_installer to run after seed generation output,
replacing the direct exporter calls that were previously in Main.py.
"""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from BaseClasses import MultiWorld

logger = logging.getLogger(__name__)


def export_post_output_hook(multiworld: "MultiWorld", output_dir: str, filename_base: str) -> None:
    """Export game rules and multiworld pickle after output generation."""
    from settings import get_settings
    from exporter import export_game_rules, clear_rule_cache
    from exporter.games import clear_handler_cache
    from exporter.pickle_exporter import export_multiworld_pickle

    settings = get_settings()

    # Export rules data after create_playthrough so sphere_log.jsonl is included.
    # The exporter uses cached _cached_slot_data instead of calling fill_slot_data,
    # so it won't repopulate caches that were cleared by stage_modify_multidata.
    export_game_rules(
        multiworld,
        output_dir,
        filename_base,
        settings.general_options.update_frontend_presets,
        settings.general_options.skip_preset_copy_if_rules_identical,
        settings.general_options.rules_json_format,
        clear_game_presets=settings.general_options.clear_game_presets,
        clear_all_presets=settings.general_options.clear_all_presets,
    )
    # Clear exporter caches to allow GC
    clear_rule_cache()
    clear_handler_cache()

    # Export multiworld as pickle for tracker (alternative to rules_json)
    export_multiworld_pickle(
        multiworld,
        output_dir,
        filename_base,
        settings.general_options.update_frontend_presets,
        settings.general_options.skip_preset_copy_if_rules_identical,
    )
