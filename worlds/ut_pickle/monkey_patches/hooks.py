"""
Runtime monkey patch: wrap Main.main to export pickle after generation.

This is the only hook needed for pickle tracker. It wraps Main.main()
so that after seed generation completes, the multiworld is exported
as a gzip-compressed dill pickle file.
"""

import functools
import logging

logger = logging.getLogger(__name__)

_installed = False
_original_main = None


def install_hooks() -> bool:
    """Install the Main.main wrapper hook."""
    global _installed, _original_main

    if _installed:
        logger.warning("Pickle export hook already installed")
        return True

    try:
        import Main

        _original_main = Main.main

        @functools.wraps(_original_main)
        def hooked_main(*args, **kwargs):
            """Wrapped Main.main that exports pickle after generation."""
            result = _original_main(*args, **kwargs)
            if result is not None:
                _export_pickle_from_multiworld(result)
            return result

        Main.main = hooked_main
        _installed = True
        logger.info("Installed pickle export hook on Main.main")
        return True

    except ImportError as e:
        logger.error(f"Could not import Main module: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to install pickle export hook: {e}")
        return False


def _export_pickle_from_multiworld(multiworld):
    """Export pickle from the multiworld returned by Main.main."""
    # Check if pickle mode is enabled
    try:
        from .. import TrackerWorld
        settings = TrackerWorld.settings
        pickle_mode = settings.get('pickle_mode', True) if isinstance(settings, dict) else getattr(settings, 'pickle_mode', True)
        if not pickle_mode:
            logger.debug("Pickle mode disabled in settings, skipping export")
            return
    except Exception:
        pass  # If settings can't be loaded, export anyway

    seed_name = getattr(multiworld, 'seed_name', None)
    if not seed_name:
        logger.warning("Cannot export pickle: multiworld has no seed_name")
        return

    filename_base = f"AP_{seed_name}"

    try:
        from Utils import output_path
        output_dir = output_path()

        from ..pickle_exporter import export_multiworld_pickle
        export_multiworld_pickle(multiworld, output_dir, filename_base)
    except Exception as e:
        logger.warning(f"Pickle export failed: {e}")
        import traceback
        logger.debug(traceback.format_exc())


def auto_install():
    """Auto-install hooks at import time."""
    install_hooks()
