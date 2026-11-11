# textLibrary

**Strings and word lists by key, for any substrate.** It reads the `text` layer of a content-pack stack
(`../contentPacks/`), merged so that a later pack wins per key.

- `createTextLibrary(stack)` answers five questions:
  - `has(key)`: does any pack in the stack carry this key, as a string or a list?
  - `string(key)`: the string (prose, a name), or null. A list key also answers null.
  - `list(key)`: the word list, as a frozen array, or null. A string key also answers null.
  - `fill(template, vars)`: the template with its `{name}` placeholders replaced from `vars`.
  - `keys()`: every key, strings first and then lists, each in stack order and then declaration order.
  - `packOf(key)` names the pack the winning value came from.
- **A key is a string or a list across the whole merged stack, never both.** A later pack cannot change a key's
  shape, because every caller that asked for the other shape would break.
- `fillTemplate(template, vars)` is the same function as `fill`, exported on its own.
- DOM-free: it takes a loaded stack (`loadPackStack`'s result), as `createArtLibrary` does.

## `fill` and the text adventure's templating

`fill` follows `processMessageTemplate` in `../textAdventureSubstrateWrapper/templating.js`:

- A placeholder whose value is missing (`undefined` or `null`) is left as written.
- A template that is not a string fills to `''`.

It differs in three ways, on purpose:

- It does not HTML-escape a value. This library is DOM-free; escaping belongs to the renderer.
- It has no `wasUnchecked` highlight.
- It substitutes in one pass, so a value that itself contains `{name}` is not filled again. `processMessageTemplate`
  replaces one variable at a time, so a later variable can fill a placeholder that an earlier value introduced.

The test pins the plain cases equal to `processMessageTemplate`, and pins the differences.

## Text manifest

The manifest is `text/manifest.json` inside a pack:

```jsonc
{ "schema_version": 1,
  "strings": { "meta:narrator/greeting": "You again. {item} is where it always is." },
  "lists":   { "meta:names/room-adjective": ["Unfinished", "Placeholder"] } }
```

Both tables are optional. A pack concept (`../packConcepts/`) names its text by these keys.

## ⛔ Refusal by name

Each of these throws a `ContentPackError` that names the pack, the key and the field:

- an unknown `schema_version`;
- an unknown field on the manifest;
- a `strings` or `lists` table that is not an object;
- a key that is not namespaced (`<namespace>:<path>`);
- a `strings` value that is not a string;
- a `lists` value that is not a non-empty array of strings;
- a key that is in `strings` and in `lists`, in one pack or across the stack.
