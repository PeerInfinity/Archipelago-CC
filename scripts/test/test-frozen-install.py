#!/usr/bin/env python3
"""
Frozen-install test harness for JSON Tools.

Automates the manual test-bench procedure against a compiled (frozen)
Archipelago installation: reset the install to a clean state, deploy the
working tree's json_tools_installer apworld, drive the installer functions
inside the real frozen interpreter via a probe apworld (frozen AP has no
headless installer entry point, but worlds import at generation time), then
generate for real and assert on the report, the filesystem, the output zip
and the logs.

The compiled-install location is INPUT, never a literal: pass --install-dir
or set JT_FROZEN_AP_DIR. Whatever directory is given is validated, not
trusted (manifest.json + ArchipelagoGenerate.exe + lib/), and the AP version
read from that manifest drives all version-dependent expectations.

Host support is confined to two adapters:
  - NativeWindowsHost: runs the exe directly (CI / real Windows)
  - WslInteropHost:    runs the exe through WSL interop; paths translated
                       with wslpath; preconditions detected, not assumed

Usage:
    python scripts/test/test-frozen-install.py --install-dir /mnt/c/path/to/Archipelago
    python scripts/test/test-frozen-install.py --scenario baseline --source repo
    JT_FROZEN_AP_DIR=... python scripts/test/test-frozen-install.py

Sources (--source):
    dev     download the dev fork archive (GitHub, ~40 MB)   [default]
    stable  download the stable archive (GitHub)
    repo    pack the local working tree's HEAD via `git archive` (offline,
            but does NOT include uncommitted changes)

State handling: every scenario starts with a reset (installer-owned
artifacts removed, the AP installation itself untouched). On failure the
install is left as-is for inspection; on success it is reset again unless
--keep-state is given.

One-time manual step (local bench): installing compiled Archipelago itself
(Setup.Archipelago.<ver>.exe /VERYSILENT) triggers the Windows UAC consent
popup — accepted as-is rather than worked around. Everything this harness
does afterwards is fully autonomous. CI runners execute elevated, so the
same silent install runs unattended there (.github/workflows/
test-frozen-install.yml).
"""

import argparse
import importlib.util
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Set

REPO_ROOT = Path(__file__).resolve().parents[2]
PROBE_TEMPLATE_DIR = Path(__file__).resolve().parent / "frozen_probe"

ENV_INSTALL_DIR = "JT_FROZEN_AP_DIR"

# Interop re-registration command (binfmt entry vanishes on WSL restart)
WSL_INTEROP_FIX = (
    "sudo sh -c \"echo ':WSLInterop:M::MZ::/init:PF' "
    "> /proc/sys/fs/binfmt_misc/register\""
)

# Report files earlier ad-hoc probe worlds left in the install root; the
# reset step clears them alongside the current probe's artifacts.
LEGACY_PROBE_REPORTS = [
    "probe_report.json",
    "jt_frozen_test_report.json",
    "ws_test_report.json",
    "final_test_report.json",
    "worlds_test_report.json",
    "apdep_test_report.json",
]
LEGACY_PROBE_APWORLDS = ["sys_probe.apworld"]

# Strings that must NOT appear in the real generation run's output/logs
BAD_LOG_PATTERNS = [
    "Failed to read source",
    "Failed to clean source",
    "Invalid or missing manifest",
]

# Per-game expectations for the exported rules JSON of the verification run
RULES_EXPECTATIONS = {
    # MetaMath: the frozen arc verified every access rule analyzes (the
    # ast analyzer handles all of MetaMath's lambdas). The default template
    # theorem (2p2e4) yields 18 locations.
    "Metamath": {"min_locations": 15, "max_null_rules": 0},
}


def load_probe_contract():
    """Load the probe's file-name contract without importing the probe
    (its __init__ executes the scenario on import by design)."""
    path = PROBE_TEMPLATE_DIR / "zz_jt_probe" / "probe_contract.py"
    spec = importlib.util.spec_from_file_location("probe_contract", path)
    assert spec is not None and spec.loader is not None, path
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CONTRACT = load_probe_contract()


class HarnessError(Exception):
    """Fatal precondition/environment failure with an actionable message."""


# ---------------------------------------------------------------------------
# Host adapters
# ---------------------------------------------------------------------------

class NativeWindowsHost:
    """Runs the frozen exe directly on Windows."""
    name = "windows"

    def validate(self, install_dir: Path) -> None:
        if platform.system() != "Windows":
            raise HarnessError(
                "--host windows selected but this is not a Windows Python")

    def host_path(self, path: Path) -> str:
        return str(path)

    def run_exe(self, exe: Path, args: List[str], cwd: Path,
                timeout: int) -> subprocess.CompletedProcess:
        return subprocess.run(
            [str(exe), *args], cwd=str(cwd), capture_output=True,
            text=True, errors="replace", timeout=timeout)


class WslInteropHost:
    """Runs the frozen Windows exe from WSL via binfmt interop."""
    name = "wsl"

    def __init__(self):
        self._path_cache: Dict[str, str] = {}

    def validate(self, install_dir: Path) -> None:
        binfmt_dir = Path("/proc/sys/fs/binfmt_misc")
        if not binfmt_dir.is_dir():
            raise HarnessError(
                "binfmt_misc is not available — is this actually WSL? "
                "Use --host windows on native Windows.")
        if not list(binfmt_dir.glob("WSLInterop*")):
            raise HarnessError(
                "WSL interop is not registered (the binfmt entry disappears "
                "after a WSL restart). Re-register it with:\n"
                f"    {WSL_INTEROP_FIX}")
        # The install dir must resolve to a Windows drive for the exe to see it
        try:
            self.host_path(install_dir)
        except HarnessError:
            raise
        except Exception as e:
            raise HarnessError(
                f"wslpath could not translate {install_dir}: {e}")

    def host_path(self, path: Path) -> str:
        key = str(path)
        if key not in self._path_cache:
            result = subprocess.run(
                ["wslpath", "-w", key], capture_output=True, text=True)
            if result.returncode != 0:
                raise HarnessError(
                    f"{path} does not translate to a Windows path "
                    f"(wslpath: {result.stderr.strip()}) — the install dir "
                    "must live on a Windows drive mount")
            self._path_cache[key] = result.stdout.strip()
        return self._path_cache[key]

    def run_exe(self, exe: Path, args: List[str], cwd: Path,
                timeout: int) -> subprocess.CompletedProcess:
        # binfmt interop executes the PE directly from a WSL path
        return subprocess.run(
            [str(exe), *args], cwd=str(cwd), capture_output=True,
            text=True, errors="replace", timeout=timeout)


