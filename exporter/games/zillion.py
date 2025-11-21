"""Zillion game-specific export handler."""

from typing import Dict, Any, Optional, List
from .generic import GenericGameExportHandler
import logging
from zilliandomizer.logic_components.locations import Req

logger = logging.getLogger(__name__)

class ZillionGameExportHandler(GenericGameExportHandler):
    """Export handler for Zillion.

    Zillion uses the zilliandomizer library for its logic system. Instead of runtime
    testing (which doesn't work during export), we read the requirements directly from
    the zilliandomizer location objects and convert them to our rules format.
    """
    GAME_NAME = 'Zillion'

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions in its access rules."""
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Determine accessibility by testing with zilliandomizer's get_locations() method.

        Instead of just reading the req object (which doesn't capture the full logic),
        we test different item combinations to determine what's actually needed.
        """
        # Check if this is a ZillionLocation with zilliandomizer data
        if not hasattr(location, 'zz_loc'):
            return None

        # Get the zilliandomizer randomizer from the world
        if not hasattr(world, 'zz_system') or not world.zz_system.randomizer:
            logger.warning(f"Cannot determine access rule for {location.name}: zz_system not available")
            return None

        zz_randomizer = world.zz_system.randomizer
        zz_loc = location.zz_loc

        try:
            # Test if location is accessible with baseline (gun=1, jump=1)
            baseline_req = Req(gun=1, jump=1)
            baseline_accessible = zz_randomizer.get_locations(baseline_req)

            if zz_loc in baseline_accessible:
                # Location is accessible from the start
                return {'type': 'constant', 'value': True}

            # Location is not accessible with baseline - determine what's needed
            conditions = []

            # Test different combinations of requirements to determine what's needed
            # We'll test progressively more powerful combinations

            # Track what items are needed
            needs_gun = 0
            needs_jump = 0
            needs_floppy = 0
            needs_red = False

            # Test with max items to see if location becomes accessible at all
            max_req = Req(gun=3, jump=3, floppy=126, red=1)
            max_accessible = zz_randomizer.get_locations(max_req)

            logger.info(f"Location {location.name}: in baseline={zz_loc in baseline_accessible}, in max={zz_loc in max_accessible}")

            if zz_loc not in max_accessible:
                # Location is never accessible even with all items
                # This might be a skill/hp requirement or other special condition
                logger.info(f"Location {location.name} never accessible: req.gun={zz_loc.req.gun}, req.jump={zz_loc.req.jump}, req.floppy={zz_loc.req.floppy}, req.red={zz_loc.req.red}, req.char={zz_loc.req.char}, req.skill={zz_loc.req.skill}, req.hp={zz_loc.req.hp}")

                # Use the req object values as fallback
                if zz_loc.req.gun > 1:
                    needs_gun = zz_loc.req.gun
                if zz_loc.req.jump > 1:
                    needs_jump = zz_loc.req.jump
                if zz_loc.req.floppy > 0:
                    needs_floppy = zz_loc.req.floppy
                if zz_loc.req.red > 0:
                    needs_red = True
            else:
                # Location is accessible with some combination - figure out which items are needed

                # Binary search for gun requirement
                for gun_level in range(2, 4):
                    test_req = Req(gun=gun_level, jump=3, floppy=126, red=1)
                    if zz_loc in zz_randomizer.get_locations(test_req):
                        needs_gun = gun_level
                        break

                # Binary search for jump requirement
                for jump_level in range(2, 4):
                    test_req = Req(gun=3, jump=jump_level, floppy=126, red=1)
                    if zz_loc in zz_randomizer.get_locations(test_req):
                        needs_jump = jump_level
                        break

                # Binary search for floppy requirement
                for floppy_count in [1, 5, 10, 20, 50, 100, 126]:
                    test_req = Req(gun=3, jump=3, floppy=floppy_count, red=1)
                    if zz_loc in zz_randomizer.get_locations(test_req):
                        needs_floppy = floppy_count
                        break

                # Test red card requirement
                test_req = Req(gun=3, jump=3, floppy=126, red=1)
                with_red = zz_randomizer.get_locations(test_req)
                test_req_no_red = Req(gun=3, jump=3, floppy=126, red=0)
                without_red = zz_randomizer.get_locations(test_req_no_red)
                if zz_loc in with_red and zz_loc not in without_red:
                    needs_red = True

                # Now test with the determined requirements to verify
                test_req = Req(
                    gun=max(1, needs_gun),
                    jump=max(1, needs_jump),
                    floppy=needs_floppy,
                    red=1 if needs_red else 0
                )
                final_test = zz_randomizer.get_locations(test_req)
                if zz_loc not in final_test:
                    # Our detection was wrong - use req object as fallback
                    if zz_loc.req.gun > 1:
                        needs_gun = zz_loc.req.gun
                    if zz_loc.req.jump > 1:
                        needs_jump = zz_loc.req.jump
                    if zz_loc.req.floppy > 0:
                        needs_floppy = zz_loc.req.floppy
                    if zz_loc.req.red > 0:
                        needs_red = True

            # Build conditions from detected requirements
            logger.info(f"Location {location.name}: determined needs gun={needs_gun}, jump={needs_jump}, floppy={needs_floppy}, red={needs_red}")

            if needs_gun > 1:
                count_needed = needs_gun - 1
                if count_needed == 1:
                    conditions.append({'type': 'item_check', 'item': 'Zillion'})
                else:
                    conditions.append({
                        'type': 'item_check',
                        'item': 'Zillion',
                        'count': {'type': 'constant', 'value': count_needed}
                    })

            if needs_jump > 1:
                count_needed = needs_jump - 1
                if count_needed == 1:
                    conditions.append({'type': 'item_check', 'item': 'Opa-Opa'})
                else:
                    conditions.append({
                        'type': 'item_check',
                        'item': 'Opa-Opa',
                        'count': {'type': 'constant', 'value': count_needed}
                    })

            if needs_floppy > 0:
                if needs_floppy == 1:
                    conditions.append({'type': 'item_check', 'item': 'Floppy Disk'})
                else:
                    conditions.append({
                        'type': 'item_check',
                        'item': 'Floppy Disk',
                        'count': {'type': 'constant', 'value': needs_floppy}
                    })

            if needs_red:
                conditions.append({'type': 'item_check', 'item': 'Red ID Card'})

            # If we still haven't found the requirements, use the req object as fallback
            if not conditions and zz_loc.req.gun > 1:
                count_needed = zz_loc.req.gun - 1
                if count_needed == 1:
                    conditions.append({'type': 'item_check', 'item': 'Zillion'})
                else:
                    conditions.append({
                        'type': 'item_check',
                        'item': 'Zillion',
                        'count': {'type': 'constant', 'value': count_needed}
                    })

            if not conditions and zz_loc.req.jump > 1:
                count_needed = zz_loc.req.jump - 1
                if count_needed == 1:
                    conditions.append({'type': 'item_check', 'item': 'Opa-Opa'})
                else:
                    conditions.append({
                        'type': 'item_check',
                        'item': 'Opa-Opa',
                        'count': {'type': 'constant', 'value': count_needed}
                    })

            if not conditions and zz_loc.req.floppy > 0:
                if zz_loc.req.floppy == 1:
                    conditions.append({'type': 'item_check', 'item': 'Floppy Disk'})
                else:
                    conditions.append({
                        'type': 'item_check',
                        'item': 'Floppy Disk',
                        'count': {'type': 'constant', 'value': zz_loc.req.floppy}
                    })

            if not conditions and zz_loc.req.red > 0:
                conditions.append({'type': 'item_check', 'item': 'Red ID Card'})

            # Character requirements
            if zz_loc.req.char and len(zz_loc.req.char) < 3:
                char_conditions = []
                for char_name in zz_loc.req.char:
                    char_conditions.append({'type': 'item_check', 'item': char_name})
                if len(char_conditions) == 1:
                    conditions.append(char_conditions[0])
                else:
                    conditions.append({'type': 'or', 'conditions': char_conditions})

            # Build the final access rule
            if not conditions:
                # No special requirements detected - check if accessible with baseline
                test_baseline_again = Req(gun=1, jump=1)
                if zz_loc in zz_randomizer.get_locations(test_baseline_again):
                    # Accessible from the start
                    return {'type': 'constant', 'value': True}
                else:
                    # We couldn't determine the requirements - shouldn't happen
                    logger.warning(f"Could not determine requirements for {location.name}")
                    # Return None to let normal analysis handle it, but that will likely fail too
                    # Better to mark it as inaccessible than incorrectly accessible
                    return None
            elif len(conditions) == 1:
                return conditions[0]
            else:
                return {'type': 'and', 'conditions': conditions}

        except Exception as e:
            logger.warning(f"Failed to determine access rule for {location.name}: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return None
