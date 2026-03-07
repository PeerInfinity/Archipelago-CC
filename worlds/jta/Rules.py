"""
Access rules for Journey to Ascension.

Zone access is linear (zone N requires zone N-1).
Hidden tasks require their boss to be in a reachable zone.
"""


def set_rules(multiworld, player, goal_zone):
    """Set access rules for entrances and locations.

    For v1, zone access is purely structural (linear chain) and the cost
    generator handles making zone progression energy-viable. No additional
    item-based rules are needed.
    """
    pass