def select_host(choice: str):
    if choice == "windows":
        return NativeWindowsHost()
    if choice == "wsl":
        return WslInteropHost()
    # auto
    if platform.system() == "Windows":
        return NativeWindowsHost()
    if Path("/proc/sys/fs/binfmt_misc").is_dir() or \
            "microsoft" in platform.release().lower():
        return WslInteropHost()
    raise HarnessError(
        "Could not auto-detect a host able to run Windows executables; "
        "pass --host {windows,wsl} explicitly.")


# ---------------------------------------------------------------------------
# Install-dir validation
# ---------------------------------------------------------------------------

def validate_install_dir(install_dir: Path) -> str:
    """Validate the given directory is a compiled AP install; return its
    base version string as read from manifest.json."""
    if not install_dir.is_dir():
        raise HarnessError(f"install dir does not exist: {install_dir}")

    manifest_path = install_dir / "manifest.json"
    if not manifest_path.is_file():
        raise HarnessError(
            f"{install_dir} has no manifest.json — not a compiled "
            "Archipelago install")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        version = manifest["version"]
    except Exception as e:
        raise HarnessError(f"could not read AP version from {manifest_path}: {e}")
    if isinstance(version, list):
        version = ".".join(str(part) for part in version)
    version = str(version)

    if not (install_dir / "ArchipelagoGenerate.exe").is_file():
        raise HarnessError(
            f"{install_dir} has no ArchipelagoGenerate.exe — not a compiled "
            "Archipelago install")
    if not (install_dir / "lib").is_dir():
        raise HarnessError(f"{install_dir} has no lib/ directory")
    return version


# ---------------------------------------------------------------------------
# Check bookkeeping
# ---------------------------------------------------------------------------

class CheckList:
    def __init__(self, scenario: str):
        self.scenario = scenario
        self.passed = 0
        self.failures: List[str] = []

    def check(self, condition: bool, label: str, detail: str = "") -> bool:
        if condition:
            self.passed += 1
            print(f"    [PASS] {label}")
        else:
            self.failures.append(label + (f" — {detail}" if detail else ""))
            print(f"    [FAIL] {label}" + (f"\n           {detail}" if detail else ""))
        return condition

    @property
    def ok(self) -> bool:
        return not self.failures


@dataclass
class GenerateResult:
    returncode: Optional[int]  # None on timeout
    output: str                # captured stdout+stderr
    log_text: str              # logs/ files written during the run
    new_zips: List[Path] = field(default_factory=list)

    @property
    def all_text(self) -> str:
        return self.output + "\n" + self.log_text


# ---------------------------------------------------------------------------
# The harness
# ---------------------------------------------------------------------------

