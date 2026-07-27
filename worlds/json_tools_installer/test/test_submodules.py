"""Submodule content fetching.

A GitHub branch archive contains NO submodule content — git records a
submodule as a gitlink and the archive omits it — so an install made from
one used to ship a frontend whose core imports (frontend/modules/shared)
resolved to nothing, and the served site died with "Failed to fetch
dynamically imported module: init.js". extract_tools now downloads each
submodule the selected components claim and extracts it into its path.

All expectations derive from COMPONENTS metadata and the parsed
.gitmodules, never literal submodule paths.
"""
import zipfile

import pytest

from worlds.json_tools_installer.config import SourceConfig
from worlds.json_tools_installer.installer import extractor, submodules
from worlds.json_tools_installer.installer.downloader import DownloadResult
from worlds.json_tools_installer.installer.extractor import COMPONENTS

from .sandbox_utils import ARCHIVE_ROOT, build_archive, component_entries

# Components with a plain directory destination: a submodule path under one
# is claimed by it exactly as frontend/modules/* is claimed by 'frontend'.
PLAIN_COMPONENTS = sorted(
    name for name, comp in COMPONENTS.items()
    if comp.source_paths and not comp.frozen_dest and not comp.frozen_apworld
    and not comp.overlay and not comp.unsupported_frozen
    and not comp.clean_before_extract and not comp.user_writable
    and any(not source.endswith(".py") and "." not in source.split("/")[-1]
            for source in comp.source_paths))
HOST_COMPONENT = PLAIN_COMPONENTS[0]
OTHER_COMPONENT = PLAIN_COMPONENTS[1]

SOURCE = SourceConfig("PeerInfinity/Archipelago-CC", "main")
PINNED_SHA = "0123456789abcdef0123456789abcdef01234567"
SUB_REPO = "PeerInfinity/archipelago-shared"
SUB_URL = f"https://github.com/{SUB_REPO}.git"
SUB_BRANCH = "substrate"
DEFAULT_BRANCH = "trunk"


def component_dir(name: str) -> str:
    """A directory-shaped source path of a component."""
    for source_path in COMPONENTS[name].source_paths:
        if "." not in source_path.split("/")[-1]:
            return source_path
    raise AssertionError(f"{name} has no directory-shaped source path")


def submodule_path(component: str) -> str:
    """A submodule path living inside a component's destination."""
    return f"{component_dir(component)}/vendored_sub"


def gitmodules_text(path: str, url: str = SUB_URL, branch: str = SUB_BRANCH) -> str:
    lines = [f'[submodule "{path}"]', f"\tpath = {path}", f"\turl = {url}"]
    if branch:
        lines.append(f"\tbranch = {branch}")
    return "\n".join(lines) + "\n"


class FakeGitHub:
    """Stands in for GitHub: records every URL, serves canned archives."""

    def __init__(self, tmp_path, files, sha=PINNED_SHA,
                 api_answers=True, default_branch=DEFAULT_BRANCH,
                 download_ok=True):
        self.tmp_path = tmp_path
        self.files = files
        self.sha = sha
        self.api_answers = api_answers
        self.default_branch = default_branch
        self.download_ok = download_ok
        self.api_urls = []
        self.download_urls = []

    def github_json(self, url, timeout=30):
        self.api_urls.append(url)
        if not self.api_answers:
            return None
        if "/contents/" in url:
            return {"type": "submodule", "sha": self.sha}
        if self.default_branch:
            return {"default_branch": self.default_branch}
        return None

    def download_once(self, url, dest_path, progress_callback=None):
        self.download_urls.append(url)
        if not self.download_ok:
            return DownloadResult(success=False, error="HTTP error 404: Not Found")
        # GitHub archives nest everything under <repo>-<ref>/
        root = f"{SUB_REPO.split('/')[-1]}-{url.rstrip('.zip').split('/')[-1]}"
        with zipfile.ZipFile(dest_path, "w") as zf:
            for rel, data in self.files.items():
                zf.writestr(f"{root}/{rel}", data)
        return DownloadResult(success=True, filepath=dest_path,
                              size_bytes=dest_path.stat().st_size)

    def install(self, monkeypatch):
        monkeypatch.setattr(submodules, "_github_json", self.github_json)
        monkeypatch.setattr(submodules, "_download_once", self.download_once)
        return self


