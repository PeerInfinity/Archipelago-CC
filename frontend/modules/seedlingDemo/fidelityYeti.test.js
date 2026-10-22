/**
 * ⛓⛓⛓ SEEDLING FIDELITY YETI — the Yeti's `doneTalking()` and L58's tag-1 teleporter (wave 25; switch
 * `CONTACT_FIDELITY.yetiTalk`, OFF).
 *
 *     NPCs/Yeti.as:40-50   doneTalking(): if (!createdPortal) { createdPortal = true;
 *                          Game.setPersistence(tag, false); Game.setPersistence(1, false); }
 *     Teleporter.as:89-94  update(): checkDeactivated() every frame — the door opens in the same visit
 *     NPCs/NPC.as:119-126  check(): a cleared tag removes the NPC from the next `Game`
 *
 * Witnessed on the game (p4g headless logic-only, `probe-seedling-yeti.mjs`, `fixtures/yeti-witness/`): `talk` (the
 * solver's clear-tag, then onto the door: both flags off, L46 in the same visit), `control` (the dialogue left open:
 * both flags set), `shut` (no talk: the door's Pit tile takes the player, no crossing), `revisit` (both flags cleared
 * at the boot: no Yeti Solid, the door live). The model ON reproduces all four at 0 px, every tick.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { PLACED_NPC_TALK, YETI_PORTAL_TAG } from './dialogue.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, persistenceResponseOf } from './levelWorld.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape, stagingFromTape } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';
import {
    YETI_CLEAR, YETI_ID, yetiStaging, yetiTape, yetiTapes,
} from '../../../scripts/procgen/probe-seedling-yeti.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIT = join(HERE, 'fixtures', 'yeti-witness');
const NAMES = ['talk', 'control', 'shut', 'revisit'];
const witness = (name) => JSON.parse(readFileSync(join(WIT, `yeti-l58-${name}.json`), 'utf8'));
const ON = (fn) => withContactFidelity({ yetiTalk: true }, fn);
const OFF = (fn) => withContactFidelity({ yetiTalk: false }, fn);
const pos = (o) => ({ t: o.t, x: o.x, y: o.y, level: o.level });
const ENV = ['SEEDLING_CONTACT_FIDELITY', 'SEEDLING_YETI_TALK'];

describe('YETI D2 — the switch and the model', () => {
    // ⛓ shipped OFF; planning-10's flip (⚖ user "Yes, please do the flip", 2026-10-22) turns it ON.
    it.skipIf(ENV.some((k) => process.env[k]))('ships ON (flipped)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.yetiTalk).toBe(true);
        expect(CONTACT_FIDELITY.yetiTalk).toBe(true);
    });

    it('the table row stays REFUSED (byte-identical); the second tag is the DeadBoss portal\'s', () => {
        expect(PLACED_NPC_TALK.yeti.doneTalking).toBe('REFUSED');
        expect(YETI_PORTAL_TAG).toBe(1);
    });

    it('the build: OFF a cleared {58,0} refuses by name; ON `NPC.check()` removes the Yeti', () => {
        const rec = atlasLevelSource()(58);
        expect(OFF(() => persistenceResponseOf('yeti'))).toBeUndefined();
        expect(() => OFF(() => buildLevelWorld(rec, { cleared: [0] }))).toThrow(/NO declared persistence response/);
        const w = ON(() => buildLevelWorld(rec, { cleared: [0] }));
        expect(w.talkers.map((t) => t.id)).toEqual([]);
        expect(w.solids.some((s) => s.tag === 'yeti')).toBe(false);
        const fresh = ON(() => buildLevelWorld(rec, {}));
        expect(fresh.talkers.map((t) => t.id)).toEqual([YETI_ID]);
        expect(fresh.teleporters.find((t) => t.tag === YETI_PORTAL_TAG).deactivated).toBe(true);
    });

    it('OFF: opening the Yeti still refuses by name', async () => {
        const tape = parseTape(witness('talk').tape);
        expect(() => OFF(() => runTape(tape, { levelSource: atlasLevelSource() })))
            .toThrow(/`yeti`'s dialogue .* is NOT transcribed/s);
    });

    it('ON: the close writes both flags, opens the door mid-visit and keeps the Yeti for this visit', () => {
        const tape = parseTape(witness('talk').tape);
        ON(() => {
            const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
            let closedAt = null;
            for (let i = 0; i < tape.tick_count && run.level === 58; i += 1) {
                run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
                const close = run.yetiEvents.find((e) => e.what === 'yeti-close');
                if (close && closedAt === null) {
                    closedAt = close.t;
                    expect(close).toMatchObject({ cause: 'done', wrote: true, id: YETI_ID });
                    // The door reads the clear in this visit; the Yeti's own tag waits for the next build.
                    expect(run.world.teleporters.find((t) => t.tag === YETI_PORTAL_TAG).deactivated).toBe(false);
                    expect(run.world.talkers.map((t) => t.id)).toEqual([YETI_ID]);
                    expect(run.yetiFlags.map((f) => [f.tag, f.t, f.bootCleared])).toEqual([[0, close.t, false],
                        [1, close.t, false]]);
                    expect(run.ledger('earnedClears').filter((c) => c.level === 58).map((c) => c.tag).sort())
                        .toEqual([0, 1]);
                    // `{58,0}` waits for the next `Game` (`NPC.check()`); `{58,1}` is already in the room's build.
                    expect(run.ledger('bankedClears').filter((c) => c.level === 58)).toEqual([{ level: 58, tag: 0 }]);
                }
            }
            expect(closedAt).toBe(144);
        });
    });
});

describe('YETI D1 — the game witnesses, reproduced by the model ON at 0 px', () => {
    for (const name of NAMES) {
        it(`${name}: every tick of the game's stream`, () => {
            const w = witness(name);
            const out = ON(() => runTape(parseTape(w.tape), { levelSource: atlasLevelSource() }));
            expect(out.ticks.map(pos)).toEqual(w.gameTicks);
            // The game's array: what the boot staged, plus what the Yeti's `doneTalking()` earned.
            const staged = (w.tape.persistence ?? []).filter((c) => c.level === 58).map((c) => `58:${c.tag}`);
            const earned = out.yetiFlags.filter((f) => !f.bootCleared).map((f) => `58:${f.tag}`);
            expect([...new Set([...staged, ...earned])].sort()).toEqual([...w.game.cleared58].sort());
        });
    }

    it('the game\'s verdicts: talk crosses at t202, control and shut keep the flags, revisit crosses at t98', () => {
        expect(witness('talk').game).toMatchObject({ cleared58: ['58:0', '58:1'], crossedAt: 202 });
        expect(witness('control').game).toMatchObject({ cleared58: [], crossedAt: null });
        expect(witness('shut').game).toMatchObject({ cleared58: [], crossedAt: null });
        expect(witness('shut').game.final).toEqual({ t: 175, x: 64, y: 104, level: 58 });
        expect(witness('revisit').game).toMatchObject({ crossedAt: 98 });
    });

    it('the committed tapes are what the producer derives today', async () => {
        const tapes = await yetiTapes();
        for (const name of NAMES) {
            const t = await yetiTape(name, tapes[name]);
            expect(JSON.parse(JSON.stringify(t))).toEqual(witness(name).tape);
        }
    });
});

describe('YETI D3 — the clear-tag on {58,1} names the Yeti and talks', () => {
    const solve = async (on, goal, clears = []) => {
        const staging = await yetiStaging(clears);
        return withContactFidelity({ yetiTalk: on }, () => {
            try {
                const out = solveSegment({ run: createRunForStaging(staging, atlasLevelSource()), goals: [goal],
                    name: 'yeti', boot: staging.boot });
                return { solved: true, out };
            } catch (e) {
                return { solved: false, message: e.message, obstacle: e.obstacle ?? null };
            }
        });
    };

    it('OFF: no-verb on solid:yeti, as at the base', async () => {
        const r = await solve(false, YETI_CLEAR);
        expect(r.solved).toBe(false);
        expect(r.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'no-verb', id: YETI_ID });
    });

    it('ON: talks the Yeti out — the plan IS the witnessed talk tape\'s prefix, key for key', async () => {
        const r = await solve(true, YETI_CLEAR);
        expect(r.solved).toBe(true);
        expect(r.out.records).toHaveLength(1);
        expect(r.out.records[0]).toMatchObject({ arm: 'verb', strategy: 'talk', stance: { x: 56, y: 72 },
            openedAt: 54, closedAt: 144, cause: 'done', flag: { level: 58, tag: 1 } });
        const tape = (await yetiTapes()).talk;
        expect(r.out.perTick.map((h) => [...h].sort())).toEqual(tape.perTick.slice(0, r.out.perTick.length)
            .map((h) => [...h].sort()));
    });

    it('ON: {58,0} is the same talk', async () => {
        const r = await solve(true, { ...YETI_CLEAR, tag: { level: 58, tag: 0 } });
        expect(r.solved).toBe(true);
        expect(r.out.records[0]).toMatchObject({ arm: 'verb', strategy: 'talk', closedAt: 144 });
    });

    it('ON: either flag cleared at the boot is the game\'s already-clear; the impossible half-state cannot act', async () => {
        const a = await solve(true, YETI_CLEAR, [{ level: 58, tag: 1 }]);
        expect(a.out.records[0]).toMatchObject({ arm: 'already-clear' });
        expect(a.out.perTick).toHaveLength(0);
        const b = await solve(true, { ...YETI_CLEAR, tag: { level: 58, tag: 0 } }, [{ level: 58, tag: 0 }]);
        expect(b.out.records[0]).toMatchObject({ arm: 'already-clear' });
        const c = await solve(true, YETI_CLEAR, [{ level: 58, tag: 0 }]);
        expect(c.solved).toBe(false);
        expect(c.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'cannot-act' });
    });

    it('ON: the door after the talk is the PIT-teleporter refusal by name (the next gap, not this slice\'s)', async () => {
        const staging = await yetiStaging();
        const r = withContactFidelity({ yetiTalk: true }, () => {
            try {
                solveSegment({ run: createRunForStaging(staging, atlasLevelSource()), name: 'yeti', boot: staging.boot,
                    goals: [YETI_CLEAR, { kind: 'reach-exit', exit: { x: 80, y: 16 } }] });
                return null;
            } catch (e) { return e.obstacle ?? null; }
        });
        expect(r).toMatchObject({ kind: 'unmodelled-pit-teleporter', id: 'teleporter@80,16', tile: [5, 1] });
    });
});
