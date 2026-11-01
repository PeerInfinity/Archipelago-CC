/**
 * seedlingSolidsRope.test.js — THE JS PAGE'S ROPE (`seedlingSolidsSkin.ropeSkinView` + `ropeOps`), drawn per
 * `Puzzlements/RopeStart.as:51-76` from `seedling:puzzlement/rope` (RopePulley.png).
 *
 *   A. BY HAND from the AS3: an uncut rope is frame 1 at every 16-px cell from `x` to `xend` (exclusive), then
 *      frame 0 at `x` and frame 2 at `xend` (`x = _x + 8`, `xend = _xend + 8`, `:22-24`); cut is [0 at x, 3 at xend].
 *   B. THE RUN'S CUT, on real tapes: the L28 cut witness flips [1,1,0,2] → [0,3] on the tick the run banks its
 *      `ropePulls` row; F7's L16 re-entry (the rope's tag cleared) is cut from the first tick (`bootPulled`).
 *   C. NO KEY → `null`, and the room keeps the rope's build-time stand-in rect; with the key, exactly that rect goes.
 *   D. The census row for `rope` is RopeStart / drawn (it was `none`), and it is the only row that moved.
 *   E. ⛔ RENDER ONLY: the run's stream and `stateDigest` are identical with the view and the ops called every tick.
 *   F. THE PAGE (`jsRuntimePage.js`) parses, appends the rope's ops to the solids', and claims the rope's stand-in only
 *      while they are drawn. The browser row `seedling-js-runtime-graphics-rope` is the real page's pin.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { runTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { formatOp, roomOps } from './seedlingSkinRenderer.js';
import { SKIN_CENSUS } from './seedlingSkinCensus.js';
import {
    ROPE_FRAMES, ROPE_KEY, ROPE_OBJECT_TAGS, SOLIDS_COVERAGE, ropeCells, ropeOps, ropeSkinView,
} from './seedlingSolidsSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const tapeOf = (path) => JSON.parse(readFileSync(join(HERE, 'fixtures', path), 'utf8'));
const L28_CUT = () => tapeOf('rope-witness/rope-l28-cut.json').tape;
const F7_L16 = () => tapeOf('tapes/f7-l16-reentry.json');

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/** `RopeStart.render()`'s cells, BY HAND from the `.oel` entity (`_x`, the `<node>`'s x): not via `ropeCells`. */
function asCells(level, cut) {
    const e = MAP.levels.find((l) => l.level === level).entities.find((x) => x.type === 'rope');
    const x = e.x + 8;
    const xend = e.nodes.at(-1).x + 8;
    const out = [];
    if (!cut) for (let i = 0; i < xend - x; i += 16) out.push(`1@${x + i - 8},${e.y}`);
    out.push(`0@${x - 8},${e.y}`, `${cut ? 3 : 2}@${xend - 8},${e.y}`);
    return out;
}
const framesOf = (ops) => (ops ?? []).filter((o) => o.key === ROPE_KEY).map((o) => `${o.frame}@${o.dx},${o.dy}`);
const pageRopeOps = (run, a = art) => {
    const v = ropeSkinView(run);
    return v ? ropeOps(v.ropes, a, v.cut) : null;
};

/** Play a tape; per tick, the run's level, its `ropePulls` count and the page's rope frames. */
function scrub(tape) {
    const rows = [];
    runTape(tape, {
        levelSource: atlasLevelSource(),
        onTick: (t, now, held, run) => rows.push({ t, level: run.level, pulls: run.ropePulls.length, frames: framesOf(pageRopeOps(run)) }),
    });
    return rows;
}

describe('A. by hand from RopeStart.render (:51-76)', () => {
    it('ropeCells: uncut [1 per cell x..xend), 0 at x, 2 at xend]; cut [0 at x, 3 at xend]', () => {
        expect(ropeCells({ x: 40, xend: 88, cut: false })).toEqual([
            { frame: 1, x: 40 }, { frame: 1, x: 56 }, { frame: 1, x: 72 }, { frame: 0, x: 40 }, { frame: 2, x: 88 }]);
        expect(ropeCells({ x: 40, xend: 88, cut: true })).toEqual([{ frame: 0, x: 40 }, { frame: 3, x: 88 }]);
        expect(ROPE_FRAMES).toEqual({ pulley: 0, span: 1, handle: 2, handleCut: 3 });
    });
    it('every vanilla rope room, built uncut: the page draws exactly the AS3 cells, layer -(_y + 8)', () => {
        for (const level of [16, 28, 39]) {
            const world = buildLevelWorld(levelSourceFromAtlas(MAP)(level));
            const ops = ropeOps(world.objectSolids, art, () => false);
            expect(framesOf(ops), `L${level}`).toEqual(asCells(level, false));
            const e = MAP.levels.find((l) => l.level === level).entities.find((x) => x.type === 'rope');
            expect(ops.every((o) => o.sheetRef && o.layer === -(e.y + 8)), `L${level}`).toBe(true);
        }
        expect(asCells(16, false)).toEqual(['1@32,16', '1@48,16', '1@64,16', '0@32,16', '2@80,16']);
    });
});