@pytest.fixture
def sub_files():
    return {"witness.js": b"export const witness = 1;\n",
            "nested/deep.js": b"export const deep = 2;\n"}


def run_extract(tmp_path, entries, components, source=SOURCE, dest=None,
                **kwargs):
    archive = tmp_path / "archive.zip"
    build_archive(archive, entries)
    if dest is None:
        dest = tmp_path / "dest"
    dest.mkdir(exist_ok=True)
    return extractor.extract_tools(archive, components, dest_root=dest,
                                   source=source, **kwargs), dest


# --- .gitmodules parsing ----------------------------------------------------

def test_parse_gitmodules_reads_path_url_and_branch():
    path = submodule_path(HOST_COMPONENT)
    other = submodule_path(OTHER_COMPONENT)
    text = gitmodules_text(path) + gitmodules_text(other, branch="")

    specs = submodules.parse_gitmodules(text)

    assert [s.path for s in specs] == [path, other]
    assert specs[0].branch == SUB_BRANCH
    assert specs[1].branch is None
    assert all(s.url == SUB_URL for s in specs)


def test_parse_gitmodules_ignores_comments_and_incomplete_entries():
    path = submodule_path(HOST_COMPONENT)
    text = (
        "# a comment\n"
        '[submodule "no-url"]\n\tpath = somewhere\n'
        '[submodule "no-path"]\n\turl = https://github.com/o/r.git\n'
        + gitmodules_text(path)
    )

    specs = submodules.parse_gitmodules(text)

    assert [s.path for s in specs] == [path]


def test_read_gitmodules_returns_none_when_the_archive_has_none(tmp_path):
    """The stable source predates the submodule split; nothing to fetch."""
    archive = tmp_path / "archive.zip"
    build_archive(archive, component_entries([HOST_COMPONENT]))

    with zipfile.ZipFile(archive) as zf:
        assert submodules.read_gitmodules(zf, ARCHIVE_ROOT) is None


def test_read_gitmodules_reads_it_from_under_the_archive_root(tmp_path):
    path = submodule_path(HOST_COMPONENT)
    archive = tmp_path / "archive.zip"
    build_archive(archive, {".gitmodules": gitmodules_text(path)})

    with zipfile.ZipFile(archive) as zf:
        content = submodules.read_gitmodules(zf, ARCHIVE_ROOT)

    assert submodules.parse_gitmodules(content)[0].path == path


@pytest.mark.parametrize("url,expected", [
    (f"https://github.com/{SUB_REPO}.git", SUB_REPO),
    (f"https://github.com/{SUB_REPO}", SUB_REPO),
    (f"git@github.com:{SUB_REPO}.git", SUB_REPO),
    (f"ssh://git@github.com/{SUB_REPO}.git", SUB_REPO),
    ("../archipelago-shared.git", "PeerInfinity/archipelago-shared"),
    ("https://gitlab.com/o/r.git", None),
])
def test_github_repo_from_url(url, expected):
    assert submodules.github_repo_from_url(url, SOURCE.repo) == expected


# --- component filtering ----------------------------------------------------

def test_only_submodules_under_a_selected_component_are_fetched(tmp_path,
                                                                monkeypatch,
                                                                sub_files,
                                                                frozen):
    """A submodule under an unselected component is not our business."""
    frozen(False)
    inside = submodule_path(HOST_COMPONENT)
    outside = submodule_path(OTHER_COMPONENT)
    fake = FakeGitHub(tmp_path, sub_files).install(monkeypatch)

    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(inside) + gitmodules_text(outside)
    result, dest = run_extract(tmp_path, entries, [HOST_COMPONENT])

    assert result.success, result.errors
    assert len(result.submodules) == 1
    assert inside in result.submodules[0]
    assert (dest / inside / "witness.js").is_file()
    assert not (dest / outside).exists()


def test_matching_component_claims_the_submodule_path():
    """The claim rule is the extractor's own, not a second copy of it."""
    inside = submodule_path(HOST_COMPONENT)
    specs = submodules.parse_gitmodules(gitmodules_text(inside))

    selected = submodules.submodules_for_components(
        specs, lambda path: extractor.matching_component(path, [HOST_COMPONENT]))

    assert selected == [(specs[0], HOST_COMPONENT)]


# --- extraction -------------------------------------------------------------

