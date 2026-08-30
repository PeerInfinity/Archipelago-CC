#!/usr/bin/env python3
"""Build the level-set DELIVERY conformance fixture.

One file, two consumers: the sender's assembler (JS, in vitest) and the
receiver's (AS3, driven in the built artifact by
scripts/procgen/probe-seedling-level-set-transport.mjs). Both must agree on the
one verdict that matters — DOES A SET GET MOUNTED — for every case here.
"""
import json
import os

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(REPO, "frontend", "modules", "seedlingDemo", "fixtures",
                   "seedling-level-set-delivery-conformance.json")

XML = '<level width="160" height="160"><Ground/></level>'


def room(i, name=None, source=None):
    return {
        "id": i,
        "name": name or f"R{i}",
        "source": source if source is not None else {"xml": XML},
        "music": 0,
    }


META = {
    "schema_version": 1,
    "set_id": "conformance-aaaaaaaa",
    "name": "delivery conformance",
    "start": {"level": 0},
    "menu_rooms": [0],
    "named_rooms": {
        "moonrock_target": {"level": 0},
        "watcher_text": {"level": 0},
        "dark_shrum_death": {"level": 0, "x": 80, "y": 128},
        "bloody_seed_ending": {"level": 0, "x": 80, "y": 128},
        "light_boss_exit": {"level": 0, "x": 80, "y": 128},
        "tentacle_beast_mouth": {"level": 0, "x": 80, "y": 128},
    },
}


def chunk(index, count, rooms, set_id="conformance-aaaaaaaa", meta=True,
          schema_version=1):
    c = {
        "schema_version": schema_version,
        "set_id": set_id,
        "chunk_index": index,
        "chunk_count": count,
        "rooms": rooms,
    }
    if index == 0 and meta:
        c["set"] = dict(META)
    return c


def case(name, mounts, why, chunks, receiver_only=False, note=None,
         reason_must_contain=None):
    c = {
        "name": name,
        "mounts": mounts,
        "would_mount_without_the_rule": why,
        "chunks": chunks,
    }
    if reason_must_contain:
        # ⛓ Reasons are NOT compared between the two sides — each words its own.
        # This is a different demand: whatever the RECEIVER says must name the
        # values that actually conflicted. It exists because the first build
        # reported `disagrees with "null"`, having reset its staging before
        # composing the message: the right verdict with a useless reason.
        c["receiver_reason_must_contain"] = reason_must_contain
    if receiver_only:
        c["receiver_only"] = True
    if note:
        c["note"] = note
    return c


A = [room(0), room(1), room(2)]
B = [room(3), room(4)]

