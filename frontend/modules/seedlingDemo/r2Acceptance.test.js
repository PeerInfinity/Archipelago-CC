/**
 * r2Acceptance — every R2 assertion, MUTATED and asserted red.
 *
 * ⚠ The point of this suite, and it is the same point R1's makes with more
 * riding on it. R2's terminal claim and its segment chain run exactly once
 * per `--win --tier=full` sweep, against a replay that takes the better part
 * of an hour. Seen only passing, "the check is green" and "the check cannot
 * go red" are the same observation. The two that matter most here are new:
 * `hitsMax == 3` is proved by an item's ABSENCE, and the hold is proved by
 * a pair of claims about the game's own positions — both of which are
 * exactly the shape that passes vacuously if wired wrong.
 *
 * So the acceptance logic is a pure function over the game's own reports,
 * and here each input is corrupted in turn. Every one must name its own
 * check.
 *
 * The statuses below are BUILT FROM THE JS MIRROR, which is legitimate here
 * and nowhere else: this suite tests the CHECKS, not the game. The verify
 * script feeds the same functions the game's real `botStatus`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ITEM_PROPERTIES } from './tapeFormat.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import {
    R2_FULL_WALK_NAME, R2_HITS_MAX, R2_HOLD_TICKS, R2_HOLD_WITNESS, R2_SEGMENT_NAMES,
    r2TapeSpecs,
} from './r2Walk.js';
import {
    PLAYER_BOX,
    R2_BLOCKED_ITEMS,
    R2_CLAIMED_ITEMS,
    longestStationaryHold,
    r2AcceptanceFindings,
    r2ChainFindings,
    r2HeadlineFindings,
} from './r2Acceptance.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const route = JSON.parse(readFileSync(join(HERE, 'fixtures', 'r2-route.json'), 'utf8'));
const specs = r2TapeSpecs(route);
const levelSource = atlasLevelSource();

/**
 * A `{stream, status}` shaped exactly like the harness drains one, built
 * from a JS run of the committed tape.
 */
function replayOf(name) {
    const run = runTape(loadTape(name), { levelSource });
    return {
        stream: { ticks: run.ticks, transitions: run.transitions },
        status: {
            items: { ...run.inventory },
            grants: run.grants.map((g) => ({ t: g.t, level: g.level, items: [...g.items] })),
            persistence: route.persistence.map((c) => ({
                level: c.level, tag: c.tag, cleared: true,
            })),
            saw_auto_advance: 0,
            menu: false,
            cutscene: [false, false, false, false],
        },
    };
}

const replayed = new Map(
    [...R2_SEGMENT_NAMES, R2_FULL_WALK_NAME].map((n) => [n, replayOf(n)]),
);
const full = replayed.get(R2_FULL_WALK_NAME);

/** Deep clone, so a mutation cannot leak into the next case. */
const clone = (o) => JSON.parse(JSON.stringify(o));
const reds = (found) => found.filter((f) => !f.ok).map((f) => f.name);

describe('the R2 acceptance leg passes on the real walk', () => {
    it('reports no failures for the headline walk', () => {
        expect(reds(r2HeadlineFindings(route, full))).toEqual([]);
    });

    it('reports no failures for the six-segment chain', () => {
        expect(reds(r2ChainFindings(route, specs, replayed))).toEqual([]);
    });

    it('checks something — the counts are not zero', () => {
        // A findings list that is empty would also have no failures.
        expect(r2HeadlineFindings(route, full).length).toBe(10);
        expect(r2ChainFindings(route, specs, replayed).length).toBe(16);
    });

    it('SKIPS both halves, loudly, when a sweep replayed none of them', () => {
        // `--tier=fast` leaves every R2 tape out — all seven are longer than
        // its tick bound — so this is not a hypothetical path.
        const found = r2AcceptanceFindings(route, specs, new Map());
        expect(found).toHaveLength(2);
        expect(found.every((f) => f.skipped)).toBe(true);
        expect(found.every((f) => f.ok)).toBe(true);
        for (const f of found) expect(f.detail).toMatch(/--tier=full/);
    });

    it('SKIPS the chain, loudly, when a sweep replayed only some segments', () => {
        const partial = new Map([[R2_SEGMENT_NAMES[0], replayed.get(R2_SEGMENT_NAMES[0])]]);
        const found = r2AcceptanceFindings(route, specs, partial);
        expect(found.map((f) => f.skipped)).toEqual([true, true]);
        expect(found.map((f) => f.name).join(' ')).toMatch(/headline walk: SKIPPED/);
        expect(found.map((f) => f.name).join(' ')).toMatch(/chain: SKIPPED/);
    });
});

/**
 * ⚠ The two constants this module copies rather than imports. A rect or a
 * hitbox that had drifted would make every volume claim above a claim about
 * nothing — green, forever, silently.
 */
