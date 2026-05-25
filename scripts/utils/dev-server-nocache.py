#!/usr/bin/env python3
"""
Development server with cache disabled.
This prevents browser caching issues during development.

Also handles POST /_dump for in-app test snapshot dumps — see
frontend/modules/tests/README.md (testController.dumpSnapshot).
Dumps land in test_dumps/ (gitignored).
"""
import http.server
import socketserver
import re
from datetime import datetime
import os

# Snapshot-dump target directory (relative to project root). Created
# on first POST. Filenames: {timestamp}_{name}.json
DUMP_DIR = "test_dumps"
# Sanitize dump-name to a safe filename segment. Anything outside this
# range gets replaced with underscores.
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")
# Reject payloads above this size — guards against runaway dumps
# filling the disk. 32 MiB is generous for procgen / state snapshots.
MAX_DUMP_BYTES = 32 * 1024 * 1024

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with cache control headers."""

    def end_headers(self):
        """Add no-cache headers to all responses."""
        self.send_no_cache_headers()
        super().end_headers()

    def send_no_cache_headers(self):
        """Send headers to prevent browser caching."""
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        # Add timestamp to help identify fresh responses
        self.send_header("X-Timestamp", datetime.now().isoformat())

    def log_message(self, format, *args):
        """Override to add timestamp to console logs."""
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] {format % args}")

    def do_POST(self):
        """Handle POST /_dump?name=<name> — write request body to disk."""
        if not self.path.startswith("/_dump"):
            self.send_error(404, "Not Found")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400, "Invalid Content-Length")
            return
        if length <= 0:
            self.send_error(400, "Empty body")
            return
        if length > MAX_DUMP_BYTES:
            self.send_error(413, f"Payload too large (max {MAX_DUMP_BYTES} bytes)")
            return

        # Parse optional ?name= from the query string. Anything else
        # is ignored.
        name = "dump"
        if "?" in self.path:
            _, _, qs = self.path.partition("?")
            for kv in qs.split("&"):
                if kv.startswith("name="):
                    name = kv[5:]
                    break
        name = _SAFE_NAME.sub("_", name) or "dump"

        body = self.rfile.read(length)
        os.makedirs(DUMP_DIR, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        path = os.path.join(DUMP_DIR, f"{ts}_{name}.json")
        with open(path, "wb") as f:
            f.write(body)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(f'{{"ok":true,"path":"{path}"}}'.encode("utf-8"))

    def do_OPTIONS(self):
        """Preflight for POST /_dump from browser fetch."""
        if not self.path.startswith("/_dump"):
            self.send_error(404, "Not Found")
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

def main():
    PORT = 8000

    # Change to the project root directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    os.chdir(project_root)

    print(f"Starting development server at http://localhost:{PORT}/")
    print("Cache-Control headers enabled - browser caching disabled")
    print(f"Serving from: {os.getcwd()}")
    print("Press Ctrl+C to stop")
    print("-" * 50)

    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")

if __name__ == "__main__":
    main()