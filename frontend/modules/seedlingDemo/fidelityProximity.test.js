/**
 * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — the proximity-hazard rows the solver passes.
 *
 * D1  the census facts the rows rest on (the press rects, the cross-room arms,
 *     the turret's contact pricing);
 * D2  `proximity-hazard:buttonroom` → `hold`, the covered chest resolved to its
 *     cover, the `pulse` refinement (L38), and the skirt OUT and BACK (L29);
 * D3  the ice turret: its live body's contact billed, and `brave` across its range.
 *
 * Every solver witness is the survey's staging (`plan-seedling-proximity-witness.mjs`)
 * and its committed tape is the plan, key for key; every hand witness's keys are
 * the script's own. The game's recordings are `fixtures/expectations/prox-*.json`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, rectsOverlap, ROLES } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape } from './tapeRunner.js';
import {
    OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, STRATEGY_REFINEMENTS, coverOverChest, pulseWeighFor,
    solveSegment,
} from './solverBot.js';
import { R8_STRATEGY_EXECUTORS } from './r8Acceptance.js';
import { KNOWN_STRATEGY_VERBS, summarizeTrace } from './decisionTrace.js';
import {
    PROXIMITY_WITNESSES, proximityStaging,
} from '../../../scripts/procgen/plan-seedling-proximity-witness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const expectation = (name) => JSON.parse(
    readFileSync(join(HERE, 'fixtures', 'expectations', `${name}.json`), 'utf8'));
const witness = (name) => PROXIMITY_WITNESSES.find((w) => w.name === name);
const keysAt = (t, i) => t.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key).sort().join('+');

/** A run at a witness's staging, plus its solve. */
async function solveWitness(name) {
    const w = witness(name);
    const staging = await proximityStaging(w);
    const run = createRunForStaging(staging, SRC);
    const out = solveSegment({ run, goals: w.goals, name: `${name}-resolve`, boot: staging.boot });
    return { w, run, out };
}

/** The committed tape IS the plan, tick for tick. */
function expectTapeIsPlan(name, out) {
    const t = tape(name);
    expect(out.perTick.length).toBe(t.tick_count);
    for (let i = 0; i < t.tick_count; i += 1) {
        expect(keysAt(t, i), `${name} t${i}`).toBe([...out.perTick[i]].sort().join('+'));
    }
}

/** The game's recording and the model's replay agree observation for observation. */
function expectGameIsModel(name) {
    const t = tape(name);
    const game = expectation(name);
    const model = runTape(t, { levelSource: SRC });
    expect(game.ticks).toHaveLength(model.ticks.length);
    for (let i = 0; i < game.ticks.length; i += 1) {
        const g = game.ticks[i];
        const m = model.ticks[i];
        expect({ level: m.level, x: m.x, y: m.y }, `${name} observation ${i}`)
            .toEqual({ level: g.level, x: g.x, y: g.y });
    }
    expect(game.transitions).toEqual(model.transitions);
    return { game, model };
}

describe('fidelity PROXIMITY D1 — the census the rows rest on', () => {
    const PLACED = MAP.levels.flatMap((l) => l.entities.filter((e) => e.type === 'buttonroom')
        .map((e) => ({ level: l.level, id: `buttonroom@${e.x},${e.y}`, x: e.x, y: e.y,
            room: Number(e.attrs?.room ?? -1), flip: Number(e.attrs?.flip ?? 0) })));

    it('every ButtonRoom\'s press rect is `setHitbox(8, 6, 4, 3)` at the ctor half-tile (`ButtonRoom.as:30-32`)', () => {
        expect(PLACED.length).toBeGreaterThan(0);
        for (const b of PLACED) {
            const w = buildLevelWorld(MAP.levels.find((l) => l.level === b.level), { roles: ROLES });
            const p = w.pressers.find((q) => `${q.tag}@${q.x},${q.y}` === b.id);
            expect(p.rect, b.id).toMatchObject({ x: b.x + 4, y: b.y + 5, w: 8, h: 6 });
        }
    });

    it('the cross-room ButtonRooms are all `flip = 1` (a CLEAR the press writes), named', () => {
        const cross = PLACED.filter((b) => b.room >= 0);
        expect(cross.map((b) => `L${b.level} ${b.id} -> L${b.room} flip ${b.flip}`).sort()).toEqual([
            'L38 buttonroom@144,288 -> L37 flip 1', 'L38 buttonroom@32,48 -> L39 flip 1',
            'L61 buttonroom@176,40 -> L63 flip 1', 'L63 buttonroom@32,64 -> L62 flip 1',
        ].sort());
    });
});

