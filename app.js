'use strict';

// Head string → foot spot (rack apex): half the playing-surface length.
// 9ft = 50", 8ft = 46", 7ft = 39".
const TABLE_DISTANCE_M = { 7: 0.9906, 8: 1.1684, 9: 1.27 };

// ponytail: fixed amplitude threshold; make adaptive if noisy pool halls prove it wrong
const THRESHOLD = 0.35;
const REFRACTORY_S = 0.03; // loud samples extend this, so ringing doesn't double-count
const MIN_GAP_S = 0.05;    // faster than ~40 mph on a 7-footer = noise
const MAX_GAP_S = 0.7;     // slower than ~4 mph = we missed the rack hit

// Sample-accurate transient detector. Feed it raw buffers, get back
// timestamps (seconds since stream start) of distinct loud transients.
class PeakTimer {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.samplesSeen = 0;
    this.lastLoudSample = -Infinity;
  }

  process(buf) {
    const peaks = [];
    const refractorySamples = REFRACTORY_S * this.sampleRate;
    for (let i = 0; i < buf.length; i++) {
      if (Math.abs(buf[i]) >= THRESHOLD) {
        const s = this.samplesSeen + i;
        if (s - this.lastLoudSample >= refractorySamples) {
          peaks.push(s / this.sampleRate);
        }
        this.lastLoudSample = s;
      }
    }
    this.samplesSeen += buf.length;
    return peaks;
  }
}

// m/s → unit conversion factors
const UNITS = {
  mph: { factor: 2.23694, label: 'mph' },
  kmh: { factor: 3.6, label: 'km/h' },
  ms:  { factor: 1, label: 'm/s' },
  fps: { factor: 3.28084, label: 'ft/s' },
};

function speedFromGap(gapS, distanceM) {
  return distanceM / gapS; // m/s
}

if (typeof document !== 'undefined') {
  const armBtn = document.getElementById('arm');
  const speedEl = document.getElementById('speed');
  const speedAltEl = document.getElementById('speed-alt');
  const statusEl = document.getElementById('status');
  const tableSel = document.getElementById('table-size');
  const unitSel = document.getElementById('unit');

  let lastResult = null; // { speedMs, gap }
  unitSel.value = localStorage.getItem('unit') || 'mph';
  unitSel.addEventListener('change', () => {
    localStorage.setItem('unit', unitSel.value);
    render();
  });

  function render() {
    if (!lastResult) return;
    const { factor, label } = UNITS[unitSel.value];
    speedEl.textContent = `${(lastResult.speedMs * factor).toFixed(1)} ${label}`;
    speedAltEl.textContent = `${(lastResult.gap * 1000).toFixed(0)} ms`;
  }

  let audioCtx = null;
  let stream = null;
  let wakeLock = null;
  let crackTime = null; // timestamp of first transient, waiting for the rack

  async function arm() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    // ponytail: deprecated ScriptProcessor; swap for an AudioWorklet if browsers drop it
    const proc = audioCtx.createScriptProcessor(1024, 1, 1);
    const timer = new PeakTimer(audioCtx.sampleRate);

    proc.onaudioprocess = (e) => {
      for (const t of timer.process(e.inputBuffer.getChannelData(0))) onPeak(t);
    };
    source.connect(proc);
    proc.connect(audioCtx.destination); // required for the node to run; outputs silence

    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* nice-to-have */ }

    crackTime = null;
    armBtn.textContent = 'STOP';
    armBtn.classList.add('armed');
    statusEl.textContent = 'Listening… break when ready.';
  }

  function disarm() {
    stream?.getTracks().forEach((t) => t.stop());
    audioCtx?.close();
    wakeLock?.release();
    audioCtx = stream = wakeLock = crackTime = null;
    armBtn.textContent = 'ARM';
    armBtn.classList.remove('armed');
    statusEl.textContent = 'Tap ARM, then break. Mic stays local — nothing is recorded.';
  }

  function onPeak(t) {
    if (crackTime === null) {
      crackTime = t;
      statusEl.textContent = 'Crack heard — waiting for the rack…';
      return;
    }
    const gap = t - crackTime;
    if (gap > MAX_GAP_S) { crackTime = t; return; } // too slow: that was noise, restart from here
    if (gap < MIN_GAP_S) return;                    // too fast: same impact still ringing

    lastResult = { speedMs: speedFromGap(gap, TABLE_DISTANCE_M[tableSel.value]), gap };
    render();
    statusEl.textContent = 'Nice break. Still listening…';
    crackTime = null;
  }

  armBtn.addEventListener('click', () => {
    (audioCtx ? Promise.resolve(disarm()) : arm()).catch((err) => {
      statusEl.textContent = `Mic error: ${err.message}`;
      disarm();
    });
  });

  document.addEventListener('visibilitychange', async () => {
    if (audioCtx && document.visibilityState === 'visible') {
      try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* ignore */ }
    }
  });
}

if (typeof module !== 'undefined') {
  module.exports = { PeakTimer, speedFromGap, UNITS, TABLE_DISTANCE_M, MIN_GAP_S, MAX_GAP_S };
}
