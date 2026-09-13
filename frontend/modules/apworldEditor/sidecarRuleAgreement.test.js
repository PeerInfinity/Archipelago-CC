/**
 * apworldEditor/sidecarRuleAgreement — **THE GATE-AGREEMENT PREDICATE, DRIVEN**
 * (PRESET SIDECARS G2b-1; plan §26).
 *
 * ⛓ Every rule compared here is read off a committed DOCUMENT — the rows never
 * type a rule a region is supposed to have. The "edit" rows change a document
 * rule to ANOTHER endpoint's document rule, which is what a hub `set-rule-tree`
 * a payload never saw looks like.
 *
 * ⛔ NON-VACUITY BOTH WAYS (planner condition, 2026-09-13): the corpus holds at
 * least one AUTHORED substrate whose gated endpoints are checked, AND at least
 * one DERIVED substrate with endpoints it does not reproduce. Without the
 * first, a declaration that flipped to derived (or vanished — absent reads as
 * derived) would switch the control off in silence; without the second, the
 * never-FAIL branch would be a branch nothing exercises.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { ROUND_TRIP_RULES } from '../procgenCore/roundTripRules.js';
import {
    RULE_AGREEMENT, describeDisagreement, regionRuleAgreement, ruleAgreementFails,
} from './sidecarRuleAgreement.js';
import { regionRoundTripOf } from './regionRoundTrip.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/* ⛓ The registry the gate loads — the reference's own list, read, never typed. */
const saved = { ...console };
for (const k of ['log', 'info', 'warn', 'error', 'debug']) console[k] = () => {};
try {
    for (const rel of REGISTRY_LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await import(/* @vite-ignore */ join(ROOT, rel));
    }
} finally {
    Object.assign(console, saved);
}

/** ⛓ Every tracked sidecar region, grouped by substrate: `Map<substrate, [{file, doc, slot, name}]>`. */
function corpusBySubstrate() {
    const files = execFileSync('git', ['-C', ROOT, 'ls-files', '--', 'frontend/presets'], { encoding: 'utf8' })
        .split('\n').filter((f) => f.endsWith('_rules.json'));
    const out = new Map();
    for (const file of files) {
        const doc = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
        for (const [slot, regions] of Object.entries(doc.preset_sidecars ?? {})) {
            for (const [name, entry] of Object.entries(regions ?? {})) {
                if (typeof entry?.substrate !== 'string') continue;
                if (!out.has(entry.substrate)) out.set(entry.substrate, []);
                out.get(entry.substrate).push({ file, doc, slot, name });
            }
        }
    }
    return out;
}

const corpus = corpusBySubstrate();
const rulesOf = (s) => substrateRegistry.get(s)?.regionRoundTrip?.rules;
const withRoundTrip = [...corpus.keys()].filter((s) => regionRoundTripOf(s).rt);
const authored = withRoundTrip.filter((s) => rulesOf(s) === ROUND_TRIP_RULES.AUTHORED);
const derived = withRoundTrip.filter((s) => rulesOf(s) !== ROUND_TRIP_RULES.AUTHORED);

/** ⛓ The first AUTHORED region with a gated EXIT in its document, and a second exit to borrow a rule from. */
function aGatedAuthoredExit() {
    for (const s of authored) {
        for (const r of corpus.get(s)) {
            const exits = r.doc.regions[r.slot][r.name].exits ?? [];
            const i = exits.findIndex((e) => e.access_rule && e.access_rule.rule !== 'True_');
            const j = exits.findIndex((e, k) => k !== i
                && JSON.stringify(e.access_rule) !== JSON.stringify(exits[i]?.access_rule));
            if (i >= 0 && j >= 0) return { ...r, i, j };
        }
    }
    return null;
}

