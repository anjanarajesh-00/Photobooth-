/* =========================================================
   CUTIE BOOTH — vanilla JS photo booth
   No frameworks. No external APIs. 100% local.
   ========================================================= */

(() => {
  "use strict";

  /* ============================================================
     0. STATE
     ============================================================ */
  const state = {
    layoutCount: 1,
    countdownSec: 5,
    filter: "none",
    mirror: true,
    showDate: false,
    darkMode: false,

    stream: null,
    videoDevices: [],
    currentDeviceIndex: 0,

    capturedRaw: [],      // raw ImageBitmap-like canvases from camera (unfiltered)
    frameKey: "none",
    bgColor: "#fff6fa",
    borderColor: "#ffb6d9",
    borderWidth: 14,

    gallery: [],           // {id, dataURL}
    selectedSticker: null,
  };

  const FILTER_CSS = {
    none: "none",
    bw: "grayscale(1)",
    vintage: "sepia(.35) contrast(1.05) saturate(.85) brightness(1.02)",
    sepia: "sepia(.75)",
    warm: "saturate(1.3) sepia(.15) brightness(1.05) hue-rotate(-8deg)",
    cool: "saturate(1.1) hue-rotate(15deg) brightness(1.02) contrast(1.02)",
    dreamy: "brightness(1.12) contrast(.92) saturate(1.15) blur(.6px)",
    softglow: "brightness(1.18) contrast(.9) blur(.4px) saturate(1.05)",
    bright: "brightness(1.28) saturate(1.05)",
    contrast: "contrast(1.4)",
    saturate: "saturate(1.8)",
  };
  const FILTER_LABELS = {
    none: "Original", bw: "B&W", vintage: "Vintage", sepia: "Sepia", warm: "Warm",
    cool: "Cool", dreamy: "Dreamy", softglow: "Soft Glow", bright: "Bright",
    contrast: "Contrast", saturate: "Saturation",
  };

  const STICKER_SETS = {
    "Hearts": ["❤️","💕","💗","💖","💘","🩷","💝"],
    "Stars": ["⭐","✨","🌟","💫"],
    "Flowers": ["🌸","🌺","🌷","🌼","🌻"],
    "Bows": ["🎀"],
    "Teddy": ["🧸"],
    "Cats": ["🐱","🐈","😺"],
    "Rabbits": ["🐰","🐇"],
    "Butterflies": ["🦋"],
    "Balloons": ["🎈"],
    "Cakes": ["🎂","🧁"],
    "Emojis": ["😊","😍","🥰","😘","🤍","👉👈","🥺"],
  };

  const FRAMES = [
    { key: "none", label: "None", emoji: "▫️" },
    { key: "pinkhearts", label: "Pink Hearts", emoji: "💗" },
    { key: "cherryblossom", label: "Cherry Blossom", emoji: "🌸" },
    { key: "kawaii", label: "Kawaii", emoji: "🎀" },
    { key: "polaroid", label: "Polaroid", emoji: "🖼️" },
    { key: "cloud", label: "Cloud", emoji: "☁️" },
    { key: "butterfly", label: "Butterfly", emoji: "🦋" },
    { key: "floral", label: "Floral", emoji: "🌼" },
    { key: "ribbon", label: "Ribbon", emoji: "🎗️" },
    { key: "sparkles", label: "Sparkles", emoji: "✨" },
    { key: "minimal", label: "Minimal White", emoji: "⬜" },
    { key: "retro", label: "Retro Film", emoji: "🎞️" },
    { key: "birthday", label: "Birthday", emoji: "🎉" },
    { key: "graduation", label: "Graduation", emoji: "🎓" },
    { key: "wedding", label: "Wedding", emoji: "💍" },
  ];

  /* ============================================================
     1. PREFERENCES (localStorage)
     ============================================================ */
  function loadPrefs() {
    try {
      const raw = localStorage.getItem("cutieBoothPrefs");
      if (!raw) return;
      const p = JSON.parse(raw);
      Object.assign(state, {
        countdownSec: p.countdownSec ?? state.countdownSec,
        filter: p.filter ?? state.filter,
        mirror: p.mirror ?? state.mirror,
        showDate: p.showDate ?? state.showDate,
        darkMode: p.darkMode ?? state.darkMode,
      });
    } catch (e) { /* ignore */ }
  }
  function savePrefs() {
    localStorage.setItem("cutieBoothPrefs", JSON.stringify({
      countdownSec: state.countdownSec,
      filter: state.filter,
      mirror: state.mirror,
      showDate: state.showDate,
      darkMode: state.darkMode,
    }));
  }

  /* ============================================================
     2. AMBIENT DECORATIONS
     ============================================================ */
  function spawnAmbient() {
    const wrap = document.getElementById("ambient");
    const emojis = ["🌸","✨","💕","🎀","⭐"];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("span");
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.left = Math.random() * 100 + "vw";
      s.style.animationDuration = (14 + Math.random() * 14) + "s";
      s.style.animationDelay = (Math.random() * 14) + "s";
      s.style.fontSize = (14 + Math.random() * 16) + "px";
      wrap.appendChild(s);
    }
  }

  /* ============================================================
     3. NAVIGATION
     ============================================================ */
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  /* ============================================================
     4. DARK MODE
     ============================================================ */
  function applyDarkMode() {
    document.documentElement.classList.toggle("dark", state.darkMode);
    document.getElementById("darkModeToggle").textContent = state.darkMode ? "☀️" : "🌙";
  }

  /* ============================================================
     5. CAMERA
     ============================================================ */
  async function listCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      state.videoDevices = devices.filter(d => d.kind === "videoinput");
    } catch (e) { state.videoDevices = []; }
  }

  async function startCamera(deviceId) {
    stopCamera();
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
      audio: false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.stream = stream;
    const video = document.getElementById("video");
    video.srcObject = stream;
    await video.play();
    if (state.videoDevices.length === 0) await listCameras();
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(t => t.stop());
      state.stream = null;
    }
  }

  function applyMirrorClass() {
    document.getElementById("video").classList.toggle("mirror", state.mirror);
  }

  function applyLiveFilter() {
    document.getElementById("video").style.filter = FILTER_CSS[state.filter] || "none";
  }

  /* ============================================================
     6. SHUTTER SOUND (synthesized via WebAudio, no audio files)
     ============================================================ */
  let audioCtx = null;
  function playShutterSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;

      const click = audioCtx.createOscillator();
      const clickGain = audioCtx.createGain();
      click.type = "square";
      click.frequency.setValueAtTime(1200, now);
      click.frequency.exponentialRampToValueAtTime(220, now + 0.06);
      clickGain.gain.setValueAtTime(0.25, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      click.connect(clickGain).connect(audioCtx.destination);
      click.start(now);
      click.stop(now + 0.1);

      const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuf;
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noise.connect(noiseGain).connect(audioCtx.destination);
      noise.start(now);
    } catch (e) { /* audio not available, ignore silently */ }
  }
  function playBeep(freq = 700) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now); osc.stop(now + 0.16);
    } catch (e) {}
  }

  /* ============================================================
     7. COUNTDOWN + CAPTURE FLOW
     ============================================================ */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function runCountdown() {
    const overlay = document.getElementById("countdownOverlay");
    const num = document.getElementById("countdownNumber");
    overlay.classList.add("show");
    for (let i = state.countdownSec; i >= 1; i--) {
      num.textContent = i;
      num.style.animation = "none"; void num.offsetWidth; num.style.animation = "";
      playBeep(i === 1 ? 900 : 600);
      await sleep(1000);
    }
    overlay.classList.remove("show");
  }

  function grabFrameCanvas() {
    const video = document.getElementById("video");
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 960;
    const ctx = c.getContext("2d");
    if (state.mirror) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, c.width, c.height);
    return c;
  }

  function triggerFlash() {
    const flash = document.getElementById("flashOverlay");
    flash.classList.remove("flash"); void flash.offsetWidth; flash.classList.add("flash");
  }

  function updateShotProgress(done, total) {
    const el = document.getElementById("shotProgress");
    el.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const s = document.createElement("span");
      if (i < done) s.classList.add("done");
      el.appendChild(s);
    }
  }

  function renderThumbs() {
    const wrap = document.getElementById("thumbsPreview");
    wrap.innerHTML = "";
    state.capturedRaw.forEach(c => {
      const img = document.createElement("img");
      img.src = c.toDataURL("image/png");
      wrap.appendChild(img);
    });
  }

  async function captureSequence() {
    const total = state.layoutCount;
    state.capturedRaw = [];
    updateShotProgress(0, total);
    document.getElementById("captureBtn").disabled = true;

    for (let i = 0; i < total; i++) {
      await runCountdown();
      triggerFlash();
      playShutterSound();
      await sleep(120);
      const frame = grabFrameCanvas();
      state.capturedRaw.push(frame);
      updateShotProgress(i + 1, total);
      renderThumbs();
      if (i < total - 1) await sleep(500);
    }

    document.getElementById("captureBtn").disabled = false;
    goToEditor();
  }

  /* ============================================================
     8. COMPOSITION (raw photos -> styled canvas)
     ============================================================ */
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawEmojiScatter(ctx, w, h, emojis, count, avoid) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < count; i++) {
      const e = emojis[i % emojis.length];
      let x, y, tries = 0;
      do {
        x = Math.random() * w;
        y = Math.random() * h;
        tries++;
      } while (avoid && avoid(x, y) && tries < 20);
      const size = 20 + Math.random() * 18;
      ctx.font = size + "px serif";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.6);
      ctx.globalAlpha = 0.85;
      ctx.fillText(e, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFrameDecoration(ctx, w, h, borderWidth, key) {
    const inBorder = (x, y) => x > borderWidth * 1.4 && x < w - borderWidth * 1.4 && y > borderWidth * 1.4 && y < h - borderWidth * 1.4;
    const cornerFont = Math.max(22, borderWidth * 1.6);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const corners = (emoji) => {
      ctx.font = cornerFont + "px serif";
      const pad = borderWidth * 0.7 + 6;
      ctx.fillText(emoji, pad, pad);
      ctx.fillText(emoji, w - pad, pad);
      ctx.fillText(emoji, pad, h - pad);
      ctx.fillText(emoji, w - pad, h - pad);
    };

    switch (key) {
      case "pinkhearts":
        drawEmojiScatter(ctx, w, h, ["💗","💕","🩷"], 10, inBorder);
        break;
      case "cherryblossom":
        drawEmojiScatter(ctx, w, h, ["🌸"], 12, inBorder);
        break;
      case "kawaii":
        corners("🎀");
        drawEmojiScatter(ctx, w, h, ["⭐","💫"], 6, inBorder);
        break;
      case "polaroid":
        // handled via layout (thick white bottom) — subtle corner tape
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#fef3c7";
        ctx.fillRect(w / 2 - 40, -6, 80, 26);
        ctx.globalAlpha = 1;
        break;
      case "cloud":
        drawEmojiScatter(ctx, w, h, ["☁️"], 8, inBorder);
        break;
      case "butterfly":
        drawEmojiScatter(ctx, w, h, ["🦋"], 8, inBorder);
        break;
      case "floral":
        drawEmojiScatter(ctx, w, h, ["🌼","🌷","🌸","🌿"], 12, inBorder);
        break;
      case "ribbon":
        ctx.font = (cornerFont * 1.3) + "px serif";
        ctx.fillText("🎀", w / 2, borderWidth * 0.7);
        break;
      case "sparkles":
        drawEmojiScatter(ctx, w, h, ["✨","⭐"], 14, inBorder);
        break;
      case "minimal":
        break;
      case "retro": {
        // film sprocket holes down both sides
        const holeR = Math.max(6, borderWidth * 0.28);
        const gap = holeR * 3.2;
        ctx.fillStyle = "#f5f5f5";
        for (let y = gap; y < h - gap / 2; y += gap) {
          ctx.beginPath(); ctx.arc(borderWidth / 2, y, holeR, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(w - borderWidth / 2, y, holeR, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "birthday":
        drawEmojiScatter(ctx, w, h, ["🎈","🎉","🎂","✨"], 10, inBorder);
        break;
      case "graduation":
        corners("🎓");
        drawEmojiScatter(ctx, w, h, ["✨"], 6, inBorder);
        break;
      case "wedding":
        drawEmojiScatter(ctx, w, h, ["💍","🤍","🌸"], 8, inBorder);
        break;
      default:
        break;
    }
    ctx.restore();
  }

  // Returns { width, height } and draws onto given canvas context
  function composeMainCanvas() {
    const canvas = document.getElementById("mainCanvas");
    const ctx = canvas.getContext("2d");
    const imgs = state.capturedRaw;
    const count = imgs.length;

    const cellW = 480;
    const cellH = 360;
    const gap = 16;
    let borderWidth = state.borderWidth;
    let bgColor = state.bgColor;
    let borderColor = state.borderColor;

    // frame-specific overrides
    if (state.frameKey === "minimal") { borderColor = "#ffffff"; borderWidth = Math.max(borderWidth, 16); }
    if (state.frameKey === "retro") { borderColor = "#1a1a1a"; bgColor = "#1a1a1a"; }
    if (state.frameKey === "polaroid") { borderColor = "#ffffff"; bgColor = "#ffffff"; }

    const footer = state.showDate ? 56 : 24;
    const innerW = cellW;
    const innerH = count * cellH + (count - 1) * gap;
    const totalW = innerW + borderWidth * 2;
    const totalH = innerH + borderWidth * 2 + footer + (state.frameKey === "polaroid" ? 50 : 0);

    canvas.width = totalW;
    canvas.height = totalH;

    // border
    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, totalW, totalH);
    // inner background
    roundRectPath(ctx, borderWidth * 0.4, borderWidth * 0.4, totalW - borderWidth * 0.8, totalH - borderWidth * 0.8, 18);
    ctx.fillStyle = bgColor;
    ctx.fill();

    // photos
    ctx.filter = FILTER_CSS[state.filter] || "none";
    imgs.forEach((imgCanvas, i) => {
      const x = borderWidth;
      const y = borderWidth + i * (cellH + gap);
      ctx.save();
      roundRectPath(ctx, x, y, cellW, cellH, 14);
      ctx.clip();
      // cover-fit draw
      const srcRatio = imgCanvas.width / imgCanvas.height;
      const dstRatio = cellW / cellH;
      let sx, sy, sw, sh;
      if (srcRatio > dstRatio) {
        sh = imgCanvas.height; sw = sh * dstRatio;
        sx = (imgCanvas.width - sw) / 2; sy = 0;
      } else {
        sw = imgCanvas.width; sh = sw / dstRatio;
        sx = 0; sy = (imgCanvas.height - sh) / 2;
      }
      ctx.drawImage(imgCanvas, sx, sy, sw, sh, x, y, cellW, cellH);
      ctx.restore();
    });
    ctx.filter = "none";

    // date/time footer
    if (state.showDate) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = "20px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      const d = new Date();
      const label = d.toLocaleDateString() + "  " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      ctx.fillText(label, totalW / 2, totalH - footer / 2 - (state.frameKey === "polaroid" ? 50 : 0) + 6);
      ctx.restore();
    }

    // decorative frame overlay
    drawFrameDecoration(ctx, totalW, totalH, borderWidth, state.frameKey);

    return { width: totalW, height: totalH };
  }

  /* ============================================================
     9. STICKERS & TEXT (draggable DOM overlay)
     ============================================================ */
  let stkIdCounter = 0;
  let selectedStk = null;

  function stageRect() {
    return document.getElementById("canvasStage").getBoundingClientRect();
  }

  function addStickerElement({ type, content, fontFamily, fontSize, color, xPct = 0.5, yPct = 0.5 }) {
    const layer = document.getElementById("stickerLayer");
    const el = document.createElement("div");
    el.className = "stk";
    el.dataset.id = ++stkIdCounter;
    el.dataset.type = type;
    el.dataset.content = content;
    el.dataset.fontFamily = fontFamily || "sans-serif";
    el.dataset.fontSize = fontSize || 44;
    el.dataset.color = color || "#333333";
    el.dataset.xPct = xPct;
    el.dataset.yPct = yPct;
    el.dataset.scale = 1;
    el.dataset.rotation = 0;

    const inner = document.createElement("span");
    inner.textContent = content;
    inner.style.fontFamily = el.dataset.fontFamily;
    inner.style.fontSize = fontSize + "px";
    inner.style.color = el.dataset.color;
    inner.style.whiteSpace = "nowrap";
    inner.style.pointerEvents = "none";
    el.appendChild(inner);

    const del = document.createElement("div");
    del.className = "stk-handle stk-delete"; del.textContent = "✕";
    del.addEventListener("pointerdown", (e) => { e.stopPropagation(); el.remove(); if (selectedStk === el) selectedStk = null; });
    el.appendChild(del);

    const resize = document.createElement("div");
    resize.className = "stk-handle stk-resize";
    el.appendChild(resize);

    const rotate = document.createElement("div");
    rotate.className = "stk-handle stk-rotate";
    el.appendChild(rotate);

    layer.appendChild(el);
    positionStk(el);
    selectStk(el);
    makeInteractive(el, resize, rotate);
    return el;
  }

  function positionStk(el) {
    const rect = stageRect();
    const xPct = parseFloat(el.dataset.xPct);
    const yPct = parseFloat(el.dataset.yPct);
    const scale = parseFloat(el.dataset.scale);
    const rotation = parseFloat(el.dataset.rotation);
    el.style.left = (xPct * rect.width) + "px";
    el.style.top = (yPct * rect.height) + "px";
    el.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
  }

  function selectStk(el) {
    document.querySelectorAll(".stk").forEach(s => s.classList.remove("selected"));
    if (el) el.classList.add("selected"