class FrozenHarness:
    def __init__(self, install_dir: Path, host, source: str, timeout: int,
                 keep_state: bool):
        self.install_dir = install_dir
        self.host = host
        self.source = source
        self.timeout = timeout
        self.keep_state = keep_state

        # Production modules (imported lazily by main() before construction)
        from worlds.json_tools_installer.installer import extractor
        from worlds.json_tools_installer.installer import world_source
        from worlds.json_tools_installer import config as installer_config
        self.extractor = extractor
        self.world_source = world_source
        self.installer_config = installer_config

        self.ap_version = validate_install_dir(install_dir)
        self._repo_archive: Optional[Path] = None
        self._scratch = Path(tempfile.mkdtemp(prefix="jt_frozen_harness_"))

    # -- naming helpers (all derived, no install-layout literals) ----------

    @property
    def custom_worlds(self) -> Path:
        return self.install_dir / self.extractor.CUSTOM_WORLDS_DIR_NAME

    @property
    def probe_apworld_path(self) -> Path:
        return self.custom_worlds / f"{CONTRACT.PROBE_WORLD_NAME}.apworld"

    @property
    def sidecar_path(self) -> Path:
        return self.install_dir / CONTRACT.SIDECAR_NAME

    @property
    def report_path(self) -> Path:
        return self.install_dir / CONTRACT.REPORT_NAME

    def player_dir(self, tag: str) -> Path:
        return self.install_dir / f"{CONTRACT.PROBE_WORLD_NAME}_players_{tag}"

    @property
    def staged_archive_path(self) -> Path:
        return self.install_dir / f"{CONTRACT.PROBE_WORLD_NAME}_archive.zip"

    # -- reset --------------------------------------------------------------

    def installer_owned_paths(self) -> Set[Path]:
        """Every location a component install can write, derived from
        COMPONENTS metadata."""
        paths: Set[Path] = set()
        for comp in self.extractor.COMPONENTS.values():
            roots = [self.install_dir]
            if comp.frozen_dest:
                roots.append(self.install_dir / comp.frozen_dest)
            for source_path in comp.source_paths:
                for root in roots:
                    paths.add(root / source_path)
            for pattern in comp.source_patterns:
                if pattern.endswith("/*"):
                    continue
                paths.update(self.install_dir.glob(pattern))
            if comp.frozen_apworld or comp.source_patterns:
                for source_path in comp.source_paths:
                    world = source_path.split("/")[-1]
                    paths.add(self.custom_worlds / f"{world}.apworld")
                for pattern in comp.source_patterns:
                    if pattern.endswith("/*"):
                        continue
                    world_glob = pattern.split("/")[-1]
                    paths.update(self.custom_worlds.glob(f"{world_glob}.apworld"))
        return paths

    def remove_pip_artifacts(self) -> List[str]:
        """Remove packages the installer's in-process pip put into lib/.

        Vanilla frozen builds ship no *.dist-info in lib/, so any dist-info
        there is installer-owned. Files are removed via each dist-info's
        RECORD (paths constrained to lib/), then the top_level package dirs.
        """
        lib_dir = (self.install_dir / "lib").resolve()
        removed = []
        for dist_info in sorted(lib_dir.glob("*.dist-info")):
            record = dist_info / "RECORD"
            if record.is_file():
                for line in record.read_text(encoding="utf-8").splitlines():
                    rel = line.split(",")[0].strip()
                    if not rel:
                        continue
                    target = (lib_dir / rel).resolve()
                    if lib_dir not in target.parents:
                        continue  # never delete outside lib/
                    if target.is_file():
                        target.unlink()
            top_level = dist_info / "top_level.txt"
            if top_level.is_file():
                for name in top_level.read_text(encoding="utf-8").split():
                    pkg_dir = (lib_dir / name).resolve()
                    if lib_dir in pkg_dir.parents and pkg_dir.is_dir():
                        shutil.rmtree(pkg_dir, ignore_errors=True)
            shutil.rmtree(dist_info, ignore_errors=True)
            removed.append(dist_info.name)
        return removed

    def reset(self) -> None:
        """Remove installer-owned artifacts; leave the AP install intact."""
        validate_install_dir(self.install_dir)  # refuse to reset a non-install
        print(f"  Resetting {self.install_dir} ...")
        removed = 0

        for path in sorted(self.installer_owned_paths()):
            if path.is_dir():
                shutil.rmtree(path)
                removed += 1
            elif path.is_file():
                path.unlink()
                removed += 1

        # installer bookkeeping, backups, world source (all versions)
        for name in (self.installer_config.CONFIG_FILENAME,):
            target = self.install_dir / name
            if target.is_file():
                target.unlink()
                removed += 1
        for dirname in (self.world_source.WORLD_SOURCE_DIR,
                        self.extractor.BACKUP_DIR_NAME):
            target = self.install_dir / dirname
            if target.is_dir():
                shutil.rmtree(target)
                removed += 1

        # our deployed installer apworld
        deployed = self.custom_worlds / "json_tools_installer.apworld"
        if deployed.is_file():
            deployed.unlink()
            removed += 1

        # probe artifacts, current and legacy
        if self.custom_worlds.is_dir():
            for apworld in self.custom_worlds.glob("zz_*.apworld"):
                apworld.unlink()
                removed += 1
            for name in LEGACY_PROBE_APWORLDS:
                target = self.custom_worlds / name
                if target.is_file():
                    target.unlink()
                    removed += 1
        for name in ([CONTRACT.SIDECAR_NAME, CONTRACT.REPORT_NAME]
                     + LEGACY_PROBE_REPORTS):
            target = self.install_dir / name
            if target.is_file():
                target.unlink()
                removed += 1
        if self.staged_archive_path.is_file():
            self.staged_archive_path.unlink()
            removed += 1
        for player_dir in self.install_dir.glob(
                f"{CONTRACT.PROBE_WORLD_NAME}_players_*"):
            shutil.rmtree(player_dir)
            removed += 1

        pip_removed = self.remove_pip_artifacts()
        print(f"  Reset done: {removed} artifact paths removed, "
              f"pip dists removed: {pip_removed or 'none'}")

    # -- deploy -------------------------------------------------------------

    def deploy_installer(self) -> None:
        """Pack json_tools_installer from the working tree into custom_worlds."""
        packed = self._scratch / "json_tools_installer.apworld"
        result = subprocess.run(
            [sys.executable,
             str(REPO_ROOT / "scripts" / "build" / "pack_json_tools_installer.py"),
             "--output", str(packed)],
            cwd=str(REPO_ROOT), capture_output=True, text=True)
        if result.returncode != 0 or not packed.is_file():
            raise HarnessError(
                f"packing json_tools_installer failed:\n{result.stdout[-1500:]}"
                f"\n{result.stderr[-500:]}")
        self.custom_worlds.mkdir(parents=True, exist_ok=True)
        shutil.copy2(packed, self.custom_worlds / packed.name)
        print(f"  Deployed working-tree installer apworld "
              f"({packed.stat().st_size // 1024} KB)")

    def deploy_probe(self) -> None:
        src = PROBE_TEMPLATE_DIR / CONTRACT.PROBE_WORLD_NAME
        self.custom_worlds.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(self.probe_apworld_path, "w",
                             zipfile.ZIP_DEFLATED) as zf:
            for path in sorted(src.rglob("*")):
                if not path.is_file() or "__pycache__" in path.parts:
                    continue
                arcname = f"{CONTRACT.PROBE_WORLD_NAME}/{path.relative_to(src).as_posix()}"
                data = path.read_bytes()
                if path.name == "archipelago.json":
                    data = self.extractor.stamp_container_version(data)
                zf.writestr(arcname, data)
        print(f"  Deployed probe apworld: {self.probe_apworld_path.name}")

    def remove_probe(self) -> None:
        if self.probe_apworld_path.is_file():
            self.probe_apworld_path.unlink()
        if self.sidecar_path.is_file():
            self.sidecar_path.unlink()

    # -- scenario I/O ---------------------------------------------------------

    def source_spec(self) -> dict:
        """The extract action's source part, per --source."""
        cfg = self.installer_config
        if self.source == "dev":
            return {"repo": cfg.DEFAULT_DEV_REPO, "branch": cfg.DEFAULT_DEV_BRANCH}
        if self.source == "stable":
            return {"repo": cfg.DEFAULT_STABLE_REPO,
                    "branch": cfg.DEFAULT_STABLE_BRANCH}
        # repo: pack HEAD once, stage it into the install root
        if self._repo_archive is None:
            archive = self._scratch / "repo_archive.zip"
            result = subprocess.run(
                ["git", "-C", str(REPO_ROOT), "archive", "--format=zip",
                 "--prefix=Archipelago-CC-repo/", "-o", str(archive), "HEAD"],
                capture_output=True, text=True)
            if result.returncode != 0:
                raise HarnessError(f"git archive failed: {result.stderr[-500:]}")
            self._repo_archive = archive
            print("  Built --source repo archive from HEAD "
                  "(uncommitted changes are NOT included)")
        shutil.copy2(self._repo_archive, self.staged_archive_path)
        return {"archive_path": self.host.host_path(self.staged_archive_path)}

    def write_sidecar(self, scenario_name: str, actions: List[dict]) -> None:
        self.sidecar_path.write_text(
            json.dumps({"scenario": scenario_name, "actions": actions}, indent=2),
            encoding="utf-8")

    def read_report(self) -> dict:
        if not self.report_path.is_file():
            raise HarnessError(
                "probe report was not written — the probe world likely never "
                "imported (check the Generate output/logs)")
        report = json.loads(self.report_path.read_text(encoding="utf-8"))
        self.report_path.unlink()
        return report

    # -- player yamls ---------------------------------------------------------

    def stage_probe_player_yaml(self, tag: str = "probe") -> Path:
        """A minimal single-player yaml for a bundled game, to make Generate
        proceed far enough to import custom worlds (0.6.7 loads them lazily)."""
        player_dir = self.player_dir(tag)
        if player_dir.is_dir():
            shutil.rmtree(player_dir)
        player_dir.mkdir(parents=True)
        (player_dir / "probe.yaml").write_text(
            "name: JTProbe\n"
            "description: frozen-harness probe run\n"
            "game: APQuest\n"
            "requires:\n"
            f"  version: {self.ap_version}\n"
            "APQuest: {}\n",
            encoding="utf-8")
        return player_dir

    def _template_path(self, name: str) -> Path:
        """Repo template if present; else generate templates once into the
        scratch dir (Players/ is gitignored, so CI checkouts have none —
        generated defaults are equivalent since staging rewrites requires)."""
        repo_template = REPO_ROOT / "Players" / "Templates" / name
        if repo_template.is_file():
            return repo_template
        generated_dir = self._scratch / "templates"
        if not generated_dir.is_dir():
            print("  Repo has no Players/Templates — generating templates "
                  "(one-time, all worlds) ...")
            from Options import generate_yaml_templates
            generate_yaml_templates(generated_dir)
        generated = generated_dir / name
        if not generated.is_file():
            raise HarnessError(f"template not found: {name} (neither in "
                               f"{repo_template.parent} nor generated)")
        return generated

    def stage_template_player_yamls(self, template_names: List[str],
                                    tag: str) -> Path:
        """Stage repo templates adapted to the installed AP version: the
        requires block is rewritten to the manifest-read version (dropping
        world-version game pins, which 0.6.x reads as 0.0.0)."""
        player_dir = self.player_dir(tag)
        if player_dir.is_dir():
            shutil.rmtree(player_dir)
        player_dir.mkdir(parents=True)
        for name in template_names:
            template = self._template_path(name)
            text = template.read_text(encoding="utf-8-sig")
            text, count = re.subn(
                r"^requires:\n(?:[ \t]+.*\n)*",
                f"requires:\n  version: {self.ap_version}\n",
                text, count=1, flags=re.MULTILINE)
            if not count:
                raise HarnessError(f"{name} has no requires: block?")
            (player_dir / name).write_text(text, encoding="utf-8")
        return player_dir

    def run_probe(self, scenario_name: str, actions: List[dict],
                  tag: str = "probe"):
        """One probe cycle: deploy probe + sidecar, run Generate against a
        minimal bundled-game yaml, read the report, remove the probe."""
        self.deploy_probe()
        self.write_sidecar(scenario_name, actions)
        gen = self.run_generate(self.stage_probe_player_yaml(tag),
                                f"{scenario_name} probe")
        report = self.read_report()
        self.remove_probe()
        return gen, report

    # -- generate -------------------------------------------------------------

    def run_generate(self, player_dir: Path, label: str) -> GenerateResult:
        exe = self.install_dir / "ArchipelagoGenerate.exe"
        output_dir = self.install_dir / "output"
        logs_dir = self.install_dir / "logs"
        before_logs = {p: p.stat().st_mtime for p in logs_dir.glob("*")} \
            if logs_dir.is_dir() else {}
        start = time.time()

        args = [
            "--player_files_path", self.host.host_path(player_dir),
            "--seed", "1",
        ]
        print(f"  Running Generate ({label}) ...")
        try:
            proc = self.host.run_exe(exe, args, cwd=self.install_dir,
                                     timeout=self.timeout)
            returncode, output = proc.returncode, (proc.stdout or "") + (proc.stderr or "")
        except subprocess.TimeoutExpired as e:
            returncode = None
            output = (e.stdout or b"").decode("utf-8", "replace") if isinstance(
                e.stdout, bytes) else (e.stdout or "")
            print(f"  [!!] Generate timed out after {self.timeout}s (killed)")

        log_text = ""
        if logs_dir.is_dir():
            for log_file in sorted(logs_dir.glob("*")):
                if log_file.is_file() and (
                        log_file not in before_logs
                        or log_file.stat().st_mtime > start):
                    try:
                        log_text += log_file.read_text(
                            encoding="utf-8", errors="replace")
                    except OSError:
                        pass

        # New-or-rewritten zips by mtime: a same-seed run reuses the same
        # AP_<seed>.zip name, so path set-difference would miss it
        new_zips = sorted(
            (p for p in (output_dir.glob("*.zip") if output_dir.is_dir() else [])
             if p.stat().st_mtime >= start),
            key=lambda p: p.stat().st_mtime)
        duration = time.time() - start
        print(f"  Generate ({label}) rc={returncode} in {duration:.0f}s, "
              f"new zips: {[z.name for z in new_zips]}")
        return GenerateResult(returncode, output, log_text, new_zips)

    def cleanup_scratch(self) -> None:
        shutil.rmtree(self._scratch, ignore_errors=True)


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------

