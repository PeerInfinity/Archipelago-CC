"""
Kivy-based GUI for JSON Tools status checker.

Displays current installation status and configuration.
"""

import os
os.environ.setdefault("KIVY_NO_CONSOLELOG", "1")
os.environ.setdefault("KIVY_NO_FILELOG", "1")
os.environ.setdefault("KIVY_NO_ARGS", "1")

from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.gridlayout import GridLayout

from ..config import load_config
from ..installer.version_detector import detect_ap_version, get_version_support_status
from ..installer.extractor import list_installed_components, COMPONENTS
from ..installer.patcher import get_patch_summary


class StatusApp(App):
    """Status checker application."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.title = "JSON Tools Status"

    def build(self):
        """Build the UI."""
        root = BoxLayout(orientation='vertical', padding=10, spacing=5)

        # Header
        header = Label(
            text='JSON Tools Status',
            size_hint_y=None,
            height=40,
            font_size=24,
        )
        root.add_widget(header)

        # Scrollable content
        scroll = ScrollView()
        content = GridLayout(cols=2, spacing=5, size_hint_y=None, padding=10)
        content.bind(minimum_height=content.setter('height'))

        # Load data
        config = load_config()
        version_info = detect_ap_version()
        installed = list_installed_components()
        patch_summary = get_patch_summary(config)

        # Section: AP Version
        content.add_widget(Label(text='[b]Archipelago Version[/b]', markup=True, size_hint_y=None, height=30))
        content.add_widget(Label(text='', size_hint_y=None, height=30))

        content.add_widget(Label(text='Version:', size_hint_y=None, height=25))
        content.add_widget(Label(text=version_info.version_string, size_hint_y=None, height=25))

        content.add_widget(Label(text='Support:', size_hint_y=None, height=25))
        content.add_widget(Label(text=get_version_support_status(version_info), size_hint_y=None, height=25))

        # Section: Installation
        content.add_widget(Label(text='', size_hint_y=None, height=10))
        content.add_widget(Label(text='', size_hint_y=None, height=10))
        content.add_widget(Label(text='[b]Installation[/b]', markup=True, size_hint_y=None, height=30))
        content.add_widget(Label(text='', size_hint_y=None, height=30))

        if config.installation.installed_at:
            content.add_widget(Label(text='Version:', size_hint_y=None, height=25))
            content.add_widget(Label(text=config.installation.version, size_hint_y=None, height=25))

            content.add_widget(Label(text='Repository:', size_hint_y=None, height=25))
            content.add_widget(Label(text=config.installation.source_repo or 'unknown', size_hint_y=None, height=25))

            content.add_widget(Label(text='Installed At:', size_hint_y=None, height=25))
            content.add_widget(Label(text=config.installation.installed_at[:19], size_hint_y=None, height=25))
        else:
            content.add_widget(Label(text='Status:', size_hint_y=None, height=25))
            content.add_widget(Label(text='Not installed', size_hint_y=None, height=25))

        # Section: Components
        content.add_widget(Label(text='', size_hint_y=None, height=10))
        content.add_widget(Label(text='', size_hint_y=None, height=10))
        content.add_widget(Label(text='[b]Components[/b]', markup=True, size_hint_y=None, height=30))
        content.add_widget(Label(text='', size_hint_y=None, height=30))

        for name, comp in COMPONENTS.items():
            is_installed = name in installed
            status = '[color=00ff00]Installed[/color]' if is_installed else '[color=ff0000]Not installed[/color]'
            content.add_widget(Label(text=comp.display_name, size_hint_y=None, height=25))
            content.add_widget(Label(text=status, markup=True, size_hint_y=None, height=25))

        # Section: Patches
        content.add_widget(Label(text='', size_hint_y=None, height=10))
        content.add_widget(Label(text='', size_hint_y=None, height=10))
        content.add_widget(Label(text='[b]Patches[/b]', markup=True, size_hint_y=None, height=30))
        content.add_widget(Label(text='', size_hint_y=None, height=30))

        content.add_widget(Label(text='Patched Files:', size_hint_y=None, height=25))
        content.add_widget(Label(
            text=f"{patch_summary['patched_count']}/{patch_summary['total_files']}",
            size_hint_y=None, height=25
        ))

        content.add_widget(Label(text='Backups:', size_hint_y=None, height=25))
        content.add_widget(Label(text=str(patch_summary['backup_count']), size_hint_y=None, height=25))

        for filename, status in patch_summary['files'].items():
            patched = '[color=00ff00]Patched[/color]' if status.is_patched else 'Original'
            backup = ' (backup)' if status.has_backup else ''
            content.add_widget(Label(text=f'  {filename}:', size_hint_y=None, height=25))
            content.add_widget(Label(text=f'{patched}{backup}', markup=True, size_hint_y=None, height=25))

        scroll.add_widget(content)
        root.add_widget(scroll)

        # Buttons
        button_box = BoxLayout(size_hint_y=None, height=50, spacing=10)

        refresh_btn = Button(text='Refresh')
        refresh_btn.bind(on_press=self.do_refresh)
        button_box.add_widget(refresh_btn)

        close_btn = Button(text='Close')
        close_btn.bind(on_press=self.stop)
        button_box.add_widget(close_btn)

        root.add_widget(button_box)

        return root

    def do_refresh(self, instance):
        """Refresh the status display."""
        # Rebuild the UI
        self.root.clear_widgets()
        new_root = self.build()
        for child in new_root.children[:]:
            new_root.remove_widget(child)
            self.root.add_widget(child)


def run_status_gui(*args):
    """Run the status GUI."""
    app = StatusApp()
    app.run()


if __name__ == "__main__":
    run_status_gui()
