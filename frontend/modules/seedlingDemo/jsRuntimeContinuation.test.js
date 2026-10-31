/**
 * jsRuntimeContinuation — ⛓ seedling-js-replay-continuation: the JS core's `botStart` CONTINUES where the game would
 * not rebuild (`Bot.as:1843-1846`, `atBootPosition` `:1950-1953`), and holds the room at a declared latch (P4E,
 * `Bot.as:3326-3328`, `Main.as:80-89`), so a SEQUENCE of windows plays on ONE run.
 *
 *  1. A SEQUENCE AGREES PER TICK, JS frame vs JS model — `toy-west-pair` (2 windows) and `r8-d2` (3), shipped as the
 *     lab ships a JS sequence (`jsRuntimeSequence.jsWindowTape`) with a round-trip gap between windows: every window
 *     after the first CONTINUES the same run, the gap steps nothing, every window's drain agrees with the model walk's
 *     own stream at every tick, and at every HELD window end the run's state digest and tick count are the model
 *     walk's (built the core's way: `scratchPersistence`). The 30-window campaign is the slow tier's.
 *  2. THE MUTANT — the core with its continue arm cut (always rebuild) reds the digest/tick-count half of (1).
 *     Positions alone do NOT red it: these chains are built so a fresh boot of a window equals its continuation
 *     (⚖ 23), so the drain is not the witness — the run is.
 *  3. THE RULE'S EDGES — the first window over the game's own first frame still REBUILDS (the bounded liberty that
 *     keeps every single window Phase B's), a boot elsewhere rebuilds, `botStart` clears the drain base, a held room
 *     takes no step until `botStart` releases it, and a level delivery releases it too (`Bot.as:3563`).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { PAGE_CHAINS } from './director.js';
import { jsWindowTape, playChainOnJsCore, walkChainModel } from './jsRuntimeSequence.js';
import { diffObservationStreams, gameStreamFromDrain, gameVisibleTape, holdingWindowTape, parseTape } from './tapeFormat.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(join(HERE, rel), 'utf8'));
const MAP = readJson('../flashPanel/atlases/seedling-map.json');
const GAME = readJson('../flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties });
const tapeOf = (name) => readJson(`fixtures/tapes/${name}.json`);
const SRC = levelSourceFromAtlas(MAP);
/** The lab's round trip between windows, in frames (the 250 ms poll and the key release, at ~60 fps, rounded up). */
const GAP = 40;

function vanillaRuntime(create = createJsRuntime) {
    const rt = create();
    rt.game.configure(BRIDGE_CONFIG);
    rt.setVanilla(MAP);
    return rt;
}

/** The sequence pin's findings for one chain on one core: [] is green. */
export function chainFindings(chain, create = createJsRuntime) {
    const tapes = PAGE_CHAINS[chain].map(tapeOf);
    const model = walkChainModel(tapes, SRC);
    const scratch = walkChainModel(tapes, SRC, { scratchPersistence: true });
    if (model.error || scratch.error) return [`the model walk threw: ${(model.error ?? scratch.error).message}`];
    const played = playChainOnJsCore(vanillaRuntime(create), tapes, { gapTicks: GAP });
    const findings = [];
    played.forEach((w, k) => {
        const at = `${chain} window ${k} (${PAGE_CHAINS[chain][k]})`;
        if (w.loaded !== 'ok' || w.started !== 'ok') findings.push(`${at}: ${w.loaded} / ${w.started}`);
        if (w.status.error || !w.status.finished) findings.push(`${at}: finished ${w.status.finished} ${w.status.error}`);
        if (k > 0 && !(w.continued && w.sameRun)) findings.push(`${at}: did not continue the run`);
        if (w.gapStepped !== (k < played.length - 1 ? 0 : GAP)) findings.push(`${at}: the gap stepped ${w.gapStepped}`);
        const diff = diffObservationStreams(model.windows[k].modelStream, gameStreamFromDrain(w.drained).stream);
        if (diff) findings.push(`${at}: ${diff}`);
        // The finishing frame of the LAST window is a LIVE frame (`Bot.as:3330-3333`): its run is one step on, and
        // its digest is not comparable; every HELD window end is the model's exactly.
        const last = k === played.length - 1;
        const tc = scratch.windows[k].ticksCompleted + (last ? 1 : 0);
        if (w.ticksCompleted !== tc) findings.push(`${at}: ticksCompleted ${w.ticksCompleted} ≠ the model's ${tc}`);
        if (!last && w.digest !== scratch.windows[k].digest) findings.push(`${at}: the run's state digest is not the model's`);
    });
    return findings;
}

describe('⛓ a SEQUENCE plays on ONE JS run and agrees per tick, JS frame vs JS model', () => {
    for (const chain of ['toy-west-pair', 'r8-d2']) {
        it(`${chain} (${PAGE_CHAINS[chain].length} windows): continues, holds, agrees at every tick and every boundary`, () => {
            expect(chainFindings(chain)).toEqual([]);
        });
    }
});