def baseline_components(harness) -> List[str]:
    """Default install selection plus demo_worlds (brings MetaMath, whose
    apworld requirements exercise the dependency path)."""
    comps = [name for name in harness.extractor.COMPONENTS
             if name in harness.extractor.DEFAULT_COMPONENTS]
    comps.append("demo_worlds")
    return comps


def find_action(report: dict, action_type: str) -> dict:
    for entry in report.get("actions", []):
        if entry.get("type") == action_type:
            return entry
    return {}


def rules_json_from_zip(zip_path: Path) -> Optional[dict]:
    with zipfile.ZipFile(zip_path) as zf:
        names = [n for n in zf.namelist() if n.endswith("_rules.json")]
        if not names:
            return None
        return json.loads(zf.read(names[0]).decode("utf-8"))


def count_location_rules(rules: dict) -> Dict[str, int]:
    total = 0
    null_rules = 0
    for player_regions in rules.get("regions", {}).values():
        for region in player_regions.values():
            for loc in region.get("locations") or []:
                if not isinstance(loc, dict):
                    continue
                total += 1
                if loc.get("access_rule") is None:
                    null_rules += 1
    return {"total": total, "null": null_rules}


def scenario_baseline(harness) -> CheckList:
    """Fresh full install: extract + deps + world_source + export config via
    the probe, then a real MetaMath generation with export assertions."""
    checks = CheckList("baseline")
    extractor = harness.extractor

    harness.reset()
    harness.deploy_installer()

    components = baseline_components(harness)
    actions = [
        {"type": "extract", "components": components, **harness.source_spec()},
        {"type": "install_dependencies"},
        {"type": "install_world_source"},
        # minimal-spoilers is the preset that enables save_rules_json /
        # save_sphere_log / update_frontend_presets — "normal" leaves the
        # export artifacts OFF, which would make the zip assertions vacuous
        {"type": "configure_export", "preset": "minimal-spoilers"},
        {"type": "record_install", "components": components,
         "version": harness.source, "patch_method": "monkey"},
    ]
    # --- probe run -----------------------------------------------------------
    gen1, report = harness.run_probe("baseline", actions)
    checks.check(gen1.returncode == 0, "probe Generate run exits 0",
                 f"rc={gen1.returncode}; tail: {gen1.output[-400:]}")

    checks.check(report.get("frozen") is True,
                 "probe ran inside a frozen interpreter")
    checks.check(not report.get("stopped_early"),
                 "all probe actions ran", json.dumps(report)[-500:])

    extract = find_action(report, "extract")
    checks.check(bool(extract.get("ok")), "extraction succeeded",
                 str(extract.get("errors")))
    checks.check(extract.get("extracted_files", 0) > 0,
                 "extraction wrote files")

    # warning set == exactly the expected unsupported/excluded set
    expected_warned = sorted(
        name for name in components
        if extractor.COMPONENTS[name].unsupported_frozen)
    warnings = extract.get("warnings", [])
    for name in expected_warned:
        checks.check(
            sum(1 for w in warnings if f"'{name}'" in w) == 1,
            f"exactly one skip warning for unsupported component {name!r}",
            str(warnings))
    excluded_worlds = sorted(
        world for name in components
        for world in extractor.COMPONENTS[name].frozen_exclude_worlds)
    checks.check(
        len(warnings) == len(expected_warned) + len(excluded_worlds),
        "no unexpected extraction warnings", str(warnings))

    deps = find_action(report, "install_dependencies")
    checks.check(bool(deps.get("ok")), "dependency install succeeded",
                 str(deps.get("msg")))
    dep_msg = deps.get("msg", "")
    checks.check("Installed into lib/" in dep_msg,
                 "dependencies were freshly installed in ONE pip run", dep_msg)
    for fragment in ("astunparse", "dill", "metamath"):
        checks.check(fragment in dep_msg,
                     f"single pip run covered {fragment}", dep_msg)

    world_source_action = find_action(report, "install_world_source")
    checks.check(bool(world_source_action.get("ok")),
                 "world source installed", str(world_source_action.get("msg")))
    ws_manifest = world_source_action.get("manifest") or {}
    checks.check(ws_manifest.get("ap_version") == harness.ap_version,
                 "world source version matches the install's manifest version",
                 f"{ws_manifest.get('ap_version')} != {harness.ap_version}")
    checks.check(ws_manifest.get("extracted_files", 0) > 0,
                 "world source extracted files")

    checks.check(bool(find_action(report, "configure_export").get("ok")),
                 "export settings configured")
    checks.check(bool(find_action(report, "record_install").get("ok")),
                 "install recorded in config")

    # --- filesystem ------------------------------------------------------------
    install_dir = harness.install_dir
    for name in components:
        comp = extractor.COMPONENTS[name]
        if comp.unsupported_frozen:
            continue
        if comp.frozen_dest:
            for source_path in comp.source_paths:
                checks.check(
                    (install_dir / comp.frozen_dest / source_path).exists(),
                    f"{name}: {source_path} present under {comp.frozen_dest}/")
                checks.check(
                    not (install_dir / source_path).exists(),
                    f"{name}: {source_path} NOT duplicated at install root")
        elif comp.frozen_apworld:
            for source_path in comp.source_paths:
                world = source_path.split("/")[-1]
                checks.check(
                    (harness.custom_worlds / f"{world}.apworld").is_file(),
                    f"{name}: {world}.apworld packed into "
                    f"{extractor.CUSTOM_WORLDS_DIR_NAME}/")

    ws_root = (install_dir / harness.world_source.WORLD_SOURCE_DIR
               / harness.ap_version)
    checks.check((ws_root / "manifest.json").is_file(),
                 "world source dir named for the manifest-read AP version")
    checks.check(
        not (install_dir / "worlds").exists(),
        "nothing extracted into a root worlds/ directory")

    # --- real generation run ---------------------------------------------------
    gen2 = harness.run_generate(
        harness.stage_template_player_yamls(["Metamath.yaml"], "generate"),
        "MetaMath generation")
    checks.check(gen2.returncode == 0, "MetaMath Generate run exits 0",
                 f"rc={gen2.returncode}; tail: {gen2.output[-400:]}")
    checks.check(len(gen2.new_zips) == 1, "exactly one new output zip",
                 str([z.name for z in gen2.new_zips]))

    if gen2.new_zips:
        with zipfile.ZipFile(gen2.new_zips[-1]) as zf:
            names = zf.namelist()
        checks.check(any(n.endswith("_rules.json") for n in names),
                     "output zip contains the exported rules JSON", str(names))
        checks.check(any(n.endswith("_sphere_log.jsonl") for n in names),
                     "output zip contains the sphere log", str(names))

        rules = rules_json_from_zip(gen2.new_zips[-1])
        checks.check(rules is not None, "rules JSON parses")
        if rules is not None:
            game = rules.get("game_name", "")
            expect = RULES_EXPECTATIONS.get(game, {})
            counts = count_location_rules(rules)
            checks.check(
                counts["total"] >= expect.get("min_locations", 1),
                f"rules JSON has locations (got {counts['total']})")
            max_null = expect.get("max_null_rules")
            if max_null is not None:
                checks.check(
                    counts["null"] <= max_null,
                    f"typed access rules ({counts['null']} null of "
                    f"{counts['total']}, allowed {max_null})")
            # preset copy must land under root frontend/, NOT lib/frontend
            game_dir = rules.get("game_directory")
            if game_dir:
                seed_stem = gen2.new_zips[-1].stem
                checks.check(
                    (install_dir / "frontend" / "presets" / game_dir
                     / seed_stem).is_dir(),
                    f"preset copied under root frontend/presets/{game_dir}/")

    for pattern in BAD_LOG_PATTERNS:
        checks.check(pattern not in gen2.all_text,
                     f"generation output/logs free of {pattern!r}")

    # the lib\frontend preset misdirection regression
    checks.check(not (install_dir / "lib" / "frontend").exists(),
                 "no presets written under lib/ (exporter path regression)")

    return checks


