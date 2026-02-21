"""
Runtime monkey patching hooks for JSON Tools.

This module provides runtime patches for Archipelago core files when
file-based patching is not available or desired. This is used as a
fallback for AP versions without pre-made patches.

The hooks wrap core functions to add JSON export functionality without
modifying the actual source files.

Usage:
    from worlds.json_tools_installer.monkey_patches import install_hooks, uninstall_hooks

    # Install all hooks
    install_hooks()

    # Or install selectively
    install_hooks(export_rules=True, sphere_logging=False)

    # Uninstall hooks
    uninstall_hooks()
"""

import functools
import logging
import tempfile
from typing import Callable, Optional, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from BaseClasses import MultiWorld

logger = logging.getLogger(__name__)

# Track installed hooks for cleanup
_installed_hooks = {}
_original_functions = {}

# Module-level state for communication between hooks
_module_state = {}


def is_main_patched() -> bool:
    """
    Check if Main.py has hook support for post-output callbacks.

    Detects the hook system (call_post_output_hooks from worlds.Hooks).
    If present, monkey patching is not needed.

    Returns:
        True if Main.py has hook support, False otherwise.
    """
    try:
        import Main
        return hasattr(Main, 'call_post_output_hooks')
    except ImportError:
        return False


def is_baseclasses_patched() -> bool:
    """
    Check if BaseClasses.py has been file-patched with sphere logging.

    The file patch adds a check for save_sphere_log at the start of
    Spoiler.create_playthrough(). We detect this by inspecting the
    source code of the method.

    Returns:
        True if BaseClasses.py has the file patch applied, False otherwise.
    """
    try:
        import BaseClasses
        import inspect

        # Get the source code of create_playthrough
        source = inspect.getsource(BaseClasses.Spoiler.create_playthrough)

        # The file patch adds this import within create_playthrough
        return 'create_playthrough_with_logging' in source
    except (ImportError, OSError, TypeError):
        # OSError can occur if source is not available
        # TypeError can occur if it's a built-in
        return False


def are_file_patches_applied() -> bool:
    """
    Check if file patches have been applied to core Archipelago files.

    Returns:
        True if both Main.py and BaseClasses.py have been patched.
    """
    return is_main_patched() and is_baseclasses_patched()


def install_hooks(
    export_rules: bool = True,
    sphere_logging: bool = True,
) -> dict:
    """
    Install runtime hooks into Archipelago core.

    Args:
        export_rules: Install hook for exporting rules JSON after generation.
        sphere_logging: Install hook for sphere log generation.

    Returns:
        Dictionary of installed hook names and their status.
    """
    results = {}

    if export_rules:
        results["export_rules"] = _install_export_hook()

    if sphere_logging:
        results["sphere_logging"] = _install_sphere_logging_hook()

    return results


def uninstall_hooks() -> dict:
    """
    Uninstall all runtime hooks and restore original functions.

    Returns:
        Dictionary of uninstalled hook names and their status.
    """
    results = {}

    for hook_name, (module, attr, original) in list(_original_functions.items()):
        try:
            setattr(module, attr, original)
            del _original_functions[hook_name]
            del _installed_hooks[hook_name]
            results[hook_name] = True
            logger.info(f"Uninstalled hook: {hook_name}")
        except Exception as e:
            results[hook_name] = False
            logger.error(f"Failed to uninstall hook {hook_name}: {e}")

    return results


def is_hook_installed(hook_name: str) -> bool:
    """Check if a specific hook is installed."""
    return hook_name in _installed_hooks


def get_installed_hooks() -> list:
    """Get list of currently installed hook names."""
    return list(_installed_hooks.keys())