def test_submodule_content_lands_in_the_submodule_path(tmp_path, monkeypatch,
                                                       sub_files, frozen):
    frozen(False)
    path = submodule_path(HOST_COMPONENT)
    fake = FakeGitHub(tmp_path, sub_files).install(monkeypatch)

    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(path)
    result, dest = run_extract(tmp_path, entries, [HOST_COMPONENT])

    assert result.success, result.errors
    for rel, data in sub_files.items():
        assert (dest / path / rel).read_bytes() == data
    assert f"{path}/witness.js" in result.extracted_files
    assert result.submodules == [f"{path} @ {PINNED_SHA[:12]} (pinned), "
                                 f"{len(sub_files)} files"]


def test_submodule_files_are_recorded_in_the_install_manifest(tmp_path,
                                                              monkeypatch,
                                                              sub_files,
                                                              frozen):
    """They are the host component's territory, so the next install can
    prune them like any other file it wrote."""
    frozen(False)
    path = submodule_path(HOST_COMPONENT)
    FakeGitHub(tmp_path, sub_files).install(monkeypatch)

    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(path)
    result, dest = run_extract(tmp_path, entries, [HOST_COMPONENT])

    recorded = extractor.load_install_manifest(dest)[HOST_COMPONENT]
    for rel in sub_files:
        assert f"{path}/{rel}" in recorded
    assert f"{path}/witness.js" in result.installed_paths[HOST_COMPONENT]


def test_reinstalling_the_same_source_prunes_nothing(tmp_path, monkeypatch,
                                                     sub_files, frozen):
    frozen(False)
    path = submodule_path(HOST_COMPONENT)
    FakeGitHub(tmp_path, sub_files).install(monkeypatch)
    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(path)

    _, dest = run_extract(tmp_path, entries, [HOST_COMPONENT])
    result, _ = run_extract(tmp_path, entries, [HOST_COMPONENT], dest=dest)

    assert result.removed_files == []
    assert (dest / path / "witness.js").is_file()


def test_a_dropped_submodule_file_is_pruned_on_the_next_install(tmp_path,
                                                                monkeypatch,
                                                                sub_files,
                                                                frozen):
    frozen(False)
    path = submodule_path(HOST_COMPONENT)
    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(path)

    FakeGitHub(tmp_path, sub_files).install(monkeypatch)
    _, dest = run_extract(tmp_path, entries, [HOST_COMPONENT])

    shrunk = {"witness.js": sub_files["witness.js"]}
    FakeGitHub(tmp_path, shrunk).install(monkeypatch)
    result, _ = run_extract(tmp_path, entries, [HOST_COMPONENT], dest=dest)

    assert f"{path}/nested/deep.js" in result.removed_files
    assert not (dest / path / "nested" / "deep.js").exists()
    assert (dest / path / "witness.js").is_file()


def test_a_source_without_gitmodules_fetches_nothing(tmp_path, monkeypatch,
                                                     sub_files, frozen):
    """The stable source predates the submodule split — no-op, no network."""
    frozen(False)
    fake = FakeGitHub(tmp_path, sub_files).install(monkeypatch)

    result, _ = run_extract(tmp_path, component_entries([HOST_COMPONENT]),
                            [HOST_COMPONENT])

    assert result.success, result.errors
    assert result.submodules == []
    assert fake.download_urls == []
    assert fake.api_urls == []


def test_fetch_submodules_can_be_turned_off(tmp_path, monkeypatch, sub_files,
                                            frozen):
    frozen(False)
    path = submodule_path(HOST_COMPONENT)
    fake = FakeGitHub(tmp_path, sub_files).install(monkeypatch)
    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(path)

    result, dest = run_extract(tmp_path, entries, [HOST_COMPONENT],
                               fetch_submodules=False)

    assert fake.download_urls == []
    assert not (dest / path).exists()


# --- ref resolution ---------------------------------------------------------

def test_the_pinned_sha_is_resolved_from_the_source_and_downloaded(
        tmp_path, monkeypatch, sub_files, frozen):
    frozen(False)
    path = submodule_path(HOST_COMPONENT)
    fake = FakeGitHub(tmp_path, sub_files).install(monkeypatch)
    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(path)

    result, _ = run_extract(tmp_path, entries, [HOST_COMPONENT])

    assert fake.api_urls == [submodules.CONTENTS_API_URL.format(
        repo=SOURCE.repo, path=path, ref=SOURCE.branch)]
    assert fake.download_urls == [submodules.SHA_ARCHIVE_URL.format(
        repo=SUB_REPO, ref=PINNED_SHA)]
    assert not [w for w in result.warnings if "submodule" in w]


