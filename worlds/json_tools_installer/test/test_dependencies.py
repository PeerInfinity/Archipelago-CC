"""Dependency scanning and installation: apworld requirements discovery,
dist-name (not import-name) missing checks, the single-pip-call contract,
and the frozen re-invocation guard."""
import sys
import types
import zipfile

import pytest

from worlds.json_tools_installer.installer import dependencies
from worlds.json_tools_installer.installer.extractor import CUSTOM_WORLDS_DIR_NAME


@pytest.fixture
def custom_worlds(tmp_path, monkeypatch):
    """Redirect the scanner's user_path (bound at module import) to tmp."""
    monkeypatch.setattr(
        dependencies, "user_path",
        lambda *parts: str(tmp_path.joinpath(*parts)))
    folder = tmp_path / CUSTOM_WORLDS_DIR_NAME
    folder.mkdir()
    return folder


def make_apworld(path, files):
    with zipfile.ZipFile(path, "w") as zf:
        for name, data in files.items():
            zf.writestr(name, data)


class TestScanApworldRequirements:
    def test_finds_by_content_in_renamed_apworld(self, custom_worlds):
        # file stem ("renamed-copy") deliberately differs from the world
        # directory inside ("metamath") — matching must go by zip content
        make_apworld(custom_worlds / "renamed-copy.apworld", {
            "metamath/__init__.py": "# mm",
            "metamath/requirements.txt": "metamath-py>=0.0.7\n",
        })
        assert dependencies.scan_apworld_requirements() == ["metamath-py>=0.0.7"]

    def test_strips_comments_and_blanks_dedups_across_apworlds(self, custom_worlds):
        make_apworld(custom_worlds / "a.apworld", {
            "worlda/requirements.txt":
                "# full-line comment\n"
                "shared-dep==1.0  # trailing comment\n"
                "\n"
                "only-in-a>=2\n",
        })
        make_apworld(custom_worlds / "b.apworld", {
            "worldb/requirements.txt":
                "shared-dep==1.0\n"
                "only-in-b\n",
        })
        assert dependencies.scan_apworld_requirements() == [
            "shared-dep==1.0", "only-in-a>=2", "only-in-b"]

    def test_reads_root_level_requirements(self, custom_worlds):
        make_apworld(custom_worlds / "flat.apworld", {
            "requirements.txt": "flat-dep\n",
        })
        assert dependencies.scan_apworld_requirements() == ["flat-dep"]

    def test_ignores_nested_requirements(self, custom_worlds):
        make_apworld(custom_worlds / "nested.apworld", {
            "world/docs/requirements.txt": "not-a-world-dep\n",
        })
        assert dependencies.scan_apworld_requirements() == []

    def test_unreadable_apworld_is_skipped_not_fatal(self, custom_worlds):
        (custom_worlds / "broken.apworld").write_bytes(b"not a zip")
        make_apworld(custom_worlds / "ok.apworld", {
            "world/requirements.txt": "good-dep\n",
        })
        assert dependencies.scan_apworld_requirements() == ["good-dep"]

    def test_no_custom_worlds_dir(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            dependencies, "user_path",
            lambda *parts: str(tmp_path.joinpath("missing", *parts)))
        assert dependencies.scan_apworld_requirements() == []


class TestCheckMissingRequirements:
    def test_checks_by_distribution_name_not_import_name(self, tmp_path, monkeypatch):
        # Regression: metamath-py installs a package importable as
        # `metamathpy` — an import-name check would report it missing.
        dist_info = tmp_path / "site" / "metamath_py-0.0.7.dist-info"
        dist_info.mkdir(parents=True)
        (dist_info / "METADATA").write_text(
            "Metadata-Version: 2.1\nName: metamath-py\nVersion: 0.0.7\n")
        monkeypatch.syspath_prepend(str(tmp_path / "site"))
        assert dependencies.check_missing_requirements(["metamath-py>=0.0.7"]) == []

    def test_reports_genuinely_missing(self):
        req = "zz-definitely-not-installed-anywhere>=1.0"
        assert dependencies.check_missing_requirements([req]) == [req]

    def test_parses_extras_and_markers(self):
        # dist name must be split off before extras/markers; the requirement
        # is returned verbatim when missing
        req = "zz-missing-pkg[extra]>=1.0; python_version >= '3.8'"
        assert dependencies.check_missing_requirements([req]) == [req]

    def test_any_installed_version_satisfies(self):
        # pytest itself is certainly installed; version specifiers are not
        # evaluated by design
        assert dependencies.check_missing_requirements(["pytest>=999.0"]) == []


