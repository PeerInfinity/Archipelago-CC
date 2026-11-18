/**
 * ⛓ fidelity WALLFLYERCORPSE (wave 45) — `CONTACT_FIDELITY.wallFlyerCorpseGone`, shipped OFF
 * (`CC/docs/cloud-reports/seedling-fidelity-wallflyercorpse.md`; ⚖ user 2026-11-15, "OFF key, flip later").
 *
 * D1, the game: a wallflyer touches the player only through `Enemy.hitPlayer`, gated
 * `!destroy && currentAnim != "die" && hitsTimer <= 0` (`Enemies/Enemy.as:211-221`); `WallFlyer.startDeath` plays "die"
 * (`Enemies/WallFlyer.as:47-51`) and `endAnim` sets `destroy` (`:99-110`). So a DYING wallflyer never hurts, and a
 * removed one is not in the world. `dangerMap.staticEnemyDanger` priced every wallflyer at its `.oel` placement for
 * the whole visit, the dead ones too (hammer WALLFLYER-GAPS §3: survey step 35, the dashless corridor meets the dead
 * wallflyer@64,80's placement at t432 and the ladder EXHAUSTS).
 *
 * The witness is survey step 35's own boot view (`fixtures/wallflyer-drill-kill/survey-step-35-boot.json`, L22) and
 * the step's unbudgeted 539 t full-pass plan, inlined below (run-length: `keys*n`, `-` = no key) so the slice adds no
 * fixture. Provenance: hammer's `fixtures/wallflyer-gaps/survey-step-35-plan-539.json` at `hammer-flip-wallflyer-kill`
 * b45422fa82 (blob 25cdfaf394, sha256 6c5b0094…), the plan the arm-ON solve of this step makes (hammer §4). Its keys
 * kill wallflyer@48,112 (die t287, destroy t300, removed t311) and wallflyer@64,80 (die t408, destroy t421, removed
 * t432) with the sword; the replay itself reads no solver switch, so it is the same with the arm ON or OFF.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { levelSourceFromAtlas } from './atlasSource.js';
import { contactRect } from './combat.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { staticEnemyDanger } from './dangerMap.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = levelSourceFromAtlas(patchedMapDocument(JSON.parse(readFileSync(
    join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'))));
const STAGING = solveStaging(stagingFromTape(parseTape(readFileSync(
    join(HERE, 'fixtures', 'wallflyer-drill-kill', 'survey-step-35-boot.json'), 'utf8'))));
const PLAN_RLE = [
    'right*47,primary,right*18,left,right*2,-,left*2,-,down,primary,up,-*2,down*26,primary,down*13,up,down,-*3,up,',
    '-*10,up*40,-*2,down*2,-*4,left+up*2,down+left,left*25,right,left,-*2,right,-*3,left,-*4,primary,-*30,primary,',
    '-*30,primary,-*25,right+up*2,left+up,right+up,up*3,left+up*2,up*2,right+up*2,up*2,left+up*2,up*2,right+up*2,',
    'down,up,left,-,down*2,-*2,up,-*3,primary,-*30,primary,-*30,primary,-*25,right+up,down+right,right+up,right*6,',
    'down+right,right*2,left,right,up,-*3,left,-*4,up*11,down,up,down,up,-*3,primary,right,primary+right,right*5,',
    'primary+right,left*2,right*4,left,right,-*2,left,primary,-,primary+up,down,up*7,down,up,-*2,down,-*2,right*2,',
    'primary+right,right,primary+right,right*5,primary+right,right*5,primary+right,left,right*4,primary+right,right,',
    'primary+right,left*2,right',
].join('');
const PLAN = PLAN_RLE.split(',').flatMap((r) => {
    const [k, n] = r.split('*');
    return Array(n === undefined ? 1 : Number(n)).fill(k === '-' ? '' : k);
});

const ALL = ['wallflyer@64,80', 'wallflyer@128,80', 'wallflyer@48,112', 'wallflyer@144,112'];
const idOf = (e) => `${e.tag}@${e.x},${e.y}`;

/** Replay the plan to each asked tick and read, at each, the family and the ids priced at their placements ON/OFF. */
function readAt(ticks) {
    const run = createRunForStaging(STAGING, SOURCE);
    const flyers = run.worldFor(22).combat.enemies.filter((e) => e.tag === 'wallflyer');
    const priced = (on) => withContactFidelity({ wallFlyerCorpseGone: on }, () => flyers
        .filter((e) => staticEnemyDanger(run, contactRect(e)).some((d) => d.id === idOf(e))).map(idOf));
    const out = {};
    let t = 0;
    for (const at of [...ticks].sort((a, b) => a - b)) {
        for (; t < at; t += 1) run.advance(new Set(PLAN[t] ? PLAN[t].split('+') : []));
        out[at] = {
            level: run.level,
            hits: run.ledger('playerHits').length,
            family: run.entities('wallFlyerBodies').map((w) => ({ id: w.id, dying: !!w.dieAnim, destroy: w.destroy })),
            off: priced(false),
            on: priced(true),
        };
    }
    return { out, flyers };
}

