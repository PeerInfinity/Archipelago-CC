# exporter/games/alttp.py

from .base import BaseGameExportHandler


class ALttPGameExportHandler(BaseGameExportHandler):
    # The following settings are just to make the rules.json file easier to read:

    # Auto-discover location attributes (crystal, player_address, shop_slot_disabled)
    AUTO_DISCOVER_LOCATION_ATTRIBUTES = False

    # Export Choice options as string keys instead of numeric values
    # ALttP rules use string comparisons like `enemy_health in ("easy", "default")`
    # and don't use ordered comparisons, so string keys work correctly
    EXPORT_CHOICE_OPTIONS_AS_NUMERIC = False
