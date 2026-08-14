#!/usr/bin/env python3
"""Extract the VANILLA Seedling level set as a level-set manifest.

Plan §4.3: the vanilla 116 rooms are a set in the external-level-set format too
— there is no privileged built-in path, and mounting vanilla through the same
loader is what makes every boot of the ordinary game a test of that loader. This
script builds that manifest from the AS3 source so the schema frozen in Phase 2
can be proved against the real thing rather than against a hand-written sketch.

⛓ IT IS ALSO THE INDEPENDENT PARSER. The validator
(frontend/modules/seedlingDemo/levelSetValidator.js) reads OEL with a regex, for
browser-bundle reasons. This script reads it with ElementTree. The committed
fixtures are produced HERE and consumed THERE, so the test exercises the regex
parser against data an unrelated parser produced — a verifier that shared the
generator's assumptions would prove nothing about either.

Outputs (paths relative to the repo root):
  frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json
      the manifest: 116 rooms with `embed` sources, real musics, menu_rooms,
      start and the closed named_rooms vocabulary. Emitted UNSTAMPED — the
      content hash is applied by stampLevelSetIdentity() on the JS side so the
      hash is the one the validator itself computes.
  frontend/modules/seedlingDemo/fixtures/seedling-vanilla-room-refs.json
      per-room REDUCED OEL: every element bearing @to / @fallthrough / @room /
      @tag / @tset / @sign, with the tile grid and untagged decoration dropped.
      ⚠ WHAT THIS BOUNDS: it is a faithful projection of exactly the surface the
      validator reads and of nothing else. It proves the real cross-reference
      graph validates; it does not prove a room loads, and it is not a level.

Usage:  python3 scripts/procgen/extract-seedling-vanilla-set.py [--seedling DIR]
"""
import argparse
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIXTURES = os.path.join(REPO, "frontend", "modules", "seedlingDemo", "fixtures")

# Attributes that make an element interesting to the level-set validator.
REF_ATTRS = ("to", "fallthrough", "room", "tag", "tset", "sign", "playerx", "playery")

# §3.5 / §8.2: the per-set constants that were literals in Game.as.
SNOW_GRADIENT_LEVEL = 45        # Game.as:908  "if (level == 45)"
MUSIC_EXEMPT_LEVEL = 10         # Game.as:1175, :1181  "level != 10"

# §8.2a: the six room references that live in CODE, so no bundle rewrite reaches
# them. Values are vanilla's; each is re-derived below only as a cross-check.
NAMED_ROOMS = {
    "moonrock_target":      {"level": 2},
    "watcher_text":         {"level": 114},
    "dark_shrum_death":     {"level": 114, "x": 72,  "y": 128},
    "bloody_seed_ending":   {"level": 1,   "x": 64,  "y": 96},
    "light_boss_exit":      {"level": 36,  "x": 112, "y": 96},
    "tentacle_beast_mouth": {"level": 58,  "x": 56,  "y": 96},
}


