#!/usr/bin/env python3
"""check-handwritten-embedded-rules — IS EVERY HAND-WRITTEN WORLD'S EMBEDDED RULES DOCUMENT STILL WHAT
ITS PYTHON EXPORTS?

A hand-written world (Baking Adventure, Coding Adventure) can carry its own rules document and send it
in slot_data as ``worldgen_rules`` (the channel world_generator packages use; the client lays the room's
placements over it, frontend/modules/client/core/localRulesOverlay.js). A room of that world then plays
with no preset file, on plain upstream Archipelago too (slice sdc-embed-handwritten-rules, ⚖ Robert
2026-11-15: "Embed their rules").

The document is generator output, so it can go stale: change the world's Python and the shipped document
no longer describes it. This script is the recipe AND its freshness check:

- the recipe: the world at seed 1 with default options (a one-player multiworld, filled), exported by the
  exporter exactly as a minimal-spoilers ``Generate.py`` run exports the seed-1 preset, then stripped of
  every placement and seed/export key by ``world_generator._embedded_rules.strip_placements`` (no
  location's item, no ``canonical_placements``, no ``world[p].slot_data`` copy), wrapped in the envelope
  ``{"format", "player", "doc"}`` and written compact as ``worlds/<w>/_embedded_rules.json``;
- the check (default): rebuild that file in a temp dir and fail on any byte that differs.

Each build runs in its own interpreter (``--emit``), so the exporter's module caches and the world
registry of one build never reach the next.

Enrolment is by presence: a hand-written world directory (not a world_generator package) that holds
``_embedded_rules.json`` is checked. A new world enrols by committing the file (``--write <dir>``).

Why seed 1 covers every room: the stripped document is the same at every seed and option set except for
option values and placement facets (measured for seeds 1-3, ``vanilla_placement``, ``accessibility`` and
``progression_balancing``: only ``world[p].options``, the per-player ``is_vanilla`` flag and the
``locked`` flags move). The room's options that the client needs come from the server's own slot_data.

Run:
  python scripts/test/check-handwritten-embedded-rules.py              # check every enrolled world
  python scripts/test/check-handwritten-embedded-rules.py --write [<w> ...]  # rewrite the file(s)
On push it runs as test/test_handwritten_embedded_rules.py (unittests).
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EMBEDDED_FILE = '_embedded_rules.json'
PLAYER = '1'
SEED = 1


def enrolled_worlds(root: Path = PROJECT_ROOT):
    """World directories (names) under worlds/ that ship an embedded rules document."""
    out = []
    for path in sorted((root / 'worlds').glob(f'*/{EMBEDDED_FILE}')):
        directory = path.parent.name
        if (path.parent / '_worldgen_settings.json').exists():
            continue  # a world_generator package sends _worldgen_rules.json, built by its own recipe
        out.append(directory)
    return out


def _emit(directory: str, out_path: str) -> None:
    """Build the envelope for worlds/<directory> and write it to out_path (runs in a fresh interpreter)."""
    os.chdir(PROJECT_ROOT)
    sys.path.insert(0, str(PROJECT_ROOT))
    # The minimal-spoilers export, whatever this box's host.yaml says (it may be a CI default).
    import worlds.json_tools_installer.json_tools_settings as jts
    real = jts.get_json_tools_settings

    class _Settings:
        save_rules_json = True
        use_tracking_mode_config = False

        def __getattr__(self, name):
            return getattr(real(), name)
    jts.get_json_tools_settings = lambda: _Settings()

    from worlds import AutoWorldRegister
    from worlds.AutoWorld import call_all
    from test.general import setup_multiworld
    from Fill import distribute_items_restrictive
    from world_generator._embedded_rules import WORLDGEN_RULES_FORMAT, strip_placements

    world_types = [cls for cls in AutoWorldRegister.world_types.values()
                   if cls.__module__.split('.')[:2] == ['worlds', directory]]
    if len(world_types) != 1:
        raise SystemExit(f'worlds/{directory}: expected one registered world, found {len(world_types)}')
    multiworld = setup_multiworld(world_types[0], (), SEED)
    for step in ('generate_early', 'create_regions', 'create_items', 'set_rules', 'connect_entrances',
                 'generate_basic', 'pre_fill'):
        call_all(multiworld, step)
    distribute_items_restrictive(multiworld)

    import exporter.exporter as ex
    with tempfile.TemporaryDirectory(prefix='embedded-rules-') as scratch:
        ex.export_game_rules(multiworld, scratch, 'embedded', save_presets=False)
        rules = sorted(Path(scratch).glob('*_rules.json'))
        if len(rules) != 1:
            raise SystemExit(f'worlds/{directory}: the export wrote {len(rules)} rules files')
        doc = json.loads(rules[0].read_text(encoding='utf-8'))
    strip_placements(doc)
    envelope = {'format': WORLDGEN_RULES_FORMAT, 'player': PLAYER, 'doc': doc}
    Path(out_path).write_bytes(
        json.dumps(envelope, separators=(',', ':'), ensure_ascii=False, sort_keys=True).encode('utf-8'))


def build(directory: str, out_path: str) -> None:
    """The recipe for worlds/<directory>, written to out_path."""
    result = subprocess.run([sys.executable, '-I', __file__, '--emit', directory, out_path],
                            cwd=PROJECT_ROOT, capture_output=True, text=True)
    if result.returncode != 0 or not Path(out_path).exists():
        raise RuntimeError(f'building worlds/{directory}/{EMBEDDED_FILE} failed '
                           f'(exit {result.returncode}):\n{result.stderr[-3000:]}')


def check(directory: str, scratch: str, root: Path = PROJECT_ROOT):
    """None when worlds/<directory>/_embedded_rules.json is what the recipe builds; else why not."""
    committed = root / 'worlds' / directory / EMBEDDED_FILE
    fresh = Path(scratch) / f'{directory}{EMBEDDED_FILE}'
    build(directory, str(fresh))
    if not committed.exists():
        return f'worlds/{directory}/{EMBEDDED_FILE} is missing'
    if committed.read_bytes() != fresh.read_bytes():
        return (f'worlds/{directory}/{EMBEDDED_FILE} is stale: it differs from what the world\'s Python exports '
                f'({committed.stat().st_size} B committed, {fresh.stat().st_size} B rebuilt)')
    return None


def main(argv):
    if argv[:1] == ['--emit']:
        _emit(argv[1], argv[2])
        return 0
    write = argv[:1] == ['--write']
    names = argv[1:] if write else argv
    directories = names or enrolled_worlds()
    if not directories:
        print('FAIL: no hand-written world ships an embedded rules document')
        return 1
    failures = 0
    with tempfile.TemporaryDirectory(prefix='embedded-rules-check-') as scratch:
        for directory in directories:
            if write:
                target = PROJECT_ROOT / 'worlds' / directory / EMBEDDED_FILE
                build(directory, str(target))
                print(f'WROTE: {target.relative_to(PROJECT_ROOT)} ({target.stat().st_size} B)')
                continue
            try:
                problem = check(directory, scratch)
            except RuntimeError as exc:
                problem = str(exc)
            if problem:
                failures += 1
                print(f'FAIL: {problem}')
            else:
                print(f'PASS: worlds/{directory}/{EMBEDDED_FILE} is what its Python exports')
    if write:
        return 0
    print('ALL CHECKS PASSED' if not failures else f'{failures} CHECK(S) FAILED')
    if failures:
        print('Rebuild it with `python scripts/test/check-handwritten-embedded-rules.py --write <world>`, '
              'repack its apworld, and regenerate its presets.')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
