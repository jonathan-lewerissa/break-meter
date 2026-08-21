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
To run this project locally, you must serve it over a local web server (because `getUserMedia` requires a secure context or localhost).
- If using VS Code, install the **Live Server** extension.
- Right-click `index.html` and select **"Open with Live Server"**.

### 2. Audio Constraints
Note: For accurate results, the app attempts to disable OS-level audio enhancements (echo cancellation, noise suppression) to get the raw sound of the break.

## 📄 License
MIT — see [LICENSE](LICENSE).
