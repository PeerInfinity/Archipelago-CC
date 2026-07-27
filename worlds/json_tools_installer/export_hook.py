"""
Post-output hook for JSON rule export and pickle export.

Registered by json_tools_installer to run after seed generation output,
replacing the direct exporter calls that were previously in Main.py.
"""

import functools
import logging
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from BaseClasses import MultiWorld

logger = logging.getLogger(__name__)

_legacy_exporter_warned = False


@functools.lru_cache(maxsize=1)
def exporter_supports_staging_dir() -> Optional[bool]:
    """Whether the installed exporter's export_game_rules accepts staging_dir.

    The installer apworld (custom_worlds/) and the exporter package (installed
    separately by the JSON Tools Installer) update independently, so an older
    exporter must be driven with its old calling convention instead of letting
    the whole export crash on an unexpected keyword. Returns None when the
    exporter is not importable.
    """
    try:
        import inspect
        from exporter import export_game_rules
        return "staging_dir" in inspect.signature(export_game_rules).parameters
    except Exception:
        return None


def _warn_legacy_exporter() -> None:
    global _legacy_exporter_warned
    if _legacy_exporter_warned:
        return
    _legacy_exporter_warned = True
    logger.warning(
        "The installed JSON Tools exporter predates this installer apworld; "
        "using its legacy calling convention. Artifacts are written to the ZIP "
        "staging directory and may be bundled into the hostable AP_<seed>.zip "
        "(a stock WebHost rejects such uploads). Re-run the JSON Tools "
        "Installer with the Development source to update the exporter."
    )


def export_post_output_hook(
    multiworld: "MultiWorld",
    output_dir: str,
    filename_base: str,
    staging_dir: Optional[str] = None,
) -> None:
    """Export game rules and multiworld pickle after output generation.

    Args:
        multiworld: The generated MultiWorld.
        output_dir: Where the JSON Tools artifacts are written — Archipelago's
            output directory, never Main's ZIP staging directory (see
            monkey_patches/hooks.py for why).
        filename_base: Base name for this seed's files, e.g. "AP_<seed>".
        staging_dir: Main's ZIP staging directory, when one exists. Per-world
            output (multidata, spoiler, per-player game files) lives there; it is
            passed through so those files still reach the preset copy, and it is
            what per-world post_output hooks operate on.
    """
    try:
        from exporter import export_game_rules, clear_rule_cache
        from exporter.games import clear_handler_cache
        from exporter.pickle_exporter import export_multiworld_pickle
    except ModuleNotFoundError as e:
        logger.warning(
            "JSON Tools exporter not available (%s); skipping rules export. "
            "Install the Exporter component via the JSON Tools Installer. "
            "On a compiled Archipelago install the exporter package and its "
            "dependencies must be inside the lib/ folder.", e
        )
        return
    from .json_tools_settings import get_json_tools_settings

    # Call per-world post_output hooks (e.g., JTA cost adjustment).
    # Runs before export_game_rules so generated files are included in preset copy.
    # These operate on the staging directory: that is where generate_output wrote
    # the per-world files they read, and where their own output belongs.
    post_output_dir = staging_dir or output_dir
    for player_id, world in multiworld.worlds.items():
        if hasattr(world, "post_output"):
            try:
                world.post_output(post_output_dir, filename_base)
            except Exception as e:
                logger.warning(
                    f"post_output failed for {world.game} player {player_id}: {e}"
                )

    jt = get_json_tools_settings()

    # Auto-detect Rule Builder availability and fall back to ast format if needed.
    # The rule_builder format requires the fork's extended rule_builder package;
    # without it, fall back to ast format which works with vanilla Archipelago.
    rules_format = jt.rules_json_format
    if rules_format in ("rule_builder", "both"):
        try:
            from rule_builder import BOOLEAN_RULE_TYPES  # noqa: F401
        except (ImportError, AttributeError):
            logger.info(
                "Extended Rule Builder not available, falling back to 'ast' format "
                "(was '%s')", rules_format
            )
            rules_format = "ast"

    # Export rules data after create_playthrough so sphere_log.jsonl is included.
    # The exporter uses cached _cached_slot_data instead of calling fill_slot_data,
    # so it won't repopulate caches that were cleared by stage_modify_multidata.
    if exporter_supports_staging_dir():
        export_game_rules(
            multiworld,
            output_dir,
            filename_base,
            jt.update_frontend_presets,
            jt.skip_preset_copy_if_rules_identical,
            rules_format,
            clear_game_presets=jt.clear_game_presets,
            clear_all_presets=jt.clear_all_presets,
            staging_dir=staging_dir,
        )
    else:
        # Legacy exporter: no staging_dir parameter, and its preset copy
        # mirrors whatever directory it writes into — so reproduce the old
        # behavior exactly (artifacts into the staging dir). Without a staging
        # dir (spoiler-disabled fallback path) that mirroring would sweep the
        # whole shared output directory into the presets, so skip instead.
        _warn_legacy_exporter()
        if staging_dir is None:
            logger.warning(
                "Legacy exporter with no staging directory available "
                "(spoiler-disabled fallback); skipping rules export."
            )
        else:
            export_game_rules(
                multiworld,
                staging_dir,
                filename_base,
                jt.update_frontend_presets,
                jt.skip_preset_copy_if_rules_identical,
                rules_format,
                clear_game_presets=jt.clear_game_presets,
                clear_all_presets=jt.clear_all_presets,
            )
    # Clear exporter caches to allow GC
    clear_rule_cache()
    clear_handler_cache()

    # Export multiworld as pickle for tracker (alternative to rules_json)
    export_multiworld_pickle(
        multiworld,
        output_dir,
        filename_base,
        jt.update_frontend_presets,
        jt.skip_preset_copy_if_rules_identical,
    )
