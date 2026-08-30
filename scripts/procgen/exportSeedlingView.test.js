/**
 * exportSeedlingView — the pure half of the editor arc's CLI export.
 *
 * These are the rows that run in CI, where there is no browser and no
 * server: argument splitting, URL assembly, and — the one that matters —
 * the VERDICT, which is trap 184's law in code (a named refusal exits
 * non-zero and writes nothing; a partial frame is not a success).
 *
 * The browser-side row is `scripts/procgen/check-seedling-editor-export.mjs`,
 * which drives the real CLI end to end, refusal included.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    CLI_FLAGS, EXIT, PAGE_PARAMS, PAGE_PATH, TICK_LAST, buildViewUrl, classify,
    isExpectedSidecar404, parseArgs, readPngHeader, wantsLastTick,
} from './exportSeedlingView.js';

const WATCH_HTML = fileURLToPath(
    new URL('../../frontend/modules/seedlingDemo/watch.html', import.meta.url));

describe('parseArgs — the CLI\'s flags vs the PAGE\'s parameters', () => {
    it('forwards every page parameter verbatim and keeps the CLI\'s own', () => {
        const { opts, page, bad } = parseArgs([
            '--out=/tmp/a.png', '--trace', '--timeout=5000',
            '--tape=fixtures/tapes/r8-solve-18.json', '--layers=player,arrows', '--tick=247',
        ]);
        expect(bad).toEqual([]);
        expect(opts.out).toBe('/tmp/a.png');
        expect(opts.trace).toBe(true);
        expect(opts.timeout).toBe(5000);
        expect([...page]).toEqual([
            ['tape', 'fixtures/tapes/r8-solve-18.json'],
            ['layers', 'player,arrows'],
            ['tick', '247'],
        ]);
    });

    it('takes a raw query string, and an individual flag WINS over it', () => {
        const { page } = parseArgs([
            '--out=/tmp/a.png', '--params=tape=t.json&tick=10&layers=player', '--tick=99',
        ]);
        expect(page.get('tape')).toBe('t.json');
        expect(page.get('layers')).toBe('player');
        // The more specific statement wins — the raw string is the bulk form.
        expect(page.get('tick')).toBe('99');
    });

    it('REFUSES a run with nothing to draw, and one that names no PNG', () => {
        expect(parseArgs(['--out=/tmp/a.png']).bad.join(' ')).toMatch(/nothing to draw/);
        expect(parseArgs(['--tape=t.json']).bad.join(' ')).toMatch(/--out=.*required/);
        expect(parseArgs(['--tape=t.json', '--out=/tmp/a.jpg']).bad.join(' '))
            .toMatch(/must name a \.png/);
        expect(parseArgs(['--tape=t.json', '--out=/tmp/a.png', '--timeout=soon']).bad.join(' '))
            .toMatch(/--timeout=/);
    });

    it('a --boot= view (SOLVE) is a view; so is a bare --level=', () => {
        expect(parseArgs(['--out=/tmp/a.png', '--boot=b.json', '--solve=1']).bad).toEqual([]);
        expect(parseArgs(['--out=/tmp/a.png', '--level=4']).bad).toEqual([]);
    });

    it('NAMES an unknown parameter rather than dropping it', () => {
        const { page, unknown } = parseArgs(['--out=/tmp/a.png', '--tape=t.json', '--nonesuch=7']);
        expect(unknown).toEqual(['nonesuch']);
        // …and still forwards it: the page reports what it does not know.
        expect(page.get('nonesuch')).toBe('7');
    });

    /**
     * ⛔ THE COLLISION ROW. Every argument that is not one of the CLI's own
     * flags becomes a URL parameter, so a CLI flag sharing a name with a
     * page parameter would SILENTLY SWALLOW it and export a different view
     * than the caller asked for.
     */
    it('no CLI flag shares a name with a page parameter', () => {
        expect(CLI_FLAGS.filter((f) => PAGE_PARAMS.includes(f))).toEqual([]);
    });

    /**
     * ⛓ AND THE PAGE PARAMETER LIST IS CHECKED AGAINST THE PAGE, not against
     * itself. `watch.html`'s docblock carries "URL PARAMETERS, THE WHOLE SET";
     * if the page grows one and this list does not, the CLI would warn about
     * a parameter that is perfectly real.
     */
    it('PAGE_PARAMS is exactly what watch.html\'s docblock declares', () => {
        const html = readFileSync(WATCH_HTML, 'utf8');
        const block = html.split('URL PARAMETERS, THE WHOLE SET')[1].split('⛔')[0];
        const declared = [...block.matchAll(/\?([a-z]+)[=\s]/g)].map((m) => m[1]);
        expect(new Set(declared)).toEqual(new Set(PAGE_PARAMS));
    });
});

