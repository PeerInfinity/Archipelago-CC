#!/usr/bin/env python3
"""Dev HTTP server that disables browser caching.

`python -m http.server` sends Last-Modified but no Cache-Control, so
browsers apply heuristic caching (~10% of the file's age since last
modification) and serve stale modules without revalidating — on mobile
there's no ctrl+shift+R to force past it. This wrapper serves the same
directory tree but stamps every response with `Cache-Control: no-store`,
so every load fetches fresh bytes.

It also answers `GET /_source-mtime` with the newest file mtime under
`frontend/` (excluding dist/ and node_modules/) as JSON — the Options
panel's build stamp fetches it in unbundled dev to show "sources
<last-modified>" beside the page-load time (app/buildInfo.js). On a
plain `python -m http.server` the fetch 404s and the stamp falls back
to load time only.

Usage (from the repo root, mirrors the plain dev server):
    python scripts/serve-nocache.py [port]     # default 8002
"""

import json
import os
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# newest-mtime scan cache: (expires_at, payload_bytes) — the walk costs a
# few thousand stats, so amortize rapid polls without going stale enough
# to matter for a human-readable stamp.
_MTIME_TTL_S = 2.0
_mtime_cache = [0.0, None]

_SKIP_DIRS = {'dist', 'node_modules', '__pycache__', 'test_dumps'}


def _newest_source_mtime(root='frontend'):
    newest, newest_path = 0.0, None
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames
                       if d not in _SKIP_DIRS and not d.startswith('.')]
        for name in filenames:
            path = os.path.join(dirpath, name)
            try:
                m = os.stat(path).st_mtime
            except OSError:
                continue
            if m > newest:
                newest, newest_path = m, path
    return newest, newest_path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?')[0] == '/_source-mtime':
            return self._send_source_mtime()
        return super().do_GET()

    def _send_source_mtime(self):
        now = time.monotonic()
        if _mtime_cache[1] is None or now > _mtime_cache[0]:
            newest, path = _newest_source_mtime()
            if newest == 0.0:
                self.send_error(404, 'no frontend/ tree here')
                return
            iso = time.strftime('%Y-%m-%dT%H:%M:%S%z', time.localtime(newest))
            _mtime_cache[0] = now + _MTIME_TTL_S
            _mtime_cache[1] = json.dumps({'mtime': iso, 'file': path}).encode()
        body = _mtime_cache[1]
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8002
    server = ThreadingHTTPServer(('0.0.0.0', port), NoCacheHandler)
    print(f'Serving with Cache-Control: no-store on http://0.0.0.0:{port}/')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
