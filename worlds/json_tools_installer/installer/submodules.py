"""
Submodule content fetcher for JSON Tools.

A GitHub branch archive (``/archive/refs/heads/<branch>.zip``, what
downloader.py fetches) contains NO submodule content: git records a
submodule as a gitlink, and the archive simply omits it. The fork keeps
every frontend substrate in a submodule under frontend/modules/, so an
install made from such an archive ships a frontend whose core imports
(frontend/modules/shared/*) resolve to nothing — the served site dies with
"Failed to fetch dynamically imported module: init.js", because a
transitive-import 404 is reported against the top-level dynamic import.

The fix is a second download per submodule. The version that must be
installed is the one the outer commit PINS, so the pinned SHA is resolved
through the GitHub contents API (a submodule path there answers with
``{"type": "submodule", "sha": ...}``) and that SHA is downloaded as its
own archive. When the API is unreachable or rate-limited the .gitmodules
branch (or the submodule repo's default branch) is used instead, with a
warning: that content is installable but may skew from the pin.

Sources predating the submodule split have no .gitmodules at all, in which
case there is nothing to do.
"""

import json
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

from ..config import SourceConfig

from .downloader import _download_once

GITMODULES_NAME = ".gitmodules"

# Pinned-SHA lookup: a submodule path answers with type "submodule"
CONTENTS_API_URL = "https://api.github.com/repos/{repo}/contents/{path}?ref={ref}"
REPO_API_URL = "https://api.github.com/repos/{repo}"

# Archives: a SHA is a valid archive ref; branches go through refs/heads
SHA_ARCHIVE_URL = "https://github.com/{repo}/archive/{ref}.zip"
BRANCH_ARCHIVE_URL = "https://github.com/{repo}/archive/refs/heads/{branch}.zip"

# Branch used when neither the pinned SHA nor a .gitmodules branch is known
# and the repository's default branch cannot be read
LAST_RESORT_BRANCH = "main"

GITHUB_URL_PREFIXES = (
    "https://github.com/",
    "http://github.com/",
    "git://github.com/",
    "ssh://git@github.com/",
    "git@github.com:",
)


@dataclass
class SubmoduleSpec:
    """One .gitmodules entry."""
    path: str
    url: str
    branch: Optional[str] = None


@dataclass
class SubmoduleFetch:
    """Outcome of fetching one submodule's content."""
    spec: SubmoduleSpec
    component: str
    archive_path: Optional[Path] = None
    ref: Optional[str] = None
    # True when ref is the SHA the outer commit pins (not a branch tip)
    pinned: bool = False
    size_bytes: int = 0
    warnings: List[str] = field(default_factory=list)
    error: Optional[str] = None

    @property
    def summary(self) -> str:
        ref = (self.ref or "?")[:12]
        kind = "pinned" if self.pinned else "branch"
        return f"{self.spec.path} @ {ref} ({kind})"


def parse_gitmodules(content: str) -> List[SubmoduleSpec]:
    """
    Parse a .gitmodules file into submodule specs.

    Entries without both a path and a url are ignored (git treats them as
    incomplete too). Keys other than path/url/branch are not needed here.

    Args:
        content: Text of the .gitmodules file.

    Returns:
        One SubmoduleSpec per usable entry, in file order.
    """
    entries: List[Dict[str, str]] = []
    current: Optional[Dict[str, str]] = None

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith(";"):
            continue
        if line.startswith("["):
            if current is not None:
                entries.append(current)
            current = {}
            continue
        if current is None or "=" not in line:
            continue
        key, _, value = line.partition("=")
        current[key.strip().lower()] = value.strip()

    if current is not None:
        entries.append(current)

    return [
        SubmoduleSpec(
            path=entry["path"].strip("/"),
            url=entry["url"],
            branch=entry.get("branch") or None,
        )
        for entry in entries
        if entry.get("path") and entry.get("url")
    ]


