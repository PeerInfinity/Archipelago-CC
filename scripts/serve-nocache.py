#!/usr/bin/env python3
"""Dev HTTP server that disables browser caching.

`python -m http.server` sends Last-Modified but no Cache-Control, so
browsers apply heuristic caching (~10% of the file's age since last
modification) and serve stale modules without revalidating — on mobile
there's no ctrl+shift+R to force past it. This wrapper serves the same
directory tree but stamps every response with `Cache-Control: no-store`,
so every load fetches fresh bytes.

Usage (from the repo root, mirrors the plain dev server):
    python scripts/serve-nocache.py [port]     # default 8002
"""

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


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
