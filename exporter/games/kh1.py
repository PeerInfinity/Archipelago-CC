"""Kingdom Hearts 1 specific helper expander."""

from typing import Set
from .generic import GenericGameExportHandler


class KH1GameExportHandler(GenericGameExportHandler):
    """Export handler for Kingdom Hearts 1.

    Inherits AUTO_EXPORT_DISCOVERED_HELPERS from GenericGameExportHandler.
    Helper modules (Rules.py) are auto-discovered by the base class.
    """

    # KH1 uses resolved_items instead of base_items for sphere inventory
    USE_RESOLVED_ITEMS = True

    # Helpers that should be preserved as helper calls (not inlined)
    # Complex helpers with for loops, assignments, etc. need localScope
    # which is only created when called as a helper, not when inlined
    HELPERS_TO_PRESERVE: Set[str] = {
        'has_x_worlds',  # Has for loop and variable assignments - needs localScope for loop variable
    }
