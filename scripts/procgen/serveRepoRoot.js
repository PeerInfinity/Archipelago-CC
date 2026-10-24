/**
 * serveRepoRoot — the read-only static server the seedling browser rows bring
 * WITH them, on a free port.
 *
 * ⛓⛓⛓ WHY IT IS A MODULE AND NOT A COPY (PROCGEN PoC slice 5). It was
 * `export-seedling-view.mjs`'s own function, and slice 4's docblock already
 * said why that mattered: *"the only browser coverage before it SKIPPED (exit
 * 0) when no server was up, and that graceful skip hid a page that could not
 * load AT ALL for two rungs (trap 176). A tool that starts its own server has
 * nothing to skip on."* The moment a SECOND row wanted the same property,
 * the choice was one server or two — and two static servers that must agree
 * about MIME types and directory listings is a fork nobody would notice until
 * a module was served as octet-stream on one of them.
 *
 * ⚠ MOVED VERBATIM. The body is byte-for-byte what the exporter ran; the
 * hoist's whole content is that a second caller can reach it. (The editor
 * arc's own `createRunForStaging` hoist, one layer out.)
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

export const MIME = {
    '.html': 'text/html; charset=utf-8',
    // ⛔ ES MODULES NEED A JAVASCRIPT MIME TYPE — a browser refuses to
    // execute a module served as octet-stream, and the page is all modules.
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.jsonl': 'application/x-ndjson',
};

/**
 * A read-only static file server over the repo root, on a free port.
 *
 * `routes` is an optional map of exact pathname → Buffer, for bytes a caller
 * holds that do not live under the repo root at all (⛓ PROCGEN PoC slice 5's
 * `--generated=` payload). Everything else is a file, or a 404.
 */
export function serveRepoRoot({ routes = null } = {}) {
    const server = createServer((req, res) => {
        let rel;
        try {
            rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        } catch {
            res.writeHead(400).end('bad path');
            return;
        }
        if (routes && Object.prototype.hasOwnProperty.call(routes, rel)) {
            res.writeHead(200, { 'Content-Type': MIME['.json'] }).end(routes[rel]);
            return;
        }
        const file = join(REPO_ROOT, rel);
        // ⛔ Never above the root, whatever the caller asks for.
        if (!file.startsWith(REPO_ROOT) || !existsSync(file)) {
            res.writeHead(404).end('not found');
            return;
        }
        /**
         * ⛓ DIRECTORY LISTINGS, BECAUSE THE PAGE READS THEM.
         *
         * `loadTapeIndex` builds the tape picker AND the boot presets from
         * the dev server's own listing (`href="…json"`), deliberately — a
         * committed manifest would go stale between a recording and the
         * regeneration that noticed. A server without one is a working page
         * with NO PICKER, which is a different page than the one a person
         * sees at :8000, and this tool exports what the page shows.
         *
         * Same shape as `python3 -m http.server`'s listing, which is the
         * documented dev server and therefore the thing to be equivalent to.
         */
        if (statSync(file).isDirectory()) {
            const names = readdirSync(file).sort();
            const links = names
                .map((n) => `<li><a href="${encodeURIComponent(n)}">${n}</a></li>`).join('\n');
            res.writeHead(200, { 'Content-Type': MIME['.html'] })
                .end(`<!DOCTYPE html><title>${rel}</title><ul>\n${links}\n</ul>`);
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
            .end(readFileSync(file));
    });
    return new Promise((ok, no) => {
        server.once('error', no);
        server.listen(0, '127.0.0.1', () => ok(server));
    });
}

/** Shut a server down and wait for it, including its keep-alive sockets. */
export async function closeServer(server) {
    if (!server) return;
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
}
