"""Kingdom Hearts 1 specific helper expander."""

from typing import List, Set
from .base import BaseGameExportHandler


class KH1GameExportHandler(BaseGameExportHandler):
    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # KH1 uses resolved_items instead of base_items for sphere inventory
    USE_RESOLVED_ITEMS = True

    # Module paths containing helper functions
    HELPER_MODULES: List[str] = ['worlds.kh1.Rules']

    # Helpers that should be preserved as helper calls (not inlined)
    # Complex helpers with for loops, assignments, etc. need localScope
    # which is only created when called as a helper, not when inlined
    HELPERS_TO_PRESERVE: Set[str] = {
        'has_x_worlds',         # Has for loop and variable assignments - needs localScope for loop variable
    }
