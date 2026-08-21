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

// Pairs transient timestamps into a crack→rack gap. Returns the gap in
// seconds when a valid pair completes, else null.
class GapFinder {
  constructor() { this.crackTime = null; }
  feed(t) {
    if (this.crackTime === null) { this.crackTime = t; return null; }
    const gap = t - this.crackTime;
    if (gap > MAX_GAP_S) { this.crackTime = t; return null; } // too slow: noise, restart from here
    if (gap < MIN_GAP_S) return null;                          // too fast: same impact still ringing
    this.crackTime = null;
    return gap;
  }
}

function addBreak(list, b, cap = 50) {
  return [b, ...list].slice(0, cap);
}

function bestBreak(list) {
  return list.length ? list.reduce((a, b) => (b.speedMs > a.speedMs ? b : a)) : null;
}

if (typeof document !== 'undefined') {
  const armBtn = document.getElementById('arm');
  const speedEl = document.getElementById('speed');
  const speedAltEl = document.getElementById('speed-alt');
  const statusEl = document.getElementById('status');
  const tableSel = document.getElementById('table-size');
  const unitSel = document.getElementById('unit');
  const bestEl = document.getElementById('best');
  const breaksEl = document.getElementById('breaks');
  const wave = document.getElementById('wave');
  const waveCtx = wave.getContext('2d');

  let lastResult = null; // { speedMs, gap }
  let breaks = [];
  try { breaks = JSON.parse(localStorage.getItem('breaks')) || []; } catch { /* corrupt: start fresh */ }

  unitSel.value = localStorage.getItem('unit') || 'mph';
  unitSel.addEventListener('change', () => {
    localStorage.setItem('unit', unitSel.value);
    render();
  });

  document.getElementById('clear').addEventListener('click', () => {
    if (!breaks.length || !confirm('Delete all saved breaks?')) return;
    breaks = [];
    localStorage.removeItem('breaks');
    render();
  });

  function fmt(speedMs) {
    const { factor, label } = UNITS[unitSel.value];
    return `${(speedMs * factor).toFixed(1)} ${label}`;
  }

  function render() {
    if (lastResult) {
      speedEl.textContent = fmt(lastResult.speedMs);
      speedAltEl.textContent = `${(lastResult.gap * 1000).toFixed(0)} ms`;
    }
    const best = bestBreak(breaks);
    bestEl.textContent = best ? `Best: ${fmt(best.speedMs)}` : 'No breaks yet';
    breaksEl.replaceChildren();
    for (const b of breaks.slice(0, 10)) {
      const li = document.createElement('li');
      li.textContent = `${fmt(b.speedMs)} · ${b.table} ft · ${new Date(b.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      breaksEl.appendChild(li);
    }
  }

  let audioCtx = null;
  let stream = null;
  let wakeLock = null;
  let analyser = null;
  const finder = new GapFinder();

  function drawWave() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const { width: w, height: h } = wave;
    waveCtx.clearRect(0, 0, w, h);
    // threshold guides
    waveCtx.strokeStyle = '#2c333d';
    waveCtx.beginPath();
    for (const y of [h / 2 - THRESHOLD * (h / 2), h / 2 + THRESHOLD * (h / 2)]) {
      waveCtx.moveTo(0, y);
      waveCtx.lineTo(w, y);
    }
    waveCtx.stroke();
    waveCtx.strokeStyle = '#35c46f';
    waveCtx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const y = (data[i] / 255) * h;
      i ? waveCtx.lineTo((i / data.length) * w, y) : waveCtx.moveTo(0, y);
    }
    waveCtx.stroke();
    requestAnimationFrame(drawWave);
  }

  async function arm() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    source.connect(analyser);
    drawWave();
    // ponytail: deprecated ScriptProcessor; swap for an AudioWorklet if browsers drop it
    const proc = audioCtx.createScriptProcessor(1024, 1, 1);
    const timer = new PeakTimer(audioCtx.sampleRate);

    proc.onaudioprocess = (e) => {
      for (const t of timer.process(e.inputBuffer.getChannelData(0))) onPeak(t);
    };
    source.connect(proc);
    proc.connect(audioCtx.destination); // required for the node to run; outputs silence

    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* nice-to-have */ }

    finder.crackTime = null;
    armBtn.textContent = 'STOP';
    armBtn.classList.add('armed');
    statusEl.textContent = 'Listening… break when ready.';
  }

  function disarm() {
    stream?.getTracks().forEach((t) => t.stop());
    audioCtx?.close();
    wakeLock?.release();
    audioCtx = stream = wakeLock = analyser = null;
    waveCtx.clearRect(0, 0, wave.width, wave.height);
    armBtn.textContent = 'ARM';
    armBtn.classList.remove('armed');
    statusEl.textContent = 'Tap ARM, then break. Mic stays local — nothing is recorded.';
  }

  function onPeak(t) {
    const gap = finder.feed(t);
    if (gap === null) {
      if (finder.crackTime !== null) statusEl.textContent = 'Crack heard — waiting for the rack…';
      return;
    }
    const speedMs = speedFromGap(gap, TABLE_DISTANCE_M[tableSel.value]);
    breaks = addBreak(breaks, { t: Date.now(), speedMs, gap, table: +tableSel.value });
    localStorage.setItem('breaks', JSON.stringify(breaks));
    lastResult = { speedMs, gap };
    render();
    statusEl.textContent = 'Nice break. Still listening…';
  }

  armBtn.addEventListener('click', () => {
    (audioCtx ? Promise.resolve(disarm()) : arm()).catch((err) => {
      statusEl.textContent = `Mic error: ${err.message}`;
      disarm();
    });
  });

  render();

  document.addEventListener('visibilitychange', async () => {
    if (audioCtx && document.visibilityState === 'visible') {
      try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* ignore */ }
    }
  });
}

if (typeof module !== 'undefined') {
  module.exports = { PeakTimer, GapFinder, speedFromGap, addBreak, bestBreak, UNITS, TABLE_DISTANCE_M, MIN_GAP_S, MAX_GAP_S };
}
