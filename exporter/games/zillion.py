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
        """
        Set all locations to have empty items in zilliandomizer.

        This ensures that accessibility queries are based on actual requirements,
        not on where items happen to be placed in this specific randomization.
        """
        if not self.zz_randomizer:
            return

        # Import zilliandomizer empty item
        try:
            from zilliandomizer.logic_components.items import items as zz_items
            zz_empty = zz_items[0]
        except ImportError:
            logger.error("Failed to import zilliandomizer items")
            return

        # Set ALL locations to have empty items
        # This makes accessibility independent of item placements
        for zz_loc_name, zz_loc in self.zz_randomizer.locations.items():
            zz_loc.item = zz_empty

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

    def _convert_req_to_rule(self, req) -> Dict[str, Any]:
        """
        Convert a zilliandomizer Req object to an access rule.

        The Req object has these fields:
        - gun: number of Zillion guns needed (item: "Zillion")
        - jump: jump level needed (item: "Opa-Opa")
        - char: character requirement (items: "JJ", "Apple", "Champ")
        - hp: HP requirement (not used in standard logic)
        - door: door requirement (not used, red ID cards use 'red' field)
        - skill: skill requirement (not used in standard logic)
        - union: tuple of alternative Req objects (for OR conditions)
        - red: Red ID Card count (item: "Red ID Card")
        - floppy: Floppy Disk count (item: "Floppy Disk")
        """
        conditions = []

        # Handle union (OR condition) first
        if hasattr(req, 'union') and req.union:
            # Union means any of the requirements can be satisfied
            union_conditions = []
            for sub_req in req.union:
                union_conditions.append(self._convert_req_to_rule(sub_req))
            return {
                'type': 'or',
                'conditions': union_conditions
            }

        # Gun requirement (Zillion)
        if hasattr(req, 'gun') and req.gun > 0:
            conditions.append({
                'type': 'item_check',
                'item': 'Zillion',
                'count': {'type': 'constant', 'value': req.gun}
            })

        # Jump requirement (Opa-Opa)
        if hasattr(req, 'jump') and req.jump > 0:
            conditions.append({
                'type': 'item_check',
                'item': 'Opa-Opa',
                'count': {'type': 'constant', 'value': req.jump}
            })

        # Red ID Card requirement
        if hasattr(req, 'red') and req.red > 0:
            conditions.append({
                'type': 'item_check',
                'item': 'Red ID Card',
                'count': {'type': 'constant', 'value': req.red}
            })

        # Floppy Disk requirement
        if hasattr(req, 'floppy') and req.floppy > 0:
            conditions.append({
                'type': 'item_check',
                'item': 'Floppy Disk',
                'count': {'type': 'constant', 'value': req.floppy}
            })

        # Character requirement (rescue characters: JJ, Apple, Champ)
        if hasattr(req, 'char') and req.char:
            # char is a tuple/set of required characters
            # If it's ('JJ', 'Apple', 'Champ'), all are allowed, so no restriction
            # If it's a subset, we need one of those characters
            char_tuple = tuple(req.char) if not isinstance(req.char, tuple) else req.char
            all_chars = ('JJ', 'Apple', 'Champ')

            if char_tuple != all_chars and len(char_tuple) > 0:
                # Need one of the specific characters
                char_conditions = []
                for char in char_tuple:
                    char_conditions.append({
                        'type': 'item_check',
                        'item': char
                    })

                if len(char_conditions) == 1:
                    conditions.append(char_conditions[0])
                else:
                    conditions.append({
                        'type': 'or',
                        'conditions': char_conditions
                    })

        # If no conditions, location is always accessible
        if len(conditions) == 0:
            return {'type': 'constant', 'value': True}

        # If only one condition, return it directly
        if len(conditions) == 1:
            return conditions[0]

        # Multiple conditions means AND
        return {
            'type': 'and',
            'conditions': conditions
        }

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Determine access rule using the location's actual access_rule function.

        This tests the access_rule with different collection states to determine
        which items are required to access the location.
        """
        # Check if this is a Zillion location with zilliandomizer data
        if not hasattr(location, 'zz_loc'):
            return None

        zz_loc = location.zz_loc
        loc_name = location.name if hasattr(location, 'name') else 'unknown'

        # Check cache first
        cache_key = zz_loc.name
        if cache_key in self.accessibility_cache:
            return self.accessibility_cache[cache_key]

        # Use the actual access_rule if available
        if not hasattr(location, 'access_rule') or location.access_rule is None:
            logger.warning(f"Location {loc_name} has no access_rule")
            return {'type': 'constant', 'value': True}

        # Test the access_rule with different item combinations
        from BaseClasses import CollectionState

        # Create a test collection state
        cs = CollectionState(world.multiworld)

        # Test if accessible with no items
        if location.access_rule(cs):
            return {'type': 'constant', 'value': True}

        # Test single items and various counts
        progression_items = {
            'Zillion': 7,      # Max count
            'Opa-Opa': 8,      # Max count
            'Red ID Card': 5,   # Max count
            'Floppy Disk': 5,   # Max count
            'JJ': 1,
            'Apple': 1,
            'Champ': 1,
        }

        # Find which single items grant access
        single_item_grants_access = []
        for item_name, max_count in progression_items.items():
            for count in range(1, max_count + 1):
                cs = CollectionState(world.multiworld)
                for _ in range(count):
                    cs.collect(world.create_item(item_name))

                if location.access_rule(cs):
                    if count == 1 and item_name in ['JJ', 'Apple', 'Champ']:
                        # Rescue items don't need count
                        single_item_grants_access.append({
                            'type': 'item_check',
                            'item': item_name
                        })
                    else:
                        single_item_grants_access.append({
                            'type': 'item_check',
                            'item': item_name,
                            'count': {'type': 'constant', 'value': count}
                        })
                    break

        # If multiple single items can grant access, it's an OR
        if len(single_item_grants_access) > 1:
            rule = {
                'type': 'or',
                'conditions': single_item_grants_access
            }
        elif len(single_item_grants_access) == 1:
            rule = single_item_grants_access[0]
        else:
            # Try combinations
            rule = self._find_combination_requirements(location, world, progression_items)

        # Cache the result
        self.accessibility_cache[cache_key] = rule

        return rule

    def _find_combination_requirements(self, location, world, progression_items) -> Dict[str, Any]:
        """Find item combinations that grant access."""
        from BaseClasses import CollectionState

        # Try common combinations: Zillion + Opa-Opa
        for zillion_count in range(1, 8):
            for opa_count in range(1, 9):
                cs = CollectionState(world.multiworld)
                for _ in range(zillion_count):
                    cs.collect(world.create_item('Zillion'))
                for _ in range(opa_count):
                    cs.collect(world.create_item('Opa-Opa'))

                if location.access_rule(cs):
                    # Found a combination that works
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

        # If we can't find requirements, log a warning
        logger.warning(f"Could not determine requirements for location: {location.name}")
        return {'type': 'constant', 'value': True}
