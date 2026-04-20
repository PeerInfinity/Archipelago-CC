/**
 * Rule Tree Editor
 *
 * Renders and mutates a Rule Builder access-rule tree. Construct with:
 *   new RuleTreeEditor(parentObj, key, nameProviders)
 * where parentObj[key] is the rule node (or null — defaults to True_).
 * nameProviders = { getItemNames, getRegionNames, getLocationNames }.
 *
 * Call .getRootElement() to attach to the DOM. The editor mutates
 * parentObj[key] in place on every edit.
 *
 * v1 supported rule types: True_, False_, Has, HasAll, HasAny, And, Or,
 * CanReachRegion, CanReachLocation, CountItem, Compare, OptionValue.
 * Any other rule type is preserved as an opaque "(raw)" node editable as JSON.
 */

const KNOWN_TYPES = [
  'True_', 'False_',
  'Has', 'HasAll', 'HasAny',
  'And', 'Or',
  'CanReachRegion', 'CanReachLocation',
  'CountItem',
  'Compare',
  'OptionValue',
];

const COMPARE_OPS = ['==', '!=', '<', '<=', '>', '>='];

const RAW_VIEW = '__raw__';

function defaultShape(ruleName) {
  const node = { rule: ruleName };
  switch (ruleName) {
    case 'True_':
    case 'False_':
      break;
    case 'Has':
      node.args = { item_name: '', count: 1 };
      break;
    case 'HasAll':
    case 'HasAny':
      node.args = { items: [] };
      break;
    case 'And':
    case 'Or':
      node.children = [];
      break;
    case 'CanReachRegion':
      node.args = { region_name: '' };
      break;
    case 'CanReachLocation':
      node.args = { location_name: '' };
      break;
    case 'CountItem':
      node.args = { item_name: '' };
      break;
    case 'Compare':
      node.args = {
        left: { rule: 'CountItem', args: { item_name: '' } },
        op: '>=',
        right: 1,
      };
      break;
    case 'OptionValue':
      node.args = { option: '' };
      break;
    default:
      break;
  }
  return node;
}

export default class RuleTreeEditor {
  constructor(parentObj, key, nameProviders = {}) {
    this.parentObj = parentObj;
    this.key = key;
    this.nameProviders = {
      getItemNames: () => [],
      getRegionNames: () => [],
      getLocationNames: () => [],
      ...nameProviders,
    };

    // Per-node toggle for raw-JSON view. Intentionally held outside the data
    // so it doesn't round-trip into the exported rules.json.
    this._rawViewNodes = new WeakSet();

    this.rootElement = document.createElement('div');
    Object.assign(this.rootElement.style, {
      marginTop: '4px',
    });

    this._render();
  }

  getRootElement() {
    return this.rootElement;
  }

  _render() {
    this.rootElement.innerHTML = '';
    if (this.parentObj[this.key] == null) {
      this.parentObj[this.key] = { rule: 'True_' };
    }
    this.rootElement.appendChild(this._renderNode(this.parentObj[this.key], {
      isRoot: true,
      replace: (newNode) => { this.parentObj[this.key] = newNode; },
      remove: () => { this.parentObj[this.key] = { rule: 'True_' }; },
    }));
  }

