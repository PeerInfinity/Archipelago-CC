/**
 * jsRuntimeTape.slow — ⛓⛓ PHASE B over the WHOLE committed tape roster: every `fixtures/tapes/*.json` that
 * `parseTape` accepts is shipped to the JS core the way the lab ships it (`gameVisibleTape` → `botLoadTape` →
 * `botStart`, ticked to `finished`, `botDrain`) and its drain is diffed against `runTape` over the same atlas.
 *
 * ⛔ Every one must load, finish without an error, and agree at EVERY tick. Measured when this landed: 293 of 293
 * (≈43 s — hence the slow tier). The roster grows with the fixtures; the count is printed, not pinned.
 *
 * ⛓ seedling-js-replay-continuation — and the 30-window `r9-campaign` SEQUENCE on one JS run (`jsRuntimeSequence`),
 * the same pin `jsRuntimeContinuation.test.js` holds over the short chains: every window after the first continues,
 * every gap is held, every window agrees per tick with the model walk, every held end's run is the model's.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { PAGE_CHAINS } from './director.js';
import { playChainOnJsCore, walkChainModel } from './jsRuntimeSequence.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { runTape } from './tapeRunner.js';
import { diffObservationStreams, gameStreamFromDrain, gameVisibleTape, parseTape } from './tapeFormat.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const MAP = readJson(join(HERE, '../flashPanel/atlases/seedling-map.json'));
const GAME = readJson(join(HERE, '../flashPanel/games/seedling.json'));
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties });
const TAPES = join(HERE, 'fixtures/tapes');

describe('⛓ PHASE B — every committed tape, JS frame vs JS model, per tick', () => {
    it('loads, finishes and agrees with runTape at every tick', () => {
        const src = levelSourceFromAtlas(MAP);
        const findings = [];
        let played = 0;
        for (const f of readdirSync(TAPES).filter((n) => n.endsWith('.json') && n !== 'index.json').sort()) {
            let raw;
            try { raw = readJson(join(TAPES, f)); parseTape(raw); } catch { continue; }
            const model = runTape(raw, { levelSource: src });
            const rt = createJsRuntime();
            rt.game.configure(BRIDGE_CONFIG);
            rt.setVanilla(MAP);
            const loaded = rt.game.botLoadTape(JSON.stringify(gameVisibleTape(parseTape(raw))));
            const started = loaded === 'ok' ? rt.game.botStart() : loaded;
            if (started !== 'ok') { findings.push(`${f}: ${started}`); continue; }
            let st = JSON.parse(rt.game.botStatus());
            for (let i = 0; i <= raw.tick_count + 1 && !st.finished; i += 1) {
                rt.tick(new Set());
                st = JSON.parse(rt.game.botStatus());
            }
            const diff = st.finished ? diffObservationStreams({ ticks: model.ticks, transitions: model.transitions },
                gameStreamFromDrain(JSON.parse(rt.game.botDrain())).stream) : 'never finished';
            if (st.error || diff) findings.push(`${f}: ${st.error || diff}`);
            played += 1;
        }
        console.log(`[jsRuntimeTape.slow] ${played} committed tape(s) played; ${findings.length} finding(s)`);
        expect(findings).toEqual([]);
        expect(played).toBeGreaterThan(0);
    }, 600000);
});

describe('⛓ seedling-js-replay-continuation — the r9-campaign sequence on ONE JS run, JS frame vs JS model', () => {
    it('30 windows: continue, hold, agree per tick, and every held end is the model walk\'s run', () => {
        const src = levelSourceFromAtlas(MAP);
        const names = PAGE_CHAINS['r9-campaign'];
        const tapes = names.map((n) => readJson(join(TAPES, `${n}.json`)));
        const model = walkChainModel(tapes, src);
        const scratch = walkChainModel(tapes, src, { scratchPersistence: true });
        expect(model.error ?? scratch.error ?? null).toBeNull();
        const rt = createJsRuntime();
        rt.game.configure(BRIDGE_CONFIG);
        rt.setVanilla(MAP);
        const played = playChainOnJsCore(rt, tapes, { gapTicks: 40 });
        const findings = [];
        played.forEach((w, k) => {
            const last = k === played.length - 1;
            const at = `window ${k} (${names[k]})`;
            if (w.started !== 'ok' || w.status.error || !w.status.finished) findings.push(`${at}: ${w.started} ${w.status.error}`);
            if (k > 0 && !(w.continued && w.sameRun)) findings.push(`${at}: did not continue`);
            if (!last && w.gapStepped !== 0) findings.push(`${at}: the gap stepped ${w.gapStepped}`);
            const diff = diffObservationStreams(model.windows[k].modelStream, gameStreamFromDrain(w.drained).stream);
            if (diff) findings.push(`${at}: ${diff}`);
            if (!last && (w.digest !== scratch.windows[k].digest || w.ticksCompleted !== scratch.windows[k].ticksCompleted)) {
                findings.push(`${at}: the run is not the model walk's (ticks ${w.ticksCompleted} vs ${scratch.windows[k].ticksCompleted})`);
            }
        });
        console.log(`[jsRuntimeTape.slow] r9-campaign: ${played.length} window(s); ${findings.length} finding(s)`);
        expect(findings).toEqual([]);
        expect(played).toHaveLength(30);
    }, 600000);
});
