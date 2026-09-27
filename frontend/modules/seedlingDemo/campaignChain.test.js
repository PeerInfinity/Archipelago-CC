import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    CAMPAIGN_SEGMENTS, CAMPAIGN_SEGMENT_NAMES, CAMPAIGN_CHAIN_ID,
    campaignTail, campaignNextLevel, campaignBootLevels, campaignChainBreaks,
    isTerminalSegment,
} from './campaignChain.js';
import { PAGE_CHAINS } from './director.js';
import { PLAYTHROUGH_CHAINS } from './playthroughWalk.js';
import { DEMOS } from '../procgenDocs/demos.js';
import { R8_ENEMY_BRIDGE, campaignBridgeCoverageFindings } from './r8Acceptance.js';
import { atlasLevelSource } from './levelSource.js';
import { campaignChainMarkdown } from '../../../scripts/procgen/reference/campaignChain.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const chain = () => PLAYTHROUGH_CHAINS.find((c) => c.id === CAMPAIGN_CHAIN_ID);

/**
 * ⛓⛓⛓ R9 SLICE 12d — **ONE DECLARATION, AND EVERY CONSUMER READS IT.**
 * ⚖ Ruling 38 item (1) (user, 2026-08-23), ⚖ ruling 17.
 *
 * The campaign's membership was written out six times (the producer's
 * `SEGMENTS`, `PLAYTHROUGH_CHAINS[].segments`, `PAGE_CHAINS`, the demos
 * catalogue's claim and prose, the tracked doc's chain table, and the
 * exposure row's rooms). Slice 12b″ could only add a row asserting that two
 * of the copies AGREED (§23c.7a) — which is what you assert when the
 * duplicate is staying. This file asserts there is no duplicate.
 */
