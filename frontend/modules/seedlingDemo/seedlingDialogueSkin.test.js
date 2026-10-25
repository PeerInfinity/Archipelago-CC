/**
 * Seedling JS graphics G4b-dialogue — **THE TALKING NPC'S BOX, AND THE
 * ROOM-MODE CLAMP** (`seedlingEffectSkin.js`).
 *
 *   1. ⚖ G4b F1: in room mode the overlay screen is CLAMPED to a canvas
 *      narrower than 160 px (`overlayRect` / `fitOverlayOps`): every overlay
 *      lands on the canvas; a room 160 px or wider is the SAME ops, line for
 *      line, over a whole talk tape.
 *   2. `levelRun.talkingNow` is READ-ONLY: L19's sign (the `r8-d2-19` game
 *      oracle) talks for exactly the frozen window, and the run's
 *      `stateDigest` and its whole stream are byte-identical with the getter
 *      read every tick and without it.
 *   3. The box the game's way (`Game.talk()`, `Game.as:1677-1758`): the
 *      class's portrait (`NPC.myPic`) in its white frame, the text pushed
 *      right by `m + 16`, and the class's `ALIGN`; both tables pinned to the
 *      AS3 in `vendor/seedling` (when initialised).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { runTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource, loadAtlas } from './levelSource.js';
import {
    EFFECT_COVERAGE, KEYS, NO_TALKING_NPC_STATE, NPC_TALK_LOOK, effectSkinView, fitOverlayOps, formatEffectOp, holdEffectSkin,
    holdOwed, overlayRect, screenOps, stepEffectSkin,
} from './seedlingEffectSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const VENDOR = join(ROOT, 'vendor/seedling/src');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures/r8-d2-19-freeze-oracle.json'), 'utf8'));
const ATLAS = loadAtlas();
const recordOf = (level) => ATLAS.levels[level] ?? null;

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

function boot(level, [x, y]) {
    const rt = createJsRuntime({ onStateChanged: () => {}, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return rt;
}

/** An op's drawn box in room pixels (a sprite scales about its pivot, as `paintOps` draws it). */
function extent(op) {
    if (!op.sheetRef) return { x: op.rect.x, y: op.rect.y, right: op.rect.right ?? op.rect.x + op.rect.w, bottom: op.rect.bottom ?? op.rect.y + op.rect.h };
    const sx = op.scaleX ?? 1;
    const sy = op.scaleY ?? 1;
    const x = op.dx + op.pivotX - op.pivotX * sx;
    const y = op.dy + op.pivotY - op.pivotY * sy;
    return { x, y, right: x + op.sw * sx, bottom: y + op.sh * sy };
}

/** A booted room, a few ticks in, with a typed-out talk page laid over its view (the bars, the text, the `<X>`). */
function roomWithTalk(level, at) {
    const rt = boot(level, at);
    let skin = null;
    for (let i = 0; i < 3; i += 1) {
        rt.tick(new Set());
        const v = effectSkinView(rt.run, { record: recordOf(rt.run.level) });
        skin = stepEffectSkin(skin, v, rt.ticks);
        while (holdOwed(skin)) skin = holdEffectSkin(skin, v);
    }
    const text = 'You can now swim up waterfalls.';
    const view = { ...effectSkinView(rt.run, { record: recordOf(rt.run.level) }), dialogue: { text, currentCharacter: text.length + 1 } };
    return { rt, view, skin, room: view.room };
}

