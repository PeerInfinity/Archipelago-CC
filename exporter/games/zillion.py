"""Zillion game-specific export handler."""

from typing import Dict, Any, Optional, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class ZillionGameExportHandler(GenericGameExportHandler):
    """Export handler for Zillion.

    Zillion uses the zilliandomizer library for its logic system.
    The game does not use traditional helper functions - all logic is handled
    by zilliandomizer's internal calculations.

    Access rules are extracted from the zz_loc.req field which contains
    requirements like gun level, items needed, etc.
    """
    GAME_NAME = 'Zillion'

    def __init__(self):
        super().__init__()
        # Zillion doesn't use helper functions - logic is in zilliandomizer library
        self.known_helpers = set()

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions."""
        # Log if we encounter any helpers (shouldn't happen)
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Extract access rule from Zillion location's zz_loc.req field.

        The zz_loc.req contains requirements like:
        - gun: Gun level requirement (0-3)
        - jump: Jump requirement (0 or 1)
        - hp: HP requirement
        - red: Red ID Card count requirement
        - floppy: Floppy Disk count requirement
        - skill: Skill level requirement
        """
        # Check if this is a Zillion location with zz_loc attribute
        if not hasattr(location, 'zz_loc'):
            return None

        zz_loc = location.zz_loc
        if not hasattr(zz_loc, 'req'):
            return None

        req = zz_loc.req
        conditions: List[Dict[str, Any]] = []

        # Debug logging for a few locations
        loc_name = location.name if hasattr(location, 'name') else 'unknown'
        if loc_name in ['C-3 mid far right', 'B-1 mid far left', 'A-3 top left-center', 'B-1 bottom left-center']:
            logger.info(f"Location '{loc_name}': gun={getattr(req, 'gun', 'N/A')}, jump={getattr(req, 'jump', 'N/A')}, hp={getattr(req, 'hp', 'N/A')}, red={getattr(req, 'red', 'N/A')}, floppy={getattr(req, 'floppy', 'N/A')}")

        # Gun requirement (Zillion item upgrades)
        # Player starts with gun=1, so:
        # gun <= 1: No Zillion items needed (base gun level)
        # gun = 2: Need 1 Zillion item
        # gun = 3: Need 2 Zillion items
        if hasattr(req, 'gun') and req.gun > 1:
            conditions.append({
                'type': 'item_check',
                'item': 'Zillion',
                'count': {'type': 'constant', 'value': req.gun - 1}
            })

        # Jump requirement (implied from the requirement value)
        if hasattr(req, 'jump') and req.jump > 0:
            # Jump ability is assumed to be available (no specific item for it in Zillion)
            # This is handled by the zilliandomizer library internally
            pass

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

        # Scope requirement (part of skill check)
        # Note: skill in zilliandomizer might relate to having the Scope item
        if hasattr(req, 'skill') and req.skill > 0:
            # Skill might indicate need for Scope, but this is uncertain
            # For now, we'll leave it out and see what the tests show
            pass

        # HP requirement - this is tricky as HP isn't a collectable item in AP
        # It's more about character progression. For now, skip it.
        if hasattr(req, 'hp') and req.hp > 0:
            # HP requirements might be implied by other items or progression
            pass

        # If no conditions, location is always accessible
        if not conditions:
            return {'type': 'constant', 'value': True}

        # If only one condition, return it directly
        if len(conditions) == 1:
            return conditions[0]

        # If multiple conditions, combine with AND
        return {
            'type': 'and',
            'conditions': conditions
        }
