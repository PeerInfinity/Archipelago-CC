// Stage a boss tape's boot with the dark suit granted, drive `keysAt(t)` for `ticks`, key ON/OFF.
// node stage.mjs <tape> <ticks> <on|off> [hold=<key>] [from=<t>]   (hold: from `from` on, hold only that key)
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createRunForStaging, stagingFromTape } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { loadTape } from '../../../../../frontend/modules/seedlingDemo/fixtures/index.js';
import { heldKeysAt } from '../../../../../frontend/modules/seedlingDemo/tapeFormat.js';

export function stage({ tape: name, ticks, on, hold = null, from = 0, presses = true, suit = true, health = 0, noDamage = null,
    sources = ['shieldBossStab', 'owlBody', 'bobBoss', 'bossBody'] }) {
    const tape = loadTape(name);
    const level = tape.boot.level;
    const grants = [...(tape.grants ?? [])];
    const extra = [...(suit ? ['darksuit'] : []), ...Array(health).fill('health')];
    if (extra.length) grants.push({ level, items: extra });
    return withContactFidelity({ darkSuitBossRetaliation: on }, () => {
        const st = stagingFromTape(tape);
        const run = createRunForStaging({ ...st, grants, noDamage: noDamage ?? st.noDamage }, atlasLevelSource());
        let thrown = null; let t = 0;
        try {
            for (; t < ticks; t += 1) {
                let keys = heldKeysAt(tape, t);
                if (!presses) keys = new Set([...keys].filter((k) => k !== 'primary'));
                if (hold !== null && t >= from) keys = new Set([hold]);
                run.advance(keys);
            }
        } catch (e) { thrown = `t${t}: ${e.message}`; }
        const hits = run.ledger('playerHits').filter((h) => sources.includes(h.source));
        return { thrown, hits, run };
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const [name, ticks, onoff, ...rest] = process.argv.slice(2);
    const o = Object.fromEntries(rest.map((a) => a.split('=')));
    const r = stage({ tape: name, ticks: +ticks, on: onoff === 'on', hold: o.hold ?? null, from: +(o.from ?? 0),
        presses: o.presses !== '0', health: +(o.health ?? 0) });
    console.log(JSON.stringify({ thrown: r.thrown?.slice(0, 600) ?? null, hits: r.hits }, null, 1));
}