describe('the copied geometry still matches the geometry', () => {
    it('PLAYER_BOX is playerPhysicsV2\'s box', () => {
        const box = playerBoxAt(100, 100);
        expect({
            originX: 100 - box.x,
            originY: 100 - box.y,
            width: box.right - box.x,
            height: box.bottom - box.y,
        }).toEqual({ ...PLAYER_BOX });
    });
});

describe('the headline assertions BITE', () => {
    const mutated = (fn) => {
        const copy = clone(full);
        fn(copy);
        return reds(r2HeadlineFindings(route, copy));
    };

    it('an item the walk claims, missing', () => {
        for (const item of R2_CLAIMED_ITEMS) {
            // ⚠ Through `ITEM_PROPERTIES`, not by guessing `has<Item>`:
            // `conch` sets `canSwim` and `health` sets `hitsMax`. A name
            // guessed rather than resolved through the committed table
            // writes an undefined key and mutates nothing, which is a
            // mutation test that cannot fail.
            const found = mutated((r) => {
                r.status.items[ITEM_PROPERTIES[item].property] = false;
            });
            expect(found, item).toContain('R2 headline walk: 8 item booleans true, '
                + 'with the solids back');
        }
    });

    it('a blocked item leaked', () => {
        for (const item of R2_BLOCKED_ITEMS) {
            const found = mutated((r) => {
                // ⚠ `health` is an ADDING item: it "leaks" by raising
                // hitsMax, not by flipping a boolean, which is exactly the
                // distinction the check itself had to learn.
                const spec = ITEM_PROPERTIES[item];
                if (spec.kind === 'add') { r.status.items[spec.property] = spec.base + 1; return; }
                r.status.items[spec.property] = true;
            });
            expect(found, item).toContain('R2 headline walk: the published blocked list '
                + 'is still false');
        }
    });

    /**
     * ⚠ THE NEGATIVE, AND ITS POSITIVE CONTROL. `hitsMax == 3` is the one
     * claim proved by something NOT happening, and the failure mode of such
     * a claim is that it is satisfied by every run including a broken one.
     * So: 4 must be red (a health grant that fired), 3 must be green, and
     * the red must be the hitsMax check by name rather than the item-boolean
     * one next to it.
     */
    it('hitsMax at 4 — a health grant that should not have fired', () => {
        const found = mutated((r) => { r.status.items.hitsMax = 4; });
        // BOTH halves of the negative go red, and that is the point of
        // having two: `health` is on the blocked list and `hitsMax` is the
        // only evidence about it, so the same number states the claim from
        // the item side and from the readout side.
        expect(found).toEqual([
            `R2 headline walk: hitsMax is still its base ${R2_HITS_MAX} — health was `
            + 'NOT collected',
            'R2 headline walk: the published blocked list is still false',
        ]);
        expect(reds(r2HeadlineFindings(route, full))).toEqual([]);
    });

    it('a grant that never fired', () => {
        const found = mutated((r) => { r.status.grants.pop(); });
        expect(found).toContain("R2 headline walk: every one of the route's grants fired");
    });

    it('a level the route declares that the game never entered', () => {
        const found = mutated((r) => {
            r.stream.ticks = r.stream.ticks.filter((o) => o.level !== 30);
        });
        expect(found).toContain("R2 headline walk: the game entered exactly the route's "
            + 'levels');
    });

    it('a crossing lost', () => {
        const found = mutated((r) => { r.stream.transitions.pop(); });
        expect(found).toContain('R2 headline walk: crossings, including the pit falls');
    });

    it('a ceremony fired', () => {
        expect(mutated((r) => { r.status.saw_auto_advance = 1; }))
            .toContain('R2 headline walk: no dialogue auto-advance and no ceremony');
        expect(mutated((r) => { r.status.menu = true; }))
            .toContain('R2 headline walk: no dialogue auto-advance and no ceremony');
        expect(mutated((r) => { r.status.cutscene[2] = true; }))
            .toContain('R2 headline walk: no dialogue auto-advance and no ceremony');
    });

    // ── the hold, both halves ─────────────────────────────────────────
    const HOLD_STILL = `R2 headline walk: the game stood still on `
        + `${R2_HOLD_WITNESS.presser} for at least ${R2_HOLD_TICKS} consecutive ticks`;
    const HOLD_THROUGH = `R2 headline walk: and then walked THROUGH where `
        + `${R2_HOLD_WITNESS.lock_tag} stood`;

    it('the hold one tick short', () => {
        // The mutation the primitive exists for, at the readout layer:
        // delete ONE observation from the stationary run and the count no
        // longer reaches 101.
        const found = mutated((r) => {
            const hold = longestStationaryHold(r.stream.ticks, R2_HOLD_WITNESS.level,
                R2_HOLD_WITNESS.button);
            expect(hold.length).toBeGreaterThanOrEqual(R2_HOLD_TICKS);
            const drop = hold.length - R2_HOLD_TICKS + 1;
            r.stream.ticks.splice(hold.from + 1, drop);
        });
        expect(found).toContain(HOLD_STILL);
    });

    it('the player never stood on the button at all', () => {
        const found = mutated((r) => {
            // Nudge every observation one pixel off the button volume.
            r.stream.ticks = r.stream.ticks.map((o) => ({ ...o, x: o.x + 100 }));
        });
        expect(found).toContain(HOLD_STILL);
    });

    it('the walk never entered the lock volume after the hold', () => {
        const found = mutated((r) => {
            const hold = longestStationaryHold(r.stream.ticks, R2_HOLD_WITNESS.level,
                R2_HOLD_WITNESS.button);
            // Everything after the hold, moved out of the lock.
            r.stream.ticks = r.stream.ticks.map((o, i) => (i > hold.to
                ? { ...o, x: o.x + 200 } : o));
        });
        expect(found).toContain(HOLD_THROUGH);
        // ⚠ AND THE OTHER HALF MUST STILL BE GREEN. If nudging the tail
        // reddened the stationary check too, the two would not be
        // independent and the pair would prove one thing rather than two.
        expect(found).not.toContain(HOLD_STILL);
    });

    // ── the clear list ────────────────────────────────────────────────
    const CLEARS = 'R2 headline walk: every persistence clear the route derived was '
        + 'applied, and the game reports each flag actually false';

    it('a clear the game did not apply', () => {
        expect(mutated((r) => { r.status.persistence.pop(); })).toContain(CLEARS);
    });

    it('a clear the game APPLIED but whose flag is still true', () => {
        // The half that catches `botStart` never running: the list agrees
        // and the flags did not move.
        expect(mutated((r) => { r.status.persistence[3].cleared = false; }))
            .toContain(CLEARS);
    });

    it('a clear for a level the route does not name', () => {
        expect(mutated((r) => { r.status.persistence[0].level = 115; }))
            .toContain(CLEARS);
    });
});

