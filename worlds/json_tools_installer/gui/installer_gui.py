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

from ..config import load_config, save_config, InstallerConfig, configure_export_settings, EXPORT_PRESETS
from ..installer.version_detector import detect_ap_version, get_version_support_status
from ..installer.downloader import download_archive, get_latest_commit_hash, check_connectivity
from ..installer.extractor import extract_tools, COMPONENTS, DEFAULT_COMPONENTS, list_installed_components
from ..installer.patcher import apply_bundled_patches, revert_patches, get_patch_summary
from ..installer.romless_patcher import apply_romless_patches, revert_romless_patches


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
    comp_main_patches = BooleanProperty(True)
    comp_romless_patches = BooleanProperty(True)
    comp_demo_worlds = BooleanProperty(True)
    comp_tracker = BooleanProperty(False)
    comp_testing = BooleanProperty(False)
    comp_worldgen_worlds = BooleanProperty(False)

    # Patch options (monkey patch and main patches are mutually exclusive)
    apply_monkey_patch = BooleanProperty(True)
    apply_main_patches = BooleanProperty(False)
    apply_romless_patches = BooleanProperty(False)

    # Export settings configuration
    configure_export = BooleanProperty(True)
    export_preset_normal = BooleanProperty(True)
    export_preset_minimal = BooleanProperty(False)

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
        ap_info_box = BoxLayout(size_hint_y=None, height=60, orientation='vertical')
        ap_info_box.add_widget(Label(
            text=f'Archipelago Version: {version_info.version_string}',
            size_hint_y=None,
            height=30,
        ))
        ap_info_box.add_widget(Label(
            text=f'Support: {get_version_support_status(version_info)}',
            size_hint_y=None,
            height=30,
        ))
        root.add_widget(ap_info_box)

        # Version selection (stable/dev)
        version_select_box = BoxLayout(size_hint_y=None, height=40)
        version_select_box.add_widget(Label(text='Version:', size_hint_x=0.3))

        stable_box = BoxLayout()
        stable_cb = CheckBox(group='version', active=True)
        stable_cb.bind(active=self.on_version_stable)
        stable_box.add_widget(stable_cb)
        stable_box.add_widget(Label(text='Stable'))
        version_select_box.add_widget(stable_box)

        dev_box = BoxLayout()
        dev_cb = CheckBox(group='version', active=False)
        dev_cb.bind(active=self.on_version_dev)
        dev_box.add_widget(dev_cb)
        dev_box.add_widget(Label(text='Dev'))
        version_select_box.add_widget(dev_box)

        root.add_widget(version_select_box)

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
        spacing = 5
        num_components = len(COMPONENTS)
        # Total height = rows + spacing between rows
        total_height = (num_components * row_height) + ((num_components - 1) * spacing)
        components_box = BoxLayout(
            orientation='vertical',
            size_hint_y=None,
            height=total_height,
            spacing=spacing,
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
            height=min(200, num_components * row_height),  # Max height of 200, scrollable if more
            do_scroll_x=False,
            bar_width=10,
        )
        scroll_view.add_widget(components_box)
        root.add_widget(scroll_view)

        # Patch options
        options_label = Label(
            text='Apply patches after download:',
            size_hint_y=None,
            height=25,
            halign='left',
        )
        options_label.bind(size=options_label.setter('text_size'))
        root.add_widget(options_label)

        options_box = BoxLayout(size_hint_y=None, height=35, spacing=10)

        # Monkey patch checkbox (default checked)
        monkey_row = BoxLayout(size_hint_x=0.33)
        self.monkey_patch_cb = CheckBox(
            active=self.apply_monkey_patch,
            size_hint_x=None,
            width=40,
        )
        self.monkey_patch_cb.bind(active=self.on_monkey_patch_toggle)
        monkey_row.add_widget(self.monkey_patch_cb)
        monkey_label = Label(
            text='Monkey patch',
            halign='left',
            valign='middle',
        )
        monkey_label.bind(size=monkey_label.setter('text_size'))
        monkey_row.add_widget(monkey_label)
        options_box.add_widget(monkey_row)

        # Main patches checkbox (default unchecked, mutually exclusive with monkey patch)
        main_patch_row = BoxLayout(size_hint_x=0.33)
        self.main_patch_cb = CheckBox(
            active=self.apply_main_patches,
            size_hint_x=None,
            width=40,
        )
        self.main_patch_cb.bind(active=self.on_main_patch_toggle)
        main_patch_row.add_widget(self.main_patch_cb)
        main_patch_label = Label(
            text='Main patches',
            halign='left',
            valign='middle',
        )
        main_patch_label.bind(size=main_patch_label.setter('text_size'))
        main_patch_row.add_widget(main_patch_label)
        options_box.add_widget(main_patch_row)

        # ROM-less patches checkbox (default unchecked)
        romless_row = BoxLayout(size_hint_x=0.33)
        self.romless_patch_cb = CheckBox(
            active=self.apply_romless_patches,
            size_hint_x=None,
            width=40,
        )
        self.romless_patch_cb.bind(active=lambda inst, val: setattr(self, 'apply_romless_patches', val))
        romless_row.add_widget(self.romless_patch_cb)
        romless_label = Label(
            text='ROM-less patches',
            halign='left',
            valign='middle',
        )
        romless_label.bind(size=romless_label.setter('text_size'))
        romless_row.add_widget(romless_label)
        options_box.add_widget(romless_row)

        root.add_widget(options_box)

        # Export settings configuration
        export_label = Label(
            text='Configure export settings in host.yaml:',
            size_hint_y=None,
            height=25,
            halign='left',
        )
        export_label.bind(size=export_label.setter('text_size'))
        root.add_widget(export_label)

        export_box = BoxLayout(size_hint_y=None, height=35, spacing=10)

        # Configure export checkbox
        config_export_row = BoxLayout(size_hint_x=0.4)
        self.config_export_cb = CheckBox(
            active=self.configure_export,
            size_hint_x=None,
            width=40,
        )
        self.config_export_cb.bind(active=lambda inst, val: setattr(self, 'configure_export', val))
        config_export_row.add_widget(self.config_export_cb)
        config_label = Label(
            text='Configure host.yaml',
            halign='left',
            valign='middle',
        )
        config_label.bind(size=config_label.setter('text_size'))
        config_export_row.add_widget(config_label)
        export_box.add_widget(config_export_row)

        # Normal preset radio
        normal_row = BoxLayout(size_hint_x=0.3)
        self.preset_normal_cb = CheckBox(
            group='export_preset',
            active=True,
            size_hint_x=None,
            width=40,
        )
        self.preset_normal_cb.bind(active=self.on_preset_normal)
        normal_row.add_widget(self.preset_normal_cb)
        normal_label = Label(
            text='Normal',
            halign='left',
            valign='middle',
        )
        normal_label.bind(size=normal_label.setter('text_size'))
        normal_row.add_widget(normal_label)
        export_box.add_widget(normal_row)

        # Minimal-spoilers preset radio
        minimal_row = BoxLayout(size_hint_x=0.3)
        self.preset_minimal_cb = CheckBox(
            group='export_preset',
            active=False,
            size_hint_x=None,
            width=40,
        )
        self.preset_minimal_cb.bind(active=self.on_preset_minimal)
        minimal_row.add_widget(self.preset_minimal_cb)
        minimal_label = Label(
            text='Minimal spoilers',
            halign='left',
            valign='middle',
        )
        minimal_label.bind(size=minimal_label.setter('text_size'))
        minimal_row.add_widget(minimal_label)
        export_box.add_widget(minimal_row)

        root.add_widget(export_box)

        # Status area
        self.status_label = Label(
            text=self.status_text,
            size_hint_y=None,
            height=25,
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

        # Bottom button row (Help and Close)
        bottom_btn_box = BoxLayout(size_hint_y=None, height=40, spacing=10)

        help_btn = Button(text='Help')
        help_btn.bind(on_press=self.show_help)
        bottom_btn_box.add_widget(help_btn)

        close_btn = Button(text='Close')
        close_btn.bind(on_press=self.stop)
        bottom_btn_box.add_widget(close_btn)

        root.add_widget(bottom_btn_box)

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

    def on_monkey_patch_toggle(self, instance, value: bool):
        """Handle monkey patch checkbox toggle - mutually exclusive with main patches."""
        self.apply_monkey_patch = value
        if value and self.apply_main_patches:
            # Uncheck main patches when monkey patch is checked
            self.apply_main_patches = False
            self.main_patch_cb.active = False

    def on_main_patch_toggle(self, instance, value: bool):
        """Handle main patch checkbox toggle - mutually exclusive with monkey patch."""
        self.apply_main_patches = value
        if value and self.apply_monkey_patch:
            # Uncheck monkey patch when main patches is checked
            self.apply_monkey_patch = False
            self.monkey_patch_cb.active = False

    def on_preset_normal(self, instance, value: bool):
        """Handle normal preset selection."""
        if value:
            self.export_preset_normal = True
            self.export_preset_minimal = False

    def on_preset_minimal(self, instance, value: bool):
        """Handle minimal-spoilers preset selection."""
        if value:
            self.export_preset_minimal = True
            self.export_preset_normal = False

    def get_selected_export_preset(self) -> str:
        """Get the selected export preset name."""
        return "minimal-spoilers" if self.export_preset_minimal else "normal"

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

    def show_confirmation_dialog(self, title: str, message: str, event: threading.Event, result_holder: list):
        """
        Show a confirmation dialog and set the event when user responds.

        Args:
            title: Dialog title.
            message: Dialog message.
            event: Threading event to signal when dialog is dismissed.
            result_holder: List to store the result (True for confirm, False for cancel).
        """
        def show(dt):
            content = BoxLayout(orientation='vertical', padding=10, spacing=10)

            # Message label with text wrapping
            msg_label = Label(
                text=message,
                halign='left',
                valign='top',
                size_hint_y=0.8,
            )
            msg_label.bind(size=msg_label.setter('text_size'))
            content.add_widget(msg_label)

            # Button row
            btn_box = BoxLayout(size_hint_y=None, height=40, spacing=10)

            proceed_btn = Button(text='Proceed')
            cancel_btn = Button(text='Cancel')

            btn_box.add_widget(proceed_btn)
            btn_box.add_widget(cancel_btn)
            content.add_widget(btn_box)

            popup = Popup(
                title=title,
                content=content,
                size_hint=(0.85, 0.6),
                auto_dismiss=False,
            )

            def on_proceed(instance):
                result_holder.append(True)
                popup.dismiss()
                event.set()

            def on_cancel(instance):
                result_holder.append(False)
                popup.dismiss()
                event.set()

            proceed_btn.bind(on_press=on_proceed)
            cancel_btn.bind(on_press=on_cancel)
            popup.open()

        Clock.schedule_once(show)

    def show_help(self, instance):
        """Show help information about the installer."""
        help_text = """JSON Tools Installer Help

PATCH OPTIONS
The installer offers three ways to enable JSON export functionality:

[b]Monkey Patch[/b] (Recommended)
Runtime patching that hooks into Archipelago without modifying files. Safe, reversible, and works across AP versions.

[b]Main Patches[/b]
Replaces core Archipelago files (Main.py, BaseClasses.py, settings.py) with patched versions. Original files are backed up. Requires confirmation before applying.

[b]ROM-less Patches[/b]
Additional patches that allow seed generation for games that normally require ROM files. Useful for testing.

Note: Monkey patch and Main patches are mutually exclusive - you can use one or the other, or neither.

EXPORT SETTINGS
Configure how Archipelago exports game data to host.yaml:

[b]Configure host.yaml[/b]
When enabled, the installer automatically adds export settings to your host.yaml file. This eliminates the need to manually run setup scripts after installation.

[b]Normal[/b]
Standard settings with JSON export disabled. Use this if you only want the tools installed but don't need automatic JSON export during seed generation.

[b]Minimal spoilers[/b]
Enables JSON rules export and sphere logging. This is what you need to use the frontend web UI for viewing game logic and playthroughs. Automatically updates frontend presets when generating seeds.

COMPONENTS
Select which parts of JSON Tools to install:
- Core modules (exporter, rule_builder, world_generator)
- Frontend web UI for viewing game logic
- Scripts for testing and setup
- Documentation
- Demo worlds for learning

VERSION
- Stable: Release-quality code from JSONExport branch
- Dev: Latest development code (may be unstable)

For more information, see the README.md file."""

        content = BoxLayout(orientation='vertical', padding=10, spacing=10)

        # Use ScrollView for the help text
        scroll = ScrollView(size_hint_y=0.9, do_scroll_x=False)
        help_label = Label(
            text=help_text,
            markup=True,
            halign='left',
            valign='top',
            size_hint=(1, None),
            text_size=(None, None),
        )
        # Bind width to scroll width (minus padding) for text wrapping
        def update_text_width(instance, value):
            help_label.text_size = (value - 20, None)
        scroll.bind(width=update_text_width)
        # Bind height to texture height for scrolling
        help_label.bind(texture_size=lambda inst, size: setattr(inst, 'height', size[1]))
        scroll.add_widget(help_label)
        content.add_widget(scroll)

        ok_btn = Button(text='OK', size_hint_y=None, height=40)
        content.add_widget(ok_btn)

        popup = Popup(
            title='JSON Tools Installer Help',
            content=content,
            size_hint=(0.9, 0.85),
        )
        ok_btn.bind(on_press=popup.dismiss)
        popup.open()

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

                # Apply patches based on selected option
                if self.apply_monkey_patch:
                    # Monkey patching - runtime hooks
                    self.update_status("Installing monkey patch hooks...")
                    self.update_progress(85)
                    from ..monkey_patches import install_hooks
                    hook_results = install_hooks()
                    success_count = sum(1 for v in hook_results.values() if v)
                    if success_count < len(hook_results):
                        self.show_message("Warning", f"Only {success_count}/{len(hook_results)} hooks installed")
                    self.config.patches.method = "monkey"

                elif self.apply_main_patches and "main_patches" in components:
                    # File-based patching - needs confirmation
                    from ..installer.patcher import PATCH_FILES

                    confirm_message = (
                        "File-based patching will modify the following core Archipelago files:\n\n"
                        + "\n".join(f"  - {f}" for f in PATCH_FILES) +
                        "\n\n"
                        "These patches enable JSON export and sphere logging functionality.\n"
                        "Original files will be backed up and can be restored later.\n\n"
                        "Do you want to proceed with file-based patching?"
                    )

                    # Show confirmation dialog and wait for response
                    confirm_event = threading.Event()
                    confirm_result = []
                    self.show_confirmation_dialog(
                        "Confirm File Patching",
                        confirm_message,
                        confirm_event,
                        confirm_result,
                    )
                    confirm_event.wait()  # Block until user responds

                    if confirm_result and confirm_result[0]:
                        self.update_status("Applying main patches...")
                        self.update_progress(85)
                        patch_result = apply_bundled_patches(self.config)
                        if not patch_result.success:
                            self.show_message("Warning", f"Main patch issues: {patch_result.errors}")
                        else:
                            self.config.patches.method = "file"
                    else:
                        self.update_status("File patching cancelled, using no patches...")
                        self.config.patches.method = "none"

                else:
                    # No patching selected
                    self.config.patches.method = "none"

                # Apply ROM-less patches if checkbox is checked
                if self.apply_romless_patches and "romless_patches" in components:
                    self.update_status("Applying ROM-less patches...")
                    self.update_progress(90)
                    romless_result = apply_romless_patches(self.config)
                    if not romless_result.success:
                        self.show_message("Warning", f"ROM-less patch issues: {romless_result.errors}")

                # Configure export settings in host.yaml
                if self.configure_export:
                    preset = self.get_selected_export_preset()
                    self.update_status(f"Configuring export settings ({preset})...")
                    self.update_progress(95)
                    if configure_export_settings(preset=preset):
                        if preset == "minimal-spoilers":
                            self.update_status("Export settings configured (JSON export enabled)")
                    else:
                        self.show_message(
                            "Warning",
                            "Could not configure export settings in host.yaml.\n"
                            "You may need to run:\n"
                            "python scripts/setup/update_host_settings.py minimal-spoilers"
                        )

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
            self.update_status("Reverting main patches...")
            self.update_progress(20)
            revert_patches(self.config)

            self.update_status("Reverting ROM-less patches...")
            self.update_progress(30)
            revert_romless_patches(self.config)

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
                errors = []

                self.update_status("Reverting main patches...")
                main_result = revert_patches(self.config)
                if main_result.errors:
                    errors.extend(main_result.errors)

                self.update_status("Reverting ROM-less patches...")
                romless_result = revert_romless_patches(self.config)
                if romless_result.errors:
                    errors.extend(romless_result.errors)

                if errors:
                    self.show_message("Warning", f"Some patches could not be reverted: {errors}")
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
