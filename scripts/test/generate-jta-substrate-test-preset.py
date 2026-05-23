#!/usr/bin/env python3
"""
Generate the jta_substrate_test preset.

Derives from the jta_vanilla preset's rules.json (which already
encodes JtA's zone graph as one AP region per zone) and adds the
preset_sidecars block that the procgen player + jtaSubstrateWrapper
need to recognize each region as a `jta`-substrate region and load
the matching JtA zone.

Re-running is idempotent: it overwrites the generated rules.json with
the freshly-computed content.

The preset_files.json index is updated separately (or by
scripts/utils/register-preset.py).

Inputs / outputs are kept relative to the project root so the script
runs from anywhere.
"""

import argparse
import json
import sys
from pathlib import Path


# JtA zone names → zone ids. Matches the order in
# frontend/modules/journey-to-ascension/zones.ts (zone 0 = "The
# Village", ..., zone 15 = "The Dream"). jta_vanilla's region graph
# covers exactly these 16 zones (plus a synthetic "Menu" start region
# which is not itself a JtA zone).
ZONE_MAP = {
    "The Village": 0,
    "The Village Watch": 1,
    "The Raid": 2,
    "The Wilderness": 3,
    "The Cave System": 4,
    "The Road to the City": 5,
    "The City Outskirts": 6,
    "The City": 7,
    "The Forest": 8,
    "The Magician": 9,
    "The Ocean": 10,
    "The Island": 11,
    "The Desert": 12,
    "The Oasis": 13,
    "The Ritual": 14,
    "The Dream": 15,
}

DEFAULT_SOURCE = (
    "frontend/presets/jta_vanilla/AP_14089154938208861744/"
    "AP_14089154938208861744_rules.json"
)
DEFAULT_TARGET_DIR = "frontend/presets/jta_substrate_test/AP_14089154938208861744"
DEFAULT_TARGET_FILENAME = "AP_14089154938208861744_rules.json"


def project_root() -> Path:
    # scripts/test/<this file> → project root is two levels up.
    return Path(__file__).resolve().parents[2]


def _build_sidecar_exits(ap_exits: list) -> list:
    """Mirror the AP region-graph exits into the sidecar's
    playable_payload.exits format.

    The JtA bridge looks exits up via staticData.regions, not via the
    sidecar — but the Presets panel's procgen-stats summary (and any
    other consumer that scans sidecar exits) reads them from here.
    Including them keeps reported region/exit counts accurate.

    Spatial fields (x/y/side) are meaningless for the JtA substrate
    and omitted. isBackExit / isTeleporter are emitted as false so
    Presets-panel's filter (`!isBackExit && !isTeleporter`) counts
    them.
    """
    out = []
    for e in (ap_exits or []):
        name = e.get("name")
        if not name:
            continue
        out.append({
            "exit_id": name,
            "exitName": name,
            "targetRegion": e.get("connected_region"),
            "targetExitId": None,
            "isBackExit": False,
            "isTeleporter": False,
        })
    return out


def build_sidecars(regions: dict, zone_map: dict) -> tuple[dict, list[str]]:
    sidecars: dict = {}
    unmapped: list[str] = []
    for region_name, region in regions.items():
        if region_name in zone_map:
            sidecars[region_name] = {
                "substrate": "jta",
                "render_hint": "jta",
                "playable_payload": {
                    "jtaZone": zone_map[region_name],
                    # Loop-mode opt-in: substrates drain the shared pool
                    # only when this is true. Matches the procgen pipeline
                    # convention.
                    "manaEnabled": True,
                    "exits": _build_sidecar_exits(region.get("exits", [])),
                },
            }
        else:
            unmapped.append(region_name)
    return sidecars, unmapped


# Defaults for the top-level loop_costs block. The jta bridge ignores
# loop_costs entirely (jta drains the shared pool via its own per-tick
# energy calc, not via per-region move costs), but the loops module's
# auto-enter-loop-mode trigger is "cost data is loaded" — so SOME
# loop_costs block has to be present for runtime to flip into loop
# mode. These defaults are arbitrary; they never get consulted.
DEFAULT_LOOP_COSTS = {
    "regions": {},
    "locations": {},
    "defaultRegionCost": 50,
    "defaultLocationCost": 10,
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default=DEFAULT_SOURCE,
        help=f"Source jta_vanilla rules.json (default: {DEFAULT_SOURCE})",
    )
    parser.add_argument(
        "--target-dir",
        default=DEFAULT_TARGET_DIR,
        help=f"Output directory (default: {DEFAULT_TARGET_DIR})",
    )
    parser.add_argument(
        "--player-id",
        default="1",
        help="Player id key in the rules.json (default: 1)",
    )
    args = parser.parse_args()

    root = project_root()
    src = root / args.source
    tgt_dir = root / args.target_dir
    tgt = tgt_dir / DEFAULT_TARGET_FILENAME

    if not src.exists():
        print(f"error: source not found: {src}", file=sys.stderr)
        return 1

    with src.open() as f:
        rules = json.load(f)

    regions = rules.get("regions", {}).get(args.player_id)
    if not isinstance(regions, dict):
        print(
            f"error: rules.json has no regions[{args.player_id!r}] dict",
            file=sys.stderr,
        )
        return 1

    sidecars, unmapped = build_sidecars(regions, ZONE_MAP)
    if not sidecars:
        print("error: no regions mapped to jta zones", file=sys.stderr)
        return 1

    # Splice preset_sidecars onto the rules.json. Existing block (if
    # any) is replaced.
    rules["preset_sidecars"] = {args.player_id: sidecars}
    # Loop_costs is what triggers the loops module's "auto-enter loop
    # mode" path at runtime. See DEFAULT_LOOP_COSTS comment above.
    rules["loop_costs"] = DEFAULT_LOOP_COSTS

    tgt_dir.mkdir(parents=True, exist_ok=True)
    with tgt.open("w") as f:
        json.dump(rules, f, indent=2)
        f.write("\n")

    print(f"wrote {tgt}")
    print(f"  mapped {len(sidecars)} regions to jta zones (0..{max(ZONE_MAP.values())})")
    if unmapped:
        print(f"  unmapped regions (no substrate): {unmapped}")
    print()
    print(
        "Register with the preset index via:\n"
        f"  python3 scripts/utils/register-preset.py {tgt.relative_to(root)} "
        f"--game-id jta_substrate_test --game-name 'JtA (substrate test)'"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
