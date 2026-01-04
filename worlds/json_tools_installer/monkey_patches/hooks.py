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
from typing import Callable, Optional, Any

logger = logging.getLogger(__name__)

# Track installed hooks for cleanup
_installed_hooks = {}
_original_functions = {}


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
    """
    hook_name = "export_rules"

    if hook_name in _installed_hooks:
        logger.warning(f"Hook {hook_name} already installed")
        return True

    try:
        import Main

        original_main = Main.main
        _original_functions[hook_name] = (Main, "main", original_main)

        @functools.wraps(original_main)
        def hooked_main(*args, **kwargs):
            """Wrapped Main.main that exports rules after generation."""
            result = original_main(*args, **kwargs)

            # Try to export rules after successful generation
            try:
                _post_generation_export()
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
            # Check if sphere logging is enabled
            try:
                from settings import get_settings
                settings = get_settings()
                if getattr(settings.general_options, 'save_sphere_log', False):
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


def _post_generation_export():
    """
    Called after generation to export rules JSON.

    This is a simplified version that attempts to call the exporter
    if it's available.
    """
    try:
        from settings import get_settings
        settings = get_settings()

        if not getattr(settings.general_options, 'save_rules_json', False):
            return

        # Try to import and call the exporter
        try:
            from exporter import export_game_rules
            logger.info("Exporter available, rules will be exported via normal flow")
        except ImportError:
            logger.warning(
                "Exporter module not found. Install JSON Tools to enable rule export."
            )
    except Exception as e:
        logger.debug(f"Post-generation export check failed: {e}")


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
