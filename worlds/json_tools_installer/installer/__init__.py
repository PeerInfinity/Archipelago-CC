"""
Installer module for JSON Tools.

Provides functionality for:
- Detecting Archipelago version
- Downloading tools from GitHub
- Extracting and installing files
- Patching core files with backup/restore
"""

from .version_detector import (
    detect_ap_version,
    get_version_support_status,
    is_version_supported,
    VersionInfo,
)
from .downloader import (
    download_archive,
    get_download_url,
)
from .extractor import (
    extract_tools,
    get_extractable_components,
)
from .patcher import (
    apply_patches,
    revert_patches,
    check_patch_status,
)

__all__ = [
    "detect_ap_version",
    "get_version_support_status",
    "is_version_supported",
    "VersionInfo",
    "download_archive",
    "get_download_url",
    "extract_tools",
    "get_extractable_components",
    "apply_patches",
    "revert_patches",
    "check_patch_status",
]
