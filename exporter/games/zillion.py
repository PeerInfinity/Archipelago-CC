"""Zillion game-specific export handler."""

from typing import Dict, Any, Optional, List, Set
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

# Import zilliandomizer components
try:
    from zilliandomizer.logic_components.locations import Req
    from zilliandomizer.logic_components.items import items as zz_items
except ImportError:
    logger.error("Failed to import zilliandomizer. Is zilliandomizer installed?")
    Req = None
    zz_items = []

class ZillionGameExportHandler(GenericGameExportHandler):
    """Export handler for Zillion.

    Zillion uses the zilliandomizer library for its logic system.
    This exporter queries the zilliandomizer directly to determine actual accessibility.
    """
    GAME_NAME = 'Zillion'

    def __init__(self):
        super().__init__()
        # Zillion doesn't use helper functions - logic is in zilliandomizer library
        self.known_helpers = set()
        # Cache zilliandomizer data
        self.zz_randomizer = None
        self.id_to_zz_item = None
        self.item_name_to_zz_item = {}
        # Cache accessibility results
        self.accessibility_cache = {}

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions."""
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None

    def _init_zilliandomizer(self, world):
        """Initialize zilliandomizer data from the world object."""
        if self.zz_randomizer is not None:
            return  # Already initialized

        # Get the zilliandomizer randomizer from the world
        if not hasattr(world, 'zz_system'):
            logger.error("World doesn't have zz_system attribute")
            return

        self.zz_randomizer = world.zz_system.randomizer
        if not self.zz_randomizer:
            logger.error("World's zz_system doesn't have randomizer")
            return

        # Get item mapping
        if hasattr(world, 'id_to_zz_item'):
            self.id_to_zz_item = world.id_to_zz_item

        # Build item name to zz_item mapping
        # The zilliandomizer items list: 0=empty, 1=main, 2=gun, 3=opa, 4=red, 5=floppy, 6=scope, 7=JJ, 8=Apple, 9=Champ, 10=bread, 11=card
        item_name_map = {
            'Zillion': zz_items[2],       # gun
            'Opa-Opa': zz_items[3],       # opa
            'Red ID Card': zz_items[4],   # red
            'Floppy Disk': zz_items[5],   # floppy
            'Scope': zz_items[6],         # scope
            'JJ': zz_items[7],            # JJ
            'Apple': zz_items[8],         # Apple
            'Champ': zz_items[9],         # Champ
            'Bread': zz_items[10],        # bread
            'ID Card': zz_items[11],      # card
        }
        self.item_name_to_zz_item = item_name_map

        # Sync item placements from Archipelago to zilliandomizer
        # This is crucial for correct accessibility calculation
        self._sync_item_placements(world)

        logger.info(f"Initialized zilliandomizer: {len(self.zz_randomizer.locations)} locations")

    def _sync_item_placements(self, world):
        """Sync item placements from Archipelago locations to zilliandomizer."""
        if not self.zz_randomizer:
            return

        # Import zilliandomizer empty item
        try:
            from zilliandomizer.logic_components.items import items as zz_items
            zz_empty = zz_items[0]
        except ImportError:
            logger.error("Failed to import zilliandomizer items")
            return

        # Sync each location's item to the zilliandomizer
        if hasattr(world, 'my_locations'):
            for z_loc in world.my_locations:
                zz_name = z_loc.zz_loc.name
                # Get the zz_item for this location's placed item
                from worlds.zillion.item import ZillionItem
                zz_item = z_loc.item.zz_item \
                    if isinstance(z_loc.item, ZillionItem) and z_loc.item.player == world.player \
                    else zz_empty
                # Set it in the randomizer
                self.zz_randomizer.locations[zz_name].item = zz_item

    def _get_accessible_locations(self, items: List) -> Set:
        """
        Get the set of accessible zilliandomizer locations given a list of items.

        Args:
            items: List of zilliandomizer items

        Returns:
            Set of accessible zilliandomizer location objects
        """
        if not self.zz_randomizer:
            return set()

        # Convert items to ability using zilliandomizer's logic
        ability = self.zz_randomizer.make_ability(items)

        # Get accessible locations
        accessible_locs = self.zz_randomizer.get_locations(ability)

        return frozenset(accessible_locs)

    def _find_minimal_requirements(self, zz_loc, world) -> Optional[Dict[str, Any]]:
        """
        Find the minimal item requirements for accessing a location by querying zilliandomizer.

        This tests different item combinations to determine which items grant access.
        """
        # Check if accessible with no items
        accessible_with_nothing = self._get_accessible_locations([])
        if zz_loc in accessible_with_nothing:
            return {'type': 'constant', 'value': True}

        # List of progression items to test
        # We'll test each item type and various counts
        progression_items = {
            'Zillion': (1, 7),      # Test counts 1-7
            'Opa-Opa': (1, 8),      # Test counts 1-8
            'Red ID Card': (1, 5),   # Test counts 1-5
            'Floppy Disk': (1, 5),   # Test counts 1-5
            'Apple': (1, 1),         # Just 1
            'Champ': (1, 1),         # Just 1
        }

        # Find which single items grant access
        single_item_grants_access = []
        for item_name, (min_count, max_count) in progression_items.items():
            zz_item = self.item_name_to_zz_item.get(item_name)
            if not zz_item:
                continue

            # Binary search for minimum count needed
            needed_count = None
            for count in range(min_count, max_count + 1):
                items = [zz_item] * count
                accessible = self._get_accessible_locations(items)
                if zz_loc in accessible:
                    needed_count = count
                    break

            if needed_count is not None:
                if needed_count == 1 and item_name in ['Apple', 'Champ']:
                    # Rescue items don't need count
                    single_item_grants_access.append({
                        'type': 'item_check',
                        'item': item_name
                    })
                else:
                    single_item_grants_access.append({
                        'type': 'item_check',
                        'item': item_name,
                        'count': {'type': 'constant', 'value': needed_count}
                    })

        # If multiple single items can grant access, it's an OR
        if len(single_item_grants_access) > 1:
            return {
                'type': 'or',
                'conditions': single_item_grants_access
            }
        elif len(single_item_grants_access) == 1:
            return single_item_grants_access[0]

        # If no single item grants access, we might need combinations
        # For now, try common combinations: Zillion + Opa-Opa
        zillion_item = self.item_name_to_zz_item.get('Zillion')
        opa_item = self.item_name_to_zz_item.get('Opa-Opa')

        if zillion_item and opa_item:
            # Try different combinations
            for zillion_count in range(1, 8):
                for opa_count in range(1, 9):
                    items = [zillion_item] * zillion_count + [opa_item] * opa_count
                    accessible = self._get_accessible_locations(items)
                    if zz_loc in accessible:
                        # Found a combination that works
                        # Build AND rule
                        conditions = []
                        if zillion_count > 0:
                            conditions.append({
                                'type': 'item_check',
                                'item': 'Zillion',
                                'count': {'type': 'constant', 'value': zillion_count}
                            })
                        if opa_count > 0:
                            conditions.append({
                                'type': 'item_check',
                                'item': 'Opa-Opa',
                                'count': {'type': 'constant', 'value': opa_count}
                            })

                        if len(conditions) == 1:
                            return conditions[0]
                        else:
                            return {
                                'type': 'and',
                                'conditions': conditions
                            }

        # If we still can't find requirements, log a warning and return True
        # This shouldn't happen in a properly configured world
        logger.warning(f"Could not determine requirements for location: {zz_loc.name}")
        return {'type': 'constant', 'value': True}

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Determine access rule by querying the zilliandomizer logic directly.

        This method uses the zilliandomizer's get_locations() function to determine
        which items are actually required to access each location.
        """
        # Check if this is a Zillion location with zilliandomizer data
        if not hasattr(location, 'zz_loc'):
            return None

        # Initialize zilliandomizer if needed
        self._init_zilliandomizer(world)
        if not self.zz_randomizer:
            logger.error("Failed to initialize zilliandomizer, falling back to basic export")
            return None

        zz_loc = location.zz_loc
        loc_name = location.name if hasattr(location, 'name') else 'unknown'

        # Check cache first
        cache_key = zz_loc.name
        if cache_key in self.accessibility_cache:
            return self.accessibility_cache[cache_key]

        # Find minimal requirements by querying zilliandomizer
        logger.debug(f"Analyzing location: {loc_name}")
        rule = self._find_minimal_requirements(zz_loc, world)

        # Cache the result
        self.accessibility_cache[cache_key] = rule

        return rule
