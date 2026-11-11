"""DepGraph generates when it is loaded from a packed .apworld (a zip).

Installed as ``custom_worlds/depgraph.apworld``, the world is imported by
zipimport. ``Rules.parse_depgraph`` used to open
``os.path.join(dirname(__file__), 'data', <file>)``, a path INSIDE the zip,
so ``generate_early`` raised FileNotFoundError for every bundled graph; the
unpacked ``worlds/depgraph/`` directory worked, which is why nothing caught
it. The bundled graphs are now read through ``pkgutil.get_data``.

This test packs the world with the same script that builds
``apworlds/depgraph.apworld``, imports the zip through zipimport under an
alias package name (so it cannot collide with the already-imported
``worlds.depgraph``), and generates and fills a game for every bundled graph.
The game name is borrowed for the duration: the unpacked class is taken out
of ``AutoWorldRegister.world_types`` and put back afterwards.
"""

import importlib
import importlib.util
import sys
import unittest
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
ALIAS = "zz_packed_depgraph"


def _pack(dest_dir: Path) -> Path:
    """Pack worlds/depgraph with scripts/build/pack_apworld.py, then re-root its
    entries under ALIAS/ (byte-identical contents, different package name)."""
    spec = importlib.util.spec_from_file_location(
        "pack_apworld", REPO_ROOT / "scripts" / "build" / "pack_apworld.py")
    packer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(packer)
    packed = dest_dir / "depgraph.apworld"
    assert packer.pack_apworld("depgraph", output_path=packed), "pack script failed"
    aliased = dest_dir / f"{ALIAS}.apworld"
    with zipfile.ZipFile(packed) as src, zipfile.ZipFile(aliased, "w") as dst:
        names = src.namelist()
        assert any(n.startswith("depgraph/data/") for n in names), "the pack carries no data/ files"
        for name in names:
            assert name.startswith("depgraph/"), name
            dst.writestr(ALIAS + name[len("depgraph"):], src.read(name))
    return aliased


class TestPackedApworldGenerates(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        import tempfile
        from worlds.AutoWorld import AutoWorldRegister
        from worlds.depgraph import DepGraphWorld

        cls._tmp = tempfile.TemporaryDirectory()
        cls._zip = _pack(Path(cls._tmp.name))
        cls._game = DepGraphWorld.game
        cls._unpacked = AutoWorldRegister.world_types.pop(cls._game)
        sys.path.insert(0, str(cls._zip))
        try:
            cls.module = importlib.import_module(ALIAS)
        except BaseException:
            cls._restore()
            raise

    @classmethod
    def _restore(cls):
        from worlds.AutoWorld import AutoWorldRegister
        AutoWorldRegister.world_types[cls._game] = cls._unpacked
        if str(cls._zip) in sys.path:
            sys.path.remove(str(cls._zip))
        for name in [m for m in sys.modules if m == ALIAS or m.startswith(ALIAS + ".")]:
            del sys.modules[name]
        importlib.invalidate_caches()

    @classmethod
    def tearDownClass(cls):
        cls._restore()
        cls._tmp.cleanup()

    def test_the_world_was_imported_from_the_zip(self):
        self.assertEqual(type(self.module.__spec__.loader).__name__, "zipimporter")
        self.assertIn(".apworld", self.module.DepGraphWorld.__file__)
        # The very path the old code opened does not exist on disk.
        self.assertFalse(Path(self.module.Rules.__file__).parent.joinpath("data", "tech_tree.json").exists())

    def test_every_bundled_graph_generates_from_the_zip(self):
        from Fill import distribute_items_restrictive
        from test.general import gen_steps, setup_multiworld

        world_cls = self.module.DepGraphWorld
        keys = sorted(world_cls.options_dataclass.type_hints["graph_file"].name_lookup.values())
        self.assertGreaterEqual(len(keys), 7, keys)
        for key in keys:
            with self.subTest(graph_file=key):
                multiworld = setup_multiworld(world_cls, gen_steps, seed=1, options={"graph_file": key})
                world = multiworld.worlds[1]
                self.assertIs(type(world), world_cls)
                self.assertGreater(world.num_nodes, 0)
                distribute_items_restrictive(multiworld)
                self.assertTrue(multiworld.can_beat_game(multiworld.state), key)

    def test_the_zip_parses_each_graph_as_the_directory_does(self):
        from worlds.depgraph.Rules import parse_depgraph as parse_unpacked
        world_cls = self.module.DepGraphWorld
        keys = sorted(world_cls.options_dataclass.type_hints["graph_file"].name_lookup.values())
        for key in keys:
            with self.subTest(graph_file=key):
                packed, unpacked = self.module.Rules.parse_depgraph(key), parse_unpacked(key)
                self.assertEqual(packed.title, unpacked.title)
                self.assertEqual(
                    {i: (n.node_id, n.expression, n.dependencies, n.full_text) for i, n in packed.nodes.items()},
                    {i: (n.node_id, n.expression, n.dependencies, n.full_text) for i, n in unpacked.nodes.items()})


if __name__ == "__main__":
    unittest.main()
