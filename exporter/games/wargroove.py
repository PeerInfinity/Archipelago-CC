"""Wargroove game-specific export handler.

Wargroove uses LogicMixin methods (_wargroove_has_item, _wargroove_has_region,
_wargroove_has_item_and_region) that are expanded inline to their underlying
rule types during export. These patterns are now handled by the base class.

Exit rules using set_region_exit_rules() with location-based lambdas are also
handled by the base class's handle_complex_exit_rule method.
"""

from .generic import GenericGameExportHandler


class WargrooveGameExportHandler(GenericGameExportHandler):
    """Export handler for Wargroove.

    Wargroove's LogicMixin methods are expanded inline during export:
    - _wargroove_has_item(player, item) -> item_check
    - _wargroove_has_region(player, region) -> can_reach
    - _wargroove_has_item_and_region(player, item, region) -> and(item_check, can_reach)

    These patterns are handled by the base class generic LogicMixin expansion.
    """
    pass
