// Run: node test.js
const assert = require('assert');
const { PeakTimer, speedFromGap, UNITS, TABLE_DISTANCE_M } = require('./app.js');

const SR = 48000;
const buf = new Float32Array(SR); // 1 second of silence
buf[4800] = 0.9;   // crack at 100ms
buf[4850] = 0.8;   // ringing 1ms later — must NOT count as a second peak
buf[14400] = 0.9;  // rack at 300ms → 200ms gap

const timer = new PeakTimer(SR);
const peaks = timer.process(buf);
assert.strictEqual(peaks.length, 2, `expected 2 peaks, got ${peaks.length}`);
assert.ok(Math.abs(peaks[0] - 0.1) < 1e-3);
assert.ok(Math.abs(peaks[1] - 0.3) < 1e-3);

// Peak split across two buffers must still be sample-accurate.
const timer2 = new PeakTimer(SR);
const a = new Float32Array(1024);
const b = new Float32Array(1024);
b[0] = 0.9; // sample 1024 overall
const p2 = [...timer2.process(a), ...timer2.process(b)];
assert.strictEqual(p2.length, 1);
assert.ok(Math.abs(p2[0] - 1024 / SR) < 1e-9);

// 9ft table, 200ms gap: 1.27m / 0.2s = 6.35 m/s ≈ 14.2 mph ≈ 22.9 km/h
const speedMs = speedFromGap(peaks[1] - peaks[0], TABLE_DISTANCE_M[9]);
assert.ok(Math.abs(speedMs * UNITS.mph.factor - 14.2) < 0.1, `got ${speedMs * UNITS.mph.factor} mph`);
assert.ok(Math.abs(speedMs * UNITS.kmh.factor - 22.9) < 0.1, `got ${speedMs * UNITS.kmh.factor} km/h`);

console.log('ok');
