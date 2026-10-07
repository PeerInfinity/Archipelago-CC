#!/usr/bin/env node
/**
 * Seedling: DOES A STAGED PERSISTENCE FLAG REACH THE ENTITIES, PER BOOT PATH? (slice `seedling-js-persistence`,
 * after the rules arc's W0 finding: several tapes on ONE page leaked bosslock state across `botStart`).
 *
 * `Bot.botStart` rewrites the persistence table (the unconditional sweep, then the tape's clears) on EVERY start,
 * but builds a world only when `bootLevel != Main.level || !atBootPosition()` (`Bot.as`, the `booting` line):
 * `Main.playerPositionX/Y` are the SPAWN of the last `new Game`, so a tape booting the current level at the last
 * build's spawn REUSES the live world. A persistence-built entity reads its flag only in its constructor or on the
 * new world's first `check()` (`BossLock.check`, `BreakableRock.check`, `TentacleBeast`'s ctor), so on that skip
 * path the TABLE says the declaration while the ENTITIES still say the old world.
 *
 * Every SEQUENCE below runs on its OWN fresh page; the answer is the LAST tape's. Per entity a SIGNAL arm (a boot +
 * a held key) whose fresh-page answer differs with the flag staged vs not (`open` = behaves as cleared):
 *   lock  `bosslock` (`--lock=30:0`): booted on the tile NORTH, its key presented, holding DOWN → crosses south iff
 *         the flag is cleared (the rules' RETURN arm);
 *   rock  `breakablerock` (`--rock=0:1`): the first of the four one-tile approaches whose fresh answers differ;
 *   mouth the L57 TentacleBeast (tag 0): booted (96,96), the conch granted, holding UP → crosses to L58 iff dead.
 * Sequences (`-` = the flag NOT staged, `+` = staged):
 *   fresh+ / fresh-           a fresh page, one tape: the game's own answer (the truth rows)
 *   same-/+  same+/-          the signal tape, then the signal with the flag flipped, SAME boot (the skip path)
 *   moved-/+                  an idle tape at another boot of the same level, then the signal + (a rebuild)
 *   level-/+                  an idle tape in another level, then the signal + (a rebuild)
 *   teleport-/+               the signal -, a host `new Game(level, boot)` (the panel's teleport recipe), the signal +
 *   teleport-live+            the flag written BY A REBUILT TAPE elsewhere in the level, a host teleport, then the
 *                             signal declaring the live table (+): production's shape (declare what the game holds)
 *   cont-live-                the signal -, then the signal - again: a continuation declaring the live table
 *   midroom-/+ midroom-live-  the signal - FROZEN at `--freeze=` (`botHold on`), then a tape over it (+ / -)
 * Each ROW carries `rebuilt` (the last tape's `botSeam().beginEntry` read AT ARMING, at `begin.tick` 0: `botLoadTape`
 * clears it, so null = the world was reused; read later it would be a door crossing's) and `cleared` (`persistence_cleared` after it: the table).
 *
 * Checks: every REBUILT sequence and every production-shape sequence (the declaration = the live table) equals the
 * fresh truth; the skip-path sequences are REPORTED (`ROW`), and `--expect-skip-ignores` asserts the mechanism (no
 * rebuild, the entity answers as the previous world, the table as the declaration).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (proved, `CHANNEL: headless logic-only`), so it runs in CI too
 * (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-persistence-rebuild.mjs [--host=http://localhost:8000] [--ticks=180]
 *      [--only=lock,rock,mouth] [--seq=fresh+,same-/+] [--lock=30:0] [--rock=0:1] [--freeze=20]
 *      [--expect-skip-ignores] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const TILE = 16;

/** The sequences, in run order: `[name, rebuildExpected, productionShape]`. */
export const SEQUENCES = Object.freeze([
    ['fresh+', true, true], ['fresh-', true, true],
    ['same-/+', false, false], ['same+/-', false, false],
    ['moved-/+', true, false], ['level-/+', true, false],
    ['teleport-/+', false, false], ['teleport-live+', false, true],
    ['cont-live-', false, true],
    ['midroom-/+', false, false], ['midroom-live-', false, true],
]);

