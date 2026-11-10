#!/usr/bin/env python3
"""Regenerate the spoilerData.js fixtures from the REAL Spoiler Export Hook (worlds/spoiler_export_hook).

usage (cwd = the repo root, the venv active):
    python frontend/modules/client/core/fixtures/spoilerData/make_fixtures.py

Generates seed 1 of a two-player multiworld, A Link to the Past (slot 1) + APQuest (slot 2), every option at its
default, with --skip_output. At pre_output it calls the helper the way the apworlds' client file does, and the
exporter's all-locations sphere logger for the same multiworld (the baseline the expander is compared with). Nothing
here is edited by hand; re-run this when the helper's format moves.

Writes, next to this file:
    seed.json                   seed name, slot_info, and the DataPackage tables of the seed's games (what the server sends)
    own_slot.json               {player: record} with own_slot
    own_slot_with_senders.json  {player: record} with own_slot_with_senders
    omitted.json                the slot_data the client file gives when the helper is not installed
    unknown_format.json         slot 1's own_slot record with a format number no frontend reads (FUTURE_FORMAT)
    sphere_log.jsonl            the exporter's all-locations log (fractional details, as committed presets log)

ALttP is here for the name that does not round-trip: its Progressive Bow carries an id the DataPackage resolves to
"Progressive Bow (Alt)", so the helper sends the name. The script refuses to write if that case is missing.
"""
import importlib
import json
import os
import sys
import tempfile
import types

HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("SKIP_REQUIREMENTS_UPDATE", "1")
sys.path.insert(0, os.getcwd())
FUTURE_FORMAT = 99
PLAYERS = [("SpoilerLinkP1", "A Link to the Past"), ("SpoilerQuestP2", "APQuest")]


def write_json(name, value):
    with open(os.path.join(HERE, name), "w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, indent=1, sort_keys=True)
        handle.write("\n")


def records(hook, multiworld, walked, with_senders):
    return {str(player): hook.compact_for(multiworld, walked, player, with_senders) for player in multiworld.worlds}


def capture(multiworld):
    hook = importlib.import_module("worlds.spoiler_export_hook")
    client = importlib.import_module("worlds.spoiler_export_hook._spoiler_hook_client")
    walked = hook.walk(multiworld)
    own = records(hook, multiworld, walked, False)
    senders = records(hook, multiworld, walked, True)

    bow_rows = [row for row in own["1"]["steps"] if row[2] == "Progressive Bow"]
    if not bow_rows:
        raise SystemExit("no 'Progressive Bow' sent by name in slot 1: the non-round-tripping case is missing")

    games = sorted({world.game for world in multiworld.worlds.values()})
    world_of = {world.game: world for world in multiworld.worlds.values()}
    write_json("seed.json", {
        "seed_name": str(multiworld.seed_name),
        "slot_info": {str(p): {"name": multiworld.player_name[p], "game": w.game} for p, w in multiworld.worlds.items()},
        "data_package": {"games": {game: {"item_name_to_id": dict(sorted(world_of[game].item_name_to_id.items())),
                                          "location_name_to_id": dict(sorted(world_of[game].location_name_to_id.items()))}
                                   for game in games}},
    })
    write_json("own_slot.json", own)
    write_json("own_slot_with_senders.json", senders)
    write_json("unknown_format.json", {**own["1"], "format": FUTURE_FORMAT})

    # The client file's own answer when the helper module cannot be imported.
    world = multiworld.worlds[1]
    world.options.spoiler_data_in_slot_data = client.SpoilerDataInSlotData(1)
    saved = client.HOOK_MODULE
    client.HOOK_MODULE = "worlds.spoiler_export_hook_not_installed"
    try:
        omitted = client.slot_data(world)
    finally:
        client.HOOK_MODULE = saved
        del world.options.spoiler_data_in_slot_data
    write_json("omitted.json", omitted)

    import exporter.sphere_logger as sphere_logger
    import worlds.json_tools_installer.json_tools_settings as json_tools
    json_tools.get_json_tools_settings = lambda: types.SimpleNamespace(
        log_fractional_sphere_details=True, log_integer_sphere_details=False, verbose_sphere_log=False,
        extend_sphere_log_to_all_locations=True, auto_collect_events=False, filter_event_items=False)
    with tempfile.TemporaryDirectory() as tmp:
        multiworld.temp_dir_for_sphere_log = tmp
        saved_playthrough = dict(getattr(multiworld.spoiler, "playthrough", {}) or {})
        sphere_logger.create_playthrough_with_logging(multiworld.spoiler, create_paths=False)
        multiworld.spoiler.playthrough = saved_playthrough
        with open(os.path.join(tmp, f"AP_{multiworld.seed_name}_sphere_log.jsonl"), encoding="utf-8") as handle:
            text = handle.read()
    with open(os.path.join(HERE, "sphere_log.jsonl"), "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
    print(f"wrote fixtures for seed {multiworld.seed_name}: slot 1 {len(own['1']['steps'])} rows, "
          f"slot 2 {len(own['2']['steps'])} rows, {len(bow_rows)} 'Progressive Bow' row(s) by name")


def main():
    with tempfile.TemporaryDirectory() as players_dir:
        for name, game in PLAYERS:
            with open(os.path.join(players_dir, f"{name}.yaml"), "w", encoding="utf-8") as handle:
                handle.write(f"name: {name}\ngame: {game}\n{game}: {{}}\n")
        sys.argv = ["Generate.py", "--player_files_path", players_dir, "--seed", "1", "--skip_output"]
        import Generate
        from worlds import AutoWorld
        real_call_all = AutoWorld.call_all

        def call_all(multiworld, method_name, *args):
            real_call_all(multiworld, method_name, *args)
            if method_name == "pre_output":
                capture(multiworld)

        AutoWorld.call_all = call_all
        import Main
        Main.AutoWorld.call_all = call_all
        erargs, seed = Generate.main()
        Main.main(erargs, seed)


if __name__ == "__main__":
    main()
