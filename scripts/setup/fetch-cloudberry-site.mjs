#!/usr/bin/env node
/**
 * Fetch the LIVE Cloudberry Kingdom site into a gitignored folder of this repo, so the
 * `cloudberry` substrate's panel can iframe it from the SAME ORIGIN as the frontend
 * (⚖ R18: the in-iframe bridge is injected by the host panel, which needs a same-origin
 * iframe; on GitHub Pages both sites are on peerinfinity.github.io, locally they are not).
 *
 *   node scripts/setup/fetch-cloudberry-site.mjs                  # the live site → frontend/external/cloudberry/
 *   node scripts/setup/fetch-cloudberry-site.mjs --force          # fetch again even when the build is unchanged
 *   node scripts/setup/fetch-cloudberry-site.mjs --base <url>     # another deployment of the site
 *   node scripts/setup/fetch-cloudberry-site.mjs --link <dir>     # a LOCAL build (build/build.sh --out <dir>): symlink it
 *   node scripts/setup/fetch-cloudberry-site.mjs --out <dir>      # another destination (a worktree's own copy, say)
 *   node scripts/setup/fetch-cloudberry-site.mjs --check          # is the copy there, complete, and the live build?
 *
 * ⛔ Nothing fetched here is ever committed (the game's compiled code and data are not ours to
 * redistribute): `frontend/external/` is in .gitignore.
 *
 * ── The file list comes from the build, not from this script ─────────────
 * The crawl starts at the page (`index.html`) and the files the build publishes about itself
 * (`build-info.json`, `content-manifest.json` — every Content file the page reads,
 * `_framework/blazor.boot.json` — every runtime file the .NET loader fetches), then follows every
 * relative reference written as a plain string in the HTML and the JavaScript it reaches
 * (`src=`/`href=`, `import … from '…'`, `import('…')`, `fetch('…')`). A file the page builds its
 * name for at run time with a template literal is not followed; only the beacon/log endpoints are
 * written that way today, and they are not files.
 *
 * Writes `.cloudberry-site.json` beside the copy: the source URL, the build id it fetched
 * (`build-info.json` → `build`), the file count and bytes. `--check` compares that build id
 * with the live one (or, for a `--link`ed build, only that its index.html is there).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP = `usage: node scripts/setup/fetch-cloudberry-site.mjs [--base <url>] [--out <dir>] [--force] [--check] [--link <site dir>]`;
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

export const DEFAULT_BASE = 'https://peerinfinity.github.io/cloudberry-kingdom-wasm/';
export const DEFAULT_OUT = path.join(repoRoot, 'frontend/external/cloudberry');
export const RECORD_FILE = '.cloudberry-site.json';

/** The files a build publishes about itself; the crawl's roots. */
export const ROOT_FILES = Object.freeze(['index.html', 'build-info.json', 'content-manifest.json', '_framework/blazor.boot.json']);

/**
 * Relative references a text file makes, as paths relative to the site root. Only string
 * literals: `src="…"`, `href="…"`, `from '…'`, `import('…')`, `fetch('…')`. Absolute URLs,
 * protocol-relative ones, anchors and query-only strings are skipped.
 */
export function referencesIn(text, fromPath) {
    const out = new Set();
    const patterns = [
        /\b(?:src|href)\s*=\s*["']([^"'#?]+)/g,
        /\bfrom\s+["']([^"'#?]+)["']/g,
        /\bimport\s*\(\s*["']([^"'#?]+)["']\s*\)/g,
        /\bfetch\s*\(\s*["']([^"'#?]+)["']/g,
    ];
    for (const re of patterns) {
        for (const m of text.matchAll(re)) {
            const ref = m[1].trim();
            if (!ref || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//') || ref.startsWith('/')) continue;
            if (!/\.[A-Za-z0-9]+$/.test(ref)) continue;   // a file, not a route
            const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), ref));
            if (resolved.startsWith('..')) continue;          // outside the site
            out.add(resolved);
        }
    }
    return [...out];
}

/** The files a published build-description names (content manifest, .NET boot config). */
export function filesNamedBy(relPath, text) {
    if (relPath === 'content-manifest.json') {
        const list = JSON.parse(text);
        if (!Array.isArray(list)) throw new Error('content-manifest.json is not a list');
        return list.filter((p) => typeof p === 'string');
    }
    if (relPath.endsWith('blazor.boot.json')) {
        const boot = JSON.parse(text);
        const dir = path.posix.dirname(relPath);
        const names = new Set();
        for (const [key, value] of Object.entries(boot.resources ?? {})) {
            if (key === 'hash' || !value || typeof value !== 'object') continue;
            for (const name of Object.keys(value)) names.add(name);
        }
        return [...names].map((n) => path.posix.join(dir, n));
    }
    return [];
}

