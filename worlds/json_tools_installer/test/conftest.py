import pytest


@pytest.fixture(autouse=True)
def isolated_user_path(tmp_path, monkeypatch):
    """Point Utils.user_path into the test's tmp dir.

    component_apworld_paths / extract_tools resolve custom_worlds via
    Utils.user_path (imported at call time), so without this a detection or
    removal test could see — or delete — apworlds in the real user directory.
    """
    import Utils
    user_dir = tmp_path / "ap_user"
    monkeypatch.setattr(Utils, "user_path", lambda *parts: str(user_dir.joinpath(*parts)))
    return user_dir


@pytest.fixture
def frozen(monkeypatch):
    """Factory fixture: frozen(True/False) sets the extractor's frozen mode."""
    from worlds.json_tools_installer.installer import extractor

    def set_frozen(value: bool) -> None:
        monkeypatch.setattr(extractor, "is_frozen", lambda: bool(value))

    return set_frozen
