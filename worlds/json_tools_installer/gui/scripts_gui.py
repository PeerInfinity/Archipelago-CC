"""
Kivy-based GUI for running JSON Tools scripts.

Provides a menu to launch utility scripts.
"""

import os
import subprocess
import sys
from pathlib import Path

os.environ.setdefault("KIVY_NO_CONSOLELOG", "1")
os.environ.setdefault("KIVY_NO_FILELOG", "1")
os.environ.setdefault("KIVY_NO_ARGS", "1")

from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.popup import Popup

from Utils import local_path


# Define available scripts with categories
SCRIPTS = {
    "Setup": [
        ("setup_dev_environment.py", "Set up development environment"),
        ("update_host_settings.py", "Configure host.yaml settings"),
        ("setup_ap_server.py", "Set up AP server"),
    ],
    "Testing": [
        ("test-all-templates.py", "Test all game templates"),
    ],
    "Build": [
        ("pack_apworld.py", "Package a world as APWorld"),
    ],
    "Data": [
        ("combine_apworld_data.py", "Combine APWorld data from sources"),
        ("install_apworlds.py", "Bulk install APWorlds"),
        ("restore_apworlds.py", "Restore disabled APWorlds"),
    ],
}


class ScriptsApp(App):
    """Scripts menu application."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.title = "JSON Tools Scripts"

    def build(self):
        """Build the UI."""
        root = BoxLayout(orientation='vertical', padding=10, spacing=5)

        # Header
        header = Label(
            text='JSON Tools Scripts',
            size_hint_y=None,
            height=40,
            font_size=24,
        )
        root.add_widget(header)

        # Check if scripts are installed
        scripts_path = Path(local_path("scripts"))
        if not scripts_path.exists():
            root.add_widget(Label(
                text='Scripts not installed.\nUse the installer to download scripts.',
                halign='center',
            ))
            close_btn = Button(text='Close', size_hint_y=None, height=40)
            close_btn.bind(on_press=self.stop)
            root.add_widget(close_btn)
            return root

        # Scrollable content
        scroll = ScrollView()
        content = BoxLayout(orientation='vertical', spacing=5, size_hint_y=None, padding=10)
        content.bind(minimum_height=content.setter('height'))

        for category, scripts in SCRIPTS.items():
            # Category header
            cat_label = Label(
                text=f'[b]{category}[/b]',
                markup=True,
                size_hint_y=None,
                height=35,
                halign='left',
            )
            content.add_widget(cat_label)

            for script_name, description in scripts:
                row = BoxLayout(size_hint_y=None, height=40, spacing=10)

                # Run button
                run_btn = Button(
                    text='Run',
                    size_hint_x=0.2,
                )
                run_btn.script_name = script_name
                run_btn.bind(on_press=self.run_script)
                row.add_widget(run_btn)

                # Script info
                info = Label(
                    text=f'{script_name}\n{description}',
                    halign='left',
                    valign='middle',
                    size_hint_x=0.8,
                )
                row.add_widget(info)

                content.add_widget(row)

            # Spacer
            content.add_widget(Label(text='', size_hint_y=None, height=10))

        scroll.add_widget(content)
        root.add_widget(scroll)

        # Buttons
        button_box = BoxLayout(size_hint_y=None, height=50, spacing=10)

        open_folder_btn = Button(text='Open Scripts Folder')
        open_folder_btn.bind(on_press=self.open_scripts_folder)
        button_box.add_widget(open_folder_btn)

        close_btn = Button(text='Close')
        close_btn.bind(on_press=self.stop)
        button_box.add_widget(close_btn)

        root.add_widget(button_box)

        return root

    def run_script(self, instance):
        """Run a script."""
        script_name = instance.script_name
        scripts_path = Path(local_path("scripts"))

        # Find the script
        script_path = None
        for subdir in ['setup', 'test', 'build', 'data', '']:
            check_path = scripts_path / subdir / script_name
            if check_path.exists():
                script_path = check_path
                break

        if not script_path:
            self.show_message("Error", f"Script not found: {script_name}")
            return

        # Run the script in a new terminal
        try:
            if sys.platform == 'win32':
                # Windows: open in new cmd window
                subprocess.Popen(
                    ['cmd', '/c', 'start', 'cmd', '/k', sys.executable, str(script_path)],
                    cwd=str(scripts_path.parent),
                )
            elif sys.platform == 'darwin':
                # macOS: open in Terminal
                subprocess.Popen([
                    'osascript', '-e',
                    f'tell application "Terminal" to do script "cd {scripts_path.parent} && {sys.executable} {script_path}"'
                ])
            else:
                # Linux: try common terminals
                terminals = ['gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm']
                for term in terminals:
                    try:
                        if term == 'gnome-terminal':
                            subprocess.Popen([
                                term, '--', sys.executable, str(script_path)
                            ], cwd=str(scripts_path.parent))
                        else:
                            subprocess.Popen([
                                term, '-e', f'{sys.executable} {script_path}'
                            ], cwd=str(scripts_path.parent))
                        break
                    except FileNotFoundError:
                        continue
                else:
                    # Fallback: run directly (output won't be visible)
                    subprocess.Popen(
                        [sys.executable, str(script_path)],
                        cwd=str(scripts_path.parent),
                    )

            self.show_message("Info", f"Launched: {script_name}")

        except Exception as e:
            self.show_message("Error", f"Failed to run script: {e}")

    def open_scripts_folder(self, instance):
        """Open the scripts folder in file manager."""
        scripts_path = Path(local_path("scripts"))

        if not scripts_path.exists():
            self.show_message("Error", "Scripts folder not found")
            return

        try:
            if sys.platform == 'win32':
                os.startfile(str(scripts_path))
            elif sys.platform == 'darwin':
                subprocess.Popen(['open', str(scripts_path)])
            else:
                subprocess.Popen(['xdg-open', str(scripts_path)])
        except Exception as e:
            self.show_message("Error", f"Failed to open folder: {e}")

    def show_message(self, title: str, message: str):
        """Show a popup message."""
        content = BoxLayout(orientation='vertical', padding=10)
        content.add_widget(Label(text=message))
        btn = Button(text='OK', size_hint_y=None, height=40)
        content.add_widget(btn)

        popup = Popup(title=title, content=content, size_hint=(0.8, 0.4))
        btn.bind(on_press=popup.dismiss)
        popup.open()


def run_scripts_gui(*args):
    """Run the scripts GUI."""
    app = ScriptsApp()
    app.run()


if __name__ == "__main__":
    run_scripts_gui()
