"""
Runtime monkey patching hooks for JSON Tools.

This module provides runtime patches for Archipelago core files to add
JSON export functionality without modifying the actual source files.

Hooks installed (in order):
1. temp_dir_capture: Wraps AutoWorld.call_stage to set temp_dir_for_sphere_log
2. slot_data_cache: Wraps World.fill_slot_data (base class) to cache results
3. sphere_logging: Wraps Spoiler.create_playthrough for sphere log generation
4. export_rules: Wraps Spoiler.to_file (primary) + Main.main (fallback) for export

Deferred patches (applied at start of Main.main when all worlds are loaded):
- slot_data_cache subclasses: Wraps fill_slot_data on every world subclass override

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
from typing import Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from BaseClasses import MultiWorld

logger = logging.getLogger(__name__)

# Track installed hooks for cleanup
_installed_hooks = {}
_original_functions = {}

# Module-level state for communication between hooks
_module_state = {}


def install_hooks(
    export_rules: bool = True,
    sphere_logging: bool = True,
) -> dict:
    """
    Install runtime hooks into Archipelago core.

    Installation order:
    1. temp_dir_capture (if export_rules) - wrap call_stage
    2. slot_data_cache (if export_rules) - wrap fill_slot_data
    3. sphere_logging - wrap create_playthrough
    4. export_rules - wrap to_file + Main.main fallback

    Args:
        export_rules: Install hook for exporting rules JSON after generation.
        sphere_logging: Install hook for sphere log generation.

    Returns:
        Dictionary of installed hook names and their status.
    """
    results = {}

    if export_rules:
        results["temp_dir_capture"] = _install_temp_dir_hook()
        results["slot_data_cache"] = _install_slot_data_cache_hook()

    if sphere_logging:
        results["sphere_logging"] = _install_sphere_logging_hook()

    if export_rules:
        results["export_rules"] = _install_export_hook()

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

    # Restore subclass fill_slot_data patches
    for game_name, world_class, original in _subclass_patches:
        try:
            world_class.fill_slot_data = original
        except Exception as e:
            logger.error(f"Failed to restore fill_slot_data for {game_name}: {e}")
    _subclass_patches.clear()

    _module_state.clear()

    return results


def is_hook_installed(hook_name: str) -> bool:
    """Check if a specific hook is installed."""
    return hook_name in _installed_hooks


def get_installed_hooks() -> list:
    """Get list of currently installed hook names."""
    return list(_installed_hooks.keys())


def _resolve_export_dir() -> str:
    """
    Resolve the directory JSON Tools artifacts are written to.

    This is Archipelago's real output directory — the one holding the final
    AP_<seed>.zip — and deliberately NOT the temporary staging directory Main
    zips up. Anything left in the staging directory ends up inside the hostable
    archive, and a stock WebHost (e.g. archipelago.gg) rejects the entire upload
    when it finds a member it cannot parse as a slot file: WebHostLib/upload.py
    runs int(slot_id[1:]) over unrecognized names, so "AP_<seed>_rules.json"
    raises and the seed is reported as corrupt multidata.

    Utils.output_path() exists on vanilla Archipelago too, so this works on a
    stock install where Main.py is not ours to patch.
    """
    import os
    from Utils import output_path

    export_dir = output_path()
    os.makedirs(export_dir, exist_ok=True)
    return export_dir


# ---------------------------------------------------------------------------
# Hook: temp_dir_capture — wrap AutoWorld.call_stage
# ---------------------------------------------------------------------------

def _install_temp_dir_hook() -> bool:
    """
    Install hook to set multiworld.temp_dir_for_sphere_log.

    This wraps AutoWorld.call_stage() so the destination is set when
    generate_output runs, i.e. before create_playthrough opens the sphere log.
    The value is the real output directory, not the staging directory
    call_stage is handed — see _resolve_export_dir for why.
    """
    hook_name = "temp_dir_capture"

    if hook_name in _installed_hooks:
        logger.warning(f"Hook {hook_name} already installed")
        return True

    try:
        from worlds import AutoWorld

        original_call_stage = AutoWorld.call_stage
        _original_functions[hook_name] = (AutoWorld, "call_stage", original_call_stage)

        @functools.wraps(original_call_stage)
        def hooked_call_stage(multiworld, method_name, *args):
            """Wrapped call_stage that sets the sphere log destination."""
            if method_name == "generate_output" and args:
                # args[0] is Main's ZIP staging directory; the sphere log must
                # not be written there, so point it at the output directory.
                # Exception: a legacy exporter (predating staging_dir) finds
                # its artifacts by mirroring the staging directory, so the
                # sphere log must stay there for it (old behavior).
                from ..export_hook import exporter_supports_staging_dir
                if exporter_supports_staging_dir() is False:
                    multiworld.temp_dir_for_sphere_log = args[0]
                else:
                    multiworld.temp_dir_for_sphere_log = _resolve_export_dir()
            return original_call_stage(multiworld, method_name, *args)

        AutoWorld.call_stage = hooked_call_stage
        _installed_hooks[hook_name] = hooked_call_stage
        logger.info(f"Installed hook: {hook_name}")
        return True

    except ImportError as e:
        logger.error(f"Could not import AutoWorld module: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to install {hook_name} hook: {e}")
        return False


# ---------------------------------------------------------------------------
# Hook: slot_data_cache — wrap World.fill_slot_data
# ---------------------------------------------------------------------------

def _make_caching_wrapper(original_method):
    """Create a fill_slot_data wrapper that caches the result as _cached_slot_data."""
    @functools.wraps(original_method)
    def caching_fill_slot_data(self):
        result = original_method(self)
        self._cached_slot_data = result
        return result
    return caching_fill_slot_data


def _install_slot_data_cache_hook() -> bool:
    """
    Install hook to cache fill_slot_data() results as _cached_slot_data.

    At import time, wraps World.fill_slot_data() on the base class only.
    Subclass overrides are wrapped later by _patch_fill_slot_data_subclasses(),
    which is called from hooked_main() when all worlds are guaranteed loaded.

    The exporter reads the cached value via hasattr(world, '_cached_slot_data')
    (world_data.py).
    """
    hook_name = "slot_data_cache"

    if hook_name in _installed_hooks:
        logger.warning(f"Hook {hook_name} already installed")
        return True

    try:
        from worlds import AutoWorld

        original_fill_slot_data = AutoWorld.World.fill_slot_data
        _original_functions[hook_name] = (
            AutoWorld.World, "fill_slot_data", original_fill_slot_data
        )

        AutoWorld.World.fill_slot_data = _make_caching_wrapper(original_fill_slot_data)
        _installed_hooks[hook_name] = True
        logger.info(f"Installed hook: {hook_name}")
        return True

    except ImportError as e:
        logger.error(f"Could not import AutoWorld module: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to install {hook_name} hook: {e}")
        return False


# Track subclass patches separately so they can be uninstalled
_subclass_patches: list[tuple[str, type, object]] = []


def _patch_fill_slot_data_subclasses() -> int:
    """
    Wrap fill_slot_data() on every registered world subclass that overrides it.

    Must be called after all worlds are loaded (e.g. from hooked_main) so that
    AutoWorldRegister.world_types is fully populated.  Patching only the base
    class is insufficient because Python's MRO dispatches directly to subclass
    methods, bypassing any wrapper on the base.

    Returns the number of subclasses patched.
    """
    from worlds.AutoWorld import AutoWorldRegister

    count = 0
    for game_name, world_class in AutoWorldRegister.world_types.items():
        if "fill_slot_data" in world_class.__dict__:
            original = world_class.__dict__["fill_slot_data"]
            # Skip if already wrapped (e.g. loaded before installer and
            # somehow already patched — shouldn't happen, but be safe)
            if getattr(original, '__wrapped__', None) is not None:
                continue
            world_class.fill_slot_data = _make_caching_wrapper(original)
            _subclass_patches.append((game_name, world_class, original))
            count += 1

    if count:
        logger.info(f"Patched fill_slot_data on {count} world subclasses")
    return count


# ---------------------------------------------------------------------------
# Hook: export_rules — wrap Spoiler.to_file (primary) + Main.main (fallback)
# ---------------------------------------------------------------------------

def _install_export_hook() -> bool:
    """
    Install hook to export rules JSON after seed generation.

    Primary path: wraps Spoiler.to_file(), which Main calls inside
    `with output as temp_dir:`. Exported files are written to Archipelago's
    output directory, alongside the final AP_<seed>.zip — never into temp_dir,
    because everything left there is bundled into the hostable archive and a
    stock WebHost rejects the whole upload when it sees a member it cannot
    parse as a slot file (see _resolve_export_dir). The staging directory is
    still passed through so its files reach the preset copy.

    Fallback path: wraps Main.main() for the rare case where spoiler is
    disabled (args.spoiler == 0, to_file not called). In this case,
    exports run after main() returns, when the staging directory is gone.
    """
    hook_name = "export_rules"

    if hook_name in _installed_hooks:
        logger.warning(f"Hook {hook_name} already installed")
        return True

    try:
        import Main
        import BaseClasses

        # --- Primary: wrap Spoiler.to_file ---
        original_to_file = BaseClasses.Spoiler.to_file
        _original_functions["export_to_file"] = (
            BaseClasses.Spoiler, "to_file", original_to_file
        )

        @functools.wraps(original_to_file)
        def hooked_to_file(self, filename, *args, **kwargs):
            """Wrapped to_file that exports next to the final ZIP, not into it."""
            import os
            result = original_to_file(self, filename, *args, **kwargs)

            staging_dir = os.path.dirname(filename)
            outfilebase = os.path.basename(filename).removesuffix('_Spoiler.txt')

            try:
                from ..export_hook import export_post_output_hook
                export_post_output_hook(
                    self.multiworld,
                    _resolve_export_dir(),
                    outfilebase,
                    staging_dir=staging_dir,
                )
                _module_state['export_ran'] = True
            except Exception:
                logger.exception("Export hook failed in to_file wrapper")

            return result

        BaseClasses.Spoiler.to_file = hooked_to_file
        _installed_hooks["export_to_file"] = hooked_to_file

        # --- Fallback: wrap Main.main for spoiler-disabled case ---
        original_main = Main.main
        _original_functions[hook_name] = (Main, "main", original_main)

        @functools.wraps(original_main)
        def hooked_main(*args, **kwargs):
            """Wrapped Main.main — fallback export when spoiler is disabled."""
            # Deferred patch: all worlds are now loaded, so wrap every subclass
            # fill_slot_data to cache results for the exporter.
            _patch_fill_slot_data_subclasses()

            _module_state['export_ran'] = False
            result = original_main(*args, **kwargs)

            if not _module_state.get('export_ran') and result is not None:
                try:
                    _post_generation_export(result)
                except Exception as e:
                    logger.warning(f"Fallback post-generation export failed: {e}")

            return result

        Main.main = hooked_main
        _installed_hooks[hook_name] = hooked_main
        logger.info(f"Installed hook: {hook_name} (to_file wrapper + main fallback)")
        return True

    except ImportError as e:
        logger.error(f"Could not import Main/BaseClasses module: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to install {hook_name} hook: {e}")
        return False


# ---------------------------------------------------------------------------
# Hook: sphere_logging — wrap Spoiler.create_playthrough
# ---------------------------------------------------------------------------

def _install_sphere_logging_hook() -> bool:
    """
    Install hook for sphere log generation during playthrough creation.

    This wraps Spoiler.create_playthrough() to log sphere information.
    """
    hook_name = "sphere_logging"

    if hook_name in _installed_hooks:
        logger.warning(f"Hook {hook_name} already installed")
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


# ---------------------------------------------------------------------------
# Fallback export (degraded path — no staging directory left)
# ---------------------------------------------------------------------------

def _post_generation_export(multiworld: "MultiWorld"):
    """
    Fallback export when spoiler is disabled (to_file never called).

    This is the degraded path — exports run after Main.main() returns, when the
    staging directory has already been cleaned up, so the multidata and the
    per-player game files cannot be mirrored into frontend/presets/. The rules
    JSON and the sphere log go to the same output directory as on the primary
    path, so the two agree on where artifacts live.

    Args:
        multiworld: The MultiWorld object from generation
    """
    # Build the filename base from seed_name
    seed_name = getattr(multiworld, 'seed_name', None)
    if not seed_name:
        logger.warning("Cannot export: multiworld has no seed_name")
        return

    filename_base = f"AP_{seed_name}"

    try:
        from ..export_hook import export_post_output_hook
        logger.info("Exporting rules via monkey patch fallback (spoiler disabled)")
        export_post_output_hook(multiworld, _resolve_export_dir(), filename_base)
    except ImportError:
        logger.debug("Export hook not available, skipping")
    except Exception as e:
        logger.warning(f"Fallback rules export failed: {e}")


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
