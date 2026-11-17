/**
 * packStructure/packResolver — **THE RESOLVER: (substrate, the three settings) → ONE RESOLVED DOCUMENT + A GAP
 * REPORT** (⛓ CONTENT SETS PL-2; Z.5 and Z.6, ⚖ the user 2026-11-15 Z1–Z8).
 *
 *     resolveContent(substrateId, { exists, content, numbers, numbersMode }, { base, readJson, registry })
 *       → Promise<{ document, report, stacks: { exists, words, numbers } }>
 *
 * The settings are the world's, as `procgen_metadata[p]` records them (each absent when it is the default):
 *
 *   exists       the packs whose `structure` (and `bindings`) are added together; default: the substrate's
 *                `defaultContentPack` (`worldContent.effectiveExists`)
 *   content      the words stack: the substrate's default pack, then the `exists` packs' own `concepts` and `text`,
 *                then the named themes; later wins (`worldContent.effectiveContentStack`, the one rule)
 *   numbers      a stack of packs, later wins per value path, on top of each `exists` pack's own set for this
 *                substrate. A named pack with no set for this substrate over the world's `exists` is REFUSED BY NAME
 *   numbersMode  `table` (absent ALWAYS means table, ⚖ planner 2026-11-15): the stack as written; a missing number
 *                is filled by rule and listed. `assign`: a substrate's walk assigns over the table (Z7/Z8). No
 *                substrate declares `numbersWalk` yet, so `assign` is REFUSED BY NAME; no walk is built here
 *
 * The DOCUMENT is the substrate's resolved form, built by its ASSEMBLER (`DOCUMENT_ASSEMBLERS`): for ActionNodes the
 * graph document of its design §1 (`actionNodesAssembly.js`), which its compiler takes unchanged. A substrate with
 * no assembler resolves its stacks only (`document: null`): its words are read where they are today
 * (`loadContentSet`), and the resolver adds the gap report.
 *
 * The REPORT is Z.6's shape: `{ substrate, exists, numbers, numbersMode, filled, flattened, unused, unnamed }`;
 * each row names its rule as `<id>@<version>` (`procgenCore/fillRules.js`). W1 (a structure entry no word presents)
 * is listed for every substrate.
 *
 * Pure apart from the pack reads (`{ base, readJson }`, as `loadPackStack`). DOM-free.
 */
import { loadPackStack } from '../contentPacks/contentPacks.js';
import { ContentPackError } from '../contentPacks/contentPackError.js';
import { createPackConcepts } from '../packConcepts/packConcepts.js';
import { fillRulesOf, ruleTag } from '../procgenCore/fillRules.js';
import {
    ABSENT_NUMBERS_MODE, NUMBERS_WALK_FIELD, RECORDED_EXISTS_KEY, RECORDED_NUMBERS_KEY, assertNumbersMode,
    assertPackListParam, contentListOf, effectiveContentStack, effectiveExists,
} from '../procgenPipeline/worldContent.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { ACTION_NODES_ID, assembleActionGraph } from './actionNodesAssembly.js';
import { createNumbers, numbersSelectionRefusal } from './packNumbers.js';
import { assertPresentsStructure, createStructure } from './packStructure.js';

/** The substrates whose resolved document the resolver builds, and how. */
export const DOCUMENT_ASSEMBLERS = Object.freeze({ [ACTION_NODES_ID]: assembleActionGraph });

/**
 * ⛓ Z8 — **WHICH SUBSTRATE WOULD GET THE FIRST WALK.** `assign` names this in its refusal. ActionNodes is the one
 * substrate whose numbers the resolver assembles from a pack; its exact one-loop search can CHECK a set of numbers
 * but not yet assign them (Z7's reading), and Z8 left "an assigning walk for ActionNodes" undecided.
 */
export const FIRST_WALK_CANDIDATE = ACTION_NODES_ID;

const fail = (m) => { throw new ContentPackError(`resolve: ${m}`); };

/** The empty gap report for a substrate and its settings (Z.6's shape). */
export function emptyGapReport(substrateId, { exists = [], numbers = [], numbersMode = ABSENT_NUMBERS_MODE } = {}) {
    return { substrate: substrateId, exists: [...exists], numbers: [...numbers], numbersMode, filled: [], flattened: [], unused: [], unnamed: [] };
}

/**
 * The `assign` refusal, or null in `table` mode. A substrate with no `numbersWalk` is refused by name; one that
 * declares a walk is refused too, because the resolver has no walk to run yet (none is built: Z8).
 */
