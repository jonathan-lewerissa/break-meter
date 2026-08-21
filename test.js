// Run: node --test  (or: node test.js)
const { test } = require('node:test');
const assert = require('node:assert');
const {
  PeakTimer, GapFinder, speedFromGap, addBreak, bestBreak,
  UNITS, TABLE_DISTANCE_M, MIN_GAP_S, MAX_GAP_S,
} = require('./app.js');

const SR = 48000;

function silence(n) { return new Float32Array(n); }

test('PeakTimer detects two transients at sample-accurate times', () => {
  const buf = silence(SR);
  buf[4800] = 0.9;   // 100ms
  buf[14400] = 0.9;  // 300ms
  const peaks = new PeakTimer(SR).process(buf);
  assert.strictEqual(peaks.length, 2);
  assert.ok(Math.abs(peaks[0] - 0.1) < 1e-6);
  assert.ok(Math.abs(peaks[1] - 0.3) < 1e-6);
});

test('PeakTimer ignores ringing inside the refractory window', () => {
  const buf = silence(SR);
  buf[4800] = 0.9;
  buf[4850] = 0.8; // ~1ms later
  buf[5300] = 0.7; // ~10ms later
  const peaks = new PeakTimer(SR).process(buf);
  assert.strictEqual(peaks.length, 1);
});

test('PeakTimer: sustained ringing keeps extending the refractory', () => {
  const buf = silence(SR);
  // loud every 20ms — each hit extends the 30ms refractory, so only the first counts
  for (let s = 4800; s < 4800 + SR / 2; s += Math.round(0.02 * SR)) buf[s] = 0.9;
  const peaks = new PeakTimer(SR).process(buf);
  assert.strictEqual(peaks.length, 1);
});

test('PeakTimer is sample-accurate across buffer boundaries', () => {
  const timer = new PeakTimer(SR);
  const b = silence(1024);
  b[0] = 0.9; // sample 1024 overall
  const peaks = [...timer.process(silence(1024)), ...timer.process(b)];
  assert.strictEqual(peaks.length, 1);
  assert.ok(Math.abs(peaks[0] - 1024 / SR) < 1e-9);
});

test('PeakTimer ignores sub-threshold noise', () => {
  const buf = silence(SR);
  for (let i = 0; i < buf.length; i++) buf[i] = 0.2 * Math.sin(i / 10);
  assert.strictEqual(new PeakTimer(SR).process(buf).length, 0);
});

test('GapFinder pairs a valid crack→rack gap', () => {
  const f = new GapFinder();
  assert.strictEqual(f.feed(1.0), null);
  assert.ok(Math.abs(f.feed(1.2) - 0.2) < 1e-9);
  assert.strictEqual(f.crackTime, null); // reset after a result
});

test('GapFinder ignores a second peak that arrives too fast', () => {
  const f = new GapFinder();
  f.feed(1.0);
  assert.strictEqual(f.feed(1.0 + MIN_GAP_S / 2), null);
  assert.strictEqual(f.crackTime, 1.0); // still waiting on the original crack
});

test('GapFinder restarts when the second peak is too late', () => {
  const f = new GapFinder();
  f.feed(1.0);
  assert.strictEqual(f.feed(1.0 + MAX_GAP_S + 0.1), null); // too slow: becomes the new crack
  assert.ok(Math.abs(f.feed(1.0 + MAX_GAP_S + 0.3) - 0.2) < 1e-9);
});

test('speed math: 9ft table, 200ms gap ≈ 14.2 mph / 22.9 km/h', () => {
  const ms = speedFromGap(0.2, TABLE_DISTANCE_M[9]);
  assert.ok(Math.abs(ms - 6.35) < 1e-9);
  assert.ok(Math.abs(ms * UNITS.mph.factor - 14.2) < 0.1);
  assert.ok(Math.abs(ms * UNITS.kmh.factor - 22.9) < 0.1);
  assert.ok(Math.abs(ms * UNITS.fps.factor - 20.8) < 0.1);
});

test('addBreak prepends and caps the list', () => {
  let list = [];
  for (let i = 0; i < 60; i++) list = addBreak(list, { speedMs: i });
  assert.strictEqual(list.length, 50);
  assert.strictEqual(list[0].speedMs, 59); // newest first
});

test('bestBreak finds the fastest; empty list → null', () => {
  assert.strictEqual(bestBreak([]), null);
  const list = [{ speedMs: 5 }, { speedMs: 9 }, { speedMs: 7 }];
  assert.strictEqual(bestBreak(list).speedMs, 9);
});
