# Break Meter 🎱

**Break Meter** is a lightweight, blazing-fast Progressive Web App (PWA) that measures the speed of a billiards break shot using your phone's microphone.

## 🚀 How It Works
Because the distance between the head string and the rack is a known constant based on table size, Break Meter calculates speed by measuring the **time difference** between two distinct acoustic events:
1. The **"crack"** of the cue tip hitting the cue ball.
2. The **"clack"** of the cue ball smashing into the rack.

*Speed = Distance ÷ Time*

## ✨ Features
- **Acoustic Precision:** Uses the Web Audio API for high-resolution acoustic timing.
- **100% Vanilla JS:** No heavy frameworks, no virtual DOM. Fast and responsive.
- **PWA Ready:** Installable on any iOS or Android device directly from the browser.
- **Works Offline:** Uses a Service Worker to cache assets—works perfectly in a basement pool hall with zero cell service.
- **Wake Lock Enabled:** Keeps your screen awake while you're waiting for your opponent to rack.

## 🛠 Tech Stack
- **HTML5 / CSS3:** Mobile-first, responsive UI.
- **Vanilla JavaScript (ES6+):** Core application logic.
- **Web Audio API:** For raw microphone access and acoustic peak detection.
- **PWA APIs:** `manifest.json`, Service Workers, and `navigator.wakeLock`.

## 📂 Project Structure
```text
break-meter/
├── index.html       # The main UI
├── app.js           # Audio processing, UI logic, and math
├── style.css        # Minimalist, dark-mode styling
├── manifest.json    # PWA configuration for mobile installation
└── sw.js            # Service worker for offline caching
```

## 🚀 Getting Started

### 1. Run Locally
To run this project locally, you must serve it over a local web server (because `getUserMedia` requires a secure context or localhost).
- If using VS Code, install the **Live Server** extension.
- Right-click `index.html` and select **"Open with Live Server"**.

### 2. Audio Constraints
Note: For accurate results, the app attempts to disable OS-level audio enhancements (echo cancellation, noise suppression) to get the raw sound of the break.

## 📝 To-Do / Roadmap
- [ ] Basic peak detection algorithm using `AudioContext`
- [ ] Visual audio waveform using HTML5 `<canvas>`
- [ ] LocalStorage integration to save high scores / personal bests
- [ ] Wrap with Capacitor for native app store deployment (Optional)

## 📄 License
MIT
