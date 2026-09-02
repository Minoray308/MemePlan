const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
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
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const apiUrl = 'https://api.github.com/repos/example/app/releases/latest';
const manifestUrl = 'https://github.com/example/app/releases/latest/download/update.json';
const constants = {GITHUB_LATEST_RELEASE_URL:apiUrl,GITHUB_LATEST_MANIFEST_URL:manifestUrl,UPDATE_API_TIMEOUT_MS:20};
const manifest = {platform:'android',latestVersion:'1.0.5',minimumVersion:'0.0.0',apkUrl:'https://github.com/example/app/releases/download/v1.0.5/app.apk',apkName:'app.apk',sha256:'a'.repeat(64),releaseNotes:['Test']};
const response = (status, body, headers = {}) => ({ok:status>=200&&status<300,status,headers:new Headers(headers),json:async()=>body});
const fetcher = () => load('../src/services/update/releaseFetcher.ts', {'../../constants/update':constants});
test('API rate limit falls back to release manifest with checksum', async () => {
  const calls=[];
  global.fetch=async url=>{calls.push(url); return url===apiUrl?response(403,{}, {'x-ratelimit-remaining':'0'}):response(200,manifest);};
  const result=await fetcher().fetchVersionInfo();
  assert.equal(result.latestVersion,'1.0.5'); assert.equal(result.sha256,'a'.repeat(64));
  assert.deepEqual(calls,[apiUrl,manifestUrl]);
});
test('rate-limit diagnosis survives a missing fallback asset',async()=>{
  global.fetch=async url=>url===apiUrl?response(429,{}):response(404,{});
  await assert.rejects(fetcher().fetchVersionInfo(), error=>error.code==='rate_limit');
});
test('ordinary forbidden response is not mislabeled as rate limiting',async()=>{
  global.fetch=async url=>url===apiUrl?response(403,{}):response(404,{});
  await assert.rejects(fetcher().fetchVersionInfo(), error=>error.code==='http'&&error.message.includes('403'));
});
test('a successful API response does not call the fallback', async()=>{
  let calls=0;
  global.fetch=async()=>{calls++;return response(200,{tag_name:'v1.0.5',assets:[{name:'app.apk',browser_download_url:manifest.apkUrl,digest:'sha256:'+manifest.sha256}],body:'Notes'});};
  const result=await fetcher().fetchVersionInfo();
  assert.equal(calls,1); assert.equal(result.latestVersion,'1.0.5'); assert.equal(result.sha256,manifest.sha256);
});
test('timeout covers reading the body as well as response headers', async()=>{
  global.fetch=async(_url,{signal})=>({ok:true,status:200,headers:new Headers(),json:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}))))});
  await assert.rejects(fetcher().fetchVersionInfo(), error=>error.code==='timeout');
});
test('unsafe fallback metadata is rejected',async()=>{
  global.fetch=async url=>url===apiUrl?response(500,{}):response(200,{...manifest,apkUrl:'http://example.com/app.apk'});
  await assert.rejects(fetcher().fetchVersionInfo(), error=>error.code==='http');
});
function manager(fetchVersionInfo, storage) {
  return load('../src/services/update/updateManager.ts', {
    '@react-native-async-storage/async-storage':storage,
    './updateApi':{fetchVersionInfo,getCurrentVersion:()=> '1.0.4',canInstallApk:()=>true,buildUpdateInfo:release=>({...release,version:release.latestVersion})},
  });
}
test('failed automatic checks do not suppress the next attempt for six hours',async()=>{
  let writes=0; let attempts=0; let timestamp=null;
  const storage={getItem:async()=>timestamp,setItem:async(_key,value)=>{writes++;timestamp=value;}};
  const api=manager(async()=>{if(++attempts===1)throw new Error('offline');return manifest;},storage);
  assert.equal((await api.checkForUpdate(false)).outcome,'error'); assert.equal(writes,0);
  assert.equal((await api.checkForUpdate(false)).outcome,'apk'); assert.equal(attempts,2); assert.equal(writes,1);
});
test('manual and automatic checks share the actual result instead of claiming latest',async()=>{
  let resolve; let attempts=0;
  const api=manager(()=>{attempts++;return new Promise(r=>{resolve=r;});},{getItem:async()=>null,setItem:async()=>{}});
  const first=api.checkForUpdate(true); const second=api.checkForUpdate(false);
  await new Promise(setImmediate); resolve(manifest);
  assert.equal((await first).outcome,'apk'); assert.equal((await second).outcome,'apk'); assert.equal(attempts,1);
});

test('manual check still fetches when a successful automatic check is cached',async()=>{
  let attempts=0;
  const api=manager(async()=>{attempts++;return manifest;},{getItem:async()=>String(Date.now()),setItem:async()=>{}});
  assert.equal((await api.checkForUpdate(false)).outcome,'latest'); assert.equal(attempts,0);
  assert.equal((await api.checkForUpdate(true)).outcome,'apk'); assert.equal(attempts,1);
});
test('secondary limit retry-after is identified without a remaining quota header',async()=>{
  global.fetch=async url=>url===apiUrl?response(403,{}, {'retry-after':'60'}):response(404,{});
  await assert.rejects(fetcher().fetchVersionInfo(), error=>error.code==='rate_limit');
});
test('published fallback manifest contains the real APK checksum and notes',()=>{
  const { createReleaseManifest }=require('./create-update-manifest.cjs');
  const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'memeplan-manifest-'));
  try {
    fs.writeFileSync(path.join(dir,'app.apk'),'hello');fs.writeFileSync(path.join(dir,'notes.md'),'Release notes');
    const result=createReleaseManifest({version:'1.0.5',repository:'example/app',apkPath:path.join(dir,'app.apk'),notesPath:path.join(dir,'notes.md'),publishedAt:'2026-09-02T00:00:00Z'});
    assert.equal(result.apkUrl,'https://github.com/example/app/releases/download/v1.0.5/app.apk');
    assert.equal(result.sha256,'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    assert.deepEqual(result.releaseNotes,['Release notes']);
    const parsed=require('../src/services/update/updateLogic.ts').parseReleaseManifest(result);
    assert.equal(parsed.releaseUrl,result.releaseUrl);assert.equal(parsed.latestVersion,'1.0.5');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
