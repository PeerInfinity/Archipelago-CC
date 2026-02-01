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
    method: str = "monkey"  # "none", "monkey", or "file"
    backups: List[BackupInfo] = field(default_factory=list)
    applied_at: Optional[str] = None
    romless_applied: bool = False
    romless_applied_at: Optional[str] = None


@dataclass
class ExportSettings:
    """
    Export settings used when host.yaml doesn't have these options.

    These settings mirror the GeneralOptions settings from the fork's settings.py.
    When running with monkey patching on vanilla Archipelago, these settings
    serve as the configuration source since vanilla AP doesn't have these options.
    """
    save_rules_json: bool = False
    rules_json_format: str = "rule_builder"  # "rule_builder", "ast", "both"
    skip_preset_copy_if_rules_identical: bool = False
    save_sphere_log: bool = False
    verbose_sphere_log: bool = False
    extend_sphere_log_to_all_locations: bool = False
    log_fractional_sphere_details: bool = True
    log_integer_sphere_details: bool = False
    auto_collect_events: bool = False
    filter_event_items: bool = False
    update_frontend_presets: bool = False
    skip_export_for_native_ut: bool = False
    skip_export_from_list: bool = False


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
    export_settings: ExportSettings = field(default_factory=ExportSettings)

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
            "export_settings": asdict(self.export_settings),
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
            method=patches.get("method", "monkey"),
            backups=backups,
            applied_at=patches.get("applied_at"),
            romless_applied=patches.get("romless_applied", False),
            romless_applied_at=patches.get("romless_applied_at"),
        )

        export_settings = data.get("export_settings", {})
        config.export_settings = ExportSettings(
            save_rules_json=export_settings.get("save_rules_json", False),
            rules_json_format=export_settings.get("rules_json_format", "rule_builder"),
            skip_preset_copy_if_rules_identical=export_settings.get("skip_preset_copy_if_rules_identical", False),
            save_sphere_log=export_settings.get("save_sphere_log", False),
            verbose_sphere_log=export_settings.get("verbose_sphere_log", False),
            extend_sphere_log_to_all_locations=export_settings.get("extend_sphere_log_to_all_locations", False),
            log_fractional_sphere_details=export_settings.get("log_fractional_sphere_details", True),
            log_integer_sphere_details=export_settings.get("log_integer_sphere_details", False),
            auto_collect_events=export_settings.get("auto_collect_events", False),
            filter_event_items=export_settings.get("filter_event_items", False),
            update_frontend_presets=export_settings.get("update_frontend_presets", False),
            skip_export_for_native_ut=export_settings.get("skip_export_for_native_ut", False),
            skip_export_from_list=export_settings.get("skip_export_from_list", False),
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


def get_export_setting(setting_name: str, default: Any = None) -> Any:
    """
    Get an export setting, checking host.yaml first then falling back to installer config.

    This function provides a unified way to access export settings that works both
    on the full fork (where settings are in host.yaml) and on vanilla Archipelago
    with monkey patching (where settings come from the installer's config).

    Args:
        setting_name: The name of the setting (e.g., 'save_rules_json')
        default: Default value if setting is not found in either location

    Returns:
        The setting value from host.yaml if available, otherwise from installer config,
        or the default if neither has the setting.
    """
    # First, try to get from host.yaml's general_options
    try:
        from settings import get_settings
        settings = get_settings()
        if hasattr(settings, 'general_options'):
            value = getattr(settings.general_options, setting_name, None)
            if value is not None:
                return value
    except (ImportError, AttributeError):
        pass

    # Fall back to installer config
    try:
        config = load_config()
        if hasattr(config.export_settings, setting_name):
            return getattr(config.export_settings, setting_name)
    except Exception:
        pass

    return default


def get_all_export_settings() -> ExportSettings:
    """
    Get all export settings as an ExportSettings object.

    This merges settings from host.yaml (if available) with fallback to installer config.
    Settings from host.yaml take precedence.

    Returns:
        An ExportSettings object with values from the appropriate source.
    """
    # Start with installer config defaults
    config = load_config()
    result = ExportSettings(
        save_rules_json=config.export_settings.save_rules_json,
        rules_json_format=config.export_settings.rules_json_format,
        skip_preset_copy_if_rules_identical=config.export_settings.skip_preset_copy_if_rules_identical,
        save_sphere_log=config.export_settings.save_sphere_log,
        verbose_sphere_log=config.export_settings.verbose_sphere_log,
        extend_sphere_log_to_all_locations=config.export_settings.extend_sphere_log_to_all_locations,
        log_fractional_sphere_details=config.export_settings.log_fractional_sphere_details,
        log_integer_sphere_details=config.export_settings.log_integer_sphere_details,
        auto_collect_events=config.export_settings.auto_collect_events,
        filter_event_items=config.export_settings.filter_event_items,
        update_frontend_presets=config.export_settings.update_frontend_presets,
        skip_export_for_native_ut=config.export_settings.skip_export_for_native_ut,
        skip_export_from_list=config.export_settings.skip_export_from_list,
    )

    # Try to override with host.yaml settings if available
    try:
        from settings import get_settings
        settings = get_settings()
        if hasattr(settings, 'general_options'):
            general = settings.general_options
            for field_name in ExportSettings.__dataclass_fields__:
                if hasattr(general, field_name):
                    value = getattr(general, field_name, None)
                    if value is not None:
                        setattr(result, field_name, value)
    except (ImportError, AttributeError):
        pass

    return result