  _renderNode(node, ctx) {
    const block = document.createElement('div');
    Object.assign(block.style, {
      border: '1px solid #2a2a2a',
      borderRadius: '3px',
      padding: '3px 5px',
      marginTop: '3px',
      backgroundColor: '#161616',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '6px',
    });

    if (!KNOWN_TYPES.includes(node.rule) && !this._rawViewNodes.has(node)) {
      this._rawViewNodes.add(node);
    }
    const inRawView = this._rawViewNodes.has(node);
    const typeSelect = this._makeTypeSelect(node.rule, inRawView);
    typeSelect.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value === RAW_VIEW) {
        this._rawViewNodes.add(node);
      } else {
        this._rawViewNodes.delete(node);
        this._changeRuleType(node, value);
      }
      this._render();
    });
    header.appendChild(typeSelect);

    if (!inRawView) {
      const fields = this._renderFields(node);
      if (fields) header.appendChild(fields);
    }

    const spacer = document.createElement('span');
    spacer.style.flex = '1 1 auto';
    header.appendChild(spacer);

    if (!inRawView && (node.rule === 'And' || node.rule === 'Or')) {
      header.appendChild(this._makeButton('+ child', '#3a3a3a', () => {
        if (!node.children) node.children = [];
        node.children.push({ rule: 'True_' });
        this._render();
      }));
    }

    header.appendChild(this._makeButton('⇪ And', '#2f4858', () => {
      ctx.replace({ rule: 'And', children: [node] });
      this._render();
    }, 'Wrap this node in an And'));
    header.appendChild(this._makeButton('⇪ Or', '#2f4858', () => {
      ctx.replace({ rule: 'Or', children: [node] });
      this._render();
    }, 'Wrap this node in an Or'));

    if (ctx.isRoot) {
      header.appendChild(this._makeButton('reset', '#8a2a2a', () => {
        ctx.remove();
        this._render();
      }, 'Reset access rule to True_'));
    } else {
      header.appendChild(this._makeButton('×', '#8a2a2a', () => {
        ctx.remove();
        this._render();
      }, 'Delete this rule'));
    }

    block.appendChild(header);

    if (inRawView) {
      block.appendChild(this._renderRawBlock(node));
    } else if (node.rule === 'And' || node.rule === 'Or') {
      const childrenWrap = document.createElement('div');
      childrenWrap.style.marginLeft = '16px';
      const children = node.children || (node.children = []);
      children.forEach((child, idx) => {
        const childCtx = {
          isRoot: false,
          replace: (newNode) => { children[idx] = newNode; },
          remove: () => { children.splice(idx, 1); },
        };
        childrenWrap.appendChild(this._renderNode(child, childCtx));
      });
      block.appendChild(childrenWrap);
    }

    return block;
  }

  _changeRuleType(node, newType) {
    delete node.args;
    delete node.children;
    const shape = defaultShape(newType);
    node.rule = newType;
    if (shape.args) node.args = shape.args;
    if (shape.children) node.children = shape.children;
  }

  _renderFields(node) {
    switch (node.rule) {
      case 'True_':
      case 'False_':
        return null;
      case 'And':
      case 'Or':
        return this._label(`(${(node.children || []).length} children)`);
      case 'Has':
        return this._hasFields(node);
      case 'HasAll':
      case 'HasAny':
        return this._hasListFields(node);
      case 'CanReachRegion':
        return this._regionField(node);
      case 'CanReachLocation':
        return this._locationField(node);
      case 'CountItem':
        return this._countItemFields(node);
      case 'Compare':
        return this._compareFields(node);
      case 'OptionValue':
        return this._optionField(node);
      default:
        // Unknown types are shown in raw-view mode (handled in _renderNode).
        return null;
    }
  }

  // ---------- Field renderers ----------

  _hasFields(node) {
    const args = node.args || (node.args = { item_name: '', count: 1 });
    const wrap = this._fieldRow();
    wrap.appendChild(this._label('item:'));
    const itemInput = this._makeItemInput(args.item_name || '');
    itemInput.addEventListener('input', (e) => { args.item_name = e.target.value; });
    wrap.appendChild(itemInput);
    wrap.appendChild(this._label('count:'));
    const countInput = this._makeNumberInput(args.count == null ? 1 : args.count, '60px');
    countInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      args.count = Number.isFinite(v) ? v : 1;
    });
    wrap.appendChild(countInput);
    return wrap;
  }

  _hasListFields(node) {
    const args = node.args || (node.args = { items: [] });
    if (!Array.isArray(args.items)) args.items = [];
    const wrap = this._fieldRow();
    wrap.style.alignItems = 'flex-start';
    wrap.appendChild(this._label('items:'));

    const listWrap = document.createElement('div');
    listWrap.style.display = 'flex';
    listWrap.style.flexDirection = 'column';
    listWrap.style.gap = '2px';

    args.items.forEach((itemName, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '4px';
      const input = this._makeItemInput(itemName);
      input.addEventListener('input', (e) => { args.items[idx] = e.target.value; });
      row.appendChild(input);
      const rm = this._makeButton('×', '#8a2a2a', () => {
        args.items.splice(idx, 1);
        this._render();
      });
      rm.style.padding = '1px 6px';
      row.appendChild(rm);
      listWrap.appendChild(row);
    });

    const addBtn = this._makeButton('+ item', '#3a3a3a', () => {
      args.items.push('');
      this._render();
    });
    addBtn.style.alignSelf = 'flex-start';
    addBtn.style.marginTop = '2px';
    listWrap.appendChild(addBtn);

    wrap.appendChild(listWrap);
    return wrap;
  }

  _regionField(node) {
    const args = node.args || (node.args = { region_name: '' });
    const wrap = this._fieldRow();
    wrap.appendChild(this._label('region:'));
    const names = this.nameProviders.getRegionNames();
    const select = this._makeNameSelect(args.region_name || '', names, '(select region)', 'missing');
    select.addEventListener('change', (e) => { args.region_name = e.target.value; });
    wrap.appendChild(select);
    return wrap;
  }

  _locationField(node) {
    const args = node.args || (node.args = { location_name: '' });
    const wrap = this._fieldRow();
    wrap.appendChild(this._label('location:'));
    const names = this.nameProviders.getLocationNames();
    const select = this._makeNameSelect(args.location_name || '', names, '(select location)', 'missing');
    select.addEventListener('change', (e) => { args.location_name = e.target.value; });
    wrap.appendChild(select);
    return wrap;
  }

  _countItemFields(node) {
    const args = node.args || (node.args = { item_name: '' });
    const wrap = this._fieldRow();
    wrap.appendChild(this._label('item:'));
    const itemInput = this._makeItemInput(args.item_name || '');
    itemInput.addEventListener('input', (e) => { args.item_name = e.target.value; });
    wrap.appendChild(itemInput);
    return wrap;
  }

  _compareFields(node) {
    const args = node.args || (node.args = {
      left: { rule: 'CountItem', args: { item_name: '' } },
      op: '>=',
      right: 1,
    });
    if (!args.left || typeof args.left !== 'object') {
      args.left = { rule: 'CountItem', args: { item_name: '' } };
    }

    const outer = document.createElement('div');
    outer.style.flex = '1 1 auto';
    outer.style.display = 'flex';
    outer.style.flexDirection = 'column';
    outer.style.gap = '3px';

    // Left: nested rule tree
    const leftRow = document.createElement('div');
    leftRow.style.display = 'flex';
    leftRow.style.alignItems = 'flex-start';
    leftRow.style.gap = '4px';
    leftRow.appendChild(this._label('left:'));
    const leftHost = document.createElement('div');
    leftHost.style.flex = '1 1 auto';
    const leftCtx = {
      isRoot: false,
      replace: (newNode) => { args.left = newNode; },
      remove: () => { args.left = { rule: 'CountItem', args: { item_name: '' } }; this._render(); },
    };
    leftHost.appendChild(this._renderNode(args.left, leftCtx));
    leftRow.appendChild(leftHost);
    outer.appendChild(leftRow);

    // Op + Right
    const opRow = document.createElement('div');
    opRow.style.display = 'flex';
    opRow.style.alignItems = 'center';
    opRow.style.gap = '6px';
    opRow.appendChild(this._label('op:'));
    const opSelect = document.createElement('select');
    for (const op of COMPARE_OPS) {
      const o = document.createElement('option');
      o.value = op;
      o.textContent = op;
      opSelect.appendChild(o);
    }
    opSelect.value = COMPARE_OPS.includes(args.op) ? args.op : '>=';
    this._styleInput(opSelect);
    opSelect.addEventListener('change', (e) => { args.op = e.target.value; });
    opRow.appendChild(opSelect);

    opRow.appendChild(this._label('right:'));
    const rightIsRule = args.right && typeof args.right === 'object';
    const rightModeSelect = document.createElement('select');
    for (const [v, label] of [['number', 'number'], ['rule', 'rule']]) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      rightModeSelect.appendChild(o);
    }
    rightModeSelect.value = rightIsRule ? 'rule' : 'number';
    this._styleInput(rightModeSelect);
    rightModeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'number') {
        args.right = typeof args.right === 'number' ? args.right : 1;
      } else {
        args.right = { rule: 'CountItem', args: { item_name: '' } };
      }
      this._render();
    });
    opRow.appendChild(rightModeSelect);

    if (!rightIsRule) {
      const num = this._makeNumberInput(
        typeof args.right === 'number' ? args.right : 1,
        '80px',
      );
      num.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        args.right = Number.isFinite(v) ? v : 0;
      });
      opRow.appendChild(num);
    }
    outer.appendChild(opRow);

    if (rightIsRule) {
      const rightWrap = document.createElement('div');
      rightWrap.style.marginLeft = '16px';
      rightWrap.appendChild(this._renderNode(args.right, {
        isRoot: false,
        replace: (newNode) => { args.right = newNode; },
        remove: () => { args.right = 1; this._render(); },
      }));
      outer.appendChild(rightWrap);
    }

    return outer;
  }

  _optionField(node) {
    const args = node.args || (node.args = { option: '' });
    const wrap = this._fieldRow();
    wrap.appendChild(this._label('option:'));
    const input = this._makeTextInput(args.option || '', '200px');
    input.addEventListener('input', (e) => { args.option = e.target.value; });
    wrap.appendChild(input);
    return wrap;
  }

  _renderRawBlock(node) {
    const ta = document.createElement('textarea');
    Object.assign(ta.style, {
      display: 'block',
      width: '100%',
      boxSizing: 'border-box',
      minHeight: '120px',
      marginTop: '4px',
      fontFamily: 'monospace',
      fontSize: '12px',
      backgroundColor: '#111',
      color: '#ddd',
      border: '1px solid #333',
      borderRadius: '2px',
      padding: '4px 6px',
      resize: 'vertical',
    });
    const view = { rule: node.rule };
    if (node.args !== undefined) view.args = node.args;
    if (node.children !== undefined) view.children = node.children;
    // Copy any other keys the user may have (e.g., metadata).
    for (const k of Object.keys(node)) {
      if (!(k in view)) view[k] = node[k];
    }
    ta.value = JSON.stringify(view, null, 2);
    ta.addEventListener('input', () => {
      try {
        const parsed = JSON.parse(ta.value);
        if (!parsed || typeof parsed !== 'object' || typeof parsed.rule !== 'string') {
          throw new Error('Must be an object with a "rule" string field');
        }
        for (const k of Object.keys(node)) delete node[k];
        Object.assign(node, parsed);
        ta.style.borderColor = '#333';
        ta.title = '';
      } catch (e) {
        ta.style.borderColor = '#c44';
        ta.title = `Parse error: ${e.message}`;
      }
    });
    return ta;
  }

  // ---------- DOM helpers ----------

  _fieldRow() {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '4px';
    row.style.flexWrap = 'wrap';
    return row;
  }

  _label(text) {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.color = '#888';
    span.style.fontSize = '11px';
    return span;
  }

  _makeButton(label, bg, onClick, title) {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      padding: '1px 6px',
      backgroundColor: bg,
      color: '#fff',
      border: '1px solid #555',
      borderRadius: '2px',
      cursor: 'pointer',
      fontSize: '11px',
    });
    if (title) btn.title = title;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _makeTypeSelect(currentType, inRawView) {
    const select = document.createElement('select');
    this._styleInput(select);
    const all = KNOWN_TYPES.slice();
    if (!all.includes(currentType)) all.push(currentType);
    for (const t of all) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = KNOWN_TYPES.includes(t) ? t : `${t} (unknown)`;
      select.appendChild(opt);
    }
    const rawOpt = document.createElement('option');
    rawOpt.value = RAW_VIEW;
    rawOpt.textContent = '(raw JSON)';
    select.appendChild(rawOpt);
    select.value = inRawView ? RAW_VIEW : currentType;
    return select;
  }

  _makeNameSelect(currentValue, names, placeholder, danglingSuffix) {
    const select = document.createElement('select');
    this._styleInput(select);
    select.style.minWidth = '160px';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder;
    select.appendChild(ph);
    const known = new Set(names);
    if (currentValue && !known.has(currentValue)) {
      const missing = document.createElement('option');
      missing.value = currentValue;
      missing.textContent = `${currentValue} (${danglingSuffix})`;
      missing.style.color = '#c44';
      select.appendChild(missing);
    }
    for (const n of names) {
      const o = document.createElement('option');
      o.value = n;
      o.textContent = n;
      select.appendChild(o);
    }
    select.value = currentValue || '';
    return select;
  }

  _makeItemInput(currentValue) {
    // Free-text input backed by a shared datalist of known item names. This
    // lets users reference items that haven't been defined yet.
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.style.minWidth = '160px';
    this._styleInput(input);
    const listId = this._ensureItemDatalist();
    if (listId) input.setAttribute('list', listId);
    return input;
  }

  _ensureItemDatalist() {
    const names = this.nameProviders.getItemNames();
    if (!names.length) return null;
    if (!this._itemDatalistId) {
      this._itemDatalistId = `rte-items-${Math.random().toString(36).slice(2, 10)}`;
    }
    let datalist = this.rootElement.querySelector(`#${this._itemDatalistId}`);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = this._itemDatalistId;
      this.rootElement.appendChild(datalist);
    } else {
      datalist.innerHTML = '';
    }
    for (const n of names) {
      const o = document.createElement('option');
      o.value = n;
      datalist.appendChild(o);
    }
    return this._itemDatalistId;
  }

  _makeTextInput(currentValue, width) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    if (width) input.style.width = width;
    this._styleInput(input);
    return input;
  }

  _makeNumberInput(currentValue, width) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = currentValue;
    if (width) input.style.width = width;
    this._styleInput(input);
    return input;
  }

  _styleInput(el) {
    Object.assign(el.style, {
      padding: '1px 4px',
      backgroundColor: '#111',
      color: '#ddd',
      border: '1px solid #333',
      borderRadius: '2px',
      fontSize: '11px',
    });
  }
}
