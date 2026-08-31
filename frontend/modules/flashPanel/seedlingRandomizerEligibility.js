/**
 * flashPanel/seedlingRandomizerEligibility — **DOES THIS PRESET GET THE
 * SEEDLING RANDOMIZER?**, answered from DATA (EDITOR INTEGRATION slice P1-a;
 * plan §17.1, §17.5).
 *
 * ── ⚖⚖ THE RULING THIS FILE EXISTS FOR ──────────────────────────────────
 *
 * ⚖ USER, 2026-08-29: *every frontend feature DETECTS from the loaded
 * preset's DATA whether it applies — no opt-in flag*, and *the build-side
 * half of that detection is a `capabilities` list per build in the wasm
 * manifest*. So there is no setting, no query parameter and no per-preset
 * boolean anywhere in this arc: four facts the preset and the build already
 * carry decide it, and the FIRST one that is false is named out loud.
 *
 *   (i)   the panel's transport is the wasm page, and the preset names one
 *   (ii)  the build the preset names DECLARES `apitem` in `builds.json`
 *   (iii) at least one goal-ledger location resolves against the loaded
 *         Archipelago placement
 *   (iv)  the vanilla record set and the room map are reachable
 *
 * ── ⛔ WHY THE PREDICATE IS PURE, AND WHY IT ANSWERS `undecided` ─────────
 *
 * (iii) and (iv) cannot be evaluated without the heavy half — the 976 KB room
 * map and the 87-file rewriter graph, which the wiring imports lazily
 * precisely so the shipped bundle does not carry them (`seedlingRandomizer-
 * Wiring.js`, and the four-build measurement in its header). (i) and (ii) are
 * cheap: a rules field and a small JSON fetch.
 *
 * ⇒ the caller resolves the inputs IN ORDER and calls this twice: once with
 * the two cheap ones, and again with everything if the cheap ones passed. An
 * input that has not been resolved yet is `undefined`, its check answers
 * `unknown`, and the verdict is `undecided` — which is not a refusal and must
 * never be logged as one.
 *
 * ⛓ A DEFINITE FAILURE OUTRANKS AN EARLIER UNKNOWN. The checks are declared
 * in the ruled order and a failure is reported by the FIRST failing one, but
 * a check that is merely `unknown` never hides a later `fail`: the map fetch
 * dying is what the person needs told, even though (iii) — which is declared
 * first and needs that very map — could not be evaluated at all.
 *
 * ── ⛓ THE VOCABULARY LIVES HERE, AND THE PIN GATE IMPORTS IT ────────────
 *
 * `scripts/procgen/check-seedling-wasm-pins.mjs` gates every manifest entry's
 * `capabilities` against `WASM_BUILD_CAPABILITIES`. It imports the constant
 * from this file rather than spelling its own copy, because a gate spelled
 * differently from its consumer tests itself — the same lesson the pin gate's
 * own `scannable()` learned when the self-test carried a second copy of the
 * normaliser and a mutant left it green.
 *
 * ⚠ THE VOCABULARY IS BROADER THAN THIS PREDICATE. `arm` is in it and is read
 * by nothing here: it exists so that its ABSENCE on exactly one build can be
 * gated (pins row (g)), the way `apitem`'s absence on exactly one build is.
 * See `ARM_CAPABILITY` below.
 *
 * ⛔ AND THIS FILE NAMES NO BUILD. The build name is DERIVED from the
 * preset's own `flash_panel.wasm`; a literal here would both hardcode the
 * default and register as a pin in the four-way law the pin gate enforces.
 */

/** The one capability this arc defines: the build carries `Pickups/APItem.as`
 *  and its `<apitem>` element in `Game.as`'s XML loop. */
export const AP_ITEM_CAPABILITY = 'apitem';

/**
 * The build arms in `Bot.update` on the first frame where `FP.world` IS the
 * world `botStart` constructed (R9 slice 12g′, ⚖ ruling 58's (F)), rather than
 * setting `armed = true; tick = 0` beside the swap it merely REQUESTED. Its
 * `botStatus` therefore carries an `arm: {pending, armed_at}` block, and the
 * pre-swap frame is not counted dead.
 *
 * ⛔⛔ THIS ONE HAS NO CONSUMER IN THIS FILE, AND THAT IS THE POINT — IT IS
 * DECLARED SO THAT AN ABSENCE CAN BE GATED. The two live consumers are
 * dead-frame corrections that read the RUNTIME field, not the manifest:
 * `check-seedling-wasm-ship.mjs`'s CLAIM 6 (`armsAfterSwap ? 0 :
 * BOOT_PRESWAP_FRAMES`) and `seedlingDemo/r5Acceptance.js`'s
 * `preSwapCorrection`. Each is proved only by an arm on a build that LACKS the
 * capability — with no such build the false branch is unreachable and the
 * correction silently degrades to "always subtract one", which is the exact
 * inversion `preSwapCorrection`'s docblock records its own mutant going GREEN
 * on. ⇒ `check-seedling-wasm-pins.mjs` row (g) gates it, the same way row (f)
 * gates `apitem`'s control.
 *
 * ⛓ SO THE VOCABULARY IS BROADER THAN THIS PREDICATE'S OWN USE, deliberately.
 * `WASM_BUILD_CAPABILITIES` is the list a MANIFEST ENTRY may draw on; only
 * `AP_ITEM_CAPABILITY` is read by the eligibility checks below. Splitting the
 * two lists would put a second copy of the vocabulary somewhere, which is the
 * one thing the manifest's own `$comment` forbids.
 */