describe('⛔ non-vacuity over the committed corpus — both halves of the declaration are exercised', () => {
    it('⛓⛓ at least one AUTHORED substrate: every region AGREED, and gated endpoints were checked', async () => {
        expect(authored.length).toBeGreaterThan(0);
        let gated = 0;
        for (const s of authored) {
            for (const r of corpus.get(s)) {
                // eslint-disable-next-line no-await-in-loop
                const a = await regionRuleAgreement(r.doc, r.slot, r.name);
                expect(a.status, `${r.file} ${r.slot} ${r.name}: ${a.why ?? a.disagreements.map(describeDisagreement)}`)
                    .toBe(RULE_AGREEMENT.AGREED);
                expect(a.rules).toBe(ROUND_TRIP_RULES.AUTHORED);
                expect(ruleAgreementFails(a)).toBe(false);
                gated += a.gated;
            }
        }
        expect(gated).toBeGreaterThan(0);
    });

    it('⛓⛓ at least one DERIVED substrate with an endpoint it does not reproduce — counted, never a FAIL', async () => {
        expect(derived.length).toBeGreaterThan(0);
        let found = null;
        for (const s of derived) {
            for (const r of corpus.get(s)) {
                // eslint-disable-next-line no-await-in-loop
                const a = await regionRuleAgreement(r.doc, r.slot, r.name);
                if (a.status === RULE_AGREEMENT.DISAGREED) { found = a; break; }
            }
            if (found) break;
        }
        expect(found, 'no DERIVED region disagrees — the never-FAIL branch is unexercised').not.toBe(null);
        expect(found.rules).toBe(ROUND_TRIP_RULES.DERIVED);
        expect(ruleAgreementFails(found)).toBe(false);
    });
});

describe('what an answer says', () => {
    it('⛓⛓⛓ an AUTHORED region whose DOCUMENT rule moved: DISAGREED, FAILS, naming the endpoint and both rules', async () => {
        const pick = aGatedAuthoredExit();
        expect(pick, 'premise: an authored region with a gated exit and a differently-ruled sibling').not.toBe(null);
        const doc = structuredClone(pick.doc);
        const exits = doc.regions[pick.slot][pick.name].exits;
        const was = exits[pick.i].access_rule;
        exits[pick.i].access_rule = structuredClone(exits[pick.j].access_rule);
        const a = await regionRuleAgreement(doc, pick.slot, pick.name);
        expect(a.status).toBe(RULE_AGREEMENT.DISAGREED);
        expect(ruleAgreementFails(a)).toBe(true);
        expect(a.disagreements).toEqual([{
            endpoint: `exit "${exits[pick.i].name}"`, document: exits[pick.j].access_rule, payload: was,
        }]);
        const line = describeDisagreement(a.disagreements[0]);
        expect(line).toContain(exits[pick.i].name);
        expect(line).toContain(JSON.stringify(was));
        expect(line).toContain(JSON.stringify(exits[pick.j].access_rule));
    });

    it('⛓ a substrate with no round trip is out of reach, with the lookup\'s own sentence', async () => {
        const s = [...corpus.keys()].find((id) => !regionRoundTripOf(id).rt);
        expect(s, 'premise: a committed substrate without a round trip').toBeTruthy();
        const r = corpus.get(s)[0];
        const a = await regionRuleAgreement(r.doc, r.slot, r.name);
        expect(a.status).toBe(RULE_AGREEMENT.NO_ROUND_TRIP);
        expect(a.why).toBe(regionRoundTripOf(s).why);
        expect(ruleAgreementFails(a)).toBe(false);
    });

    it('⛔ a MALFORMED `rules` member is NOT CHECKED and FAILS, by the reader\'s sentence', async () => {
        const id = '__g2b_bad_rules__';
        substrateRegistry.register({
            id, sharing: {}, regionRoundTrip: Object.freeze({ open() {}, save() {}, rules: 'geometry' }),
        });
        const doc = { regions: { 1: { R: {} } }, preset_sidecars: { 1: { R: { substrate: id, playable_payload: {} } } } };
        const a = await regionRuleAgreement(doc, '1', 'R');
        expect(a.status).toBe(RULE_AGREEMENT.NOT_CHECKED);
        expect(a.declarationError).toBe(true);
        expect(a.why).toContain(`substrate '${id}' declares "geometry"`);
        expect(ruleAgreementFails(a)).toBe(true);
    });

    it('⛔ a payload the round trip refuses is NOT CHECKED and does not fail', async () => {
        const s = authored[0];
        const r = corpus.get(s)[0];
        const doc = structuredClone(r.doc);
        doc.preset_sidecars[r.slot][r.name].playable_payload = { tiles: [0] };
        const a = await regionRuleAgreement(doc, r.slot, r.name);
        expect(a.status).toBe(RULE_AGREEMENT.NOT_CHECKED);
        expect(a.why).toContain('refused this region\'s payload');
        expect(ruleAgreementFails(a)).toBe(false);
    });
});
