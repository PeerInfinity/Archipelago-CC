/**
 * ⛓⛓⛓ seedling-fidelity-p4hfix — THE p4h GAME WITNESSES, AGAINST THE MODEL ASKED AS p4h.
 *
 * The evidence is the planner's local measure pass (`seedling-fidelity-planning-23`), recorded on the p4h GAME
 * (`seedling_bot_ap_p4h`, headless logic-only, a fresh page per tape) and committed as evidence, NOT as fixtures:
 * `CC/docs/cloud-reports/seedling-fidelity-p4h-witness-evidence/`. This file reads it IN PLACE (re-recording it into
 * `fixtures/` needs Robert's own OK). The model is asked as p4h by passing the build's `capabilities` to
 * `createRunForStaging` / `createLevelRun`: no `setModelBuildDefault`, so nothing here moves the default.
 *
 *   1. `tb-recordings/*.json`: the TentacleBeast witnesses (the `fixtures/tentaclebeast-witness/` shape: a tape and
 *      the game's per-tick samples). Every tick must agree as `fidelityTentacleBeast.test.js` compares them: the
 *      player, the level, the hits, the beast's anim, every tentacle, and the page generator's state.
 *   2. `owl/owl-judge-p4h.json` + `owl/owl-exit-p4h.json`: the Owl tapes judged on the game. The two A plans
 *      (`fixtures/p4h-owl-plans/`) win there (0 hits, `112:0` + `112:1`, L113 at (80, 136)); the model must reach
 *      L113 on the game's tick, agree with the game over the exit window, and take no hit. The two r6-owl tapes must
 *      end where the game's stream ends, with its hits and flags.
 *
 * The two defects these rows found (the report's D1/D2, `CC/docs/cloud-reports/seedling-fidelity-p4hfix.md`):
 *   · a hit-death tick dropped that frame's Swim-channel step (`Bot.as:3089-3094`), so the stroke boost came a tick
 *     late after the rebuild (`tb-solve-s2`, `tb-policy-s2`, `tb-hitless-pit`, `whirlpool-drown-s15`);
 *   · the Owl's death arm never published `Button.activateAll(null, 0, true)` (`FinalBoss.as:224 (p4h; :218 at p4g)`) to the exit
 *     column's `rocklock@112,16`, whose fade (`RockLock.as:56-67`) opens it.
 *
 * Mutants (predicted, then run by copy + edit + restore; the report's table): W1 the death tick's Swim step removed →
 * exactly those four TB rows red; W2 the RockLock arm removed → both A-plan rows red (L112, not L113) and nothing else.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper } from './tapeRunner.js';
import { createLevelRun } from './levelRun.js';
import { ROLES } from './levelWorld.js';
import { withContactFidelity } from './contactFidelity.js';
import { declaresBossDraws } from './modelBuild.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const EVIDENCE = join(ROOT, 'CC/docs/cloud-reports/seedling-fidelity-p4h-witness-evidence');
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8'));
const P4H_CAPS = MANIFEST.builds.find((b) => b.name === 'seedling_bot_ap_p4h').capabilities;
const SRC = atlasLevelSource();

const TB_DIR = join(EVIDENCE, 'tb-recordings');
const TB = readdirSync(TB_DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(TB_DIR, f), 'utf8')));
const OWL_JUDGE = JSON.parse(readFileSync(join(EVIDENCE, 'owl/owl-judge-p4h.json'), 'utf8'));
const OWL_EXIT = JSON.parse(readFileSync(join(EVIDENCE, 'owl/owl-exit-p4h.json'), 'utf8'));

const rows = (a) => a.map((p) => p.join(',')).sort().join('|');

/** The TB comparator's model half (`fidelityTentacleBeast.test.js`'s `modelSamples`), asked as p4h. */
function tbModelSamples(tape) {
    const out = [];
    withContactFidelity({ tentacleBeastFight: true }, () => {
        const run = createRunForStaging(tape, SRC, { capabilities: P4H_CAPS });
        const st = createTapeStepper(tape, { levelSource: SRC, run });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const v = run.tentacleBeastFight;
            out[o.t] = {
                x: o.x, y: o.y, level: run.level, hits: run.damage.hits,
                beast: v ? v.beast.anim : null,
                tentacles: rows((v?.tentacles ?? []).map((q) => [q.x, q.y, q.anim, q.index, q.alpha])),
                rngState: v ? v.rngState : null,
                dead: v ? v.beast.dead === true : false,
            };
            r = st.next();
        }
    });
    return out;
}