def read_gitmodules(zf: zipfile.ZipFile, archive_root: str = "") -> Optional[str]:
    """
    Read .gitmodules out of an opened source archive.

    Returns None when the archive has none — a source predating the
    submodule split, where there is nothing to fetch.
    """
    name = f"{archive_root}/{GITMODULES_NAME}" if archive_root else GITMODULES_NAME
    try:
        return zf.read(name).decode("utf-8")
    except (KeyError, UnicodeDecodeError):
        return None


def github_repo_from_url(url: str, parent_repo: Optional[str] = None) -> Optional[str]:
    """
    Resolve a submodule url to an "owner/repo" GitHub pair.

    Relative urls (the form git resolves against the parent's remote) are
    resolved against parent_repo. Non-GitHub hosts return None — this
    installer can only fetch archives from GitHub.
    """
    text = url.strip()

    if text.startswith("./") or text.startswith("../"):
        if not parent_repo:
            return None
        # git resolves these against the parent's remote; PurePosixPath does
        # not collapse '..', so walk the components by hand
        walked: List[str] = []
        for part in f"{parent_repo}/{text}".split("/"):
            if part in ("", "."):
                continue
            if part == "..":
                if walked:
                    walked.pop()
                continue
            walked.append(part)
        text = "/".join(walked)
    else:
        for prefix in GITHUB_URL_PREFIXES:
            if text.startswith(prefix):
                text = text[len(prefix):]
                break
        else:
            return None

    if text.endswith(".git"):
        text = text[:-4]
    parts = [p for p in text.strip("/").split("/") if p]
    if len(parts) != 2:
        return None
    return "/".join(parts)


def submodules_for_components(
    specs: List[SubmoduleSpec],
    matcher: Callable[[str], Optional[str]],
) -> List[Tuple[SubmoduleSpec, str]]:
    """
    Keep only the submodules that live inside a component being installed.

    Args:
        specs: All entries parsed from .gitmodules.
        matcher: Maps an archive-relative path to the selected component
            claiming it, or None (extractor.matching_component bound to the
            selected component list).

    Returns:
        (spec, component name) pairs, in .gitmodules order.
    """
    selected: List[Tuple[SubmoduleSpec, str]] = []
    for spec in specs:
        component = matcher(spec.path)
        if component:
            selected.append((spec, component))
    return selected


def _github_json(url: str, timeout: int = 30) -> Optional[dict]:
    """GET a GitHub API endpoint, or None on any failure."""
    try:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Archipelago-JSON-Tools-Installer/1.0",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
        return data if isinstance(data, dict) else None
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError, OSError):
        return None


def resolve_pinned_sha(source: SourceConfig, path: str) -> Optional[str]:
    """
    Get the submodule commit the outer source pins at path.

    The contents API reports a gitlink as {"type": "submodule", "sha": ...},
    where the sha is the commit in the SUBMODULE's repository.

    Returns:
        The pinned SHA, or None when the API cannot answer (offline, rate
        limited, private repo, or the path is not a submodule there).
    """
    url = CONTENTS_API_URL.format(
        repo=source.repo, path=path, ref=source.branch)
    data = _github_json(url)
    if not data or data.get("type") != "submodule":
        return None
    sha = data.get("sha")
    return sha if isinstance(sha, str) and sha else None


def resolve_default_branch(repo: str) -> Optional[str]:
    """Get a repository's default branch, or None if it cannot be read."""
    data = _github_json(REPO_API_URL.format(repo=repo))
    if not data:
        return None
    branch = data.get("default_branch")
    return branch if isinstance(branch, str) and branch else None