def scenario_pip_guard(harness) -> CheckList:
    """Second in-process pip run: must be refused with the restart message,
    not deadlock (the Generate timeout is the watchdog backstop)."""
    checks = CheckList("pip-guard")
    harness.reset()
    harness.deploy_installer()

    gen, report = harness.run_probe("pip-guard", [
        {"type": "install_dependencies"},
        {"type": "pip_guard", "packages": ["dill"]},
    ])
    checks.check(gen.returncode == 0,
                 "probe Generate exits 0 (no pip deadlock)",
                 f"rc={gen.returncode}")

    deps = find_action(report, "install_dependencies")
    checks.check(
        bool(deps.get("ok")) and "Installed into lib/" in deps.get("msg", ""),
        "first pip run installed the missing deps", str(deps.get("msg")))
    guard = find_action(report, "pip_guard")
    checks.check(guard.get("second_run_ok") is False,
                 "second in-process pip invocation was refused")
    checks.check("Restart Archipelago" in guard.get("msg", ""),
                 "refusal carries the restart message", str(guard.get("msg")))
    return checks


def scenario_reinstall(harness) -> CheckList:
    """Running the full install twice without a reset between is idempotent:
    clean re-extract, no duplicate artifacts, deps and world source short-
    circuit, config preserved."""
    checks = CheckList("reinstall")
    harness.reset()
    harness.deploy_installer()

    components = baseline_components(harness)
    actions = [
        {"type": "extract", "components": components, **harness.source_spec()},
        {"type": "install_dependencies"},
        {"type": "install_world_source"},
        {"type": "record_install", "components": components,
         "version": harness.source, "patch_method": "monkey"},
    ]

    gen1, report1 = harness.run_probe("reinstall-first", actions, tag="first")
    checks.check(gen1.returncode == 0, "first install run exits 0")
    checks.check(bool(find_action(report1, "extract").get("ok")),
                 "first extraction succeeded")
    apworlds_first = sorted(
        p.name for p in harness.custom_worlds.glob("*.apworld"))

    gen2, report2 = harness.run_probe("reinstall-second", actions, tag="second")
    checks.check(gen2.returncode == 0, "second install run exits 0")
    extract2 = find_action(report2, "extract")
    checks.check(bool(extract2.get("ok")), "re-extraction succeeded",
                 str(extract2.get("errors")))

    deps2 = find_action(report2, "install_dependencies")
    checks.check("already installed" in deps2.get("msg", ""),
                 "second run: dependencies short-circuit (no pip run)",
                 str(deps2.get("msg")))
    ws2 = find_action(report2, "install_world_source")
    checks.check("already installed" in ws2.get("msg", ""),
                 "second run: world source short-circuits",
                 str(ws2.get("msg")))

    apworlds_second = sorted(
        p.name for p in harness.custom_worlds.glob("*.apworld"))
    checks.check(apworlds_first == apworlds_second,
                 "apworld set unchanged by reinstall",
                 f"{apworlds_first} -> {apworlds_second}")
    checks.check(not (harness.install_dir / "worlds").exists(),
                 "still nothing in a root worlds/ directory")

    config_path = (harness.install_dir
                   / harness.installer_config.CONFIG_FILENAME)
    checks.check(config_path.is_file(), "installer config present")
    if config_path.is_file():
        config = json.loads(config_path.read_text(encoding="utf-8"))
        checks.check(
            config.get("installation", {}).get("components") == components,
            "config still records the installed components")
    return checks


