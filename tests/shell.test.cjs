'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/shell.js'), 'utf8');

// Exercise the real shell handlers with document-picker inputs and storage quota.
// The reader/RPG fixtures follow their shared restoration guard and emulate the
// extra pagehide handlers that normally save in-memory state before a reload.
function fixture(initial = {}, quota = Infinity, nativeExport = false) {
  const values = new Map(Object.entries(initial));
  const events = new Map(), handlers = {}, messages = [], exports = [];
  let nativeSaveCalls = 0;
  const oldReader = initial.sf2_state ?? '{"points":0}';
  const oldRpg = initial.sf_nerakar_rpg_v2 ?? '{"state":"old"}';
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    removeItem: (key) => values.delete(key),
    setItem(key, value) {
      const text = String(value);
      const size = [...values].reduce((total, [other, saved]) => total + (other === key ? 0 : saved.length), 0) + text.length;
      if (size > quota) throw new Error('QuotaExceededError');
      values.set(key, text);
    },
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
  };
  const nodes = {
    '#profile': { append(node) { nodes['#progressBackup'] = node; } },
    '#exportProgress': { addEventListener(kind, handler) { handlers.export = handler; } },
    '#importProgress': { addEventListener(kind, handler) { handlers.import = handler; } },
  };
  const window = {
    SinapseNativeLifecycle: { save() { nativeSaveCalls++; } },
    addEventListener(kind, handler) {
      if (!events.has(kind)) events.set(kind, []);
      events.get(kind).push(handler);
    },
    SinapseApp: {
      save() { if (!window.SinapseRestoring) storage.setItem('sf2_state', oldReader); },
      toast(message) { messages.push(message); },
    },
    NerakarRPG: {
      save() { if (!window.SinapseRestoring) storage.setItem('sf_nerakar_rpg_v2', oldRpg); },
      init() {},
    },
  };
  if (nativeExport) window.AndroidContent = { exportBackup(json) { exports.push(JSON.parse(json)); } };
  window.addEventListener('pagehide', () => window.SinapseApp.save());
  window.addEventListener('pagehide', () => window.NerakarRPG.save());
  const document = {
    querySelector: (selector) => nodes[selector] ?? null,
    addEventListener() {},
    createElement: () => ({}),
  };
  let reloaded = false;
  const location = {
    reload() {
      reloaded = true;
      for (const handler of events.get('pagehide') ?? []) handler();
    },
  };
  vm.runInNewContext(source, { window, document, localStorage: storage, location, setTimeout, clearTimeout });
  return {
    window, values, storage, handlers, messages, exports,
    get reloaded() { return reloaded; },
    get nativeSaveCalls() { return nativeSaveCalls; },
    async restore(backup) {
      const text = JSON.stringify(backup);
      await handlers.import({ target: { files: [{ size: Buffer.byteLength(text), text: async () => text }] } });
    },
  };
}

const backup = (values) => ({ format: 'sinapse-final-progress', version: 1, values });

test('restoration survives pagehide without stale reader/RPG writes and retains unrelated keys', async () => {
  const app = fixture({ sf2_state: '{"points":10}', sf_nerakar_rpg_v2: '{"state":"old"}', foreign_session: 'untouched' });
  const recovered = { sf2_state: '{"points":75}', sf2_reading: '{"1":{"page":3}}', sf_nerakar_rpg_v2: '{"state":"recovered"}' };
  await app.restore(backup(recovered));
  assert.equal(app.reloaded, true);
  assert.equal(app.window.SinapseRestoring, true);
  for (const [key, value] of Object.entries(recovered)) assert.equal(app.storage.getItem(key), value);
  assert.equal(app.storage.getItem('foreign_session'), 'untouched');
});

test('quota failure rolls back replacements after a smaller entry frees space for a larger one', async () => {
  const initial = { sf2_state: 'A'.repeat(100), sf2_reading: 'B' };
  const app = fixture(initial, 150);
  await app.restore(backup({ sf2_state: 'N', sf2_reading: 'M'.repeat(100), sf2_extra: 'Z'.repeat(100) }));
  assert.deepEqual(Object.fromEntries(app.values), initial);
  assert.equal(app.reloaded, false);
  assert.equal(app.window.SinapseRestoring, false);
  assert.match(app.messages.at(-1), /progresso anterior foi preservado/);
});

test('invalid namespace, values and backup format are rejected before any writes', async () => {
  const initial = { sf2_state: '{"points":8}' };
  for (const invalid of [
    backup({ sf2_state: 'changed', foreign_session: 'forbidden' }),
    backup({ sf2_state: { points: 8 } }),
    { format: 'another-app', version: 1, values: {} },
    { format: 'sinapse-final-progress', version: 2, values: {} },
    { format: 'sinapse-final-progress', version: 1, values: [] },
  ]) {
    const app = fixture(initial);
    await app.restore(invalid);
    assert.deepEqual(Object.fromEntries(app.values), initial);
    assert.equal(app.reloaded, false);
  }
});

test('Android export uses the document bridge and includes only project-owned storage keys', () => {
  const app = fixture({ sf2_state: '{"points":8}', sf_page: '2', nerakar_legacy: 'world', foreign_session: 'private' }, Infinity, true);
  app.handlers.export();
  assert.equal(app.exports.length, 1);
  const saved = app.exports[0];
  assert.equal(saved.format, 'sinapse-final-progress');
  assert.equal(saved.version, 1);
  assert.equal(typeof saved.exportedAt, 'string');
  assert.deepEqual(Object.keys(saved.values).sort(), ['nerakar_legacy', 'sf2_state', 'sf_nerakar_rpg_v2', 'sf_page'].sort());
  assert.equal(saved.values.sf2_state, '{"points":8}');
  assert.equal(saved.values.sf_page, '2');
  assert.equal(saved.values.nerakar_legacy, 'world');
});

test('an exported Android backup restores byte-identical storage values through reload', async () => {
  const original = fixture({ sf2_state: '{"points":21}', sf2_reading: '{"12":{"page":5}}', sf_nerakar_rpg_v2: '{"state":"world"}', sf_font: 'large' }, Infinity, true);
  original.handlers.export();
  const restored = fixture({ sf2_state: '{"points":0}', sf_nerakar_rpg_v2: '{"state":"empty"}' });
  await restored.restore(original.exports[0]);
  for (const [key, value] of Object.entries(original.exports[0].values)) assert.equal(restored.storage.getItem(key), value);
  assert.equal(restored.reloaded, true);
});

test('native lifecycle keeps the previous save handler and skips all writes during restoration', () => {
  const app = fixture({ sf2_state: '{"points":5}' });
  app.window.SinapseNativeLifecycle.save();
  assert.equal(app.nativeSaveCalls, 1);
  const saved = Object.fromEntries(app.values);
  app.window.SinapseRestoring = true;
  app.window.SinapseNativeLifecycle.save();
  assert.equal(app.nativeSaveCalls, 1);
  assert.deepEqual(Object.fromEntries(app.values), saved);
});

test('files above the 4 MB backup limit are rejected without writes or reload', async () => {
  const initial = { sf2_state: '{"points":5}' };
  const app = fixture(initial);
  await app.restore(backup({ sf2_large: 'x'.repeat(4 * 1024 * 1024) }));
  assert.deepEqual(Object.fromEntries(app.values), initial);
  assert.equal(app.reloaded, false);
  assert.match(app.messages.at(-1), /até 4 MB/);
});
