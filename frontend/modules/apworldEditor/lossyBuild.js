/**
 * apworldEditor/lossyBuild — **THE `.APWORLD` BUILD'S LOSSY TOGGLE** (rule-node R2c).
 *
 * `world_generator` is strict by default (⚖ D3, rule-node-registry): a rule kind
 * or a helper name it has no codegen for is an error naming it and the game. On
 * the command line `--lossy` instead emits an always-true placeholder for each
 * one and lists them. This is the same switch for the hub's `⭳ .apworld` button:
 * OFF by default, persisted as a module setting, and when ON the build's record
 * (every placeholder, by `<site>:<kind>`, with its count) is SHOWN beside the
 * toolbar — a lossy world is never built silently.
 */

import { describeLossyRecord } from '../apworldBuild/apworldBuild.js';

/** ⛓ The setting's key and full path (read at each `.apworld` press, mirrored by the checkbox). */
export const LOSSY_BUILD_KEY = 'apworldBuildLossy';
export const LOSSY_BUILD_SETTING = `moduleSettings.apworldEditor.${LOSSY_BUILD_KEY}`;

/** ⛓ OFF: strict stays the default (⚖ D3). */
export const LOSSY_BUILD_DEFAULT = false;

/** ⛓ The schema property `apworldEditor/index.js` registers beside the others. */
export const LOSSY_BUILD_SCHEMA = Object.freeze({
    type: 'boolean',
    default: LOSSY_BUILD_DEFAULT,
    label: 'Build .apworld in lossy mode',
    description: 'When on, the APWorld Editor\'s .apworld build replaces every rule kind or helper name '
        + 'world_generator has no codegen for with an always-true placeholder (world_generator --lossy) '
        + 'instead of failing, and lists each placeholder after the build. Off (the default) fails '
        + 'naming the first one.',
});

/** ⛓ What a stored value means: only `true` is ON. */
export function lossyBuildOn(value) {
    return value === true;
}

/** ⛓ True when a strict build's error is the one lossy mode would have turned into a placeholder. */
export function isLossyRefusal(message) {
    return /generate with --lossy/.test(String(message ?? ''));
}

/**
 * The record as the panel shows it: a heading line and one line per entry.
 * `{ total, heading, lines }`; a lossy build that replaced nothing says so.
 */
export function lossyRecordView(record) {
    const { total, entries } = describeLossyRecord(record);
    const names = entries.length;
    const heading = total === 0
        ? 'Lossy build: nothing was replaced — the world is the same as a strict build.'
        : `Lossy build: ${total} always-true placeholder${total === 1 ? '' : 's'} for `
          + `${names} rule kind${names === 1 ? '' : 's'} or helper name${names === 1 ? '' : 's'} `
          + 'with no codegen. The locations and exits they guard are FREE in this world.';
    return { total, heading, lines: entries.map(e => `${e.name} ×${e.count}`) };
}
