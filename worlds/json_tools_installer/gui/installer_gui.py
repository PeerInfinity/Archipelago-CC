"""
Kivy-based GUI for JSON Tools Installer.

Provides a graphical interface for installing and managing JSON Tools.
"""

import threading
from typing import Optional, List

# Kivy setup must happen before other kivy imports
import os
os.environ.setdefault("KIVY_NO_CONSOLELOG", "1")
os.environ.setdefault("KIVY_NO_FILELOG", "1")
os.environ.setdefault("KIVY_NO_ARGS", "1")

from kivy.app import App
from kivy.clock import Clock
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.checkbox import CheckBox
from kivy.uix.progressbar import ProgressBar
from kivy.uix.scrollview import ScrollView
from kivy.uix.popup import Popup
from kivy.properties import StringProperty, BooleanProperty, NumericProperty

from ..config import load_config, save_config, InstallerConfig
from ..installer.version_detector import detect_ap_version, get_version_support_status
from ..installer.downloader import download_archive, get_latest_commit_hash, check_connectivity
from ..installer.extractor import extract_tools, COMPONENTS, DEFAULT_COMPONENTS, list_installed_components
from ..installer.patcher import apply_patches, revert_patches, get_patch_summary


class InstallerApp(App):
    """Main installer application."""

    # Properties for UI binding
    status_text = StringProperty("Ready")
    progress_value = NumericProperty(0)
    is_working = BooleanProperty(False)

    version_stable = BooleanProperty(True)
    version_dev = BooleanProperty(False)

    # Component properties (defaults set from DEFAULT_COMPONENTS)
    comp_exporter = BooleanProperty(True)
    comp_rule_builder = BooleanProperty(True)
    comp_world_generator = BooleanProperty(True)
    comp_frontend = BooleanProperty(True)
    comp_presets = BooleanProperty(False)
    comp_docs = BooleanProperty(True)
    comp_scripts = BooleanProperty(True)
    comp_romless_patches = BooleanProperty(True)
    comp_demo_worlds = BooleanProperty(True)
    comp_tracker = BooleanProperty(False)
    comp_testing = BooleanProperty(False)
    comp_worldgen_worlds = BooleanProperty(False)

    # Store checkbox references for updating
    component_checkboxes = {}

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.config: InstallerConfig = load_config()
        self.title = "JSON Tools Installer"

    def build(self):
        """Build the UI."""
        root = BoxLayout(orientation='vertical', padding=10, spacing=10)

        # Header
        header = Label(
            text='JSON Tools Installer',
            size_hint_y=None,
            height=40,
            font_size=24,
        )
        root.add_widget(header)

        # AP Version info
        version_info = detect_ap_version()
        version_box = BoxLayout(size_hint_y=None, height=60, orientation='vertical')
        version_box.add_widget(Label(
            text=f'Archipelago Version: {version_info.version_string}',
            size_hint_y=None,
            height=30,
        ))
        version_box.add_widget(Label(
            text=f'Support: {get_version_support_status(version_info)}',
            size_hint_y=None,
            height=30,
        ))
        root.add_widget(version_box)

        # Version selection
        version_box = BoxLayout(size_hint_y=None, height=40)
        version_box.add_widget(Label(text='Version:', size_hint_x=0.3))

        stable_box = BoxLayout()
        stable_cb = CheckBox(group='version', active=True)
        stable_cb.bind(active=self.on_version_stable)
        stable_box.add_widget(stable_cb)
        stable_box.add_widget(Label(text='Stable'))
        version_box.add_widget(stable_box)

        dev_box = BoxLayout()
        dev_cb = CheckBox(group='version', active=False)
        dev_cb.bind(active=self.on_version_dev)
        dev_box.add_widget(dev_cb)
        dev_box.add_widget(Label(text='Dev'))
        version_box.add_widget(dev_box)

        root.add_widget(version_box)

        # Components section header with Check All button
        comp_header = BoxLayout(size_hint_y=None, height=35, spacing=10)
        comp_label = Label(
            text='Components:',
            size_hint_x=0.7,
            halign='left',
            valign='middle',
        )
        comp_label.bind(size=comp_label.setter('text_size'))
        comp_header.add_widget(comp_label)

        check_all_btn = Button(
            text='Check All',
            size_hint_x=0.15,
        )
        check_all_btn.bind(on_press=self.do_check_all)
        comp_header.add_widget(check_all_btn)

        uncheck_all_btn = Button(
            text='Uncheck All',
            size_hint_x=0.15,
        )
        uncheck_all_btn.bind(on_press=self.do_uncheck_all)
        comp_header.add_widget(uncheck_all_btn)

        root.add_widget(comp_header)

        # Component checkboxes in a scrollable container
        row_height = 40
        num_components = len(COMPONENTS)
        components_box = BoxLayout(
            orientation='vertical',
            size_hint_y=None,
            height=num_components * row_height,
            spacing=5,
        )

        for name, comp in COMPONENTS.items():
            row = BoxLayout(size_hint_y=None, height=row_height)

            # Checkbox with fixed width, default based on DEFAULT_COMPONENTS
            cb = CheckBox(
                active=name in DEFAULT_COMPONENTS,
                size_hint_x=None,
                width=40,
            )
            cb.bind(active=lambda instance, value, n=name: self.on_component_toggle(n, value))
            self.component_checkboxes[name] = cb
            row.add_widget(cb)

            # Label with proper text alignment
            label = Label(
                text=f'{comp.display_name} ({comp.size_estimate_mb:.1f}MB)',
                halign='left',
                valign='middle',
                size_hint_x=0.4,
            )
            label.bind(size=label.setter('text_size'))
            row.add_widget(label)

            # Description label
            desc_label = Label(
                text=comp.description,
                halign='left',
                valign='middle',
                size_hint_x=0.6,
            )
            desc_label.bind(size=desc_label.setter('text_size'))
            row.add_widget(desc_label)

            components_box.add_widget(row)

        # Wrap in ScrollView for when there are many components
        scroll_view = ScrollView(
            size_hint_y=None,
            height=min(250, num_components * row_height),  # Max height of 250, scrollable if more
            do_scroll_x=False,
            bar_width=10,
        )
        scroll_view.add_widget(components_box)
        root.add_widget(scroll_view)

        # Status area
        self.status_label = Label(
            text=self.status_text,
            size_hint_y=None,
            height=60,
        )
        root.add_widget(self.status_label)

        # Progress bar
        self.progress = ProgressBar(
            max=100,
            value=0,
            size_hint_y=None,
            height=20,
        )
        root.add_widget(self.progress)

        # Buttons
        button_box = BoxLayout(size_hint_y=None, height=50, spacing=10)

        install_btn = Button(text='Install / Update')
        install_btn.bind(on_press=self.do_install)
        button_box.add_widget(install_btn)

        uninstall_btn = Button(text='Uninstall')
        uninstall_btn.bind(on_press=self.do_uninstall)
        button_box.add_widget(uninstall_btn)

        revert_btn = Button(text='Revert Patches')
        revert_btn.bind(on_press=self.do_revert)
        button_box.add_widget(revert_btn)

        root.add_widget(button_box)

        # Close button
        close_btn = Button(text='Close', size_hint_y=None, height=40)
        close_btn.bind(on_press=self.stop)
        root.add_widget(close_btn)

        return root

    def on_version_stable(self, instance, value):
        """Handle stable version selection."""
        if value:
            self.version_stable = True
            self.version_dev = False

    def on_version_dev(self, instance, value):
        """Handle dev version selection."""
        if value:
            self.version_dev = True
            self.version_stable = False

    def on_component_toggle(self, name: str, value: bool):
        """Handle component checkbox toggle."""
        # Map component name to property
        prop_name = f'comp_{name}'
        if hasattr(self, prop_name):
            setattr(self, prop_name, value)

    def do_check_all(self, instance):
        """Check all component checkboxes."""
        for name, cb in self.component_checkboxes.items():
            cb.active = True
            self.on_component_toggle(name, True)

    def do_uncheck_all(self, instance):
        """Uncheck all component checkboxes."""
        for name, cb in self.component_checkboxes.items():
            cb.active = False
            self.on_component_toggle(name, False)

    def get_selected_components(self) -> List[str]:
        """Get list of selected component names."""
        components = []
        for name in COMPONENTS.keys():
            prop_name = f'comp_{name}'
            if hasattr(self, prop_name) and getattr(self, prop_name):
                components.append(name)
        return components

    def get_selected_version(self) -> str:
        """Get selected version string."""
        return 'dev' if self.version_dev else 'stable'

    def update_status(self, text: str):
        """Update status text (thread-safe)."""
        Clock.schedule_once(lambda dt: setattr(self.status_label, 'text', text))

    def update_progress(self, value: float):
        """Update progress bar (thread-safe)."""
        Clock.schedule_once(lambda dt: setattr(self.progress, 'value', value))

    def show_message(self, title: str, message: str):
        """Show a popup message."""
        def show(dt):
            content = BoxLayout(orientation='vertical', padding=10)
            content.add_widget(Label(text=message))
            btn = Button(text='OK', size_hint_y=None, height=40)
            content.add_widget(btn)

            popup = Popup(title=title, content=content, size_hint=(0.8, 0.5))
            btn.bind(on_press=popup.dismiss)
            popup.open()

        Clock.schedule_once(show)

    def do_install(self, instance):
        """Start installation in background thread."""
        if self.is_working:
            return

        self.is_working = True
        thread = threading.Thread(target=self._install_thread)
        thread.daemon = True
        thread.start()

    def _install_thread(self):
        """Installation logic (runs in background thread)."""
        try:
            import tempfile
            from pathlib import Path

            version = self.get_selected_version()
            components = self.get_selected_components()
            source = self.config.get_source(version)

            self.update_status(f"Checking connectivity...")
            self.update_progress(5)

            if not check_connectivity():
                self.show_message("Error", "Cannot reach GitHub. Check your internet connection.")
                return

            self.update_status(f"Downloading from {source.repo}...")
            self.update_progress(10)

            with tempfile.TemporaryDirectory() as temp_dir:
                archive_path = Path(temp_dir) / "archive.zip"

                def progress_cb(current, total):
                    if total > 0:
                        pct = 10 + (current * 40 // total)
                        self.update_progress(pct)

                result = download_archive(source, archive_path, progress_cb)

                if not result.success:
                    self.show_message("Error", f"Download failed: {result.error}")
                    return

                self.update_status("Extracting files...")
                self.update_progress(50)

                def extract_cb(filename, current, total):
                    if total > 0:
                        pct = 50 + (current * 30 // total)
                        self.update_progress(pct)

                extract_result = extract_tools(archive_path, components, progress_callback=extract_cb)

                if not extract_result.success:
                    self.show_message("Error", f"Extraction failed: {extract_result.errors}")
                    return

                self.update_status("Applying patches...")
                self.update_progress(85)

                patch_result = apply_patches(archive_path, self.config)

                if not patch_result.success:
                    self.show_message("Warning", f"Patching issues: {patch_result.errors}")

                self.update_progress(100)
                self.update_status("Installation complete!")

                # Get commit hash
                commit_hash = get_latest_commit_hash(source)

                # Update config
                from ..config import update_installation_info
                update_installation_info(self.config, version, components, commit_hash)

                self.show_message(
                    "Success",
                    "JSON Tools installed successfully!\n\nRestart Archipelago to use the new tools."
                )

        except Exception as e:
            self.show_message("Error", f"Installation failed: {str(e)}")
        finally:
            self.is_working = False
            Clock.schedule_once(lambda dt: setattr(self.progress, 'value', 0))

    def do_uninstall(self, instance):
        """Uninstall JSON Tools."""
        if self.is_working:
            return

        self.is_working = True
        thread = threading.Thread(target=self._uninstall_thread)
        thread.daemon = True
        thread.start()

    def _uninstall_thread(self):
        """Uninstall logic."""
        try:
            self.update_status("Reverting patches...")
            self.update_progress(25)

            revert_result = revert_patches(self.config)

            self.update_status("Removing components...")
            self.update_progress(50)

            from ..installer.extractor import remove_component
            installed = list_installed_components()
            for comp in installed:
                remove_component(comp)
                self.update_progress(50 + (len(installed) * 10))

            from ..config import clear_installation
            clear_installation(self.config)

            self.update_progress(100)
            self.update_status("Uninstall complete!")

            self.show_message("Success", "JSON Tools has been uninstalled.")

        except Exception as e:
            self.show_message("Error", f"Uninstall failed: {str(e)}")
        finally:
            self.is_working = False
            Clock.schedule_once(lambda dt: setattr(self.progress, 'value', 0))

    def do_revert(self, instance):
        """Revert patches only."""
        if self.is_working:
            return

        self.is_working = True

        def revert():
            try:
                self.update_status("Reverting patches...")
                result = revert_patches(self.config)

                if result.errors:
                    self.show_message("Warning", f"Some patches could not be reverted: {result.errors}")
                else:
                    self.show_message("Success", "Patches reverted successfully.")

                self.update_status("Ready")

            except Exception as e:
                self.show_message("Error", f"Revert failed: {str(e)}")
            finally:
                self.is_working = False

        thread = threading.Thread(target=revert)
        thread.daemon = True
        thread.start()


def run_installer_gui(*args):
    """Run the installer GUI."""
    app = InstallerApp()
    app.run()


if __name__ == "__main__":
    run_installer_gui()
