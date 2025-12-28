"""Civilization VI export handler."""

from .generic import GenericGameExportHandler


class Civ6GameExportHandler(GenericGameExportHandler):
    """Handler for Civilization VI.

    Uses auto-discovery to export era requirements. The base class now converts
    enum keys (like EraType) to strings automatically, so no custom WORLD_ATTRIBUTES
    functions are needed.
    """

    # Auto-discover world attributes (era_required_non_progressive_items, etc.)
    # The base class handles enum key conversion (EraType -> string)
    AUTO_DISCOVER_WORLD_ATTRIBUTES = True
