"""Pytest configuration for the Archipelago-CC fork.

This fork carries every upstream Archipelago world plus a large set of
fork-specific worlds (typically *_worldgen variants, plus a handful of
custom worlds like apcalc, seedling, metamath, etc.). Failures in upstream
worlds are not the maintainer's responsibility to fix, and they cause CI
to report misleading red checks on every push.

To keep CI signal focused on this fork's own code, this conftest:

1. Skips collection of ``worlds/<upstream>/test`` directories so per-world
   test suites for upstream worlds do not run.
2. Removes upstream worlds from ``AutoWorldRegister.world_types`` at the
   start of the pytest session so the iteration-over-all-worlds tests in
   ``test/general/`` (e.g. ``test_create_duplicate_locations``,
   ``test_locations_in_datapackage``) do not try to instantiate them.
3. Drops the same worlds from ``worlds.failed_world_loads``, so an excluded
   world whose import failed for an environmental reason (e.g. zillion's
   ``git+`` requirement when pip's clone of GitHub times out on a runner)
   does not red ``test_no_failed_world_loads``. A fork world that fails to
   load still reds it.

To re-include an upstream world (e.g. while investigating a real
regression), remove it from ``UPSTREAM_WORLDS`` below.

The list was generated from ``git ls-tree -d --name-only upstream/main worlds/``
(remote: https://github.com/ArchipelagoMW/Archipelago.git). Refresh it when
syncing with upstream if new worlds are added there.

The same exclusion is applied to ``WIP_WORLDS`` — fork worlds that ARE ours
but are still under active development and not yet stable enough for the
iterate-over-all-worlds tests. Remove a name from that set once its world is
stable.

``KNOWN_FLAKY_WORLDS`` holds fork worlds that are deliberately parked with
known seed-dependent generation flakiness (e.g. roving FillError /
"Failed to generate chain for sphere N" RuntimeErrors in test_implemented,
test_multiworlds and test_item_links). Unlike WIP_WORLDS these are NOT
expected to stabilize under their own development: either they are prototypes
nobody is developing further (user ruling 2026-07-17), or the flake is in
core fill rather than in the world. Re-include one only if the cause is fixed.

⚠ This set is what the pytest session honours, and it is the ONLY list that
affects CI. ``scripts/data/template-exclude-list.json`` decides which games
``scripts/test/test-world-generator.py`` regenerates a ``_worldgen`` world
FOR; it does not stop pytest collecting a ``_worldgen`` directory that is
already committed. Excluding a game from CI means adding it HERE.
"""

from __future__ import annotations

# Suppress Settings.autosave during pytest. settings.py registers an atexit
# hook that would write host.yaml back to disk on process exit; under pytest
# that fires an assertion ("Auto-saving ... during unittests") that surfaces
# as noisy "Exception ignored in atexit callback" output, and without -O
# could actually clobber host.yaml with in-memory test state. Setting this
# flag before any Settings instance is constructed both skips the atexit
# registration and turns autosave() into a no-op.
import settings as _settings  # noqa: E402 — imported for side-effect-free flag set
_settings.skip_autosave = True
del _settings

# NOTE: 'generic' and 'apquest' are upstream worlds, but core tests in
# test/general/ look them up by game name as required fixtures
# (world_types["Archipelago"] in test_items.py::test_items_in_datapackage,
# world_types["APQuest"] in test_options.py::test_item_links_name_groups).
# Keep them registered so those tests can find them.
UPSTREAM_WORLDS: frozenset[str] = frozenset({
    "adventure", "ahit", "alttp", "aquaria", "blasphemous",
    "bomb_rush_cyberfunk", "bumpstik", "cccharles", "celeste64",
    "celeste_open_world", "checksfinder", "civ_6", "cv64", "cvcotm",
    "dark_souls_3", "dlcquest", "doom_1993", "doom_ii", "earthbound",
    "factorio", "faxanadu", "ff1", "ffmq", "heretic", "hk",
    "hylics2", "inscryption", "jakanddaxter", "kdl3", "kh1", "kh2", "ladx",
    "landstalker", "lingo", "lufia2ac", "marioland2", "meritous", "messenger",
    "mlss", "mm2", "mm3", "mmbn3", "musedash", "noita", "oot", "osrs",
    "overcooked2", "paint", "pokemon_emerald", "pokemon_rb", "raft", "ror2",
    "sa2b", "satisfactory", "saving_princess", "sc2", "shapez", "shivers",
    "shorthike", "sm", "sm64ex", "smw", "smz3", "soe", "stardew_valley",
    "subnautica", "terraria", "timespinner", "tloz", "tunic", "tww",
    "undertale", "v6", "wargroove", "witness", "yachtdice", "yoshisisland",
    "yugioh06", "zillion",
})

