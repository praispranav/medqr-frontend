const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

test('an earlier socket fetch cannot overwrite the refreshed queue after Call next', async () => {
  const pending = [];
  let rows = null;
  let stateIndex = 0;
  const file = path.join(__dirname,'../src/components/staff/useLiveQueue.ts');
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.require = (name) => {
    if (name === 'react') return {
      useState: () => { const index = stateIndex++; return [null, (value) => { if (index === 0) rows = value; }]; },
      useRef: (value) => ({ current: value }), useCallback: (fn) => fn, useEffect: () => {},
    };
    if (name === '@/lib/api') return { api: { listQueueToday: () => new Promise(resolve => pending.push(resolve)) } };
    if (name === '@/lib/socket') return {};
    throw new Error(`Unexpected dependency ${name}`);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS } }).outputText,file);
  const { refresh } = loaded.exports.useLiveQueue('clinic',['doctor']);
  const older = refresh();
  const afterCall = refresh();
  pending[1]([{id:'2',status:'in_consultation'}]);
  await afterCall;
  pending[0]([{id:'1',status:'in_consultation'}]);
  await older;
  assert.deepEqual(rows,[{id:'2',status:'in_consultation'}]);
});
