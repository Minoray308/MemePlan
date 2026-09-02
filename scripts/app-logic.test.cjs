const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};
const category = require('../src/utils/category.ts');
const folder = (id, parentId = null, name = id) => ({ id, parentId, name });
const folders = [folder('parent', null, '动物'), folder('child', 'parent', '猫'), folder('other', null, '工作')];
const stickers = [
  { id: 'a', name: '早安', tags: ['HELLO'], categoryId: 'child' },
  { id: 'b', name: '下班', tags: [], categoryId: 'other' },
  { id: 'c', name: '可爱', tags: [], categoryId: 'parent' },
  { id: 'd', name: '未分类', tags: [], categoryId: null },
];
test('category search only returns stickers in the matching category', () => {
  assert.equal(typeof category.searchStickers, 'function');
  assert.deepEqual(category.searchStickers(stickers, folders, '动物').map(s => s.id), ['c']);
  assert.deepEqual(category.searchStickers(stickers, folders, '猫').map(s => s.id), ['a']);
});
test('search trims whitespace and matches names and tags case insensitively', () => {
  assert.equal(typeof category.searchStickers, 'function');
  assert.deepEqual(category.searchStickers(stickers, folders, ' hello ').map(s => s.id), ['a']);
  assert.deepEqual(category.searchStickers(stickers, folders, '下班').map(s => s.id), ['b']);
  assert.equal(category.searchStickers(stickers, folders, '  '), stickers);
  assert.deepEqual(category.searchStickers(stickers, folders, '不存在'), []);
});
test('folder counts roll up to parents, never down to children', () => {
  assert.equal(typeof category.countStickersByCategory, 'function');
  const counts = category.countStickersByCategory(stickers, folders);
  assert.equal(counts.parent, 2);
  assert.equal(counts.child, 1);
  assert.equal(counts.other, 1);
});
test('category counts terminate on cycles and ignore missing folders', () => {
  assert.equal(typeof category.countStickersByCategory, 'function');
  const counts = category.countStickersByCategory([
    {categoryId: 'a'}, {categoryId: 'missing'}, {categoryId: null},
  ], [folder('a', 'b'), folder('b', 'a')]);
  assert.equal(counts.a, 1);
  assert.equal(counts.b, 1);
  assert.equal(counts.missing, undefined);
});
test('descendant traversal keeps its order and terminates on cycles', () => {
  assert.deepEqual(category.getDescendantIds('parent', folders), ['parent', 'child']);
  assert.deepEqual(category.getDescendantIds('a', [folder('a', 'b'), folder('b', 'a')]), ['a', 'b']);
});
test('tree flattening preserves depth and handles corrupt cycles', () => {
  assert.deepEqual(category.flattenCategoryTree(folders).map(({category:c, depth}) => [c.id, depth]), [['parent',0],['child',1],['other',0]]);
  assert.deepEqual(category.flattenCategoryTree([folder('a', 'b'), folder('b', 'a')], 'a').map(({category:c}) => c.id), ['b','a']);
});

test('folder search finds nested folders and preserves path context', () => {
  assert.deepEqual(category.searchCategories(folders, ' 猫 ').map(c => c.id), ['child']);
  assert.deepEqual(category.searchCategories(folders, '不存在'), []);
  assert.deepEqual(category.getCategoryPath('child', folders).map(c => c.name), ['动物', '猫']);
});
test('picker search reveals nested matches even when ancestors are collapsed', () => {
  assert.deepEqual(category.getPickerRows(folders, new Set(), '猫').map(r => r.category.id), ['child']);
  assert.deepEqual(category.getPickerRows(folders, new Set(), '').map(r => r.category.id), ['parent', 'other']);
  assert.deepEqual(category.getPickerRows(folders, new Set(['parent']), '').map(r => r.category.id), ['parent', 'child', 'other']);
});