def scenario_uninstall(harness) -> CheckList:
    """Probe-driven uninstall: component locations empty afterwards and
    plain AP generation still works (without export)."""
    checks = CheckList("uninstall")
    extractor = harness.extractor
    harness.reset()
    harness.deploy_installer()

    components = baseline_components(harness)
    gen1, report1 = harness.run_probe("uninstall-arrange", [
        {"type": "extract", "components": components, **harness.source_spec()},
        {"type": "install_dependencies"},
        {"type": "record_install", "components": components,
         "version": harness.source, "patch_method": "monkey"},
    ], tag="arrange")
    checks.check(gen1.returncode == 0, "install (arrange) run exits 0")
    checks.check(bool(find_action(report1, "extract").get("ok")),
                 "arrange extraction succeeded")

    gen2, report2 = harness.run_probe("uninstall-act", [
        {"type": "uninstall"},
        {"type": "list_installed"},
    ], tag="act")
    checks.check(gen2.returncode == 0, "uninstall run exits 0")
    checks.check(bool(find_action(report2, "uninstall").get("ok")),
                 "uninstall reported success")
    leftover = [name for name in
                find_action(report2, "list_installed").get("installed", [])
                if name in components]
    checks.check(not leftover,
                 "no installed components detected after uninstall",
                 str(leftover))

    for name in components:
        comp = extractor.COMPONENTS[name]
        if comp.unsupported_frozen or comp.overlay:
            continue
        if comp.frozen_dest:
            for source_path in comp.source_paths:
                checks.check(
                    not (harness.install_dir / comp.frozen_dest / source_path).exists(),
                    f"{name}: {comp.frozen_dest}/{source_path} removed")
        elif comp.frozen_apworld:
            for source_path in comp.source_paths:
                world = source_path.split("/")[-1]
                checks.check(
                    not (harness.custom_worlds / f"{world}.apworld").exists(),
                    f"{name}: {world}.apworld removed")

    # AP itself must still generate (plain run, no probe, no export)
    gen3 = harness.run_generate(
        harness.stage_probe_player_yaml("post"), "post-uninstall generation")
    checks.check(gen3.returncode == 0,
                 "AP still generates after uninstall",
                 f"rc={gen3.returncode}; tail: {gen3.output[-400:]}")
    checks.check(len(gen3.new_zips) == 1,
                 "post-uninstall run produced an output zip")
    return checks


