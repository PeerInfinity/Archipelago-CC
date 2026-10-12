/**
 * ⛓⛓⛓ SEEDLING FIDELITY STRIKELAPSE — the two route-survey steps `CONTACT_FIDELITY.strikeIframeLapse` cost, repaired
 * behind the switch (OFF byte-identical).
 *
 * D1 (survey step 50, L30 Torchpickup → L32): ON, the walk's own lapse-admitted presses kill `bobsoldier@48,80`, so
 * the corridor probe is clean and the kill arm is never asked — and the walk driven (dashed) left the body alive
 * beside the pickup. The collect's approach is now the stance walk's priced TAIL (`collectStandWalk`), ending on the
 * ceremony's start, where no live body may stand inside its pad and no corpse may still be in the room
 * (`ceremonyBesideLiveBody`, `createCorpseClock`). Game-witnessed: 413 t (the report's D1).
 *
 * D2 (survey step 62, L45 → L46): ON, the walk's own lapse-admitted press kills `jellyfish@224,176` at t204, and the
 * transit probe priced the DYING body as a live contact. The chaser forecast now projects a body in its "die" as
 * `dying` (`levelRun`'s projection), which `plannerContactFree` reads as `Enemy.hitPlayer`'s gate.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { withContactFidelity } from './contactFidelity.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { ceremonyBesideLiveBody, collectStandWalk } from './solverBot.js';
import { bobsoldier2Plan, BOBSOLDIER2_STEP50 } from '../../../scripts/procgen/plan-seedling-bobsoldier2.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const BODY = BOBSOLDIER2_STEP50.body;

describe('STRIKELAPSE D1 — the collect stand and the ceremony arm', () => {
    const run = createRunForStaging(stagingFromTape(tape('bobsoldier2-l30-torch')), SRC);
    const torch = run.world.pickups.find((p) => p.tag === 'torchpickup');

    it('`collectStandWalk`: a bounded tail whose keys answer `null` on the pickup\'s box, `{}` without a target', () => {
        expect(collectStandWalk(run, {}, { x: 72, y: 56 })).toEqual({});
        const { stand } = collectStandWalk(run, { target: torch }, { x: 72, y: 56 });
        // the pickup box's centre (72,72) from the stance (72,56): 16 px at WALK_SPEED 0.8, + HOLD_SLACK 30
        expect(stand.ticks).toBe(20 + 30);
        const keys = stand.keys();
        expect(keys({ ...run.state, x: 72, y: 56, vx: 0, vy: 0 })).toBeInstanceOf(Set);
        const onIt = { ...run.state, x: 72, y: 70, vx: 0, vy: 0 };
        expect(playerBoxAt(onIt.x, onIt.y).bottom).toBeGreaterThan(torch.rect.y);
        expect(keys(onIt)).toBeNull();
    });

    it('`ceremonyBesideLiveBody`: a live body inside its pad, a dying body anywhere and an i-framed body refuse', () => {
        const at = { x: 72, y: 66 };
        const live = (x, y, over = {}) => ({ id: BODY, tag: 'bobsoldier', x, y, hits: 1, hitsTimer: 0, ...over });
        expect(ceremonyBesideLiveBody(run, { ...at, chasers: [] }).danger).toBe(false);
        expect(ceremonyBesideLiveBody(run, { ...at, chasers: [live(75, 71)] }).sources[0].why)
            .toMatch(/beside a LIVE body .*shieldBump/);
        expect(ceremonyBesideLiveBody(run, { ...at, chasers: [live(200, 200)] }).danger).toBe(false);
        expect(ceremonyBesideLiveBody(run, { ...at, chasers: [live(200, 200, { hitsTimer: 12 })] }).sources[0].why)
            .toMatch(/inside 12 ticks of i-frames.*assertNoCeremonyBesideLiveChaser/);
        expect(ceremonyBesideLiveBody(run, { ...at, chasers: [] }, [{ id: BODY, tag: 'bobsoldier', x: 200, y: 200,
            dying: true }]).sources[0].why).toMatch(/is DYING/);
    });

    it('ON: survey step 50 solves in 413 t with zero hits; the body dies on the walk, gone before the ceremony', async () => {
        const { solved } = await withContactFidelity({ strikeIframeLapse: true }, () => bobsoldier2Plan(true));
        expect(solved.out.perTick.length).toBe(413);
        expect(solved.out.records.some((r) => r.strategy === 'kill')).toBe(false);
        const collect = solved.out.records.find((r) => r.strategy === 'collect');
        expect(collect).toMatchObject({ item: 'torch', from: 147, approach: 10, ceremony: 29 });
        const st = withContactFidelity({ strikeIframeLapse: true }, () => {
            let killedAt = null;
            let removedAt = null;
            let run2 = null;
            const r = createRunForStaging({ ...stagingFromTape(tape('bobsoldier2-l30-torch')),
                persistence: solved.persistence }, SRC);
            solved.out.perTick.forEach((held, i) => {
                r.advance(held);
                const b = (r.entities('chasers') ?? []).find((c) => c.id === BODY);
                if (b?.destroy && killedAt === null) killedAt = i + 1;
                if (!b && removedAt === null) removedAt = i + 1;
                run2 = r;
            });
            return { killedAt, removedAt, hits: run2.ledger('playerHits').length, level: run2.level };
        });
        expect(st).toEqual({ killedAt: 143, removedAt: 154, hits: 0, level: 32 });
        expect(st.removedAt).toBeLessThan(collect.from + collect.approach);
    }, 120_000);

    it('OFF: the plan is the witness `bobsoldier2-l30-torch` (460 t), byte for byte', async () => {
        const { solved } = await withContactFidelity({ strikeIframeLapse: false }, () => bobsoldier2Plan(true));
        expect(solved.out.perTick.length).toBe(tape('bobsoldier2-l30-torch').tick_count);
        const witness = tape('bobsoldier2-l30-torch');
        solved.out.perTick.forEach((held, t) => {
            expect([...held].sort()).toEqual([...heldKeysAt(witness, t)].sort());
        });
    }, 120_000);
});

describe('STRIKELAPSE D2 — the chaser forecast projects a body in its death as `dying`', () => {
    const killed = (on) => withContactFidelity({ strikeIframeLapse: on }, () => {
        const run = createRunForStaging(stagingFromTape(tape('r9-solve-14')), SRC);
        const fc = run.chaserForecast();
        const id = run.entities('chasers')[0].id;
        const st = { ...run.state };
        const rows = [];
        for (let t = 0; t < 120; t += 1) {
            if (t % 35 === 0) fc.hit(id, st);
            const b = fc.step(st, { slashing: false }).find((c) => c.id === id);
            rows.push(b ? { t, hits: b.hits, dying: b.dying === true } : { t, gone: true });
        }
        return rows;
    });

    it('ON: from the killing hit (t70) the projection says `dying`, and `plannerContactFree` then reads it free', () => {
        const rows = killed(true);
        expect(rows.find((r) => r.dying)).toMatchObject({ t: 70, hits: 3 });
        expect(rows.filter((r) => r.t < 70).every((r) => !r.dying)).toBe(true);
    });

    it('OFF: the same kill is projected with no `dying` until it leaves the projection (the base model)', () => {
        const rows = killed(false);
        expect(rows.some((r) => r.dying)).toBe(false);
        expect(rows.find((r) => r.hits === 3)).toMatchObject({ t: 70 });
        expect(rows.at(-1)).toEqual({ t: 119, gone: true });
    });
});
