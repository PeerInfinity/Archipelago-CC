/**
 * flashPanel/seedlingContactSettings — ⛓ CONTACT HOOK (slice `seedling-js-contact-hook`, ⚖ the user 2026-10-11;
 * fidelity BULB's "What to wire", relayed by `seedling-js-planning-4`). The Seedling model's contact switches
 * (`seedlingDemo/contactFidelity.js`) as flashPanel settings, the KILLLOCK hook's pattern
 * (`seedlingKillLockSettings.js`): one boolean per switch, `flashPanel.seedlingContact<Key>`, whose schema default IS
 * `CONTACT_FIDELITY_DEFAULTS`. The key list is `CONTACT_FIDELITY_KEYS` itself, so a switch fidelity adds later has a
 * setting without an edit here.
 *
 * Where the set goes: the panel's own module instance (`applyContactFidelity` — the wasm engine's host-side solves),
 * the JS runtime page (`?contactFidelity=`, see `jsRuntimePage.js`) and every solve worker (the request's
 * `contactFidelity` stamp, off-default only).
 */
import { CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, formatContactFidelity, isDefaultContactFidelity }
    from '../seedlingDemo/contactFidelity.js';

/** switch key → the flashPanel setting prop (`bulbLive` → `seedlingContactBulbLive`). */
export const contactSettingProp = (key) => `seedlingContact${key[0].toUpperCase()}${key.slice(1)}`;

/** switch key → the full settings key. */
export const CONTACT_SETTING_KEYS = Object.freeze(Object.fromEntries(CONTACT_FIDELITY_KEYS.map((k) =>
    [k, `moduleSettings.flashPanel.${contactSettingProp(k)}`])));

/** The schema props, one boolean per switch, defaulted to `CONTACT_FIDELITY_DEFAULTS`. */
export function contactSchemaProps() {
    return Object.fromEntries(CONTACT_FIDELITY_KEYS.map((k) => [contactSettingProp(k), {
        type: 'boolean',
        default: CONTACT_FIDELITY_DEFAULTS[k],
        label: `Seedling model: contact switch ${k}`,
        description: `The model's contact-fidelity switch \`${k}\` (seedlingDemo/contactFidelity.js has what it `
            + 'transcribes and the game rows that measured it). Both runtimes, the Playback Bot\'s solver (and the JS '
            + 'runtime\'s own model). A set other than the defaults is stamped on every solve request and plan, so a '
            + 'plan made with it is labelled; changing it re-mounts the JS runtime page (a run played under one set '
            + 'cannot be replayed under another). Leave the defaults unless you are measuring the model.',
    }]));
}

/** The `contactFidelity=` query parameter for the JS runtime page: '' at the defaults (today's URL exactly). */
export function contactPageParam(set) {
    return isDefaultContactFidelity(set) ? '' : `contactFidelity=${encodeURIComponent(formatContactFidelity(set))}`;
}
