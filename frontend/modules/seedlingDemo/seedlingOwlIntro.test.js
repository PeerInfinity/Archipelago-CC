/**
 * ⛓ GRAPHICS G6 — THE OWL'S INTRO ("EEEEP!", `FinalBoss.as:87-104`), drawn from `levelRun.talkingNow`'s `owlIntro`
 * row (⚖ cleared by fidelity-12, 2026-10-24: read-only, copies, the digest pins below).
 *
 *   1. The row on REAL runs: the committed `r6-owl-kill` tape (the intro is up for ticks 0–2; the X release at 3
 *      ends it) and the same tape with its X press moved to tick 60, so the intro is HELD for 61 frames (⚠ the JS
 *      runtime's own boot refuses the Owl without the tape's `rng: { split: true }`, so both are tapes). Golden: per tick the row and the talk box's ops (`effect-owl-intro-*.txt`). ⚠ CHANGE
 *      DETECTORS: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. ⛔ fidelity-12's conditions: (a) `stateDigest()`, `earnedClears`, `ledger('bankedClears')`, the stream and
 *      the end state equal with and without a `talkingNow` read at every `onTick` — t = 0 is the boot, before the
 *      first tick; t = 1 is right after the level entry (the tape boots INTO L112); (b) the row is a fresh copy; (c) `owlIntroTyped(n)` equals a `stepDialogue` replay.
 *   3. The look: the Owl's portrait (`OwlPic.png`, frame 0), ALIGN "LEFT", the text after the portrait, `<X>` once typed out.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { runTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { INITIAL_FRAMES_THIS_CHARACTER, beginDialogue, stepDialogue } from './dialogue.js';
import { OWL_INTRO_TEXT, owlIntroTyped } from './levelRun.js';
import { KEYS, effectSkinView, formatEffectOp, screenOps, stepEffectSkin } from './seedlingEffectSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const TAPE = JSON.parse(readFileSync(join(HERE, 'fixtures/tapes/r6-owl-kill.json'), 'utf8'));
const HOLD = 60;

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/** The tape cut to `n` ticks with its X press moved to `press` (its movement spans kept; its pins dropped). */
function variant(press, n) {
    const inputs = TAPE.inputs.filter((x) => x.key !== 'primary' && x.to <= n);
    return { ...TAPE, tick_count: n, pins: [], inputs: [...inputs, { key: 'primary', from: press, to: press + 1 }]
        .sort((a, b) => a.from - b.from || a.key.localeCompare(b.key)) };
}
const HELD = variant(HOLD, HOLD + 22);
const KILL30 = variant(2, 30);
/** Drive a tape; `each(t, run)` after every tick. Returns the stream and the end state. */
function drive(tape, each = () => {}) {
    let last = null;
    const out = runTape(tape, { levelSource: atlasLevelSource(), onTick: (t, now, held, run) => { last = run; each(t, run); } });
    return { out, last };
}
const holdIntro = (each) => drive(HELD, each);

const facts = (run) => JSON.stringify([run.stateDigest(), [...(run.earnedClears ?? [])], run.ledger?.('bankedClears') ?? null, run.state]);

function golden(name, got) {
    const path = join(GOLDENS, name);
    if (process.env.UPDATE_SKIN_GOLDENS) {
        writeFileSync(path, `${got.join('\n')}\n`);
        return got;
    }
    expect(existsSync(path), `${path} — record it with UPDATE_SKIN_GOLDENS=1`).toBe(true);
    return readFileSync(path, 'utf8').trimEnd().split('\n');
}

/** Per tick: the row (or none) and the talk box's ops, as the page builds them; a run of identical lines is one. */
function introLines(drive) {
    const out = [];
    let skin = null;
    let open = null;
    drive((t, run) => {
        const row = run.talkingNow;
        const view = effectSkinView(run, { record: null });
        skin = stepEffectSkin(skin, view, t);
        const talk = view.dialogue ? screenOps(view, art, { skin, cam: { x: 0, y: 0 } }).filter((o) => o.key !== KEYS.heart) : [];
        const body = row ? `${row.source} ${row.tag} cc=${row.currentCharacter} | ${talk.map(formatEffectOp).join(' ; ')}` : 'none';
        if (open && open.body === body) { open.to = t; return; }
        if (open) out.push(`t=${open.from}${open.to !== open.from ? `..${open.to}` : ''} ${open.body}`);
        open = { from: t, to: t, body };
    });
    if (open) out.push(`t=${open.from}${open.to !== open.from ? `..${open.to}` : ''} ${open.body}`);
    return out;
}

