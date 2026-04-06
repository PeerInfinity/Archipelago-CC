"""
TrackerCore with Pickle Mode Support

Extends the original TrackerCore with pickle-based multiworld loading.
When pickle mode is enabled and a pickle file is found, tracking uses the
exact multiworld from generation instead of regenerating from YAML.
"""

import logging
from typing import Callable, Optional

from .TrackerCoreOriginal import TrackerCore as TrackerCoreOriginal
from .pickle_mixin import PickleMixin


class TrackerCore(PickleMixin, TrackerCoreOriginal):
    """TrackerCore with pickle mode support."""

    def __init__(self, logger: logging.Logger, print_list: bool, print_count: bool) -> None:
        super().__init__(logger, print_list, print_count)
        self._init_pickle_mixin()
        self.seed_name: Optional[str] = None
        # Compatibility attributes for TrackerClient
        self.sphere_log_mode: bool = False
        self.seed_override: Optional[int] = None
        self._debug_logger: Optional[Callable] = None

    def disconnect(self):
        self._disconnect_pickle_mixin()
        self.seed_name = None
        super().disconnect()

    def set_seed_name(self, seed_name: str):
        """Set the seed name (from RoomInfo) for auto-discovery."""
        self.seed_name = seed_name

    def set_debug_logger(self, debug_logger: Optional[Callable]):
        """Set callback for debug logging."""
        self._debug_logger = debug_logger

    def initalize_tracker_core(self, connected_cls, raw_slot_data):
        """
        Initialize tracker core with pickle mode support.

        Tries pickle mode first (if enabled and pickle found), then falls
        back to the original YAML-based tracking.
        """
        if getattr(connected_cls, "disable_ut", False):
            self.log_to_tab("World Author has requested UT be disabled on this world, please respect their decision")
            return

        # Try pickle mode
        if self._is_pickle_mode_enabled() and self.pickle_path:
            if self._try_pickle_tracking():
                return
            self.logger.warning("Pickle tracking failed, falling back to original mode")

        # Fall back to original UT mode
        super().initalize_tracker_core(connected_cls, raw_slot_data)

    def _is_pickle_mode_enabled(self) -> bool:
        """Check if pickle mode is enabled in settings."""
        try:
            from . import TrackerWorld
            settings = TrackerWorld.settings
            if isinstance(settings, dict):
                return bool(settings.get('pickle_mode', True))
            return bool(getattr(settings, 'pickle_mode', True))
        except Exception:
            return True

    def _try_pickle_tracking(self) -> bool:
        """Attempt to initialize pickle-based tracking."""
        if not self.pickle_path:
            return False

        self.logger.info(f"Attempting pickle-based tracking from {self.pickle_path}")

        if self.load_multiworld_from_pickle(self.pickle_path):
            # Set host settings that are normally set by run_generator().
            try:
                yaml_path, self.output_format, self.hide_excluded, self.use_split, \
                    enforce_deferred_connections, self.enable_glitched_logic = self._set_host_settings()
                if self.enforce_deferred_connections is None:
                    self.enforce_deferred_connections = enforce_deferred_connections
            except Exception:
                self.output_format = "Both"
                self.hide_excluded = False
                self.use_split = True

            if self.initialize_tracking_from_pickle():
                self.logger.info("Using pickle-based tracking")
                return True
            else:
                self.logger.warning("Failed to initialize tracking from pickle")
        else:
            self.logger.warning("Failed to load pickle")

        return False
