"""jakanddaxter: every region-local nested helper its rules reference is EXPORTED.

The world's region builders (`worlds/jakanddaxter/regs/*_regions.py`) define 8
nested `def can_…(state, p)` helpers (7 names; `can_jump_farther` twice, same body)
and call them from location/exit lambdas as `can_…(state, player)`. Before this row
the exporter emitted the 31 references but no bodies (the player parameter is named
`p`, so the auto-preserve cache refused them), and the JS worker coerced each
missing helper to false: with ALL items the preset reached 182/239 locations.
The analyzer half is pinned shape by shape in
`test_json/exporter/analyzer/test_nested_helper_export.py`; this row holds the
real world to it, for player 1 and player 2.
"""
from exporter.analyzer import analyze_rule, clear_caches, reset_analyze_rule_counter
from exporter.games import get_game_export_handler

NESTED = {'can_jump_farther', 'can_jump_higher', 'can_triple_jump', 'can_jump_stairs',
          'can_cross_long_gap', 'can_jump_blockers', 'can_uppercut_and_jump_logs'}


def _referenced(rule, out):
    if isinstance(rule, dict):
        if rule.get('type') == 'helper':
            out.add(rule.get('name'))
        for value in rule.values():
            _referenced(value, out)
    elif isinstance(rule, list):
        for value in rule:
            _referenced(value, out)


def _export_player(multiworld, player):
    clear_caches()
    reset_analyze_rule_counter()
    world = multiworld.worlds[player]
    handler = get_game_export_handler(world.game, world)
    referenced = set()
    for spot in (*multiworld.get_locations(player), *multiworld.get_entrances(player)):
        _referenced(analyze_rule(spot.access_rule, game_handler=handler, player_context=player), referenced)
    return referenced, handler.get_helper_definitions(world)


def test_every_referenced_nested_helper_has_a_body_for_each_player(monkeypatch):
    from test.general import setup_multiworld
    from worlds.jakanddaxter import JakAndDaxterSettings, JakAndDaxterWorld

    from worlds.AutoWorld import AutoWorldRegister

    # The root conftest drops jakanddaxter (an upstream world) from AutoWorldRegister
    # so its own suite does not run here. This row is the fork's EXPORTER test, so it
    # puts the world back for itself: the register entry (MultiWorld.set_options looks
    # the game up there) and, because host.yaml's `jakanddaxter_options` then loaded
    # as a plain dict, the lazily cached class settings (its options code reads
    # `settings.enforce_friendly_options`), seeded with the group's defaults.
    monkeypatch.setitem(AutoWorldRegister.world_types, JakAndDaxterWorld.game, JakAndDaxterWorld)
    if not isinstance(JakAndDaxterWorld.settings, JakAndDaxterSettings):
        monkeypatch.setattr(JakAndDaxterWorld, '_AutoWorldRegister__settings', JakAndDaxterSettings())

    multiworld = setup_multiworld([JakAndDaxterWorld, JakAndDaxterWorld])
    bodies = {}
    for player in (1, 2):
        referenced, helpers = _export_player(multiworld, player)
        assert NESTED <= referenced, f'census moved: {sorted(NESTED - referenced)} no longer referenced'
        missing = sorted(name for name in referenced if name not in helpers)
        assert missing == [], f'player {player}: referenced helpers without a body: {missing}'
        bodies[player] = {name: helpers[name] for name in NESTED}
    # The player is filtered, not folded in as an item count: both slots' bodies are equal.
    assert bodies[1] == bodies[2]
