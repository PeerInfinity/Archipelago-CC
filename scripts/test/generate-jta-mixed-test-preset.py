#!/usr/bin/env python3
"""
Generate the jta_mixed_test preset.

A minimal three-region preset that exercises the jta substrate in a
mixed-substrate graph:

    Menu  ──►  AdventureZone (text_adventure substrate)  ──►  JtaZone1 (jta substrate, zone 1)

Used to verify cross-substrate region transitions and shared loop-mode
mana sync between the TA and JtA bridges.

Loop mode is on by default: every substrate region's
playable_payload carries `manaEnabled: true`, and a top-level
`loop_costs` block triggers the loops module's auto-enter-loop-mode
path.

Re-running is idempotent.
"""

import argparse
import json
import sys
from pathlib import Path


TARGET_DIR = "frontend/presets/jta_mixed_test/AP_1"
TARGET_FILENAME = "AP_1_rules.json"
PLAYER_ID = "1"
SEED_ID = "1"
GENERATION_SEED = 1
GAME_NAME = "JtA (mixed substrate test)"

# Defaults consulted only by the loops auto-enter-loop-mode trigger;
# jta ignores them, and the TA region uses its own moveCost defaults
# when this block doesn't override them.
DEFAULT_LOOP_COSTS = {
    "regions": {},
    "locations": {},
    "defaultRegionCost": 50,
    "defaultLocationCost": 10,
}


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def build_rules() -> dict:
    """Construct the full rules.json structure."""

    # ── AP region graph ──────────────────────────────────────────
    regions = {
        "Menu": {
            "name": "Menu",
            "exits": [
                {
                    "name": "GameStart",
                    "connected_region": "AdventureZone",
                    "access_rule": {"rule": "True_"},
                },
            ],
            "locations": [],
        },
        "AdventureZone": {
            "name": "AdventureZone",
            "exits": [
                {
                    "name": "ToJtaZone1",
                    "connected_region": "JtaZone1",
                    "access_rule": {"rule": "True_"},
                },
            ],
            "locations": [],
        },
        "JtaZone1": {
            "name": "JtaZone1",
            "exits": [],
            "locations": [],
        },
    }

    # ── Substrate sidecars ───────────────────────────────────────
    # Menu has no sidecar (synthetic). AdventureZone runs under the
    # text_adventure substrate; JtaZone1 runs under jta with zone 1.
    ta_payload = {
        "width": 8,
        "height": 6,
        "tiles": [0] * 48,
        "entrance": {"x": 4, "y": 3},
        "exits": [
            {
                "exit_id": "ToJtaZone1",
                "x": 7,
                "y": 3,
                "side": "E",
                "exitName": "ToJtaZone1",
                "targetRegion": "JtaZone1",
                "targetExitId": "FromAdventure",
                "isBackExit": False,
                "isTeleporter": False,
            },
        ],
        "obstacles": [],
        "items": [],
        "obstacleLib": {},
        "itemLib": {},
        "longestShortestPath": 1,
        "fogEnabled": False,
        "manaEnabled": True,
    }

    sidecars = {
        "AdventureZone": {
            "substrate": "text_adventure",
            "render_hint": "text_adventure",
            "grid_cell": {"gx": 0, "gy": 0},
            "playable_payload": ta_payload,
        },
        "JtaZone1": {
            "substrate": "jta",
            "render_hint": "jta",
            "grid_cell": {"gx": 1, "gy": 0},
            "playable_payload": {
                "jtaZone": 1,
                "manaEnabled": True,
            },
        },
    }

    # ── Minimal AP metadata + miscellaneous ──────────────────────
    #
    # schema_version is an integer (currently 3) — the
    # initialization layer rejects anything else with "Invalid JSON
    # schema version: <X>. Expected 3.".
    #
    # items / item_groups / itempool_counts: a victory item is
    # included so AP has a goal to track; the "Everything" group
    # mirrors what working presets use.
    # canonical_placements / world / exporter follow the rules schema
    # (31d515e2c6 fixed them in the preset only): placements are a
    # location->item OBJECT, a world names its game, and exporter is
    # keyed by slot, so a hand-authored preset carries none.
    rules = {
        "schema_version": 3,
        "game_name": GAME_NAME,
        "game_directory": "jta_mixed_test",
        "archipelago_version": "0.0.0",
        "generation_seed": GENERATION_SEED,
        "seed_name": f"AP_{SEED_ID}",
        "player_names": {PLAYER_ID: "Player1"},
        "regions": {PLAYER_ID: regions},
        "start_regions": {PLAYER_ID: {"default": ["Menu"], "available": []}},
        "items": {
            PLAYER_ID: {
                "victory": {
                    "name": "victory",
                    "id": 1,
                    "groups": ["Everything"],
                    "classification": "progression",
                    "type": None,
                    "max_count": 1,
                },
            },
        },
        "item_groups": {PLAYER_ID: ["Everything"]},
        "itempool_counts": {PLAYER_ID: {"victory": 1}},
        "canonical_placements": {PLAYER_ID: {}},
        "progression_mapping": {PLAYER_ID: {}},
        "starting_items": {PLAYER_ID: []},
        "preset_sidecars": {PLAYER_ID: sidecars},
        "loop_costs": DEFAULT_LOOP_COSTS,
        "world": {PLAYER_ID: {"game": GAME_NAME}},
        "exporter": {},
        "game_info": {},
        "helpers": {},
    }

    return rules


def main(argv=None):
    parser = argparse.ArgumentParser(description="Generate the jta_mixed_test preset.")
    parser.add_argument(
        "--out",
        default=None,
        help=f"write here instead of {TARGET_DIR}/{TARGET_FILENAME} "
        "(test/test_jta_mixed_test_preset.py compares that file to the tracked one)",
    )
    args = parser.parse_args(argv)

    root = project_root()
    tgt = Path(args.out).resolve() if args.out else root / TARGET_DIR / TARGET_FILENAME
    tgt_dir = tgt.parent

    rules = build_rules()
    tgt_dir.mkdir(parents=True, exist_ok=True)
    with tgt.open("w") as f:
        json.dump(rules, f, indent=2)
        f.write("\n")

    print(f"wrote {tgt}")
    print(
        "Register with the preset index via:\n"
        f"  python3 scripts/utils/register-preset.py {TARGET_DIR}/{TARGET_FILENAME} "
        f"--game-id jta_mixed_test --game-name '{GAME_NAME}'"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
