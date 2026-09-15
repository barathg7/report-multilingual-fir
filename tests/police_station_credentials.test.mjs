// tests/police_station_credentials.test.mjs
// Test suite for police station credentials, security key validation, and PDF directory
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Mock browser sessionStorage
const mockSessionStorage = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
    _dump: () => store,
  };
})();
globalThis.sessionStorage = mockSessionStorage;

// Import modules
const { authenticatePolice, getAuthenticatedStation, clearPoliceSession } = await import('../src/lib/policeAuth.js');
const { default: STATIONS, getStationByCode } = await import('../src/utils/policeStations.js');

console.log('==================================================================');
console.log('RUNNING POLICE STATION CREDENTIALS & DIRECTORY TEST SUITE');
console.log('==================================================================');

let testsPassed = 0;

function runTest(name, fn) {
  try {
    mockSessionStorage.clear();
    fn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(name, fn) {
  try {
    mockSessionStorage.clear();
    await fn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ── TEST 1: Station lookup for TN-ARC-B0085 ────────────────────────────────
runTest('TEST 1: West Police Station (TN-ARC-B0085) exists in station registry', () => {
  const station = getStationByCode('TN-ARC-B0085');
  assert.ok(station, 'Station TN-ARC-B0085 must exist');
  assert.strictEqual(station.name, 'West Police Station');
  assert.strictEqual(station.district, 'Arcot');
  assert.strictEqual(station.state, 'Tamil Nadu');
});

// ── TEST 2: Rejection of legacy 'police123' with clear guidance ─────────────
await runAsyncTest('TEST 2: Legacy "police123" is blocked with instructive error message', async () => {
  let threw = false;
  try {
    await authenticatePolice('TN-ARC-B0085', 'police123', 'SHO-4102');
  } catch (err) {
    threw = true;
    assert.ok(
      err.message.includes('police123') && err.message.includes('Police@TN-ARC-B0085'),
      `Error message must point to official key: ${err.message}`
    );
  }
  assert.ok(threw, 'Should reject police123');
});

// ── TEST 3: Station Key Authentication (Police@TN-ARC-B0085) ────────────────
await runAsyncTest('TEST 3: Official Station Security Key (Police@TN-ARC-B0085) succeeds', async () => {
  const auth = await authenticatePolice('TN-ARC-B0085', 'Police@TN-ARC-B0085', 'SHO-4102');
  assert.ok(auth, 'Auth result must be returned');
  assert.strictEqual(auth.code, 'TN-ARC-B0085');
  assert.strictEqual(auth.name, 'West Police Station');
  assert.strictEqual(auth.district, 'Arcot');
  assert.strictEqual(auth.officerBadge, 'SHO-4102');

  // Verify session storage
  const activeStation = await getAuthenticatedStation();
  assert.ok(activeStation, 'Active station must be retrieved from session');
  assert.strictEqual(activeStation.code, 'TN-ARC-B0085');
});

// ── TEST 4: Jurisdictional Master Key (TN-POLICE@2026) ─────────────────────
await runAsyncTest('TEST 4: State Jurisdictional Master Key (TN-POLICE@2026) succeeds', async () => {
  const auth = await authenticatePolice('TN-ARC-B0085', 'TN-POLICE@2026', 'SHO-DUTY');
  assert.ok(auth);
  assert.strictEqual(auth.code, 'TN-ARC-B0085');
  assert.strictEqual(auth.officerBadge, 'SHO-DUTY');
});

// ── TEST 5: Rejection of arbitrary wrong passwords ──────────────────────────
await runAsyncTest('TEST 5: Arbitrary invalid password throws authentication error', async () => {
  let threw = false;
  try {
    await authenticatePolice('TN-ARC-B0085', 'wrongpassword999', 'SHO-4102');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('Authentication failed'));
  }
  assert.ok(threw, 'Invalid password must throw');
});

// ── TEST 6: Session clearing ────────────────────────────────────────────────
await runAsyncTest('TEST 6: clearPoliceSession wipes credentials completely', async () => {
  await authenticatePolice('TN-ARC-B0085', 'Police@TN-ARC-B0085', 'SHO-4102');
  assert.ok(await getAuthenticatedStation());
  await clearPoliceSession();
  assert.strictEqual(await getAuthenticatedStation(), null);
});

// ── TEST 7: Directory PDF exists and is valid ──────────────────────────────
runTest('TEST 7: Generated PDF exists in root and public directories with valid PDF header', () => {
  const rootPdf = path.join(rootDir, 'POLICE_STATION_CREDENTIALS_DIRECTORY.pdf');
  const publicPdf = path.join(rootDir, 'public', 'POLICE_STATION_CREDENTIALS_DIRECTORY.pdf');

  assert.ok(fs.existsSync(rootPdf), 'Root PDF must exist');
  assert.ok(fs.existsSync(publicPdf), 'Public PDF must exist');

  const rootHeader = fs.readFileSync(rootPdf, { encoding: 'utf8', flag: 'r' }).slice(0, 5);
  const publicHeader = fs.readFileSync(publicPdf, { encoding: 'utf8', flag: 'r' }).slice(0, 5);

  assert.strictEqual(rootHeader, '%PDF-', 'Root file must have valid PDF magic bytes');
  assert.strictEqual(publicHeader, '%PDF-', 'Public file must have valid PDF magic bytes');

  const stats = fs.statSync(rootPdf);
  assert.ok(stats.size > 50000, `PDF must be comprehensive (>50KB), actual size: ${stats.size}`);
});

console.log('==================================================================');
console.log(`TEST SUMMARY: ${testsPassed} passed, 0 failed`);
console.log('==================================================================');
