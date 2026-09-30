/**
 * seedlingDemo — **THE CORRIDOR BODY: one lock-less spinner on a main-path
 * cut** (seedling swim U3, D3; the user's *"fix the solver so that enemies can
 * be placed on the main path"*).
 *
 * The rock gate's geometry (`soloDoor.buildSoloDoor`, law `cut`) with the one
 * obstacle realised as a `spinner {tag:'-1'}` and NOTHING that opens. The
 * binding carries it on the record as `bodies` with `killLockCell: null`
 * (`ON_CONNECTOR_BODY_IDS`), so F1's roaming-body rules reach it: the textless
 * certification goal, and `the-solver-cannot-cross-the-roaming-body` for a
 * position the solver cannot cross.
 *
 * ⛓ THE WITNESS, measured at U3's D3 (`generate-seedling-level.mjs
 * --biome=post-sword --elements=corridorbody --skeleton=open --width=10
 * --height=10 --seed=1`): certified in 223 ticks with `[kill, collect]` — the
 * lock-less press kill (U1 D3) of a body standing on the cut.
 *
 * MUTANTS (predicted, then measured — the report's D3 table):
 *  (b) `ELEMENT_TABLE.corridorbody.needs` dropped ⇒ the pre-sword row reds:
 *      the seam no longer refuses it by name.
 *  (c) the kill rung's removal observation always "still standing" (U1's
 *      mutant (d) shape) ⇒ the witness's certification refuses by name
 *      (`the-solver-cannot-cross-the-roaming-body`), and its row reds.
 */

import { describe, expect, it } from 'vitest';

import { defaultElementsFor, generateSeedlingLevel, ROAMING_GOAL_CLASS } from './procgenSeedling.js';
import { ON_CONNECTOR_BODY_IDS, seedlingOnConnectorEntities } from './procgenSeedlingElements.js';
import {
    POST_SWORD_ITEMS, POST_SWORD_PALETTE, PRE_SWORD_ITEMS, PRE_SWORD_PALETTE,
} from './procgenPalette.js';
import { DEFAULT_CENSUS_BIOMES } from './watchGenerate.js';
import { ELEMENT_NAMES, ELEMENT_TABLE, headsNeeding, parseElementSpec } from '../procgenCore/elementSpec.js';
import {
    CORRIDOR_BODY, CORRIDOR_BODY_DOOR_ID, CORRIDOR_BODY_REFUSALS, ROCK_GATE_REFUSALS,
} from '../procgenCore/elements/soloDoor.js';
import { LAW_CUT } from '../procgenCore/elements.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const WITNESS = Object.freeze({ seed: 1, kind: 'open', width: 10, height: 10 });

const gen = (palette, { seed = WITNESS.seed, kind = WITNESS.kind } = {}) => generateSeedlingLevel({
    seed, palette,
    defaults: { width: WITNESS.width, height: WITNESS.height },
    skeleton: parseSkeleton(kind, { substrate: 'seedling' }),
    elements: parseElementSpec('corridorbody'),
});

describe('⛓⛓⛓ the CORRIDOR BODY element and its table row (swim U3, D3)', () => {
    it('is the rock gate\'s geometry: law `cut`, the rock gate\'s refusals, one door id, LAST in the table', () => {
        expect(CORRIDOR_BODY.family).toBe('corridorbody');
        expect(CORRIDOR_BODY.phase).toBe('on-connector');
        expect(CORRIDOR_BODY.law).toBe(LAW_CUT);
        expect(CORRIDOR_BODY_REFUSALS).toEqual(ROCK_GATE_REFUSALS);
        expect(ELEMENT_TABLE.corridorbody.element).toBe(CORRIDOR_BODY);
        expect(ELEMENT_TABLE.corridorbody.needs).toEqual(['hasSword']);
        expect(ELEMENT_NAMES.at(-1)).toBe('corridorbody');
    });

    it('⛔ is NOT a head `require` can force — measured SHORTENS — so `--require=hasSword` is unmoved', () => {
        expect(ELEMENT_TABLE.corridorbody.meetsRequire).toBe(false);
        expect(headsNeeding('hasSword')).toEqual(['killgate', 'arena', 'rockgate']);
    });

    it('the realiser makes ONE lock-less spinner and spends NO tag', () => {
        let tags = 0;
        const out = seedlingOnConnectorEntities({
            placed: { entities: [{ role: 'obstacle', x: 3, y: 2, id: CORRIDOR_BODY_DOOR_ID }] },
            tagFor: () => { tags += 1; return 7; },
        });
        expect(ON_CONNECTOR_BODY_IDS).toEqual([CORRIDOR_BODY_DOOR_ID]);
        expect(out.entities).toEqual([{ type: 'spinner', tx: 3, ty: 2, attrs: { tag: '-1' } }]);
        expect(out.tags).toEqual({});
        expect(tags).toBe(0);
    });

    it('is in NO census default (opt-in only)', () => {
        expect(DEFAULT_CENSUS_BIOMES).toEqual(['pre-sword', 'post-sword']);
        for (const items of [PRE_SWORD_ITEMS, POST_SWORD_ITEMS]) {
            expect(JSON.stringify(defaultElementsFor(items))).not.toMatch(/corridorbody/);
        }
    });
});

describe('the corridor body in a generated level', () => {
    it('post-sword: the witness places ON the cut, certifies against the TEXTLESS goal, by a KILL', () => {
        const out = gen(POST_SWORD_PALETTE);
        const p = out.model.elements.placed[0];
        expect(p.element).toBe('corridor-body');
        expect(p.bodies).toEqual([{ x: p.doorCell.x, y: p.doorCell.y, id: CORRIDOR_BODY_DOOR_ID }]);
        expect(p.killLockCell).toBeNull();
        expect(p.tags).toEqual({});
        const cert = out.summary.elements.certification;
        expect(cert.certified).toBe(true);
        expect(cert.ticks).toBe(223);
        expect(cert.strategies).toEqual(['kill', 'collect']);
        const goal = out.record.entities.find((e) => e.type === ROAMING_GOAL_CLASS);
        expect(goal).toBeTruthy();
        expect(out.record.entities.filter((e) => e.type === 'spinner')).toHaveLength(1);
        expect(out.model.roamingBodies).toEqual([{ x: p.doorCell.x, y: p.doorCell.y,
            id: CORRIDOR_BODY_DOOR_ID }]);
    });

    /**
     * ⛓ U4b D3 — the row's position moved: `rooms` s2 CERTIFIES now (the kill
     * admission's continuation finds a strike past the bounded pass), which is
     * the lever working on the generator. `rooms` s6 still refuses by the name.
     */
    it('a position the solver cannot cross is REFUSED BY NAME and the level ships WITHOUT it', () => {
        const out = gen(POST_SWORD_PALETTE, { seed: 6, kind: 'rooms' });
        const cert = out.summary.elements.certification;
        expect(cert.certified).toBe(false);
        expect(cert.gap).toBe('the-solver-cannot-cross-the-roaming-body');
        expect(out.model.elements.placed).toEqual([]);
        expect(out.record.entities.filter((e) => e.type === 'spinner')).toHaveLength(0);
    });

    it('pre-sword: the seam refuses it BY NAME (`needs: [hasSword]`) before any solve', () => {
        const out = gen(PRE_SWORD_PALETTE);
        const cert = out.summary.elements.certification;
        expect(cert.certified).toBe(false);
        expect(cert.gap).toBe('the-element-needs-an-item-this-biome-does-not-grant');
        expect(cert.needs).toEqual(['hasSword']);
        expect(out.record.entities.filter((e) => e.type === 'spinner')).toHaveLength(0);
    });
});
