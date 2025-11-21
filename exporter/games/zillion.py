"""Zillion game-specific export handler."""

from typing import Dict, Any, Optional, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class ZillionGameExportHandler(GenericGameExportHandler):
    """Export handler for Zillion.

    Zillion uses the zilliandomizer library for its logic system. We read accessibility
    requirements from a cache populated during create_regions (before items are placed).
    """
    GAME_NAME = 'Zillion'

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions in its access rules."""
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Read accessibility requirements from the cache populated during create_regions.

        The cache contains the minimum requirements determined by testing with
        zilliandomizer's get_locations() method before any items were placed.
        """
        # Check if this is a ZillionLocation
        if not hasattr(location, 'zz_loc'):
            return None

        # Get cached requirements
        if not hasattr(world, 'location_accessibility_cache'):
            logger.warning(f"No accessibility cache found for {location.name}")
            return None

        cached_reqs = world.location_accessibility_cache.get(location.name)
        if not cached_reqs:
            logger.warning(f"No cached requirements for {location.name}")
            return None

        try:
            conditions = []

            # Gun requirement -> Zillion item
            # Player starts with gun=1, so gun=2 requires 1 Zillion, gun=3 requires 2 Zillions
            if cached_reqs['gun'] > 1:
                count_needed = cached_reqs['gun'] - 1
                if count_needed == 1:
                    conditions.append({'type': 'item_check', 'item': 'Zillion'})
                else:
                    conditions.append({
                        'type': 'item_check',
                        'item': 'Zillion',
                        'count': {'type': 'constant', 'value': count_needed}
                    })

            # Jump requirement -> Opa-Opa item
            # Player starts with jump=1
            if cached_reqs['jump'] > 1:
                count_needed = cached_reqs['jump'] - 1
                if count_needed == 1:
                    conditions.append({'type': 'item_check', 'item': 'Opa-Opa'})
                else:
                    conditions.append({
                        'type': 'item_check',
                        'item': 'Opa-Opa',
                        'count': {'type': 'constant', 'value': count_needed}
                    })

            # Floppy disk requirement
            if cached_reqs['floppy'] > 0:
                if cached_reqs['floppy'] == 1:
                    conditions.append({'type': 'item_check', 'item': 'Floppy Disk'})
                else:
                    conditions.append({
                        'type': 'item_check',
                        'item': 'Floppy Disk',
                        'count': {'type': 'constant', 'value': cached_reqs['floppy']}
                    })

            # Red ID card requirement
            if cached_reqs['red'] > 0:
                conditions.append({'type': 'item_check', 'item': 'Red ID Card'})

            # Character requirements would need to be cached separately if needed
            # For now, check the req object for this
            if hasattr(location, 'zz_loc'):
                req = location.zz_loc.req
                if req.char and len(req.char) < 3:
                    char_conditions = []
                    for char_name in req.char:
                        char_conditions.append({'type': 'item_check', 'item': char_name})
                    if len(char_conditions) == 1:
                        conditions.append(char_conditions[0])
                    else:
                        conditions.append({'type': 'or', 'conditions': char_conditions})

            # Build the final access rule
            if not conditions:
                # No requirements - accessible from the start
                return {'type': 'constant', 'value': True}
            elif len(conditions) == 1:
                return conditions[0]
            else:
                # Multiple requirements - all must be met (AND)
                return {
                    'type': 'and',
                    'conditions': conditions
                }

        except Exception as e:
            logger.warning(f"Failed to build access rule for {location.name}: {e}")
            return None
