'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../app/src/main/assets/upgrade.js');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../app/src/main/assets/chapters.json'), 'utf8'));
const original = core.validateBook(source);

test('recovered 12 chapters preserve text and existing pagination byte-for-byte', () => {
  assert.equal(original.length, 12);
  original.forEach((chapter, index) => {
    assert.equal(chapter.text, source.chapters[index].text);
    assert.deepEqual(chapter.pages, source.chapters[index].pages);
  });
});

test('pagination preserves every character including Unicode and paragraph boundaries', () => {
  const text = 'Caleb 🐉 atravessou Nerakar.\n\n'.repeat(200);
  const pages = core.paginate(text, 180);
  assert.equal(pages.join(''), text);
  assert.ok(pages.length > 1);
  assert.ok(pages.every(page => !/^[\uDC00-\uDFFF]/.test(page)));
});

test('new chapters are integrated without replacing recovered originals', () => {
  const additions = core.validateBook({ chapters: [{ number: 16, title: 'Texto fornecido pelo autor', text: 'Primeira página.\n\nSegunda página.' }] }, true);
  const before = JSON.stringify(original);
  const merged = core.mergeBooks(original, additions);
  assert.equal(merged.length, 13);
  assert.equal(JSON.stringify(original), before);
  assert.equal(merged[12].number, 16);
  assert.throws(() => core.mergeBooks(original, [original[0]]), /preservado/);
  assert.throws(() => core.mergeBooks(merged, additions), /preservado/);
});

test('rejects missing texts, duplicate numbers and reordered or missing pages', () => {
  assert.throws(() => core.validateBook({ chapters: [{ number: 13, title: 'Pendente', text: '' }] }, true), /integral/);
  const chapter = { number: 16, title: 'Importação', text: 'A B', pages: ['B', 'A'] };
  assert.throws(() => core.validateBook({ chapters: [chapter] }, true), /mesma ordem/);
  assert.throws(() => core.validateBook({ chapters: [{ ...chapter, pages: ['A'] }] }, true), /preservar/);
  assert.throws(() => core.validateBook({ chapters: [source.chapters[0]] }, true), /13/);
  assert.throws(() => core.validateBook({ chapters: [{ ...chapter, pages: ['A B'] }, { ...chapter, pages: ['A B'] }] }, true), /únicos/);
});

test('chapter 24 enforces the author-specified title', () => {
  const chapter = { number: 24, title: 'Ecos de Aço e Sangue', text: 'Fonte do autor.' };
  assert.equal(core.validateBook({ chapters: [chapter] }, true)[0].title, chapter.title);
  assert.equal(core.validateBook({ chapters: [{ ...chapter, title: '  ECOS DE AÇO  E SANGUE  ' }] }, true)[0].title, chapter.title);
  assert.throws(() => core.validateBook({ chapters: [{ ...chapter, title: 'Outro título' }] }, true), /Ecos de Aço e Sangue/);
});

test('unsafe image URLs, paths and unsupported embedded SVG are rejected', () => {
  for (const src of ['javascript:alert(1)', 'https://example.com/photo.jpg', 'scenes/../secret.png', 'data:image/svg+xml;base64,PHN2Zz4=']) assert.equal(core.safeImage(src), false);
  assert.equal(core.safeImage('scenes/chapters/chapter-1.webp'), true);
  assert.equal(core.safeImage('scenes/chapters/chapter-1-scene-1.svg'), true);
  assert.equal(core.safeImage('data:image/png;base64,aGVsbG8='), true);
});

test('highlight offsets merge overlap and discard corrupt or mismatching ranges', () => {
  const text = 'Caleb visita Nerakar.';
  const ranges = [{ start: 0, end: 5 }, { start: 3, end: 12 }, { start: -1, end: 4 }, { start: 15, end: 200 }, { start: 13, end: 20, quote: 'outro texto' }];
  assert.deepEqual(core.normalizeHighlights(ranges, text), [{ start: 0, end: 12, quote: 'Caleb visita' }]);
  assert.deepEqual(core.normalizeHighlights(null, text), []);
});

test('chapter completion requires all pages and cannot grant a repeated reward', () => {
  const progress = { 1: { visited: [0, 2] } };
  assert.equal(core.completeChapter(progress, 1, 3), false);
  progress[1].visited.push(1);
  assert.equal(core.completeChapter(progress, 1, 3), true);
  assert.equal(progress[1].completed, true);
  assert.ok(progress[1].completedAt);
  assert.equal(core.completeChapter(progress, 1, 3), false);
  assert.equal(core.completeChapter(progress, 2, 3), false);
  assert.equal(core.completeChapter({ 1: { visited: [] } }, 1, 0), false);
});

test('XP reward ledger remains unique even if annotation storage loses a completion', () => {
  const player = {};
  assert.equal(core.claimChapterReward(player, 16), true);
  const reloaded = JSON.parse(JSON.stringify(player));
  assert.equal(core.claimChapterReward(reloaded, 16), false);
  assert.equal(core.claimChapterReward(reloaded, 24), true);
  assert.equal(core.claimChapterReward(reloaded, 25), false);
  assert.deepEqual(reloaded.completedRewards, [16, 24]);
});

test('lifecycle save cannot overwrite a freshly restored backup before reload', () => {
  // Execute the actual storage functions without needing a browser DOM.
  const script = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/upgrade.js'), 'utf8');
  const saveSource = script.slice(script.indexOf('  const save = (key, value) => {'), script.indexOf('  const load = (key, fallback) => {'));
  const persistSource = script.split('\n').find(line => line.includes('  const persist = () =>'));
  const entries = new Map([
    ['sf2_state', JSON.stringify({ name: 'Perfil restaurado', points: 75 })],
    ['sf2_reading', JSON.stringify({ 1: { page: 3 } })],
    ['sf2_lastReading', JSON.stringify(1)]
  ]);
  const restoredEntries = [...entries];
  const context = {
    window: { SinapseRestoring: true },
    localStorage: { setItem: (key, value) => entries.set(key, value) },
    state: { name: 'Perfil antigo', points: 0 }, reading: { 1: { page: 0 } },
    storageWarning: false, toast: () => {}
  };
  vm.runInNewContext(saveSource + '\n' + persistSource + '\nglobalThis.persistReader = persist; globalThis.saveReader = save;', context);
  assert.equal(context.persistReader(), true);
  assert.equal(context.saveReader('lastReading', 12), true);
  assert.deepEqual([...entries], restoredEntries);
  context.window.SinapseRestoring = false;
  assert.equal(context.persistReader(), true);
  assert.equal(JSON.parse(entries.get('sf2_state')).name, 'Perfil antigo');
  assert.equal(JSON.parse(entries.get('sf2_reading'))[1].page, 0);
});