/** A map entity `{level, x, y, tag, attrs}` of `type` at `level:tag`, or null. */
export function entityOf(map, type, levelTag) {
    const [level, tag] = levelTag.split(':').map(Number);
    const l = map.levels.find((x) => x.level === level);
    const e = (l?.entities ?? []).find((x) => x.type === type && Number(x.attrs?.tag ?? -1) === tag);
    return e ? { level, x: e.x, y: e.y, tag, attrs: e.attrs ?? {} } : null;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const TICKS = Number(arg('ticks', '180'));
    const FREEZE = Number(arg('freeze', '20'));
    const onlyEnt = new Set(arg('only', 'lock,rock,mouth').split(','));
    const onlySeq = arg('seq', '') ? new Set(arg('seq', '').split(',')) : null;
    const expectSkip = process.argv.includes('--expect-skip-ignores');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const { PIN_NAMES, parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
    const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    const GAME = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));

    const lock = entityOf(MAP, 'bosslock', arg('lock', '30:0'));
    const rock = entityOf(MAP, 'breakablerock', arg('rock', '0:1'));
    const beast = entityOf(MAP, 'tentaclebeast', '57:0');

    takeBoxLockOrExit({ name: 'probe-seedling-persistence-rebuild.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const tapeOf = ({ name, level, boot, key, flag, ent, keys = [], grants = [], ticks = TICKS }) => parseTape({
        tape_version: 8, game: 'seedling', name, description: 'probe-seedling-persistence-rebuild',
        boot: { level, ...boot }, noclip: false, noDamage: true, noHazards: [],
        grants, persistence: flag ? [{ level: ent.level, tag: ent.tag, note: 'staged' }] : [],
        equips: [], pins: [...PIN_NAMES], save: { totem_parts: [], keys, seal_parts: [] },
        rng: { seed: 1, split: false }, seam: {}, tick_count: ticks,
        inputs: key ? [{ key, from: 0, to: ticks }] : [],
    });

    /** One fresh page; `steps(api)` drives it. */
    const onPage = async (steps) => {
        const page = await browser.newPage();
        const logs = [];
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const bot = (name, a) => page.evaluate(([n, x]) => String(window.__swfBridge.game[n](x)), [name, a]);
        const botJson = async (name, a) => JSON.parse(await bot(name, a));
        const seamBegin = async () => (await botJson('botSeam')).beginEntry ?? null;
        let configured = false;
        const api = {
            /** Play `tape` (to its end, or frozen at `freezeAt`); the drained rows + the table + the rebuild read. */
            async play(tape, { freezeAt = null } = {}) {
                if (await bot('botLoadTape', JSON.stringify(tape)) !== 'ok') throw new Error(`botLoadTape ${tape.name}`);
                if (await bot('botStart') !== 'ok') throw new Error(`botStart ${tape.name}`);
                // ⛓ the BOOT's begin latch, read at arming — before the tape can cross a door (a crossing's own
                // `begin()` latches at its tick, so the end-of-run read would be the crossing's)
                let boot;
                for (let i = 0; i < 400; i += 1) {
                    const st0 = await botJson('botStatus');
                    if (st0.armed || st0.finished || st0.tick > 0) {
                        const be0 = await seamBegin();
                        boot = { rebuilt: !!be0 && Number(be0['begin.tick']) === 0, armedAt: st0.tick };
                        break;
                    }
                    await page.waitForTimeout(16);
                }
                if (!boot) throw new Error(`${tape.name}: never armed`);
                const rows = [];
                for (const deadline = Date.now() + 5 * 60 * 1000; ;) {
                    const st = await botJson('botStatus');
                    if (st.error) throw new Error(`${tape.name}: ${st.error}`);
                    if (freezeAt != null && st.tick >= freezeAt) {
                        await bot('botHold', 'on');
                        break;
                    }
                    if (st.finished) break;
                    if (Date.now() > deadline) throw new Error(`${tape.name}: deadline`);
                    await page.waitForTimeout(freezeAt != null ? 16 : 250);
                }
                rows.push(...((await botJson('botDrain')).ticks ?? []));
                const st = await botJson('botStatus');
                return { rows, cleared: st.persistence_cleared ?? [], tick: st.tick, level: st.level, ...boot };
            },
            /** The panel's teleport recipe (`games/seedling.json` `teleport`): a host `new Game`; waits for its begin. */
            async teleport(level, x, y, clearTape) {
                // `botLoadTape` clears the begin latch (`clearLatch`), so the teleport's own `begin()` is the next
                // non-null entry (two builds of one room can latch byte-identical entries).
                if (await bot('botLoadTape', JSON.stringify(clearTape)) !== 'ok') throw new Error('botLoadTape (latch clear)');
                // BridgeGeneric polls its item queue only once configured (the panel's `configure`, its class map)
                if (!configured) {
                    const r = await bot('configure', JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
                    if (!/^ok/.test(r)) throw new Error(`configure: ${r}`);
                    configured = true;
                }
                await page.evaluate(({ l, px, py }) => {
                    window.__swfBridge.queueItems([{ class: 'game', property: 'menu', value: false }, {
                        invocation: 'new_instance', className: 'Game', args: [l, px, py],
                        assignTo: { class: 'net.flashpunk.FP', property: 'world' } }]);
                }, { l: level, px: x, py: y });
                for (let i = 0; i < 100; i += 1) {
                    const be = await seamBegin();
                    if (be && be['begin.level'] === level) {
                        await page.waitForTimeout(300);
                        return true;
                    }
                    await page.waitForTimeout(100);
                }
                return false;
            },
        };
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) await page.waitForTimeout(250);
            // ⛓ the logic-only channel, PROVED before anything is measured (`seedlingChannel.js`)
            await assertLogicOnlyChannel(page);
            return await steps(api);
        } catch (e) {
            console.log(`PAGE LOGS (last 12):\n${logs.slice(-12).join('\n')}`);
            throw e;
        } finally {
            await page.close();
        }
    };

    // ── the entities and their signal arms ──
    const ents = [];
    if (onlyEnt.has('lock') && lock) {
        const keyType = Number(lock.attrs.keyType ?? 0);
        ents.push({ id: `lock L${lock.level} bosslock@${lock.x},${lock.y} {${lock.level},${lock.tag}}`, ...lock,
            signal: { boot: { x: lock.x, y: lock.y - TILE }, key: 'down', keys: [keyType] },
            other: { boot: { x: lock.x, y: lock.y - 2 * TILE } },
            open: (r) => Math.max(...r.rows.filter((o) => o.level === lock.level).map((o) => o.y)) > lock.y + TILE });
    }
    if (onlyEnt.has('rock') && rock) {
        const cx = rock.x + TILE / 2; const cy = rock.y + TILE / 2;
        const approaches = [
            { boot: { x: rock.x, y: rock.y - TILE }, key: 'down', past: (o) => o.y > cy },
            { boot: { x: rock.x, y: rock.y + TILE }, key: 'up', past: (o) => o.y < cy - TILE },
            { boot: { x: rock.x - TILE, y: rock.y }, key: 'right', past: (o) => o.x > cx },
            { boot: { x: rock.x + TILE, y: rock.y }, key: 'left', past: (o) => o.x < cx - TILE },
        ];
        let chosen = null;
        const tried = [];
        for (const a of approaches) {
            const answer = async (flag) => onPage(async (api) => {
                const r = await api.play(tapeOf({ name: `rock-probe-${a.key}-${flag}`, level: rock.level, boot: a.boot, key: a.key, flag, ent: rock }));
                return r.rows.filter((o) => o.level === rock.level).some(a.past);
            });
            const [pos, neg] = [await answer(true), await answer(false)];
            tried.push({ key: a.key, boot: a.boot, flagged: pos, unflagged: neg });
            if (pos && !neg) { chosen = a; break; }
        }
        console.log(`ROW ${JSON.stringify({ rockApproaches: tried })}`);
        if (chosen) {
            const other = approaches.find((a) => a !== chosen);
            ents.push({ id: `rock L${rock.level} breakablerock@${rock.x},${rock.y} {${rock.level},${rock.tag}}`, ...rock,
                signal: { boot: chosen.boot, key: chosen.key, keys: [] }, other: { boot: other.boot },
                open: (r) => r.rows.filter((o) => o.level === rock.level).some(chosen.past) });
        } else check(`rock L${rock?.level}:${rock?.tag}: a signal approach exists`, false, JSON.stringify(tried));
    }
    if (onlyEnt.has('mouth') && beast) {
        ents.push({ id: `mouth L57 TentacleBeast {57,0}`, ...beast,
            signal: { boot: { x: 96, y: 96 }, key: 'up', keys: [], grants: [{ level: 57, items: ['conch'] }] },
            other: { boot: { x: 128, y: 64 }, grants: [{ level: 57, items: ['conch'] }] },
            open: (r) => r.rows.some((o) => o.level !== 57) });
    }

    // Another level's idle boot (the Overworld region coords) for `level-/+`.
    const ELSEWHERE = { level: 1, boot: { x: 48, y: 32 } };
    const matrix = [];
    try {
        for (const e of ents) {
            const sig = (flag, name, extra = {}) => tapeOf({ name, level: e.level, boot: e.signal.boot, key: e.signal.key,
                keys: e.signal.keys, grants: e.signal.grants ?? [], flag, ent: e, ...extra });
            const idle = (flag, name, boot, level = e.level, grants = e.other.grants ?? []) => tapeOf({
                name, level, boot, key: null, flag, ent: e, grants, ticks: 30 });
            const seqs = {
                'fresh+': (api) => api.play(sig(true, 'fresh+')),
                'fresh-': (api) => api.play(sig(false, 'fresh-')),
                'same-/+': async (api) => { await api.play(sig(false, 'a')); return api.play(sig(true, 'b')); },
                'same+/-': async (api) => { await api.play(sig(true, 'a')); return api.play(sig(false, 'b')); },
                'moved-/+': async (api) => { await api.play(idle(false, 'a', e.other.boot)); return api.play(sig(true, 'b')); },
                'level-/+': async (api) => { await api.play(idle(false, 'a', ELSEWHERE.boot, ELSEWHERE.level, [])); return api.play(sig(true, 'b')); },
                'teleport-/+': async (api) => {
                    await api.play(sig(false, 'a'));
                    if (!await api.teleport(e.level, e.signal.boot.x, e.signal.boot.y, idle(false, 'latch-clear', e.signal.boot))) throw new Error('the teleport never landed');
                    return api.play(sig(true, 'b'));
                },
                'teleport-live+': async (api) => {
                    // the flag in the TABLE, written by a rebuilt tape at another boot (the game holding it)
                    const a = await api.play(idle(true, 'a', e.other.boot));
                    if (!await api.teleport(e.level, e.signal.boot.x, e.signal.boot.y, idle(false, 'latch-clear', e.signal.boot))) throw new Error('the teleport never landed');
                    const r = await api.play(sig(true, 'b'));
                    return { ...r, before: { cleared: a.cleared, rebuilt: a.rebuilt } };
                },
                'cont-live-': async (api) => { await api.play(sig(false, 'a')); return api.play(sig(false, 'b')); },
                'midroom-/+': async (api) => { await api.play(sig(false, 'a'), { freezeAt: FREEZE }); return api.play(sig(true, 'b')); },
                'midroom-live-': async (api) => { await api.play(sig(false, 'a'), { freezeAt: FREEZE }); return api.play(sig(false, 'b')); },
            };
            const res = {};
            for (const [name] of SEQUENCES) {
                if (onlySeq && !onlySeq.has(name) && !name.startsWith('fresh')) continue;
                const r = await onPage(seqs[name]);
                res[name] = { open: e.open(r), rebuilt: r.rebuilt, table: r.cleared.some((c) => Number(c.level) === e.level && Number(c.tag) === e.tag),
                    ...(r.before ? { before: r.before } : {}) };
                const row = { entity: e.id, seq: name, ...res[name] };
                matrix.push(row);
                console.log(`ROW ${JSON.stringify(row)}`);
            }
            const truth = { '+': res['fresh+'].open, '-': res['fresh-'].open };
            check(`${e.id}: the signal arm discriminates on fresh pages (staged → open, not staged → shut)`,
                truth['+'] === true && truth['-'] === false, JSON.stringify(truth));
            for (const [name, rebuild, production] of SEQUENCES) {
                if (!res[name] || name.startsWith('fresh')) continue;
                const want = truth[name.at(-1)];
                const r = res[name];
                // A rebuild (expected or not: a crossing out of the level makes the next tape rebuild) or the
                // production shape must answer as a fresh page; the skip path with a FLIPPED declaration is reported.
                if (r.rebuilt || production) {
                    check(`${e.id}: ${name} (${r.rebuilt ? 'rebuilt' : 'reused; production shape: the declaration = the live table'}) answers as a fresh page`,
                        r.open === want, JSON.stringify(r));
                }
                if (rebuild) check(`${e.id}: ${name} rebuilt the world`, r.rebuilt === true, JSON.stringify(r));
                if (!r.rebuilt && !production && expectSkip) {
                    check(`${e.id}: ${name} — the skip path IGNORES the flipped declaration (the entity answers as the old world)`,
                        r.open === !want, JSON.stringify(r));
                    check(`${e.id}: ${name} — … while the TABLE says the declaration`, r.table === (name.at(-1) === '+'), JSON.stringify(r));
                }
            }
        }
    } catch (err) {
        check('the wasm runs', false, String(err.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    console.log(`MATRIX ${JSON.stringify(matrix)}`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
