/**
 * THE WORLD-SWAP GATE — the driver's refusal, exercised from JS. ⚖ R9 ruling
 * 58, slice 12g.
 *
 * ⛓ WHY THE ROWS LIVE HERE AND THE CODE LIVES IN PYTHON. The gate has to run
 * inside `seedling-bot-replay-win.py`, because that is the only process that
 * ever holds a drained stream before it becomes a result — and that file is
 * COPIED whole into a Windows scratch directory by seventeen consumers, so the
 * predicate cannot be split into a sibling module without giving every one of
 * them a new file to forget. The assertions therefore cross the language
 * boundary instead: this file owns every case and every expected verdict, and
 * `python3` is only the transport. A self-test that graded itself would be the
 * fixed point trap 769 is about.
 *
 * ⛔ `python3` IS A HARD DEPENDENCY OF THIS ROW, not a skip. A row that goes
 * green because its interpreter was missing is trap 522's shape — a liveness
 * probe that turns its subject's absence into a pass. `ubuntu-latest` ships
 * python3; if that ever stops being true this file fails and says so.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TILE } from '../../frontend/modules/seedlingDemo/playerPhysicsV1.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DRIVER = join(HERE, 'seedling-bot-replay-win.py');
const FIXTURES = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo',
    'fixtures');

/**
 * The transport. `importlib` rather than an import statement because the
 * driver's filename has hyphens — and loading it at all is itself the claim
 * that the playwright import really did move inside `main()`: this row would
 * die at module exec if it had not.
 */
