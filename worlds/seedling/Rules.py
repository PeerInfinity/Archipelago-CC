from BaseClasses import CollectionState, MultiWorld
from .Options import Difficulty


def has_item(state: CollectionState, player: int, item: str):
    if item == "Conch":
        return state.item_count("Progressive Swim", player) >= 1
    elif item == "Penguin's Feather":
        return state.item_count("Progressive Swim", player) >= 2
    elif item == "Sword":
        return state.item_count("Progressive Sword", player) >= 1
    elif item == "Shield":
        return state.item_count("Progressive Shield", player) >= 1
    elif item == "Dark Shield":
        return state.item_count("Progressive Shield", player) >= 2
    elif item == "Shards":
        return state.item_count("Totem Shard", player) >= 5
    elif item == "Ghost Sword":
        return (
            state.item_count("Progressive Sword", player) >= 1
            and state.has("Ghost Spear", player)
            and state.has("Ghost Sword Fusion", player)
        )
    elif item == "Fire Wand":
        return (
            state.has("Fire", player)
            and state.has("Wand", player)
            and state.has("Fire Wand Fusion", player)
        )
    else:
        return state.has(item, player)


def generated_rules(multiworld: MultiWorld, player: int):
    multiworld.get_location("Penguin's Feather", player).access_rule = lambda state: (
        (
            has_item(state, player, "Conch")
            and (
                has_item(state, player, "Penguin's Feather")
                or has_item(state, player, "Fire")
                or has_item(state, player, "Sword")
                or has_item(state, player, "Ghost Spear")
            )
        )
    )
    multiworld.get_location("Dark Sword", player).access_rule = lambda state: (
        (
            has_item(state, player, "Wand")
            and (
                has_item(state, player, "Sword")
                or has_item(state, player, "Fire")
                or has_item(state, player, "Ghost Spear")
                or (
                    has_item(state, player, "Conch")
                    and has_item(state, player, "Yellow Key")
                )
                or (
                    has_item(state, player, "Conch")
                    and has_item(state, player, "Penguin's Feather")
                )
            )
        )
    )

    multiworld.get_location("Chest (Waterfall)", player).access_rule = lambda state: (
        (
            has_item(state, player, "Conch")
            and (
                has_item(state, player, "Penguin's Feather")
                or has_item(state, player, "Fire")
                or has_item(state, player, "Sword")
                or has_item(state, player, "Ghost Spear")
            )
        )
    )
    multiworld.get_location(
        "Chest (Adnan's cave)", player
    ).access_rule = lambda state: (
        (
            has_item(state, player, "Sword")
            or has_item(state, player, "Ghost Spear")
            or (
                (
                    has_item(state, player, "Fire")
                    or (
                        has_item(state, player, "Conch")
                        and (
                            has_item(state, player, "Penguin's Feather")
                            or has_item(state, player, "Yellow Key")
                        )
                    )
                )
                and (
                    has_item(state, player, "Wand")
                    or has_item(state, player, "Dark Shield")
                    or (
                        has_item(state, player, "Dark Suit")
                        and has_item(state, player, "Health")
                    )
                )
            )
        )
        or (
            (
                state.multiworld.difficulty[player].value
                >= Difficulty.option_unreasonable
            )
            and (
                has_item(state, player, "Fire")
                or (
                    has_item(state, player, "Conch")
                    and (
                        has_item(state, player, "Penguin's Feather")
                        or has_item(state, player, "Yellow Key")
                    )
                )
            )
        )
    )
    multiworld.get_location("Chest (South Rocks)", player).access_rule = lambda state: (
        (
            has_item(state, player, "Fire")
            or (
                has_item(state, player, "Conch")
                and (
                    has_item(state, player, "Penguin's Feather")
                    or has_item(state, player, "Yellow Key")
                    or has_item(state, player, "Sword")
                    or has_item(state, player, "Ghost Spear")
                )
            )
        )
    )

    if getattr(multiworld, "boss_locations")[player].value:
        multiworld.get_location("Owl", player).access_rule = lambda state: (
            (
                has_item(state, player, "Ghost Sword")
                and has_item(state, player, "Conch")
            )
            or (
                (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
                and (has_item(state, player, "Ghost Sword"))
            )
        )
    multiworld.get_location("Shield", player).access_rule = lambda state: (
        (
            has_item(state, player, "Red Key")
            and (
                has_item(state, player, "Sword")
                or has_item(state, player, "Ghost Spear")
            )
        )
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (
                has_item(state, player, "Red Key")
                and (
                    (
                        has_item(state, player, "Wand")
                        and (
                            has_item(state, player, "Conch")
                            or has_item(state, player, "Fire")
                        )
                    )
                    or (
                        has_item(state, player, "Dark Shield")
                        and has_item(state, player, "Conch")
                    )
                )
            )
        )
    )
    multiworld.get_location("Red Key", player).access_rule = lambda state: (
        (has_item(state, player, "Sword") or has_item(state, player, "Ghost Spear"))
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (
                (
                    has_item(state, player, "Wand")
                    and (
                        has_item(state, player, "Conch")
                        or has_item(state, player, "Fire")
                    )
                )
                or (
                    has_item(state, player, "Dark Shield")
                    and has_item(state, player, "Conch")
                )
            )
        )
    )
    multiworld.get_location(
        "Chest (Gundernourd Water)", player
    ).access_rule = lambda state: (
        (has_item(state, player, "Conch"))
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (has_item(state, player, "Sword"))
        )
    )
    multiworld.get_location(
        "Chest (Gundernourd Pit)", player
    ).access_rule = lambda state: (
        (
            has_item(state, player, "Sword")
            or has_item(state, player, "Fire")
            or has_item(state, player, "Ghost Spear")
        )
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (has_item(state, player, "Conch"))
        )
    )
    if getattr(multiworld, "boss_locations")[player].value:
        multiworld.get_location("Shieldspire", player).access_rule = lambda state: (
            (has_item(state, player, "Sword") or has_item(state, player, "Ghost Spear"))
            or (
                (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
                and (
                    (
                        has_item(state, player, "Wand")
                        and (
                            has_item(state, player, "Conch")
                            or has_item(state, player, "Fire")
                        )
                    )
                    or (
                        has_item(state, player, "Dark Shield")
                        and has_item(state, player, "Conch")
                    )
                )
            )
        )
    multiworld.get_location("Light", player).access_rule = lambda state: (
        (
            (
                has_item(state, player, "Conch")
                and (
                    (
                        has_item(state, player, "Green Key")
                        and (
                            has_item(state, player, "Yellow Key")
                            or has_item(state, player, "Penguin's Feather")
                            or has_item(state, player, "Fire")
                        )
                    )
                    or (
                        has_item(state, player, "Sword")
                        or has_item(state, player, "Ghost Spear")
                    )
                )
            )
            or (
                has_item(state, player, "Red Key")
                and (
                    has_item(state, player, "Sword")
                    or has_item(state, player, "Ghost Spear")
                )
            )
            or (
                has_item(state, player, "Shield")
                and has_item(state, player, "Wand")
                and (
                    has_item(state, player, "Sword")
                    or has_item(state, player, "Ghost Spear")
                )
            )
            or (
                has_item(state, player, "Fire")
                and (
                    has_item(state, player, "Sword")
                    or has_item(state, player, "Ghost Spear")
                    or has_item(state, player, "Wand")
                    or has_item(state, player, "Dark Shield")
                )
            )
        )
    )
    multiworld.get_location("Green Key", player).access_rule = lambda state: (
        (
            (
                has_item(state, player, "Conch")
                and (
                    has_item(state, player, "Yellow Key")
                    or has_item(state, player, "Penguin's Feather")
                    or has_item(state, player, "Fire")
                    or has_item(state, player, "Sword")
                    or has_item(state, player, "Ghost Spear")
                )
            )
            or (
                has_item(state, player, "Red Key")
                and (
                    has_item(state, player, "Sword")
                    or has_item(state, player, "Ghost Spear")
                )
            )
            or (
                has_item(state, player, "Shield")
                and has_item(state, player, "Wand")
                and (
                    has_item(state, player, "Sword")
                    or has_item(state, player, "Ghost Spear")
                )
            )
            or (
                has_item(state, player, "Fire")
                and (
                    has_item(state, player, "Sword")
                    or has_item(state, player, "Ghost Spear")
                    or has_item(state, player, "Wand")
                    or has_item(state, player, "Dark Shield")
                )
            )
        )
    )
    multiworld.get_location("Fire", player).access_rule = lambda state: (
        (
            has_item(state, player, "Green Key")
            and (
                (
                    has_item(state, player, "Conch")
                    and (
                        (
                            (
                                has_item(state, player, "Yellow Key")
                                or has_item(state, player, "Penguin's Feather")
                            )
                            and (
                                has_item(state, player, "Wand")
                                or has_item(state, player, "Dark Shield")
                            )
                        )
                        or (
                            has_item(state, player, "Sword")
                            or has_item(state, player, "Ghost Spear")
                        )
                    )
                    or (
                        has_item(state, player, "Red Key")
                        and (
                            has_item(state, player, "Sword")
                            or has_item(state, player, "Ghost Spear")
                        )
                    )
                    or (
                        has_item(state, player, "Shield")
                        and has_item(state, player, "Wand")
                        and (
                            has_item(state, player, "Sword")
                            or has_item(state, player, "Ghost Spear")
                        )
                    )
                    or (
                        has_item(state, player, "Fire")
                        and (
                            has_item(state, player, "Sword")
                            or has_item(state, player, "Ghost Spear")
                            or has_item(state, player, "Wand")
                            or has_item(state, player, "Dark Shield")
                        )
                    )
                )
            )
        )
    )
    multiworld.get_location("Chest (Rostef)", player).access_rule = lambda state: (
        (
            (
                has_item(state, player, "Conch")
                and (
                    (
                        (
                            has_item(state, player, "Yellow Key")
                            or has_item(state, player, "Penguin's Feather")
                        )
                        and (
                            has_item(state, player, "Wand")
                            or has_item(state, player, "Dark Shield")
                        )
                    )
                    or (
                        has_item(state, player, "Sword")
                        or has_item(state, player, "Ghost Spear")
                    )
                )
                or (
                    has_item(state, player, "Red Key")
                    and (
                        has_item(state, player, "Sword")
                        or has_item(state, player, "Ghost Spear")
                    )
                )
                or (
                    has_item(state, player, "Shield")
                    and has_item(state, player, "Wand")
                    and (
                        has_item(state, player, "Sword")
                        or has_item(state, player, "Ghost Spear")
                    )
                )
                or (
                    has_item(state, player, "Fire")
                    and (
                        has_item(state, player, "Sword")
                        or has_item(state, player, "Ghost Spear")
                        or has_item(state, player, "Wand")
                        or has_item(state, player, "Dark Shield")
                    )
                )
            )
        )
    )
    if getattr(multiworld, "boss_locations")[player].value:
        multiworld.get_location("Times", player).access_rule = lambda state: (
            (
                has_item(state, player, "Green Key")
                and (
                    (
                        has_item(state, player, "Conch")
                        and (
                            (
                                (
                                    has_item(state, player, "Yellow Key")
                                    or has_item(state, player, "Penguin's Feather")
                                )
                                and (
                                    has_item(state, player, "Wand")
                                    or has_item(state, player, "Dark Shield")
                                )
                            )
                            or (
                                has_item(state, player, "Sword")
                                or has_item(state, player, "Ghost Spear")
                            )
                        )
                        or (
                            has_item(state, player, "Red Key")
                            and (
                                has_item(state, player, "Sword")
                                or has_item(state, player, "Ghost Spear")
                            )
                        )
                        or (
                            has_item(state, player, "Shield")
                            and has_item(state, player, "Wand")
                            and (
                                has_item(state, player, "Sword")
                                or has_item(state, player, "Ghost Spear")
                            )
                        )
                        or (
                            has_item(state, player, "Fire")
                            and (
                                has_item(state, player, "Sword")
                                or has_item(state, player, "Ghost Spear")
                                or has_item(state, player, "Wand")
                                or has_item(state, player, "Dark Shield")
                            )
                        )
                    )
                )
            )
        )
    multiworld.get_location("Conch", player).access_rule = lambda state: (
        (has_item(state, player, "Fire"))
    )
    multiworld.get_location("Blue Key", player).access_rule = lambda state: (
        (
            has_item(state, player, "Fire")
            and has_item(state, player, "Conch")
            and (
                has_item(state, player, "Penguin's Feather")
                or has_item(state, player, "Sword")
                or has_item(state, player, "Ghost Spear")
                or has_item(state, player, "Wand")
                or has_item(state, player, "Dark Shield")
            )
        )
    )
    multiworld.get_location(
        "Chest (Trohn Inside)", player
    ).access_rule = lambda state: (
        (has_item(state, player, "Fire") and has_item(state, player, "Conch"))
        or (
            (
                state.multiworld.difficulty[player].value
                >= Difficulty.option_unreasonable
            )
            and (has_item(state, player, "Fire") and has_item(state, player, "Sword"))
        )
    )
    multiworld.get_location(
        "Chest (Trohn Outside)", player
    ).access_rule = lambda state: (
        (
            has_item(state, player, "Conch")
            and (
                has_item(state, player, "Yellow Key")
                or has_item(state, player, "Penguin's Feather")
                or has_item(state, player, "Fire")
                or has_item(state, player, "Ghost Spear")
                or has_item(state, player, "Sword")
            )
        )
    )
    if getattr(multiworld, "boss_locations")[player].value:
        multiworld.get_location("Tentacled Beast", player).access_rule = lambda state: (
            (
                has_item(state, player, "Fire")
                and has_item(state, player, "Conch")
                and has_item(state, player, "Blue Key")
                and (
                    has_item(state, player, "Sword")
                    or has_item(state, player, "Ghost Spear")
                    or has_item(state, player, "Dark Shield")
                    or has_item(state, player, "Fire Wand")
                )
            )
            or (
                (
                    state.multiworld.difficulty[player].value
                    >= Difficulty.option_unreasonable
                )
                and (
                    has_item(state, player, "Fire")
                    and has_item(state, player, "Conch")
                    and has_item(state, player, "Blue Key")
                    and has_item(state, player, "Wand")
                )
            )
        )
    multiworld.get_location(
        "Totem Shard (Three Blocks Puzzle)", player
    ).access_rule = lambda state: (has_item(state, player, "Fire"))
    multiworld.get_location(
        "Totem Shard (Main Room Left)", player
    ).access_rule = lambda state: (has_item(state, player, "Fire"))
    multiworld.get_location(
        "Totem Shard (Mortar)", player
    ).access_rule = lambda state: (
        (
            has_item(state, player, "Fire")
            and has_item(state, player, "Purple Key")
            and (
                has_item(state, player, "Sword")
                or has_item(state, player, "Ghost Spear")
                or has_item(state, player, "Wand")
            )
        )
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (
                has_item(state, player, "Fire")
                and has_item(state, player, "Purple Key")
            )
        )
    )
    multiworld.get_location(
        "Totem Shard (One Moving Block Puzzle)", player
    ).access_rule = lambda state: (
        (
            has_item(state, player, "Fire")
            and has_item(state, player, "Purple Key")
            and (
                has_item(state, player, "Sword")
                or has_item(state, player, "Ghost Spear")
                or has_item(state, player, "Wand")
            )
        )
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (
                has_item(state, player, "Fire")
                and has_item(state, player, "Purple Key")
            )
        )
    )
    multiworld.get_location(
        "Totem Shard (Two Moving Blocks Puzzle)", player
    ).access_rule = lambda state: (
        (
            has_item(state, player, "Fire")
            and has_item(state, player, "Purple Key")
            and (
                has_item(state, player, "Sword")
                or has_item(state, player, "Ghost Spear")
                or has_item(state, player, "Wand")
            )
        )
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (
                has_item(state, player, "Fire")
                and has_item(state, player, "Purple Key")
            )
        )
    )
    multiworld.get_location("Purple Key", player).access_rule = lambda state: (
        (
            has_item(state, player, "Fire")
            and (
                has_item(state, player, "Sword")
                or has_item(state, player, "Ghost Spear")
                or has_item(state, player, "Wand")
            )
        )
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (
                has_item(state, player, "Fire")
                and (
                    has_item(state, player, "Dark Shield")
                    or (
                        has_item(state, player, "Dark Suit")
                        and has_item(state, player, "Health")
                    )
                )
            )
        )
    )
    multiworld.get_location("Wand", player).access_rule = lambda state: (
        (has_item(state, player, "Fire") and has_item(state, player, "Shards"))
    )
    multiworld.get_location(
        "Chest (Lacste Entrance)", player
    ).access_rule = lambda state: (
        (
            has_item(state, player, "Fire")
            or (
                has_item(state, player, "Conch")
                and (
                    has_item(state, player, "Sword")
                    or has_item(state, player, "Ghost Spear")
                    or has_item(state, player, "Penguin's Feather")
                    or has_item(state, player, "Yellow Key")
                )
            )
        )
    )
    multiworld.get_location(
        "Chest (Lacste Main Room)", player
    ).access_rule = lambda state: (
        (
            has_item(state, player, "Fire")
            and (
                has_item(state, player, "Sword")
                or has_item(state, player, "Ghost Spear")
                or has_item(state, player, "Wand")
            )
        )
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (has_item(state, player, "Fire"))
        )
    )
    if getattr(multiworld, "boss_locations")[player].value:
        multiworld.get_location("Totem of Lacste", player).access_rule = lambda state: (
            (
                has_item(state, player, "Wand")
                and has_item(state, player, "Fire")
                and has_item(state, player, "Shards")
            )
        )
    multiworld.get_location("Ghost Spear", player).access_rule = lambda state: (
        (
            has_item(state, player, "Conch")
            and (
                has_item(state, player, "Sword")
                or has_item(state, player, "Ghost Spear")
                or has_item(state, player, "Fire Wand")
                or (
                    has_item(state, player, "Dark Shield")
                    and (
                        has_item(state, player, "Yellow Key")
                        or has_item(state, player, "Penguin's Feather")
                        or has_item(state, player, "Fire")
                    )
                )
            )
        )
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (
                has_item(state, player, "Conch")
                and has_item(state, player, "Dark Suit")
                and has_item(state, player, "Health")
                and has_item(state, player, "Wand")
                and (
                    has_item(state, player, "Yellow Key")
                    or has_item(state, player, "Penguin's Feather")
                    or has_item(state, player, "Fire")
                )
                and (
                    has_item(state, player, "Fire") or has_item(state, player, "Shield")
                )
            )
        )
        or (
            (
                state.multiworld.difficulty[player].value
                >= Difficulty.option_unreasonable
            )
            and (
                has_item(state, player, "Conch")
                and has_item(state, player, "Wand")
                and (
                    has_item(state, player, "Fire") or has_item(state, player, "Shield")
                )
                and (
                    has_item(state, player, "Yellow Key")
                    or has_item(state, player, "Penguin's Feather")
                    or has_item(state, player, "Fire")
                )
            )
        )
    )
    multiworld.get_location("Yellow Key", player).access_rule = lambda state: (
        (has_item(state, player, "Ghost Spear"))
    )

    multiworld.get_location("Health", player).access_rule = lambda state: (
        (
            has_item(state, player, "Conch")
            and has_item(state, player, "Ghost Spear")
            and has_item(state, player, "Yellow Key")
            and has_item(state, player, "Wand")
        )
    )

    multiworld.get_location("Chest (Woshad)", player).access_rule = lambda state: (
        (
            has_item(state, player, "Conch")
            and has_item(state, player, "Ghost Spear")
            and has_item(state, player, "Dark Suit")
        )
    )

    if getattr(multiworld, "boss_locations")[player].value:
        multiworld.get_location("Lights", player).access_rule = lambda state: (
            (
                has_item(state, player, "Conch")
                and has_item(state, player, "Ghost Spear")
                and has_item(state, player, "Yellow Key")
            )
        )
    multiworld.get_location("Dark Shield", player).access_rule = lambda state: (
        (
            has_item(state, player, "Yellow Key")
            and has_item(state, player, "Wand")
            and has_item(state, player, "Ghost Spear")
            and (has_item(state, player, "Fire") or has_item(state, player, "Conch"))
        )
    )
    multiworld.get_location("Dark Suit", player).access_rule = lambda state: (
        (
            has_item(state, player, "Dark Shield")
            and has_item(state, player, "Yellow Key")
            and has_item(state, player, "Wand")
            and has_item(state, player, "Ghost Spear")
            and (has_item(state, player, "Fire") or has_item(state, player, "Conch"))
        )
        or (
            (state.multiworld.difficulty[player].value >= Difficulty.option_tricky)
            and (
                has_item(state, player, "Dark Suit")
                and has_item(state, player, "Yellow Key")
                and has_item(state, player, "Wand")
                and has_item(state, player, "Ghost Spear")
                and (
                    has_item(state, player, "Fire") or has_item(state, player, "Conch")
                )
            )
        )
    )
    multiworld.get_location(
        "Chest (Bosiniad Main Room)", player
    ).access_rule = lambda state: (
        (
            has_item(state, player, "Yellow Key")
            and has_item(state, player, "Wand")
            and has_item(state, player, "Ghost Spear")
            and (has_item(state, player, "Fire") or has_item(state, player, "Conch"))
        )
    )
    multiworld.get_location(
        "Chest (Bosiniad Lava)", player
    ).access_rule = lambda state: (
        (
            has_item(state, player, "Dark Suit")
            and has_item(state, player, "Yellow Key")
            and has_item(state, player, "Wand")
            and has_item(state, player, "Ghost Spear")
            and (has_item(state, player, "Fire") or has_item(state, player, "Conch"))
        )
    )
    if getattr(multiworld, "boss_locations")[player].value:
        multiworld.get_location("King of Fire", player).access_rule = lambda state: (
            (
                has_item(state, player, "Dark Suit")
                and has_item(state, player, "Yellow Key")
                and has_item(state, player, "Wand")
                and has_item(state, player, "Ghost Spear")
                and (
                    has_item(state, player, "Fire") or has_item(state, player, "Conch")
                )
            )
        )
    multiworld.get_location("Ghost Sword", player).access_rule = lambda state: (
        (
            has_item(state, player, "Conch")
            and has_item(state, player, "Penguin's Feather")
            and has_item(state, player, "Ghost Spear")
            and has_item(state, player, "Dark Suit")
        )
    )
    multiworld.get_location("Fire Wand", player).access_rule = lambda state: (
        (
            has_item(state, player, "Ghost Sword")
            and has_item(state, player, "Conch")
            and has_item(state, player, "Penguin's Feather")
            and has_item(state, player, "Dark Suit")
        )
    )
    multiworld.get_location("Chest (Ghethis)", player).access_rule = lambda state: (
        (
            has_item(state, player, "Conch")
            and has_item(state, player, "Penguin's Feather")
            and has_item(state, player, "Ghost Spear")
            and has_item(state, player, "Dark Suit")
        )
    )
