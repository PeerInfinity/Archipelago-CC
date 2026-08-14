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
      hash is the one the validator itself computes. ⛔ RUN THE STAMPER AFTER
      THIS SCRIPT — `node scripts/procgen/stamp-seedling-vanilla-set.mjs` —
      or the fixture you just regenerated is the unstamped one.
  frontend/modules/seedlingDemo/fixtures/seedling-vanilla-room-refs.json
      per-room REDUCED OEL: every element bearing @to / @fallthrough / @room /
      @tag / @tset / @sign, with the tile grid and untagged decoration dropped,
      each kept element also carrying its @x/@y (geometry never SELECTS an
      element, but one rule — the moonrock/stairs agreement — needs it).
      ⚠ WHAT THIS BOUNDS: it is a faithful projection of exactly the surface the
      validator reads and of nothing else. It proves the real cross-reference
      graph validates; it does not prove a room loads, and it is not a level.

Usage:  python3 scripts/procgen/extract-seedling-vanilla-set.py [--seedling DIR]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIXTURES = os.path.join(REPO, "frontend", "modules", "seedlingDemo", "fixtures")

# ⛔ THE VANILLA CONSTANTS ARE READ AT THE COMMIT BEFORE THIS ARC TOUCHED THEM.
# `7514b96` is the pre-arc base of ~/CC/seedling's `bot` branch: phase 3b then
# DELETED every literal this script parses out of Game.as (the 116-entry
# levelMusics at :199, menuLevels at :449, `level == 45`, `level != 10`, the
# start level) and moved them into src/VanillaSet.as — the AS3 manifest that
# check-seedling-vanilla-manifest.mjs exists to CHECK.
#
# ⇒ pointing this script at the working tree would do two things, one of them
# silent. It fails outright today (there is no levelMusics to find). Repaired the
# obvious way — read VanillaSet.as instead — the fixture would become a
# transcription of the very data the gate compares the running wasm against, and
# the gate would be asserting VanillaSet.as == VanillaSet.as. That gate caught
# `new Array(45)` on its first run (plan §11.3) precisely because its twin came
# from somewhere else. Reading the ORIGINAL source keeps "moved, not retyped"
# (§11.2) an enforced property rather than a claim, permanently: any divergence
# between the original literals and VanillaSet.as reddens the manifest gate.
PRISTINE_REF = "7514b96"

# Attributes that make an element interesting to the level-set validator.
REF_ATTRS = ("to", "fallthrough", "room", "tag", "tset", "sign", "playerx", "playery")

# ⚠ KEPT ON A SELECTED ELEMENT, BUT NEVER A REASON TO SELECT ONE. The validator
# needs GEOMETRY for exactly one rule — Moonrock.as:131 finds the stairs it
# replaces by COLLISION — and the reduced OEL used to drop x/y, so the committed
# fixture could not express the rule it is supposed to prove. Adding x/y to
# REF_ATTRS instead would select every tile in the level and the "reduced" form
# would be the level.
GEOMETRY_ATTRS = ("x", "y")

# Scenery/Moonrock.as:46 setHitbox(48, 48); Teleporter.as:36 setHitbox(16, 16).
MOONROCK_HITBOX = 48
TELEPORTER_HITBOX = 16

# §3.5 / §8.2: the per-set constants that were literals in Game.as.
SNOW_GRADIENT_LEVEL = 45        # Game.as:908  "if (level == 45)"
MUSIC_EXEMPT_LEVEL = 10         # Game.as:1175, :1181  "level != 10"

# §8.2a: the six room references that live in CODE, so no bundle rewrite reaches
# them. Values are vanilla's; each is re-derived below only as a cross-check.
NAMED_ROOMS = {
    # ⛔ x/y ARE RE-DERIVED FROM THE OEL BELOW, not just declared. Moonrock.as:134
    # builds its replacement teleporter from this entry, and the stairs it
    # replaces carry the same three values as @to/@playerx/@playery — so the
    # extractor reproduces the collision and REFUSES to write a fixture whose
    # manifest disagrees with the room data. (Same shape as §9.4: the value is
    # measured by ElementTree here and by a regex in levelSetValidator.js, and
    # the two must agree.)
    "moonrock_target":      {"level": 2,   "x": 48,  "y": 32},
    "watcher_text":         {"level": 114},
    "dark_shrum_death":     {"level": 114, "x": 72,  "y": 128},
    "bloody_seed_ending":   {"level": 1,   "x": 64,  "y": 96},
    "light_boss_exit":      {"level": 36,  "x": 112, "y": 96},
    "tentacle_beast_mouth": {"level": 58,  "x": 56,  "y": 96},
}


