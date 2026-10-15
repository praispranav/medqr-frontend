const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/patientDevice.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText, filename);
const { patientDevice } = loaded.exports;
const phoneA = '9876543210';
const phoneB = '9876543211';

beforeEach(() => {
  const data = new Map();
  global.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
});

test('switching numbers restores the original signed family session', () => {
  patientDevice.set('family-a-verified-session', phoneA);
  patientDevice.switchNumber();
  assert.equal(patientDevice.get(), null);
  assert.deepEqual(patientDevice.savedNumbers(), [phoneA]);
  patientDevice.set('family-b-session', phoneB);
  assert.ok(patientDevice.useSaved(phoneA));
  assert.deepEqual(patientDevice.get(), { token: 'family-a-verified-session', mobile: phoneA });
  assert.ok(patientDevice.useSaved(phoneB));
  assert.equal(patientDevice.get().token, 'family-b-session');
});

test('new family profiles update one phone without dropping other phones', () => {
  patientDevice.set('a-profile-1', phoneA);
  patientDevice.set('b-profile-1', phoneB);
  patientDevice.set('a-profiles-1-and-2', phoneA);
  assert.deepEqual(patientDevice.savedNumbers(), [phoneA, phoneB]);
  patientDevice.switchNumber();
  patientDevice.useSaved(phoneA);
  assert.equal(patientDevice.get().token, 'a-profiles-1-and-2');
});

test('existing single-phone storage is migrated when switching', () => {
  localStorage.setItem('medqr:patient-token', 'legacy-signed-session');
  localStorage.setItem('medqr:mobile', phoneA);
  patientDevice.switchNumber();
  assert.ok(patientDevice.useSaved('+91 98765 43210'));
  assert.equal(patientDevice.get().token, 'legacy-signed-session');
});

test('forgetting or expiring the active phone removes only its saved session', () => {
  patientDevice.set('a', phoneA);
  patientDevice.set('b', phoneB);
  patientDevice.clear();
  assert.equal(patientDevice.useSaved(phoneB), false);
  assert.ok(patientDevice.useSaved(phoneA));
  assert.equal(patientDevice.get().token, 'a');
});

test('an unknown number never gets another family session', () => {
  patientDevice.set('a', phoneA);
  patientDevice.switchNumber();
  assert.equal(patientDevice.useSaved(phoneB), false);
  assert.equal(patientDevice.get(), null);
});

test('invalid or unavailable browser storage does not break intake', () => {
  localStorage.setItem('medqr:saved-patient-devices', '[null,{},"invalid"]');
  assert.deepEqual(patientDevice.savedNumbers(), []);
  global.localStorage = { getItem() { throw new Error('private'); }, setItem() { throw new Error('private'); }, removeItem() { throw new Error('private'); } };
  assert.doesNotThrow(() => patientDevice.set('a', phoneA));
  assert.doesNotThrow(() => patientDevice.switchNumber());
  assert.doesNotThrow(() => patientDevice.clear());
  assert.doesNotThrow(() => patientDevice.logout());
  assert.equal(patientDevice.get(), null);
});

test('logout removes every remembered phone and local token shortcut, preserving unrelated settings', () => {
  patientDevice.set('a', phoneA);
  patientDevice.set('b', phoneB);
  localStorage.setItem('medqr_patient_tokens', JSON.stringify([{ id: 'existing-booking-shortcut' }]));
  localStorage.setItem('medqr:lang', 'hi');
  patientDevice.logout();
  assert.equal(patientDevice.get(), null);
  assert.deepEqual(patientDevice.savedNumbers(), []);
  assert.equal(patientDevice.useSaved(phoneA), false);
  assert.equal(patientDevice.useSaved(phoneB), false);
  assert.equal(localStorage.getItem('medqr_patient_tokens'), null);
  assert.equal(localStorage.getItem('medqr:lang'), 'hi');
  assert.ok(patientDevice.logoutStamp());
});

test('logout clears remembered phones even after selecting another number', () => {
  patientDevice.set('a', phoneA);
  patientDevice.switchNumber();
  patientDevice.logout();
  assert.equal(patientDevice.useSaved(phoneA), false);
});

test('logout uses the correct patient home on both supported host styles', () => {
  const { patientLogoutPath } = loaded.exports;
  assert.equal(patientLogoutPath('clinicq.in'), '/patient');
  assert.equal(patientLogoutPath('localhost'), '/patient');
  assert.equal(patientLogoutPath('patient.clinicq.in'), '/');
  assert.equal(patientLogoutPath('patient.localhost'), '/');
});
