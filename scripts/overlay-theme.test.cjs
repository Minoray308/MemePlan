const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, filename);
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, file);
  assert.ok(fs.existsSync(filename), 'production module exists: ' + file);
  const module = new Module(filename);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = module.require.bind(module);
  module.require = name => Object.hasOwn(mocks,name) ? mocks[name] : original(name);
  require.extensions['.ts'](module,filename);
  return module.exports;
}

function overlay(native) {
  return load('../modules/sticker-overlay/src/index.ts', { 'expo-modules-core': { requireOptionalNativeModule: () => native } }).StickerOverlay;
}
test('opening an overlay applies the chosen accent before showing items', async () => {
  const calls=[];
  const api=overlay({ setThemeColor: async color => calls.push(color), show: async () => calls.push('show') });
  assert.equal(await api.show([], [], '#3E6FA8'), true);
  assert.deepEqual(calls, ['#3E6FA8', 'show']);
});
test('changing theme updates an existing overlay without reopening it', async () => {
  const colors=[];
  const api=overlay({ setThemeColor: async color => colors.push(color), show: async () => { throw new Error('must not reopen'); } });
  await api.setThemeColor('#B84A5F');
  await api.setThemeColor('#6D45C7');
  assert.deepEqual(colors, ['#B84A5F', '#6D45C7']);
});
test('theme synchronization tolerates missing and older native modules', async () => {
  await overlay(null).setThemeColor('#3E6FA8');
  await overlay({}).setThemeColor('#3E6FA8');
});