cases = [
    case("in-order delivery of a 5-room set", True,
         "nothing — this is the positive control, and every negative case below "
         "is this delivery with one thing wrong",
         [chunk(0, 2, A), chunk(1, 2, B)]),

    case("out-of-order delivery: chunk 1 arrives first", True,
         "nothing — but a receiver that demanded chunk 0 first would refuse a "
         "delivery the sender calls valid, which is a verdict disagreement",
         [chunk(1, 2, B), chunk(0, 2, A)]),

    case("one chunk carrying the whole set", True,
         "nothing — the degenerate delivery must still work",
         [chunk(0, 1, A)]),

    case("room ids shifted to 1..5", False,
         "a POSITIONAL reassembly: it would mount a set shifted by one, and "
         "every @to/@room/@fallthrough would point one room off with nothing "
         "erroring (plan §9.1)",
         [chunk(0, 2, [room(1), room(2), room(3)]),
          chunk(1, 2, [room(4), room(5)])]),

    case("duplicate chunk_index", False,
         "a receiver counting arrivals instead of tracking WHICH arrived: it "
         "would mount a short table on the right number of calls",
         [chunk(0, 2, A), chunk(0, 2, B)]),

    case("a missing chunk", False,
         "a receiver that mounts on any chunk rather than on completion — the "
         "partial-mount case §8.3 makes silent",
         [chunk(0, 2, A)]),

    case("two set_ids in one delivery", False,
         "a receiver that ignores set_id: it would splice two sets into one "
         "table",
         [chunk(0, 2, A), chunk(1, 2, B, set_id="other-bbbbbbbb")],
         reason_must_contain=["other-bbbbbbbb", "conformance-aaaaaaaa"]),

    case("chunk_count disagreement", False,
         "a receiver taking the last chunk_count it saw: completion would be "
         "decided by whichever envelope arrived last",
         [chunk(0, 2, A), {**chunk(1, 2, B), "chunk_count": 3}],
         reason_must_contain=["3", "2"]),

    case("schema_version 2", False,
         "a receiver that does not check the version would parse a future "
         "format as if it were this one",
         [chunk(0, 1, A, schema_version=2)]),

    case("no metadata on chunk 0", False,
         "a receiver that treats metadata as optional would mount a set with "
         "no identity and no named_rooms",
         [chunk(0, 1, A, meta=False)]),

    case("metadata on a later chunk", False,
         "a delivery with two manifests has no defined identity",
         [chunk(0, 2, A), {**chunk(1, 2, B), "set": dict(META)}]),

    case("an empty rooms array", False,
         "a receiver that accepts an empty chunk would count it toward "
         "completion and mount a short table",
         [chunk(0, 1, [])]),

    case("a room with no id", False,
         "a receiver falling back to chunk position when id is missing — the "
         "same absorbed-ordering-bug family as the shifted case",
         [chunk(0, 1, [room(0), {"name": "R1", "source": {"xml": XML},
                                 "music": 0}])]),

    case("a duplicate room id", False,
         "a receiver writing by id without checking would silently keep the "
         "last writer and mount a table one room short",
         [chunk(0, 1, [room(0), room(1), room(1)])]),

    case("17 rooms in one chunk", False,
         "MAX_ROOMS_PER_CHUNK. ⚠ This rule cannot protect the receiver — an "
         "oversized chunk dies inside JSON.parse before any AS3 runs (§8.1). "
         "It is here so the two sides never disagree about a verdict",
         [chunk(0, 1, [room(i) for i in range(17)])]),

    case("a room sourced from an [Embed] reference", False,
         "SERVABILITY, not validity: the sender's validator calls an embed "
         "room valid and merely unchecked, and this build has no "
         "embedded-asset resolver (plan §4.3 shape (c), phase 3b). The "
         "divergence is declared here rather than discovered when a player "
         "walks into the room",
         [chunk(0, 1, [room(0), room(1, source={"embed": "levels/OverWorld.oel"})])],
         receiver_only=True,
         note="assembleLevelSetChunks() SUCCEEDS on this case; the AS3 refuses "
              "it at mount. Expected, and the only such case in this file."),
]

doc = {
    "schema_version": 1,
    "description": (
        "Delivery conformance for external Seedling level sets — the shared "
        "fixture that keeps the two chunk assemblers from disagreeing. The "
        "sender assembles a batch it already holds "
        "(assembleLevelSetChunks in levelSetValidator.js); the receiver must "
        "assemble a STREAM, one ExternalInterface call at a time "
        "(LevelSet.acceptChunk in ~/CC/seedling/src/LevelSet.as), so there is "
        "no way to have only one implementation. This file is what they are "
        "both tested against.\n\n"
        "THE VERDICT COMPARED IS `mounts`: does a set end up mounted? Reasons "
        "are NOT compared — each side words its own, and a wording difference "
        "is harmless where a verdict difference is the failure this arc keeps "
        "finding. `receiver_only` marks a case where the sender succeeds and "
        "the receiver refuses for a reason the sender cannot know; each one "
        "must say why in `would_mount_without_the_rule`.\n\n"
        "⚠ WHAT THIS BOUNDS: envelopes and arrival only. Room XML here is a "
        "one-element stub — it is never parsed by either assembler. Whether a "
        "SET is valid (level-index ranges, the 30-tag ceiling, the closed sign "
        "table, named_rooms) is validateLevelSet's question and is tested "
        "against the real vanilla 116 elsewhere."),
    "cases": cases,
}

with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(doc, fh, indent=2)
    fh.write("\n")
print(f"wrote {OUT}: {len(cases)} cases, "
      f"{sum(1 for c in cases if c['mounts'])} positive")
