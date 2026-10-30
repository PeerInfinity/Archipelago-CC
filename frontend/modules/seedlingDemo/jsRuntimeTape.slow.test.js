/**
 * jsRuntimeTape.slow — ⛓⛓ PHASE B over the WHOLE committed tape roster: every `fixtures/tapes/*.json` that
 * `parseTape` accepts is shipped to the JS core the way the lab ships it (`gameVisibleTape` → `botLoadTape` →
 * `botStart`, ticked to `finished`, `botDrain`) and its drain is diffed against `runTape` over the same atlas.
 *
 * ⛔ Every one must load, finish without an error, and agree at EVERY tick. Measured when this landed: 293 of 293
 * (≈43 s — hence the slow tier). The roster grows with the fixtures; the count is printed, not pinned.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
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