def scenario_worldgen(harness) -> CheckList:
    """WorldGen worlds (vendored _ext, vanilla rule_builder) and
    toem_rule_builder generate on the frozen install — the
    worldgen-on-vanilla arc's frozen verification."""
    checks = CheckList("worldgen")
    harness.reset()
    harness.deploy_installer()

    components = baseline_components(harness) + ["worldgen_worlds"]
    gen1, report = harness.run_probe("worldgen", [
        {"type": "extract", "components": components, **harness.source_spec()},
        {"type": "install_dependencies"},
        # worldgen rules reference vanilla rule_builder / core helpers that
        # are .pyc-only in library.zip — the exporter needs the downloaded
        # world source to read them (else 'Failed to read source' errors)
        {"type": "install_world_source"},
        {"type": "configure_export", "preset": "minimal-spoilers"},
        {"type": "record_install", "components": components,
         "version": harness.source, "patch_method": "monkey"},
    ])
    checks.check(gen1.returncode == 0, "install run exits 0")
    checks.check(bool(find_action(report, "extract").get("ok")),
                 "extraction succeeded")

    worldgen_apworlds = sorted(
        p.name for p in harness.custom_worlds.glob("*_worldgen.apworld"))
    checks.check(len(worldgen_apworlds) > 0,
                 f"worldgen apworlds packed ({len(worldgen_apworlds)} found)")
    checks.check("dlcquest_worldgen.apworld" in worldgen_apworlds,
                 "dlcquest_worldgen.apworld among them", str(worldgen_apworlds[:8]))

    gen2 = harness.run_generate(
        harness.stage_template_player_yamls(
            ["DLCQuest WorldGen.yaml", "TOEM rule builder.yaml"], "worldgen"),
        "worldgen generation")
    checks.check(gen2.returncode == 0,
                 "worldgen + toem_rule_builder multiworld generates",
                 f"rc={gen2.returncode}; tail: {gen2.output[-400:]}")
    checks.check(len(gen2.new_zips) == 1, "output zip produced")
    if gen2.new_zips:
        with zipfile.ZipFile(gen2.new_zips[-1]) as zf:
            names = zf.namelist()
        checks.check(any(n.endswith("_rules.json") for n in names),
                     "worldgen output zip contains exported rules", str(names))
    # 'Failed to clean source' is EXPECTED here and deliberately not
    # asserted: without the extended rule_builder the export falls back to
    # ast format, which cannot source-analyze Rule Builder Resolved objects
    # ("got Resolved") — a documented fallback degradation, not a frozen
    # regression. Source reads and manifests must still be clean.
    for pattern in BAD_LOG_PATTERNS:
        if pattern == "Failed to clean source":
            continue
        checks.check(pattern not in gen2.all_text,
                     f"worldgen output/logs free of {pattern!r}")
    return checks