describe('1. the Owl\'s intro on real runs', () => {
    it('r6-owl-kill: the row is up for exactly the intro frames (0–2), then gone after the X release', () => {
        const up = [];
        runTape(TAPE, { levelSource: atlasLevelSource(), onTick: (t, now, held, run) => {
            const row = run.talkingNow;
            if (row?.source === 'owlIntro') up.push([t, row.currentCharacter]);
        } });
        // onTick's `t` counts ticks completed: the intro frames 0, 1, 2 are reads 1, 2, 3; each shows "E"
        expect(up).toEqual([[1, 1], [2, 1], [3, 1]]);
        const lines = introLines((each) => drive(KILL30, each));
        expect(lines).toEqual(golden('effect-owl-intro-kill-L112.txt', lines));
    });

    it('the held intro: typed out at the game\'s 5-frame cadence, `<X>` once typed out, gone on the release', () => {
        const rows = [];
        holdIntro((t, run) => rows.push([t, run.talkingNow]));
        const intro = rows.filter(([, r]) => r?.source === 'owlIntro');
        expect(intro.length).toBe(HOLD + 1);
        expect(intro.map(([, r]) => r.currentCharacter)).toEqual(intro.map((_, i) => owlIntroTyped(i + 1)));
        expect(intro[intro.length - 1][1].currentCharacter).toBeGreaterThan(OWL_INTRO_TEXT.length);
        // the press is held on tick HOLD (read t = HOLD + 1, still up); the release on the next ends it
        expect(intro.map(([t]) => t)).toEqual(intro.map((_, i) => i + 1));
        expect(rows.filter(([t]) => t > HOLD + 1).every(([, r]) => r === null)).toBe(true);
        expect(intro[0][1]).toMatchObject({ source: 'owlIntro', tag: 'finalboss', page: 0, pages: 1, text: 'EEEEP!' });
        const lines = introLines((each) => holdIntro(each));
        expect(lines).toEqual(golden('effect-owl-intro-held-L112.txt', lines));
    });
});

describe('2. ⛔ fidelity-12\'s conditions', () => {
    it('(a) the digest, the clears, the stream and the end state are unmoved by a read every tick', () => {
        for (const tape of [TAPE, HELD]) {
            const arm = (read) => {
                const seen = [];
                const { out, last } = drive(tape, (t, run) => {
                    const before = facts(run);
                    seen.push(before);
                    if (!read) return;
                    void run.talkingNow;
                    expect(facts(run), `${tape.name} t=${t}`).toBe(before);
                });
                return { seen, end: JSON.stringify([out.ticks, out.final, out.transitions, facts(last)]) };
            };
            const a = arm(true);
            const b = arm(false);
            // t = 0 is the boot (the read BEFORE the first tick), t = 1 right after the level entry
            expect(a.seen.length).toBe(tape.tick_count + 1);
            expect(a.seen).toEqual(b.seen);
            expect(a.end).toBe(b.end);
        }
    });

    it('(b) the row is a fresh copy: mutating it changes nothing', () => {
        holdIntro((t, run) => {
            if (t !== 10) return;
            const r = run.talkingNow;
            r.currentCharacter = 99;
            r.text = 'x';
            expect(run.talkingNow).toMatchObject({ currentCharacter: owlIntroTyped(10), text: OWL_INTRO_TEXT });
            expect(run.talkingNow).not.toBe(run.talkingNow);
        });
    });

    it('(c) `owlIntroTyped(n)` is `stepDialogue`\'s render arm replayed n times (fresh `framesThisCharacter`, speed 4)', () => {
        const d = beginDialogue(OWL_INTRO_TEXT, { framesThisCharacter: INITIAL_FRAMES_THIS_CHARACTER, framesPerCharacter: 4 });
        expect(owlIntroTyped(0)).toBe(d.currentCharacter);
        for (let n = 1; n <= 60; n += 1) {
            stepDialogue(d, false);
            expect(owlIntroTyped(n), `n=${n}`).toBe(d.currentCharacter);
        }
    });
});

describe('3. the look', () => {
    it('the Owl\'s portrait from the pack, LEFT, the text pushed past it, `<X>` once typed out', () => {
        let view = null;
        holdIntro((t, run) => { if (t === HOLD) view = effectSkinView(run, { record: null }); });
        expect(view.dialogue).toMatchObject({ speaker: { source: 'owlIntro', tag: 'finalboss', cls: 'FinalBoss' }, align: 'LEFT',
            portrait: KEYS.portrait('Owl') });
        expect(art.has(KEYS.portrait('Owl'))).toBe(true);
        const skin = stepEffectSkin(null, view, 0);
        const ops = screenOps(view, art, { skin, cam: { x: 0, y: 0 } });
        const pic = ops.find((o) => o.key === KEYS.portrait('Owl'));
        expect([pic.dx, pic.dy]).toEqual([5, Math.trunc((160 * 5) / 6 + 5)]);
        const glyphs = ops.filter((o) => o.glyph !== undefined);
        expect(String.fromCharCode(...glyphs.slice(0, 6).map((o) => o.glyph))).toBe('EEEEP!');
        expect(glyphs[0].dx).toBeGreaterThan(5 + 16);
        expect(glyphs.some((o) => o.glyph === '<'.charCodeAt(0))).toBe(true);
    });
});
