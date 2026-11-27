/**
 * region-map painter-throws: a cell's painter draws the DESERIALIZED world, never the sidecar's JSON shape.
 *
 * ⚖ The user, session 84c8ab35, 2026-11-26T21:00:02.464Z: "Yes, find and fix it (Recommended)" (a Region Map painter
 * throwing `world.obstacles.get is not a function` ~2,190 times per TT fast job).
 *
 * The cause: `buildRegionMapModel` handed every painter the sidecar's `playable_payload` as stored in rules.json, where
 * a maze world's `obstacles` / `items` are `[key, id]` lists. The maze painter (`mazeCompositeMap.drawRegion`) reads
 * them as Maps, as its contract says (and as `compositeMapDocument` — the pipeline's Map tab — hands them, through the
 * substrate's own `deserializeWorld`), so every maze cell threw after its floor pass. The same unhydrated payload made
 * every text-adventure cell draw its gated exits OPEN: a room's gates live in `exitGates` until `deserializeWorld`
 * folds them onto the exits.
 *
 * ⛔ Over FROZEN fixtures (verbatim copies of two committed presets, `fixtures/painter-throws-*.frozen.json`), plus a
 * sweep of every committed preset whose assertions are derived (0 throws), never pinned digests.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildRegionMapModel } from './regionMapModel.js';
import { COLORS, compositeMapIdOf, compositeMapPainterFor } from '../procgenCore/compositeMapRenderer.js';
import { SUBSTRATE_LIBRARIES } from '../procgenCore/substrateLibraries.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
// Every registered substrate library (held equal to `SUBSTRATE_LIBRARIES` below, so a new one cannot escape the sweep).
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import '../cloudberryDemo/cloudberryLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import '../flashPanel/flashSeedlingLibrary.js';
import '../flashPanel/flashSeedlingGenBuild.js';
import '../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import '../omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js';
import '../noiz2saSubstrate/noiz2saSubstrateLibrary.js';
import '../actionNodes/actionNodesLibrary.js';
import '../mysteryArchipelago/mysterySubstrateLibrary.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const MAZE = './fixtures/painter-throws-maze.frozen.json';
const MIXED = './fixtures/painter-throws-topdown-mixed.frozen.json';

/** A canvas that accepts every call and records the `fillStyle` of each `fillRect` (squares, not text), in order. */
function recordingCtx() {
    const fills = [];
    const noop = () => {};
    const target = { fills };
    return new Proxy(target, {
        get: (t, k) => {
            if (k === 'fillRect') return () => fills.push(t.fillStyle);
            if (k in t) return t[k];
            if (k === 'measureText') return () => ({ width: 1 });
            if (k === 'createImageData' || k === 'getImageData') {
                return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(4 * w * h), width: w, height: h });
            }
            return noop;
        },
        set: (t, k, v) => { t[k] = v; return true; },
    });
}

function paint(cell, rules, player) {
    const ctx = recordingCtx();
    compositeMapPainterFor(cell.region, substrateRegistry)(ctx, cell.region, {
        offX: 0, offY: 0, regionSize: { width: 20, height: 20 }, tilePx: 16, colors: COLORS,
        source: { rules, playerId: player }, requestRedraw: () => {},
    });
    return ctx.fills;
}

const paintedCells = (model) => [...model.cells.values()].filter((c) => c.region && compositeMapPainterFor(c.region, substrateRegistry));

const IMPORTED = ['mazeRoom/mazeRoomLibrary.js', 'bounceDemo/bounceDemoLibrary.js', 'cloudberryDemo/cloudberryLibrary.js', 'textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js', 'flashPanel/flashSeedlingLibrary.js', 'flashPanel/flashSeedlingGenBuild.js', 'jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js', 'omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js', 'noiz2saSubstrate/noiz2saSubstrateLibrary.js', 'actionNodes/actionNodesLibrary.js', 'mysteryArchipelago/mysterySubstrateLibrary.js'];

