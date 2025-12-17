"""Muse Dash game-specific export handler."""

from .generic import GenericGameExportHandler


class MuseDashGameExportHandler(GenericGameExportHandler):
    """Muse Dash specific rule expander.

    Muse Dash marks song items as 'useful' for item balancing purposes,
    but uses them in access rules (state.has). Since Has() normally only
    checks prog_items (progression items), we enable COLLECT_ALL_ITEMS_FOR_RULES
    so that all items are tracked and Has() rules work correctly.
    """

    # Enable collecting all items for rules, not just progression items.
    # This is needed because Muse Dash songs are marked as 'useful' but
    # are used in access rules like: lambda state: state.has(song_name, player)
    COLLECT_ALL_ITEMS_FOR_RULES = True
