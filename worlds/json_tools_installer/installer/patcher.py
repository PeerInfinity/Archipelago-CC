"""
File patcher for JSON Tools.

Handles patching core Archipelago files with backup and restore capability.
"""

import hashlib
import shutil
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from Utils import local_path

from ..config import (
    InstallerConfig, BackupInfo, add_backup_info, load_config, save_config
)
from .version_detector import detect_ap_version, SupportLevel


# Files that need to be patched
PATCH_FILES = [
    "Main.py",
    "BaseClasses.py",
    "settings.py",
]


@dataclass
class PatchStatus:
    """Status of patches for a single file."""
    filename: str
    is_patched: bool
    has_backup: bool
    backup_path: Optional[str] = None
    original_hash: Optional[str] = None
    current_hash: Optional[str] = None


@dataclass
class PatchResult:
    """Result of a patch operation."""
    success: bool
    patched_files: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def get_file_hash(filepath: Path) -> str:
    """Calculate SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def check_patch_status(config: Optional[InstallerConfig] = None) -> Dict[str, PatchStatus]:
    """
    Check the current patch status of all core files.

    Args:
        config: Installer configuration (loaded if not provided).

    Returns:
        Dictionary mapping filename to PatchStatus.
    """
    if config is None:
        config = load_config()

    root = Path(local_path())
    status = {}

    # Build backup lookup
    backup_lookup = {b.path: b for b in config.patches.backups}

    for filename in PATCH_FILES:
        filepath = root / filename
        backup_info = backup_lookup.get(filename)

        if not filepath.exists():
            status[filename] = PatchStatus(
                filename=filename,
                is_patched=False,
                has_backup=False,
            )
            continue

        current_hash = get_file_hash(filepath)

        if backup_info:
            # We have backup info - check if current differs from original
            is_patched = current_hash != backup_info.original_hash
            backup_path = Path(backup_info.backup_path)
            has_backup = backup_path.exists()
        else:
            # No backup info - assume not patched
            is_patched = False
            has_backup = False

        status[filename] = PatchStatus(
            filename=filename,
            is_patched=is_patched,
            has_backup=has_backup,
            backup_path=backup_info.backup_path if backup_info else None,
            original_hash=backup_info.original_hash if backup_info else None,
            current_hash=current_hash,
        )

    return status


def backup_file(filepath: Path, config: InstallerConfig) -> Optional[str]:
    """
    Create a backup of a file.

    Args:
        filepath: Path to the file to backup.
        config: Installer configuration.

    Returns:
        Path to the backup file, or None if failed.
    """
    if not filepath.exists():
        return None

    # Calculate original hash
    original_hash = get_file_hash(filepath)

    # Determine backup path
    backup_dir = Path(local_path()) / "json_tools_backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Use timestamp to allow multiple backups
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"{filepath.name}.{timestamp}.backup"

    # Check if we already have a backup with the same hash
    for existing_backup in config.patches.backups:
        if existing_backup.path == filepath.name:
            if existing_backup.original_hash == original_hash:
                # Same file, no need to backup again
                return existing_backup.backup_path

    # Create backup
    shutil.copy2(filepath, backup_path)

    # Record in config
    add_backup_info(
        config,
        path=filepath.name,
        original_hash=original_hash,
        backup_path=str(backup_path),
    )

    return str(backup_path)


def apply_patches(
    archive_path: Path,
    config: Optional[InstallerConfig] = None,
    force: bool = False,
) -> PatchResult:
    """
    Apply patches from a downloaded archive.

    This extracts the patched versions of core files from the archive
    and replaces the originals (after backing them up).

    Args:
        archive_path: Path to the downloaded archive.
        config: Installer configuration.
        force: If True, overwrite even if already patched.

    Returns:
        PatchResult with status information.
    """
    if config is None:
        config = load_config()

    result = PatchResult(success=True)
    root = Path(local_path())

    # Check version compatibility
    version_info = detect_ap_version()
    if version_info.support_level == SupportLevel.UNSUPPORTED:
        result.success = False
        result.errors.append(
            f"AP version {version_info.version_string} is not supported"
        )
        return result

    if version_info.support_level == SupportLevel.EXPERIMENTAL:
        result.warnings.append(
            f"AP version {version_info.version_string} is untested, patches may not work"
        )

    try:
        with zipfile.ZipFile(archive_path, "r") as zf:
            # Find archive root
            all_files = zf.namelist()
            archive_root = ""
            if all_files:
                first_part = all_files[0].split("/")[0]
                if all(f.startswith(first_part + "/") for f in all_files if f):
                    archive_root = first_part

            for filename in PATCH_FILES:
                # Find the patched file in archive
                archive_file_path = f"{archive_root}/{filename}" if archive_root else filename

                if archive_file_path not in all_files:
                    result.warnings.append(f"Patched {filename} not found in archive")
                    continue

                target_path = root / filename

                # Check current status
                if target_path.exists():
                    current_status = check_patch_status(config).get(filename)

                    if current_status and current_status.is_patched and not force:
                        result.warnings.append(f"{filename} already patched, skipping")
                        continue

                    # Backup original
                    backup_path = backup_file(target_path, config)
                    if backup_path:
                        result.patched_files.append(f"{filename} (backed up to {backup_path})")
                    else:
                        result.warnings.append(f"Could not backup {filename}")

                # Extract patched file
                with zf.open(archive_file_path) as src:
                    with open(target_path, "wb") as dst:
                        shutil.copyfileobj(src, dst)

                if filename not in [p.split(" ")[0] for p in result.patched_files]:
                    result.patched_files.append(filename)

    except zipfile.BadZipFile as e:
        result.success = False
        result.errors.append(f"Invalid archive: {str(e)}")
    except Exception as e:
        result.success = False
        result.errors.append(f"Patch failed: {str(e)}")

    # Update config
    if result.success and result.patched_files:
        config.patches.method = "file"
        config.patches.applied_at = datetime.now().isoformat()
        save_config(config)

    return result


def revert_patches(config: Optional[InstallerConfig] = None) -> PatchResult:
    """
    Revert all patches by restoring from backups.

    Args:
        config: Installer configuration.

    Returns:
        PatchResult with status information.
    """
    if config is None:
        config = load_config()

    result = PatchResult(success=True)
    root = Path(local_path())

    if not config.patches.backups:
        result.warnings.append("No backups found, nothing to revert")
        return result

    for backup_info in config.patches.backups:
        backup_path = Path(backup_info.backup_path)
        target_path = root / backup_info.path

        if not backup_path.exists():
            result.errors.append(f"Backup not found: {backup_path}")
            result.success = False
            continue

        try:
            # Restore from backup
            shutil.copy2(backup_path, target_path)
            result.patched_files.append(f"Restored {backup_info.path}")

            # Optionally remove backup
            # backup_path.unlink()

        except Exception as e:
            result.errors.append(f"Failed to restore {backup_info.path}: {str(e)}")
            result.success = False

    # Clear patch info from config
    if result.success:
        config.patches.backups = []
        config.patches.applied_at = None
        save_config(config)

    return result


def get_patch_summary(config: Optional[InstallerConfig] = None) -> Dict[str, any]:
    """
    Get a summary of the current patch state.

    Returns:
        Dictionary with patch summary information.
    """
    if config is None:
        config = load_config()

    status = check_patch_status(config)

    patched_count = sum(1 for s in status.values() if s.is_patched)
    backup_count = sum(1 for s in status.values() if s.has_backup)

    return {
        "total_files": len(PATCH_FILES),
        "patched_count": patched_count,
        "backup_count": backup_count,
        "all_patched": patched_count == len(PATCH_FILES),
        "can_revert": backup_count > 0,
        "method": config.patches.method,
        "applied_at": config.patches.applied_at,
        "files": status,
    }
