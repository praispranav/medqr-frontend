const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QRCodeSVG } = require('qrcode.react');
const { ImageResponse } = require('next/og');
const { NextRequest } = require('next/server');
const jsQR = require('jsqr');
// qrcode already depends on pngjs to produce the token's PNG QR.
const { PNG } = Module.createRequire(require.resolve('qrcode'))('pngjs');

const root = path.resolve(__dirname, '..');
const modules = new Map();
// Exercise the actual TS route and middleware without starting a backend or database.
function loadTs(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2021 },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (name) => name.startsWith('@/')
    ? loadTs(path.join(root, 'src', `${name.slice(2)}.ts`))
    : originalRequire(name);
  modules.set(filename, loaded);
  loaded._compile(compiled, filename);
  return loaded.exports;
}
const { tokenArrivalState } = loadTs(path.join(root, 'src/lib/tokenCard.ts'));
const { GET } = loadTs(path.join(root, 'src/app/token-image/[tokenId]/route.tsx'));
const { middleware } = loadTs(path.join(root, 'src/middleware.ts'));
const ids = ['8aeed8cf-a1ec-4210-85bb-6846ac63b8c9', 'bfdcf934-14eb-4c6c-8d93-0773cbd28640'];
const base = {
  token_number: 4, status: 'booked',
  doctor: { name: 'Dr. Ananya Sharma', cabin_label: null, qualification: 'MBBS, MD', specialty: 'General Physician', photo_url: null },
  clinic: { name: 'Example Clinic' }, front_desk: true, arrival_scan: false,
  is_future_booking: false, booking_date: null, token_date: '2026-10-15',
};

async function decode(response) {
  const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null;
}
async function download(id, view) {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.ok(String(url).endsWith(`/queue/tokens/${id.replace(/\.png$/, '')}`));
    return Response.json(view);
  };
  try {
    const response = await GET(new Request(`http://localhost/token-image/${id}`), { params: { tokenId: id } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/png/);
    return await decode(response);
  } finally {
    global.fetch = originalFetch;
  }
}

// These expected outcomes predate the redesign: no desk does not by itself remove
// the QR. An arrival-scan clinic keeps it until the patient has actually arrived.
test('arrival rules preserve the older token screen behavior', () => {
  const cases = [
    [{}, false],
    [{ front_desk: false, arrival_scan: true }, false],
    [{ front_desk: false, arrival_scan: false }, true],
    [{ status: 'waiting_in_clinic' }, true],
    [{ status: 'checked_in_early', front_desk: false, arrival_scan: true }, true],
    [{ is_future_booking: true }, false],
    [{ front_desk: false, arrival_scan: true, is_future_booking: true }, true],
  ];
  for (const [overrides, expectedArrived] of cases) {
    assert.equal(tokenArrivalState({ ...base, ...overrides }).arrived, expectedArrived, JSON.stringify(overrides));
  }
});

test('download and on-screen QR decode to each individual token ID', async () => {
  for (const id of ids) {
    // Same QR component and props as the live token screen; encoding libraries may
    // draw different patterns, so compare decoded values rather than pixels.
    const svg = renderToStaticMarkup(React.createElement(QRCodeSVG, {
      xmlns: 'http://www.w3.org/2000/svg', value: id, size: 200, level: 'M', marginSize: 2,
    }));
    const onScreen = await decode(new ImageResponse(React.createElement('img', {
      src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, width: 240, height: 240,
    }), { width: 240, height: 240 }));
    assert.equal(onScreen, id);
    // Identical token numbers, different visit IDs: the QR must vary with the ID.
    assert.equal(await download(id, base), onScreen);
    assert.equal(await download(id, { ...base, front_desk: false, arrival_scan: true }), onScreen);
  }
  assert.equal(await download(`${ids[0]}.png`, base), ids[0]);
});

test('download QR changes with arrival state, without creating a clinic-wide QR', async () => {
  assert.equal(await download(ids[0], { ...base, status: 'waiting_in_clinic' }), null);
  assert.equal(await download(ids[0], { ...base, status: 'checked_in_early', front_desk: false, arrival_scan: true }), null);
  assert.equal(await download(ids[0], { ...base, front_desk: false }), null);
  assert.equal(await download(ids[0], { ...base, is_future_booking: true, token_date: '2026-10-20', booking_date: '2026-10-20' }), ids[0]);
  for (const status of ['in_consultation', 'done', 'cancelled', 'expired', 'no_show']) {
    assert.equal(await download(ids[0], { ...base, status }), null, status);
  }
});

test('future bookings keep a downloadable token QR for every clinic arrival configuration', async () => {
  for (const id of ids) {
    for (const front_desk of [true, false]) {
      for (const arrival_scan of [true, false]) {
        assert.equal(await download(id, {
          ...base, front_desk, arrival_scan, is_future_booking: true,
          booking_date: '2026-10-20', token_date: '2026-10-20',
        }), id, JSON.stringify({ id, front_desk, arrival_scan }));
      }
    }
  }
  // A future date must not resurrect a closed or already checked-in token's QR.
  for (const status of ['waiting_in_clinic', 'checked_in_early', 'in_consultation', 'done', 'cancelled', 'expired', 'no_show']) {
    assert.equal(await download(ids[0], { ...base, status, is_future_booking: true }), null, status);
  }
});

test('patient subdomain serves the shared token image endpoint directly', () => {
  const request = (pathname, host = 'patient.clinicq.in') => new NextRequest(`https://${host}${pathname}`, { headers: { host } });
  const image = middleware(request(`/token-image/${ids[0]}`));
  assert.equal(image.headers.get('x-middleware-rewrite'), null);
  assert.equal(image.headers.get('x-middleware-next'), '1');
  assert.equal(image.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(middleware(request('/demo/queue/token')).headers.get('x-middleware-rewrite'), 'https://patient.clinicq.in/patient/demo/queue/token');
  assert.equal(middleware(request(`/token-image/${ids[0]}`, 'clinicq.in')).headers.get('x-middleware-rewrite'), null);
});