const SNIPPET = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('driver', sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
cases = json.load(sys.stdin)
json.dump({
    'halfTile': mod.CONSTRUCTOR_HALF_TILE,
    'verdicts': [mod.check_drain(c.get('label', 'case'), c.get('boot'),
                                 c.get('tick_count'), c.get('ticks') or [])
                 for c in cases],
}, sys.stdout)
`;

function gate(cases) {
    const out = execFileSync('python3', ['-c', SNIPPET, DRIVER], {
        input: JSON.stringify(cases),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(out);
}

/** A drained stream of `n + 1` observations booting at `obs`. */
function drain(obs, n) {
    return Array.from({ length: n + 1 }, (_, t) => ({ ...obs, t }));
}

describe('the world-swap gate', () => {
    it('spells the constructor half-tile as the game does', () => {
        // ⛔ THE ONE-SPELLING LAW ACROSS A LANGUAGE BOUNDARY. `Player.as:375`
        // is `super(_x + Tile.w / 2, _y + Tile.h / 2)`; the JS side already
        // transcribes `Tile` as `playerPhysicsV1.TILE`. The driver cannot
        // import that, so this row is what stops the two from drifting — the
        // Python constant is not an independent claim, it is a copy with a
        // keeper.
        expect(gate([]).halfTile).toBe(TILE.w / 2);
        expect(TILE.w / 2).toBe(TILE.h / 2);
    });

    it('passes a drain whose t=0 is the declared boot', () => {
        const boot = { level: 13, x: 64, y: 128 };
        const obs = { level: 13, x: 64 + TILE.w / 2, y: 128 + TILE.h / 2 };
        const { verdicts } = gate([
            { label: 'r9-solve-0', boot, tick_count: 146, ticks: drain(obs, 146) },
        ]);
        expect(verdicts).toEqual([null]);
    });

    it('refuses BY NAME when t=0 reads the outgoing world', () => {
        // ⛓ THE MEASURED SHAPE, from §43.7: a pre-boot idle >= 0.5 s makes the
        // first recorded tick land BEFORE the swap, so t=0 reports the page's
        // own boot — `Main.as:51` builds `new Game(0, 80, 128)` and the
        // constructor half-tile puts the Player at (88,136).
        const boot = { level: 13, x: 64, y: 128 };
        const pageBoot = { level: 0, x: 88, y: 136 };
        const { verdicts } = gate([
            { label: 'r9-solve-0', boot, tick_count: 146,
                ticks: drain(pageBoot, 146) },
        ]);
        expect(verdicts[0]).toMatch(/^WORLD_SWAP_RACE_LOST: /);
        expect(verdicts[0]).toContain('t=0 reads L0 (88,136)');
        expect(verdicts[0]).toContain('vs declared boot L13 (72,136)');
        // The refusal has to be diagnosable on its own: it names the line that
        // decided the frame and the line the swap is deferred by.
        expect(verdicts[0]).toContain('Bot.as:2877');
        expect(verdicts[0]).toContain('Bot.as:1731');
    });

    it('(m2) names the SECOND signal when only the length is wrong', () => {
        // The first tick is exactly right, so signal (1) is silent. If the
        // length check were decorative this case would pass — which is the
        // whole reason the row exists. `Bot.update` disarms at
        // `tick >= tickCount` AFTER recording (`Bot.as:2963`), so N + 1 is a
        // law and N is a defect.
        const boot = { level: 13, x: 64, y: 128 };
        const obs = { level: 13, x: 64 + TILE.w / 2, y: 128 + TILE.h / 2 };
        const short = drain(obs, 146).slice(0, -1);
        const { verdicts } = gate([
            { label: 'r9-solve-0', boot, tick_count: 146, ticks: short },
        ]);
        expect(verdicts[0]).toMatch(/^DRAIN_LENGTH_UNEXPECTED: /);
        expect(verdicts[0]).toContain('drained 146 ticks, expected 147');
    });

    it('refuses, rather than passing, what it cannot check', () => {
        const { verdicts } = gate([
            { label: 'no-boot', boot: null, tick_count: 4, ticks: [] },
            { label: 'partial-boot', boot: { level: 0, x: 80 }, tick_count: 4,
                ticks: [] },
            { label: 'empty-drain', boot: { level: 0, x: 80, y: 128 },
                tick_count: 4, ticks: [] },
        ]);
        verdicts.forEach((v) => expect(v)
            .toMatch(/^WORLD_SWAP_GATE_UNVERIFIABLE: /));
    });

    it('passes the SKIP-PATH tape on its own committed bytes', () => {
        // ⛓ `botStart` skips `new Game` entirely when the tape's boot names
        // the current level AND `atBootPosition()` holds (`Bot.as:1730`), and
        // `collide-up-rock` declares exactly the page's own boot. No swap is
        // pending, so there is no race to lose — and the gate must be CORRECT
        // there, not merely quiet.
        const tape = JSON.parse(readFileSync(
            join(FIXTURES, 'tapes', 'collide-up-rock.json'), 'utf8'));
        const expected = JSON.parse(readFileSync(
            join(FIXTURES, 'expectations', 'collide-up-rock.json'), 'utf8'));
        expect(tape.boot).toEqual({ level: 0, x: 80, y: 128 });
        const ticks = expected.ticks ?? expected.stream.ticks;
        const { verdicts } = gate([
            { label: 'collide-up-rock', boot: tape.boot,
                tick_count: tape.tick_count, ticks },
        ]);
        expect(verdicts).toEqual([null]);
    });

    it('passes every committed fixture — the false-refusal control', () => {
        // ⛔ THE ROW THAT MAKES THE GATE SAFE TO LAND. A gate that refuses
        // work the roster legitimately does is worse than no gate, and the
        // only way to know is to run it over everything that is committed.
        // 149 tape/expectation pairs at `54c242adf`.
        const names = readdirSync(join(FIXTURES, 'tapes'))
            .filter((f) => f.endsWith('.json'))
            .map((f) => f.slice(0, -'.json'.length));
        const cases = [];
        for (const name of names) {
            let tape;
            let expected;
            try {
                tape = JSON.parse(readFileSync(
                    join(FIXTURES, 'tapes', `${name}.json`), 'utf8'));
                expected = JSON.parse(readFileSync(
                    join(FIXTURES, 'expectations', `${name}.json`), 'utf8'));
            } catch {
                continue; // a tape with no committed expectation is not a case
            }
            cases.push({ label: name, boot: tape.boot,
                tick_count: tape.tick_count,
                ticks: expected.ticks ?? expected.stream.ticks });
        }
        // The count is ASSERTED rather than assumed: a glob that silently
        // matched nothing would make this row vacuously green.
        expect(cases.length).toBeGreaterThan(140);
        const { verdicts } = gate(cases);
        const refused = verdicts
            .map((v, i) => (v ? `${cases[i].label}: ${v}` : null))
            .filter(Boolean);
        expect(refused).toEqual([]);
    });
});