it('the sweep imports every substrate library', () => {
    expect([...IMPORTED].sort()).toEqual([...SUBSTRATE_LIBRARIES].sort());
});

describe('the failing shape, reproduced', () => {
    it('the maze painter throws `obstacles.get` on the sidecar JSON shape (what the Region Map used to hand it)', () => {
        const rules = read(MAZE);
        const [name, sc] = Object.entries(rules.preset_sidecars['1'])[0];
        expect(Array.isArray(sc.playable_payload.obstacles)).toBe(true);
        const raw = { region_id: name, substrate: sc.substrate, render_hint: sc.render_hint, playable_payload: sc.playable_payload, exits: [] };
        expect(() => paint({ region: raw }, rules, '1')).toThrow(/obstacles\.get is not a function/);
    });
});

describe('the model hands each painter its substrate\'s deserialized world', () => {
    it('maze: every cell paints without throwing; its world carries Maps', () => {
        const rules = read(MAZE);
        const model = buildRegionMapModel({ rules, player: '1' });
        const cells = paintedCells(model);
        expect(cells.length).toBe(Object.keys(rules.preset_sidecars['1']).length);
        for (const cell of cells) {
            expect(cell.region.playable_payload.obstacles).toBeInstanceOf(Map);
            expect(cell.region.playable_payload.items).toBeInstanceOf(Map);
            expect(() => paint(cell, rules, '1')).not.toThrow();
        }
        expect(model.refused).toEqual([]);
    });

    it('text adventure: a gated exit draws CLOSED (its `exitGates` folded onto the exit)', () => {
        const rules = read(MIXED);
        const sidecars = rules.preset_sidecars['1'];
        const gated = Object.entries(sidecars).filter(([, sc]) => sc.substrate === 'text_adventure'
            && Object.keys(sc.playable_payload?.exitGates ?? {}).length > 0);
        expect(gated.length).toBeGreaterThan(0);
        const model = buildRegionMapModel({ rules, player: '1' });
        for (const [name] of gated) {
            const cell = [...model.cells.values()].find((c) => c.members.includes(name) && c.region);
            expect(cell, name).toBeTruthy();
            expect(paint(cell, rules, '1')).toContain(COLORS.exitBlocked);
        }
    });

    it('no region of the mixed document is refused, and a cell still carries no edge exits (step-1 residue)', () => {
        const rules = read(MIXED);
        const model = buildRegionMapModel({ rules, player: '1' });
        for (const cell of model.cells.values()) {
            if (cell.region) expect(cell.region.exits).toEqual([]);
        }
        expect(model.refused).toEqual([]);
    });
});

describe('sweep: every painter over every committed preset\'s regions it claims', () => {
    it('0 throws', () => {
        const root = here('../../../');
        const files = execFileSync('git', ['ls-files', 'frontend/presets'], { cwd: root, encoding: 'utf8' })
            .split('\n').filter((f) => f.endsWith('_rules.json'));
        const throws = [];
        const byPainter = new Map();
        for (const f of files) {
            let rules;
            try { rules = JSON.parse(readFileSync(`${root}${f}`, 'utf8')); } catch { continue; }
            for (const player of Object.keys(rules.preset_sidecars ?? {})) {
                const model = buildRegionMapModel({ rules, player });
                for (const cell of paintedCells(model)) {
                    const id = compositeMapIdOf(cell.region);
                    byPainter.set(id, (byPainter.get(id) ?? 0) + 1);
                    try { paint(cell, rules, player); } catch (e) { throws.push(`${f} p${player} ${cell.key} (${id}): ${e?.message}`); }
                }
            }
        }
        // The sweep must have reached the painter this slice is about, or it measured nothing.
        expect(byPainter.get('maze') ?? 0).toBeGreaterThan(0);
        expect(throws).toEqual([]);
    }, 300_000);
});
