# exporter/games/alttp.py

from .base import BaseGameExportHandler


class ALttPGameExportHandler(BaseGameExportHandler):
    # For now, treat all exits as bidirectional
    # This setting is currently only used for region navigation in the frontend
    ASSUME_BIDIRECTIONAL_EXITS = True

    # The following settings are just to make the rules.json file easier to read:

    # Auto-discover region attributes (is_light_world, is_dark_world, type)
    AUTO_DISCOVER_REGION_ATTRIBUTES = True

    # Auto-discover location attributes (crystal, player_address, shop_slot_disabled)
    AUTO_DISCOVER_LOCATION_ATTRIBUTES = False

    # Auto-discover world attributes (shops, dungeons, difficulty_requirements, etc.)
    AUTO_DISCOVER_WORLD_ATTRIBUTES = True

    # Export Choice options as string keys instead of numeric values
    # ALttP rules use string comparisons like `enemy_health in ("easy", "default")`
    # and don't use ordered comparisons, so string keys work correctly
    EXPORT_CHOICE_OPTIONS_AS_NUMERIC = False

    # Progressive item mapping is auto-detected by probing collect_item behavior
    # in the base handler - no manual override needed
