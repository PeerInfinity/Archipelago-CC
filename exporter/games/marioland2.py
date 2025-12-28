"""Super Mario Land 2 game-specific export handler."""

from .generic import GenericGameExportHandler


class MarioLand2GameExportHandler(GenericGameExportHandler):
    """Export handler for Super Mario Land 2.

    Super Mario Land 2 uses custom helper functions for pipe traversal,
    auto-scroll checks, level progression, and zone-specific logic.

    Runtime data (auto_scroll_levels, sprite_data) is auto-discovered via
    AUTO_DISCOVER_WORLD_ATTRIBUTES and exported to world_data.

    Option values referenced in rules (like required_golden_coins) are
    automatically resolved to constants via the base class option resolution.
    """

    # Mario Land 2 has complex rule functions with multiple if-statements that
    # need to be combined into compound conditions for proper export.
    PROCESS_MULTISTATEMENT_IF_BODIES = True

    # Mario Land 2 needs closure variables to be recursively analyzed and inlined
    # to properly export the complex rule logic used in this game.
    RECURSIVELY_ANALYZE_CLOSURES = True
