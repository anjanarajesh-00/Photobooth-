# Photobooth-
# 🎀 Cutie Booth — Pastel Photo Booth Web App

A cute, aesthetic photo booth that runs entirely in your browser — no backend, no APIs, no cloud, no AI models. Just HTML, CSS, and vanilla JavaScript.

## ✨ Features

- **Camera** — live preview, mirror mode, camera switch, fullscreen, 3s/5s/10s countdown, flash animation, synthesized shutter sound
- **Photo Booth** — single photo or 2/4/6-photo strips, instant preview, retake, high-quality PNG export
- **Filters** — Original, B&W, Vintage, Sepia, Warm, Cool, Dreamy, Soft Glow, Bright, Contrast, Saturation
- **Frames** — 15 watermark-free cute frames (Pink Hearts, Cherry Blossom, Kawaii, Polaroid, Cloud, Butterfly, Floral, Ribbon, Sparkles, Minimal White, Retro Film, Birthday, Graduation, Wedding, None)
- **Stickers** — hearts, stars, flowers, bows, teddy bears, cats, rabbits, butterflies, balloons, cakes, emojis — all draggable, resizable, and rotatable
- **Customization** — custom text with multiple cute fonts, adjustable size/color, date/time stamp, background & border color, washi tape & ribbon decorations
- **Gallery** — session gallery with preview, delete, individual download, and "download all" as a `.zip` (built with a hand-rolled zero-dependency ZIP encoder)
- **Extras** — confetti & floating hearts on save, dark mode, preferences saved via `localStorage`

No frameworks, no external fonts/CDNs, no network calls of any kind — it works fully offline.

## 🚀 Getting started

Clone the repo and open it locally:

```bash
git clone https://github.com/<your-username>/cutie-photo-booth.git
cd cutie-photo-booth
```

Then either:

- **Just open it**: double-click `index.html`, or
- **Run a local server** (recommended — some browsers restrict camera access on `file://`):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## 📁 Project structure

```
cutie-photo-booth/
├── index.html   # structure & screens
├── style.css    # pastel glassmorphism styling
└── script.js    # camera, capture, filters, frames, stickers, gallery, zip export
```

## 🔒 Privacy

Everything happens on your device. Photos are kept only in memory for the current session and are never uploaded anywhere.

## 📄 License

MIT — do whatever you'd like with it.