describe('fidelity PROXIMITY D2 — the ButtonRoom row, the covered chest and `pulse` (L38)', () => {
    it('the table names `hold` for `proximity-hazard:buttonroom`; `pulse` is a refinement, registered and derived', () => {
        expect(OBSTACLE_STRATEGIES['proximity-hazard:buttonroom']).toBe('hold');
        expect(STRATEGY_REFINEMENTS.map((r) => `${r.from} -> ${r.to}`)).toContain('hold -> pulse');
        expect(typeof STRATEGY_EXECUTORS.pulse).toBe('function');
        expect(R8_STRATEGY_EXECUTORS.executorDerivations.pulse.length).toBeGreaterThan(0);
        expect(KNOWN_STRATEGY_VERBS).toContain('pulse');
    });

    it('`pulseWeighFor`: L38\'s cover@144,112 is opened by the pulser parking the fire block on button@80,192', async () => {
        const staging = await proximityStaging(witness('prox-l38-reach-l39'));
        const run = createRunForStaging(staging, SRC);
        expect(pulseWeighFor(run, { kind: 'solid', tag: 'cover', id: 'cover@144,112' })).toMatchObject({
            pulser: 'pulser@80,224', block: 'pushableblockfire@80,208', button: 'button@80,192',
            publisher: { id: 'buttonroom@208,224' }, to: { x: 88, y: 200 },
        });
        expect(coverOverChest(run, { x: 144, y: 112 })).toMatchObject({ id: 'cover@144,112' });
        // CONTROL: cover@208,224's opener is a LATCHING ButtonRoom, not a momentary button.
        expect(pulseWeighFor(run, { kind: 'solid', tag: 'cover', id: 'cover@208,224' })).toBeNull();
    });

    it('route step 103: the frontier holds the buttonroom, PULSES, opens the chest and crosses to L39 — the tape IS the plan', async () => {
        const { run, out } = await solveWitness('prox-l38-reach-l39');
        expect(run.level).toBe(39);
        const verbs = out.records.map((r) => r.strategy).filter(Boolean);
        expect(verbs).toEqual(['hold', 'pulse', 'chest']);
        const pulse = out.records.find((r) => r.strategy === 'pulse');
        expect(pulse).toMatchObject({ verb: 'pulse', target: 'cover@144,112', block: 'pushableblockfire@80,208',
            button: 'button@80,192', publisher: 'buttonroom@208,224' });
        expect(summarizeTrace(out.trace).unknownStrategyVerbs).toEqual([]);
        expectTapeIsPlan('prox-l38-reach-l39', out);
    });

    it('route step 68: the chest GOAL resolves its cover (uncover, then pulse), collects it and crosses — the tape IS the plan', async () => {
        const { run, out } = await solveWitness('prox-l38-chest');
        expect(run.level).toBe(39);
        expect(out.records.filter((r) => r.strategy === 'pulse').map((r) => r.stage ?? 'pulse'))
            .toEqual(['uncover', 'pulse']);
        expect(run.ledger('chestOpens').map((c) => c.id)).toEqual(['chest@144,112']);
        expectTapeIsPlan('prox-l38-chest', out);
    });

    it.each(['prox-l38-chest', 'prox-l38-reach-l39'])('THE GAME agrees: %s, observation for observation (0 px)', (name) => {
        const { game } = expectGameIsModel(name);
        expect(game.transitions).toEqual([expect.objectContaining({ from_level: 38, to_level: 39 })]);
    });
});

describe('fidelity PROXIMITY D2 — the trap button skirted OUT and BACK (L29)', () => {
    it('route step 57: two skirts on the east lane, the return stance two tiles up, the rock never falls — the tape IS the plan', async () => {
        const { run, out } = await solveWitness('prox-l29-key-return');
        expect(run.level).toBe(22);
        const skirts = out.records.filter((r) => r.strategy === 'skirt');
        expect(skirts.map((r) => [r.lane, r.x])).toEqual([['east', 126], ['east', 126]]);
        expect(run.liveGeometryOpts().fallenRocks?.size ?? 0).toBe(0);
        expectTapeIsPlan('prox-l29-key-return', out);
    });

    it('THE GAME agrees: prox-l29-key-return, observation for observation (0 px), into L22', () => {
        const { game } = expectGameIsModel('prox-l29-key-return');
        expect(game.transitions).toEqual([expect.objectContaining({ from_level: 29, to_level: 22 })]);
        // The button rect is never entered: the press would drop the rock.
        const press = { x: 116, y: 133, w: 8, h: 6, right: 124, bottom: 139 };
        expect(game.ticks.filter((o) => o.level === 29 && rectsOverlap(playerBoxAt(o.x, o.y), press)))
            .toEqual([]);
    });
});