def _install_export_hook() -> bool:
    """
    Install hook to export rules JSON after seed generation.

    This wraps Main.main() to call the exporter after generation completes.
    Skips installation if Main.py already has file patches applied.
    """
    hook_name = "export_rules"

    if hook_name in _installed_hooks:
        logger.warning(f"Hook {hook_name} already installed")
        return True

    # Check if file patch is already applied
    if is_main_patched():
        logger.info(f"Skipping {hook_name} hook: Main.py already has file patch applied")
        return True

    try:
        import Main

        original_main = Main.main
        _original_functions[hook_name] = (Main, "main", original_main)

        @functools.wraps(original_main)
        def hooked_main(*args, **kwargs):
            """Wrapped Main.main that exports rules and/or pickle after generation."""
            import os

            # Set up output directory for sphere logging before generation runs
            # This ensures sphere_log.jsonl goes to a consistent location
            # The file patch normally sets multiworld.temp_dir_for_sphere_log,
            # but we need to set it via a different mechanism since we don't
            # have the multiworld object until after main() returns.
            # We use the 'output' directory as a fallback location.
            output_dir = 'output'
            if args and hasattr(args[0], 'outputpath') and args[0].outputpath:
                output_dir = args[0].outputpath
            os.makedirs(output_dir, exist_ok=True)

            # Store the output directory for _post_generation_export to find
            _module_state['output_dir'] = output_dir

            result = original_main(*args, **kwargs)

            # result is the multiworld object
            multiworld = result

            # Try to export after successful generation
            # The export functions handle their own decision logic internally
            if multiworld is not None:
                try:
                    _post_generation_export(multiworld)
                except Exception as e:
                    logger.warning(f"Post-generation export failed: {e}")

            return result

        Main.main = hooked_main
        _installed_hooks[hook_name] = hooked_main
        logger.info(f"Installed hook: {hook_name}")
        return True

    except ImportError as e:
        logger.error(f"Could not import Main module: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to install {hook_name} hook: {e}")
        return False


def _install_sphere_logging_hook() -> bool:
    """
    Install hook for sphere log generation during playthrough creation.

    This wraps Spoiler.create_playthrough() to log sphere information.
    Skips installation if BaseClasses.py already has file patches applied.
    """
    hook_name = "sphere_logging"

    if hook_name in _installed_hooks:
        logger.warning(f"Hook {hook_name} already installed")
        return True

    # Check if file patch is already applied
    if is_baseclasses_patched():
        logger.info(f"Skipping {hook_name} hook: BaseClasses.py already has file patch applied")
        return True

    try:
        import BaseClasses

        original_create_playthrough = BaseClasses.Spoiler.create_playthrough
        _original_functions[hook_name] = (
            BaseClasses.Spoiler, "create_playthrough", original_create_playthrough
        )

        @functools.wraps(original_create_playthrough)
        def hooked_create_playthrough(self, create_paths: bool = True):
            """Wrapped create_playthrough that logs sphere information."""
            # Check if sphere logging is enabled (with fallback to installer config)
            try:
                from ..config import get_export_setting
                if get_export_setting('save_sphere_log', False):
                    return _create_playthrough_with_logging(
                        self, create_paths, original_create_playthrough
                    )
            except (ImportError, AttributeError):
                pass

            # Fall through to original
            return original_create_playthrough(self, create_paths)

        BaseClasses.Spoiler.create_playthrough = hooked_create_playthrough
        _installed_hooks[hook_name] = hooked_create_playthrough
        logger.info(f"Installed hook: {hook_name}")
        return True

    except ImportError as e:
        logger.error(f"Could not import BaseClasses module: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to install {hook_name} hook: {e}")
        return False


