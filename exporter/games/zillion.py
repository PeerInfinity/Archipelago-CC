"""Zillion game-specific export handler."""

from typing import Dict, Any, Optional, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class ZillionGameExportHandler(GenericGameExportHandler):
    """Export handler for Zillion.

    Zillion uses the zilliandomizer library for its logic system. We need to
    properly interpret the `req` attributes on locations, accounting for region
    connectivity which is handled separately.
    """
    GAME_NAME = 'Zillion'

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions in its access rules."""
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Extract access rules from the zz_loc.req object.

        In Zillion, the `req` attribute specifies the abilities needed to access
        a location, ASSUMING you're already in the region. Region connectivity is
        handled separately by region exit access rules.

        The `req` attribute has these fields:
        - gun: gun power level (1 is starting, 2+ requires Zillion items)
        - jump: jump power level (1 is starting, 2+ requires Opa-Opa items)
        - floppy: number of Floppy Disk items needed
        - red: number of Red ID Card items needed
        - hp: minimum HP required (not used for access, only for exclusions)
        - skill: skill level required (not used for access, only for exclusions)
        - char: starting character (not an access requirement)
        - door: door requirement (not yet implemented)
        """
        if not hasattr(location, 'zz_loc'):
            # Not a Zillion location
            return None

        zz_loc = location.zz_loc
        if not hasattr(zz_loc, 'req'):
            logger.warning(f"Location {location.name} has zz_loc but no req attribute")
            return None

        req = zz_loc.req

        # Build list of required conditions
        conditions: List[Dict[str, Any]] = []

        # gun -> Zillion
        # Starting gun level is 1, so gun=2 means you need 1 Zillion, gun=3 means 2 Zillion, etc.
        if hasattr(req, 'gun') and req.gun > 1:
            count = req.gun - 1
            if count == 1:
                conditions.append({'type': 'item_check', 'item': 'Zillion'})
            else:
                conditions.append({
                    'type': 'item_check',
                    'item': 'Zillion',
                    'count': {'type': 'constant', 'value': count}
                })

        # jump -> Opa-Opa
        # Starting jump level is 1, so jump=2 means you need 1 Opa-Opa, jump=3 means 2 Opa-Opa, etc.
        if hasattr(req, 'jump') and req.jump > 1:
            count = req.jump - 1
            if count == 1:
                conditions.append({'type': 'item_check', 'item': 'Opa-Opa'})
            else:
                conditions.append({
                    'type': 'item_check',
                    'item': 'Opa-Opa',
                    'count': {'type': 'constant', 'value': count}
                })

        # floppy -> Floppy Disk
        # floppy=0 is starting (no disks), floppy=1 means you need 1 disk, etc.
        if hasattr(req, 'floppy') and req.floppy > 0:
            if req.floppy == 1:
                conditions.append({'type': 'item_check', 'item': 'Floppy Disk'})
            else:
                conditions.append({
                    'type': 'item_check',
                    'item': 'Floppy Disk',
                    'count': {'type': 'constant', 'value': req.floppy}
                })

        # red -> Red ID Card
        # red=0 is starting (no cards), red=1 means you need 1 card, etc.
        if hasattr(req, 'red') and req.red > 0:
            if req.red == 1:
                conditions.append({'type': 'item_check', 'item': 'Red ID Card'})
            else:
                conditions.append({
                    'type': 'item_check',
                    'item': 'Red ID Card',
                    'count': {'type': 'constant', 'value': req.red}
                })

        # Note: char, hp, skill, and door fields are not used for access logic export
        # - char: starting character (always available, not collected)
        # - hp/skill: used only for location exclusions, not access
        # - door: not yet implemented in the logic

        # If no conditions, location is accessible with no item requirements
        # (region access is handled separately)
        if not conditions:
            return {'type': 'constant', 'value': True}

        # If only one condition, return it directly
        if len(conditions) == 1:
            return conditions[0]

        # Multiple conditions - combine with AND
        return {
            'type': 'and',
            'conditions': conditions
        }