def stairs_under_moonrocks(root, idx):
    """Every (room, stairs) pair Moonrock.as:131's collide() could return.

    The moonrock falls to its own OEL y (`fallTo`, Moonrock.as:41), so the
    authored geometry IS the resting geometry. FlashPunk hitboxes have a zero
    origin here, so the test is [x, x+w) x [y, y+h) on both sides.
    """
    objs = root.find("objects")
    if objs is None:
        return []
    def box(el):
        return int(el.get("x", "0")), int(el.get("y", "0"))
    rocks = [box(e) for e in objs if e.tag == "moonrock"]
    stairs = [e for e in objs if e.tag in ("stairsup", "stairsdown")]
    pairs = []
    for rx, ry in rocks:
        for s in stairs:
            sx, sy = box(s)
            if (rx < sx + TELEPORTER_HITBOX and sx < rx + MOONROCK_HITBOX
                    and ry < sy + TELEPORTER_HITBOX and sy < ry + MOONROCK_HITBOX):
                pairs.append((idx, (rx, ry), dict(s.attrib)))
    return pairs


def need(pattern, text, what):
    m = re.search(pattern, text, re.S)
    if m is None:
        sys.exit("EXTRACTION FAILED: could not find " + what)
    return m


def git_show(repo, ref, path):
    """One file as of one commit. Raises the reason, never returns a guess."""
    r = subprocess.run(["git", "-C", repo, "show", f"{ref}:{path}"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"EXTRACTION FAILED: git show {ref}:{path} in {repo} — "
                 f"{r.stderr.strip()}")
    return r.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seedling", default=os.path.expanduser("~/CC/seedling"),
                    help="the AS3 fork (branch 'bot')")
    ap.add_argument("--pristine", default=PRISTINE_REF,
                    help="commit to read the vanilla constants from (see the module docstring)")
    ap.add_argument("--stdout", action="store_true", help="print instead of writing")
    args = ap.parse_args()

    src = os.path.join(args.seedling, "src")
    assets = os.path.join(args.seedling, "assets")
    game_as = os.path.join(src, "Game.as")
    if not os.path.exists(game_as):
        sys.exit(f"EXTRACTION FAILED: no Game.as at {game_as} — pass --seedling")

    # ⛔ READ AT THE PRISTINE COMMIT, NOT FROM THE WORKING TREE — see the module
    # docstring. Every constant this script parses out of Game.as was DELETED
    # from it by phase 3b.
    game = git_show(args.seedling, args.pristine, "src/Game.as")

    # …and the rooms themselves are read from the working tree, so this must
    # hold or the manifest would describe rooms the pristine source never saw.
    drift = subprocess.run(
        ["git", "-C", args.seedling, "diff", "--name-only", args.pristine, "HEAD", "--", "assets/"],
        capture_output=True, text=True)
    if drift.returncode != 0:
        sys.exit(f"EXTRACTION FAILED: git diff against {args.pristine} — {drift.stderr.strip()}")
    if drift.stdout.strip():
        sys.exit(f"EXTRACTION FAILED: assets/ has changed since {args.pristine}:\n"
                 + drift.stdout
                 + "The constants are read at that commit and the rooms from the "
                   "working tree; if the rooms have moved on, the two halves of "
                   "this fixture describe different games.")

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

    # ⛓ RE-DERIVED FROM THE PRISTINE SOURCE, not just declared above. These three
    # were one-line literals phase 3b deleted; parsing them back out is what
    # makes the constants at the top of this file checkable instead of folklore.
    derived = {
        "snow": int(need(r"if \(level == (\d+)[^)]*\)\s*snowAlpha", game,
                         "the snow-gradient level (Game.as:908)").group(1)),
        "exempt": sorted({int(v) for v in re.findall(r"level != (\d+)", game)}),
        "start": int(need(r"level = (\d+);\s*\}\s*loadlevel\(levels\[level\]\);", game,
                          "the start level (Game.as:796)").group(1)),
    }
    if derived["snow"] != SNOW_GRADIENT_LEVEL:
        sys.exit(f"EXTRACTION FAILED: the snow-gradient level reads {derived['snow']}, "
                 f"declared {SNOW_GRADIENT_LEVEL}")
    if derived["exempt"] != [MUSIC_EXEMPT_LEVEL]:
        sys.exit(f"EXTRACTION FAILED: the music-exempt levels read {derived['exempt']}, "
                 f"declared [{MUSIC_EXEMPT_LEVEL}] — a SECOND exempt room would need "
                 f"its own manifest flag, not a wider literal")
    if derived["start"] != 0:
        sys.exit(f"EXTRACTION FAILED: the start level reads {derived['start']}, declared 0")

    if len(musics) != len(names):
        sys.exit(f"EXTRACTION FAILED: levelMusics has {len(musics)} entries for "
                 f"{len(names)} levels — the arrays are parallel and must match")

    rooms, refs = [], {}
    counts = {"teleporter_to": 0, "stairs_to": 0, "fallthrough": 0, "buttonroom_room": 0}
    moonrock_pairs = []

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

        root = ET.parse(path).getroot()
        moonrock_pairs += stairs_under_moonrocks(root, idx)

        kept = []
        for el in root.iter():
            attrs = {k: v for k, v in el.attrib.items() if k in REF_ATTRS and v != ""}
            if not attrs:
                continue
            attrs.update({k: v for k, v in el.attrib.items()
                          if k in GEOMETRY_ATTRS and v != ""})
            if el.tag in ("teleporter", "stairsup", "stairsdown") and "to" in attrs:
                counts["teleporter_to" if el.tag == "teleporter" else "stairs_to"] += 1
            if "fallthrough" in attrs:
                counts["fallthrough"] += 1
            if el.tag == "buttonroom" and "room" in attrs:
                counts["buttonroom_room"] += 1
            body = "".join(f' {k}="{v}"' for k, v in sorted(attrs.items()))
            kept.append(f"    <{el.tag}{body}/>")
        refs[str(idx)] = "<level>\n  <objects>\n" + "\n".join(kept) + "\n  </objects>\n</level>\n"

    # ⛔ THE CROSS-CHECK, RE-DERIVED RATHER THAN TRUSTED. Moonrock.as:134 replaces
    # the stairs a landed moonrock touches with a teleporter built from
    # `named_rooms.moonrock_target`, so the manifest entry and the stairs' own
    # @to/@playerx/@playery are two statements of one fact. If they can differ,
    # the puzzle sends the player somewhere the stairs did not — silently. The
    # measured corpus is ONE pair (room 0's rock at (240, 256) over the
    # <stairsdown> at (256, 272)); a second one appearing is itself news.
    mt = NAMED_ROOMS["moonrock_target"]
    if not moonrock_pairs:
        sys.exit("EXTRACTION FAILED: no moonrock lands on any stairs — either the "
                 "corpus changed or the collision test is wrong; moonrock_target's "
                 "arrival can no longer be re-derived")
    for idx, rock, attrs in moonrock_pairs:
        got = (int(attrs.get("to", -1)), int(attrs.get("playerx", -1)), int(attrs.get("playery", -1)))
        want = (mt["level"], mt["x"], mt["y"])
        if got != want:
            sys.exit(f"EXTRACTION FAILED: level {idx}'s stairs under the moonrock at "
                     f"{rock} says (to, playerx, playery) = {got} but named_rooms."
                     f"moonrock_target says {want} — Moonrock.as:134 builds the "
                     f"replacement teleporter from the SECOND, so these must agree")
    print(f"moonrock/stairs pairs re-derived: {len(moonrock_pairs)} — "
          f"{[(i, r) for i, r, _ in moonrock_pairs]}, all agreeing with named_rooms")

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