def _post_generation_export(multiworld: "MultiWorld"):
    """
    Called after generation to export rules JSON and/or pickle.

    This mirrors the export calls in Main.py but works via monkey patching.
    The export functions handle their own decision logic internally based
    on settings, so we just call them and let them decide whether to export.

    Args:
        multiworld: The MultiWorld object from generation
    """
    import os
    import shutil
    from ..config import get_export_setting

    # Build the filename base from seed_name
    seed_name = getattr(multiworld, 'seed_name', None)
    if not seed_name:
        logger.warning("Cannot export: multiworld has no seed_name")
        return

    filename_base = f"AP_{seed_name}"

    # Get export settings (falls back to installer config if host.yaml doesn't have them)
    update_presets = get_export_setting('update_frontend_presets', False)
    skip_if_identical = get_export_setting('skip_preset_copy_if_rules_identical', False)
    rules_format = get_export_setting('rules_json_format', 'rule_builder')
    clear_game_presets = get_export_setting('clear_game_presets', False)
    clear_all_presets = get_export_setting('clear_all_presets', False)

    # Find where the sphere_log was written by the sphere_logging hook
    # It writes to temp_dir_for_sphere_log, output_path, or 'output' directory
    sphere_log_filename = f"{filename_base}_sphere_log.jsonl"
    sphere_log_source = None

    # Check possible locations in order of preference
    # Include the output_dir stored by hooked_main if available
    possible_dirs = [
        getattr(multiworld, 'temp_dir_for_sphere_log', None),
        _module_state.get('output_dir'),
        getattr(multiworld, 'output_path', None),
        'output',
    ]
    for check_dir in possible_dirs:
        if check_dir and os.path.isdir(check_dir):
            check_path = os.path.join(check_dir, sphere_log_filename)
            if os.path.exists(check_path):
                sphere_log_source = check_path
                logger.debug(f"Found sphere_log at: {sphere_log_source}")
                break

    # Create a temporary directory for exports
    # The exporters will copy to presets if save_presets=True
    with tempfile.TemporaryDirectory() as temp_dir:
        # Copy sphere_log into temp_dir if it exists elsewhere
        if sphere_log_source:
            dest_path = os.path.join(temp_dir, sphere_log_filename)
            try:
                shutil.copy2(sphere_log_source, dest_path)
                logger.debug(f"Copied sphere_log to temp_dir: {dest_path}")
            except Exception as e:
                logger.warning(f"Failed to copy sphere_log: {e}")
        # Export rules JSON
        # The exporter handles its own decision logic based on settings
        try:
            from exporter import export_game_rules, clear_rule_cache
            from exporter.games import clear_handler_cache

            logger.info("Exporting rules via monkey patch hook")
            export_game_rules(
                multiworld,
                temp_dir,
                filename_base,
                save_presets=update_presets,
                skip_preset_copy_if_rules_identical=skip_if_identical,
                rules_json_format=rules_format,
                clear_game_presets=clear_game_presets,
                clear_all_presets=clear_all_presets,
            )
            # Clear exporter caches to allow GC
            clear_rule_cache()
            clear_handler_cache()
        except ImportError:
            logger.debug("Exporter module not found, skipping rules export")
        except Exception as e:
            logger.warning(f"Rules export failed: {e}")

        # Export pickle
        # The exporter handles its own decision logic based on settings
        try:
            from exporter.pickle_exporter import export_multiworld_pickle

            logger.info("Exporting pickle via monkey patch hook")
            export_multiworld_pickle(
                multiworld,
                temp_dir,
                filename_base,
                save_presets=update_presets,
                skip_preset_copy_if_rules_identical=skip_if_identical,
            )
        except ImportError:
            logger.debug("Pickle exporter module not found, skipping pickle export")
        except Exception as e:
            logger.warning(f"Pickle export failed: {e}")


def _create_playthrough_with_logging(
    spoiler,
    create_paths: bool,
    original_func: Callable,
):
    """
    Create playthrough with sphere logging.

    This is a simplified version that wraps the original function
    and attempts to log sphere information.
    """
    try:
        from exporter.sphere_logger import create_playthrough_with_logging
        return create_playthrough_with_logging(spoiler, create_paths)
    except ImportError:
        logger.debug("Sphere logger not available, using original playthrough creation")
        return original_func(spoiler, create_paths)


# Auto-install hooks when this module is imported (optional)
def auto_install():
    """
    Automatically install hooks if configured to do so.

    This checks the installer config and installs hooks if
    monkey patching is enabled.
    """
    try:
        from ..config import load_config
        config = load_config()

        if config.patches.method == "monkey":
            logger.info("Auto-installing monkey patch hooks")
            install_hooks()
    except Exception as e:
        logger.debug(f"Auto-install check failed: {e}")