describe('⛓ THE MUTANT — a core that always rebuilds reds the sequence pin', () => {
    const CORE = readFileSync(join(HERE, 'jsRuntimeCore.js'), 'utf8');
    const ARM = 'const continues = live !== null && tape.chainBoot !== null';
    const MUTANT = join(HERE, `jsRuntimeCore.mutant-always-rebuild.${process.pid}.js`);
    afterAll(() => rmSync(MUTANT, { force: true }));

    it('the continue arm cut → toy-west-pair and r8-d2 both red (the run, not the positions)', async () => {
        expect(CORE.split(ARM)).toHaveLength(2);
        writeFileSync(MUTANT, CORE.replace(ARM, `const continues = false && live !== null && tape.chainBoot !== null`));
        const { createJsRuntime: mutant } = await import(pathToFileURL(MUTANT).href);
        for (const chain of ['toy-west-pair', 'r8-d2']) {
            const red = chainFindings(chain, mutant);
            expect(red.some((f) => /did not continue/.test(f))).toBe(true);
            expect(red.some((f) => /ticksCompleted|state digest/.test(f))).toBe(true);
            // ⚖ 23's property, said out loud: a rebuilt window plays the same POSITIONS — the drain is not the witness.
            expect(red.filter((f) => /tick \d+ differs/.test(f))).toEqual([]);
        }
    }, 60000);
});

describe('⛓ the rebuild rule\'s edges', () => {
    it('window 1 over the game\'s own first frame REBUILDS (the bounded liberty): a fresh boot, as in Phase B', () => {
        const rt = vanillaRuntime();
        const raw = tapeOf('collide-up-rock');
        expect(rt.run.level).toBe(raw.boot.level);
        expect(rt.run.worldCtor).toEqual({ x: raw.boot.x, y: raw.boot.y });
        const first = rt.run;
        expect(rt.game.botLoadTape(JSON.stringify(gameVisibleTape(parseTape(raw))))).toBe('ok');
        expect(rt.game.botStart()).toBe('ok');
        expect(rt.run).not.toBe(first);
        expect(rt.events.filter((e) => e.type === 'boot').at(-1)).toMatchObject({ why: 'tape collide-up-rock (botStart)' });
    });

    it('a tape whose boot is NOT the live room\'s construction spot rebuilds, even after a tape', () => {
        const rt = vanillaRuntime();
        const [a] = playChainOnJsCore(rt, [tapeOf('collide-up-rock')]);
        expect(a.status.finished).toBe(true);
        const run = rt.run;
        const raw = tapeOf('r8-solve-2');
        expect(raw.boot).not.toEqual({ level: run.level, ...run.worldCtor });
        expect(rt.game.botLoadTape(JSON.stringify(gameVisibleTape(parseTape(raw))))).toBe('ok');
        expect(rt.game.botStart()).toBe('ok');
        expect(rt.run).not.toBe(run);
    });

    it('a non-tape boot (a host teleport) ends the chain: the next botStart rebuilds where it stands', () => {
        const rt = vanillaRuntime();
        const [w1] = playChainOnJsCore(rt, [tapeOf('r7-ends-meet-1'), tapeOf('r7-ends-meet-2')].slice(0, 1),
            { project: (t) => gameVisibleTape(holdingWindowTape(parseTape(t))) });
        expect(w1.status).toMatchObject({ finished: true, held: true });
        const { level, worldCtor } = rt.run;
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [level, worldCtor.x, worldCtor.y] }]);
        rt.tick(new Set());
        const teleported = rt.run;
        expect(rt.game.botLoadTape(JSON.stringify(gameVisibleTape(parseTape(tapeOf('r7-ends-meet-2')))))).toBe('ok');
        expect(rt.game.botStart()).toBe('ok');
        expect(rt.run).not.toBe(teleported);
    });

    it('HOLD: the latch holds the room (no step, `held: true`) until botStart, which releases it and clears the drain base', () => {
        const rt = vanillaRuntime();
        const [one, two] = PAGE_CHAINS['toy-west-pair'].map(tapeOf);
        const [w1] = playChainOnJsCore(rt, [one, two].slice(0, 1), { project: (t) => jsWindowTape(t, 0, 2) });
        expect(w1.status).toMatchObject({ finished: true, held: true, tick: one.tick_count });
        expect(w1.drained.ticks.at(-1).t).toBe(one.tick_count);
        const tc = rt.run.ticksCompleted;
        for (let i = 0; i < 25; i += 1) expect(rt.tick(new Set(['right']))).toMatchObject({ stepped: false, held: true });
        expect(rt.run.ticksCompleted).toBe(tc);
        // ⛔ botLoadTape does NOT release a held room (`Bot.as:288-292`) …
        expect(rt.game.botLoadTape(JSON.stringify(jsWindowTape(two, 1, 2)))).toBe('ok');
        expect(rt.tick(new Set())).toMatchObject({ stepped: false, held: true });
        // … botStart does (`:1663`), continues, and its drain starts at t 0 again (`:1936` `clearObservations()`).
        expect(rt.game.botStart()).toBe('ok');
        expect(JSON.parse(rt.game.botStatus())).toMatchObject({ held: false, armed: true });
        rt.tick(new Set());
        expect(JSON.parse(rt.game.botDrain()).ticks[0].t).toBe(0);
    });

    it('HOLD: a level delivery releases a held room (`Bot.as:3563`)', () => {
        const rt = vanillaRuntime();
        playChainOnJsCore(rt, [tapeOf('collide-up-rock')], { project: (t) => jsWindowTape(t, 0, 2) });
        expect(JSON.parse(rt.game.botStatus()).held).toBe(true);
        rt.game.botLoadLevels('{');
        expect(JSON.parse(rt.game.botStatus()).held).toBe(false);
        expect(rt.tick(new Set()).stepped).toBe(true);
    });
});
