/**
 * seedling-js-inventory-menu — the V inventory menu's face of the run (fidelity-15's W0 ACK, C1-C7).
 *
 * The menu's own state (open / selected / the slide) is `inventoryMenu.js`'s and its rows are
 * `inventoryMenu.test.js`; these rows are the RUN's half: `secondary`, `firstUse`, the writes, the hold, the
 * C press behind `CONTACT_FIDELITY.secondaryUse`, and the conditional digest key.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'slot-order-oracle.json'), 'utf8'));
const BASE = parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${ORACLE.base}.json`), 'utf8'));
const NONE = new Set();

/** The slots oracle's base room, idle, holding `items` (sword + fire by default: two slots, so `firstUse`). */
const runWith = (items = { hasSword: true, hasFire: true }, seam = {}) => {
    const t = parseTape({ ...BASE, seam: { ...BASE.seam, items: { ...BASE.seam.items, ...items }, primary: 0, ...seam },
        grants: [], equips: [], inputs: [], tick_count: 40 });
    const run = createRunForStaging(stagingFromTape(t), SRC);
    for (let k = 0; k < 3; k += 1) run.advance(NONE);
    return run;
};

describe('the run\'s menu state — seeded, sticky, modulo (Inventory.as:118-119, :170-177)', () => {
    it('two slots make `firstUse` true at the tail; `secondary` seeds from the seam', () => {
        const run = runWith();
        expect(run.inventorySlots.length).toBe(2);
        expect(run.firstUse).toBe(true);
        expect(run.secondary).toBe(0);
        expect(runWith({ hasSword: true, hasFire: true }, { secondary: 1 }).secondary).toBe(1);
    });
    it('one slot and no seam `first_use`: the menu refuses by name (Inventory.as:193)', () => {
        const run = runWith({ hasSword: true, hasFire: false });
        expect(run.firstUse).toBe(false);
        expect(run.inventoryOpenable).toBe(false);
        expect(run.inventoryRefusal).toMatch(/firstUse/);
    });
    it('the base room is openable with two items (no live family the hold refuses)', () => {
        const run = runWith();
        expect(run.inventoryRefusal).toBeNull();
        expect(run.inventoryOpenable).toBe(true);
    });
});

describe('menu writes — X → `Main.primary` via `equips`, C → `Main.secondary` (Inventory.as:208-217)', () => {
    it('an X write lands in `equipsFired` at the tick the run has reached, and selects the slot', () => {
        const run = runWith();
        const t = run.ticksCompleted;
        run.inventoryMenuWrite({ kind: 'primary', slot: 1 });
        expect(run.primary).toBe(1);
        expect(run.equipsFired.at(-1)).toEqual({ t, slot: 1 });
    });
    it('two X writes in one hold are one row: the game keeps the last (a plain store)', () => {
        const run = runWith();
        const n = run.equipsFired.length;
        run.inventoryMenuWrite({ kind: 'primary', slot: 1 });
        run.inventoryMenuWrite({ kind: 'primary', slot: 0 });
        expect(run.equipsFired.length).toBe(n + 1);
        expect(run.primary).toBe(0);
    });
    it('a C write sets `secondary` and the run-local ledger; an out-of-range slot is refused by name', () => {
        const run = runWith();
        run.inventoryMenuWrite({ kind: 'secondary', slot: 1 });
        expect(run.secondary).toBe(1);
        expect(run.secondariesFired).toEqual([{ t: run.ticksCompleted, slot: 1 }]);
        expect(() => run.inventoryMenuWrite({ kind: 'secondary', slot: 2 })).toThrow(/out-of-range slot/);
    });
});

describe('C5 — the conditional digest key (`menuDigest`)', () => {
    it('an untouched run digests with NO menu key: identical to a run that never had the API', () => {
        const a = runWith();
        const b = runWith();
        expect(a.stateDigest()).toBe(b.stateDigest());
    });
    it('member reach: after a C write, `secondary` moves the `player` part and nothing else', () => {
        const a = runWith();
        const b = runWith();
        a.inventoryMenuWrite({ kind: 'secondary', slot: 0 });
        b.inventoryMenuWrite({ kind: 'secondary', slot: 1 });
        const pa = a.stateDigest({ parts: true }).parts;
        const pb = b.stateDigest({ parts: true }).parts;
        expect(pa.player).not.toBe(pb.player);
        for (const k of Object.keys(pa)) if (k !== 'player') expect(pa[k]).toBe(pb[k]);
    });
    it('a touch with the SAME values still moves `player` (the key joins), and only `player`', () => {
        const a = runWith();
        const b = runWith();
        b.inventoryMenuWrite({ kind: 'secondary', slot: 0 });
        const pa = a.stateDigest({ parts: true }).parts;
        const pb = b.stateDigest({ parts: true }).parts;
        expect(pa.player).not.toBe(pb.player);
        for (const k of Object.keys(pa)) if (k !== 'player') expect(pa[k]).toBe(pb[k]);
    });
});

