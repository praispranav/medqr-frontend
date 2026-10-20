const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/directoryLocation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,setTimeout,clearTimeout,AbortController,fetch});
const {findClosestCity,detectCoordinates}=m.exports;
test('GPS maps nearby directory city and does not claim a distant city is the detected location',()=>{
 assert.equal(findClosestCity(26.594,85.493,['Patna','Sitamarhi']),'Sitamarhi');
 assert.equal(findClosestCity(51.5,-0.12,['Patna']),null);
 assert.equal(findClosestCity(26.594,85.493,[]),null);
});
test('failed fresh fix retries coarse positioning, including cached Safari fixes',async()=>{
 const calls=[];const expected={latitude:26.59,longitude:85.49};
 const coords=await detectCoordinates({getCurrentPosition(ok,fail,options){calls.push(options);if(calls.length===1)fail({code:3});else ok({coords:expected});}});
 assert.equal(coords,expected);assert.equal(calls.length,2);assert.equal(calls[0].enableHighAccuracy,true);assert.equal(calls[1].enableHighAccuracy,false);assert.ok(calls[1].maximumAge>0);
});
test('permission denial is surfaced without repeatedly prompting',async()=>{
 let calls=0;await assert.rejects(detectCoordinates({getCurrentPosition(ok,fail){calls++;fail({code:1});}}),e=>e.code===1);assert.equal(calls,1);
});