/** Every disagreement between the game's samples and the model's, in tick order. */
function tbDisagreements(w) {
    const m = tbModelSamples(parseTape(JSON.stringify(w.tape)));
    const bad = [];
    for (const g of w.samples) {
        const s = m[g.t];
        if (!s) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (s.x !== g.x || s.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${s.x}, ${s.y})`);
        if (s.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${s.level}`);
        if (s.hits !== g.hits) bad.push(`t ${g.t}: hits game ${g.hits} model ${s.hits}`);
        if (g.level !== 57) continue;
        if ((g.boss?.anim ?? null) !== s.beast) bad.push(`t ${g.t}: beast game ${g.boss?.anim} model ${s.beast}`);
        if (rows(g.tentacleRows) !== s.tentacles) bad.push(`t ${g.t}: tentacles differ`);
        // a beast BUILT dead has no stream, so the model claims no generator state (the TB comparator's rule)
        if (s.rngState === null && s.dead) continue;
        if (g.rngState !== s.rngState) bad.push(`t ${g.t}: rng game ${g.rngState} model ${s.rngState}`);
    }
    return bad;
}

/** The judge's model half (`tools/judge-exit.mjs` `modelReplay`), asked as p4h. */
function owlModelReplay(tape) {
    const run = createLevelRun({
        levelSource: SRC, boot: tape.boot, noclip: tape.noclip, noHazards: tape.noHazards,
        noDamage: tape.noDamage, grants: tape.grants, persistence: tape.persistence, equips: tape.equips,
        pins: tape.pins, save: tape.save, rng: tape.rng, roles: ROLES, capabilities: P4H_CAPS,
        ...(tape.inventory_slots ? { inventorySlots: tape.inventory_slots } : {}),
    });
    const stream = [];
    for (let t = 0; t < tape.tick_count; t += 1) {
        stream.push({ t, x: run.state.x, y: run.state.y, level: run.level });
        run.advance(heldKeysAt(tape, t));
    }
    stream.push({ t: tape.tick_count, x: run.state.x, y: run.state.y, level: run.level });
    return {
        stream,
        hits: run.playerHits.length,
        flags: run.finalBossFlags.map((f) => `${f.level}:${f.tag}`).sort(),
    };
}
const tapeFile = (rel) => parseTape(readFileSync(join(HERE, 'fixtures', rel), 'utf8'));

describe('p4hfix — the p4h build is what these rows ask', () => {
    it('the manifest\'s p4h row declares `bossdraws`, and the rows pass it as `capabilities`', () => {
        expect(declaresBossDraws(P4H_CAPS)).toBe(true);
        expect(TB.length).toBeGreaterThan(0);
        for (const w of TB) expect(w.page).toBe('seedling_bot_ap_p4h');
    });
});

describe('p4hfix — the TentacleBeast witnesses recorded on the p4h game, every tick', () => {
    for (const w of TB) {
        it(`${w.name}: the player, the beast, every tentacle and the generator agree on every sampled tick`, () => {
            expect(tbDisagreements(w).slice(0, 6)).toEqual([]);
        }, 120000);
    }
});

describe('p4hfix — the Owl tapes judged on the p4h game', () => {
    for (const exit of OWL_EXIT) {
        const judged = OWL_JUDGE.find((r) => r.tape === exit.tape);
        it(`${exit.tape}: L113 on the game's tick, the exit window agrees, no hit, both flags`, () => {
            const m = owlModelReplay(tapeFile(`p4h-owl-plans/${exit.tape}`));
            const gameArrival = exit.gameStreamExit.find((g) => g.level === 113).t;
            const modelArrival = m.stream.find((s) => s.level === 113)?.t ?? null;
            expect(modelArrival).toBe(gameArrival);
            const bad = exit.gameStreamExit.filter((g) => {
                const s = m.stream[g.t];
                return s.x !== g.x || s.y !== g.y || s.level !== g.level;
            }).map((g) => `t ${g.t}`);
            expect(bad).toEqual([]);
            expect(m.stream.at(-1)).toMatchObject(judged.gameStreamTail.at(-1));
            expect([m.hits, judged.hits]).toEqual([0, 0]);
            expect(m.flags).toEqual(judged.cleared);
        }, 120000);
    }
    for (const name of ['r6-owl-control.json', 'r6-owl-kill.json']) {
        const judged = OWL_JUDGE.find((r) => r.tape === name);
        it(`${name}: the game's end (level, position), its hits and its flags`, () => {
            const m = owlModelReplay(tapeFile(`tapes/${name}`));
            expect(m.stream.at(-1)).toEqual(judged.gameStreamTail.at(-1));
            expect(m.hits).toBe(judged.hits);
            expect(m.flags).toEqual(judged.cleared);
        }, 120000);
    }
});