const READ = readAt([0, 286, 287, 300, 311, 432]);

describe('fidelity WALLFLYERCORPSE — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_WALLFLYER_CORPSE_GONE)(
        'shipped OFF (⚖ user 2026-11-15, "OFF key, flip later"), ON since the WALLFLYERCORPSE flip; appended after corridorForecastMemo, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.wallFlyerCorpseGone).toBe(true);
            // ⛓ wave 46: DARKSUITSTATIC `darkSuitStaticRetaliation` was appended after this key; waves 47/48 after that.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf('wallFlyerCorpseGone') + 1)).toEqual(['darkSuitStaticRetaliation', 'pulserForecastPulse', 'darkSuitBossRetaliation', 'owlContactInStep', 'turretSuitRetaliation']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_WALLFLYER_CORPSE_GONE');
        });
    it(`the witness: L22's ${ALL.length} wallflyers, the ${PLAN.length} t plan, hitless in L22 to every read tick`, () => {
        expect(PLAN.length).toBe(539);
        expect(READ.flyers.map(idOf)).toEqual(ALL);
        for (const r of Object.values(READ.out)) {
            expect(r.level).toBe(22);
            expect(r.hits).toBe(0);
        }
    });
});

describe('fidelity WALLFLYERCORPSE D2 — `staticEnemyDanger` and the run\'s wallflyers', () => {
    it('t0 and t286 (all four live): ON = OFF, all four priced at their placements (a live body keeps its price)', () => {
        for (const t of [0, 286]) {
            expect(READ.out[t].family.every((w) => !w.dying && !w.destroy)).toBe(true);
            expect(READ.out[t].off).toEqual(ALL);
            expect(READ.out[t].on).toEqual(ALL);
        }
    });
    it('t287 — DYING (the "die" anim on, no `destroy` yet): OFF prices wallflyer@48,112, ON does not', () => {
        expect(READ.out[287].family.find((w) => w.id === 'wallflyer@48,112')).toEqual(
            { id: 'wallflyer@48,112', dying: true, destroy: false });
        expect(READ.out[287].off).toEqual(ALL);
        expect(READ.out[287].on).toEqual(['wallflyer@64,80', 'wallflyer@128,80', 'wallflyer@144,112']);
    });
    it('t300 — FADING (`destroy` set, still in the world): OFF prices wallflyer@48,112, ON does not', () => {
        expect(READ.out[300].family.find((w) => w.id === 'wallflyer@48,112')).toEqual(
            { id: 'wallflyer@48,112', dying: true, destroy: true });
        expect(READ.out[300].off).toEqual(ALL);
        expect(READ.out[300].on).toEqual(['wallflyer@64,80', 'wallflyer@128,80', 'wallflyer@144,112']);
    });
    it('t311 — REMOVED: wallflyer@48,112 has left the family; OFF still prices it, ON does not', () => {
        expect(READ.out[311].family.map((w) => w.id)).toEqual(['wallflyer@64,80', 'wallflyer@128,80', 'wallflyer@144,112']);
        expect(READ.out[311].off).toEqual(ALL);
        expect(READ.out[311].on).toEqual(['wallflyer@64,80', 'wallflyer@128,80', 'wallflyer@144,112']);
    });
    it('t432 — hammer\'s ghost tick: OFF keeps all four, ON drops both killed ids', () => {
        expect(READ.out[432].family.map((w) => w.id)).toEqual(['wallflyer@128,80', 'wallflyer@144,112']);
        expect(READ.out[432].off).toEqual(ALL);
        expect(READ.out[432].on).toEqual(['wallflyer@128,80', 'wallflyer@144,112']);
    });
});