def need(pattern, text, what):
    m = re.search(pattern, text, re.S)
    if m is None:
        sys.exit("EXTRACTION FAILED: could not find " + what)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seedling", default=os.path.expanduser("~/CC/seedling"),
                    help="the AS3 fork (branch 'bot')")
    ap.add_argument("--stdout", action="store_true", help="print instead of writing")
    args = ap.parse_args()

    src = os.path.join(args.seedling, "src")
    assets = os.path.join(args.seedling, "assets")
    game_as = os.path.join(src, "Game.as")
    if not os.path.exists(game_as):
        sys.exit(f"EXTRACTION FAILED: no Game.as at {game_as} — pass --seedling")
    game = open(game_as, encoding="utf-8", errors="replace").read()

    embeds = {}
    for m in re.finditer(
        r"\[Embed\(\s*source\s*=\s*'([^']+)'[^\]]*\]\s*public static var (\w+):Class", game
    ):
        embeds[m.group(2)] = m.group(1)

    names = [s.strip() for s in need(
        r"public static const levels:Array = new Array\((.*?)\);", game, "levels array"
    ).group(1).split(",") if s.strip()]
    musics = [int(s.strip()) for s in need(
        r"public static var levelMusics:Array = new Array\((.*?)\);", game, "levelMusics"
    ).group(1).split(",") if s.strip()]
    menu = [int(s.strip()) for s in need(
        r"menuLevels[^=]*=\s*new Array\((.*?)\);", game, "menuLevels"
    ).group(1).split(",") if s.strip()]

    if len(musics) != len(names):
        sys.exit(f"EXTRACTION FAILED: levelMusics has {len(musics)} entries for "
                 f"{len(names)} levels — the arrays are parallel and must match")

    rooms, refs = [], {}
    counts = {"teleporter_to": 0, "stairs_to": 0, "fallthrough": 0, "buttonroom_room": 0}

    for idx, name in enumerate(names):
        rel = embeds.get(name)
        if rel is None:
            sys.exit(f"EXTRACTION FAILED: level {idx} '{name}' has no [Embed]")
        path = os.path.normpath(os.path.join(src, rel))
        if not os.path.exists(path):
            sys.exit(f"EXTRACTION FAILED: level {idx} '{name}' -> missing {path}")

        room = {
            "id": idx,
            "name": name,
            "source": {"embed": os.path.relpath(path, assets).replace(os.sep, "/")},
            "music": musics[idx],
        }
        if idx == SNOW_GRADIENT_LEVEL:
            room["snow_gradient"] = True
        if idx == MUSIC_EXEMPT_LEVEL:
            room["music_override_exempt"] = True
        rooms.append(room)

        kept = []
        for el in ET.parse(path).getroot().iter():
            attrs = {k: v for k, v in el.attrib.items() if k in REF_ATTRS and v != ""}
            if not attrs:
                continue
            if el.tag in ("teleporter", "stairsup", "stairsdown") and "to" in attrs:
                counts["teleporter_to" if el.tag == "teleporter" else "stairs_to"] += 1
            if "fallthrough" in attrs:
                counts["fallthrough"] += 1
            if el.tag == "buttonroom" and "room" in attrs:
                counts["buttonroom_room"] += 1
            body = "".join(f' {k}="{v}"' for k, v in sorted(attrs.items()))
            kept.append(f"    <{el.tag}{body}/>")
        refs[str(idx)] = "<level>\n  <objects>\n" + "\n".join(kept) + "\n  </objects>\n</level>\n"

    level_set = {
        "schema_version": 1,
        "set_id": "seedling-vanilla",
        "name": "Seedling (vanilla)",
        "description": (
            "The original 116 rooms as a level set. Plan §4.3: there is no privileged "
            "built-in path — mounting vanilla through the level-set loader is what makes "
            "every boot of the ordinary game a test of it."
        ),
        "provenance": {"generator": "scripts/procgen/extract-seedling-vanilla-set.py"},
        "rooms": rooms,
        "start": {"level": 0},          # Game.as:796 `level = 0`; x/y are the ctor defaults
        "menu_rooms": menu,             # Game.as:449
        "named_rooms": NAMED_ROOMS,
    }

    # ⚠ The REAL per-room byte sizes, recorded because the reduced OEL above
    # cannot carry them and a chunk-size claim measured against the reduced form
    # would be measuring the fixture rather than the game. These are raw OEL
    # bytes; as JSON they inflate ~1.21x (1,385,826 raw -> 1,676,662 escaped).
    room_bytes = [
        os.path.getsize(os.path.normpath(os.path.join(src, embeds[n]))) for n in names
    ]
    measured = {
        "level_count": len(names),
        "totals": counts,
        "raw_oel_bytes": sum(room_bytes),
        "room_bytes": room_bytes,
    }

    if args.stdout:
        json.dump({"set": level_set, "measured": measured}, sys.stdout, indent=1)
        return

    os.makedirs(FIXTURES, exist_ok=True)
    with open(os.path.join(FIXTURES, "seedling-vanilla-set.json"), "w") as f:
        json.dump(level_set, f, indent=1)
        f.write("\n")
    with open(os.path.join(FIXTURES, "seedling-vanilla-room-refs.json"), "w") as f:
        json.dump({"measured": measured, "rooms": refs}, f, indent=1)
        f.write("\n")
    print(f"wrote {len(rooms)} rooms to {FIXTURES}")
    print(f"measured: {json.dumps(measured)}")


if __name__ == "__main__":
    main()