describe('the chain assertions BITE', () => {
    const mutatedChain = (fn) => {
        const copy = new Map([...replayed].map(([k, v]) => [k, clone(v)]));
        fn(copy);
        return reds(r2ChainFindings(route, specs, copy));
    };

    it('a segment that ends somewhere else', () => {
        const found = mutatedChain((m) => {
            const r = m.get(R2_SEGMENT_NAMES[0]);
            r.stream.ticks[r.stream.ticks.length - 1].x += 16;
        });
        expect(found).toContain(`R2 chain: ${R2_SEGMENT_NAMES[0]} ends exactly where `
            + `${R2_SEGMENT_NAMES[1]} boots`);
    });

    it('a segment that ends in the wrong level', () => {
        const found = mutatedChain((m) => {
            const r = m.get(R2_SEGMENT_NAMES[2]);
            r.stream.ticks[r.stream.ticks.length - 1].level = 99;
        });
        expect(found).toContain(`R2 chain: ${R2_SEGMENT_NAMES[2]} ends exactly where `
            + `${R2_SEGMENT_NAMES[3]} boots`);
    });

    it('an inherited item the previous segment does not hold', () => {
        const found = mutatedChain((m) => {
            m.get(R2_SEGMENT_NAMES[1]).status.items.hasSword = false;
        });
        expect(found).toContain(`R2 chain: ${R2_SEGMENT_NAMES[1]} ends holding exactly `
            + `what ${R2_SEGMENT_NAMES[2]} inherits`);
    });

    it('a hitsMax that grew somewhere along the chain', () => {
        const found = mutatedChain((m) => {
            m.get(R2_SEGMENT_NAMES[4]).status.items.hitsMax = 4;
        });
        expect(found).toContain(`R2 chain: ${R2_SEGMENT_NAMES[4]} ends with hitsMax `
            + `${R2_HITS_MAX}`);
    });

    it('the last segment ending in the wrong level', () => {
        const last = R2_SEGMENT_NAMES[R2_SEGMENT_NAMES.length - 1];
        const found = mutatedChain((m) => {
            const r = m.get(last);
            r.stream.ticks[r.stream.ticks.length - 1].level = 0;
        });
        expect(found.join(' ')).toMatch(new RegExp(`${last} is the last segment`));
    });

    /**
     * ⚠ THE ONE THAT MATTERS MOST. A chain that still passes with a segment
     * deleted is a chain claim about nothing — six unrelated walks wearing a
     * partition's clothes.
     */
    it('a segment DELETED', () => {
        const partial = new Map([...replayed]);
        partial.delete(R2_SEGMENT_NAMES[3]);
        const found = r2AcceptanceFindings(route, specs, partial);
        const chain = found.find((f) => f.name.startsWith('R2 chain:'));
        expect(chain.skipped).toBe(true);
        expect(chain.detail).toMatch(/replayed 5 of 6/);
    });
});
