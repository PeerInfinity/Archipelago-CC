# Tile-primitives spike (2026-10-21): the maze's push + button CONDITIONS as helpers.
# The engine keeps the primitives (enter, push, hold); these answer only "may it?" / "is it pressed?".
# Regenerate the JSON:  python frontend/modules/mazeRoom/tileSpike/convert.py
#
# Signature (⚖ Q4 v1): f(state, player, cell, tile). `state`/`player` are ambient — `state` is the maze's
# EFFECTIVE inventory (carried + held tokens). `tile` facts: floor, block, player, button, obstacle, clear_set,
# broken (struck down this visit), struck (ITEM ACTIONS: the obstacle lists the acting action in `struck_by`).


def cleared(state, player, tile):
    return tile.obstacle is None or tile.broken or any(all(state.has(t, player) for t in combo) for combo in tile.clear_set)


def player_may_enter(state, player, cell, tile):
    return tile.floor and cleared(state, player, tile)


def block_may_enter(state, player, cell, tile):
    return tile.floor and not tile.block and cleared(state, player, tile)


def presses(state, player, cell, tile):
    return tile.block or tile.player


def strikes(state, player, cell, tile):
    return tile.obstacle is not None and tile.struck and not tile.broken