# Fork worlds that are OURS but still work-in-progress: excluded from the
# iterate-over-all-worlds tests until they stabilize.
#
# - runner_worldgen: the Runner substrate's generated world is still being
#   built out. Its item/location balance isn't settled, so on many random
#   seeds fill cannot place its progression items and
#   test/general/test_implemented.py SUBFAILs nondeterministically with
#   ``Fill.FillError: No more spots to place 5 items``. (Previously masked by
#   the json_tools kivy xdist worker crash aborting the session early.)
WIP_WORLDS: frozenset[str] = frozenset({
    # Runner family — still in active development; seed-flaky generation
    # (e.g. sphere-chain RuntimeErrors) until the generator stabilizes.
    "runner_worldgen",
    "runner_sphere_worldgen",
})

# Known-flaky, deliberately parked (see module docstring) — not WIP, not
# expected to stabilize.
KNOWN_FLAKY_WORLDS: frozenset[str] = frozenset({
    # APCalc prototype ("APCalc" / "APCalc WorldGen") — seed-dependent
    # "Failed to generate chain for sphere N" in generate_early; the user
    # chose not to develop it further (2026-07-17).
    "apcalc",
    "apcalc_worldgen",
})

# Everything dropped from AutoWorldRegister for the pytest session:
# upstream (not our responsibility) + our own not-yet-ready worlds +
# parked known-flaky prototypes.
EXCLUDED_WORLDS: frozenset[str] = UPSTREAM_WORLDS | WIP_WORLDS | KNOWN_FLAKY_WORLDS

collect_ignore_glob = [
    pattern
    for name in EXCLUDED_WORLDS
    # Most upstream worlds put their tests under worlds/<name>/test/; a few
    # (e.g. factorio) keep test_*.py at the world-package root.
    for pattern in (f"worlds/{name}/test", f"worlds/{name}/test_*.py")
]


def _is_excluded_world_module(module: str) -> bool:
    parts = module.split(".", 2)
    return len(parts) >= 2 and parts[0] == "worlds" and parts[1] in EXCLUDED_WORLDS


def pytest_configure(config) -> None:  # noqa: ARG001 — pytest hook signature
    del config

    from worlds import failed_world_loads
    from worlds.AutoWorld import AutoWorldRegister
    from worlds.Files import AutoPatchExtensionRegister, AutoPatchRegister

    # A folder world's failed load is keyed by its directory name, the same
    # names EXCLUDED_WORLDS holds.
    for name in EXCLUDED_WORLDS:
        failed_world_loads.pop(name, None)

    for game, world_type in list(AutoWorldRegister.world_types.items()):
        if _is_excluded_world_module(world_type.__module__):
            AutoWorldRegister.world_types.pop(game, None)

    for game, patch_type in list(AutoPatchRegister.patch_types.items()):
        if _is_excluded_world_module(patch_type.__module__):
            AutoPatchRegister.patch_types.pop(game, None)
            ending = getattr(patch_type, "patch_file_ending", None)
            if ending is not None:
                AutoPatchRegister.file_endings.pop(ending, None)

    for game, ext_type in list(AutoPatchExtensionRegister.extension_types.items()):
        if _is_excluded_world_module(ext_type.__module__):
            AutoPatchExtensionRegister.extension_types.pop(game, None)


