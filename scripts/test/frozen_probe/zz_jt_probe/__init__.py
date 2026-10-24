"""Scenario probe for the frozen-install test harness.

Frozen Archipelago offers no headless entry point into the JSON Tools
installer, but worlds import at generation time — so the harness
(scripts/test/test-frozen-install.py) packs this world into
custom_worlds/, stages a scenario sidecar JSON in the install root, and
runs ArchipelagoGenerate once. At import this module executes the sidecar's
action list against the REAL installer functions (of the deployed
json_tools_installer apworld) inside the real frozen interpreter, and
writes a JSON report back into the install root for the harness to assert
on.

Named zz_* so it imports after json_tools_installer.

Sidecar (install root, written by the harness):
    zz_jt_probe_scenario.json = {"scenario": <name>, "actions": [{...}]}
Report (install root, read + removed by the harness):
    zz_jt_probe_report.json
"""

import json
import sys
import traceback
from typing import ClassVar

from worlds.AutoWorld import World

from .probe_contract import REPORT_NAME, SIDECAR_NAME


def _action_extract(spec: dict) -> dict:
    """Download (or open) a source archive and extract components."""
    import tempfile
    from pathlib import Path
    from worlds.json_tools_installer.installer.extractor import extract_tools

    components = spec["components"]

    def do_extract(archive_path: Path, source=None) -> dict:
        # source drives the submodule fetch's pinned-SHA lookup; GitHub
        # archives carry no submodule content, so without that step the
        # frontend installs with empty frontend/modules/* directories
        result = extract_tools(archive_path, components, source=source)
        return {
            "ok": result.success,
            "extracted_files": len(result.extracted_files),
            "skipped_files": len(result.skipped_files),
            "submodules": result.submodules,
            "warnings": result.warnings,
            "errors": result.errors[:10],
        }

    if spec.get("archive_path"):
        return do_extract(Path(spec["archive_path"]))

    from worlds.json_tools_installer.config import SourceConfig
    from worlds.json_tools_installer.installer.downloader import download_archive

    source = SourceConfig(spec["repo"], spec["branch"])
    with tempfile.TemporaryDirectory() as td:
        archive = Path(td) / "archive.zip"
        dl = download_archive(source, dest_path=archive)
        if not dl.success:
            return {"ok": False, "errors": [f"download failed: {dl.error}"]}
        out = do_extract(archive, source)
        out["downloaded_mb"] = round((dl.size_bytes or 0) / 1024 / 1024, 1)
        return out


def _action_install_dependencies(spec: dict) -> dict:
    from worlds.json_tools_installer.installer.dependencies import (
        install_all_dependencies,
    )
    ok, msg = install_all_dependencies()
    return {"ok": ok, "msg": msg}


def _action_pip_guard(spec: dict) -> dict:
    """Attempt a SECOND in-process pip run; the guard must refuse it
    without hanging (a real second run deadlocks the frozen Launcher)."""
    from worlds.json_tools_installer.installer.dependencies import (
        _install_packages_frozen,
    )
    ok, msg = _install_packages_frozen(spec.get("packages", ["dill"]))
    return {"ok": True, "second_run_ok": ok, "msg": msg}


def _action_install_world_source(spec: dict) -> dict:
    from worlds.json_tools_installer.installer.world_source import (
        get_world_source_root,
        install_world_source,
        is_world_source_installed,
    )
    ok, msg = install_world_source()
    out = {"ok": ok, "msg": msg, "installed": is_world_source_installed()}
    root = get_world_source_root()
    out["root"] = str(root)
    manifest_path = root / "manifest.json"
    if manifest_path.is_file():
        out["manifest"] = json.loads(manifest_path.read_text(encoding="utf-8"))
    return out


def _action_configure_export(spec: dict) -> dict:
    from worlds.json_tools_installer.config import configure_export_settings
    ok = configure_export_settings(preset=spec.get("preset", "normal"))
    return {"ok": ok}


def _action_record_install(spec: dict) -> dict:
    """Persist what a real install flow records (config + patch method),
    so the NEXT Generate run auto-installs the export hooks."""
    from datetime import datetime
    from worlds.json_tools_installer.config import load_config, save_config

    config = load_config()
    config.installation.version = spec.get("version", "dev")
    config.installation.components = spec["components"]
    config.installation.installed_at = datetime.now().isoformat()
    config.patches.method = spec.get("patch_method", "monkey")
    save_config(config)
    return {"ok": True}


def _action_uninstall(spec: dict) -> dict:
    from worlds.json_tools_installer.cli.install import do_uninstall
    from worlds.json_tools_installer.config import load_config
    ok = do_uninstall(load_config())
    return {"ok": ok}


def _action_list_installed(spec: dict) -> dict:
    from worlds.json_tools_installer.installer.extractor import (
        list_installed_components,
    )
    return {"ok": True, "installed": sorted(list_installed_components())}


ACTIONS = {
    "extract": _action_extract,
    "install_dependencies": _action_install_dependencies,
    "pip_guard": _action_pip_guard,
    "install_world_source": _action_install_world_source,
    "configure_export": _action_configure_export,
    "record_install": _action_record_install,
    "uninstall": _action_uninstall,
    "list_installed": _action_list_installed,
}


def _run_scenario() -> dict:
    from Utils import local_path

    report = {
        "frozen": bool(getattr(sys, "frozen", False)),
        "actions": [],
    }
    try:
        with open(local_path(SIDECAR_NAME), "r", encoding="utf-8") as f:
            scenario = json.load(f)
    except Exception as e:
        report["error"] = f"could not read scenario sidecar: {e!r}"
        return report

    report["scenario"] = scenario.get("scenario", "?")
    for spec in scenario.get("actions", []):
        action_type = spec.get("type", "?")
        entry = {"type": action_type}
        handler = ACTIONS.get(action_type)
        if handler is None:
            entry.update(ok=False, error=f"unknown action type {action_type!r}")
        else:
            try:
                entry.update(handler(spec))
            except Exception as e:
                entry.update(
                    ok=False,
                    error=f"EXCEPTION: {e!r}",
                    traceback=traceback.format_exc()[-2000:],
                )
        report["actions"].append(entry)
        if not entry.get("ok") and spec.get("stop_on_failure", True):
            report["stopped_early"] = True
            break
    return report


def _write_report() -> None:
    try:
        from Utils import local_path
        with open(local_path(REPORT_NAME), "w", encoding="utf-8") as f:
            json.dump(_run_scenario(), f, indent=2)
    except Exception:
        # Never break world loading; the harness treats a missing report
        # as the failure signal.
        pass


_write_report()


class ZZJTProbeWorld(World):
    """Harness probe world, not a playable game."""
    game = "ZZ JT Probe"
    hidden = True

    item_name_to_id: ClassVar[dict] = {}
    location_name_to_id: ClassVar[dict] = {}

    @classmethod
    def stage_assert_generate(cls, multiworld) -> None:
        raise RuntimeError(
            "ZZ JT Probe is a test harness probe, not a playable game.")
