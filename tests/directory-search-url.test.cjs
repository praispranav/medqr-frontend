const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/directorySearchUrl.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:moduleUnderTest,exports:moduleUnderTest.exports,URLSearchParams});
const {directorySearchPath,readDirectorySearch}=moduleUnderTest.exports;
const base={q:'',type:'all',city:'Patna',area:'',group:'',today:false,bookable:false};
const plain=v=>JSON.parse(JSON.stringify(v));
test('a shared search preserves every selected filter and reserved characters',()=>{
  const selected={...base,type:'doctors',city:'Sitamarhi',q:'Sun & Care',area:'Hospital Road / east',group:'gynecologist',today:true,bookable:true};
  const path=directorySearchPath(selected);assert.ok(path.startsWith('/search?'));
  assert.deepEqual(plain(readDirectorySearch(new URL(path,'https://clinicq.in').searchParams,base)),selected);
});
test('All cities and All categories override recipient or route defaults',()=>{
  const selected={...base,city:'',type:'all'};
  const recipient={...base,city:'Sitamarhi',type:'doctors',group:'gynecologist'};
  // Shared URLs use /search, whose specialty default is empty rather than the old SEO route.
  const restored=readDirectorySearch(new URL(directorySearchPath(selected),'https://clinicq.in').searchParams,{...recipient,group:''});
  assert.equal(restored.city,'');assert.equal(restored.type,'all');assert.equal(restored.group,'');
});
test('explicit cleared filters and legacy online alias restore correctly',()=>{
  const restored=readDirectorySearch(new URLSearchParams('city=&specialty=&online=0&today=0&type=all'),{...base,group:'gynecologist',bookable:true,today:true,type:'doctors'});
  assert.equal(restored.group,'');assert.equal(restored.bookable,false);assert.equal(restored.today,false);
  assert.equal(readDirectorySearch(new URLSearchParams('bookable=1&type=invalid'),base).bookable,true);
  assert.equal(readDirectorySearch(new URLSearchParams('type=invalid'),base).type,'all');
});