def _is_webhost_test(item) -> bool:
    parts = item.path.parts
    return len(parts) >= 2 and parts[-2] == "webhost" and "test" in parts


def _copy_static_docs_once_per_run(real_copy):
    """Run ``copy_tutorials_files_to_static`` once per xdist run, not per worker.

    ``test/webhost/test_docs.py`` and ``test_sitemap.py`` each call it, and it
    ``rmtree()``s and rebuilds ``WebHostLib/static/generated/docs``. On two
    workers one deletes the files the other is reading (measured at ``-n 5``:
    ``test_sitemap_links`` FileNotFoundError on
    ``.../generated/docs/<game>/setup_en.md``, 4 runs in 10). The first worker
    to arrive builds the directory; the others wait for it and reuse it. The
    handshake is two empty files per run in the temp dir, named for xdist's
    run id.

    ⛔ Not ``xdist_group`` + ``--dist loadgroup``: that mode is ``loadscope``
    plus groups, so it moves whole modules between workers, and measured on
    CI it made ``worlds/seedling``'s MultiWorld leak check fail on every
    ubuntu job (never seen in 40 ``load`` runs). The fix stays out of the
    scheduling.
    """
    import os
    import tempfile
    import time

    run_id = os.environ.get("PYTEST_XDIST_TESTRUNUID")
    if run_id is None:  # one process: nothing to race with
        return real_copy
    base = os.path.join(tempfile.gettempdir(), f"archipelago-cc-static-docs-{run_id}")
    done_path = base + ".done"

    def copy_once() -> None:
        try:
            os.close(os.open(base + ".lock", os.O_CREAT | os.O_EXCL | os.O_WRONLY))
        except FileExistsError:
            deadline = time.monotonic() + 600
            while not os.path.exists(done_path):
                if time.monotonic() > deadline:
                    raise TimeoutError(f"another xdist worker never finished {real_copy.__name__} "
                                       f"({done_path} missing after 600 s)")
                time.sleep(0.1)
            return
        real_copy()
        with open(done_path, "w", encoding="utf-8"):
            pass

    return copy_once


def pytest_collection_modifyitems(config, items) -> None:  # noqa: ARG001 — pytest hook signature
    """Keep ``test/webhost`` independent of how xdist splits it across workers.

    Guards the static-docs rebuild (``_copy_static_docs_once_per_run``), and
    makes ``WebHost.get_app()`` idempotent:

    ``test/webhost/__init__.py`` (upstream) calls ``get_app()`` in every test
    class's ``setUpClass``, and each call re-registers the ``api`` blueprint on
    the one global Flask app. It only tolerates the repeat when the app has
    already served a request: Flask then raises an ``AssertionError`` that the
    base class catches. If the first class a process runs makes no request
    (``TestSUUID`` makes none), the next class gets Flask's ``ValueError: The
    name 'api' is already registered for this blueprint`` instead, which is not
    caught, and every test in that class errors in setup.

    Whether that happens depends on which classes share a process, i.e. on
    ``pytest -n auto``'s worker count, i.e. on the CI runner's core count
    (main ``04835362a3``: macOS py3.13, 5 workers, 30 errors; the same SHA
    passed with 3). It reproduces in ONE process:
    ``pytest test/webhost/test_suuid.py test/webhost/test_tracker.py``.
    ``--dist loadfile`` would not fix it — two files on one worker still
    collide. The base class assumes one app with one config, so return the
    first app on every later call.
    """
    del config
    if not any(_is_webhost_test(item) for item in items):
        return

    import WebHost

    if getattr(WebHost.get_app, "_archipelago_cc_patched", False):
        return
    real_get_app = WebHost.get_app
    apps: list = []

    def get_app_once():
        if not apps:
            apps.append(real_get_app())
        return apps[0]

    get_app_once._archipelago_cc_patched = True
    WebHost.get_app = get_app_once
    WebHost.copy_tutorials_files_to_static = _copy_static_docs_once_per_run(
        WebHost.copy_tutorials_files_to_static)
