"""
Configuration management for JSON Tools Installer.

Handles loading/saving installer configuration and tracking installation state.
"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from Utils import user_path


# Default configuration values
DEFAULT_STABLE_REPO = "PeerInfinity/Archipelago"
DEFAULT_STABLE_BRANCH = "JSONExport"
DEFAULT_DEV_REPO = "PeerInfinity/Archipelago-CC"
DEFAULT_DEV_BRANCH = "main"

CONFIG_FILENAME = "json_tools_config.json"


@dataclass
class SourceConfig:
    """Configuration for a download source."""
    repo: str
    branch: str

    def to_dict(self) -> Dict[str, str]:
        return {"repo": self.repo, "branch": self.branch}

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "SourceConfig":
        return cls(repo=data.get("repo", ""), branch=data.get("branch", ""))


@dataclass
class BackupInfo:
    """Information about a backed up file."""
    path: str
    original_hash: str
    backup_path: str
    backed_up_at: str


@dataclass
class InstallationInfo:
    """Information about current installation."""
    version: str = "stable"  # "stable" or "dev"
    components: List[str] = field(default_factory=lambda: ["core", "scripts"])
    installed_at: Optional[str] = None
    commit_hash: Optional[str] = None
    source_repo: Optional[str] = None
    source_branch: Optional[str] = None


@dataclass
class PatchInfo:
    """Information about applied patches."""
    method: str = "file"  # "file" or "monkey"
    backups: List[BackupInfo] = field(default_factory=list)
    applied_at: Optional[str] = None
    romless_applied: bool = False
    romless_applied_at: Optional[str] = None


@dataclass
class InstallerConfig:
    """Main configuration for JSON Tools Installer."""
    stable_source: SourceConfig = field(
        default_factory=lambda: SourceConfig(DEFAULT_STABLE_REPO, DEFAULT_STABLE_BRANCH)
    )
    dev_source: SourceConfig = field(
        default_factory=lambda: SourceConfig(DEFAULT_DEV_REPO, DEFAULT_DEV_BRANCH)
    )
    installation: InstallationInfo = field(default_factory=InstallationInfo)
    patches: PatchInfo = field(default_factory=PatchInfo)

    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary for JSON serialization."""
        return {
            "sources": {
                "stable": self.stable_source.to_dict(),
                "dev": self.dev_source.to_dict(),
            },
            "installation": {
                "version": self.installation.version,
                "components": self.installation.components,
                "installed_at": self.installation.installed_at,
                "commit_hash": self.installation.commit_hash,
                "source_repo": self.installation.source_repo,
                "source_branch": self.installation.source_branch,
            },
            "patches": {
                "method": self.patches.method,
                "backups": [asdict(b) for b in self.patches.backups],
                "applied_at": self.patches.applied_at,
                "romless_applied": self.patches.romless_applied,
                "romless_applied_at": self.patches.romless_applied_at,
            },
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InstallerConfig":
        """Create config from dictionary."""
        config = cls()

        sources = data.get("sources", {})
        if "stable" in sources:
            config.stable_source = SourceConfig.from_dict(sources["stable"])
        if "dev" in sources:
            config.dev_source = SourceConfig.from_dict(sources["dev"])

        installation = data.get("installation", {})
        config.installation = InstallationInfo(
            version=installation.get("version", "stable"),
            components=installation.get("components", ["core", "scripts"]),
            installed_at=installation.get("installed_at"),
            commit_hash=installation.get("commit_hash"),
            source_repo=installation.get("source_repo"),
            source_branch=installation.get("source_branch"),
        )

        patches = data.get("patches", {})
        backups = [
            BackupInfo(**b) for b in patches.get("backups", [])
        ]
        config.patches = PatchInfo(
            method=patches.get("method", "file"),
            backups=backups,
            applied_at=patches.get("applied_at"),
            romless_applied=patches.get("romless_applied", False),
            romless_applied_at=patches.get("romless_applied_at"),
        )

        return config

    def get_source(self, version: str = None) -> SourceConfig:
        """Get the source configuration for the specified version."""
        if version is None:
            version = self.installation.version
        if version == "dev":
            return self.dev_source
        return self.stable_source


def get_config_path() -> Path:
    """Get the path to the configuration file."""
    return Path(user_path(CONFIG_FILENAME))


def load_config() -> InstallerConfig:
    """Load configuration from file, or return defaults if not found."""
    config_path = get_config_path()
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return InstallerConfig.from_dict(data)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            print(f"Warning: Failed to load config, using defaults: {e}")
    return InstallerConfig()


def save_config(config: InstallerConfig) -> None:
    """Save configuration to file."""
    config_path = get_config_path()
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config.to_dict(), f, indent=2)


def update_installation_info(
    config: InstallerConfig,
    version: str,
    components: List[str],
    commit_hash: Optional[str] = None,
) -> None:
    """Update installation information in config."""
    source = config.get_source(version)
    config.installation = InstallationInfo(
        version=version,
        components=components,
        installed_at=datetime.now().isoformat(),
        commit_hash=commit_hash,
        source_repo=source.repo,
        source_branch=source.branch,
    )
    save_config(config)


def add_backup_info(
    config: InstallerConfig,
    path: str,
    original_hash: str,
    backup_path: str,
) -> None:
    """Add backup information to config."""
    backup = BackupInfo(
        path=path,
        original_hash=original_hash,
        backup_path=backup_path,
        backed_up_at=datetime.now().isoformat(),
    )
    # Remove any existing backup for the same path
    config.patches.backups = [
        b for b in config.patches.backups if b.path != path
    ]
    config.patches.backups.append(backup)
    config.patches.applied_at = datetime.now().isoformat()
    save_config(config)


def clear_installation(config: InstallerConfig) -> None:
    """Clear installation information (for uninstall)."""
    config.installation = InstallationInfo()
    config.patches = PatchInfo()
    save_config(config)
