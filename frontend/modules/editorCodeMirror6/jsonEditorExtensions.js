/**
 * editorCodeMirror6/jsonEditorExtensions — **THE ONE EXTENSION LIST EVERY RAW
 * JSON EDITOR IN THIS APP MOUNTS** (APWORLD EDITOR HUB slice H2b).
 *
 * ⛓⛓⛓ There are TWO raw-JSON editors now — the `editorCodeMirror6` panel and
 * the APWorld hub's Raw JSON tab — and the kickoff's rule for the second one is
 * *"reuse the same extensions list so the two raw editors look identical; do
 * NOT fork a second extension list"*. A copied array would drift on the first
 * theme change and nothing would notice: two editors over the same bytes, one
 * with folding and one without, is a defect no test asserts because each half
 * is internally consistent. So the list lives HERE and both callers build from
 * it.
 *
 * ⛔ What a caller may vary is exactly two things, and they are the two things
 * that genuinely differ: the keys it binds on top (each panel's own
 * "commit this text" gesture) and what it does when the document changes. The
 * LOOK — line numbers, folding, `oneDark`, the JSON grammar, wrapping — is not
 * a parameter, because "identical" is the requirement.
 *
 * ⚠ `codeMirror6UI.js` used to build this array inline and it imported
 * `basicSetup`, `Compartment`, `foldKeymap`'s siblings and declared a
 * `readOnlyCompartment` / `themeCompartment` pair it never put in the list.
 * Measured at H2b: `basicSetup` and both compartments were DEAD (`grep -n` — the
 * compartments are constructed and never `.of()`'d, never reconfigured). They
 * are not carried here; a compartment nothing reconfigures is documentation of
 * an intention, not a mechanism, and this module would have inherited the
 * confusion. (The measurement instrument mounts `basicSetup` because it is a
 * throwaway probe with no panel around it — that is why its numbers and this
 * list are not the same extensions, and why H2b re-ran the measurement against
 * the REAL mounted editor.)
 */
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  json,
  foldGutter,
  foldKeymap,
  oneDark,
  defaultKeymap,
  history,
  historyKeymap,
  searchKeymap,
  highlightSelectionMatches,
} from './codemirror6Imports.js';

/**
 * ⛓ Build the shared list.
 *
 * @param {object} [options]
 * @param {Array<{key: string, run: Function}>} [options.keys] extra key
 *   bindings, placed BEFORE the default keymap so a panel's own gesture wins.
 * @param {(update: object) => void} [options.onDocChanged] called on every
 *   update whose `docChanged` is true. ⛔ It is handed the UPDATE, not the
 *   text: `update.state.doc.toString()` on a 3 MB document is a 3 MB string
 *   allocation, and a listener that does it per keystroke turns a flat editor
 *   back into a quadratic one. The hub's listener reads `doc.length` (O(1)) and
 *   materialises the text once, at save.
 * @returns {Array} the extensions, in precedence order.
 */
export function jsonEditorExtensions({ keys = [], onDocChanged = null } = {}) {
  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    drawSelection(),
    history(),
    foldGutter(),
    json(),
    oneDark,
  ];
  if (keys.length > 0) extensions.push(keymap.of(keys));
  extensions.push(
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...searchKeymap,
    ]),
    highlightSelectionMatches(),
  );
  if (onDocChanged) {
    extensions.push(EditorView.updateListener.of((update) => {
      if (update.docChanged) onDocChanged(update);
    }));
  }
  extensions.push(
    EditorView.lineWrapping,
    // Make editor fill its container.
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto' },
    }),
  );
  return extensions;
}

export default jsonEditorExtensions;