describe('B. the run\'s cut state (`pulledRopes` / `bootPulled`), on real tapes', () => {
    it('L28 cut witness: uncut until the run banks its `ropePulls` row, then [0 at x, 3 at xend] on that very tick', () => {
        const rows = scrub(L28_CUT()).filter((r) => r.level === 28);
        const pulledAt = rows.findIndex((r) => r.pulls > 0);
        expect(pulledAt).toBeGreaterThan(0);
        for (const r of rows.slice(0, pulledAt)) expect(r.frames, `t${r.t}`).toEqual(asCells(28, false));
        for (const r of rows.slice(pulledAt)) expect(r.frames, `t${r.t}`).toEqual(asCells(28, true));
        expect(asCells(28, true)).toEqual(['0@160,64', '3@192,64']);
    });
    it('F7 L16 re-entry ({16,0} cleared): cut from the first tick — RopeStart.check() re-pulls at the build', () => {
        const rows = scrub(F7_L16()).filter((r) => r.level === 16);
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) expect(r.frames, `t${r.t}`).toEqual(asCells(16, true));
    });
});

describe('C. no pack key → the old rect', () => {
    const world = () => buildLevelWorld(levelSourceFromAtlas(MAP)(16));
    it('ropeOps is null without the key (and without a stack), so the page leaves the rope unclaimed', () => {
        const without = { has: (k) => k !== ROPE_KEY && art.has(k), packOf: art.packOf };
        expect(ropeOps(world().objectSolids, without)).toBeNull();
        expect(ropeOps(world().objectSolids, null)).toBeNull();
    });
    it('the room without art keeps the rope\'s stand-in; claiming ROPE_OBJECT_TAGS drops exactly that rect', () => {
        const w = world();
        const rope = w.objectSolids.find((s) => s.ropeId);
        const base = roomOps(w, art, { level: 16 }).map(formatOp);
        const claimed = roomOps(w, art, { level: 16, drawnObjects: (o) => ROPE_OBJECT_TAGS.has(o.tag) }).map(formatOp);
        expect(base.length - claimed.length).toBe(1);
        const gone = base.filter((l) => !claimed.includes(l));
        expect(gone).toHaveLength(1);
        expect(gone[0]).toContain(`, ${rope.rect.x}, ${rope.rect.y}, ${rope.span.w}, 16)`);   // the span's one rect
        // no stack at all: the page passes no `drawnObjects` (`jsRuntimePage`), so the rect is drawn
        expect(roomOps(w, null, { level: 16 }).map(formatOp)).toContain(gone[0]);
    });
});

describe('D. the census: the rope row (and only it) moved to drawn', () => {
    it('rope is RopeStart / drawn, and RopeStart is in SOLIDS_COVERAGE.drawn', () => {
        expect(SKIN_CENSUS.find((r) => r.tag === 'rope')).toMatchObject({ tag: 'rope', as3: 'RopeStart', status: 'drawn' });
        expect(SOLIDS_COVERAGE.drawn).toContain('RopeStart');
    });
    it('the `none` rows are the settings and effects that were `none` before this slice, minus the rope', () => {
        expect(SKIN_CENSUS.filter((r) => r.status === 'none').map((r) => r.tag)).toEqual(
            ['shadow', 'lightray', 'lightalpha', 'daynight', 'droplet', 'control', 'blur', 'snow', 'blur2']);
        expect(SKIN_CENSUS.filter((r) => r.status === 'remaining')).toEqual([]);
    });
});

describe('E. ⛔ render only — the run is untouched', () => {
    const play = (tape, draw) => {
        const stream = [];
        let last = null;
        runTape(tape, {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => {
                if (draw) pageRopeOps(run);
                last = run;
                stream.push(JSON.stringify([t, run.level, now]));
            },
        });
        return { stream, digest: JSON.stringify(last.stateDigest()), pulls: JSON.stringify(last.ropePulls) };
    };
    for (const [name, tape] of [['L28 cut', L28_CUT], ['F7 L16', F7_L16]]) {
        it(`${name}: stream, ropePulls and stateDigest identical with the rope drawn every tick`, () => {
            expect(play(tape(), true)).toEqual(play(tape(), false));
        });
    }
});

describe('F. the page wiring (jsRuntimePage.js)', () => {
    const PAGE = join(HERE, 'jsRuntimePage.js');
    it('parses (a redeclared const there blanks the whole page)', () => {
        expect(() => execFileSync(process.execPath, ['--check', PAGE], { stdio: 'pipe' })).not.toThrow();
    });
    it('draws ropeOps with the solids and claims ROPE_OBJECT_TAGS only when they are drawn', () => {
        const src = readFileSync(PAGE, 'utf8');
        expect(src).toContain('ropeOps(ropeView.ropes, art, ropeView.cut)');
        expect(src).toContain('...(ropeSprites ?? [])]');
        expect(src).toContain('(ropeSprites !== null && ROPE_OBJECT_TAGS.has(o.tag))');
    });
});
