/**
 * surveyFamily — the classifier's rows. R9 slice 12b″.
 *
 * ⛔ THE SLICE'S SUBJECT IS THE `playerHits` ARM (⚖ kickoff §23.15, mutant
 * (f)): a run that took damage before it refused is a HIT row, whatever its
 * message went on to say. Everything else here is the table as it stood, kept
 * so the extraction out of `survey-seedling-route.mjs` is asserted to have
 * moved the rules rather than rewritten them.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { FAMILY_RULES, familyOf } from './surveyFamily.js';

/** L14's own refusal at R9 slice 12's head — the sentence the arm is about. */
const CAMERA_BAND = 'levelRun: whether bob bob@32,32 is on screen at tick 44 depends on '
    + "where inside `Game.shake`'s jiggle the camera landed, and the two draws that "
    + 'decide it are not indexable (camera.js, "THE SHAKE, AND WHY IT IS A BAND").';

describe('familyOf — the text arm, unchanged by the extraction', () => {
    it('⛓ classifies the refusals the committed route produces', () => {
        expect(familyOf(CAMERA_BAND)).toMatch(/^CAMERA BAND/);
        expect(familyOf("solverBot: Strategy 'shove' failed to apply to the obstacle"))
            .toBe("VERB-APPLY — the 'shove' strategy IS registered and did not apply here");
        expect(familyOf('twoPassSolve: this clear needs a GAME-sourced tick'))
            .toMatch(/^ORACLE/);
        expect(familyOf('ladder: the combat ladder is EXHAUSTED after four rungs'))
            .toMatch(/^LADDER/);
        // ⛓ Swim U5, D1: step 30's refusal (`solverBot`'s encounter arm).
        expect(familyOf('solverBot(survey-step-30) encounter (64,128)->Fire: no encounter '
            + "executor is registered for a 'Fire' drop in level 32."))
            .toMatch(/^ENCOUNTER-UNMODELLED — the 'Fire' drop's fight/);
        // ⛓ Seedling fidelity BURN: a registered verb refused for the inventory.
        expect(familyOf('solverBot(survey-step-62) reach-exit (32,144)->L12 -> burn: '
            + 'burnabletree@32,128 cannot be burned by this run — this run does not hold FIRE.'))
            .toBe("ITEM-GATE — the 'burn' verb is registered and burnabletree@32,128 is gated on an "
                + 'item this run does not hold (or on a press the model refuses); the work order is '
                + 'the item, not the room');
        expect(familyOf('solverBot(survey-step-252) reach-exit (144,96)->L102 -> break: '
            + 'breakablerockghost@224,96 cannot be broken by this run — `BreakableRock.hit(_t)`'))
            .toMatch(/^ITEM-GATE — the 'break' verb is registered and breakablerockghost@224,96/);
        // ⛓ Seedling fidelity FRONTIER3: a gate whose opener is not in the room.
        expect(familyOf('solverBot(survey-step-235): no corridor for goal reach-exit toward (120,8) in '
            + 'level 113. Obstacle: solid:finaldoor (finaldoor@112,0). ITEM-GATE (finaldoor@112,0): the '
            + 'seal door opens only on approach for a player holding all 16 Seal parts'))
            .toMatch(/^ITEM-GATE — finaldoor@112,0 has no strategy row and its opener is not in this room \(an item/);
        expect(familyOf('Obstacle: solid:rocklock (rocklock@112,16). ENCOUNTER-GATE (rocklock@112,16): '
            + 'no presser in level 112 publishes its group'))
            .toMatch(/^ENCOUNTER-GATE — rocklock@112,16 .*an encounter the route must win/);
    });

    it('⛓ fidelity ARRIVAL: an arrival inside a solid is its own family, named by the solid', () => {
        expect(familyOf('survey-step-42: arrival-inside-solid — the run\'s box at (296,184) in level 0 is '
            + 'INSIDE breakablerock@288,176 and no cardinal hold moves it'))
            .toMatch(/^ARRIVAL-INSIDE-SOLID — the arrival box is inside breakablerock@288,176, whose saved flag/);
        expect(familyOf('x: arrival-inside-solid — the run\'s box at (40,872) in level 12 is INSIDE '
            + 'magicallock@32,864, bosslock@32,864 and no cardinal hold moves it'))
            .toMatch(/inside magicallock@32,864, bosslock@32,864, whose/);
    });

    it('⛓ a refusal matching nothing is NAMED as unclassified, never swallowed', () => {
        expect(familyOf('something nobody has a rule for')).toBe(
            'unclassified — see the refusal text');
    });

    it('⛓ no refusal at all is `null` — a SOLVED row has no family', () => {
        expect(familyOf(null)).toBeNull();
        // ⛔ and it stays null even with a hit-bearing run: the arm below is
        //   about a refusal that FOLLOWED damage, not about damage alone. A
        //   SOLVED row that took a hit is a different finding and this
        //   classifier is not the place it gets made.
        expect(familyOf(null, { playerHits: [{ t: 44 }] })).toBeNull();
    });
});

/**
 * ⛓⛓⛓ MUTANT (f) — the arm this slice owed.
 */
describe('familyOf — the `playerHits` arm (R9 slice 12b″, kickoff §23.15)', () => {
    it('⛔ a run that took a hit BEFORE refusing is the HIT family, by name', () => {
        const run = { playerHits: [{ t: 44 }] };
        const family = familyOf(CAMERA_BAND, run);
        expect(family).toMatch(/^HIT — the run took 1 hit\(s\), the first at tick 44/);
        // ⛓ THE POINT, ASSERTED: the same refusal without the run is the
        //   camera-band row. One text, two families, decided by the RUN.
        expect(familyOf(CAMERA_BAND)).toMatch(/^CAMERA BAND/);
        expect(family).not.toMatch(/^CAMERA BAND/);
    });

    it('⛓ it counts what it found and does not invent a tick it was not given', () => {
        expect(familyOf(CAMERA_BAND, { playerHits: [{ t: 44 }, { t: 91 }] }))
            .toMatch(/took 2 hit\(s\), the first at tick 44/);
        // a hit record with no `t` is reported as a COUNT and nothing more
        expect(familyOf(CAMERA_BAND, { playerHits: [{}] }))
            .toMatch(/^HIT — the run took 1 hit\(s\) BEFORE it refused/);
    });

    it('⛓ an EMPTY hit list is not a hit — the text arm still answers', () => {
        expect(familyOf(CAMERA_BAND, { playerHits: [] })).toMatch(/^CAMERA BAND/);
        expect(familyOf(CAMERA_BAND, {})).toMatch(/^CAMERA BAND/);
        expect(familyOf(CAMERA_BAND, null)).toMatch(/^CAMERA BAND/);
    });

    /**
     * ⛔⛔ MUTANT (e) — THE ORDER IS THE CLAIM, and the row proves the order
     * rather than trusting the source. Every refusal this survey has ever
     * seen matches one of `FAMILY_RULES`, so a text loop asked FIRST returns
     * before the hits are ever looked at: the arm would be dead code that
     * reads as covered.
     */
    it('⛔ asked AFTER the text loop the arm is DEAD — the mutant, built here', () => {
        const mutant = (refusal, run) => {
            for (const [re, family] of FAMILY_RULES) {
                const m = re.exec(refusal);
                if (m) return typeof family === 'function' ? family(m) : family;
            }
            const hits = run?.playerHits;
            if (Array.isArray(hits) && hits.length) return 'HIT';
            return 'unclassified — see the refusal text';
        };
        expect(mutant(CAMERA_BAND, { playerHits: [{ t: 44 }] })).toMatch(/^CAMERA BAND/);
        expect(familyOf(CAMERA_BAND, { playerHits: [{ t: 44 }] })).toMatch(/^HIT/);
    });
});

/**
 * ⛔⛔ THE ARM REACHES NOTHING ON TODAY'S ROUTE, AND THE ROW SAYS SO OUT LOUD
 * (trap 475: a declared axis that reaches nothing prints a complete-looking
 * table; trap 568: an INPUT scan is not REACH).
 *
 * The survey builds `replay` only for a step that SOLVED, and a SOLVED step
 * has no refusal — so at the one call site the run argument is null wherever
 * a family is actually computed. This is asserted against the SOURCE, because
 * the claim is about the call site rather than about the classifier.
 */
describe('the arm\'s reach, named rather than assumed', () => {
    it('⚠ the survey\'s only call site passes `res.replay`, which a REFUSED row lacks', () => {
        const src = readFileSync(
            new URL('./survey-seedling-route.mjs', import.meta.url), 'utf8');
        const calls = [...src.matchAll(/familyOf\([^)]*\)/g)].map((m) => m[0]);
        expect(calls).toEqual(['familyOf(res.refusal, res.replay)']);
        // …and `replay` is null unless the step solved — the survey's own line
        expect(src).toMatch(/let replay = null;/);
        expect(src).toMatch(/if \(solved\) \{\n\s+const run = makeRun\(solved\.persistence\);/);
    });
});

/**
 * ⛓ SEEDLING FIDELITY STANCE — the two sentences the stance slice added, each
 * with the refusal it classifies (L48's shut bosslock; a stance re-entry).
 */
describe('familyOf — the STANCE rows', () => {
    it('⛓ a key line on the lock\'s far side is KEYLOCK-SEALED, with the saved flag', () => {
        const text = 'solverBot: no REACHABLE stance on bosslock@48,144\'s key line in level 48 — 2 cell(s) '
            + 'put the player box on the line when walked into the lock, none with a corridor from (24,120). '
            + '⛔ SEALED BEHIND ITSELF: the key line is the row y=161 under bosslock@48,144 (`BossLock.update`\'s '
            + '`collideLine`, x 50..59), and from (24,120) a corridor reaches the stance (56,168) only through '
            + 'the lock itself. The save still holds its flag {48,1}, so the game builds it SOLID';
        expect(familyOf(text)).toMatch(/^KEYLOCK-SEALED — bosslock@48,144's key line is on its far side from this arrival and the save holds its flag \{48,1\} \(the SHUT state\)/);
    });
    it('⛓ a stance walk that re-enters its own order is STANCE-REENTRY', () => {
        const text = 'solverBot(x) reach-exit (112,304)->L47 -> keylock stance (bosslock@48,144): STANCE_REENTRY — '
            + 'the walk to bosslock@48,144\'s `keylock` stance (56,168) is itself blocked by bosslock@48,144';
        expect(familyOf(text)).toMatch(/^STANCE-REENTRY — the `keylock` stance of bosslock@48,144 is behind/);
    });
});