describe('the campaign chain has ONE declaration (R9 slice 12d)', () => {
    /**
     * ⛔⛔ IDENTITY, NOT EQUALITY — and that is the whole strength of the row.
     * `toEqual` is satisfied by a typed copy that happens to match today;
     * `toBe` is satisfied only by the same frozen array, which a second list
     * cannot be. This is the assertion a hand-kept copy CANNOT pass.
     */
    it('⛔ the browser consumers hold the SAME ARRAY, not a copy that matches', () => {
        expect(CAMPAIGN_SEGMENT_NAMES.length).toBeGreaterThan(1);      // non-vacuity
        expect(PAGE_CHAINS[CAMPAIGN_CHAIN_ID]).toBe(CAMPAIGN_SEGMENT_NAMES);
        expect(chain().segments).toBe(CAMPAIGN_SEGMENT_NAMES);
    });

    /**
     * ⛔ THE PRODUCER IS READ AS SOURCE, because it cannot be imported: it
     * solves the whole campaign at module scope and drives Windows Chrome for
     * the latches (§23c.7a's own reason, kept). What changed is WHAT is
     * asserted — 12b″ scanned the typed list and compared it to the chain's;
     * this asserts the typed list is GONE and the import is there.
     */
    it('⛔ the producer declares no segment list of its own — it imports this one', () => {
        const src = readFileSync(
            join(REPO, 'scripts/procgen/solve-seedling-r9-campaign.mjs'), 'utf8');
        // ⚖ 68: the same import also carries the chain's `split` declaration.
        expect(src).toMatch(/import \{ CAMPAIGN_SEGMENTS(?:, CAMPAIGN_RNG_SPLIT)? \} from/);
        expect(src).toMatch(/const SEGMENTS = CAMPAIGN_SEGMENTS\.map\(/);
        // non-vacuity: the scan really is reading the producer
        expect(src).toMatch(/solve-seedling-r9-campaign/);
        // and not one `{ name: 'r…-solve-N'` row survives anywhere in it
        expect([...src.matchAll(/\{ name: '(r\d-[a-z0-9-]+)'/g)].map((m) => m[1]))
            .toEqual([]);
    });

    /**
     * ⛓ The demos catalogue's SIZE claim is interpolated, so it cannot be one
     * room out. ⚠ Its tick totals were DELETED rather than derived — a browser
     * reading `demos.html` cannot open a tape, so a number written there could
     * only ever be a retyped one (trap 574).
     */
    it('⛓ the demos catalogue interpolates the size and the arrival room', () => {
        const seq = DEMOS.find((d) => d.id === 'tape-sequence');
        expect(seq.claim).toBe(`windows.length == ${CAMPAIGN_SEGMENT_NAMES.length}`);
        // ⛓ R9 slice L18b: a TERMINAL tail (`to: null`) ends in its own room.
        expect(seq.title).toContain(`L${campaignTail().to ?? campaignTail().level}`);
        const raw = readFileSync(
            join(HERE, '..', 'procgenDocs', 'demos.js'), 'utf8');
        expect(raw).toMatch(/from\s*\n?\s*'\.\.\/seedlingDemo\/campaignChain\.js'/);
        /**
         * ⛔ THE BLOCK COMMENTS COME OUT FIRST, and finding that out cost this
         * row one red: the docblock that explains WHY the count is derived
         * QUOTES the old typed claim, so a scan of the raw file matches its
         * own explanation and reports the defect it was written to retire.
         * A scan whose subject includes its own prose has no subject.
         */
        const src = raw.replace(/\/\*[\s\S]*?\*\//g, '');
        expect(src).toMatch(/CAMPAIGN_WINDOWS/);            // non-vacuity
        expect(src).not.toMatch(/windows\.length == \d/);
        expect(src).not.toMatch(/\b361[56]\b/);
    });

    /**
     * ⛓ THE CHAINING LAW — every row's `to` is its successor's `level`, the
     * sphere order's own. Moved here from `rerecordCampaign.test.js`, where it
     * was a regex over the producer's text; over the declaration it is a
     * predicate over data.
     */
    it('⛓ every segment leaves into the room its successor boots', () => {
        expect(CAMPAIGN_SEGMENTS.length).toBeGreaterThan(1);            // non-vacuity
        expect(campaignChainBreaks()).toEqual([]);
    });

    /**
     * ⛔⛔ THE TAIL IS NOT TYPED ANY MORE. `rerecordCampaign.test.js` pinned
     * `{name: 'r9-solve-14', level: 14, to: 15}`, which decays once per growth
     * — a gate's subject frozen as a literal (trap 574). What the tail really
     * has to satisfy is the artifact that describes what is in FRONT of it:
     * the committed route survey's own next step, which is exactly what
     * `--grow` asks before it writes anything.
     */
    it('⛔ the tail\'s `to` IS the frontier\'s next step — derived, not typed', () => {
        const frontier = JSON.parse(readFileSync(
            join(HERE, 'fixtures', 'campaign-frontier.json'), 'utf8'));
        expect(frontier.chain).toBe(CAMPAIGN_CHAIN_ID);
        expect(frontier.segments).toEqual([...CAMPAIGN_SEGMENT_NAMES]);
        // ⛓ R9 slice L16: when every route step after the chain SOLVES the
        // frontier is a GAP LIST (`nextStep: null`) and the tail's `to` is the
        // level of its own measured arrival instead — still the artifact's
        // word, never a literal.
        // ⛓ R9 slice L18b: and when the chain walks the WHOLE route the tail is
        // TERMINAL (`to: null`) — there is no next room, and the artifact says
        // `complete`.
        expect(campaignNextLevel()).toBe(frontier.complete ? null : frontier.nextStep
            ? frontier.nextStep.level : frontier.lastArrival.level);
        expect(frontier.lastArrival.segment).toBe(campaignTail().name);
    });

    it('⛓ the boot levels are the declaration\'s own, deduplicated and sorted', () => {
        expect(campaignBootLevels()).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 18, 19, 20]);
    });
});

/**
 * ⛓⛓⛓ THE EXPOSURE LEDGER IS COMPLETE FOR THE CHAIN — ⚖ ruling 38 (1) as
 * amended (R9 slice 12d): the prediction rows stay TYPED (a derived prediction
 * cannot be wrong, trap 89), and what derives from the declaration is whether
 * every campaign room that holds a bridged body HAS one.
 */
describe('the campaign\'s bridged rooms all have a prediction row', () => {
    const bridgedLevels = () => {
        const src = atlasLevelSource();
        const tags = R8_ENEMY_BRIDGE.bridgedClasses;
        const out = new Set();
        for (let l = 0; l < 130; l += 1) {
            let rec;
            try { rec = src(l); } catch { continue; }
            if (!rec?.entities) continue;
            if (rec.entities.some((e) => tags.includes(e.type))) out.add(l);
        }
        return out;
    };

    /**
     * ⚠ THE NAME CARRIES NO COUNT, and that is 12e's lint speaking: this row
     * first read *"the six rooms … are exactly the six declared"* and
     * `lint-gate-labels.mjs` named it on the first run — a number in a label
     * that the check itself computes (traps 573/574). The LIST below is typed
     * on purpose, though: it is the measurement a human should have to read
     * when a growth changes it.
     */
    it('⛓ every campaign room touching a bridged body has a prediction row', () => {
        const out = campaignBridgeCoverageFindings(
            { segments: CAMPAIGN_SEGMENTS, bridgedLevels });
        // ⛓ MEASURED: L4, L5, L6, L14 and L16 are the campaign's bridged rooms
        // — L16 joined at R9 slice L15, as the seventeenth segment's ARRIVAL,
        // and R9 slice L16's eighteenth segment WALKS it.
        expect(out.touching).toEqual([
            'r8-solve-3', 'r8-solve-4', 'r8-solve-5', 'r8-solve-6',
            'r9-solve-13', 'r9-solve-14', 'r9-solve-15', 'r9-solve-16',
        ]);
    });

    /**
     * ⛔ MUTATION (g) — the declaration grows a room that holds a bridged body
     * and nobody writes its prediction row. The guard itself cannot see this
     * until the tape exists and the roster replays it; this sees it at the
     * declaration.
     */
    it('⛔ MUTATION: a grown bridged room with no prediction row is named', () => {
        // ⛓ R9 slice L16 declared `r9-solve-16`, and the rooms left on the route
        // (L18, L19, L20) hold no `bob` — so the synthetic growth is a SECOND
        // visit to a bridged room, L14 → L15, under a name no tape carries.
        const grown = [...CAMPAIGN_SEGMENTS,
            { name: 'r9-solve-14-synthetic', level: 14, to: 15, why: 'synthetic' }];
        expect(() => campaignBridgeCoverageFindings(
            { segments: grown, bridgedLevels }))
            .toThrow(/r9-solve-14-synthetic is a campaign segment/);
    });

    it('⛔ MUTATION: a census that finds nothing bridged is a VACUOUS pass, refused', () => {
        expect(() => campaignBridgeCoverageFindings(
            { segments: CAMPAIGN_SEGMENTS, bridgedLevels: () => new Set() }))
            .toThrow(/NO campaign segment touches a bridged room/);
    });

    it('⛔ it refuses an unset io rather than reading the real declaration', () => {
        expect(() => campaignBridgeCoverageFindings()).toThrow(/needs \{segments/);
    });
});

/**
 * ⛔⛔⛔ THE NON-VACUITY OF THE WHOLE ARRANGEMENT: change the declaration and
 * every consumer moves. The identity rows above prove the browser tables ARE
 * the declaration; this proves the derivation is LIVE by re-importing the
 * consumers against a MOCKED declaration that grew a room.
 *
 * ⚠ The grown room is L15 → L16, which holds a bridged body — so ONE mutation
 * witnesses both this and mutant (g). And it names no tape, which is why the
 * mock is safe: `playthroughWalk` would have to open a file for a tick count,
 * so it is deliberately NOT re-imported here — the two tables it and
 * `director` hold are the same array, asserted above.
 */
describe('⛔ a scratch change to the declaration MOVES every consumer', () => {
    beforeEach(() => { vi.resetModules(); });

    it('⛔ director\'s PAGE_CHAINS and the demos claim both grow with it', async () => {
        const real = await import('./campaignChain.js');
        const grownNames = Object.freeze([...real.CAMPAIGN_SEGMENT_NAMES, 'r9-solve-15']);
        vi.doMock('./campaignChain.js', () => ({
            ...real,
            CAMPAIGN_SEGMENTS: Object.freeze([...real.CAMPAIGN_SEGMENTS,
                Object.freeze({ name: 'r9-solve-15', level: 15, to: 16, why: 'scratch' })]),
            CAMPAIGN_SEGMENT_NAMES: grownNames,
            campaignTail: () => ({ name: 'r9-solve-15', level: 15, to: 16, why: 'scratch' }),
        }));
        vi.doMock('../seedlingDemo/campaignChain.js', () => ({
            ...real,
            CAMPAIGN_SEGMENT_NAMES: grownNames,
            campaignTail: () => ({ name: 'r9-solve-15', level: 15, to: 16, why: 'scratch' }),
        }));
        const { PAGE_CHAINS: grownPage } = await import('./director.js');
        const { DEMOS: grownDemos } = await import('../procgenDocs/demos.js');
        expect(grownPage[CAMPAIGN_CHAIN_ID]).toEqual([...grownNames]);
        expect(grownPage[CAMPAIGN_CHAIN_ID].length)
            .toBe(CAMPAIGN_SEGMENT_NAMES.length + 1);
        const seq = grownDemos.find((d) => d.id === 'tape-sequence');
        expect(seq.claim).toBe(`windows.length == ${CAMPAIGN_SEGMENT_NAMES.length + 1}`);
        expect(seq.title).toContain('to L16');
        vi.doUnmock('./campaignChain.js');
        vi.doUnmock('../seedlingDemo/campaignChain.js');
    });
});

/**
 * ⛓ R9 SLICE L18b — THE TERMINAL SEGMENT AND THE "ROUTE COMPLETE" SHAPE, as the
 * generated reference prints them (§60.8 #3). A synthetic view: the function is
 * pure, so the shapes are asserted before any tape takes them.
 */
describe('the reference prints a TERMINAL tail and the frontier\'s own sentence', () => {
    const view = (over) => ({
        id: 'r9-campaign', segments: 2, promoted: 0, ticks: 30, findings: [],
        rows: [
            { n: 1, name: 'a', level: 19, to: 20, ticks: 20, promoted: false, collects: ['bosskey'] },
            { n: 2, name: 'b', level: 20, to: null, ticks: 10, promoted: false, collects: ['shield'] },
        ],
        arrivesAt: 20, terminal: true, nextStep: null, refusal: null,
        complete: true, why: 'the chain walks all 21 route steps', ...over,
    });
    it('⛓ a terminal row reads `L20 → END` and the headline says "end of the route"', () => {
        const md = campaignChainMarkdown(view({}));
        expect(md).toContain('| 2 | `b` | L20 → END | 10 | `shield@L20` |');
        expect(md).toContain('**L20** end of the route');
        expect(md).toContain('**ROUTE COMPLETE** — the chain walks all 21 route steps.');
        expect(md).not.toContain('No frontier is committed');
    });
    it('⛓ a GAP LIST prints its `why`, not "no frontier"', () => {
        const md = campaignChainMarkdown(view({
            terminal: false, complete: false, why: 'no route step after the chain is refused',
            rows: [{ n: 1, name: 'a', level: 19, to: 20, ticks: 20, promoted: false, collects: [] }],
        }));
        expect(md).toContain('**NO REFUSED STEP** — no route step after the chain is refused.');
        expect(md).toContain('L19 → L20');
    });
    it('⛔ with no frontier sentence at all it still says so', () => {
        expect(campaignChainMarkdown(view({ complete: false, why: null })))
            .toContain('No frontier is committed');
    });
});

describe('⛓ R9 slice L18b — the TERMINAL segment is the declaration\'s own `to: null`', () => {
    it('only a `to: null` row is terminal, and at most the tail is', () => {
        const terminal = CAMPAIGN_SEGMENTS.filter((s) => isTerminalSegment(s.name)).map((s) => s.name);
        expect(terminal).toEqual(CAMPAIGN_SEGMENTS.filter((s) => s.to === null).map((s) => s.name));
        expect(terminal.every((n) => n === campaignTail().name)).toBe(true);
        expect(isTerminalSegment('r9-solve-19')).toBe(false);
        expect(isTerminalSegment('no-such-tape')).toBe(false);
    });
});
