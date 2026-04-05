"""
Pickle Mixin for Universal Tracker

Adds pickle-based multiworld loading to TrackerCore. Loads a pre-generated
multiworld from a gzip-compressed dill pickle file, preserving lambdas
and functions in access rules.
"""

import json
import logging
from pathlib import Path
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from BaseClasses import MultiWorld


class PickleMixin:
    """
    Mixin that adds pickle-based multiworld loading to TrackerCore.

    Required attributes from base class:
    - logger: logging.Logger
    - multiworld: Optional[MultiWorld]
    - player_id: Optional[int]
    - game: Optional[str]
    - seed_name: Optional[str]
    """

    pickle_multiworld: Optional["MultiWorld"] = None
    pickle_path: Optional[str] = None
    pickle_metadata: Optional[dict] = None
    _tracking_from_pickle: bool = False

    def _init_pickle_mixin(self):
        """Initialize pickle mixin attributes."""
        self.pickle_multiworld = None
        self.pickle_path = None
        self.pickle_metadata = None
        self._tracking_from_pickle = False

    def _disconnect_pickle_mixin(self):
        """Clear pickle mixin state."""
        self.pickle_multiworld = None
        self.pickle_path = None
        self.pickle_metadata = None
        self._tracking_from_pickle = False

    def load_multiworld_from_pickle(self, pickle_path: str) -> bool:
        """
        Load a multiworld from a gzip-compressed dill pickle file.

        Returns True if successful, False otherwise.
        """
        try:
            from .pickle_exporter import load_multiworld_pickle, load_pickle_metadata, METADATA_EXTENSION

            self.logger.info(f"Loading multiworld from pickle: {pickle_path}")

            self.pickle_multiworld = load_multiworld_pickle(pickle_path)
            self.pickle_path = pickle_path

            # Try to load metadata if available
            metadata_path = pickle_path.rsplit('.pkl.gz', 1)[0] + METADATA_EXTENSION
            self.pickle_metadata = load_pickle_metadata(metadata_path)

            self.logger.info("Loaded multiworld from pickle successfully")
            return True

        except Exception as e:
            self.logger.warning(f"Failed to load multiworld from pickle: {e}")
            import traceback
            self.logger.debug(traceback.format_exc())
            self.pickle_multiworld = None
            self.pickle_path = None
            self.pickle_metadata = None
            return False

    def initialize_tracking_from_pickle(self) -> bool:
        """
        Initialize tracking using the pickled multiworld.

        The pickled multiworld already has all regions, rules, and items set up,
        so no generation steps are needed.

        Returns True if successful, False otherwise.
        """
        if not self.pickle_multiworld:
            self.logger.debug("No pickle multiworld available for tracking")
            return False

        try:
            self.multiworld = self.pickle_multiworld
            self.player_id = 1
            self._tracking_from_pickle = True

            # Clear precollected items with codes to avoid double-counting.
            # Items will be added via set_items_received() during tracking.
            # Keep items without codes (events).
            temp_precollect = {}
            for player_id, items in self.multiworld.precollected_items.items():
                temp_items = [item for item in items if item.code is None]
                temp_precollect[player_id] = temp_items
            self.multiworld.precollected_items = temp_precollect

            # Convert list-address locations to events.
            # Some games (e.g., ALttP) use list addresses for dungeon prizes.
            list_address_count = 0
            for location in self.multiworld.get_locations(self.player_id):
                if isinstance(location.address, list):
                    location.address = None
                    location.event = True
                    list_address_count += 1

            if list_address_count > 0:
                self.logger.debug(
                    f"Converted {list_address_count} list-address locations to events"
                )

            self.logger.info("Initialized tracking from pickle multiworld")
            return True

        except Exception as e:
            self.logger.warning(f"Failed to initialize tracking from pickle: {e}")
            import traceback
            self.logger.debug(traceback.format_exc())
            self._tracking_from_pickle = False
            return False

    def auto_discover_pickle(self) -> bool:
        """
        Auto-discover and load the pickle file based on game name and seed name.

        Searches for pickle files in:
        1. output/ directory
        2. User data directory

        Returns True if pickle was loaded successfully, False otherwise.
        """
        if not self.game or not self.seed_name:
            self.logger.debug("Cannot auto-discover pickle: game or seed_name not set")
            return False

        from Utils import output_path
        from .pickle_exporter import PICKLE_EXTENSION, METADATA_EXTENSION

        # Build the expected seed folder name
        seed_folder = f"AP_{self.seed_name}" if not self.seed_name.startswith('AP_') else self.seed_name
        pickle_filename = f"{seed_folder}{PICKLE_EXTENSION}"

        # Build list of candidate paths
        candidates = []

        # 1. output/ directory
        output_dir = Path(output_path())
        candidates.append(output_dir / pickle_filename)

        # 2. User data directory
        try:
            from Utils import user_path
            user_data_dir = Path(user_path())
            candidates.append(user_data_dir / pickle_filename)
        except Exception:
            pass

        # Try each candidate
        for pickle_path in candidates:
            if not pickle_path.exists():
                self.logger.debug(f"Pickle not found: {pickle_path}")
                continue

            self.logger.debug(f"Found pickle candidate: {pickle_path}")

            # Validate by loading metadata
            metadata_path = str(pickle_path).rsplit('.pkl.gz', 1)[0] + METADATA_EXTENSION
            if Path(metadata_path).exists():
                try:
                    with open(metadata_path) as f:
                        metadata = json.load(f)

                    # Validate seed name matches
                    meta_seed_name = metadata.get('seed_name', '')
                    if meta_seed_name != self.seed_name and meta_seed_name != f"AP_{self.seed_name}":
                        self.logger.debug(
                            f"Seed name mismatch: expected {self.seed_name}, got {meta_seed_name}"
                        )
                        continue

                    # Validate game matches
                    players = metadata.get('players', {})
                    game_found = any(
                        p.get('game') == self.game for p in players.values()
                    )
                    if not game_found:
                        games = [p.get('game') for p in players.values()]
                        self.logger.debug(
                            f"Game mismatch: expected {self.game}, found {games}"
                        )
                        continue

                except Exception as e:
                    self.logger.debug(f"Failed to validate metadata: {e}")

            # Try to load the pickle
            if self.load_multiworld_from_pickle(str(pickle_path)):
                self.logger.info(f"Auto-discovered and loaded pickle: {pickle_path}")
                return True

        self.logger.debug("No valid pickle file found")
        return False
