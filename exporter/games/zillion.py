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
        # Cache accessibility results
        self.accessibility_cache = {}

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions."""
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None



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
        # In Zillion, the player always has a character (one of JJ, Apple, or Champ)
        # starting the game. The char field in Req indicates which characters can
        # access the location. If all three characters can access it, there's no
        # restriction. If only specific characters can access it, we need to check.
        # However, since the player ALWAYS has a character, we treat "any character
        # can access" as no restriction, and ignore character-specific restrictions
        # for now (as they're handled by the game logic, not item collection).
        # Character restrictions are primarily used for rescue missions where you
        # need to have rescued a specific character to use them.

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
        Determine access rule by converting the zilliandomizer Req object directly.

        This avoids testing with CollectionStates which can be contaminated by
        actual item placements in the generated world. Instead, we use the
        source of truth: the Req object that's attached to each zilliandomizer location.
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

        # Check if the location has a Req object
        if not hasattr(zz_loc, 'req') or zz_loc.req is None:
            logger.warning(f"Location {loc_name} has no req object")
            return {'type': 'constant', 'value': True}

        # Debug logging for specific locations
        if loc_name in ['B-1 mid far left', 'A-3 top left-center', 'A-4 bottom far left']:
            logger.info(f"[DEBUG] {loc_name}: gun={zz_loc.req.gun}, jump={zz_loc.req.jump}, char={zz_loc.req.char}, red={zz_loc.req.red}, floppy={zz_loc.req.floppy}")

        # Convert the Req object directly to a rule
        rule = self._convert_req_to_rule(zz_loc.req)

        # Cache the result
        self.accessibility_cache[cache_key] = rule

        return rule