def scenario_export_parity(harness) -> CheckList:
    """APQuest (bundled, .pyc-only — exercises the whole world_source
    fallback chain) exported on frozen vs the repo's canonical seed-1
    preset: location totals must match and at most one access rule may be
    untyped (the known named-closure ast-analyzer gap)."""
    checks = CheckList("export-parity")
    harness.reset()
    harness.deploy_installer()

    canonical = sorted((REPO_ROOT / "frontend" / "presets" / "apquest")
                       .glob("AP_*/AP_*_rules.json"))
    if not canonical:
        raise HarnessError("no canonical APQuest preset in the repo to "
                           "compare against")
    source_rules = json.loads(canonical[0].read_text(encoding="utf-8"))
    source_counts = count_location_rules(source_rules)

    components = [name for name in harness.extractor.COMPONENTS
                  if name in harness.extractor.DEFAULT_COMPONENTS]
    gen1, report = harness.run_probe("export-parity", [
        {"type": "extract", "components": components, **harness.source_spec()},
        {"type": "install_dependencies"},
        {"type": "install_world_source"},
        {"type": "configure_export", "preset": "minimal-spoilers"},
        {"type": "record_install", "components": components,
         "version": harness.source, "patch_method": "monkey"},
    ])
    checks.check(gen1.returncode == 0, "install run exits 0")
    checks.check(bool(find_action(report, "install_world_source").get("ok")),
                 "world source installed")

    gen2 = harness.run_generate(
        harness.stage_probe_player_yaml("parity"), "APQuest generation")
    checks.check(gen2.returncode == 0, "APQuest generates on frozen",
                 f"rc={gen2.returncode}")
    checks.check(len(gen2.new_zips) == 1, "output zip produced")
    if not gen2.new_zips:
        return checks

    frozen_rules = rules_json_from_zip(gen2.new_zips[-1])
    checks.check(frozen_rules is not None,
                 "frozen run exported a rules JSON")
    if frozen_rules is None:
        return checks
    frozen_counts = count_location_rules(frozen_rules)

    checks.check(
        frozen_counts["total"] == source_counts["total"],
        f"location totals match source preset "
        f"(frozen {frozen_counts['total']} vs source {source_counts['total']})")
    # world_source chain broken => every bundled-world rule falls to null.
    # Allowance of 1: named-closure rules are an ast-analyzer limitation
    # identical on source installs, not a frozen gap.
    allowed_gap = 1
    checks.check(
        frozen_counts["null"] <= source_counts["null"] + allowed_gap,
        f"typed-rule parity within allowance "
        f"(frozen null={frozen_counts['null']}, "
        f"source null={source_counts['null']}, allowed gap {allowed_gap})")
    return checks


SCENARIOS: Dict[str, Callable] = {
    "baseline": scenario_baseline,
    "pip-guard": scenario_pip_guard,
    "reinstall": scenario_reinstall,
    "uninstall": scenario_uninstall,
    "worldgen": scenario_worldgen,
    "export-parity": scenario_export_parity,
}


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> int:
    # Line-buffer stdout so progress streams into CI logs / piped files
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except (AttributeError, OSError):
        pass
    parser = argparse.ArgumentParser(
        description="Frozen-install test harness for JSON Tools",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__)
    parser.add_argument(
        "--install-dir", type=Path,
        default=os.environ.get(ENV_INSTALL_DIR),
        help=f"Compiled AP install directory (or set {ENV_INSTALL_DIR})")
    parser.add_argument(
        "--host", choices=["auto", "windows", "wsl"], default="auto",
        help="How to run the frozen exe (default: auto-detect)")
    parser.add_argument(
        "--scenario", nargs="+", default=["baseline"],
        help=f"Scenarios to run (available: {', '.join(SCENARIOS)})")
    parser.add_argument(
        "--source", choices=["dev", "stable", "repo"], default="dev",
        help="Where the installer downloads from (repo = git archive of the "
             "local HEAD, offline)")
    parser.add_argument(
        "--timeout", type=int, default=900,
        help="Per-Generate-run timeout in seconds (default 900) — also the "
             "watchdog that catches the frozen-pip deadlock")
    parser.add_argument(
        "--keep-state", action="store_true",
        help="Do not reset the install after a successful run (failures "
             "always leave state in place for inspection)")
    parser.add_argument(
        "--list-scenarios", action="store_true", help="List scenarios and exit")
    args = parser.parse_args()

    if args.list_scenarios:
        for name, fn in SCENARIOS.items():
            print(f"{name}: {(fn.__doc__ or '').strip().splitlines()[0]}")
        return 0

    if not args.install_dir:
        parser.error(f"--install-dir is required (or set {ENV_INSTALL_DIR})")
    unknown = [s for s in args.scenario if s not in SCENARIOS]
    if unknown:
        parser.error(f"unknown scenario(s): {', '.join(unknown)} "
                     f"(available: {', '.join(SCENARIOS)})")

    install_dir = Path(args.install_dir).resolve()

    try:
        host = select_host(args.host)
        host.validate(install_dir)
        ap_version = validate_install_dir(install_dir)
    except HarnessError as e:
        print(f"[FATAL] {e}")
        return 2

    print(f"Frozen-install harness")
    print(f"  install dir : {install_dir}")
    print(f"  AP version  : {ap_version} (from manifest.json)")
    print(f"  host        : {host.name}")
    print(f"  source      : {args.source}")
    print(f"  scenarios   : {', '.join(args.scenario)}")

    # Heavy import (loads the repo's world registry); deferred to here so
    # --help/--list-scenarios stay fast.
    sys.path.insert(0, str(REPO_ROOT))
    harness = FrozenHarness(install_dir, host, args.source, args.timeout,
                            args.keep_state)

    results: List[CheckList] = []
    all_ok = True
    try:
        for name in args.scenario:
            print(f"\n=== scenario: {name} ===")
            try:
                checks = SCENARIOS[name](harness)
            except HarnessError as e:
                print(f"  [FATAL] {e}")
                checks = CheckList(name)
                checks.failures.append(f"fatal: {e}")
            results.append(checks)
            if not checks.ok:
                all_ok = False
                print(f"  scenario {name}: FAILED "
                      f"({len(checks.failures)} failures, {checks.passed} passed)")
                print("  install left as-is for inspection")
                break  # later scenarios would start from a dirty state
            print(f"  scenario {name}: PASSED ({checks.passed} checks)")
    finally:
        if all_ok and not args.keep_state:
            print("\nAll scenarios passed — resetting install to clean state")
            try:
                harness.reset()
            except Exception as e:
                print(f"  [WARN] final reset failed: {e}")
        harness.cleanup_scratch()

    print("\n=== summary ===")
    for checks in results:
        status = "PASS" if checks.ok else "FAIL"
        print(f"  {checks.scenario}: {status} ({checks.passed} passed, "
              f"{len(checks.failures)} failed)")
        for failure in checks.failures:
            print(f"      - {failure}")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
