# Tile-primitives spike (2026-10-21): the maze's push + button CONDITIONS as helpers.
# The engine keeps the primitives (enter, push, hold); these answer only "may it?" / "is it pressed?".
# Regenerate the JSON:  python frontend/modules/mazeRoom/tileSpike/convert.py
#
# Signature (⚖ Q4 v1): f(state, player, cell, tile). `state`/`player` are ambient — `state` is the maze's
# EFFECTIVE inventory (carried + held tokens). `tile` facts: floor, block, player, button, obstacle, clear_set (combos
# of [item, n] pairs — COUNTED ITEMS: `state.count` reads how many are held),
# broken (struck down this visit), struck (ITEM ACTIONS: the obstacle lists the acting action in `struck_by`),
# lane_unless / lane_while (ARROW TRAPS: group tokens of the lanes over the cell), event (ROPES: the cut's event),
# entry (ENTRY GATES: the combos entering the cell needs MOVING this way; [] = no entry that way, None = no gate),
# sink (BLOCK SINKS: a block pushed here sinks — water, lava, a pit — so it enters whatever the cell's clearance, and
# PIT SINKS: even when the cell is not floor, a pit the player cannot walk),
# pull (PULLS: the combos the trap whose disc this step enters from outside needs to reel the player in; None = no pull),
# kind / block_struck / wakes / pulsed (BLOCK KINDS, session tile-mechanisms-m1: the block's kind; the acting use moves it;
# the acting use wakes it; a pulse moves it), pulse (PULSERS: the group token of the pulser whose reach holds the cell; None = none).


def cleared(state, player, tile):
    return tile.obstacle is None or tile.broken or any(all(state.count(p[0], player) >= p[1] for p in combo) for combo in tile.clear_set)


def entry_open(state, player, tile):
    return tile.entry is None or any(all(state.count(p[0], player) >= p[1] for p in combo) for combo in tile.entry)


def player_may_enter(state, player, cell, tile):
    return tile.floor and cleared(state, player, tile) and entry_open(state, player, tile)


def block_may_enter(state, player, cell, tile):
    return (tile.floor or tile.sink) and not tile.block and not tile.player and (tile.sink or cleared(state, player, tile)) and tile.entry is None


def block_struck(state, player, cell, tile):
    return tile.block and tile.block_struck


def woken(state, player, cell, tile):
    return tile.block and tile.wakes


def pulse_armed(state, player, cell, tile):
    return tile.pulse is not None and state.has(tile.pulse, player)


def pulse_shoves(state, player, cell, tile):
    return tile.block and tile.pulsed and tile.pulse is not None and state.has(tile.pulse, player)


def presses(state, player, cell, tile):
    return tile.block or tile.player


def strikes(state, player, cell, tile):
    return tile.obstacle is not None and tile.struck and not tile.broken


def lane_armed(state, player, cell, tile):
    return any(not state.has(t, player) for t in tile.lane_unless) or any(state.has(t, player) for t in tile.lane_while)


def rope_cut(state, player, cell, tile):
    return tile.broken or (tile.event is not None and state.has(tile.event, player))


def pulled(state, player, cell, tile):
    return tile.pull is not None and any(all(state.count(p[0], player) >= p[1] for p in combo) for combo in tile.pull)