class TestInstallAllDependencies:
    def test_single_pip_call_with_combined_requirements(self, monkeypatch):
        """Core packages and apworld requirements must arrive in ONE
        install_packages call — on frozen installs a second in-process pip
        run deadlocks the GUI."""
        calls = []
        monkeypatch.setattr(
            dependencies, "check_missing_packages", lambda: ["astunparse>=1.6.3"])
        monkeypatch.setattr(
            dependencies, "scan_apworld_requirements",
            lambda: ["metamath-py>=0.0.7", "astunparse>=1.6.3"])
        monkeypatch.setattr(
            dependencies, "check_missing_requirements",
            lambda reqs: [r for r in reqs if not r.startswith("astunparse")])
        monkeypatch.setattr(
            dependencies, "install_packages",
            lambda pkgs: (calls.append(list(pkgs)) or (True, "ok")))

        ok, _msg = dependencies.install_all_dependencies()
        assert ok
        assert calls == [["astunparse>=1.6.3", "metamath-py>=0.0.7"]]

    def test_no_pip_call_when_nothing_missing(self, monkeypatch):
        monkeypatch.setattr(dependencies, "check_missing_packages", lambda: [])
        monkeypatch.setattr(dependencies, "scan_apworld_requirements", lambda: [])
        monkeypatch.setattr(
            dependencies, "install_packages",
            lambda pkgs: pytest.fail("install_packages must not be called"))

        ok, msg = dependencies.install_all_dependencies()
        assert ok
        assert "already installed" in msg


@pytest.fixture
def fake_pip(monkeypatch, tmp_path):
    """Replace the bundled-pip import surface so _install_packages_frozen
    never touches the real pip, and record invocations."""
    calls = []

    def pip_main(args):
        calls.append(list(args))
        return 0

    monkeypatch.setitem(
        sys.modules, "pip._internal.cli.main",
        types.SimpleNamespace(main=pip_main))
    fake_certifi = types.SimpleNamespace(
        where=lambda: "", core=types.SimpleNamespace(where=lambda: ""))
    monkeypatch.setitem(sys.modules, "pip._vendor", types.SimpleNamespace(
        certifi=fake_certifi))
    monkeypatch.setitem(sys.modules, "pip._vendor.certifi", fake_certifi)
    fake_scripts = types.SimpleNamespace(ScriptMaker=type("SM", (), {}))
    monkeypatch.setitem(sys.modules, "pip._vendor.distlib", types.SimpleNamespace(
        scripts=fake_scripts))
    monkeypatch.setitem(sys.modules, "pip._vendor.distlib.scripts", fake_scripts)
    # keep the pip target and the guard flag inside the test
    monkeypatch.setattr(dependencies, "local_path",
                        lambda *parts: str(tmp_path.joinpath(*parts)))
    monkeypatch.setattr(dependencies, "_frozen_pip_invoked", False)
    return calls


class TestFrozenPipGuard:
    def test_second_invocation_returns_restart_message(self, fake_pip):
        ok, msg = dependencies._install_packages_frozen(["first-pkg"])
        assert ok, msg
        assert len(fake_pip) == 1
        assert "first-pkg" in fake_pip[0]

        ok, msg = dependencies._install_packages_frozen(["second-pkg"])
        assert not ok
        assert "Restart Archipelago" in msg
        assert "second-pkg" in msg
        # pip was NOT invoked a second time
        assert len(fake_pip) == 1

    def test_install_packages_routes_frozen(self, monkeypatch):
        routed = []
        monkeypatch.setattr(dependencies, "is_frozen", lambda: True)
        monkeypatch.setattr(
            dependencies, "_install_packages_frozen",
            lambda pkgs: (routed.append(list(pkgs)) or (True, "ok")))
        ok, _msg = dependencies.install_packages(["some-pkg"])
        assert ok
        assert routed == [["some-pkg"]]

    def test_install_packages_empty_is_noop(self, monkeypatch):
        monkeypatch.setattr(
            dependencies, "is_frozen",
            lambda: pytest.fail("must not even check frozen state"))
        ok, msg = dependencies.install_packages([])
        assert ok
        assert "No packages" in msg