def resolve_submodule_ref(
    spec: SubmoduleSpec,
    repo: str,
    source: Optional[SourceConfig],
) -> Tuple[str, bool, List[str]]:
    """
    Decide which ref of a submodule repository to download.

    Preference order: the SHA the outer source pins, then the .gitmodules
    branch, then the submodule repository's default branch, then 'main'.
    Everything below the pinned SHA is a fallback that may install content
    the outer commit was never tested against, so each one warns.

    Returns:
        (ref, pinned, warnings).
    """
    warnings: List[str] = []

    if source is not None:
        sha = resolve_pinned_sha(source, spec.path)
        if sha:
            return sha, True, warnings
        warnings.append(
            f"Could not resolve the pinned commit for submodule "
            f"'{spec.path}' from {source.repo}@{source.branch} (GitHub API "
            f"unreachable or rate-limited); falling back to a branch, whose "
            f"content may differ from the version this source was built with"
        )
    else:
        warnings.append(
            f"No source repository given for submodule '{spec.path}', so its "
            f"pinned commit is unknown; falling back to a branch, whose "
            f"content may differ from the version this source was built with"
        )

    if spec.branch:
        return spec.branch, False, warnings

    default_branch = resolve_default_branch(repo)
    if default_branch:
        return default_branch, False, warnings

    warnings.append(
        f"Could not read the default branch of '{repo}'; "
        f"trying '{LAST_RESORT_BRANCH}'"
    )
    return LAST_RESORT_BRANCH, False, warnings


def submodule_archive_url(repo: str, ref: str, pinned: bool) -> str:
    """Archive url for a submodule ref (a SHA is a ref of its own)."""
    if pinned:
        return SHA_ARCHIVE_URL.format(repo=repo, ref=ref)
    return BRANCH_ARCHIVE_URL.format(repo=repo, branch=ref)


def fetch_submodule(
    spec: SubmoduleSpec,
    component: str,
    source: Optional[SourceConfig],
    dest_dir: Path,
    progress_callback: Optional[Callable[[int, int], None]] = None,
    max_retries: int = 3,
) -> SubmoduleFetch:
    """
    Download one submodule's archive.

    Args:
        spec: The .gitmodules entry.
        component: Component whose destination contains this submodule.
        source: Outer source, used to resolve the pinned SHA (None skips
            straight to the branch fallback).
        dest_dir: Directory to write the archive into.
        progress_callback: Optional callback(downloaded_bytes, total_bytes).
        max_retries: Download attempts before giving up.

    Returns:
        SubmoduleFetch with the archive path, or an error.
    """
    fetch = SubmoduleFetch(spec=spec, component=component)

    repo = github_repo_from_url(
        spec.url, source.repo if source is not None else None)
    if not repo:
        fetch.error = (
            f"submodule url {spec.url!r} is not a GitHub repository, so its "
            f"content cannot be downloaded"
        )
        return fetch

    ref, pinned, warnings = resolve_submodule_ref(spec, repo, source)
    fetch.ref = ref
    fetch.pinned = pinned
    fetch.warnings.extend(warnings)

    url = submodule_archive_url(repo, ref, pinned)
    archive_path = Path(dest_dir) / f"{spec.path.replace('/', '_')}.zip"
    archive_path.parent.mkdir(parents=True, exist_ok=True)

    result = None
    for _ in range(max_retries):
        result = _download_once(url, archive_path, progress_callback)
        if result.success:
            break
    if result is None or not result.success:
        error = result.error if result else "no download attempted"
        fetch.error = f"download of {url} failed: {error}"
        return fetch

    fetch.archive_path = archive_path
    fetch.size_bytes = result.size_bytes
    return fetch


def fetch_submodules(
    selected: List[Tuple[SubmoduleSpec, str]],
    source: Optional[SourceConfig],
    dest_dir: Path,
    progress_callback: Optional[Callable[[str, int, int], None]] = None,
    max_retries: int = 3,
) -> List[SubmoduleFetch]:
    """
    Download every selected submodule's archive.

    Args:
        selected: (spec, component) pairs from submodules_for_components.
        source: Outer source configuration (see fetch_submodule).
        dest_dir: Directory to write the archives into.
        progress_callback: Optional callback(path, index, count), called
            once per submodule before its download starts.
        max_retries: Download attempts per submodule.

    Returns:
        One SubmoduleFetch per entry, successes and failures alike.
    """
    fetches: List[SubmoduleFetch] = []
    total = len(selected)
    for index, (spec, component) in enumerate(selected, start=1):
        if progress_callback:
            progress_callback(spec.path, index, total)
        fetches.append(fetch_submodule(
            spec, component, source, dest_dir, max_retries=max_retries))
    return fetches
