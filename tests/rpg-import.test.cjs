'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Data = require('../app/src/main/assets/rpg-data.js');
const Engine = require('../app/src/main/assets/rpg-engine.js');
const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/rpg.js'), 'utf8');

// Run the actual RPG init, rendering and document-picker handler. Canvas is
// absent here; browser/Android suites cover the canvas separately.
function fixture() {
  const values = new Map(), messages = [];
  let quota = Infinity;
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) {
      const text = String(value);
      const size = [...values].reduce((total, [other, saved]) => total + (other === key ? 0 : saved.length), 0) + text.length;
      if (size > quota) throw new Error('QuotaExceededError');
      values.set(key, text);
    },
  };
  const original = Engine.createGame();
  original.state.inventory.wood = 17;
  assert(original.save(storage).ok);
  class Node {
    constructor() { this.value = ''; this.children = []; this.listeners = {}; this.style = {}; this.dataset = {}; this.classList = { contains: () => true, add() {}, remove() {} }; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    get childElementCount() { return this.children.length; }
    setAttribute() {}
    addEventListener(event, handler) { this.listeners[event] = handler; }
    getContext() { return null; }
    querySelector(selector) { if (!this.nodes) this.nodes = new Map(); if (!this.nodes.has(selector)) this.nodes.set(selector, new Node()); return this.nodes.get(selector); }
    querySelectorAll() { return []; }
  }
  const section = new Node(), bestiary = new Node();
  bestiary.querySelector('#rpg-beast-filter').value = 'all';
  const document = {
    readyState: 'complete', hidden: false,
    getElementById: id => id === 'rpg' ? section : id === 'bestiary' ? bestiary : null,
    createElement: () => new Node(), createTextNode: text => ({ textContent: text }), addEventListener() {},
  };
  const window = { NerakarData: Data, NerakarEngine: Engine, localStorage: storage, addEventListener() {}, SinapseApp: { toast: message => messages.push(message) } };
  vm.runInNewContext(source, { window, document, Image: class {}, MutationObserver: class { observe() {} }, setTimeout, clearTimeout, setInterval, clearInterval, Date });
  return {
    storage, values, messages, window, section, bestiary,
    limit(bytes) { quota = bytes; },
    async import(text) {
      const input = section.querySelector('#rpg-import');
      await input.listeners.change({ target: { value: 'file.json', files: [{ size: Buffer.byteLength(text), text: async () => text }] } });
    },
  };
}

test('RPG import rejects quota failure before changing the active game or announcing success', async () => {
  const app = fixture(), previous = app.window.NerakarRPG.getGame();
  const imported = Engine.createGame();
  imported.state.inventory.wood = 42;
  imported.state.log = Array.from({ length: 8 }, () => 'Longa exploração de Nerakar. '.repeat(8));
  const primaryBytes = previous.serialize().length;
  app.limit(primaryBytes * 2 + 200);
  await app.import(imported.serialize());
  assert.equal(app.window.NerakarRPG.getGame(), previous);
  assert.equal(previous.count('wood'), 17);
  assert.equal(Engine.importSave(app.storage.getItem(Engine.SAVE_KEY)).count('wood'), 17);
  assert.equal(Engine.importSave(app.storage.getItem(Engine.BACKUP_KEY)).count('wood'), 17);
  assert.match(app.messages.at(-1), /Importação cancelada; seu progresso atual foi preservado/);
  assert(!app.messages.some(message => message.startsWith('Progresso importado;')));
  assert.match(app.section.querySelector('#rpg-save-status').textContent, /armazenamento indisponível ou cheio/);
});

test('RPG import saves the new game and retains the previous game as the backup', async () => {
  const app = fixture(), previous = app.window.NerakarRPG.getGame();
  const imported = Engine.createGame();
  imported.state.inventory.wood = 42;
  await app.import(imported.serialize());
  assert.notEqual(app.window.NerakarRPG.getGame(), previous);
  assert.equal(app.window.NerakarRPG.getGame().count('wood'), 42);
  assert.equal(Engine.importSave(app.storage.getItem(Engine.SAVE_KEY)).count('wood'), 42);
  assert.equal(Engine.importSave(app.storage.getItem(Engine.BACKUP_KEY)).count('wood'), 17);
  assert.match(app.messages.at(-1), /Progresso importado; o anterior está na cópia de segurança/);
});

test('invalid RPG import leaves the active game and both storage values untouched', async () => {
  const app = fixture(), previous = app.window.NerakarRPG.getGame();
  const saved = [...app.values];
  await app.import('{invalid json');
  assert.equal(app.window.NerakarRPG.getGame(), previous);
  assert.deepEqual([...app.values], saved);
  assert.match(app.messages.at(-1), /Arquivo de progresso inválido/);
});