describe('buildViewUrl — ?shot=1 is not negotiable', () => {
    it('assembles the page URL with the caller\'s parameters', () => {
        const { url, forcedShot } = buildViewUrl('http://127.0.0.1:1234',
            new Map([['tape', 'a/b.json'], ['tick', '247']]));
        expect(url).toBe(`http://127.0.0.1:1234${PAGE_PATH}?tape=a%2Fb.json&tick=247&shot=1`);
        expect(forcedShot).toBe(null);
    });

    /**
     * ⛓ `--tick=last` IS RESOLVED BY THE CLI, NOT SENT TO THE PAGE. The page
     * reads `?tick=` as a whole number and says so when it cannot (`tick=last`
     * would leave the cursor at 0 with a note about it) — so the first load
     * must carry NO tick at all, and the second the concrete number.
     */
    it('--tick=last is absent on the first load and concrete on the second', () => {
        const page = new Map([['tape', 't.json'], ['tick', TICK_LAST]]);
        expect(wantsLastTick(page)).toBe(true);
        expect(buildViewUrl('http://x', page).url).not.toMatch(/tick=/);
        expect(buildViewUrl('http://x', page, { tick: 347 }).url).toMatch(/tick=347/);
        // …and an ordinary tick is nobody's business but the page's.
        expect(wantsLastTick(new Map([['tick', '247']]))).toBe(false);
    });

    it('FORCES shot=1 and reports the override — a shutter on an animating page', () => {
        const { url, forcedShot } = buildViewUrl('http://x',
            new Map([['tape', 't.json'], ['shot', '0']]));
        expect(url).toMatch(/shot=1$/);
        expect(url).not.toMatch(/shot=0/);
        expect(forcedShot).toBe('0');
    });
});

describe('classify — ⛓⛓⛓ trap 184: a named refusal never exits 0', () => {
    it('a drawn frame with a clean status is the only exit 0', () => {
        expect(classify({ ready: true, refused: false }))
            .toEqual({ code: EXIT.ok, write: true, why: null });
    });

    it('a REFUSAL exits non-zero and writes NOTHING — with the page\'s own message', () => {
        const v = classify({
            ready: false, refused: true,
            message: 'the solver REFUSED — tape_version 8 has no mid-run clear',
        });
        expect(v.code).toBe(EXIT.refused);
        expect(v.write).toBe(false);
        expect(v.why).toMatch(/tape_version 8 has no mid-run clear/);
    });

    /**
     * ⛔ THE ROW THE RULE EXISTS FOR. A run that throws mid-way draws the
     * frames it GOT and raises the readiness flag anyway, so "there are
     * pixels" is not evidence the view is the one that was asked for. The
     * refusal outranks the frame, and the partial frame is named.
     */
    it('a PARTIAL frame is a refusal, not a success', () => {
        const v = classify({ ready: true, refused: true, message: 'the run threw before finishing' });
        expect(v.code).toBe(EXIT.refused);
        expect(v.write).toBe(false);
        expect(v.why).toMatch(/PARTIAL frame was drawn and deliberately NOT written/);
    });

    it('never reaching readiness is its OWN fact, with the last status attached', () => {
        const v = classify({ ready: false, refused: false, message: 'loading…' });
        expect(v.code).toBe(EXIT.timeout);
        expect(v.write).toBe(false);
        expect(v.why).toMatch(/never raised its readiness flag.*loading…/);
    });

    it('page errors: the frame IS written, and the exit is still non-zero', () => {
        const v = classify({ ready: true, refused: false, pageErrors: ['pageerror: boom'] });
        expect(v.code).toBe(EXIT.pageErrors);
        expect(v.write).toBe(true);
        expect(v.why).toMatch(/boom/);
    });

    it('every exit code is distinct — a caller can tell the four apart', () => {
        expect(new Set(Object.values(EXIT)).size).toBe(Object.values(EXIT).length);
    });
});

describe('the expected 404 class', () => {
    it('is the trace sidecar, and nothing else', () => {
        expect(isExpectedSidecar404(
            'Failed to load resource: 404 [http://x/fixtures/traces/r4-walk-full.trace.json]',
        )).toBe(true);
        expect(isExpectedSidecar404(
            'Failed to load resource: 404 [http://x/fixtures/tapes/r4-walk-full.json]',
        )).toBe(false);
    });
});

describe('readPngHeader — the acceptance row\'s claim is "a PNG of this size"', () => {
    /** A real IHDR: signature, length, "IHDR", width, height. */
    const png = (w, h) => Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0, 0, 0, 13]), Buffer.from('IHDR'),
        Buffer.from([w >> 24 & 255, w >> 16 & 255, w >> 8 & 255, w & 255]),
        Buffer.from([h >> 24 & 255, h >> 16 & 255, h >> 8 & 255, h & 255]),
        Buffer.alloc(8),
    ]);

    it('reads the dimensions out of the bytes', () => {
        expect(readPngHeader(png(576, 432))).toEqual({ isPng: true, width: 576, height: 432 });
    });

    it('and 8 KB of noise is not a PNG', () => {
        expect(readPngHeader(Buffer.alloc(8192, 7)).isPng).toBe(false);
        expect(readPngHeader(Buffer.from('nope')).isPng).toBe(false);
    });
});
