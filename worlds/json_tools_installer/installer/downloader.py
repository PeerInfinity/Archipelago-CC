"""
Download manager for JSON Tools.

Handles downloading archives from GitHub repositories.
"""

import tempfile
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Callable
from dataclasses import dataclass

from ..config import SourceConfig


@dataclass
class DownloadResult:
    """Result of a download operation."""
    success: bool
    filepath: Optional[Path] = None
    error: Optional[str] = None
    size_bytes: int = 0


def get_download_url(source: SourceConfig) -> str:
    """
    Get the download URL for a GitHub archive.

    Args:
        source: Source configuration with repo and branch.

    Returns:
        URL to download the zip archive.
    """
    return f"https://github.com/{source.repo}/archive/refs/heads/{source.branch}.zip"


def download_archive(
    source: SourceConfig,
    dest_path: Optional[Path] = None,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> DownloadResult:
    """
    Download a repository archive from GitHub.

    Args:
        source: Source configuration with repo and branch.
        dest_path: Destination path for the downloaded file.
                   If None, uses a temporary file.
        progress_callback: Optional callback(downloaded_bytes, total_bytes)
                          for progress updates.

    Returns:
        DownloadResult with success status and filepath or error.
    """
    url = get_download_url(source)

    try:
        # Create request with user agent to avoid blocks
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "Archipelago-JSON-Tools-Installer/1.0"}
        )

        # Determine destination
        if dest_path is None:
            # Use temp file
            fd, temp_path = tempfile.mkstemp(suffix=".zip")
            dest_path = Path(temp_path)
            import os
            os.close(fd)
        else:
            dest_path = Path(dest_path)
            dest_path.parent.mkdir(parents=True, exist_ok=True)

        # Download with progress tracking
        with urllib.request.urlopen(request, timeout=60) as response:
            total_size = int(response.headers.get("Content-Length", 0))
            downloaded = 0
            chunk_size = 8192

            with open(dest_path, "wb") as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if progress_callback:
                        progress_callback(downloaded, total_size)

        return DownloadResult(
            success=True,
            filepath=dest_path,
            size_bytes=downloaded,
        )

    except urllib.error.HTTPError as e:
        return DownloadResult(
            success=False,
            error=f"HTTP error {e.code}: {e.reason}",
        )
    except urllib.error.URLError as e:
        return DownloadResult(
            success=False,
            error=f"URL error: {e.reason}",
        )
    except Exception as e:
        return DownloadResult(
            success=False,
            error=f"Download failed: {str(e)}",
        )


def get_latest_commit_hash(source: SourceConfig) -> Optional[str]:
    """
    Get the latest commit hash for a branch.

    Uses GitHub API to fetch the latest commit SHA.

    Args:
        source: Source configuration with repo and branch.

    Returns:
        Commit SHA string, or None if failed.
    """
    api_url = f"https://api.github.com/repos/{source.repo}/commits/{source.branch}"

    try:
        request = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": "Archipelago-JSON-Tools-Installer/1.0",
                "Accept": "application/vnd.github.v3+json",
            }
        )

        with urllib.request.urlopen(request, timeout=30) as response:
            import json
            data = json.loads(response.read().decode("utf-8"))
            return data.get("sha")

    except Exception:
        return None


def check_connectivity() -> bool:
    """
    Check if we can reach GitHub.

    Returns:
        True if GitHub is reachable, False otherwise.
    """
    try:
        request = urllib.request.Request(
            "https://api.github.com",
            headers={"User-Agent": "Archipelago-JSON-Tools-Installer/1.0"}
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status == 200
    except Exception:
        return False
