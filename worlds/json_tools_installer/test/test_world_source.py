"""world_source installer (version-dir naming, tree filtering, traversal
guard, manifest) and the exporter's world-source/apworld read fallbacks.

The exporter side deliberately builds its fixture directories from the
installer's WORLD_SOURCE_DIR constant — a behavioral consistency check
between the two modules (the exporter cannot import the installer)."""
import json
import zipfile
from pathlib import Path

import pytest

import Utils
from worlds.json_tools_installer.installer import world_source
from worlds.json_tools_installer.installer.world_source import (
    EXCLUDED_TREES,
    WORLD_SOURCE_DIR,
)
from exporter.analyzer.source_extraction import (
    _read_source_from_path,
    _world_source_fallback_path,
)

FAKE_VERSION = "9.8.7"


@pytest.fixture
def ws_sandbox(tmp_path, monkeypatch):
    """Sandbox the module: fake AP version, local_path into tmp."""
    monkeypatch.setattr(Utils, "__version__", f"{FAKE_VERSION}-zz_test")
    monkeypatch.setattr(
        world_source, "local_path",
        lambda *parts: str(tmp_path.joinpath(*parts)))
    return tmp_path


class FakeDownloadResult:
    def __init__(self, success=True, error=None):
        self.success = success
        self.error = error


def fake_upstream_download(entries):
    """A _download_once stand-in writing a synthetic upstream source zip."""
    def _download(url, dest_path, progress_callback=None):
        with zipfile.ZipFile(dest_path, "w") as zf:
            for rel, data in entries.items():
                zf.writestr(f"Archipelago-{FAKE_VERSION}/{rel}", data)
        return FakeDownloadResult()
    return _download


def test_version_dir_naming(ws_sandbox):
    assert world_source.ap_base_version() == FAKE_VERSION
    root = world_source.get_world_source_root()
    assert root == ws_sandbox / WORLD_SOURCE_DIR / FAKE_VERSION
    assert world_source.get_world_source_root("1.2.3") == \
        ws_sandbox / WORLD_SOURCE_DIR / "1.2.3"


def test_skipped_on_source_install(ws_sandbox, monkeypatch):
    monkeypatch.setattr(world_source, "is_frozen", lambda: False)
    monkeypatch.setattr(
        world_source, "_download_once",
        lambda *a, **k: pytest.fail("source installs must not download"))
    ok, msg = world_source.install_world_source()
    assert ok
    assert "source install" in msg
    assert not world_source.is_world_source_installed()


def test_frozen_install_filters_and_writes_manifest(ws_sandbox, monkeypatch):
    monkeypatch.setattr(world_source, "is_frozen", lambda: True)
    excluded_entries = {
        f"{tree}some_module.py": b"# excluded" for tree in EXCLUDED_TREES}
    entries = {
        "worlds/foo/Rules.py": b"# rules source",
        "BaseClasses.py": b"# core source",
        "worlds/foo/data.json": b"{}",           # non-.py: skipped
        "worlds/../evil.py": b"# traversal",     # ..-guard: skipped
        **excluded_entries,
    }
    monkeypatch.setattr(
        world_source, "_download_once", fake_upstream_download(entries))

    ok, msg = world_source.install_world_source()
    assert ok, msg
    assert FAKE_VERSION in msg

    root = world_source.get_world_source_root()
    assert (root / "worlds/foo/Rules.py").read_bytes() == b"# rules source"
    assert (root / "BaseClasses.py").read_bytes() == b"# core source"
    assert not (root / "worlds/foo/data.json").exists()
    for tree in EXCLUDED_TREES:
        assert not (root / tree).exists(), tree
    # the traversal entry must not have escaped or landed anywhere
    assert not list(ws_sandbox.rglob("evil.py"))

    manifest = json.loads((root / "manifest.json").read_text())
    assert manifest["ap_version"] == FAKE_VERSION
    assert manifest["extracted_files"] == 2
    assert FAKE_VERSION in manifest["source_url"]
    assert world_source.is_world_source_installed()