def test_a_blocked_api_falls_back_to_the_gitmodules_branch(tmp_path,
                                                           monkeypatch,
                                                           sub_files, frozen):
    """Rate-limited or offline: still installable, but the version may skew,
    so it must say so."""
    frozen(False)
    path = submodule_path(HOST_COMPONENT)
    fake = FakeGitHub(tmp_path, sub_files, api_answers=False).install(monkeypatch)
    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(path)

    result, dest = run_extract(tmp_path, entries, [HOST_COMPONENT])

    assert result.success, result.errors
    assert fake.download_urls == [submodules.BRANCH_ARCHIVE_URL.format(
        repo=SUB_REPO, branch=SUB_BRANCH)]
    assert (dest / path / "witness.js").is_file()
    assert any("pinned commit" in w and path in w for w in result.warnings), \
        result.warnings
    assert result.submodules == [f"{path} @ {SUB_BRANCH[:12]} (branch), "
                                 f"{len(sub_files)} files"]


def test_without_a_branch_line_the_fallback_uses_the_default_branch(
        tmp_path, monkeypatch, sub_files, frozen):
    frozen(False)
    path = submodule_path(HOST_COMPONENT)

    class NoContentsApi(FakeGitHub):
        def github_json(self, url, timeout=30):
            self.api_urls.append(url)
            if "/contents/" in url:
                return None  # pin lookup blocked
            return {"default_branch": self.default_branch}

    fake = NoContentsApi(tmp_path, sub_files).install(monkeypatch)
    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(path, branch="")

    result, dest = run_extract(tmp_path, entries, [HOST_COMPONENT])

    assert fake.download_urls == [submodules.BRANCH_ARCHIVE_URL.format(
        repo=SUB_REPO, branch=DEFAULT_BRANCH)]
    assert (dest / path / "witness.js").is_file()


def test_without_a_source_the_fetch_says_the_pin_is_unknown(tmp_path,
                                                            monkeypatch,
                                                            sub_files, frozen):
    """A locally packed archive (git archive) has no repo to query."""
    frozen(False)
    path = submodule_path(HOST_COMPONENT)
    fake = FakeGitHub(tmp_path, sub_files).install(monkeypatch)
    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(path)

    result, dest = run_extract(tmp_path, entries, [HOST_COMPONENT], source=None)

    assert fake.api_urls == []
    assert fake.download_urls == [submodules.BRANCH_ARCHIVE_URL.format(
        repo=SUB_REPO, branch=SUB_BRANCH)]
    assert any("pinned commit is unknown" in w for w in result.warnings), \
        result.warnings


# --- failure handling -------------------------------------------------------

def test_a_failed_fetch_warns_and_keeps_what_is_installed(tmp_path, monkeypatch,
                                                          sub_files, frozen):
    """A transient network failure must not make the prune step read the
    submodule's files as content this source dropped."""
    frozen(False)
    path = submodule_path(HOST_COMPONENT)
    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(path)

    FakeGitHub(tmp_path, sub_files).install(monkeypatch)
    _, dest = run_extract(tmp_path, entries, [HOST_COMPONENT])

    FakeGitHub(tmp_path, sub_files, download_ok=False).install(monkeypatch)
    result, _ = run_extract(tmp_path, entries, [HOST_COMPONENT], dest=dest)

    assert result.success, result.errors
    assert any("Could not install submodule" in w and path in w
               for w in result.warnings), result.warnings
    assert result.removed_files == []
    for rel in sub_files:
        assert (dest / path / rel).is_file()


def test_a_non_github_submodule_is_reported_not_silently_skipped(tmp_path,
                                                                 monkeypatch,
                                                                 sub_files,
                                                                 frozen):
    frozen(False)
    path = submodule_path(HOST_COMPONENT)
    fake = FakeGitHub(tmp_path, sub_files).install(monkeypatch)
    entries = component_entries([HOST_COMPONENT])
    entries[".gitmodules"] = gitmodules_text(
        path, url="https://gitlab.com/other/repo.git")

    result, dest = run_extract(tmp_path, entries, [HOST_COMPONENT])

    assert fake.download_urls == []
    assert any("not a GitHub repository" in w for w in result.warnings), \
        result.warnings
    assert result.submodules == []