export function numbersModeRefusalFor(entry, mode) {
    if (mode !== 'assign') return null;
    if (entry?.[NUMBERS_WALK_FIELD] !== true) {
        return `numbersMode "assign": substrate "${entry?.id}" declares no ${NUMBERS_WALK_FIELD}, so nothing can assign its `
            + `numbers (no substrate declares one yet; the first walk would be ${FIRST_WALK_CANDIDATE}'s). Use "table"`;
    }
    return `numbersMode "assign": substrate "${entry.id}" declares ${NUMBERS_WALK_FIELD}, and the resolver has no walk to run for it (none is built)`;
}

/**
 * ⛓⛓ **RESOLVE** — load the stacks, then `resolveLoaded`. `io` is `{ base, readJson }`; `registry` is injectable.
 */
export async function resolveContent(substrateId, settings = {}, { base, readJson, registry = substrateRegistry } = {}) {
    const entry = registry.get(substrateId);
    if (!entry) fail(`no substrate "${substrateId}" in the registry`);
    const mode = assertNumbersMode(settings.numbersMode, 'settings') ?? ABSENT_NUMBERS_MODE;
    const refusal = numbersModeRefusalFor(entry, mode);
    if (refusal) fail(refusal);
    const substrateIds = [substrateId];
    const ownExists = assertPackListParam(RECORDED_EXISTS_KEY, contentListOf(settings.exists) ?? []);
    const exists = effectiveExists({ substrateIds, exists: ownExists, registry });
    const words = effectiveContentStack({ substrateIds, exists: ownExists, content: contentListOf(settings.content) ?? [], registry });
    const named = assertPackListParam(RECORDED_NUMBERS_KEY, contentListOf(settings.numbers) ?? []);
    const io = { base, readJson };

    const existsLoaded = exists.length ? await loadPackStack(exists, { ...io, only: ['structure', 'bindings', 'numbers'] }) : [];
    const wordsLoaded = words.length ? await loadPackStack(words, { ...io, only: ['concepts', 'text'] }) : [];
    // The numbers stack: each exists pack's own set for this substrate (when it has one), then the named packs.
    const ownNumbers = existsLoaded.filter((p) => p.layers.numbers && !numbersSelectionRefusal(p, { substrateIds, exists }));
    const namedLoaded = named.length ? await loadPackStack(named, { ...io, only: ['numbers'] }) : [];
    for (const p of namedLoaded) {
        const why = numbersSelectionRefusal(p, { substrateIds, exists });
        if (why) fail(why);
    }
    const numbersStack = [...ownNumbers, ...namedLoaded.filter((p) => !ownNumbers.some((o) => o.id === p.id))];
    return resolveLoaded(substrateId, { exists, numbers: named, numbersMode: mode }, {
        existsLoaded, wordsLoaded, numbersStack, registry, words,
    });
}

/**
 * ⛓ **THE SYNCHRONOUS CORE** over loaded stacks: the structure of `existsLoaded`, the words of `wordsLoaded`, the
 * numbers of `numbersStack` (later wins), the substrate's rules (`fillRulesOf`). Returns
 * `{ document, report, stacks }`.
 */
export function resolveLoaded(substrateId, { exists, numbers = [], numbersMode = ABSENT_NUMBERS_MODE },
    { existsLoaded = [], wordsLoaded = [], numbersStack = [], registry = substrateRegistry, words = wordsLoaded.map((p) => p.id) } = {}) {
    const entry = registry.get(substrateId);
    if (!entry) fail(`no substrate "${substrateId}" in the registry`);
    const rules = fillRulesOf(entry, substrateId);
    const structure = createStructure(existsLoaded);
    const concepts = createPackConcepts(wordsLoaded);
    assertPresentsStructure(concepts, structure);
    const numbersReader = createNumbers(numbersStack);
    const allSets = createNumbers(existsLoaded);
    const report = emptyGapReport(substrateId, { exists, numbers, numbersMode });

    const assemble = DOCUMENT_ASSEMBLERS[substrateId];
    let document = null;
    if (assemble) {
        if (!structure.keys().length) fail(`substrate "${substrateId}" resolves a document from structure, and the exists packs [${exists.join(', ')}] hold none`);
        document = assemble({
            exists, structure, words: concepts, rules, report, allSets,
            numbersOf: (pack) => numbersReader.set(substrateId, pack),
        });
    } else {
        // W1 for a substrate with no document: every structure entry no word presents.
        for (const key of structure.keys()) {
            if (!concepts.presenting(key) && rules.includes('W1')) report.unnamed.push({ entry: key, rule: ruleTag('W1') });
        }
    }
    return {
        document,
        report,
        stacks: { exists: [...exists], words: [...words], numbers: numbersStack.map((p) => p.id) },
    };
}
