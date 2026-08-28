# Break Meter 🎱

**Break Meter** is a lightweight, blazing-fast Progressive Web App (PWA) that measures the speed of a billiards break shot using your phone's microphone.

## 🚀 How It Works
Because the distance between the head string and the rack is a known constant based on table size, Break Meter calculates speed by measuring the **time difference** between two distinct acoustic events:
1. The **"crack"** of the cue tip hitting the cue ball.
2. The **"clack"** of the cue ball smashing into the rack.

*Speed = Distance ÷ Time*

## ✨ Features
- Sample-accurate acoustic timing (Web Audio API)
- Live waveform, saved breaks, and personal best
- Drag-to-place cue ball for accurate distance (side-rail breaks, any game's rack)
- Installable PWA, works fully offline — 100% vanilla JS, no build step

## 🚀 Getting Started

### 1. Run Locally
No build step — serve the folder over HTTP (`getUserMedia` needs a secure context or localhost, not `file://`):
```sh
python3 -m http.server 8000   # or: npx wrangler dev
```
Then open http://localhost:8000/ (app) or http://localhost:8000/overlay.html (OBS overlay). Run tests with `node --test`.

The service worker caches `app.js`; after editing, hard-reload (Cmd/Ctrl+Shift+R) or tick **Bypass for network** in DevTools → Application → Service Workers.

### 2. OBS Overlay
`overlay.html` runs as an OBS Browser Source (transparent, auto-arms on load). Launch OBS with `--enable-media-stream` and point a Browser Source at `https://<your-host>/overlay.html?table=9&unit=mph`. Open `obs.html` to build the link with a form, plus setup steps.

### 3. Audio Constraints
Note: For accurate results, the app attempts to disable OS-level audio enhancements (echo cancellation, noise suppression) to get the raw sound of the break.

## 📄 License
MIT — see [LICENSE](LICENSE).