describe('⚖ G4b F1 — room mode CLAMPS the overlays to a canvas narrower than the screen', () => {
    it('L10 (112 × 112): unclamped the bars and hearts hang off the canvas; clamped, every overlay is on it', () => {
        const { view, skin, room } = roomWithTalk(10, [48, 48]);
        expect(room).toEqual({ width: 112, height: 112 });
        const cam = skin.cam;
        expect(cam.x).toBeLessThan(0);
        const on = (op) => { const e = extent(op); return e.x >= -1e-9 && e.y >= -1e-9 && e.right <= room.width + 1e-9 && e.bottom <= room.height + 1e-9; };
        const raw = screenOps(view, art, { skin, cam });
        expect(raw.filter((o) => !on(o)).length, 'the unclamped overlays leave the canvas (G4b F1)').toBeGreaterThan(0);
        const fit = screenOps(view, art, { skin, cam, fitTo: room });
        expect(fit).toHaveLength(raw.length);
        expect(fit.filter((o) => !on(o)).map(formatEffectOp)).toEqual([]);
        // the screen scaled by 112 / 160 = 0.7 onto the canvas: the top bar is (0, 0, 112, 26 · 0.7)
        expect(overlayRect(cam, room)).toEqual({ x: 0, y: 0, w: 112, h: 112 });
        const bar = fit[0].rect;
        expect([bar.x, bar.y, bar.w]).toEqual([0, 0, 112]);
        expect(bar.h).toBeCloseTo(26 * 0.7, 9);
        expect(fit.some((o) => o.key === KEYS.heart)).toBe(true);
        expect(fit.filter((o) => o.glyph !== undefined).length).toBeGreaterThan(20);
    });

    it('ONE narrow axis (L16, 400 × 144): that axis is the canvas; the other keeps the camera, the screen scaled 0.9 and centred', () => {
        const { view, skin, room } = roomWithTalk(16, [64, 64]);
        expect(room).toEqual({ width: 400, height: 144 });
        const cam = skin.cam;
        const r = overlayRect(cam, room);
        expect(r).toEqual({ x: cam.x, y: 0, w: 160, h: 144 });
        const fit = screenOps(view, art, { skin, cam, fitTo: room });
        for (const op of fit) {
            const e = extent(op);
            expect(e.y, formatEffectOp(op)).toBeGreaterThanOrEqual(-1e-9);
            expect(e.bottom, formatEffectOp(op)).toBeLessThanOrEqual(144 + 1e-9);
            expect(e.x, formatEffectOp(op)).toBeGreaterThanOrEqual(cam.x + 8 - 1e-9);
            expect(e.right, formatEffectOp(op)).toBeLessThanOrEqual(cam.x + 152 + 1e-9);
        }
        expect(fit[0].rect.x).toBe(cam.x + 8);
        expect(fit[0].rect.w).toBeCloseTo(144, 9);
    });

    it('a room 160 px or wider is the SAME ops (`fitOverlayOps` hands back its input)', () => {
        const ops = [{ rect: { x: 1, y: 2, w: 3, h: 4, right: 4, bottom: 6 }, colour: '#000000', alpha: 1, layer: 0 }];
        const cam = { x: 40, y: 80 };
        expect(fitOverlayOps(ops, cam, overlayRect(cam, { width: 160, height: 320 }))).toBe(ops);
        expect(fitOverlayOps(ops, cam, overlayRect(cam, { width: 159, height: 320 }))).not.toBe(ops);
    });

    /** Drive a committed tape, with the clamp's two answers compared at every tick. */
    const both = (fixture, each) => {
        const tape = JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${fixture}.json`), 'utf8'));
        let skin = null;
        runTape(tape, {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => {
                const view = effectSkinView(run, { record: recordOf(run.level) });
                skin = stepEffectSkin(skin, view, t);
                if (!skin.cam) return;
                each(t, view, screenOps(view, art, { skin, cam: skin.cam }), screenOps(view, art, { skin, cam: skin.cam, fitTo: view.room }));
            },
        });
    };
    const wide = (room) => room.width >= 160 && room.height >= 160;

    it('⛓ BYTE-IDENTICAL in every room ≥ 160 px over the two talk tapes (totem-kill-L43, walk-L59): the same overlays, clamped or not', () => {
        let compared = 0;
        let talked = 0;
        for (const fixture of ['r6-totem-kill', 'r4-walk-6-health']) {
            both(fixture, (t, view, a, b) => {
                if (!wide(view.room)) return;
                expect(b.map(formatEffectOp), `${fixture} t=${t}`).toEqual(a.map(formatEffectOp));
                compared += 1;
                if (view.dialogue) talked += 1;
            });
        }
        expect(compared).toBeGreaterThan(100);
        expect(talked).toBeGreaterThan(0);
    });

    it('⛓ and in walk-L59\'s L68 (80 × 96) — a REAL tape\'s talk in a narrow room — the clamp brings every overlay onto the canvas', () => {
        let talked = 0;
        both('r4-walk-6-health', (t, view, a, b) => {
            if (wide(view.room) || !view.dialogue) return;
            expect(view.room).toEqual({ width: 80, height: 96 });
            const on = (op) => { const e = extent(op); return e.x >= -1e-9 && e.y >= -1e-9 && e.right <= 80 + 1e-9 && e.bottom <= 96 + 1e-9; };
            expect(a.some((o) => !on(o)), `t=${t}: unclamped, something is off the canvas`).toBe(true);
            expect(b.filter((o) => !on(o)).map(formatEffectOp), `t=${t}`).toEqual([]);
            talked += 1;
        });
        expect(talked).toBeGreaterThan(0);
    });
});

describe('⛓ `levelRun.talkingNow` is READ-ONLY — L19\'s sign against the game oracle', () => {
    const levelSource = atlasLevelSource();

    it('names the sign for exactly the talk window, and the run\'s stateDigest is unmoved by every read', () => {
        const open = [];
        let digests = 0;
        runTape(ORACLE.tape, {
            levelSource,
            onTick: (t, now, held, run) => {
                const before = run.stateDigest({ parts: true });
                const row = run.talkingNow;
                const after = run.stateDigest({ parts: true });
                expect(after, `t=${t}`).toEqual(before);
                digests += 1;
                if (row) {
                    expect(row).toMatchObject({ source: 'talker', tag: 'sign', page: 0, pages: 1 });
                    expect(row.text.length).toBeGreaterThan(0);
                    open.push(t);
                }
            },
        });
        expect(digests).toBe(ORACLE.stream.ticks.length);
        // the page is up for exactly the game's frozen window (the t=15 release opens it, the t=43 release closes it)
        const { heldStill, span } = ORACLE.freeze;
        expect([open[0], open[open.length - 1], open.length]).toEqual([heldStill.from, heldStill.to, span]);
    });

    it('the stream and the end state are byte-identical with the getter read every tick and without it', () => {
        const drive = (read) => {
            const out = runTape(ORACLE.tape, { levelSource, onTick: (t, now, held, run) => { if (read) void run.talkingNow; } });
            return JSON.stringify([out.ticks, out.final, out.transitions]);
        };
        expect(drive(true)).toBe(drive(false));
    });

    it('the sign\'s box: LEFT, no portrait (a bare `NPC` never sets `myPic`), the text at x 8 + Flash\'s 2 px gutter', () => {
        let seen = null;
        runTape(ORACLE.tape, {
            levelSource,
            onTick: (t, now, held, run) => {
                if (seen || !run.talkingNow) return;
                seen = effectSkinView(run, { record: recordOf(run.level) });
            },
        });
        expect(seen.talkState).toBe(null);
        expect(seen.dialogue).toMatchObject({ speaker: { source: 'talker', tag: 'sign', cls: 'Sign' }, align: 'LEFT', portrait: null });
        const view = { ...seen, dialogue: { ...seen.dialogue, currentCharacter: 1 } };
        const skin = stepEffectSkin(null, view, 0);
        const glyphs = screenOps(view, art, { skin, cam: { x: 0, y: 0 } }).filter((o) => o.glyph !== undefined);
        expect(glyphs).toHaveLength(1);
        expect(glyphs[0].dx).toBe(10);
    });
});

describe('⛓ the YETI (fidelity\'s YETI flip, `yetiTalk` ON by default): L58\'s talk, through `talkingNow`, with its portrait', () => {
    it('the witnessed talk tape (`yeti-l58-talk`): a talker row tagged yeti, drawn LEFT with `YetiPic` at (5, 138), state unmoved by every read', () => {
        const w = JSON.parse(readFileSync(join(HERE, 'fixtures/yeti-witness/yeti-l58-talk.json'), 'utf8'));
        const open = [];
        let drawn = null;
        runTape(parseTape(w.tape), {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => {
                const before = run.stateDigest({ parts: true });
                const row = run.talkingNow;
                expect(run.stateDigest({ parts: true }), `t=${t}`).toEqual(before);
                if (!row) return;
                expect(run.level).toBe(58);
                expect(row).toMatchObject({ source: 'talker', tag: 'yeti' });
                open.push(t);
                if (!drawn) {
                    const view = effectSkinView(run, { record: recordOf(run.level) });
                    const skin = stepEffectSkin(null, view, t);
                    drawn = { view, ops: screenOps(view, art, { skin, cam: { x: 0, y: 0 } }) };
                }
            },
        });
        expect(open.length).toBeGreaterThan(10);
        expect(drawn.view.dialogue).toMatchObject({ speaker: { tag: 'yeti', cls: 'Yeti' }, align: 'LEFT', portrait: 'seedling:portrait/Yeti' });
        const pic = drawn.ops.find((o) => o.key === 'seedling:portrait/Yeti');
        expect(pic).toMatchObject({ dx: 5, dy: 138, sw: 16, sh: 16 });
        expect(drawn.ops.some((o) => o.rect && o.colour === '#ffffff' && o.rect.x === 4 && o.rect.y === 137)).toBe(true);
    });
});

/** A synthetic run whose `talkingNow` is `now` (the adapter reads nothing else of it). */
const talkingRun = (now) => ({ level: 1, state: { x: 0, y: 0 }, inventory: { hitsMax: 3 }, talkingNow: now });

describe('the talking NPC\'s box, the game\'s way (`Game.talk()`, `Game.as:1726-1749`)', () => {
    const boxOf = (now) => {
        const view = effectSkinView(talkingRun(now));
        const skin = stepEffectSkin(null, view, 0);
        return { view, ops: screenOps(view, art, { skin, cam: { x: 0, y: 0 } }) };
    };

    it('a portrait NPC (the Hermit): the white frame (4, 137, 18 × 18), the picture at (5, 138), the text at x 29 + 2', () => {
        const { view, ops } = boxOf({ source: 'talker', id: 'h', tag: 'hermit', page: 0, pages: 1, text: 'Hi', currentCharacter: 1 });
        expect(view.dialogue).toMatchObject({ align: 'LEFT', portrait: KEYS.portrait('Hermit') });
        expect(formatEffectOp(ops[2])).toBe('fillRect(#ffffff, 4, 137, 18, 18)');
        expect(ops[3]).toMatchObject({ key: 'seedling:portrait/Hermit', dx: 5, dy: 138, sw: 16, sh: 16 });
        const g = ops.filter((o) => o.glyph !== undefined);
        expect(g.map((o) => [o.glyph, o.dx])).toEqual([['H'.charCodeAt(0), 31]]);
    });

    it('the Bob Boss NPC by FORM (`pics[_st]`), the Watcher, and the CENTER classes (Statue, the lights intro) without one', () => {
        expect(boxOf({ source: 'bobBoss', id: null, tag: 'bobboss', form: 2, text: 'x', currentCharacter: 1 }).view.dialogue.portrait)
            .toBe('seedling:portrait/BobBoss2');
        expect(boxOf({ source: 'watcher', id: 'w', tag: 'watcher', text: 'x', currentCharacter: 1 }).view.dialogue)
            .toMatchObject({ align: 'LEFT', portrait: 'seedling:portrait/Watcher' });
        for (const tag of ['statue1', 'lightboss']) {
            const text = 'A centred page';
            const { view, ops } = boxOf({ source: 'talker', id: 's', tag, text, currentCharacter: text.length });
            expect(view.dialogue, tag).toMatchObject({ align: 'CENTER', portrait: null });
            // CENTER: int((160 − 8 − (14 · 4 + 4)) / 2) = 46 → x 8 + 46 + 2
            expect(ops.find((o) => o.glyph !== undefined).dx, tag).toBe(56);
        }
        for (const who of ['BobBoss0', 'BobBoss1', 'BobBoss2', 'Watcher', ...NPC_TALK_LOOK.portraits.filter((c) => c !== 'BobBossNPC')]) {
            expect(art.has(KEYS.portrait(who)), who).toBe(true);
        }
    });

    it('⛔ a run with no `talkingNow` is the named path: no NPC box, the ceremony\'s untouched', () => {
        const run = { level: 1, state: { x: 0, y: 0 }, inventory: { hitsMax: 3 } };
        expect(effectSkinView(run)).toMatchObject({ dialogue: null, talkState: NO_TALKING_NPC_STATE });
        expect(effectSkinView(talkingRun(null))).toMatchObject({ dialogue: null, talkState: null });
        expect(EFFECT_COVERAGE.drawn.some((d) => d.startsWith('NPC dialogues + portraits'))).toBe(true);
        expect(EFFECT_COVERAGE.drawn).toContain("the Owl's intro + its portrait (talkingNow 'owlIntro'; G6)");
    });

    it('⛓ the tables are the AS3: who assigns `myPic`, and who sets `align = "CENTER"`', () => {
        if (!existsSync(VENDOR)) return;
        const npcs = readdirSync(join(VENDOR, 'NPCs')).filter((f) => f.endsWith('.as'));
        const withPic = npcs.filter((f) => /^\s*myPic = /m.test(readFileSync(join(VENDOR, 'NPCs', f), 'utf8'))).map((f) => f.replace(/\.as$/, ''));
        expect([...NPC_TALK_LOOK.portraits].sort()).toEqual(withPic.sort());
        const centre = [];
        for (const dir of ['NPCs', 'Enemies']) {
            for (const f of readdirSync(join(VENDOR, dir)).filter((n) => n.endsWith('.as'))) {
                if (/\balign = "CENTER"/.test(readFileSync(join(VENDOR, dir, f), 'utf8'))) centre.push(f.replace(/\.as$/, ''));
            }
        }
        expect([...NPC_TALK_LOOK.center].sort()).toEqual(centre.sort());
    });
});