def test_already_installed_short_circuits(ws_sandbox, monkeypatch):
    monkeypatch.setattr(world_source, "is_frozen", lambda: True)
    root = world_source.get_world_source_root()
    root.mkdir(parents=True)
    (root / "manifest.json").write_text("{}")
    monkeypatch.setattr(
        world_source, "_download_once",
        lambda *a, **k: pytest.fail("must not re-download"))
    ok, msg = world_source.install_world_source()
    assert ok
    assert "already installed" in msg


def test_archive_without_usable_source_fails(ws_sandbox, monkeypatch):
    monkeypatch.setattr(world_source, "is_frozen", lambda: True)
    monkeypatch.setattr(
        world_source, "_download_once",
        fake_upstream_download({"README.md": b"# no py here"}))
    ok, msg = world_source.install_world_source()
    assert not ok
    assert not world_source.is_world_source_installed()


class TestExporterWorldSourceFallback:
    @pytest.fixture
    def source_tree(self, tmp_path, monkeypatch):
        """A fake installed world source matching the running AP version."""
        monkeypatch.setattr(Utils, "__version__", f"{FAKE_VERSION}-zz_test")
        monkeypatch.setattr(
            Utils, "local_path",
            lambda *parts: str(tmp_path.joinpath(*parts)))
        target = tmp_path / WORLD_SOURCE_DIR / FAKE_VERSION / "worlds" / "foo"
        target.mkdir(parents=True)
        (target / "Rules.py").write_text("# foo rules source\n")
        return tmp_path

    def test_finds_version_matched_source(self, source_tree):
        found = _world_source_fallback_path("worlds/foo/Rules.py")
        assert found is not None
        assert Path(found) == \
            source_tree / WORLD_SOURCE_DIR / FAKE_VERSION / "worlds/foo/Rules.py"

    def test_accepts_windows_style_relative_path(self, source_tree):
        # Regression: frozen Windows co_filename arrives backslashed
        assert _world_source_fallback_path("worlds\\foo\\Rules.py") is not None

    def test_rejects_absolute_paths(self, source_tree):
        assert _world_source_fallback_path("/abs/worlds/foo/Rules.py") is None
        assert _world_source_fallback_path("C:\\AP\\worlds\\foo\\Rules.py") is None

    def test_rejects_non_matching_version(self, tmp_path, monkeypatch):
        # source present only for a DIFFERENT AP version: must not be used
        # (lambda extraction is line-number based, so version match is
        # a correctness requirement)
        monkeypatch.setattr(Utils, "__version__", f"{FAKE_VERSION}-zz_test")
        monkeypatch.setattr(
            Utils, "local_path",
            lambda *parts: str(tmp_path.joinpath(*parts)))
        other = tmp_path / WORLD_SOURCE_DIR / "1.0.0" / "worlds" / "foo"
        other.mkdir(parents=True)
        (other / "Rules.py").write_text("# wrong version\n")
        assert _world_source_fallback_path("worlds/foo/Rules.py") is None

    def test_read_source_falls_back_to_world_source(self, source_tree):
        # the relative path does not exist as a real file -> fallback hits
        assert _read_source_from_path("worlds/foo/Rules.py") == \
            "# foo rules source\n"


class TestExporterApworldRead:
    @pytest.fixture
    def apworld(self, tmp_path):
        path = tmp_path / "foo.apworld"
        with zipfile.ZipFile(path, "w") as zf:
            zf.writestr("foo/Rules.py", "# apworld rules\n")
        return path

    def test_reads_forward_slash_path(self, apworld):
        assert _read_source_from_path(f"{apworld}/foo/Rules.py") == \
            "# apworld rules\n"

    def test_reads_backslash_internal_path(self, apworld):
        # Regression: on Windows, co_filename yields backslashed internal
        # paths, but zip entries always use forward slashes
        assert _read_source_from_path(f"{apworld}\\foo\\Rules.py") == \
            "# apworld rules\n"

    def test_missing_internal_path_returns_none(self, apworld):
        assert _read_source_from_path(f"{apworld}/foo/Missing.py") is None