export const ARM_CAPABILITY = 'arm';

/**
 * ⛓ THE DECLARED VOCABULARY. A manifest entry may only name capabilities from
 * this list — otherwise `"apitm"` would silently mean "this build does not
 * have it" and the feature would vanish with no error anywhere.
 */
export const WASM_BUILD_CAPABILITIES = Object.freeze(
    [AP_ITEM_CAPABILITY, ARM_CAPABILITY]);

/** The ids the four checks report themselves by, in the ruled order. */
export const ELIGIBILITY_CHECK_IDS = Object.freeze(
    ['transport', 'capability', 'placement', 'assets']);

/**
 * The build directory a `flash_panel.wasm` wiring names.
 * `"seedling_bot_ap_p4d/game.html"` → `"seedling_bot_ap_p4d"`, and the same
 * for a path or URL with anything in front of it, because the manifest's
 * `name` is the DIRECTORY and the page is always the file inside it.
 * @param {string} wasmPath
 * @returns {string|null}
 */
export function buildNameFromWasmPath(wasmPath) {
    if (typeof wasmPath !== 'string' || wasmPath.trim() === '') return null;
    const parts = wasmPath.split(/[?#]/)[0].split('/').filter(Boolean);
    // The page file is the last segment; the build directory is the one before
    // it. A bare directory (no page) is accepted and names itself.
    if (parts.length === 0) return null;
    const last = parts[parts.length - 1];
    if (last.endsWith('.html')) return parts.length >= 2 ? parts[parts.length - 2] : null;
    return last;
}

/**
 * The manifest entry for a build, and the capabilities it DECLARES.
 *
 * ⛔ `null` capabilities is NOT the empty list. An entry with no
 * `capabilities` field predates the field and says nothing; an entry with
 * `[]` says "measured, and this build has none". The gate makes the second
 * one mandatory so the ambiguity cannot ship, and this function keeps the
 * distinction so a stale manifest is reported as stale rather than as a
 * build that lost a feature.
 *
 * @param {object|null} manifest  the parsed `flashPanel/wasm/builds.json`
 * @param {string|null} buildName
 * @returns {{entry: object|null, capabilities: string[]|null}}
 */
export function capabilitiesOf(manifest, buildName) {
    const builds = Array.isArray(manifest?.builds) ? manifest.builds : null;
    if (!builds || !buildName) return { entry: null, capabilities: null };
    const entry = builds.find((b) => b?.name === buildName) ?? null;
    if (!entry) return { entry: null, capabilities: null };
    return {
        entry,
        capabilities: Array.isArray(entry.capabilities) ? entry.capabilities : null,
    };
}

const pass = (why) => ({ status: 'pass', why });
const fail = (why) => ({ status: 'fail', why });
const unknown = (why) => ({ status: 'unknown', why });

/**
 * ── (i) THE TRANSPORT ────────────────────────────────────────────────────
 *
 * ⛔ WASM-ONLY, AND IT IS A MEASURED LIMIT RATHER THAN A PREFERENCE. The
 * `<apitem>` element is built by `Game.as`'s XML loop in a recompiled build;
 * UNMEASURED is whether Ruffle's AVM2 runs `botLoadLevels` at 116-room scale
 * (plan §17.1.6, ⚖ low priority). Until someone measures it the Flash
 * transport gets ONE log line and its vanilla game, which is exactly what it
 * has today.
 */
function checkTransport({ flashPanel, transport }) {
    if (transport === undefined) return unknown('the panel has not chosen a transport yet');
    if (transport !== 'wasm') {
        return fail(`the panel is on the ${JSON.stringify(transport)} transport — the AP `
            + 'placement is wasm-only until Ruffle\'s AVM2 is measured against a 116-room '
            + '`botLoadLevels` (plan §17.1.6)');
    }
    if (!flashPanel?.wasm) {
        return fail('the preset\'s `flash_panel` names no `wasm` page, so there is no build '
            + 'to ask about capabilities');
    }
    return pass(`wasm transport, build page ${flashPanel.wasm}`);
}

/** ── (ii) THE BUILD'S OWN DECLARATION ──────────────────────────────────── */
function checkCapability({ flashPanel, manifest }) {
    const buildName = buildNameFromWasmPath(flashPanel?.wasm);
    if (manifest === undefined) return unknown('the wasm manifest has not been fetched yet');
    if (!manifest) {
        return fail('the wasm manifest `builds.json` could not be read, so no build\'s '
            + 'capabilities can be known');
    }
    const { entry, capabilities } = capabilitiesOf(manifest, buildName);
    if (!entry) {
        return fail(`the wasm manifest has no entry named ${JSON.stringify(buildName)} — the `
            + 'preset points at a build the submodule does not publish');
    }
    if (capabilities === null) {
        return fail(`build ${buildName} declares no \`capabilities\` array — an entry that `
            + 'predates the field says nothing, which is not the same as saying "none"');
    }
    if (!capabilities.includes(AP_ITEM_CAPABILITY)) {
        return fail(`build ${buildName} does not declare ${JSON.stringify(AP_ITEM_CAPABILITY)}`
            + ` (it declares ${capabilities.length === 0 ? 'nothing' : capabilities.join(', ')})`
            + ' — its `Game.as` XML loop would IGNORE every `<apitem>` and the rewritten rooms '
            + 'would show no pickup at all');
    }
    return pass(`build ${buildName} declares ${AP_ITEM_CAPABILITY}`);
}

/**
 * ── (iii) THE PLACEMENT ─────────────────────────────────────────────────
 *
 * ⛓ THE COUNT IS REPORTED EITHER WAY, and zero is the only refusal. A preset
 * that resolves SOME of the ledger is a Seedling placement with locations the
 * host does not own; those stay on the adapter's property path, which is
 * exactly H6's existing contract (`hostOwnedLocations` is a SET, not a
 * delete). Zero means the loaded rules are not a Seedling seed at all.
 */
function checkPlacement({ placement }) {
    if (placement === undefined) return unknown('the goal ledger has not been resolved yet');
    const resolved = Number(placement.resolved);
    const total = Number(placement.total);
    if (!Number.isInteger(resolved) || !Number.isInteger(total)) {
        return fail('the placement resolution did not report integer counts');
    }
    if (resolved === 0) {
        return fail(`0 of ${total} goal-ledger locations resolve against the loaded `
            + 'placement — these rules are not a Seedling placement');
    }
    return pass(`${resolved} of ${total} goal-ledger locations resolve`);
}

/** ── (iv) THE TWO DOCUMENTS THE REWRITE IS BUILT FROM ──────────────────── */
function checkAssets({ assets }) {
    if (assets === undefined) return unknown('the record set and map have not been fetched yet');
    const missing = ['recordSet', 'map']
        .filter((k) => !assets[k]?.ok)
        .map((k) => `${k} (${assets[k]?.url ?? 'no url'}${assets[k]?.source
            ? `, from ${assets[k].source}` : ''})`);
    if (missing.length > 0) {
        return fail(`the rewrite's source documents are not reachable: ${missing.join('; ')}`);
    }
    return pass(`recordSet ${assets.recordSet.url}; map ${assets.map.url} `
        + `(from ${assets.map.source})`);
}

const CHECKS = Object.freeze([
    ['transport', checkTransport],
    ['capability', checkCapability],
    ['placement', checkPlacement],
    ['assets', checkAssets],
]);

/**
 * The whole answer, from data.
 *
 * @param {object} inputs
 * @param {object|null} [inputs.flashPanel]  the preset's `flash_panel` wiring
 * @param {string} [inputs.transport]        'wasm' | 'flash' — what the panel chose
 * @param {object|null} [inputs.manifest]    the parsed `builds.json`
 * @param {{resolved: number, total: number, unresolved?: string[]}} [inputs.placement]
 * @param {{recordSet: {url: string, ok: boolean},
 *          map: {url: string, ok: boolean, source: string}}} [inputs.assets]
 * @returns {{eligible: boolean, verdict: 'eligible'|'ineligible'|'undecided',
 *           failed: string|null, why: string, checks: object[]}}
 */
export function seedlingRandomizerEligibility(inputs = {}) {
    const checks = CHECKS.map(([id, run]) => ({ id, ...run(inputs) }));
    const firstFail = checks.find((c) => c.status === 'fail');
    if (firstFail) {
        return {
            eligible: false,
            verdict: 'ineligible',
            failed: firstFail.id,
            why: `${firstFail.id}: ${firstFail.why}`,
            checks,
        };
    }
    const firstUnknown = checks.find((c) => c.status === 'unknown');
    if (firstUnknown) {
        return {
            eligible: false,
            verdict: 'undecided',
            failed: null,
            why: `${firstUnknown.id}: ${firstUnknown.why}`,
            checks,
        };
    }
    return {
        eligible: true,
        verdict: 'eligible',
        failed: null,
        why: checks.map((c) => `${c.id}: ${c.why}`).join(' · '),
        checks,
    };
}