async function fetchOk(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return Buffer.from(await res.arrayBuffer());
}

const TEXT_EXT = /\.(html|js|mjs|json|css)$/;

/** Crawl `base` into `out` (written to a temp dir, then swapped in). Returns the record. */
export async function fetchSite({ base = DEFAULT_BASE, out = DEFAULT_OUT, log = console.log } = {}) {
    const baseUrl = new URL(base.endsWith('/') ? base : `${base}/`);
    const tmp = `${out}.partial`;
    fs.rmSync(tmp, { recursive: true, force: true });
    const seen = new Set();
    const queue = [...ROOT_FILES];
    // _framework/dotnet.js is imported by main.js; the loader then reads blazor.boot.json.
    let bytes = 0;
    while (queue.length) {
        const rel = queue.shift();
        if (seen.has(rel)) continue;
        seen.add(rel);
        const data = await fetchOk(new URL(rel, baseUrl));
        bytes += data.length;
        const dest = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, data);
        if (TEXT_EXT.test(rel)) {
            const text = data.toString('utf8');
            for (const next of [...filesNamedBy(rel, text), ...(rel.endsWith('.json') ? [] : referencesIn(text, rel))]) {
                if (!seen.has(next)) queue.push(next);
            }
        }
        if (seen.size % 50 === 0) log(`  … ${seen.size} files, ${(bytes / 1048576).toFixed(1)} MB`);
    }
    const buildInfo = JSON.parse(fs.readFileSync(path.join(tmp, 'build-info.json'), 'utf8'));
    const record = {
        source: baseUrl.href,
        build: buildInfo.build ?? null,
        files: seen.size,
        bytes,
        fetchedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(tmp, RECORD_FILE), `${JSON.stringify(record, null, 2)}\n`);
    fs.rmSync(out, { recursive: true, force: true });
    fs.renameSync(tmp, out);
    return record;
}

export function readRecord(out = DEFAULT_OUT) {
    try { return JSON.parse(fs.readFileSync(path.join(out, RECORD_FILE), 'utf8')); } catch { return null; }
}

async function liveBuild(base) {
    return JSON.parse((await fetchOk(new URL('build-info.json', base))).toString('utf8')).build ?? null;
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); return 0; }
    const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
    const base = arg('--base') ?? DEFAULT_BASE;
    const out = path.resolve(arg('--out') ?? DEFAULT_OUT);
    const link = arg('--link');
    const rel = path.relative(repoRoot, out);

    if (argv.includes('--check')) {
        const isLink = fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink();
        if (!fs.existsSync(path.join(out, 'index.html'))) {
            console.error(`--check FAILED: no Cloudberry site at ${rel} (run this script without --check)`);
            return 1;
        }
        if (isLink) { console.log(`--check OK: ${rel} → ${fs.readlinkSync(out)} (a linked local build)`); return 0; }
        const rec = readRecord(out);
        const live = await liveBuild(rec?.source ?? base);
        if (!rec || rec.build !== live) {
            console.error(`--check FAILED: ${rel} holds build ${rec?.build ?? '(no record)'}, the live site is ${live}`);
            return 1;
        }
        console.log(`--check OK: ${rel} holds the live build ${live} (${rec.files} files, ${(rec.bytes / 1048576).toFixed(1)} MB)`);
        return 0;
    }

    if (link) {
        const target = path.resolve(link);
        if (!fs.existsSync(path.join(target, 'index.html'))) {
            console.error(`--link: ${target} has no index.html (build it with build/build.sh --out <dir> in the Cloudberry repo)`);
            return 1;
        }
        fs.rmSync(out, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.symlinkSync(target, out, 'dir');
        let build = null;
        try { build = JSON.parse(fs.readFileSync(path.join(target, 'build-info.json'), 'utf8')).build; } catch { /* optional */ }
        console.log(`linked ${rel} → ${target} (build ${build ?? '?'})`);
        return 0;
    }

    if (!argv.includes('--force')) {
        const rec = readRecord(out);
        if (rec) {
            const live = await liveBuild(rec.source);
            if (rec.build === live && rec.source === new URL(base.endsWith('/') ? base : `${base}/`).href) {
                console.log(`${rel} already holds the live build ${live} (--force fetches it again)`);
                return 0;
            }
        }
    }
    console.log(`fetching ${base} → ${rel}`);
    const rec = await fetchSite({ base, out });
    console.log(`fetched build ${rec.build}: ${rec.files} files, ${(rec.bytes / 1048576).toFixed(1)} MB → ${rel}`);
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().then((code) => process.exit(code), (err) => { console.error(err); process.exit(1); });
}