describe('C1-C3 — the hold: zero tape ticks, spent on the clock, refused where it cannot step', () => {
    it('a hold of N frames leaves the tick where it was and spends N frozen frames (Game.as:890)', () => {
        const run = runWith();
        const t = run.ticksCompleted;
        const owed = run.frozenFramesOwed;
        const dead = run.deadFramesOwed;
        run.inventoryHold(37);
        expect(run.ticksCompleted).toBe(t);
        expect(run.frozenFramesOwed - owed).toBe(37);
        expect(run.deadFramesOwed - dead).toBe(37);
        expect(run.inventoryHolds).toEqual([{ t, level: run.level, frames: 37 }]);
        expect(run.deadFrameSpans.at(-1)).toMatchObject({ frames: 37, kind: 'freeze', why: 'inventory', t });
    });
    it('a hold of 0 frames is nothing at all', () => {
        const run = runWith();
        const d = run.stateDigest();
        run.inventoryHold(0);
        expect(run.stateDigest()).toBe(d);
    });
    it('a hold where the menu cannot open throws with the refusal\'s reason', () => {
        const run = runWith({ hasSword: true, hasFire: false });
        expect(() => run.inventoryHold(5)).toThrow(/menu cannot be open here: .*firstUse/);
    });
    it('a room holding a live family the hold does not step refuses by that family\'s name (L71: SpinningAxe)', () => {
        const raw = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'axe-l71-reach-l76.json'), 'utf8'));
        const t = parseTape({ ...raw, seam: { ...raw.seam, items: { ...raw.seam.items, hasSword: true, hasFire: true } },
            grants: [], equips: [], inputs: [], tick_count: 10 });
        const run = createRunForStaging(stagingFromTape(t), SRC);
        for (let k = 0; k < 3; k += 1) run.advance(NONE);
        expect(run.inventoryRefusal).toMatch(/spinningAxes .*SpinningAxe\.as:52/);
        expect(() => run.inventoryHold(1)).toThrow(/spinningAxes/);
    });
    it('the census classifies every family as stepped / inert / refuse, each with its reason', () => {
        const census = runWith().inventoryHoldCensus;
        expect(census.length).toBeGreaterThan(30);
        for (const row of census) {
            expect(['stepped', 'inert', 'refuse']).toContain(row.treatment);
            expect(row.why.length).toBeGreaterThan(10);
        }
        expect(new Set(census.map((r) => r.family)).size).toBe(census.length);
    });
});

describe('C4 — a C press is `useItem(Main.secondary)` behind `secondaryUse` (Player.as:1561-1568)', () => {
    const cTape = (inputs) => parseTape({ ...BASE, seam: { ...BASE.seam, items: { ...BASE.seam.items, hasSword: true, hasFire: true },
        primary: 1, secondary: 0 }, grants: [], equips: [], inputs, tick_count: 20 });
    const drive = (inputs) => {
        const t = cTape(inputs);
        const run = createRunForStaging(stagingFromTape(t), SRC);
        for (let k = 0; k < 12; k += 1) {
            const held = new Set(t.inputs.filter((i) => k >= i.from && k < i.to).map((i) => i.key));
            run.advance(held);
        }
        return run;
    };
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.secondaryUse).toBe(false);
    });
    it('OFF: a C press is read by nothing — the run equals an idle one, byte for byte', () => {
        withContactFidelity({ secondaryUse: false }, () => {
            const idle = drive([]).stateDigest();
            const c = drive([{ key: 'secondary', from: 4, to: 6 }]);
            expect(c.stateDigest()).toBe(idle);
            expect(c.slashPresses).toEqual([]);
        });
    });
    it('ON: a C press with `secondary` on the sword slot swings the sword (slot 1, the primary, is Fire)', () => {
        withContactFidelity({ secondaryUse: true }, () => {
            const run = drive([{ key: 'secondary', from: 4, to: 6 }]);
            expect(run.slashPresses.map((d) => d.t)).toEqual([4]);
        });
    });
    it('ON (seedling-js-xc-model): X and C on one tick are `useItem(primary)` then `useItem(secondary)` — the Fire '
        + 'press, then a sword call `set slashing` GATES on `firing` (Player.as:782); the tick is X\'s', () => {
        withContactFidelity({ secondaryUse: true }, () => {
            const xc = drive([{ key: 'secondary', from: 4, to: 6 }, { key: 'primary', from: 4, to: 6 }]);
            const x = drive([{ key: 'primary', from: 4, to: 6 }]);
            expect(xc.slashPresses.map((d) => [d.t, d.outcome])).toEqual([[4, 'gated']]);
            expect({ x: xc.state.x, y: xc.state.y }).toEqual({ x: x.state.x, y: x.state.y });
            expect(xc.presses).toEqual(x.presses);
        });
    });
});
